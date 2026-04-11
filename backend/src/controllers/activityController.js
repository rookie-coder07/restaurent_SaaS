import { ActivityService } from '../services/activityService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';

export const getStaffList = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurantId || req.headers['x-restaurant-id'] || req.body?.restaurantId || req.user?.restaurantId;
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

  try {
    const result = await ActivityService.getStaffList(restaurantId, currentUserRole);
    logger.info(`✅ Staff list retrieved: ${result.staff?.length || 0} staff members`);
    return sendSuccess(res, 200, result, 'Staff list fetched successfully');
  } catch (error) {
    logger.error(`❌ Error fetching staff list:`, error.message);
    return sendError(res, 500, 'Failed to fetch staff list: ' + error.message);
  }
});

export const getUserActivity = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurantId || req.headers['x-restaurant-id'] || req.body?.restaurantId || req.user?.restaurantId;
  const { userId } = req.params;
  const currentUserRole = req.user?.role?.toLowerCase();
  const currentUserId = req.user?.userId || req.user?.id;

  logger.info(`🔍 Activity: Fetching logs for user ${userId}, restaurant ${restaurantId}, role ${currentUserRole}`);

  if (!restaurantId) {
    logger.warn(`⚠️ Missing restaurant ID in activity fetch`);
    return sendError(res, 400, 'Restaurant ID required');
  }

  if (!userId) {
    logger.warn(`⚠️ Missing user ID in activity fetch`);
    return sendError(res, 400, 'User ID required');
  }

  // Authorization: 
  // - Users can see their own activity
  // - Managers can see staff/waiter activity
  // - Owners can see all activity
  
  const isViewingSelf = currentUserId === userId;
  
  if (!isViewingSelf) {
    if (currentUserRole === 'manager') {
      try {
        // Use table syntax to avoid .single() errors
        const { data: users, error: queryError } = await supabase
          .from('users')
          .select('id, role, restaurant_id')
          .eq('id', userId)
          .eq('restaurant_id', restaurantId);

        if (queryError) {
          logger.error(`❌ Database query error: ${queryError.message}`);
          return sendError(res, 500, 'Failed to verify user permissions');
        }

        const targetUser = users?.[0];
        if (!targetUser) {
          logger.warn(`❌ User ${userId} not found in restaurant ${restaurantId}`);
          return sendError(res, 403, 'User not found in your restaurant');
        }

        const targetUserRole = targetUser.role;
        if (!['staff', 'kitchen_staff', 'waiter'].includes(targetUserRole)) {
          logger.warn(`❌ Manager cannot view ${targetUserRole} activity`);
          return sendError(res, 403, 'Managers can only view staff/waiter activity');
        }
      } catch (authError) {
        logger.error(`❌ Authorization check failed: ${authError.message}`);
        return sendError(res, 500, 'Authorization check failed');
      }
    } else if (currentUserRole !== 'owner' && currentUserRole !== 'admin' && currentUserRole !== 'developer') {
      logger.warn(`❌ Unauthorized role ${currentUserRole} attempted activity access for user ${userId}`);
      return sendError(res, 403, 'You do not have permission to view this activity');
    }
  }

  try {
    const result = await ActivityService.getActivityLogs(restaurantId, userId);
    
    if (!result || result.length === 0) {
      logger.info(`⚠️ No activities found for user ${userId} in restaurant ${restaurantId}`);
    }
    
    return sendSuccess(res, 200, { logs: result }, 'Activity logs fetched successfully');
  } catch (logsError) {
    logger.error(`❌ Failed to fetch activity logs: ${logsError.message}`);
    return sendError(res, 500, 'Failed to fetch activity logs');
  }
});

export const getUserInfo = asyncHandler(async (req, res) => {
  const restaurantId = req.restaurantId || req.headers['x-restaurant-id'] || req.body?.restaurantId || req.user?.restaurantId;
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
    try {
      const { data: users, error: queryError } = await supabase
        .from('users')
        .select('id, role, restaurant_id')
        .eq('id', userId)
        .eq('restaurant_id', restaurantId);

      if (queryError) {
        logger.error(`❌ Database query error: ${queryError.message}`);
        return sendError(res, 500, 'Failed to verify user permissions');
      }

      const targetUser = users?.[0];
      if (!targetUser) {
        logger.warn(`❌ User ${userId} not found in restaurant ${restaurantId}`);
        return sendError(res, 403, 'User not found in your restaurant');
      }

      const targetUserRole = targetUser.role;
      if (!['staff', 'kitchen_staff', 'waiter'].includes(targetUserRole)) {
        logger.warn(`❌ Manager cannot view ${targetUserRole} info`);
        return sendError(res, 403, 'Managers can only view staff/waiter information');
      }
    } catch (authError) {
      logger.error(`❌ Authorization check failed: ${authError.message}`);
      return sendError(res, 500, 'Authorization check failed');
    }
  } else if (currentUserRole !== 'owner') {
    logger.warn(`❌ Unauthorized role ${currentUserRole} attempted user info access`);
    return sendError(res, 403, 'You do not have permission to view user information');
  }

  const result = await ActivityService.getUserInfo(restaurantId, userId);
  logger.info(`✅ User info retrieved: ${result.name}`);
  return sendSuccess(res, 200, result, 'User information fetched successfully');
});
