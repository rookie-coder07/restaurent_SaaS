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
      const normalizedRole = String(currentUserRole || '').toLowerCase().trim();
      logger.info(`📊 getStaffList: restaurantId=${restaurantId}, currentUserRole='${currentUserRole}' (normalized='${normalizedRole}')`);

      // First, check how many total users exist for this restaurant
      const { data: allUsers, error: countError } = await getSupabase()
        .from('users')
        .select('id, role', { count: 'exact' })
        .eq('restaurant_id', restaurantId);

      if (!countError) {
        logger.info(`📋 Total users for restaurant ${restaurantId}: ${allUsers?.length || 0}`);
        if (allUsers && allUsers.length > 0) {
          const roleDistribution = {};
          allUsers.forEach(u => {
            roleDistribution[u.role] = (roleDistribution[u.role] || 0) + 1;
          });
          logger.info(`📊 Role distribution: ${JSON.stringify(roleDistribution)}`);
        }
      }

      let query = getSupabase()
        .from('users')
        .select('id, name, email, role, created_at, updated_at')
        .eq('restaurant_id', restaurantId);

      // Define allowed roles for staff viewing
      // Include common variations: manager, staff, waiter, kitchen_staff, pos_staff, cashier, etc.
      const allowedRoles = [
        'manager',
        'staff', 
        'kitchen_staff',
        'waiter',
        'pos_staff',
        'pos-staff',
        'cashier',
        'kitchen',
        'kitchen_operator',
        'delivery_partner'
      ];

      // Filter by role based on current user (normalize role for comparison)
      if (['owner', 'admin', 'developer'].includes(normalizedRole)) {
        logger.info(`✅ Admin role detected - filtering for staff roles: ${allowedRoles.join(', ')}`);
        query = query.in('role', allowedRoles);
      } else if (normalizedRole === 'manager') {
        logger.info(`✅ Manager detected - including staff, kitchen_staff, waiter, pos_staff`);
        query = query.in('role', ['staff', 'kitchen_staff', 'waiter', 'pos_staff', 'pos-staff', 'cashier']);
      } else {
        logger.warn(`❌ Role '${normalizedRole}' not allowed to view staff list (allowed: owner, admin, developer, manager)`);
        return { staff: [] };
      }

      const { data: users, error } = await query.order('name', { ascending: true });

      if (error) {
        logger.error(`❌ Database query error:`, error);
        throw error;
      }

      logger.info(`📋 Query returned ${users?.length || 0} users matching role filter for restaurant ${restaurantId}`);
      
      if (users && users.length > 0) {
        logger.info(`✅ Staff members found:`, users.map(u => ({ id: u.id, name: u.name, role: u.role })));
      }
      
      if (!users || users.length === 0) {
        logger.warn(`⚠️ No users found for restaurant ${restaurantId} with allowed roles`);
        logger.warn(`⚠️ Allowed roles were: ${allowedRoles.join(', ')}`);
        logger.warn(`⚠️ This usually means:`);
        logger.warn(`   - No staff members have been created yet, OR`);
        logger.warn(`   - All users have role=admin or role=owner (owners can't be in the staff list), OR`);
        logger.warn(`   - Users exist but have roles outside the filter list`);
        return { staff: [] };
      }

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

      logger.info(`✅ Returning ${staffWithStats.length} staff with stats`);
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
