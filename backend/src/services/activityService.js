import supabase from '../config/supabase.js';
import logger from '../utils/logger.js';

export class ActivityService {
  static async logActivity(restaurantId, userId, role, action, details = null) {
    try {
      const { error } = await supabase
        .from('activity_logs')
        .insert({
          restaurant_id: restaurantId,
          user_id: userId,
          role: role,
          action: action,
          details: details,
          created_at: new Date().toISOString(),
        });

      if (error) throw error;
      logger.info(`Activity logged: ${action} by ${userId}`);
    } catch (error) {
      logger.error('Failed to log activity:', error);
    }
  }

  static async getStaffList(restaurantId, currentUserRole) {
    try {
      let query = supabase
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
      // Get total orders
      const { count: totalOrders } = await supabase
        .from('activity_logs')
        .select('*', { count: 'exact', head: true })
        .eq('restaurant_id', restaurantId)
        .eq('user_id', userId)
        .eq('action', 'order_created');

      // Get last active time
      const { data: lastLog, error } = await supabase
        .from('activity_logs')
        .select('created_at')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return {
        totalOrders: totalOrders || 0,
        lastActive: lastLog?.created_at || null,
      };
    } catch (error) {
      logger.error('Get user stats error:', error);
      return { totalOrders: 0, lastActive: null };
    }
  }

  static async getActivityLogs(restaurantId, userId, limit = 50) {
    try {
      const { data: logs, error } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return { logs: logs || [] };
    } catch (error) {
      logger.error('Get activity logs error:', error);
      throw error;
    }
  }

  static async getUserInfo(restaurantId, userId) {
    try {
      const { data: user, error } = await supabase
        .from('users')
        .select('id, name, email, role, created_at')
        .eq('restaurant_id', restaurantId)
        .eq('id', userId)
        .single();

      if (error) throw error;

      const stats = await this.getUserStats(restaurantId, userId);

      return {
        ...user,
        totalOrders: stats.totalOrders,
        lastActive: stats.lastActive,
      };
    } catch (error) {
      logger.error('Get user info error:', error);
      throw error;
    }
  }
}
