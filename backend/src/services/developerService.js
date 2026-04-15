import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import supabaseImport, { getSupabaseAdmin } from '../config/supabase.js';
import logger from '../utils/logger.js';
import { clearSystemAccessCache } from '../middleware/systemAccess.js';
import { clearFeatureFlagCache } from '../middleware/featureFlags.js';
import { metricsInstance } from '../middleware/monitoring.js';
import { revokeAllUserTokens } from '../utils/tokenManager.js';
import { broadcastRestaurantEvent } from '../utils/realtimeEvents.js';
import AuthService from './authService.js';

let injectedSupabase = null;
const getSupabase = () => injectedSupabase || supabaseImport;
const FEATURE_KEYS = ['loyalty', 'online_ordering', 'discounts', 'qr_ordering', 'inventory', 'analytics', 'notifications'];

const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const settingValue = (row, fallback = {}) => (
  typeof row?.setting_value === 'object' && row.setting_value ? row.setting_value : fallback
);

const startOfDay = (date = new Date()) => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

const startOfWeek = (date = new Date()) => {
  const next = startOfDay(date);
  const diff = next.getDay() === 0 ? 6 : next.getDay() - 1;
  next.setDate(next.getDate() - diff);
  return next;
};

const startOfMonth = (date = new Date()) => {
  const next = startOfDay(date);
  next.setDate(1);
  return next;
};

const toCsv = (rows = []) => {
  if (!rows.length) return '';
  const headers = Array.from(rows.reduce((set, row) => {
    Object.keys(row || {}).forEach((key) => set.add(key));
    return set;
  }, new Set()));
  const wrap = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((key) => wrap(typeof row?.[key] === 'object' ? JSON.stringify(row[key]) : row?.[key])).join(','))].join('\n');
};

const parseLogLine = (line) => {
  const trimmed = String(line || '').trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return { message: trimmed, level: trimmed.toLowerCase().includes('error') ? 'error' : 'info', timestamp: null };
  }
};

export class DeveloperService {
  static analyticsCache = { payload: null, expiresAt: 0 };

  static setSupabase(instance) {
    injectedSupabase = instance;
  }

  static roleLabel(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return normalized === 'owner' ? 'admin' : normalized || 'unknown';
  }

  static roleInput(role) {
    const normalized = String(role || '').trim().toLowerCase();
    return normalized === 'admin' ? 'owner' : normalized;
  }

  static ensureDeveloper(actor) {
    if (String(actor?.role || '').trim().toLowerCase() !== 'developer') {
      const error = new Error('Access denied');
      error.statusCode = 403;
      throw error;
    }
  }

  static generateTemporaryPassword() {
    return `RMX-${crypto.randomBytes(6).toString('base64url')}`;
  }

  static async logAudit({ actor, action, targetType, targetId = null, restaurantId = null, metadata = {} }) {
    try {
      await getSupabase().from('audit_logs').insert([{ actor_user_id: actor?.userId || null, actor_email: actor?.email || '', actor_role: actor?.role || '', action, target_type: targetType, target_id: targetId, restaurant_id: restaurantId, metadata, created_at: new Date().toISOString() }]);
    } catch (error) {
      logger.error('Developer audit log error:', error);
    }
  }

  static async getAnalyticsOverview({ force = false } = {}) {
    if (!force && this.analyticsCache.payload && this.analyticsCache.expiresAt > Date.now()) {
      return this.analyticsCache.payload;
    }

    const fromDate = new Date();
    fromDate.setDate(fromDate.getDate() - 90);

    const [ordersResult, restaurantsResult] = await Promise.all([
      getSupabase().from('orders').select('id, restaurant_id, total_amount, final_amount, status, created_at, is_deleted').gte('created_at', fromDate.toISOString()).order('created_at', { ascending: false }).limit(5000),
      getSupabase().from('restaurants').select('id, name, business_name'),
    ]);

    if (ordersResult.error && ordersResult.error.code !== 'PGRST116') throw ordersResult.error;
    if (restaurantsResult.error && restaurantsResult.error.code !== 'PGRST116') throw restaurantsResult.error;

    const restaurantMap = new Map((restaurantsResult.data || []).map((restaurant) => [restaurant.id, restaurant.name || restaurant.business_name || 'Unnamed Restaurant']));
    const today = startOfDay();
    const week = startOfWeek();
    const month = startOfMonth();
    const dailyMap = new Map();
    const hourlyMap = new Map();
    const restaurantStats = new Map();
    let ordersPerDay = 0;
    let ordersPerWeek = 0;
    let ordersPerMonth = 0;
    let totalRevenue = 0;

    (ordersResult.data || []).filter((order) => !order.is_deleted && ['ready', 'served', 'completed'].includes(String(order.status || '').toLowerCase())).forEach((order) => {
      const createdAt = new Date(order.created_at);
      const revenue = num(order.final_amount ?? order.total_amount);
      const dateKey = createdAt.toISOString().slice(0, 10);
      const hour = createdAt.getHours();
      totalRevenue += revenue;
      dailyMap.set(dateKey, { date: dateKey, orders: num(dailyMap.get(dateKey)?.orders) + 1, revenue: num(dailyMap.get(dateKey)?.revenue) + revenue });
      hourlyMap.set(hour, { hour, label: `${String(hour).padStart(2, '0')}:00`, orders: num(hourlyMap.get(hour)?.orders) + 1, revenue: num(hourlyMap.get(hour)?.revenue) + revenue });
      const current = restaurantStats.get(order.restaurant_id) || { restaurantId: order.restaurant_id, restaurantName: restaurantMap.get(order.restaurant_id) || 'Unknown Restaurant', revenue: 0, orders: 0, todayOrders: 0, weekOrders: 0, monthOrders: 0 };
      current.revenue += revenue;
      current.orders += 1;
      if (createdAt >= today) { current.todayOrders += 1; ordersPerDay += 1; }
      if (createdAt >= week) { current.weekOrders += 1; ordersPerWeek += 1; }
      if (createdAt >= month) { current.monthOrders += 1; ordersPerMonth += 1; }
      restaurantStats.set(order.restaurant_id, current);
    });

    const payload = {
      totalRevenue,
      ordersPerDay,
      ordersPerWeek,
      ordersPerMonth,
      dailySeries: Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
      peakHours: Array.from(hourlyMap.values()).sort((a, b) => a.hour - b.hour),
      revenuePerRestaurant: Array.from(restaurantStats.values()).sort((a, b) => b.revenue - a.revenue),
    };
    payload.topRestaurants = payload.revenuePerRestaurant.slice(0, 5);
    this.analyticsCache = { payload, expiresAt: Date.now() + 30000 };
    return payload;
  }

  static async getDashboard() {
    const [analytics, live, restaurants] = await Promise.all([this.getAnalyticsOverview(), this.getLiveMonitor(), this.listRestaurants({ limit: 5, offset: 0 })]);
    return { totalRestaurants: restaurants.total || restaurants.items.length, activeUsers: live.activeUsers, totalOrdersToday: analytics.ordersPerDay, systemStatus: live.errorRate > 10 ? 'degraded' : 'operational', totalRevenue: analytics.totalRevenue, topRestaurants: analytics.topRestaurants };
  }

  static async getControlCenterOverview() {
    const [analytics, liveMonitor, restaurants, systemHealth, security, errors] = await Promise.all([this.getAnalyticsOverview(), this.getLiveMonitor(), this.listRestaurants({ limit: 20, offset: 0 }), this.getSystemHealth(), this.getSecurityOverview(), this.getErrorTracking({ limit: 20 })]);
    return { analytics, liveMonitor, restaurants, systemHealth, security, errors };
  }

  static async getLiveMonitor() {
    const [ordersResult, usersResult] = await Promise.all([
      getSupabase().from('orders').select('id, restaurant_id, total_amount, final_amount, status, payment_status, order_type, created_at, updated_at, display_order_number, tables:table_id(table_number), restaurants:restaurant_id(name,business_name)').order('created_at', { ascending: false }).limit(20),
      getSupabase().from('users').select('id, updated_at').order('updated_at', { ascending: false }).limit(100),
    ]);
    if (ordersResult.error && ordersResult.error.code !== 'PGRST116') throw ordersResult.error;
    if (usersResult.error && usersResult.error.code !== 'PGRST116') throw usersResult.error;
    const metrics = metricsInstance.getMetrics();
    const activeCutoff = Date.now() - 15 * 60 * 1000;
    const activeUsers = (usersResult.data || []).filter((user) => new Date(user.updated_at || 0).getTime() >= activeCutoff).length;
    return {
      activeUsers,
      apiRequestRate: metrics.uptime > 0 ? Number(((metrics.totalRequests / metrics.uptime) * 60).toFixed(2)) : 0,
      responseTime: metrics.avgResponseTime || null,
      errorRate: metrics.errorRate || null,
      totalRequests: metrics.totalRequests || 0,
      liveOrders: (ordersResult.data || []).map((order) => ({ id: order.id, restaurantId: order.restaurant_id, restaurantName: order.restaurants?.name || order.restaurants?.business_name || 'Unknown Restaurant', displayOrderNumber: order.display_order_number || order.id, totalAmount: num(order.final_amount ?? order.total_amount), status: order.status || 'pending', paymentStatus: order.payment_status || 'pending', orderType: order.order_type || 'dine-in', tableNumber: order.tables?.table_number || null, createdAt: order.created_at, updatedAt: order.updated_at })),
      endpoints: Object.entries(metrics.endpoints || {}).map(([endpoint, value]) => ({ endpoint, count: value.count, avgDuration: value.avgDuration, errors: value.errors, lastCalled: value.lastCalled })).sort((a, b) => b.count - a.count).slice(0, 10),
    };
  }

  static async createDeveloperUser(developerData, actor) {
    const normalizedEmail = String(developerData.email || '').trim().toLowerCase();
    const { data: authData, error: authError } = await getSupabase().auth.admin.createUser({
      email: normalizedEmail,
      password: developerData.password,
      email_confirm: true,
      user_metadata: { name: developerData.name, role: 'developer' },
    });
    if (authError || !authData?.user?.id) throw authError || new Error('Failed to create developer user');
    const { data, error } = await getSupabase().from('users').insert([{
      id: authData.user.id,
      name: developerData.name,
      email: normalizedEmail,
      phone: developerData.phone || '',
      role: 'developer',
      status: 'active',
    }]).select('id, name, email, role, status').single();
    if (error) throw error;
    await AuthService.updateSupabaseUserMapping('users', { id: data.id }, authData.user.id);
    await this.logAudit({ actor, action: 'developer.user_created', targetType: 'user', targetId: data.id, metadata: { email: data.email } });
    return { id: data.id, name: data.name, email: data.email, role: this.roleLabel(data.role), status: data.status };
  }

  static async createRestaurant(restaurantData, actor) {
    this.ensureDeveloper(actor);

    const normalizedEmail = String(restaurantData.ownerEmail || '').trim().toLowerCase();
    const now = new Date().toISOString();
    const temporaryPassword = this.generateTemporaryPassword();

    const { data: existingRestaurant, error: restaurantLookupError } = await getSupabase()
      .from('restaurants')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (restaurantLookupError) throw restaurantLookupError;
    if (existingRestaurant) {
      throw new Error('Owner email already exists for another restaurant');
    }

    const { data: existingUser, error: userLookupError } = await getSupabase()
      .from('users')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (userLookupError) throw userLookupError;
    if (existingUser) {
      throw new Error('Owner email already exists for another user');
    }

    console.log('[DEVELOPER_SERVICE] Creating owner via Supabase admin API', {
      email: normalizedEmail,
      serviceRoleKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    });

    let authData, authError;
    try {
      const adminClient = getSupabaseAdmin();
      ({ data: authData, error: authError } = await adminClient.auth.admin.createUser({
        email: normalizedEmail,
        password: temporaryPassword,
        email_confirm: true,
        user_metadata: {
          name: restaurantData.ownerName,
          role: 'admin',
        },
      }));
    } catch (adminInitError) {
      console.error('[DEVELOPER_SERVICE] ❌ Admin client initialization error:', {
        message: adminInitError.message,
        serviceRoleKeyConfigured: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      throw new Error(
        `Failed to initialize admin client: ${adminInitError.message}. ` +
        `SUPABASE_SERVICE_ROLE_KEY may be missing or invalid. Check your Render environment variables.`
      );
    }

    if (authError) {
      console.error('[DEVELOPER_SERVICE] ❌ Auth creation error:', {
        message: authError.message,
        code: authError.code,
        status: authError.status,
      });
      
      if (authError.message?.includes('Bearer token') || authError.code === 'no_authorization') {
        throw new Error('Supabase service role key not configured - SUPABASE_SERVICE_ROLE_KEY is missing or invalid. Cannot create users.');
      }
      throw authError;
    }
    
    if (!authData?.user?.id) {
      throw new Error('Failed to create auth user - no user ID returned');
    }

    console.log('[DEVELOPER_SERVICE] ✅ Owner created successfully', { userId: authData.user.id });

    let createdRestaurant = null;

    try {
      const { data: restaurant, error: createRestaurantError } = await getSupabase()
        .from('restaurants')
        .insert([{
          id: authData.user.id,
          name: restaurantData.restaurantName,
          business_name: restaurantData.restaurantName,
          email: normalizedEmail,
          password_hash: await AuthService.hashPassword(temporaryPassword),
          password_hash_cleared: false,
          password_updated_at: new Date().toISOString(),
          phone: restaurantData.phone,
          address: restaurantData.address || '',
          gst_number: restaurantData.gstNumber || '',
          status: 'active',
          subscription_status: 'active',
          created_at: now,
          updated_at: now,
        }])
        .select('id, name, business_name, email, phone, address, gst_number, status, subscription_status, created_at, updated_at')
        .single();

      if (createRestaurantError || !restaurant) {
        throw createRestaurantError || new Error('Failed to create restaurant');
      }

      await AuthService.updateSupabaseUserMapping('restaurants', { id: restaurant.id }, authData.user.id);

      createdRestaurant = restaurant;

      await this.logAudit({
        actor,
        action: 'developer.restaurant_created',
        targetType: 'restaurant',
        targetId: restaurant.id,
        restaurantId: restaurant.id,
        metadata: {
          restaurantName: restaurant.name || restaurant.business_name,
          ownerEmail: normalizedEmail,
          ownerUserId: authData.user.id,
        },
      });

      this.analyticsCache.expiresAt = 0;

      return {
        success: true,
        restaurant: {
          id: restaurant.id,
          name: restaurant.name || restaurant.business_name,
          email: restaurant.email,
          phone: restaurant.phone || '',
          address: restaurant.address || '',
          gstNumber: restaurant.gst_number || '',
          status: restaurant.status || 'active',
          subscriptionStatus: restaurant.subscription_status || 'active',
          createdAt: restaurant.created_at,
        },
        ownerCredentials: {
          ownerName: restaurantData.ownerName,
          email: normalizedEmail,
          temporaryPassword,
          loginPath: '/admin/login',
          role: this.roleLabel('admin'),
        },
      };
    } catch (error) {
      if (createdRestaurant?.id) {
        await getSupabase().from('restaurants').delete().eq('id', createdRestaurant.id);
      }

      try {
        await getSupabaseAdmin().auth.admin.deleteUser(authData.user.id);
      } catch (cleanupError) {
        logger.warn('Developer restaurant creation cleanup warning', {
          authUserId: authData.user.id,
          error: cleanupError?.message,
        });
      }

      throw error;
    }
  }

  static async listRestaurants({ limit = 20, offset = 0 } = {}) {
    const [restaurantsResult, maintenanceResult, usersResult, analytics] = await Promise.all([
      getSupabase().from('restaurants').select('id, name, business_name, email, city, status, access_enabled, subscription_status, created_at, updated_at', { count: 'exact' }).order('created_at', { ascending: false }).range(offset, offset + limit - 1),
      getSupabase().from('system_settings').select('restaurant_id, setting_value').eq('setting_key', 'restaurant_maintenance'),
      getSupabase().from('users').select('id, restaurant_id, status'),
      this.getAnalyticsOverview(),
    ]);
    if (restaurantsResult.error && restaurantsResult.error.code !== 'PGRST116') throw restaurantsResult.error;
    if (maintenanceResult.error && maintenanceResult.error.code !== 'PGRST116') throw maintenanceResult.error;
    if (usersResult.error && usersResult.error.code !== 'PGRST116') throw usersResult.error;
    const maintenanceByRestaurant = new Map((maintenanceResult.data || []).map((row) => [row.restaurant_id, Boolean(settingValue(row, {}).enabled)]));
    const performanceMap = new Map((analytics.revenuePerRestaurant || []).map((entry) => [entry.restaurantId, entry]));
    const userStats = new Map();
    (usersResult.data || []).forEach((user) => {
      const current = userStats.get(user.restaurant_id) || { totalUsers: 0, activeUsers: 0 };
      current.totalUsers += 1;
      if (String(user.status || '').toLowerCase() === 'active') current.activeUsers += 1;
      userStats.set(user.restaurant_id, current);
    });
    return { items: (restaurantsResult.data || []).map((restaurant) => ({ id: restaurant.id, name: restaurant.name || restaurant.business_name || 'Unnamed Restaurant', email: restaurant.email || '', city: restaurant.city || '', status: restaurant.status || 'active', accessEnabled: restaurant.access_enabled !== false, subscriptionStatus: restaurant.subscription_status || 'active', maintenanceEnabled: maintenanceByRestaurant.get(restaurant.id) || false, totalUsers: userStats.get(restaurant.id)?.totalUsers || 0, activeUsers: userStats.get(restaurant.id)?.activeUsers || 0, revenue: performanceMap.get(restaurant.id)?.revenue || null, orderCount: performanceMap.get(restaurant.id)?.orders || null, ordersToday: performanceMap.get(restaurant.id)?.todayOrders || null, ordersThisWeek: performanceMap.get(restaurant.id)?.weekOrders || null, ordersThisMonth: performanceMap.get(restaurant.id)?.monthOrders || null, createdAt: restaurant.created_at, updatedAt: restaurant.updated_at })), total: restaurantsResult.count || 0, limit, offset };
  }
  static async updateRestaurantAccess(restaurantId, payload, actor) {
    const updateData = { updated_at: new Date().toISOString() };
    if (payload.status !== undefined) updateData.status = payload.status;
    if (payload.accessEnabled !== undefined) updateData.access_enabled = payload.accessEnabled;
    const { data, error } = await getSupabase().from('restaurants').update(updateData).eq('id', restaurantId).select('id, name, business_name, email, city, status, access_enabled, subscription_status, created_at, updated_at').single();
    if (error || !data) throw error || new Error('Restaurant not found');
    clearSystemAccessCache(restaurantId);
    this.analyticsCache.expiresAt = 0;
    await this.logAudit({ actor, action: 'developer.restaurant_access_updated', targetType: 'restaurant', targetId: restaurantId, restaurantId, metadata: payload });
    return { id: data.id, name: data.name || data.business_name || 'Unnamed Restaurant', email: data.email || '', city: data.city || '', status: data.status || 'active', accessEnabled: data.access_enabled !== false, subscriptionStatus: data.subscription_status || 'active', createdAt: data.created_at, updatedAt: data.updated_at };
  }

  static async forceLogoutRestaurantUsers(restaurantId, actor) {
    const { data, error } = await getSupabase().from('users').select('id').eq('restaurant_id', restaurantId);
    if (error && error.code !== 'PGRST116') throw error;
    for (const user of data || []) await revokeAllUserTokens(user.id);
    await this.logAudit({ actor, action: 'developer.restaurant_force_logout', targetType: 'restaurant', targetId: restaurantId, restaurantId, metadata: { revokedUsers: (data || []).length } });
    return { restaurantId, revokedUsers: (data || []).length };
  }

  static async listUsers(filters = {}) {
    const limit = Math.min(num(filters.limit, 20), 20);
    const offset = Math.max(num(filters.offset, 0), 0);
    const search = String(filters.search || '').trim().toLowerCase();
    const isFilteringByAdmin = filters.role && String(filters.role || '').trim().toLowerCase() === 'admin';
    
    // Build users query
    let query = getSupabase().from('users').select(`id, restaurant_id, name, email, phone, role, status, created_at, updated_at, restaurants:restaurant_id ( id, name, business_name )`, { count: 'exact' }).order('created_at', { ascending: false });
    
    // Apply role filter
    if (filters.role) {
      const normalized = String(filters.role || '').trim().toLowerCase();
      const dbRole = normalized === 'admin' ? 'owner' : normalized;
      query = query.eq('role', dbRole);
    }
    
    if (filters.status) query = query.eq('status', filters.status);
    if (filters.restaurantId) query = query.eq('restaurant_id', filters.restaurantId);
    
    const { data, error } = await query;
    if (error && error.code !== 'PGRST116') throw error;
    
    let items = (data || [])
      .filter((user) => !search || String(user.name || '').toLowerCase().includes(search) || String(user.email || '').toLowerCase().includes(search))
      .map((user) => ({ id: user.id, restaurantId: user.restaurant_id, restaurantName: user.restaurants?.name || user.restaurants?.business_name || 'Unknown Restaurant', name: user.name || 'Unknown User', email: user.email || '', phone: user.phone || '', role: this.roleLabel(user.role), rawRole: user.role, status: user.status || 'active', createdAt: user.created_at, updatedAt: user.updated_at }));
    
    // If filtering by admin, also include restaurant owners from restaurants table
    if (isFilteringByAdmin) {
      const { data: restaurants } = await getSupabase()
        .from('restaurants')
        .select('id, name, business_name, email, status, created_at, updated_at');
      
      if (restaurants) {
        const owners = restaurants
          .filter((r) => !search || String(r.name || '').toLowerCase().includes(search) || String(r.business_name || '').toLowerCase().includes(search) || String(r.email || '').toLowerCase().includes(search))
          .map((r) => ({ id: r.id, restaurantId: r.id, restaurantName: r.name || r.business_name || 'Unknown', name: r.name || r.business_name || 'Unknown', email: r.email || '', phone: '', role: 'admin', rawRole: 'owner', status: r.status || 'active', createdAt: r.created_at, updatedAt: r.updated_at }));
        items = [...items, ...owners];
      }
    }
    
    // Sort and paginate
    items = items.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const total = items.length;
    items = items.slice(offset, offset + limit);
    
    return { items, total, limit, offset };
  }

  static async updateUserStatus(userId, status, actor) {
    const { data, error } = await getSupabase().from('users').update({ status, updated_at: new Date().toISOString() }).eq('id', userId).select('id, restaurant_id, name, email, role, status').single();
    if (error || !data) throw error || new Error('User not found');
    if (['inactive', 'disabled', 'banned'].includes(String(status).toLowerCase())) await revokeAllUserTokens(userId);
    await this.logAudit({ actor, action: 'developer.user_status_updated', targetType: 'user', targetId: userId, restaurantId: data.restaurant_id, metadata: { status } });
    return { id: data.id, restaurantId: data.restaurant_id, name: data.name, email: data.email, role: this.roleLabel(data.role), status: data.status };
  }

  static async updateUserRole(userId, role, actor) {
    const nextRole = this.roleInput(role);
    const { data, error } = await getSupabase().from('users').update({ role: nextRole, updated_at: new Date().toISOString() }).eq('id', userId).select('*').single();
    if (error || !data) throw error || new Error('User not found');
    try {
      await getSupabaseAdmin().auth.admin.updateUserById(AuthService.getMappedSupabaseUserId(data) || userId, { user_metadata: { role: nextRole } });
    } catch (syncError) {
      logger.warn('Role sync warning', { userId, error: syncError?.message });
    }
    await this.logAudit({ actor, action: 'developer.user_role_updated', targetType: 'user', targetId: userId, restaurantId: data.restaurant_id, metadata: { role: nextRole } });
    return { id: data.id, restaurantId: data.restaurant_id, name: data.name, email: data.email, role: this.roleLabel(data.role), status: data.status };
  }

  static async resetUserPassword(userId, newPassword, actor) {
    try {
      // Try to find user in users table first
      const { data: userAccount, error: userError } = await getSupabase()
        .from('users')
        .select('id, email, name, role, restaurant_id')
        .eq('id', userId)
        .limit(1);

      let account = null;
      if (!userError && userAccount && userAccount.length > 0) {
        account = userAccount[0];
      }

      // If not found in users table, try restaurants table (for restaurant owners)
      if (!account) {
        const { data: restaurantAccount, error: restaurantError } = await getSupabase()
          .from('restaurants')
          .select('id, email, name')
          .eq('id', userId)
          .limit(1);

        if (!restaurantError && restaurantAccount && restaurantAccount.length > 0) {
          account = {
            ...restaurantAccount[0],
            role: 'owner',
            restaurant_id: restaurantAccount[0].id
          };
        }
      }

      if (!account) {
        throw new Error('User not found');
      }

      // Update password in Supabase Auth
      const { error: authError } = await getSupabaseAdmin().auth.admin.updateUserById(userId, { password: newPassword });
      if (authError) throw authError;

      // Sync password hash to database
      const passwordHash = await AuthService.hashPassword(newPassword);
      const { error: updateError } = await getSupabase()
        .from(account.restaurant_id === account.id ? 'restaurants' : 'users')
        .update(AuthService.buildPasswordUpdatePayload(passwordHash))
        .eq('id', userId);
      if (updateError) throw updateError;

      await revokeAllUserTokens(userId);
      await this.logAudit({ 
        actor, 
        action: 'developer.password_reset', 
        targetType: 'user', 
        targetId: userId, 
        restaurantId: account.restaurant_id, 
        metadata: { email: account.email, role: account.role } 
      });
      
      return { 
        id: account.id, 
        email: account.email, 
        name: account.name, 
        role: this.roleLabel(account.role) 
      };
    } catch (error) {
      throw error;
    }
  }

  static async forceLogoutUser(userId, actor) {
    await revokeAllUserTokens(userId);
    const { data, error } = await getSupabase().from('users').select('id, restaurant_id, name, email, role').eq('id', userId).single();
    if (error || !data) throw error || new Error('User not found');
    await this.logAudit({ actor, action: 'developer.force_logout', targetType: 'user', targetId: userId, restaurantId: data.restaurant_id, metadata: { email: data.email } });
    return { id: data.id, name: data.name, email: data.email, role: this.roleLabel(data.role), forcedLogout: true };
  }

  static async getUserLoginHistory(userId, limit = 20) {
    const [activityResult, tokenResult] = await Promise.all([
      getSupabase().from('activity_logs').select('id, action, details, created_at, role').eq('user_id', userId).in('action', ['user_login', 'login', 'login_failed']).order('created_at', { ascending: false }).limit(limit),
      getSupabase().from('refresh_tokens').select('id, created_at, last_used_at, ip_address, user_agent, is_revoked').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit),
    ]);
    if (activityResult.error && !['PGRST116', '42P01', 'PGRST204'].includes(activityResult.error.code)) throw activityResult.error;
    if (tokenResult.error && !['PGRST116', '42P01', 'PGRST204'].includes(tokenResult.error.code)) throw tokenResult.error;
    return [
      ...(activityResult.data || []).map((item) => ({ id: item.id, type: item.action, status: item.action === 'login_failed' ? 'failed' : 'success', createdAt: item.created_at, role: item.role || '', metadata: item.details || {} })),
      ...((tokenResult.data || []).map((item) => ({ id: `token-${item.id}`, type: 'session', status: item.is_revoked ? 'revoked' : 'active', createdAt: item.created_at, lastUsedAt: item.last_used_at, metadata: { ipAddress: item.ip_address || '', userAgent: item.user_agent || '' } }))),
    ].sort((a, b) => new Date(b.createdAt || b.lastUsedAt || 0) - new Date(a.createdAt || a.lastUsedAt || 0)).slice(0, limit);
  }

  static async upsertSystemSetting(settingKey, value, actor, restaurantId = null) {
    let existingQuery = getSupabase().from('system_settings').select('id').eq('setting_key', settingKey);
    existingQuery = restaurantId ? existingQuery.eq('restaurant_id', restaurantId) : existingQuery.is('restaurant_id', null);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    const payload = { restaurant_id: restaurantId, setting_key: settingKey, setting_value: value, updated_by: actor?.userId || null, updated_at: new Date().toISOString() };
    if (existing?.id) {
      const { error } = await getSupabase().from('system_settings').update(payload).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await getSupabase().from('system_settings').insert([payload]);
      if (error) throw error;
    }
    clearSystemAccessCache(restaurantId || null);
  }

  static async updateMaintenance({ enabled, message = '', restaurantId = null }, actor) {
    const settingKey = restaurantId ? 'restaurant_maintenance' : 'global_maintenance';
    await this.upsertSystemSetting(settingKey, { enabled, message }, actor, restaurantId);
    await this.logAudit({ actor, action: restaurantId ? 'developer.restaurant_maintenance_updated' : 'developer.global_maintenance_updated', targetType: restaurantId ? 'restaurant' : 'system', targetId: restaurantId, restaurantId, metadata: { enabled, message } });
    return { enabled, message, restaurantId };
  }

  static async listFeatureFlags() {
    const [flagsResult, restaurantsResult] = await Promise.all([
      getSupabase().from('feature_flags').select('id, restaurant_id, feature_key, enabled, updated_at').order('feature_key', { ascending: true }),
      getSupabase().from('restaurants').select('id, name, business_name'),
    ]);
    if (flagsResult.error && flagsResult.error.code !== 'PGRST116') throw flagsResult.error;
    const restaurantMap = new Map((restaurantsResult.data || []).map((restaurant) => [restaurant.id, restaurant.name || restaurant.business_name || 'Unknown Restaurant']));
    const rows = flagsResult.data || [];
    const known = new Map(rows.map((row) => [`${row.restaurant_id || 'global'}:${row.feature_key}`, row]));
    const items = FEATURE_KEYS.map((featureKey) => {
      const row = known.get(`global:${featureKey}`);
      return { id: row?.id || `global-${featureKey}`, featureKey, enabled: row?.enabled !== false, restaurantId: null, restaurantName: 'Global', updatedAt: row?.updated_at || null };
    });
    rows.filter((row) => row.restaurant_id).forEach((row) => items.push({ id: row.id, featureKey: row.feature_key, enabled: row.enabled !== false, restaurantId: row.restaurant_id, restaurantName: restaurantMap.get(row.restaurant_id) || 'Unknown Restaurant', updatedAt: row.updated_at }));
    return items;
  }

  static async updateFeatureFlag({ featureKey, enabled, restaurantId = null }, actor) {
    let existingQuery = getSupabase().from('feature_flags').select('id').eq('feature_key', featureKey);
    existingQuery = restaurantId ? existingQuery.eq('restaurant_id', restaurantId) : existingQuery.is('restaurant_id', null);
    const { data: existing, error: existingError } = await existingQuery.maybeSingle();
    if (existingError && existingError.code !== 'PGRST116') throw existingError;
    const payload = { restaurant_id: restaurantId, feature_key: featureKey, enabled, updated_by: actor?.userId || null, updated_at: new Date().toISOString() };
    if (existing?.id) {
      const { error } = await getSupabase().from('feature_flags').update(payload).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await getSupabase().from('feature_flags').insert([payload]);
      if (error) throw error;
    }
    clearFeatureFlagCache(featureKey, restaurantId);
    if (!restaurantId) clearFeatureFlagCache(featureKey);
    await this.logAudit({ actor, action: 'developer.feature_flag_updated', targetType: 'feature_flag', targetId: featureKey, restaurantId, metadata: { enabled } });
    return { featureKey, enabled, restaurantId };
  }
  static async getSystemSettings() {
    const [settingsResult, flags, broadcastsResult] = await Promise.all([
      getSupabase().from('system_settings').select('id, restaurant_id, setting_key, setting_value, updated_at').in('setting_key', ['global_maintenance', 'restaurant_maintenance', 'global_tax_config', 'invoice_settings', 'default_configs']).order('updated_at', { ascending: false }),
      this.listFeatureFlags(),
      getSupabase().from('broadcast_notifications').select('id, title, message, audience, created_at').order('created_at', { ascending: false }).limit(20),
    ]);
    if (settingsResult.error && settingsResult.error.code !== 'PGRST116') throw settingsResult.error;
    if (broadcastsResult.error && broadcastsResult.error.code !== 'PGRST116') throw broadcastsResult.error;
    const rows = settingsResult.data || [];
    const globalMaintenance = rows.find((row) => !row.restaurant_id && row.setting_key === 'global_maintenance');
    const globalTax = rows.find((row) => !row.restaurant_id && row.setting_key === 'global_tax_config');
    const invoiceSettings = rows.find((row) => !row.restaurant_id && row.setting_key === 'invoice_settings');
    const defaultConfigs = rows.find((row) => !row.restaurant_id && row.setting_key === 'default_configs');
    return {
      globalMaintenance: { enabled: Boolean(settingValue(globalMaintenance, {}).enabled), message: settingValue(globalMaintenance, {}).message || '' },
      globalTaxConfig: settingValue(globalTax, { taxRate: 0, serviceChargeRate: 0, taxLabel: 'GST' }),
      invoiceSettings: settingValue(invoiceSettings, { prefix: 'INV', footer: '', supportEmail: '' }),
      defaultConfigs: settingValue(defaultConfigs, { timezone: 'Asia/Kolkata', currency: 'INR', orderAutoRefreshSeconds: 10 }),
      restaurantMaintenance: rows.filter((row) => row.restaurant_id && row.setting_key === 'restaurant_maintenance').map((row) => ({ restaurantId: row.restaurant_id, enabled: Boolean(settingValue(row, {}).enabled), message: settingValue(row, {}).message || '', updatedAt: row.updated_at })),
      featureFlags: flags,
      broadcasts: (broadcastsResult.data || []).map((row) => ({ id: row.id, title: row.title, message: row.message, audience: row.audience, createdAt: row.created_at })),
    };
  }

  static async updateSystemSettings(payload, actor) {
    if (payload.globalTaxConfig) await this.upsertSystemSetting('global_tax_config', payload.globalTaxConfig, actor);
    if (payload.invoiceSettings) await this.upsertSystemSetting('invoice_settings', payload.invoiceSettings, actor);
    if (payload.defaultConfigs) await this.upsertSystemSetting('default_configs', payload.defaultConfigs, actor);
    await this.logAudit({ actor, action: 'developer.system_settings_updated', targetType: 'system', targetId: 'global', metadata: payload });
    return this.getSystemSettings();
  }

  static async listAuditLogs({ limit = 20, offset = 0 } = {}) {
    const [auditResult, activityResult] = await Promise.all([
      getSupabase().from('audit_logs').select('id, actor_email, actor_role, action, target_type, target_id, restaurant_id, metadata, created_at').order('created_at', { ascending: false }).range(offset, offset + limit - 1),
      getSupabase().from('activity_logs').select('id, restaurant_id, user_id, role, action, details, created_at').order('created_at', { ascending: false }).range(offset, offset + limit - 1),
    ]);
    if (auditResult.error && auditResult.error.code !== 'PGRST116') throw auditResult.error;
    if (activityResult.error && activityResult.error.code !== 'PGRST116') throw activityResult.error;
    const items = [
      ...(auditResult.data || []).map((row) => ({ id: `audit-${row.id}`, actorEmail: row.actor_email || 'system', actorRole: this.roleLabel(row.actor_role), action: row.action, targetType: row.target_type, targetId: row.target_id, restaurantId: row.restaurant_id, metadata: row.metadata || {}, createdAt: row.created_at, source: 'audit' })),
      ...(activityResult.data || []).map((row) => ({ id: `activity-${row.id}`, actorEmail: row.user_id || 'system', actorRole: this.roleLabel(row.role), action: row.action, targetType: 'activity', targetId: row.user_id, restaurantId: row.restaurant_id, metadata: row.details || {}, createdAt: row.created_at, source: 'activity' })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, limit);
    return { items, limit, offset };
  }

  static async readLogFiles(filePaths = []) {
    const results = await Promise.all(filePaths.map(async (filePath) => {
      try {
        const content = await fs.readFile(filePath, 'utf8');
        return content.split(/\r?\n/).map(parseLogLine).filter(Boolean).map((entry) => ({ ...entry, file: path.basename(filePath) }));
      } catch {
        return [];
      }
    }));
    return results.flat();
  }

  static async getSecurityOverview() {
    const logsDir = path.resolve(process.cwd(), 'logs');
    const entries = await this.readLogFiles([path.join(logsDir, 'app.log'), path.join(logsDir, 'error.log'), path.join(logsDir, 'api-errors.log')]);
    const failedLoginAttempts = entries.filter((entry) => String(entry.message || '').toLowerCase().includes('failed login attempt')).slice(-50).reverse();
    const suspiciousActivity = entries.filter((entry) => {
      const message = String(entry.message || '').toLowerCase();
      return message.includes('suspicious') || message.includes('sql injection') || message.includes('sensitive operation detected');
    }).slice(-50).reverse();
    const alerts = [];
    if (failedLoginAttempts.length >= 3) alerts.push({ severity: 'warning', message: `${failedLoginAttempts.length} failed login attempts detected.` });
    if (suspiciousActivity.length) alerts.push({ severity: 'critical', message: `${suspiciousActivity.length} suspicious activity events detected.` });
    return {
      failedLoginAttempts: failedLoginAttempts.map((entry, index) => ({ id: `failed-${index}`, message: entry.message || 'Failed login attempt', timestamp: entry.timestamp || null, file: entry.file })),
      suspiciousActivity: suspiciousActivity.map((entry, index) => ({ id: `alert-${index}`, message: entry.message || 'Suspicious activity', timestamp: entry.timestamp || null, file: entry.file })),
      alerts,
    };
  }

  static async getErrorTracking({ limit = 20 } = {}) {
    const logsDir = path.resolve(process.cwd(), 'logs');
    const entries = await this.readLogFiles([path.join(logsDir, 'api-errors.log'), path.join(logsDir, 'error.log'), path.join(logsDir, 'app.log')]);
    const grouped = new Map();
    entries.filter((entry) => {
      const level = String(entry.level || '').toLowerCase();
      const message = String(entry.message || '').toLowerCase();
      return level === 'error' || message.includes('api_error') || message.includes('critical_error') || message.includes('server_crash');
    }).forEach((entry) => {
      const normalizedMessage = String(entry.message || 'Unknown error').trim();
      const normalizedStack = String(entry.stack || '').trim();
      const key = `${entry.file}|${normalizedMessage}|${normalizedStack}`;
      const existing = grouped.get(key);

      if (!existing) {
        grouped.set(key, {
          level: entry.level || 'error',
          message: normalizedMessage,
          stack: normalizedStack,
          timestamp: entry.timestamp || null,
          file: entry.file,
          metadata: entry,
          occurrences: 1,
        });
        return;
      }

      existing.occurrences += 1;
      const existingTime = new Date(existing.timestamp || 0).getTime();
      const nextTime = new Date(entry.timestamp || 0).getTime();
      if (nextTime > existingTime) {
        existing.timestamp = entry.timestamp || existing.timestamp;
        existing.metadata = entry;
      }
    });

    const items = Array.from(grouped.values())
      .sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))
      .slice(0, limit)
      .map((entry, index) => ({
        id: `${entry.file}-${index}`,
        level: entry.level,
        message: entry.message,
        stack: entry.stack,
        timestamp: entry.timestamp,
        file: entry.file,
        metadata: entry.metadata,
        occurrences: entry.occurrences,
      }));
    return { items, total: items.length };
  }

  static async getSystemHealth() {
    const [databaseProbe, maintenanceResult, activeUsersResult] = await Promise.all([
      getSupabase().from('restaurants').select('id', { count: 'exact', head: true }).limit(1),
      getSupabase().from('system_settings').select('setting_value').is('restaurant_id', null).eq('setting_key', 'global_maintenance').maybeSingle(),
      getSupabase().from('users').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    ]);
    if (databaseProbe.error) throw databaseProbe.error;
    if (maintenanceResult.error && maintenanceResult.error.code !== 'PGRST116') throw maintenanceResult.error;
    if (activeUsersResult.error && activeUsersResult.error.code !== 'PGRST116') throw activeUsersResult.error;
    const metrics = metricsInstance.getMetrics();
    return { apiStatus: 'healthy', dbStatus: 'connected', activeUsers: activeUsersResult.count || 0, errorCount: metrics.totalErrors || 0, maintenanceEnabled: Boolean(settingValue(maintenanceResult.data, {}).enabled) };
  }

  static async createBroadcast({ title, message }, actor) {
    const payload = { restaurant_id: null, title, message, audience: 'all_restaurants', created_by: actor?.userId || null, created_at: new Date().toISOString() };
    const { data, error } = await getSupabase().from('broadcast_notifications').insert([payload]).select('id, title, message, audience, created_at').single();
    if (error) throw error;
    await this.logAudit({ actor, action: 'developer.broadcast_created', targetType: 'broadcast', targetId: data.id, metadata: { title } });
    const { data: restaurants, error: restaurantsError } = await getSupabase().from('restaurants').select('id');
    if (restaurantsError && restaurantsError.code !== 'PGRST116') throw restaurantsError;
    (restaurants || []).forEach((restaurant) => broadcastRestaurantEvent(restaurant.id, 'notification', { type: 'platform.broadcast', title: data.title, message: data.message, broadcastId: data.id, audience: data.audience, createdAt: data.created_at }));
    return { id: data.id, title: data.title, message: data.message, audience: data.audience, createdAt: data.created_at };
  }

  static async exportData(resource) {
    const normalized = String(resource || '').trim().toLowerCase();
    if (normalized === 'orders') {
      const { data, error } = await getSupabase().from('orders').select('id, restaurant_id, status, payment_status, order_type, total_amount, final_amount, created_at, updated_at').order('created_at', { ascending: false }).limit(5000);
      if (error && error.code !== 'PGRST116') throw error;
      return { filename: `orders-export-${new Date().toISOString().slice(0, 10)}.csv`, mimeType: 'text/csv', content: toCsv(data || []) };
    }
    if (normalized === 'users') {
      const { data, error } = await getSupabase().from('users').select('id, restaurant_id, name, email, phone, role, status, created_at, updated_at').order('created_at', { ascending: false }).limit(5000);
      if (error && error.code !== 'PGRST116') throw error;
      return { filename: `users-export-${new Date().toISOString().slice(0, 10)}.csv`, mimeType: 'text/csv', content: toCsv((data || []).map((user) => ({ ...user, role: this.roleLabel(user.role) }))) };
    }
    if (normalized === 'backup') {
      const [restaurants, users, settings, flags] = await Promise.all([
        getSupabase().from('restaurants').select('id, name, email, city, status, created_at').limit(5000),
        getSupabase().from('users').select('id, restaurant_id, name, email, role, status, created_at').limit(5000),
        getSupabase().from('system_settings').select('id, restaurant_id, setting_key, setting_value, updated_at').limit(5000),
        getSupabase().from('feature_flags').select('id, restaurant_id, feature_key, enabled, updated_at').limit(5000),
      ]);
      return { filename: `platform-backup-${new Date().toISOString().slice(0, 10)}.json`, mimeType: 'application/json', content: JSON.stringify({ generatedAt: new Date().toISOString(), restaurants: restaurants.data || [], users: users.data || [], systemSettings: settings.data || [], featureFlags: flags.data || [] }, null, 2) };
    }
    throw new Error('Unsupported export resource');
  }
}

export default DeveloperService;
