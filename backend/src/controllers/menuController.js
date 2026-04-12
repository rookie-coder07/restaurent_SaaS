import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import MenuService from '../services/menuService.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
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
    const rows = [];
    Readable.from(buffer)
      .pipe(csvParser())
      .on('data', (row) => rows.push(row))
      .on('end', () => resolve(rows))
      .on('error', reject);
  });

const parseSpreadsheetBuffer = async (file) => {
  const extension = String(file?.originalname || '').toLowerCase();

  if (extension.endsWith('.csv')) {
    return parseCsvBuffer(file.buffer);
  }

  const workbook = XLSX.read(file.buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const firstSheet = workbook.Sheets[firstSheetName];
  return XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
};

const normalizeBulkRows = (rows = []) => {
  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row || {}).forEach((header) => set.add(header));
      return set;
    }, new Set())
  );

  const headerMap = buildHeaderMap(headers);
  const normalizedRows = [];
  const errors = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rawName = headerMap.name ? row[headerMap.name] : '';
    const rawPrice = headerMap.price ? row[headerMap.price] : '';
    const rawCategory = headerMap.category ? row[headerMap.category] : '';
    const name = String(rawName || '').trim();
    const category = String(rawCategory || '').trim();
    const price = parseNumericValue(rawPrice);

    if (!name) {
      errors.push({ row: rowNumber, reason: 'Missing name' });
      return;
    }

    if (!Number.isFinite(price) || price <= 0) {
      errors.push({ row: rowNumber, reason: 'Missing price' });
      return;
    }

    if (!category) {
      errors.push({ row: rowNumber, reason: 'Missing category' });
      return;
    }

    const preparationTime = parseNumericValue(headerMap.preparationTime ? row[headerMap.preparationTime] : '');
    normalizedRows.push({
      rowNumber,
      name,
      price,
      category,
      description: headerMap.description ? String(row[headerMap.description] || '').trim() : '',
      imageUrl: headerMap.imageUrl ? String(row[headerMap.imageUrl] || '').trim() : '',
      isVeg: parseBooleanValue(headerMap.isVeg ? row[headerMap.isVeg] : ''),
      preparationTime: Number.isFinite(preparationTime) && preparationTime > 0 ? Math.round(preparationTime) : 15,
    });
  });

  return {
    headers,
    mapping: headerMap,
    normalizedRows,
    rowErrors: errors,
  };
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
  if (!['admin', 'manager'].includes(normalizeRole(req.user?.role))) {
    return sendError(res, 403, 'Access denied');
  }

  if (!req.file) {
    return sendError(res, 400, 'Menu file is required');
  }

  const parsedRows = await parseSpreadsheetBuffer(req.file);
  const { normalizedRows, rowErrors } = normalizeBulkRows(parsedRows);
  const uploadResult = await MenuService.bulkUploadMenuItems(req.restaurantId, normalizedRows);

  const result = {
    success: true,
    totalRows: parsedRows.length,
    inserted: uploadResult.inserted,
    skipped: rowErrors.length + uploadResult.errors.length,
    errors: [...rowErrors, ...uploadResult.errors],
  };

  return sendSuccess(res, 200, result, 'Menu uploaded successfully');
});
