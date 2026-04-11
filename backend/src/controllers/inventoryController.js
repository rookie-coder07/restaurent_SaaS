import logger from '../utils/logger.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import InventoryService from '../services/inventoryService.js';

export const getInventoryItems = asyncHandler(async (req, res) => {
  logger.info(`API HIT: GET /inventory/items - Restaurant: ${req.restaurantId}`);
  const items = await InventoryService.getInventoryItems(req.restaurantId);
  return sendSuccess(res, 200, { items, total: items.length }, 'Inventory fetched successfully');
});

export const getInventorySummary = asyncHandler(async (req, res) => {
  logger.info(`API HIT: GET /inventory/summary - Restaurant: ${req.restaurantId}`);
  const summary = await InventoryService.getInventorySummary(req.restaurantId);
  return sendSuccess(res, 200, summary, 'Inventory summary fetched successfully');
});

export const getInventoryHistory = asyncHandler(async (req, res) => {
  logger.info(`API HIT: GET /inventory/history - Restaurant: ${req.restaurantId}, Limit: ${req.query.limit || 50}`);
  const history = await InventoryService.getInventoryHistory(req.restaurantId, Number(req.query.limit || 50));
  return sendSuccess(res, 200, { history, total: history.length }, 'Inventory history fetched successfully');
});

export const createInventoryItem = asyncHandler(async (req, res) => {
  const item = await InventoryService.createInventoryItem(req.restaurantId, req.body);
  return sendSuccess(res, 201, item, 'Inventory item created successfully');
});

export const updateInventoryItem = asyncHandler(async (req, res) => {
  const item = await InventoryService.updateInventoryItem(req.restaurantId, req.params.itemId, req.body);
  return sendSuccess(res, 200, item, 'Inventory item updated successfully');
});

export const addStock = asyncHandler(async (req, res) => {
  const item = await InventoryService.addStock(req.restaurantId, req.params.itemId, req.body, req.user?.id || null);
  return sendSuccess(res, 200, item, 'Stock added successfully');
});

export const adjustStock = asyncHandler(async (req, res) => {
  const item = await InventoryService.adjustStock(req.restaurantId, req.params.itemId, req.body, req.user?.id || null);
  return sendSuccess(res, 200, item, 'Stock adjusted successfully');
});
