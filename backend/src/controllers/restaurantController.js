import logger from '../utils/logger.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import RestaurantService from '../services/restaurantService.js';
import PasswordResetService from '../services/passwordResetService.js';

export const getProfile = asyncHandler(async (req, res) => {
  logger.info(`API HIT: GET /profile - Restaurant: ${req.restaurantId}`);
  const restaurant = await RestaurantService.getRestaurantProfile(req.restaurantId);

  return sendSuccess(res, 200, restaurant, 'Profile fetched successfully');
});

export const getBroadcastNotifications = asyncHandler(async (req, res) => {
  const items = await RestaurantService.getBroadcastNotifications(req.restaurantId, {
    limit: parseInt(req.query.limit, 10) || 20,
  });

  return sendSuccess(res, 200, { items }, 'Broadcast notifications fetched successfully');
});

export const updateProfile = asyncHandler(async (req, res) => {
  const restaurant = await RestaurantService.updateRestaurantProfile(req.restaurantId, req.body);

  return sendSuccess(res, 200, restaurant, 'Profile updated successfully');
});

export const updateSettings = asyncHandler(async (req, res) => {
  const restaurant = await RestaurantService.updateRestaurantSettings(req.restaurantId, req.body);

  return sendSuccess(res, 200, restaurant, 'Settings updated successfully');
});

export const updateInvoiceSettings = asyncHandler(async (req, res) => {
  const invoiceSettings = await RestaurantService.updateInvoiceSettings(req.restaurantId, req.body);

  return sendSuccess(res, 200, invoiceSettings, 'Invoice settings updated successfully');
});

export const createStaff = asyncHandler(async (req, res) => {
  try {
    const staff = await RestaurantService.createStaffUser(req.restaurantId, req.body);
    return sendSuccess(res, 201, staff, 'Staff user created successfully');
  } catch (error) {
    if (error.message && error.message.includes('already assigned')) {
      return sendError(res, 409, error.message);
    }
    throw error;
  }
});

export const getStaffUsers = asyncHandler(async (req, res) => {
  logger.info(`API HIT: GET /staff - Restaurant: ${req.restaurantId}, Limit: ${req.query.limit || 50}`);
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

export const updateStaff = asyncHandler(async (req, res) => {
  try {
    const { staffId } = req.params;
    const normalizedRole = String(req.user?.role || '').toLowerCase();

    if (normalizedRole !== 'owner' && normalizedRole !== 'manager') {
      return sendError(res, 403, 'Insufficient permissions for this action');
    }

    if (normalizedRole === 'manager') {
      const providedFields = Object.entries(req.body || {})
        .filter(([, value]) => value !== undefined)
        .map(([key]) => key);
      const onlyAssignmentUpdate =
        providedFields.length > 0 && providedFields.every((field) => field === 'assignedTables');

      if (!onlyAssignmentUpdate) {
        return sendError(res, 403, 'Managers can only update waiter table assignments');
      }

      const targetUser = await RestaurantService.getStaffUserById(req.restaurantId, staffId);
      if (targetUser?.role !== 'staff') {
        return sendError(res, 403, 'Managers can only assign tables to POS staff');
      }
    }

    const user = await RestaurantService.updateStaffUser(req.restaurantId, staffId, req.body);

    return sendSuccess(res, 200, user, 'Staff user updated successfully');
  } catch (error) {
    if (error.message && error.message.includes('already assigned')) {
      return sendError(res, 409, error.message);
    }
    throw error;
  }
});

export const resetStaffPassword = asyncHandler(async (req, res) => {
  const { staffId } = req.params;
  const { newPassword } = req.body;

  if (!newPassword || typeof newPassword !== 'string' || newPassword.trim().length < 6) {
    return sendError(res, 400, 'Password must be at least 6 characters long');
  }

  // Get the target user to check their role
  const targetUser = await RestaurantService.getStaffUserById(req.restaurantId, staffId);
  if (!targetUser) {
    return sendError(res, 404, 'User not found');
  }

  // Role-based authorization
  const currentUserRole = req.user?.role;
  
  // Owner can reset anyone except other owners
  if (currentUserRole === 'owner') {
    if (targetUser.role === 'owner') {
      return sendError(res, 403, 'Cannot reset password for other owners');
    }
  }
  // Manager can only reset staff, kitchen_staff, and waiters
  else if (currentUserRole === 'manager') {
    const allowedRoles = ['staff', 'kitchen_staff', 'waiter'];
    if (!allowedRoles.includes(targetUser.role)) {
      return sendError(res, 403, `You don't have permission to reset password for ${targetUser.role} users`);
    }
  }
  // Other roles cannot reset passwords
  else {
    return sendError(res, 403, 'You do not have permission to reset staff passwords');
  }

  const user = await RestaurantService.resetStaffPassword(req.restaurantId, staffId, newPassword.trim());

  return sendSuccess(res, 200, user, 'Staff password reset successfully');
});

export const updateSubscription = asyncHandler(async (req, res) => {
  const restaurant = await RestaurantService.updateSubscription(req.user.restaurantId, req.body);

  return sendSuccess(res, 200, restaurant, 'Subscription updated successfully');
});
