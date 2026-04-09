import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import MenuService from '../services/menuService.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

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
