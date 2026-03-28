import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import RestaurantService from '../services/restaurantService.js';

export const getProfile = asyncHandler(async (req, res) => {
  const restaurant = await RestaurantService.getRestaurantProfile(req.restaurantId);

  return sendSuccess(res, 200, restaurant, 'Profile fetched successfully');
});

export const updateProfile = asyncHandler(async (req, res) => {
  const restaurant = await RestaurantService.updateRestaurantProfile(req.restaurantId, req.body);

  return sendSuccess(res, 200, restaurant, 'Profile updated successfully');
});

export const updateSettings = asyncHandler(async (req, res) => {
  const restaurant = await RestaurantService.updateRestaurantSettings(req.restaurantId, req.body);

  return sendSuccess(res, 200, restaurant, 'Settings updated successfully');
});

export const createStaff = asyncHandler(async (req, res) => {
  const staff = await RestaurantService.createStaffUser(req.restaurantId, req.body);

  return sendSuccess(res, 201, staff, 'Staff user created successfully');
});

export const getStaffUsers = asyncHandler(async (req, res) => {
  const filters = {
    role: req.query.role,
    isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    limit: parseInt(req.query.limit) || 50,
    skip: parseInt(req.query.skip) || 0,
  };

  const result = await RestaurantService.getStaffUsers(req.restaurantId, filters);

  return sendSuccess(res, 200, result, 'Staff users fetched successfully');
});

export const deactivateStaff = asyncHandler(async (req, res) => {
  const { staffId } = req.params;

  const user = await RestaurantService.deactivateStaffUser(req.restaurantId, staffId);

  return sendSuccess(res, 200, user, 'Staff user deleted successfully');
});

export const updateSubscription = asyncHandler(async (req, res) => {
  const restaurant = await RestaurantService.updateSubscription(req.user.restaurantId, req.body);

  return sendSuccess(res, 200, restaurant, 'Subscription updated successfully');
});
