import supabase from '../config/supabase.js';
import logger from '../utils/logger.js';

export class ActivityService {
  static async logActivity(restaurantId, userId, action, details = {}) {
    try {
      const { error } = await supabase.from('activity_logs').insert([
        {
          restaurant_id: restaurantId,
          user_id: userId,
          action,
          details: {
            timestamp: new Date().toISOString(),
            ...details,
          },
        },
      ]);

      if (error) {
        logger.error('Activity log error:', error);
        return false;
      }

      return true;
    } catch (err) {
      logger.error('Activity service error:', err);
      return false;
    }
  }

  static async getActivityLogs(restaurantId, userId = null, limit = 100) {
    try {
      let query = supabase
        .from('activity_logs')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data, error } = await query;

      if (error) {
        logger.error('Fetch activity logs error:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      logger.error('Activity service fetch error:', err);
      return [];
    }
  }

  static async getActivityLogsByAction(restaurantId, action, limit = 50) {
    try {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('action', action)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Fetch activity by action error:', error);
        return [];
      }

      return data || [];
    } catch (err) {
      logger.error('Activity service fetch by action error:', err);
      return [];
    }
  }
}
