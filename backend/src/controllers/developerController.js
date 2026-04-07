import { asyncHandler } from '../middleware/errorHandler.js';
import { sendSuccess } from '../utils/apiResponse.js';
import DeveloperService from '../services/developerService.js';

export const getDashboard = asyncHandler(async (req, res) => {
  const dashboard = await DeveloperService.getDashboard();
  return sendSuccess(res, 200, dashboard, 'Developer dashboard fetched successfully');
});

export const getRestaurants = asyncHandler(async (req, res) => {
  const items = await DeveloperService.listRestaurants();
  return sendSuccess(res, 200, { items }, 'Restaurants fetched successfully');
});

export const updateRestaurantAccess = asyncHandler(async (req, res) => {
  const item = await DeveloperService.updateRestaurantAccess(req.params.restaurantId, req.body, req.user);
  return sendSuccess(res, 200, item, 'Restaurant access updated successfully');
});

export const getUsers = asyncHandler(async (req, res) => {
  const items = await DeveloperService.listUsers(req.query);
  return sendSuccess(res, 200, { items }, 'Users fetched successfully');
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const item = await DeveloperService.updateUserStatus(req.params.userId, req.body.status, req.user);
  return sendSuccess(res, 200, item, 'User status updated successfully');
});

export const resetUserPassword = asyncHandler(async (req, res) => {
  const item = await DeveloperService.resetUserPassword(req.params.userId, req.body.newPassword, req.user);
  return sendSuccess(res, 200, item, 'User password reset successfully');
});

export const getSystemSettings = asyncHandler(async (req, res) => {
  const settings = await DeveloperService.getSystemSettings();
  return sendSuccess(res, 200, settings, 'System settings fetched successfully');
});

export const updateMaintenance = asyncHandler(async (req, res) => {
  const item = await DeveloperService.updateMaintenance(req.body, req.user);
  return sendSuccess(res, 200, item, 'Maintenance setting updated successfully');
});

export const updateFeatureFlag = asyncHandler(async (req, res) => {
  const item = await DeveloperService.updateFeatureFlag(req.body, req.user);
  return sendSuccess(res, 200, item, 'Feature flag updated successfully');
});

export const getAuditLogs = asyncHandler(async (req, res) => {
  const items = await DeveloperService.listAuditLogs(Number(req.query.limit) || 100);
  return sendSuccess(res, 200, { items }, 'Audit logs fetched successfully');
});

export const getSystemHealth = asyncHandler(async (req, res) => {
  const health = await DeveloperService.getSystemHealth();
  return sendSuccess(res, 200, health, 'System health fetched successfully');
});

export const createBroadcast = asyncHandler(async (req, res) => {
  const item = await DeveloperService.createBroadcast(req.body, req.user);
  return sendSuccess(res, 201, item, 'Broadcast created successfully');
});
