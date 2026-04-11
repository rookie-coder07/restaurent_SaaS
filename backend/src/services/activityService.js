import supabaseImport, { supabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';

// Dependency injection setup
let injectedSupabase = null;
const getSupabase = () => injectedSupabase || supabaseImport;

// Use admin client; in tests config returns a mock
const supabaseServiceClient = supabaseAdmin;

export class ActivityService {
  static setSupabase(supabaseInstance) {
    injectedSupabase = supabaseInstance;
  }

  static async logActivity(restaurantId, userId, role, action, details = null) {
    try {
      if (!restaurantId || !userId) {
        logger.warn(`Missing params for activity log: restaurantId=${restaurantId}, userId=${userId}, action=${action}`);
        return;
      }

      const { error } = await supabaseServiceClient
        .from('activity_logs')
        .insert([{
          restaurant_id: restaurantId,
          user_id: userId,
          role: role || '',
          action: action,
          details: details || {},
          created_at: new Date().toISOString(),
        }]);

      if (error) {
        logger.error(`Activity insert failed - Action: ${action}, User: ${userId}, Error:`, error);
      }
    } catch (error) {
      logger.error(`Exception logging activity [${action}]:`, error.message, error);
    }
  }

  static async getStaffList(restaurantId, currentUserRole) {
    try {
      let query = getSupabase()
        .from('users')
        .select('id, name, email, role, created_at, updated_at')
        .eq('restaurant_id', restaurantId);

      // Filter by role based on current user
      if (currentUserRole === 'owner') {
        query = query.in('role', ['manager', 'staff', 'kitchen_staff', 'waiter']);
      } else if (currentUserRole === 'manager') {
        query = query.in('role', ['staff', 'kitchen_staff', 'waiter']);
      } else {
        return { staff: [] };
      }

      const { data: users, error } = await query.order('name', { ascending: true });

      if (error) throw error;

      // Get activity stats for each user
      const staffWithStats = await Promise.all(
        (users || []).map(async (user) => {
          const stats = await this.getUserStats(restaurantId, user.id);
          return {
            ...user,
            totalOrders: stats.totalOrders,
            lastActive: stats.lastActive,
          };
        })
      );

      return { staff: staffWithStats };
    } catch (error) {
      logger.error('Get staff list error:', error);
      throw error;
    }
  }

  static async getUserStats(restaurantId, userId) {
    try {
      // Get total orders where action = 'order_created'
      const { count: totalOrders, error: countError } = await getSupabase()
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('user_id', userId)
        .eq('action', 'order_created');

      if (countError && countError.code !== 'PGRST116') {
        logger.warn(`Stats count error: ${countError.message}`);
      }

      // Get last active time
      const { data: lastLog, error: timeError } = await getSupabase()
        .from('activity_logs')
        .select('created_at')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (timeError && timeError.code !== 'PGRST116') {
        logger.warn(`Last active query error: ${timeError.message}`);
      }

      return {
        totalOrders: totalOrders || 0,
        lastActive: lastLog?.created_at || null,
      };
    } catch (error) {
      logger.warn(`Get user stats exception: ${error.message}`);
      return { totalOrders: 0, lastActive: null };
    }
  }

  static async getActivityLogs(restaurantId, userId, limit = 50) {
    try {
      logger.info(`Fetching activity logs: restaurant=${restaurantId}, user=${userId}`);
      
      const { data: logs, error } = await getSupabase()
        .from('activity_logs')
        .select('id, action, details, created_at, role')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return logs || [];
    } catch (error) {
      logger.error('Get activity logs error:', error);
      throw error;
    }
  }
}

export default ActivityService;
