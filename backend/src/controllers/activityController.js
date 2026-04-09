import { ActivityService } from '../services/activityService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

export const getStaffList = asyncHandler(async (req, res) => {
  const restaurantId = req.headers['x-restaurant-id'] || req.body?.restaurantId;
  const currentUserRole = req.user?.role;

  logger.info(`📊 Activity: Fetching staff list for restaurant ${restaurantId}, role: ${currentUserRole}`);

  if (!restaurantId) {
    logger.warn(`⚠️ Missing restaurant ID in staff list fetch`);
    return sendError(res, 400, 'Restaurant ID required');
  }

  if (!currentUserRole) {
    logger.warn(`⚠️ User role required but not found`);
    return sendError(res, 403, 'User role required');
  }

  const result = await ActivityService.getStaffList(restaurantId, currentUserRole);
  logger.info(`✅ Staff list retrieved: ${result.staff?.length || 0} staff members`);
  return sendSuccess(res, 200, result, 'Staff list fetched successfully');
});

export const getUserActivity = asyncHandler(async (req, res) => {
  const restaurantId = req.headers['x-restaurant-id'] || req.body?.restaurantId;
  const { userId } = req.params;
  const currentUserRole = req.user?.role;

  logger.info(`🔍 Activity: Fetching logs for user ${userId}, restaurant ${restaurantId}, role ${currentUserRole}`);

  if (!restaurantId) {
    logger.warn(`⚠️ Missing restaurant ID in activity fetch`);
    return sendError(res, 400, 'Restaurant ID required');
  }

  if (!userId) {
    logger.warn(`⚠️ Missing user ID in activity fetch`);
    return sendError(res, 400, 'User ID required');
  }

  // Authorization: Managers can only see waiters/staff, Owners can see all
  if (currentUserRole === 'manager') {
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('id, role, restaurant_id')
      .eq('id', userId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !targetUser) {
      logger.warn(`❌ User ${userId} not found in restaurant ${restaurantId}`);
      return sendError(res, 403, 'User not found in your restaurant');
    }

    const targetUserRole = targetUser.role;
    if (!['staff', 'kitchen_staff', 'waiter'].includes(targetUserRole)) {
      logger.warn(`❌ Manager cannot view ${targetUserRole} activity`);
      return sendError(res, 403, 'Managers can only view staff/waiter activity');
    }
  } else if (currentUserRole !== 'owner') {
    logger.warn(`❌ Unauthorized role ${currentUserRole} attempted activity access`);
    return sendError(res, 403, 'You do not have permission to view activity');
  }

  const result = await ActivityService.getActivityLogs(restaurantId, userId);
  
  if (result.logs.length === 0) {
    logger.warn(`⚠️ No activities found for user ${userId} in restaurant ${restaurantId}`);
  }
  
  return sendSuccess(res, 200, result, 'Activity logs fetched successfully');
});

export const getUserInfo = asyncHandler(async (req, res) => {
  const restaurantId = req.headers['x-restaurant-id'] || req.body?.restaurantId;
  const { userId } = req.params;
  const currentUserRole = req.user?.role;

  logger.info(`👤 Activity: Fetching user info for ${userId}, restaurant ${restaurantId}`);

  if (!restaurantId) {
    logger.warn(`⚠️ Missing restaurant ID in user info fetch`);
    return sendError(res, 400, 'Restaurant ID required');
  }

  if (!userId) {
    logger.warn(`⚠️ Missing user ID in user info fetch`);
    return sendError(res, 400, 'User ID required');
  }

  if (currentUserRole === 'manager') {
    const { data: targetUser, error } = await supabase
      .from('users')
      .select('id, role, restaurant_id')
      .eq('id', userId)
      .eq('restaurant_id', restaurantId)
      .single();

    if (error || !targetUser) {
      logger.warn(`❌ User ${userId} not found in restaurant ${restaurantId}`);
      return sendError(res, 403, 'User not found in your restaurant');
    }

    const targetUserRole = targetUser.role;
    if (!['staff', 'kitchen_staff', 'waiter'].includes(targetUserRole)) {
      logger.warn(`❌ Manager cannot view ${targetUserRole} info`);
      return sendError(res, 403, 'Managers can only view staff/waiter information');
    }
  } else if (currentUserRole !== 'owner') {
    logger.warn(`❌ Unauthorized role ${currentUserRole} attempted user info access`);
    return sendError(res, 403, 'You do not have permission to view user information');
  }

  const result = await ActivityService.getUserInfo(restaurantId, userId);
  logger.info(`✅ User info retrieved: ${result.name}`);
  return sendSuccess(res, 200, result, 'User information fetched successfully');
});
