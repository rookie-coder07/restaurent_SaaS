import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import MenuService from '../services/menuService.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { query as dbQuery, initializePool } from '../config/postgresPool.js';
import csvParser from 'csv-parser';
import XLSX from 'xlsx';
import { Readable } from 'stream';
import { normalizeRole } from '../constants/index.js';

const BULK_HEADER_ALIASES = {
  name: ['name', 'item', 'item_name', 'item name', 'dish', 'dish_name', 'menu_item', 'menu item'],
  price: ['price', 'cost', 'amount', 'rate', 'mrp'],
  category: ['category', 'type', 'group', 'section'],
  description: ['description', 'details', 'about', 'item_description', 'desc'],
  imageUrl: ['image_url', 'image', 'imageurl', 'photo', 'photo_url'],
  isVeg: ['is_veg', 'veg', 'isveg', 'vegetarian', 'veg_flag'],
  preparationTime: ['preparation_time', 'prep_time', 'prep time', 'time', 'cook_time', 'cooking_time'],
};

const normalizeHeader = (header) =>
  String(header || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const buildHeaderMap = (headers = []) => {
  const normalizedHeaders = headers.map((header) => ({
    original: header,
    normalized: normalizeHeader(header),
  }));

  return Object.entries(BULK_HEADER_ALIASES).reduce((mapping, [field, aliases]) => {
    const matched = normalizedHeaders.find(({ normalized }) =>
      aliases.map(normalizeHeader).includes(normalized)
    );
    mapping[field] = matched?.original || null;
    return mapping;
  }, {});
};

// ✅ NORMALIZATION: Handle case-insensitive and inconsistent column naming
const normalizeRow = (rawRow = {}) => {
  if (!rawRow || typeof rawRow !== 'object') {
    return {};
  }

  // Create a map of normalized keys to original values
  // Normalized means: lowercase, spaces/dashes to underscores
  const normalizedMap = {};
  Object.entries(rawRow).forEach(([key, value]) => {
    if (key && typeof key === 'string') {
      // Normalize: lowercase, spaces/dashes to underscores, remove leading/trailing underscores
      const normalizedKey = String(key)
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      
      // Only set if not already set (preserve first occurrence)
      if (!(normalizedKey in normalizedMap)) {
        normalizedMap[normalizedKey] = value;
      }
    }
  });

  // Helper to safely get value by any case/space variation
  const getValue = (keys) => {
    if (!Array.isArray(keys)) {
      keys = [keys];
    }
    for (const key of keys) {
      const normalizedKey = String(key || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');
      
      if (normalizedKey in normalizedMap) {
        return normalizedMap[normalizedKey];
      }
    }
    return undefined;
  };

  // Return normalized row with standardized field access
  return {
    get name() {
      return getValue(['name', 'item_name', 'item', 'dish', 'dish_name', 'menu_item', 'product_name', 'product']);
    },
    get price() {
      return getValue(['price', 'cost', 'amount', 'rate', 'mrp', 'unit_price', 'selling_price']);
    },
    get category() {
      return getValue(['category', 'type', 'group', 'section', 'category_name', 'item_category']);
    },
    get description() {
      return getValue(['description', 'details', 'about', 'item_description', 'desc', 'notes', 'remarks']);
    },
    get imageUrl() {
      return getValue(['image_url', 'image', 'imageurl', 'photo', 'photo_url', 'image_link', 'picture']);
    },
    get isVeg() {
      return getValue(['is_veg', 'veg', 'isveg', 'vegetarian', 'veg_flag', 'veg_non_veg', 'type_veg']);
    },
    get preparationTime() {
      return getValue(['preparation_time', 'prep_time', 'prep time', 'time', 'cook_time', 'cooking_time', 'prep_minutes']);
    },
    // Raw normalized map for any other field access
    get _raw() {
      return normalizedMap;
    },
  };
};

const parseBooleanValue = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return undefined;
  if (['true', 'yes', 'y', '1', 'veg', 'vegetarian'].includes(normalized)) return true;
  if (['false', 'no', 'n', '0', 'non-veg', 'non veg'].includes(normalized)) return false;
  return undefined;
};

const parseNumericValue = (value) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  const normalized = String(value || '').replace(/[^0-9.-]/g, '').trim();
  return normalized ? Number(normalized) : NaN;
};

const parseCsvBuffer = (buffer) =>
  new Promise((resolve, reject) => {
    if (!buffer || buffer.length === 0) {
      return reject(new Error('CSV buffer is empty'));
    }

    const rows = [];
    const stream = Readable.from(buffer);

    stream
      .pipe(csvParser())
      .on('data', (row) => {
        // Ensure row is an object
        if (typeof row === 'object' && row !== null) {
          rows.push(row);
        }
      })
      .on('end', () => {
        if (rows.length === 0) {
          return reject(new Error('CSV file contains no data rows'));
        }
        resolve(rows);
      })
      .on('error', (error) => {
        logger.error('CSV parsing error', {
          error: error.message,
          bufferSize: buffer.length,
        });
        reject(new Error(`CSV parsing failed: ${error.message}`));
      });
  });

const parseSpreadsheetBuffer = async (file) => {
  if (!file || !file.buffer) {
    throw new Error('File buffer is missing');
  }

  const extension = String(file?.originalname || '').toLowerCase();

  try {
    if (extension.endsWith('.csv')) {
      return await parseCsvBuffer(file.buffer);
    }

    if (extension.endsWith('.xlsx')) {
      const workbook = XLSX.read(file.buffer, { type: 'buffer' });
      
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Excel file contains no sheets');
      }

      const firstSheetName = workbook.SheetNames[0];
      const firstSheet = workbook.Sheets[firstSheetName];
      
      if (!firstSheet) {
        throw new Error('Unable to read Excel sheet');
      }

      const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
      
      if (!Array.isArray(rows)) {
        throw new Error('Excel file parsing returned invalid data');
      }

      return rows;
    }

    throw new Error(`Unsupported file type: ${extension}`);
  } catch (error) {
    logger.error('File parsing error', {
      fileName: file?.originalname,
      fileSize: file?.size,
      error: error.message,
    });
    throw error;
  }
};

// Categories
export const createCategory = asyncHandler(async (req, res) => {
  const category = await MenuService.createCategory(req.restaurantId, req.body);

  return sendSuccess(res, 201, category, 'Category created successfully');
});

export const getCategories = asyncHandler(async (req, res) => {
  logger.info('🏷️  GET /menu/categories - Categories request', {
    restaurantId: req.user?.restaurantId,
  });
  
  const categories = await MenuService.getCategories(req.restaurantId);

  logger.info('✅ Categories fetched', {
    restaurantId: req.user?.restaurantId,
    categoryCount: categories?.length || 0,
  });

  const result = {
    categories,
    total: categories?.length || 0,
  };

  return sendSuccess(res, 200, result, 'Categories fetched successfully');
});

export const updateCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  const category = await MenuService.updateCategory(req.restaurantId, categoryId, req.body);

  return sendSuccess(res, 200, category, 'Category updated successfully');
});

export const deleteCategory = asyncHandler(async (req, res) => {
  const { categoryId } = req.params;

  const result = await MenuService.deleteCategory(req.restaurantId, categoryId);

  return sendSuccess(res, 200, result, 'Category deleted successfully');
});

// Menu Items
export const createMenuItem = asyncHandler(async (req, res) => {
  let imageData = null;

  // Handle image upload if provided
  if (req.body.imageBase64) {
    imageData = await uploadToCloudinary(req.body.imageBase64, 'menu-items');
  }

  const item = await MenuService.createMenuItem(req.restaurantId, req.body, imageData);

  return sendSuccess(res, 201, item, 'Menu item created successfully');
});

export const getMenuItems = asyncHandler(async (req, res) => {
  logger.info('🍽️  GET /menu/items - Menu items request', {
    restaurantId: req.user?.restaurantId,
    userId: req.user?.userId,
    query: req.query,
  });

  const filters = {
    categoryId: req.query.categoryId,
    tags: req.query.tags ? req.query.tags.split(',') : [],
    available: req.query.available === 'true' ? true : undefined,
    limit: parseInt(req.query.limit) || 100,
    skip: parseInt(req.query.skip) || 0,
  };

  const items = await MenuService.getMenuItems(req.user.restaurantId, filters);
  
  logger.info('✅ Menu items fetched', {
    restaurantId: req.user?.restaurantId,
    itemCount: items?.length || 0,
  });

  const result = {
    items,
    total: items?.length || 0,
    limit: filters.limit,
    skip: filters.skip,
  };

  return sendSuccess(res, 200, result, 'Menu items fetched successfully');
});

export const getMenuItemById = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const item = await MenuService.getMenuItemById(req.restaurantId, itemId);

  return sendSuccess(res, 200, item, 'Menu item fetched successfully');
});

export const updateMenuItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  let imageData = null;
  if (req.body.imageBase64) {
    // Delete old image if exists
    const existingItem = await MenuService.getMenuItemById(req.restaurantId, itemId);
    if (existingItem.cloudinaryImageId) {
      await deleteFromCloudinary(existingItem.cloudinaryImageId);
    }

    imageData = await uploadToCloudinary(req.body.imageBase64, 'menu-items');
  }

  const item = await MenuService.updateMenuItem(req.restaurantId, itemId, req.body, imageData);

  return sendSuccess(res, 200, item, 'Menu item updated successfully');
});

export const deleteMenuItem = asyncHandler(async (req, res) => {
  const { itemId } = req.params;

  const result = await MenuService.deleteMenuItem(req.restaurantId, itemId);

  return sendSuccess(res, 200, result, 'Menu item deleted successfully');
});

export const toggleItemAvailability = asyncHandler(async (req, res) => {
  const { itemId } = req.params;
  const { isAvailable } = req.body;

  const item = await MenuService.toggleItemAvailability(req.user.restaurantId, itemId, isAvailable);

  return sendSuccess(res, 200, item, 'Availability toggled successfully');
});

export const bulkUploadMenu = asyncHandler(async (req, res) => {
  // Top-level error wrapper to catch ANY initialization issues
    let startTime;
    try {
      startTime = Date.now();
      
      // Validate database is initialized
      if (!dbQuery || typeof dbQuery !== 'function') {
        logger.error('[BULK_UPLOAD] ❌ DATABASE NOT INITIALIZED', {
          hasDbQuery: typeof dbQuery === 'function',
        });
        return sendError(res, 500, 'Database client not initialized. Please check server configuration.');
      }
      
      // Initialize PostgreSQL connection pool
      initializePool();
      
    // 1. VALIDATE AUTHORIZATION
    // ✅ CRITICAL: Only admin (owner) role can bulk upload
    const normalizedUserRole = normalizeRole(req.user?.role);
    logger.info('[BULK_UPLOAD] Authorization check:', {
      userRole: req.user?.role,
      normalizedRole: normalizedUserRole,
      restaurantId: req.restaurantId,
      userId: req.user?.userId,
    });

    if (!['admin'].includes(normalizedUserRole)) {
      logger.warn('[BULK_UPLOAD] Access denied for user', {
        userRole: normalizedUserRole,
        userId: req.user?.userId,
        email: req.user?.email,
      });
      return sendError(res, 403, 'Only restaurant owners can bulk upload menu items');
    }

    // 2. VALIDATE FILE INPUT - DETAILED LOGGING
    logger.info('[BULK_UPLOAD] File validation starting', {
      hasFile: !!req.file,
      fileName: req.file?.originalname,
      mimeType: req.file?.mimetype,
      fileSize: req.file?.size,
      bufferExists: !!req.file?.buffer,
      bufferLength: req.file?.buffer?.length,
      restaurantId: req.restaurantId,
    });

    if (!req.file) {
      logger.error('[BULK_UPLOAD] ❌ FILE NOT RECEIVED', {
        receivedKeys: Object.keys(req).filter(k => k !== 'body'),
        hasMulter: !!req.file,
        contentType: req.headers['content-type'],
        restaurantId: req.restaurantId,
      });
      return sendError(res, 400, 'Menu file is required. Please upload a CSV or XLSX file.');
    }

    if (!req.file.buffer || req.file.buffer.length === 0) {
      logger.error('[BULK_UPLOAD] ❌ EMPTY FILE PROVIDED', {
        fileName: req.file.originalname,
        bufferLength: req.file.buffer?.length,
        restaurantId: req.restaurantId,
        userId: req.user?.userId,
      });
      return sendError(res, 400, 'Uploaded file is empty');
    }

  // 3. PARSE FILE SAFELY WITH DETAILED LOGGING
  let parsedRows;
  try {
    logger.info('[BULK_UPLOAD] Starting file parsing', {
      fileName: req.file.originalname,
      fileSize: req.file.size,
      bufferLength: req.file.buffer.length,
    });

    parsedRows = await parseSpreadsheetBuffer(req.file);

    logger.info('[BULK_UPLOAD] File parsed - Row details', {
      totalRows: Array.isArray(parsedRows) ? parsedRows.length : 'NOT_AN_ARRAY',
      isArray: Array.isArray(parsedRows),
      firstRowKeys: parsedRows?.[0] ? Object.keys(parsedRows[0]) : [],
      firstRowSample: parsedRows?.[0] || null,
      isEmpty: !Array.isArray(parsedRows) || parsedRows.length === 0,
    });

    if (!Array.isArray(parsedRows) || parsedRows.length === 0) {
      logger.error('[BULK_UPLOAD] ❌ PARSE RESULT EMPTY OR INVALID', {
        result: parsedRows,
        type: typeof parsedRows,
      });
      return sendError(res, 400, 'File contains no data rows. Please check your file format.');
    }

    logger.info('[BULK_UPLOAD] File parsed successfully', {
      fileName: req.file.originalname,
      rowCount: parsedRows.length,
      restaurantId: req.restaurantId,
      fileSize: req.file.size,
    });
  } catch (parseError) {
    logger.error('[BULK_UPLOAD] ❌ FILE PARSING FAILED', {
      fileName: req.file.originalname,
      error: parseError.message,
      errorName: parseError.name,
      errorStack: parseError.stack,
      restaurantId: req.restaurantId,
      userId: req.user?.userId,
    });
    return sendError(res, 400, `File parsing failed: ${parseError.message}`);
  }

  // 4. BUILD HEADER MAP
  let headerMap;
  try {
    logger.info('[BULK_UPLOAD] Building header map', {
      rowCount: parsedRows.length,
      restaurantId: req.restaurantId,
    });

    const headers = Array.from(
      parsedRows.reduce((set, row) => {
        Object.keys(row || {}).forEach((header) => set.add(header));
        return set;
      }, new Set())
    );
    headerMap = buildHeaderMap(headers);

    logger.info('[BULK_UPLOAD] Header map built successfully', {
      detectedColumns: {
        name: headerMap.name,
        price: headerMap.price,
        category: headerMap.category,
      },
      headers,
    });
  } catch (headerError) {
    logger.error('[BULK_UPLOAD] Header detection failed', {
      error: headerError.message,
      restaurantId: req.restaurantId,
      userId: req.user?.userId,
    });
    return sendError(res, 400, `Unable to detect columns in file: ${headerError.message}`);
  }

  // 5. FETCH EXISTING CATEGORIES WITH DEDUPLICATION
  let categoryMap;
  try {
    logger.info('[BULK_UPLOAD] Fetching existing categories', {
      restaurantId: req.restaurantId,
    });

    let existingCategories = [];
    try {
      const result = await dbQuery(
        'SELECT id, name FROM menu_categories WHERE restaurant_id = $1',
        [req.restaurantId]
      );
      existingCategories = result.rows;
    } catch (err) {
      logger.error('[BULK_UPLOAD] Error fetching existing categories', {
        error: err.message,
        code: err.code,
      });
      throw err;
    }

    if (!existingCategories || existingCategories.length === 0) {
      categoryMap = new Map();
      logger.info('[BULK_UPLOAD] No existing categories found - will create new ones as needed', {
        restaurantId: req.restaurantId,
      });
    } else {
      // Deduplicate categories by name (case-insensitive)
      // Keep the first occurrence of each category name
      const seenNormalized = new Set();
      const deduplicatedCategories = [];

      for (const category of existingCategories) {
        const normalizedName = String(category.name || '').trim().toLowerCase();
        
        if (!seenNormalized.has(normalizedName)) {
          seenNormalized.add(normalizedName);
          deduplicatedCategories.push(category);
        } else {
          logger.warn('[BULK_UPLOAD] Duplicate category found and skipped', {
            categoryName: category.name,
            normalizedName: normalizedName,
            categoryId: category.id,
            restaurantId: req.restaurantId,
          });
        }
      }

      // Build map with normalized (lowercase) keys
      categoryMap = new Map(
        deduplicatedCategories.map((category) => [
          String(category.name || '').trim().toLowerCase(),
          {
            id: category.id,
            originalName: category.name, // Keep original for reference
          },
        ])
      );

      logger.info('[BULK_UPLOAD] Categories fetched and deduplicated successfully', {
        totalFetched: existingCategories.length,
        uniqueCategories: deduplicatedCategories.length,
        duplicatesRemoved: existingCategories.length - deduplicatedCategories.length,
        restaurantId: req.restaurantId,
      });
    }
  } catch (categoryError) {
    logger.error('[BULK_UPLOAD] Category fetch failed', {
      error: categoryError.message,
      errorCode: categoryError.code,
      restaurantId: req.restaurantId,
      userId: req.user?.userId,
    });
    return sendError(res, 500, `Unable to fetch categories: ${categoryError.message}`);
  }

// 6. CATEGORY RESOLVER WITH CASE-INSENSITIVE MATCHING
  // Build enhanced map with proper error handling for duplicates
  const enhancedCategoryMap = new Map();
  let duplicateWarningCount = 0;

  for (const [key, value] of categoryMap.entries()) {
    const normalizedKey = String(key).trim().toLowerCase();
    
    // If we already have this normalized key, it's a duplicate
    if (enhancedCategoryMap.has(normalizedKey)) {
      duplicateWarningCount++;
      logger.warn('[BULK_UPLOAD] Category map duplicate detected', {
        normalizedKey,
        newValue: value,
        existingValue: enhancedCategoryMap.get(normalizedKey),
      });
      // Keep the first one (already in map)
      continue;
    }
    
    enhancedCategoryMap.set(normalizedKey, value);
  }

  if (duplicateWarningCount > 0) {
    logger.warn('[BULK_UPLOAD] Duplicates found in category map', {
      count: duplicateWarningCount,
      totalWorking: enhancedCategoryMap.size,
    });
  }

  const resolveCategoryId = async (categoryName) => {
    try {
      const normalizedCategory = String(categoryName || '').trim().toLowerCase();

      if (!normalizedCategory) {
        logger.warn('[BULK_UPLOAD] Empty category name provided');
        return null;
      }

      // Check existing categories first (always prefer existing)
      if (enhancedCategoryMap.has(normalizedCategory)) {
        const categoryData = enhancedCategoryMap.get(normalizedCategory);
        // Handle both old and new map structures
        const categoryId = categoryData.id || categoryData;
        
        logger.debug('[BULK_UPLOAD] Found existing category in cache', {
          categoryName: categoryName.trim(),
          normalizedKey: normalizedCategory,
          categoryId,
          originalName: categoryData.originalName || 'N/A',
        });
        return categoryId;
      }

      // Not found in cache - try database query with LOWER() for case-insensitive match
      logger.debug('[BULK_UPLOAD] Category not in cache, querying database', {
        categoryName: categoryName.trim(),
        restaurantId: req.restaurantId,
      });

      let foundCategories = [];
      try {
        const result = await dbQuery(
          'SELECT id, name FROM menu_categories WHERE restaurant_id = $1',
          [req.restaurantId]
        );
        foundCategories = result.rows;
      } catch (queryError) {
        logger.warn('[BULK_UPLOAD] Database query error when checking for category', {
          error: queryError.message,
          code: queryError.code,
        });
      }

      // Search for case-insensitive match in results
      if (foundCategories && foundCategories.length > 0) {
        const matchedCategory = foundCategories.find(
          (cat) => String(cat.name || '').trim().toLowerCase() === normalizedCategory
        );

        if (matchedCategory) {
          logger.info('[BULK_UPLOAD] Found category in database (case-insensitive)', {
            searchedFor: categoryName.trim(),
            found: matchedCategory.name,
            categoryId: matchedCategory.id,
          });
          
          // Cache for future use
          enhancedCategoryMap.set(normalizedCategory, {
            id: matchedCategory.id,
            originalName: matchedCategory.name,
          });
          
          return matchedCategory.id;
        }
      }

      // Category not found - create new one
      logger.info('[BULK_UPLOAD] Creating new category (not found)', {
        categoryName: categoryName.trim(),
        restaurantId: req.restaurantId,
      });

      let createdCategory = null;
      let createCategoryError = null;
      try {
        const result = await dbQuery(
          `INSERT INTO menu_categories (restaurant_id, name, description, status)
           VALUES ($1, $2, '', 'active')
           RETURNING id, name`,
          [req.restaurantId, String(categoryName || '').trim()]
        );
        createdCategory = result.rows[0];
      } catch (err) {
        createCategoryError = err;
      }

      if (createCategoryError) {
        // Check if it's a unique constraint error (category name already exists)
        if (createCategoryError.code === '23505') {
          logger.warn('[BULK_UPLOAD] Category creation failed - unique constraint', {
            categoryName: categoryName.trim(),
            error: createCategoryError.message,
            hint: createCategoryError.hint,
          });
          
          // Try to fetch it again (it was just created by another request)
          let retryCategories = [];
          try {
            const retryResult = await dbQuery(
              'SELECT id, name FROM menu_categories WHERE restaurant_id = $1',
              [req.restaurantId]
            );
            retryCategories = retryResult.rows;
          } catch (retryErr) {
            logger.warn('[BULK_UPLOAD] Retry fetch failed', { error: retryErr.message });
          }

          if (retryCategories && retryCategories.length > 0) {
            const retryMatch = retryCategories.find(
              (cat) => String(cat.name || '').trim().toLowerCase() === normalizedCategory
            );
            if (retryMatch) {
              enhancedCategoryMap.set(normalizedCategory, {
                id: retryMatch.id,
                originalName: retryMatch.name,
              });
              return retryMatch.id;
            }
          }
          
          return null;
        }

        logger.error('[BULK_UPLOAD] Category creation failed', {
          categoryName: categoryName.trim(),
          error: createCategoryError.message,
          errorCode: createCategoryError.code,
          restaurantId: req.restaurantId,
        });
        return null;
      }

      if (!createdCategory || !createdCategory.id) {
        logger.warn('[BULK_UPLOAD] Created category but no ID returned', {
          categoryName: categoryName.trim(),
        });
        return null;
      }

      // Cache the newly created category
      enhancedCategoryMap.set(normalizedCategory, {
        id: createdCategory.id,
        originalName: createdCategory.name,
      });

      logger.info('[BULK_UPLOAD] Category created successfully', {
        categoryName: categoryName.trim(),
        categoryId: createdCategory.id,
      });
      
      return createdCategory.id;
    } catch (error) {
      logger.error('[BULK_UPLOAD] Category resolution error', {
        categoryName: categoryName.trim(),
        error: error.message,
        errorStack: error.stack,
        restaurantId: req.restaurantId,
      });
      return null;
    }
  };

  // 7. VALIDATE AND BUILD MENU ITEMS WITH ENHANCED LOGGING
  const menuItems = [];
  const errors = [];
  let processedRowCount = 0;

  logger.info('[BULK_UPLOAD] Starting row processing', {
    totalRows: parsedRows.length,
    restaurantId: req.restaurantId,
  });

  for (let rowIndex = 0; rowIndex < parsedRows.length; rowIndex++) {
    const rawRow = parsedRows[rowIndex];
    const rowNumber = rowIndex + 1; // 1-based row number

    try {
      logger.debug('[BULK_UPLOAD] Processing row', {
        rowNumber,
        rawRowKeys: Object.keys(rawRow || {}),
        rawRowSample: JSON.stringify(rawRow).substring(0, 200),
      });

      // ✅ NORMALIZE: Convert all column names to case-insensitive access
      const row = normalizeRow(rawRow);

      logger.debug('[BULK_UPLOAD] Row normalized', {
        rowNumber,
        normalizedKeys: Object.keys(row),
        name: row.name,
        category: row.category,
        price: row.price,
      });

      // EXTRACT AND VALIDATE NAME
      const name = String(row.name || '').trim();

      if (!name) {
        logger.warn('[BULK_UPLOAD] Row missing name', {
          rowNumber,
          availableFields: Object.keys(row),
        });
        errors.push({
          row: rowNumber,
          reason: 'Missing required field: name',
          data: rawRow,
        });
        continue;
      }

      if (name.length > 255) {
        logger.warn('[BULK_UPLOAD] Name too long', {
          rowNumber,
          name: name.substring(0, 50),
          length: name.length,
        });
        errors.push({
          row: rowNumber,
          reason: `Item name exceeds 255 characters (${name.length})`,
          data: { name },
        });
        continue;
      }

      // EXTRACT AND VALIDATE PRICE
      const priceRaw = String(row.price || '').trim();

      if (!priceRaw) {
        logger.warn('[BULK_UPLOAD] Row missing price', {
          rowNumber,
          name: name.substring(0, 50),
          availableFields: Object.keys(row),
        });
        errors.push({
          row: rowNumber,
          reason: 'Missing required field: price',
          data: { name },
        });
        continue;
      }

      const price = Number(priceRaw.replace(/[^\d.]/g, ''));

      if (!Number.isFinite(price) || Number.isNaN(price)) {
        logger.warn('[BULK_UPLOAD] Invalid price value', {
          rowNumber,
          name: name.substring(0, 50),
          priceRaw,
          parsed: price,
        });
        errors.push({
          row: rowNumber,
          reason: `Invalid price value: "${priceRaw}" (not a valid number)`,
          data: { name, priceRaw },
        });
        continue;
      }

      if (price < 0) {
        logger.warn('[BULK_UPLOAD] Negative price', {
          rowNumber,
          name: name.substring(0, 50),
          price,
        });
        errors.push({
          row: rowNumber,
          reason: `Price cannot be negative: ${price}`,
          data: { name, price },
        });
        continue;
      }

      if (price > 999999) {
        logger.warn('[BULK_UPLOAD] Price exceeds maximum', {
          rowNumber,
          name: name.substring(0, 50),
          price,
        });
        errors.push({
          row: rowNumber,
          reason: `Price exceeds maximum allowed value: ${price}`,
          data: { name, price },
        });
        continue;
      }

      // EXTRACT AND VALIDATE CATEGORY
      const category = String(row.category || '').trim();

      if (!category) {
        logger.warn('[BULK_UPLOAD] Row missing category', {
          rowNumber,
          name: name.substring(0, 50),
          availableFields: Object.keys(row),
        });
        errors.push({
          row: rowNumber,
          reason: 'Missing required field: category',
          data: { name },
        });
        continue;
      }

      // RESOLVE CATEGORY ID (with retry for newly created categories)
      logger.debug('[BULK_UPLOAD] Resolving category', {
        rowNumber,
        name: name.substring(0, 50),
        category,
      });

      let category_id = await resolveCategoryId(category);

      if (!category_id) {
        logger.warn('[BULK_UPLOAD] ❌ Category resolution failed', {
          rowNumber,
          name: name.substring(0, 50),
          category: category.trim(),
          restaurantId: req.restaurantId,
        });
        errors.push({
          row: rowNumber,
          reason: `Unable to resolve or create category: "${category.trim()}". Make sure the category exists or has valid format.`,
          data: { name, category },
        });
        continue;
      }

      logger.debug('[BULK_UPLOAD] ✅ Category resolved', {
        rowNumber,
        category,
        categoryId: category_id,
      });

      // EXTRACT OPTIONAL FIELDS
      const description = String(row.description || '').trim();

      const image_url = String(row.imageUrl || '').trim();

      const preparationTimeRaw = row.preparationTime || '';

      const preparation_time = (() => {
        const parsed = parseNumericValue(preparationTimeRaw);
        return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : 15;
      })();

      // EXTRACT VEGETARIAN FLAG
      const isVegRaw = row.isVeg || '';

      const tags = parseBooleanValue(isVegRaw) === true ? 'veg' : '';

      // BUILD MENU ITEM OBJECT
      const menuItem = {
        name,
        price,
        category_id,
        restaurant_id: req.restaurantId,
        description,
        image_url,
        preparation_time,
        tags,
        status: 'active',
      };

      logger.debug('[BULK_UPLOAD] ✅ Row valid, item created', {
        rowNumber,
        name: name.substring(0, 50),
        price,
        categoryId: category_id,
        restaurantId: req.restaurantId,
      });

      menuItems.push(menuItem);
      processedRowCount++;
    } catch (rowError) {
      logger.error('[BULK_UPLOAD] ❌ Row processing error', {
        rowNumber,
        error: rowError.message,
        errorName: rowError.name,
        errorStack: rowError.stack,
        rowData: String(rawRow).substring(0, 200),
      });
      errors.push({
        row: rowNumber,
        reason: `Processing error: ${rowError.message}`,
        data: rawRow,
      });
    }
  }

  logger.info('[BULK_UPLOAD] Row processing complete', {
    totalRows: parsedRows.length,
    validRows: processedRowCount,
    errorRows: errors.length,
    restaurantId: req.restaurantId,
  });

  // 8. SAFE DATABASE INSERT WITH FIELD VALIDATION AND ENHANCED LOGGING
  let insertedCount = 0;
  let insertError = null;

  if (menuItems.length > 0) {
    try {
      logger.info('[BULK_UPLOAD] Pre-insert validation starting', {
        count: menuItems.length,
        restaurantId: req.restaurantId,
        userId: req.user?.userId,
      });

      // Validate each item has required fields before insert
      const validItems = [];
      let invalidCount = 0;

      for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        const hasAllRequired = item.name && item.price && item.category_id && item.restaurant_id;

        if (!hasAllRequired) {
          logger.warn('[BULK_UPLOAD] ❌ Invalid item detected (missing required field)', {
            index: i,
            item: {
              name: item.name || 'MISSING',
              price: item.price || 'MISSING',
              category_id: item.category_id || 'MISSING',
              restaurant_id: item.restaurant_id || 'MISSING',
            },
          });
          invalidCount++;
          continue;
        }

        validItems.push(item);
      }

      logger.info('[BULK_UPLOAD] Pre-insert validation complete', {
        total: menuItems.length,
        valid: validItems.length,
        invalid: invalidCount,
      });

      if (validItems.length === 0) {
        logger.error('[BULK_UPLOAD] ❌ NO VALID ITEMS AFTER VALIDATION', {
          totalItems: menuItems.length,
          invalidCount,
        });
        return sendError(res, 422, 'No valid items to insert after data validation', {
          errors: errors.slice(0, 20),
        });
      }

      if (validItems.length < menuItems.length) {
        logger.warn('[BULK_UPLOAD] Some items filtered out during validation', {
          total: menuItems.length,
          valid: validItems.length,
          filtered: menuItems.length - validItems.length,
        });
      }

      // Log sample item before insert
      logger.info('[BULK_UPLOAD] Sample item before insert', {
        sample: {
          name: validItems[0]?.name,
          price: validItems[0]?.price,
          category_id: validItems[0]?.category_id,
          restaurant_id: validItems[0]?.restaurant_id,
          status: validItems[0]?.status,
        },
        totalCount: validItems.length,
      });

      logger.info('[BULK_UPLOAD] Attempting database insert', {
        count: validItems.length,
        restaurantId: req.restaurantId,
        userId: req.user?.userId,
      });

      let insertedCount = 0;
      const insertColumns = 'name, price, category_id, restaurant_id, description, image_url, preparation_time, tags, status';
      const insertPlaceholders = validItems.map((_, idx) => {
        const base = idx * 9;
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
      }).join(',');
      
      const insertParams = validItems.flatMap(item => [
        item.name, item.price, item.category_id, item.restaurant_id,
        item.description, item.image_url, item.preparation_time, item.tags, item.status
      ]);
      
      let data = [];
      try {
        const result = await dbQuery(
          `INSERT INTO menu_items (${insertColumns}) VALUES ${insertPlaceholders} RETURNING id, name, price, category_id`,
          insertParams
        );
        data = result.rows;
        insertedCount = data.length;
      } catch (error) {
        logger.error('[BULK_UPLOAD] ❌ DATABASE INSERT FAILED', {
          error: error.message,
          code: error.code,
          itemCount: validItems.length,
          restaurantId: req.restaurantId,
        });
        throw error;
      }

      logger.info('[BULK_UPLOAD] ✅ Database insert successful', {
        count: insertedCount,
        restaurantId: req.restaurantId,
        userId: req.user?.userId,
        firstInsertedId: data?.[0]?.id,
        totalInsertedIds: data?.length,
      });
    } catch (insertErrorObj) {
      insertError = insertErrorObj;
      
      // Provide helpful error messages based on the type of error
      let userFriendlyMessage = insertErrorObj.message;
      
      if (insertErrorObj.code === '23505') {
        userFriendlyMessage = 'Duplicate item found - some items may already exist in the system';
      } else if (insertErrorObj.code === '23503') {
        userFriendlyMessage = 'Category not found - please check that categories exist';
      } else if (insertErrorObj.code === '23502') {
        userFriendlyMessage = 'Missing required field - please check data format';
      }
      
      logger.error('[BULK_UPLOAD] ❌ Insert operation error', {
        error: insertErrorObj.message,
        errorCode: insertErrorObj.code,
        userMessage: userFriendlyMessage,
        itemCount: menuItems.length,
        restaurantId: req.restaurantId,
        userId: req.user?.userId,
      });
    }
  }

  // 9. BUILD RESPONSE WITH DETAILED LOGGING
  const skippedCount = errors.length;
  const totalRows = parsedRows.length;

  logger.info('[BULK_UPLOAD] Creating response', {
    total: totalRows,
    inserted: insertedCount,
    skipped: skippedCount,
    hasError: !!insertError,
    restaurantId: req.restaurantId,
  });

  // If database insert failed, return error with details
  if (insertError) {
    const errorCode = insertError.code;
    let errorMessage = `Database error: ${insertError.message}`;
    
    if (errorCode === '23503') {
      errorMessage = `Foreign key error: Category not found for some items. Valid rows: ${insertedCount}, Skipped: ${skippedCount}`;
    } else if (errorCode === '23505') {
      errorMessage = `Duplicate error: Some items may already exist. Valid rows: ${insertedCount}, Skipped: ${skippedCount}`;
    }
    
    logger.error('[BULK_UPLOAD] ❌ RETURNING 500 ERROR', {
      errorMessage,
      errorCode,
      insertedCount,
      skippedCount,
    });

    return sendError(res, 500, errorMessage, {
      insertedCount,
      skippedCount,
      totalRows,
      errors: errors.slice(0, 10),
    });
  }

  // If no items were inserted at all
  if (insertedCount === 0 && skippedCount > 0) {
    logger.error('[BULK_UPLOAD] ❌ NO ITEMS INSERTED - ALL ROWS HAD ERRORS', {
      totalRows,
      errorCount: skippedCount,
      restaurantId: req.restaurantId,
    });
    return sendError(res, 422, `No valid rows to insert. All ${totalRows} rows were skipped. Please check the error details.`, {
      errors: errors.slice(0, 20),
      totalErrors: errors.length,
    });
  }

  // Success response
  logger.info('[BULK_UPLOAD] ✅ UPLOAD COMPLETED SUCCESSFULLY', {
    total: totalRows,
    inserted: insertedCount,
    skipped: skippedCount,
    restaurantId: req.restaurantId,
    userId: req.user?.userId,
  });

  return res.json({
    success: true,
    message: `Successfully uploaded ${insertedCount} item${insertedCount !== 1 ? 's' : ''}`,
    data: {
      total: totalRows,
      inserted: insertedCount,
      skipped: skippedCount,
      errors: errors.length > 0 ? errors.slice(0, 20) : [],
      hasMoreErrors: errors.length > 20,
      totalErrors: errors.length,
    },
  });
  } catch (error) {
    // ✅ CRITICAL: Catch ANY errors not handled above
    const errorDetails = {
      message: error?.message || 'Unknown error',
      name: error?.name || 'UnknownError',
      code: error?.code,
      stack: error?.stack,
      restaurantId: req.restaurantId,
      userId: req.user?.userId,
      fileName: req.file?.originalname,
      errorType: typeof error,
      isAxiosError: error?.isAxiosError || false,
      responseStatus: error?.response?.status,
      supabaseError: error?.status || error?.code,
    };
    
    logger.error('[BULK_UPLOAD] ❌ UNCAUGHT ERROR IN BULK UPLOAD', errorDetails);

    // Return meaningful error message based on error type
    if (error?.message?.includes('Cannot read') || error?.message?.includes('Cannot access')) {
      logger.error('[BULK_UPLOAD] ❌ FILE FORMAT ERROR', {
        message: error.message,
        hint: 'Check if file is valid CSV or XLSX',
      });
      return sendError(res, 400, 'File format error - unable to parse file. Please ensure file is valid CSV or XLSX.');
    }

    if (error?.message?.includes('ENOENT') || error?.message?.includes('not found')) {
      logger.error('[BULK_UPLOAD] ❌ FILE NOT FOUND', {
        fileName: req.file?.originalname,
        message: error.message,
      });
      return sendError(res, 400, 'File not found or inaccessible.');
    }

    if (error?.message?.includes('permission') || error?.message?.includes('EACCES')) {
      logger.error('[BULK_UPLOAD] ❌ PERMISSION DENIED', {
        message: error.message,
      });
      return sendError(res, 403, 'Permission denied - unable to process file.');
    }

    if (error?.message?.includes('memory') || error?.message?.includes('out of memory')) {
      logger.error('[BULK_UPLOAD] ❌ OUT OF MEMORY', {
        fileSize: req.file?.size,
        maxAllowed: '5MB',
      });
      return sendError(res, 413, 'File too large to process. Maximum 5MB allowed.');
    }
    
    // Check for Supabase errors
    if (error?.code === '23505' || error?.message?.includes('duplicate')) {
      return sendError(res, 409, 'Duplicate key error - some items may already exist in the system', {
        details: 'Please check your data and try again',
      });
    }
    
    if (error?.code === '23503' || error?.message?.includes('foreign key')) {
      return sendError(res, 400, 'Foreign key error - category or restaurant not found', {
        details: 'Please ensure all categories exist',
      });
    }

    // Generic fallback with full error details
    logger.error('[BULK_UPLOAD] ❌ GENERIC FALLBACK ERROR', {
      errorMessage: error?.message,
      errorType: error?.name,
      fullStack: error?.stack,
      allDetails: errorDetails,
    });

    const userMessage = error?.message || 'An error occurred during bulk upload. Please try again.';
    return sendError(res, 500, `Bulk upload error: ${userMessage}`, {
      errorType: error?.name,
      errorMessage: error?.message,
      code: error?.code,
    });
  }
});
