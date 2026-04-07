import supabase from '../config/supabase.js';
import logger from '../utils/logger.js';
import AuthService from './authService.js';
import { clearSystemAccessCache } from '../middleware/systemAccess.js';

const FEATURE_KEYS = ['qr_ordering', 'inventory', 'analytics', 'notifications'];

function todayRange() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

function parseSettingValue(settingRow, fallback = {}) {
  return typeof settingRow?.setting_value === 'object' && settingRow.setting_value
    ? settingRow.setting_value
    : fallback;
}

export class DeveloperService {
  static async logAudit({ actor, action, targetType, targetId = null, restaurantId = null, metadata = {} }) {
    try {
      await supabase.from('audit_logs').insert([{
        actor_user_id: actor?.userId || null,
        actor_email: actor?.email || '',
        actor_role: actor?.role || '',
        action,
        target_type: targetType,
        target_id: targetId,
        restaurant_id: restaurantId,
        metadata,
        created_at: new Date().toISOString(),
      }]);
    } catch (error) {
      logger.error('Developer audit log error:', error);
    }
  }

  static async getDashboard() {
    const { start, end } = todayRange();

    const [restaurantsCountResult, activeUsersResult, ordersTodayResult, maintenanceSettingResult] = await Promise.all([
      supabase.from('restaurants').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
      supabase.from('orders').select('id', { count: 'exact', head: true }).gte('created_at', start).lt('created_at', end),
      supabase
        .from('system_settings')
        .select('setting_value')
        .is('restaurant_id', null)
        .eq('setting_key', 'global_maintenance')
        .maybeSingle(),
    ]);

    if (restaurantsCountResult.error) throw restaurantsCountResult.error;
    if (activeUsersResult.error) throw activeUsersResult.error;
    if (ordersTodayResult.error) throw ordersTodayResult.error;
    if (maintenanceSettingResult.error && maintenanceSettingResult.error.code !== 'PGRST116') {
      throw maintenanceSettingResult.error;
    }

    const maintenanceValue = parseSettingValue(maintenanceSettingResult.data, {});

    return {
      totalRestaurants: restaurantsCountResult.count || 0,
      activeUsers: activeUsersResult.count || 0,
      totalOrdersToday: ordersTodayResult.count || 0,
      systemStatus: maintenanceValue.enabled ? 'maintenance' : 'operational',
    };
  }

  static async listRestaurants() {
    const [{ data: restaurants, error }, { data: maintenanceRows, error: maintenanceError }] = await Promise.all([
      supabase
        .from('restaurants')
        .select('id, name, business_name, email, city, status, access_enabled, subscription_status, created_at, updated_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('system_settings')
        .select('restaurant_id, setting_value')
        .eq('setting_key', 'restaurant_maintenance'),
    ]);

    if (error) throw error;
    if (maintenanceError && maintenanceError.code !== 'PGRST116') throw maintenanceError;

    const maintenanceByRestaurant = new Map(
      (maintenanceRows || []).map((row) => [
        row.restaurant_id,
        Boolean(parseSettingValue(row, {}).enabled),
      ])
    );

    return (restaurants || []).map((restaurant) => ({
      id: restaurant.id,
      name: restaurant.name || restaurant.business_name || 'Unnamed Restaurant',
      email: restaurant.email,
      city: restaurant.city || '',
      status: restaurant.status || 'active',
      accessEnabled: restaurant.access_enabled !== false,
      subscriptionStatus: restaurant.subscription_status || 'active',
      maintenanceEnabled: maintenanceByRestaurant.get(restaurant.id) || false,
      createdAt: restaurant.created_at,
      updatedAt: restaurant.updated_at,
    }));
  }

  static async updateRestaurantAccess(restaurantId, payload, actor) {
    const updateData = {
      updated_at: new Date().toISOString(),
    };

    if (payload.status !== undefined) {
      updateData.status = payload.status;
    }

    if (payload.accessEnabled !== undefined) {
      updateData.access_enabled = payload.accessEnabled;
    }

    const { data, error } = await supabase
      .from('restaurants')
      .update(updateData)
      .eq('id', restaurantId)
      .select('id, name, business_name, email, city, status, access_enabled, subscription_status, created_at, updated_at')
      .single();

    if (error || !data) {
      throw error || new Error('Restaurant not found');
    }

    clearSystemAccessCache(restaurantId);
    await this.logAudit({
      actor,
      action: 'developer.restaurant_access_updated',
      targetType: 'restaurant',
      targetId: restaurantId,
      restaurantId,
      metadata: payload,
    });

    return {
      id: data.id,
      name: data.name || data.business_name || 'Unnamed Restaurant',
      email: data.email,
      city: data.city || '',
      status: data.status || 'active',
      accessEnabled: data.access_enabled !== false,
      subscriptionStatus: data.subscription_status || 'active',
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  static async listUsers(filters = {}) {
    let query = supabase
      .from('users')
      .select(`
        id,
        restaurant_id,
        name,
        email,
        phone,
        role,
        status,
        created_at,
        updated_at,
        restaurants:restaurant_id (
          id,
          name,
          business_name
        )
      `)
      .order('created_at', { ascending: false });

    if (filters.role) {
      query = query.eq('role', filters.role);
    }

    if (filters.status) {
      query = query.eq('status', filters.status);
    }

    const { data, error } = await query.limit(filters.limit || 200);
    if (error) throw error;

    const search = String(filters.search || '').trim().toLowerCase();
    return (data || [])
      .filter((user) => {
        if (!search) return true;
        return (
          String(user.name || '').toLowerCase().includes(search) ||
          String(user.email || '').toLowerCase().includes(search)
        );
      })
      .map((user) => ({
        id: user.id,
        restaurantId: user.restaurant_id,
        restaurantName: user.restaurants?.name || user.restaurants?.business_name || 'Unknown Restaurant',
        name: user.name,
        email: user.email,
        phone: user.phone || '',
        role: user.role,
        status: user.status || 'active',
        createdAt: user.created_at,
        updatedAt: user.updated_at,
      }));
  }

  static async updateUserStatus(userId, status, actor) {
    const { data, error } = await supabase
      .from('users')
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, restaurant_id, name, email, role, status')
      .single();

    if (error || !data) {
      throw error || new Error('User not found');
    }

    await this.logAudit({
      actor,
      action: 'developer.user_status_updated',
      targetType: 'user',
      targetId: userId,
      restaurantId: data.restaurant_id,
      metadata: { status },
    });

    return {
      id: data.id,
      restaurantId: data.restaurant_id,
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status,
    };
  }

  static async resetUserPassword(userId, newPassword, actor) {
    const passwordHash = await AuthService.hashPassword(newPassword);
    const { data, error } = await supabase
      .from('users')
      .update({
        password_hash: passwordHash,
        updated_at: new Date().toISOString(),
      })
      .eq('id', userId)
      .select('id, restaurant_id, name, email, role')
      .single();

    if (error || !data) {
      throw error || new Error('User not found');
    }

    await this.logAudit({
      actor,
      action: 'developer.password_reset',
      targetType: 'user',
      targetId: userId,
      restaurantId: data.restaurant_id,
      metadata: { email: data.email, role: data.role },
    });

    return {
      id: data.id,
      email: data.email,
      name: data.name,
      role: data.role,
    };
  }

  static async upsertSystemSetting(settingKey, value, actor, restaurantId = null) {
    const basePayload = {
      restaurant_id: restaurantId,
      setting_key: settingKey,
      setting_value: value,
      updated_by: actor?.userId || null,
      updated_at: new Date().toISOString(),
    };

    let existingQuery = supabase
      .from('system_settings')
      .select('id')
      .eq('setting_key', settingKey);

    existingQuery = restaurantId
      ? existingQuery.eq('restaurant_id', restaurantId)
      : existingQuery.is('restaurant_id', null);

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;

    if (existing?.id) {
      const { error } = await supabase
        .from('system_settings')
        .update(basePayload)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('system_settings')
        .insert([basePayload]);

      if (error) throw error;
    }

    clearSystemAccessCache(restaurantId || null);
  }

  static async updateMaintenance({ enabled, message = '', restaurantId = null }, actor) {
    const settingKey = restaurantId ? 'restaurant_maintenance' : 'global_maintenance';
    await this.upsertSystemSetting(settingKey, { enabled, message }, actor, restaurantId);
    await this.logAudit({
      actor,
      action: restaurantId ? 'developer.restaurant_maintenance_updated' : 'developer.global_maintenance_updated',
      targetType: restaurantId ? 'restaurant' : 'system',
      targetId: restaurantId,
      restaurantId,
      metadata: { enabled, message },
    });

    return {
      enabled,
      message,
      restaurantId,
    };
  }

  static async listFeatureFlags() {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('id, restaurant_id, feature_key, enabled, updated_at')
      .order('feature_key', { ascending: true });

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    const rows = data || [];
    const knownRows = new Map(
      rows.map((row) => [`${row.restaurant_id || 'global'}:${row.feature_key}`, row])
    );
    const flags = [];

    FEATURE_KEYS.forEach((featureKey) => {
      const globalRow = knownRows.get(`global:${featureKey}`);
      flags.push({
        id: globalRow?.id || `global-${featureKey}`,
        featureKey,
        enabled: globalRow?.enabled !== false,
        restaurantId: null,
        updatedAt: globalRow?.updated_at || null,
      });
    });

    rows
      .filter((row) => row.restaurant_id)
      .forEach((row) => {
        flags.push({
          id: row.id,
          featureKey: row.feature_key,
          enabled: row.enabled !== false,
          restaurantId: row.restaurant_id,
          updatedAt: row.updated_at,
        });
      });

    return flags;
  }

  static async updateFeatureFlag({ featureKey, enabled, restaurantId = null }, actor) {
    let existingQuery = supabase
      .from('feature_flags')
      .select('id')
      .eq('feature_key', featureKey);

    existingQuery = restaurantId
      ? existingQuery.eq('restaurant_id', restaurantId)
      : existingQuery.is('restaurant_id', null);

    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;

    const payload = {
      restaurant_id: restaurantId,
      feature_key: featureKey,
      enabled,
      updated_by: actor?.userId || null,
      updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
      const { error } = await supabase
        .from('feature_flags')
        .update(payload)
        .eq('id', existing.id);

      if (error) throw error;
    } else {
      const { error } = await supabase
        .from('feature_flags')
        .insert([payload]);

      if (error) throw error;
    }

    await this.logAudit({
      actor,
      action: 'developer.feature_flag_updated',
      targetType: 'feature_flag',
      targetId: featureKey,
      restaurantId,
      metadata: { enabled },
    });

    return {
      featureKey,
      enabled,
      restaurantId,
    };
  }

  static async listAuditLogs(limit = 100) {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('id, actor_user_id, actor_email, actor_role, action, target_type, target_id, restaurant_id, metadata, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data || []).map((row) => ({
      id: row.id,
      actorEmail: row.actor_email || '',
      actorRole: row.actor_role || '',
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      restaurantId: row.restaurant_id,
      metadata: row.metadata || {},
      createdAt: row.created_at,
    }));
  }

  static async getSystemHealth() {
    const [databaseProbe, globalMaintenance, auditErrorCount] = await Promise.all([
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).limit(1),
      supabase
        .from('system_settings')
        .select('setting_value')
        .is('restaurant_id', null)
        .eq('setting_key', 'global_maintenance')
        .maybeSingle(),
      supabase
        .from('audit_logs')
        .select('id', { count: 'exact', head: true })
        .like('action', 'system.error%'),
    ]);

    if (databaseProbe.error) throw databaseProbe.error;
    if (globalMaintenance.error && globalMaintenance.error.code !== 'PGRST116') throw globalMaintenance.error;
    if (auditErrorCount.error && auditErrorCount.error.code !== 'PGRST116') throw auditErrorCount.error;

    const maintenanceValue = parseSettingValue(globalMaintenance.data, {});

    return {
      apiStatus: 'healthy',
      dbStatus: 'connected',
      errorCount: auditErrorCount.count || 0,
      maintenanceEnabled: Boolean(maintenanceValue.enabled),
    };
  }

  static async createBroadcast({ title, message }, actor) {
    const payload = {
      restaurant_id: null,
      title,
      message,
      audience: 'all_restaurants',
      created_by: actor?.userId || null,
      created_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('broadcast_notifications')
      .insert([payload])
      .select('id, title, message, audience, created_at')
      .single();

    if (error) throw error;

    await this.logAudit({
      actor,
      action: 'developer.broadcast_created',
      targetType: 'broadcast',
      targetId: data.id,
      metadata: { title },
    });

    return {
      id: data.id,
      title: data.title,
      message: data.message,
      audience: data.audience,
      createdAt: data.created_at,
    };
  }

  static async getSystemSettings() {
    const [settingsResult, flags, broadcastsResult] = await Promise.all([
      supabase
        .from('system_settings')
        .select('id, restaurant_id, setting_key, setting_value, updated_at')
        .in('setting_key', ['global_maintenance', 'restaurant_maintenance'])
        .order('updated_at', { ascending: false }),
      this.listFeatureFlags(),
      supabase
        .from('broadcast_notifications')
        .select('id, title, message, audience, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    if (settingsResult.error && settingsResult.error.code !== 'PGRST116') throw settingsResult.error;
    if (broadcastsResult.error && broadcastsResult.error.code !== 'PGRST116') throw broadcastsResult.error;

    const globalMaintenance = (settingsResult.data || []).find(
      (row) => !row.restaurant_id && row.setting_key === 'global_maintenance'
    );
    const restaurantMaintenance = (settingsResult.data || [])
      .filter((row) => row.restaurant_id && row.setting_key === 'restaurant_maintenance')
      .map((row) => ({
        restaurantId: row.restaurant_id,
        enabled: Boolean(parseSettingValue(row, {}).enabled),
        message: parseSettingValue(row, {}).message || '',
        updatedAt: row.updated_at,
      }));

    return {
      globalMaintenance: {
        enabled: Boolean(parseSettingValue(globalMaintenance, {}).enabled),
        message: parseSettingValue(globalMaintenance, {}).message || '',
      },
      restaurantMaintenance,
      featureFlags: flags,
      broadcasts: (broadcastsResult.data || []).map((row) => ({
        id: row.id,
        title: row.title,
        message: row.message,
        audience: row.audience,
        createdAt: row.created_at,
      })),
    };
  }
}

export default DeveloperService;
