import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import { cacheManager } from '../utils/cacheManager.js';

const ANALYTICS_CACHE_TTL = 300;
const DAILY_ANALYTICS_CACHE_TTL = 3600;

export class AnalyticsService {
  // ============ DAILY ANALYTICS ============

  static async recordDailyAnalytics(restaurantId, analyticsData) {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Try to update existing record first
      const { data: existing } = await supabase
        .from('daily_analytics')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .eq('date', today)
        .single();

      if (existing) {
        // Update existing
        const { data: analytics, error } = await supabase
          .from('daily_analytics')
          .update({
            orders_count: (analyticsData.ordersCount || 0),
            total_revenue: (analyticsData.totalRevenue || 0),
            completed_orders: (analyticsData.completedOrders || 0),
            average_order_value: (analyticsData.averageOrderValue || 0),
            peak_hour: analyticsData.peakHour || null,
            updated_at: new Date(),
          })
          .eq('id', existing.id)
          .select()
          .single();

        if (error) throw error;
        logger.info(`✅ Daily analytics updated for ${today}`);
        return analytics;
      } else {
        // Create new
        const { data: analytics, error } = await supabase
          .from('daily_analytics')
          .insert([{
            restaurant_id: restaurantId,
            date: today,
            orders_count: (analyticsData.ordersCount || 0),
            total_revenue: (analyticsData.totalRevenue || 0),
            completed_orders: (analyticsData.completedOrders || 0),
            average_order_value: (analyticsData.averageOrderValue || 0),
            peak_hour: analyticsData.peakHour || null,
          }])
          .select()
          .single();

        if (error) throw error;
        logger.info(`✅ Daily analytics recorded for ${today}`);
        return analytics;
      }
    } catch (error) {
      logger.error('❌ Record daily analytics error:', error);
      throw error;
    }
  }

  static async getDailyAnalytics(restaurantId, startDate, endDate) {
    try {
      const { data: analytics, error } = await supabase
        .from('daily_analytics')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: true });

      if (error) throw error;

      return analytics || [];
    } catch (error) {
      logger.error('❌ Get daily analytics error:', error);
      throw error;
    }
  }

  static async getAnalyticsSummary(restaurantId, days = 7) {
    try {
      const cacheKey = `analytics_summary:${restaurantId}:${days}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      // Use aggregation at DB level instead of fetching and calculating in-memory
      const { data: analytics, error } = await supabase
        .from('daily_analytics')
        .select('orders_count, total_revenue, completed_orders')
        .eq('restaurant_id', restaurantId)
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (error) throw error;

      if (!analytics || analytics.length === 0) {
        const result = {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          completedOrders: 0,
          period: `Last ${days} days`,
        };
        cacheManager.set(cacheKey, result, ANALYTICS_CACHE_TTL);
        return result;
      }

      const totalOrders = analytics.reduce((sum, day) => sum + (day.orders_count || 0), 0);
      const totalRevenue = analytics.reduce((sum, day) => sum + (day.total_revenue || 0), 0);
      const completedOrders = analytics.reduce((sum, day) => sum + (day.completed_orders || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const result = {
        totalOrders,
        totalRevenue,
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        completedOrders,
        period: `Last ${days} days`,
        dailyBreakdown: analytics,
      };

      cacheManager.set(cacheKey, result, ANALYTICS_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get analytics summary error:', error);
      throw error;
    }
  }

  static async getRevenueByPaymentMethod(restaurantId, startDate, endDate) {
    try {
      const cacheKey = `revenue_by_method:${restaurantId}:${startDate}:${endDate}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: orders, error } = await supabase
        .from('orders')
        .select('payment_method, total_amount')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .eq('status', 'completed');

      if (error) throw error;

      const revenueByMethod = {};
      (orders || []).forEach(order => {
        const method = order.payment_method || 'unknown';
        revenueByMethod[method] = (revenueByMethod[method] || 0) + (order.total_amount || 0);
      });

      cacheManager.set(cacheKey, revenueByMethod, ANALYTICS_CACHE_TTL);
      return revenueByMethod;
    } catch (error) {
      logger.error('❌ Get revenue by payment method error:', error);
      throw error;
    }
  }

  static async getTopMenuItems(restaurantId, limit = 10) {
    try {
      const { data: topItems, error } = await supabase
        .rpc('get_top_menu_items', {
          p_restaurant_id: restaurantId,
          p_limit: limit,
        });

      if (error) throw error;

      return topItems || [];
    } catch (error) {
      logger.error('❌ Get top menu items error:', error);
      // Fallback: return empty array if RPC doesn't exist
      return [];
    }
  }

  static async getOrderMetrics(restaurantId, startDate, endDate) {
    try {
      const cacheKey = `order_metrics:${restaurantId}:${startDate}:${endDate}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      // Select only required fields to reduce payload
      const { data: orders, error } = await supabase
        .from('orders')
        .select('status, total_amount')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const metrics = {
        totalOrders: orders?.length || 0,
        pendingOrders: orders?.filter(o => o.status === 'pending').length || 0,
        completedOrders: orders?.filter(o => o.status === 'completed').length || 0,
        cancelledOrders: orders?.filter(o => o.status === 'cancelled').length || 0,
        totalRevenue: orders?.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0,
      };

      metrics.averageOrderValue = metrics.totalOrders > 0 
        ? parseFloat((metrics.totalRevenue / metrics.totalOrders).toFixed(2)) 
        : 0;

      cacheManager.set(cacheKey, metrics, ANALYTICS_CACHE_TTL);
      return metrics;
    } catch (error) {
      logger.error('❌ Get order metrics error:', error);
      throw error;
    }
  }

  static async getPeakHours(restaurantId, startDate, endDate) {
    try {
      const cacheKey = `peak_hours:${restaurantId}:${startDate}:${endDate}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const hourCounts = {};
      (orders || []).forEach(order => {
        const hour = new Date(order.created_at).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      });

      cacheManager.set(cacheKey, hourCounts, ANALYTICS_CACHE_TTL);
      return hourCounts;
    } catch (error) {
      logger.error('❌ Get peak hours error:', error);
      throw error;
    }
  }

  static async getCustomerMetrics(restaurantId, startDate, endDate) {
    try {
      const cacheKey = `customer_metrics:${restaurantId}:${startDate}:${endDate}`;
      const cached = cacheManager.get(cacheKey);
      if (cached) return cached;

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const result = {
        totalTransactions: orders?.length || 0,
        period: `${startDate} to ${endDate}`,
      };

      cacheManager.set(cacheKey, result, ANALYTICS_CACHE_TTL);
      return result;
    } catch (error) {
      logger.error('❌ Get customer metrics error:', error);
      throw error;
    }
  }

  static async generateReport(restaurantId, reportType, startDate, endDate) {
    try {
      let report = {
        type: reportType,
        restaurantId,
        period: { startDate, endDate },
        generatedAt: new Date().toISOString(),
      };

      switch (reportType) {
        case 'revenue':
          report.data = await this.getOrderMetrics(restaurantId, startDate, endDate);
          break;
        case 'peak_hours':
          report.data = await this.getPeakHours(restaurantId, startDate, endDate);
          break;
        case 'payment_methods':
          report.data = await this.getRevenueByPaymentMethod(restaurantId, startDate, endDate);
          break;
        case 'menu':
          report.data = await this.getTopMenuItems(restaurantId, 15);
          break;
        default:
          throw new Error('Unknown report type');
      }

      return report;
    } catch (error) {
      logger.error('❌ Generate report error:', error);
      throw error;
    }
  }
}

export default AnalyticsService;
