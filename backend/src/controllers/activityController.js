import { ActivityService } from '../services/activityService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

export const getStaffList = asyncHandler(async (req, res) => {
  const restaurantId = req.headers['x-restaurant-id'] || req.body?.restaurantId;
  const currentUserRole = req.user?.role;

  logger.info(`Activity: Get staff list for restaurant ${restaurantId}, role: ${currentUserRole}`);

  if (!currentUserRole) {
    return sendError(res, 403, 'User role required');
  }

  const result = await ActivityService.getStaffList(restaurantId, currentUserRole);
  return sendSuccess(res, 200, result, 'Staff list fetched successfully');
});

export const getUserActivity = asyncHandler(async (req, res) => {
  const restaurantId = req.headers['x-restaurant-id'] || req.body?.restaurantId;
  const { userId } = req.params;
  const currentUserRole = req.user?.role;

  logger.info(`Activity: Get logs for user ${userId}`);

  // Authorization: Managers can only see waiters/staff, Owners can see all
  if (currentUserRole === 'manager') {
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !targetUser) {
      logger.debug(`User ${userId} not found or not in restaurant ${restaurantId}`);
      return sendError(res, 403, 'User not found in your restaurant');
    }

    const targetUserRole = targetUser.role;
    if (!['staff', 'kitchen_staff', 'waiter'].includes(targetUserRole)) {
      logger.debug(`Manager cannot view ${targetUserRole} activity`);
      return sendError(res, 403, 'Managers can only view staff/waiter activity');
    }
  } else if (currentUserRole !== 'owner') {
    return sendError(res, 403, 'You do not have permission to view activity');
  }

  const result = await ActivityService.getActivityLogs(restaurantId, userId);
  return sendSuccess(res, 200, result, 'Activity logs fetched successfully');
});

export const getUserInfo = asyncHandler(async (req, res) => {
  const restaurantId = req.headers['x-restaurant-id'] || req.body?.restaurantId;
  const { userId } = req.params;
  const currentUserRole = req.user?.role;

  logger.info(`Activity: Get user info for ${userId}`);

  if (currentUserRole === 'manager') {
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !targetUser) {
      logger.debug(`User ${userId} not found in restaurant ${restaurantId}`);
      return sendError(res, 403, 'User not found in your restaurant');
    }

    const targetUserRole = targetUser.role;
    if (!['staff', 'kitchen_staff', 'waiter'].includes(targetUserRole)) {
      logger.debug(`Manager cannot view ${targetUserRole} info`);
      return sendError(res, 403, 'Managers can only view staff/waiter information');
    }
  } else if (currentUserRole !== 'owner') {
    return sendError(res, 403, 'You do not have permission');
  }

  const result = await ActivityService.getUserInfo(restaurantId, userId);
  return sendSuccess(res, 200, result, 'User info fetched successfully');
});
