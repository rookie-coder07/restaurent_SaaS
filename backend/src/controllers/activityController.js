import { ActivityService } from '../services/activityService.js';
import logger from '../utils/logger.js';

export const getActivityLogs = async (req, res) => {
  try {
    const { userId } = req.params;
    const { restaurantId } = req.user;

    console.log('[ACTIVITY_CONTROLLER] getActivityLogs called', {
      path: req.path,
      url: req.url,
      userId,
      restaurantId,
      userRole: req.user?.role,
      userEmail: req.user?.email,
    });

    if (!userId || !restaurantId) {
      console.log('[ACTIVITY_CONTROLLER] ❌ Missing parameters:', { userId, restaurantId });
      return res.status(400).json({
        success: false,
        message: 'Missing userId or restaurantId',
      });
    }

    const logs = await ActivityService.getActivityLogs(restaurantId, userId);

    console.log('[ACTIVITY_CONTROLLER] ✅ Logs retrieved:', { count: logs.length });
    return res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (err) {
    console.log('[ACTIVITY_CONTROLLER] ❌ Error:', err.message);
    logger.error('Get activity logs error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
    });
  }
};

export const getRestaurantActivityLogs = async (req, res) => {
  try {
    const { restaurantId } = req.user;
    const { limit = 100, action } = req.query;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing restaurantId',
      });
    }

    let logs;
    if (action) {
      logs = await ActivityService.getActivityLogsByAction(restaurantId, action, parseInt(limit));
    } else {
      logs = await ActivityService.getActivityLogs(restaurantId, null, parseInt(limit));
    }

    return res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (err) {
    logger.error('Get restaurant activity logs error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity logs',
    });
  }
};

export const getActivityStats = async (req, res) => {
  try {
    const { restaurantId } = req.user;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Missing restaurantId',
      });
    }

    const [orderLogs, loginLogs, allLogs] = await Promise.all([
      ActivityService.getActivityLogsByAction(restaurantId, 'order_created', 1000),
      ActivityService.getActivityLogsByAction(restaurantId, 'user_login', 1000),
      ActivityService.getActivityLogs(restaurantId, null, 1000),
    ]);

    const uniqueUsers = new Set(allLogs.map((log) => log.user_id)).size;
    const orderCount = orderLogs.length;
    const loginCount = loginLogs.length;

    return res.json({
      success: true,
      data: {
        uniqueUsers,
        orderCount,
        loginCount,
        totalActions: allLogs.length,
      },
    });
  } catch (err) {
    logger.error('Get activity stats error:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch activity stats',
    });
  }
};
