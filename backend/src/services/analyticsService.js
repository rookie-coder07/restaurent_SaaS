import logger from '../utils/logger.js';
import supabase from '../config/supabase.js';
import { splitNotesAndKotMeta } from '../utils/kotMetadata.js';

export class AnalyticsService {
  static isMissingEodTableError(error) {
    const message = String(error?.message || '').toLowerCase();
    const details = String(error?.details || '').toLowerCase();
    return (
      message.includes('daily_eod_summaries') ||
      details.includes('daily_eod_summaries') ||
      error?.code === '42P01'
    );
  }

  static isSettledOrder(order) {
    return order?.status === 'completed' || order?.payment_status === 'paid';
  }

  static getDateString(value = new Date()) {
    const date = typeof value === 'string' ? new Date(value) : value;
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().split('T')[0];
  }

  static getDayBounds(date) {
    const dateStr = typeof date === 'string' ? date : this.getDateString(date);
    return {
      dateStr,
      start: `${dateStr}T00:00:00.000Z`,
      end: `${dateStr}T23:59:59.999Z`,
    };
  }

  static getPreviousDateString(referenceDate = new Date()) {
    const baseDate = typeof referenceDate === 'string' ? new Date(referenceDate) : new Date(referenceDate);
    const previousDate = new Date(baseDate);
    previousDate.setDate(previousDate.getDate() - 1);
    return this.getDateString(previousDate);
  }

  static parseDiscountAmountFromNotes(notes = '') {
    const match = String(notes || '').match(/discount amount\s+(\d+(?:\.\d+)?)/i);
    return match ? Number(match[1]) : 0;
  }

  static buildHourLabel(hour) {
    const numericHour = Number(hour || 0);
    const suffix = numericHour >= 12 ? 'PM' : 'AM';
    const formattedHour = numericHour % 12 || 12;
    return `${formattedHour}:00 ${suffix}`;
  }

  static buildSummaryMessage(summary) {
    return `Closed ${summary.totalOrders} orders with ${summary.totalRevenue.toFixed(2)} revenue, ${summary.averageOrderValue.toFixed(2)} average order value, and ${summary.totalDiscounts.toFixed(2)} in discounts.`;
  }

  static normalizeLoyaltyPhone(value = '') {
    const normalized = String(value || '').replace(/[^\d]/g, '');
    return normalized.length >= 10 ? normalized.slice(-10) : '';
  }

  static extractLoyaltyOrderMeta(order = {}) {
    const { kotMeta } = splitNotesAndKotMeta(order.notes);
    const customerPhone = this.normalizeLoyaltyPhone(kotMeta?.loyalty?.customerPhone || kotMeta?.online?.customerPhone || '');
    return {
      customerPhone,
      earnedPoints: Math.max(0, Number(kotMeta?.loyalty?.earnedPoints || 0)),
      redeemedPoints: Math.max(0, Number(kotMeta?.loyalty?.redeemedPoints || 0)),
      redeemedAmount: Math.max(0, Number(kotMeta?.loyalty?.redeemedAmount || 0)),
    };
  }

  static async fetchOrdersForDay(restaurantId, date) {
    const { start, end } = this.getDayBounds(date);
    const { data: orders, error } = await supabase
      .from('orders')
      .select(`
        id,
        created_at,
        status,
        payment_status,
        total_amount,
        notes,
        order_items (
          id,
          quantity,
          unit_price,
          menu_items (
            name
          )
        )
      `)
      .eq('restaurant_id', restaurantId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true });

    if (error) {
      throw error;
    }

    return orders || [];
  }

  static async computeEodSummaryForDate(restaurantId, date) {
    const dateStr = typeof date === 'string' ? date : this.getDateString(date);
    const orders = await this.fetchOrdersForDay(restaurantId, dateStr);
    const settledOrders = orders.filter((order) => this.isSettledOrder(order));
    const totalRevenue = settledOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0);
    const totalOrders = orders.length;
    const averageOrderValue = settledOrders.length > 0 ? totalRevenue / settledOrders.length : 0;
    const totalDiscounts = settledOrders.reduce(
      (sum, order) => sum + this.parseDiscountAmountFromNotes(order.notes),
      0
    );

    const itemMap = new Map();
    const hourMap = new Map();

    orders.forEach((order) => {
      const orderHour = new Date(order.created_at || Date.now()).getHours();
      const currentHour = hourMap.get(orderHour) || {
        hour: orderHour,
        label: this.buildHourLabel(orderHour),
        orders: 0,
        revenue: 0,
      };
      currentHour.orders += 1;
      currentHour.revenue += Number(order.total_amount || 0);
      hourMap.set(orderHour, currentHour);

      (order.order_items || []).forEach((item) => {
        const itemName = item.menu_items?.name || 'Unknown item';
        const currentItem = itemMap.get(itemName) || {
          name: itemName,
          quantity: 0,
          revenue: 0,
        };
        const quantity = Number(item.quantity || 0);
        const revenue = Number(item.unit_price || 0) * quantity;
        currentItem.quantity += quantity;
        currentItem.revenue += revenue;
        itemMap.set(itemName, currentItem);
      });
    });

    const rankedItems = Array.from(itemMap.values()).sort(
      (left, right) => right.quantity - left.quantity || right.revenue - left.revenue
    );
    const topItems = rankedItems.slice(0, 5);
    const lowPerformingItems = rankedItems
      .filter((item) => item.quantity > 0)
      .slice(-5)
      .reverse()
      .sort((left, right) => left.quantity - right.quantity || left.revenue - right.revenue);
    const peakHours = Array.from(hourMap.values())
      .sort((left, right) => right.orders - left.orders || right.revenue - left.revenue)
      .slice(0, 4);

    const summary = {
      date: dateStr,
      totalRevenue: Number(totalRevenue.toFixed(2)),
      totalOrders,
      averageOrderValue: Number(averageOrderValue.toFixed(2)),
      totalDiscounts: Number(totalDiscounts.toFixed(2)),
      topItems,
      lowPerformingItems,
      peakHours,
      stats: {
        settledOrders: settledOrders.length,
        discountedOrders: settledOrders.filter((order) => this.parseDiscountAmountFromNotes(order.notes) > 0).length,
        peakHour: peakHours[0]?.label || null,
      },
    };

    return {
      ...summary,
      summaryMessage: this.buildSummaryMessage(summary),
    };
  }

  static async saveEodSummary(restaurantId, summary) {
    const payload = {
      restaurant_id: restaurantId,
      date: summary.date,
      total_revenue: summary.totalRevenue || 0,
      total_orders: summary.totalOrders || 0,
      average_order_value: summary.averageOrderValue || 0,
      total_discounts: summary.totalDiscounts || 0,
      top_items: summary.topItems || [],
      low_performing_items: summary.lowPerformingItems || [],
      peak_hours: summary.peakHours || [],
      stats: summary.stats || {},
      summary_message: summary.summaryMessage || '',
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('daily_eod_summaries')
      .upsert(payload, {
        onConflict: 'restaurant_id,date',
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return this.transformEodSummary(data);
  }

  static transformEodSummary(row) {
    if (!row) {
      return null;
    }

    return {
      id: row.id,
      date: row.date,
      totalRevenue: Number(row.total_revenue || 0),
      totalOrders: Number(row.total_orders || 0),
      averageOrderValue: Number(row.average_order_value || 0),
      totalDiscounts: Number(row.total_discounts || 0),
      topItems: Array.isArray(row.top_items) ? row.top_items : [],
      lowPerformingItems: Array.isArray(row.low_performing_items) ? row.low_performing_items : [],
      peakHours: Array.isArray(row.peak_hours) ? row.peak_hours : [],
      stats: row.stats || {},
      summaryMessage: row.summary_message || '',
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

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
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];

      const { data: analytics, error } = await supabase
        .from('daily_analytics')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .gte('date', startDateStr)
        .lte('date', endDateStr);

      if (error) throw error;

      if (!analytics || analytics.length === 0) {
        return {
          totalOrders: 0,
          totalRevenue: 0,
          averageOrderValue: 0,
          completedOrders: 0,
          period: `Last ${days} days`,
        };
      }

      const totalOrders = analytics.reduce((sum, day) => sum + (day.orders_count || 0), 0);
      const totalRevenue = analytics.reduce((sum, day) => sum + (day.total_revenue || 0), 0);
      const completedOrders = analytics.reduce((sum, day) => sum + (day.completed_orders || 0), 0);
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      return {
        totalOrders,
        totalRevenue,
        averageOrderValue: parseFloat(averageOrderValue.toFixed(2)),
        completedOrders,
        period: `Last ${days} days`,
        dailyBreakdown: analytics,
      };
    } catch (error) {
      logger.error('❌ Get analytics summary error:', error);
      throw error;
    }
  }

  static async getRevenueByPaymentMethod(restaurantId, startDate, endDate) {
    try {
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
      const { data: orders, error } = await supabase
        .from('orders')
        .select('status, payment_status, created_at, total_amount')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const settledOrders = (orders || []).filter(
        (order) => order.status === 'completed' || order.payment_status === 'paid'
      );

      const metrics = {
        totalOrders: orders?.length || 0,
        pendingOrders: orders?.filter(o => o.status === 'pending').length || 0,
        servedOrders: orders?.filter(o => o.status === 'served').length || 0,
        completedOrders: settledOrders.length,
        cancelledOrders: orders?.filter(o => o.status === 'cancelled').length || 0,
        totalRevenue: settledOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0),
      };

      metrics.averageOrderValue = metrics.completedOrders > 0 
        ? parseFloat((metrics.totalRevenue / metrics.completedOrders).toFixed(2)) 
        : 0;

      return metrics;
    } catch (error) {
      logger.error('❌ Get order metrics error:', error);
      throw error;
    }
  }

  static async getPeakHours(restaurantId, startDate, endDate) {
    try {
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

      return hourCounts;
    } catch (error) {
      logger.error('❌ Get peak hours error:', error);
      throw error;
    }
  }

  static async getCustomerMetrics(restaurantId, startDate, endDate) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id')
        .eq('restaurant_id', restaurantId)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      // In a real implementation, this would track unique customers
      return {
        totalTransactions: orders?.length || 0,
        period: `${startDate} to ${endDate}`,
      };
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

  // ============ UNIFIED GETTER METHODS ============

  static async getDailySalesReport(restaurantId, date) {
    try {
      const dateStr = typeof date === 'string' 
        ? date 
        : date.toISOString().split('T')[0];

      const startOfDay = `${dateStr}T00:00:00Z`;
      const endOfDay = `${dateStr}T23:59:59Z`;

      const metrics = await this.getOrderMetrics(restaurantId, startOfDay, endOfDay);
      const peakHours = await this.getPeakHours(restaurantId, startOfDay, endOfDay);
      const paymentMethods = await this.getRevenueByPaymentMethod(restaurantId, startOfDay, endOfDay);

      return {
        date: dateStr,
        metrics,
        peakHours,
        paymentMethods,
      };
    } catch (error) {
      logger.error('❌ Get daily sales report error:', error);
      throw error;
    }
  }

  static async getMonthlySalesReport(restaurantId, year, month) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      const startDateStr = startDate.toISOString();
      const endDateStr = endDate.toISOString();

      const metrics = await this.getOrderMetrics(restaurantId, startDateStr, endDateStr);
      const dailyAnalytics = await this.getDailyAnalytics(
        restaurantId,
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );
      const topItems = await this.getTopMenuItems(restaurantId, 10);

      return {
        year,
        month,
        metrics,
        dailyBreakdown: dailyAnalytics,
        topItems,
      };
    } catch (error) {
      logger.error('❌ Get monthly sales report error:', error);
      throw error;
    }
  }

  static async getTopItems(restaurantId, days = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          menu_item_id,
          quantity,
          menu_items (
            id,
            name,
            price,
            category_id
          )
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString());

      if (error) throw error;

      // Group by menu item and sum quantities
      const itemMap = {};
      (orderItems || []).forEach(item => {
        const menuItemId = item.menu_item_id;
        if (!itemMap[menuItemId]) {
          itemMap[menuItemId] = {
            menuItemId,
            name: item.menu_items?.name || 'Unknown',
            price: item.menu_items?.price || 0,
            totalQuantity: 0,
            totalRevenue: 0,
          };
        }
        itemMap[menuItemId].totalQuantity += item.quantity || 0;
        itemMap[menuItemId].totalRevenue += (item.quantity || 0) * (item.menu_items?.price || 0);
      });

      // Sort by total revenue descending and return top 10
      const topItems = Object.values(itemMap)
        .sort((a, b) => b.totalRevenue - a.totalRevenue)
        .slice(0, 10);

      return {
        period: `Last ${days} days`,
        items: topItems,
      };
    } catch (error) {
      logger.error('❌ Get top items error:', error);
      throw error;
    }
  }

  static async getOrCreateEodSummary(restaurantId, date) {
    try {
      const dateStr = typeof date === 'string' ? date : this.getDateString(date);
      const { data: existing, error } = await supabase
        .from('daily_eod_summaries')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .eq('date', dateStr)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (existing) {
        return this.transformEodSummary(existing);
      }

      const summary = await this.computeEodSummaryForDate(restaurantId, dateStr);
      return await this.saveEodSummary(restaurantId, summary);
    } catch (error) {
      if (this.isMissingEodTableError(error)) {
        logger.warn('daily_eod_summaries table is missing, returning computed EOD summary without persistence');
        const fallbackSummary = await this.computeEodSummaryForDate(
          restaurantId,
          typeof date === 'string' ? date : this.getDateString(date)
        );
        return {
          id: null,
          createdAt: null,
          updatedAt: null,
          ...fallbackSummary,
        };
      }

      logger.error('❌ Get or create EOD summary error:', error);
      throw error;
    }
  }

  static async getLatestEodSummary(restaurantId, { ensure = false, referenceDate = new Date() } = {}) {
    try {
      if (ensure) {
        const previousDate = this.getPreviousDateString(referenceDate);
        await this.getOrCreateEodSummary(restaurantId, previousDate);
      }

      const { data, error } = await supabase
        .from('daily_eod_summaries')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        if (this.isMissingEodTableError(error)) {
          logger.warn('daily_eod_summaries table is missing, returning computed latest EOD summary without persistence');
          const previousDate = this.getPreviousDateString(referenceDate);
          const fallbackSummary = await this.computeEodSummaryForDate(restaurantId, previousDate);
          return {
            id: null,
            createdAt: null,
            updatedAt: null,
            ...fallbackSummary,
          };
        }

        throw error;
      }

      return this.transformEodSummary(data);
    } catch (error) {
      logger.error('❌ Get latest EOD summary error:', error);
      throw error;
    }
  }

  static async getEodSummaryHistory(restaurantId, limit = 7) {
    try {
      const { data, error } = await supabase
        .from('daily_eod_summaries')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .order('date', { ascending: false })
        .limit(limit);

      if (error) {
        if (this.isMissingEodTableError(error)) {
          logger.warn('daily_eod_summaries table is missing, returning empty EOD summary history');
          return [];
        }

        throw error;
      }

      return (data || []).map((row) => this.transformEodSummary(row));
    } catch (error) {
      logger.error('❌ Get EOD summary history error:', error);
      throw error;
    }
  }

  static async getLoyaltySummary(restaurantId) {
    try {
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, created_at, total_amount, status, payment_status, notes')
        .eq('restaurant_id', restaurantId)
        .or('status.eq.completed,payment_status.eq.paid')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const memberMap = new Map();
      const recentActivity = [];

      (orders || []).forEach((order) => {
        const loyalty = this.extractLoyaltyOrderMeta(order);
        if (!loyalty.customerPhone) {
          return;
        }

        const currentMember = memberMap.get(loyalty.customerPhone) || {
          customerPhone: loyalty.customerPhone,
          visitCount: 0,
          totalSpend: 0,
          totalEarnedPoints: 0,
          totalRedeemedPoints: 0,
          totalRedeemedAmount: 0,
          lastVisitAt: null,
        };

        currentMember.visitCount += 1;
        currentMember.totalSpend += Number(order.total_amount || 0);
        currentMember.totalEarnedPoints += loyalty.earnedPoints;
        currentMember.totalRedeemedPoints += loyalty.redeemedPoints;
        currentMember.totalRedeemedAmount += loyalty.redeemedAmount;
        currentMember.lastVisitAt = currentMember.lastVisitAt || order.created_at;
        memberMap.set(loyalty.customerPhone, currentMember);

        if (loyalty.earnedPoints > 0 || loyalty.redeemedPoints > 0) {
          recentActivity.push({
            orderId: order.id,
            customerPhone: loyalty.customerPhone,
            createdAt: order.created_at,
            totalAmount: Number(order.total_amount || 0),
            earnedPoints: loyalty.earnedPoints,
            redeemedPoints: loyalty.redeemedPoints,
            redeemedAmount: Number(loyalty.redeemedAmount.toFixed(2)),
          });
        }
      });

      const members = Array.from(memberMap.values()).map((member) => ({
        ...member,
        totalSpend: Number(member.totalSpend.toFixed(2)),
        totalRedeemedAmount: Number(member.totalRedeemedAmount.toFixed(2)),
        pointsBalance: Math.max(0, member.totalEarnedPoints - member.totalRedeemedPoints),
      }));

      const activeMembers = members.length;
      const repeatCustomers = members.filter((member) => member.visitCount > 1).length;
      const totalPointsIssued = members.reduce((sum, member) => sum + member.totalEarnedPoints, 0);
      const totalRedeemedPoints = members.reduce((sum, member) => sum + member.totalRedeemedPoints, 0);
      const totalRedeemedAmount = members.reduce((sum, member) => sum + member.totalRedeemedAmount, 0);

      return {
        program: {
          earnRule: '1 point for every Rs 100 spent',
          redeemRule: '1 point = Rs 1 discount',
        },
        summary: {
          activeMembers,
          repeatCustomers,
          totalPointsIssued,
          totalRedeemedPoints,
          totalRedeemedAmount: Number(totalRedeemedAmount.toFixed(2)),
        },
        topMembers: members
          .sort((left, right) => right.pointsBalance - left.pointsBalance || right.totalSpend - left.totalSpend)
          .slice(0, 10),
        recentActivity: recentActivity.slice(0, 12),
      };
    } catch (error) {
      logger.error('Loyalty summary error:', error);
      throw error;
    }
  }

  static async getPowerBIDashboard(restaurantId, filters = {}) {
    const { startDate, endDate } = filters;

    try {
      const result = {};

      // 1. KPI METRICS
      const kpis = await this.getKPIMetrics(restaurantId, startDate, endDate);
      Object.assign(result, kpis);

      // 2. REVENUE TREND (7/30 days)
      result.revenueTrend = await this.getRevenueTrend(restaurantId, startDate, endDate);

      // 3. ORDERS VS REVENUE
      result.ordersVsRevenue = await this.getOrdersVsRevenue(restaurantId, startDate, endDate);

      // 4. CATEGORY PERFORMANCE
      result.categoryPerformance = await this.getCategoryPerformance(restaurantId, startDate, endDate);

      // 5. TOP 10 ITEMS
      result.topItems = await this.getTopItems(restaurantId, startDate, endDate, 10);

      // 6. PAYMENT METHODS
      result.paymentMethods = await this.getPaymentMethods(restaurantId, startDate, endDate);

      // 7. HOURLY DATA (Heatmap)
      result.hourlyData = await this.getHourlyData(restaurantId, startDate, endDate);

      // 8. INSIGHTS
      result.insights = await this.generateInsights(restaurantId, result);

      return result;
    } catch (error) {
      logger.error('[AnalyticsService] getPowerBIDashboard failed:', error);
      throw error;
    }
  }

  static async getKPIMetrics(restaurantId, startDate, endDate) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, payment_status, total_amount, final_amount, created_at, notes')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const totalRevenue = (orders || []).reduce((sum, o) => sum + Number(o.final_amount || 0), 0);
    const totalOrders = orders?.length || 0;
    const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Unique customers
    const uniqueCustomers = new Set(
      (orders || []).map((o) => {
        try {
          const notes = JSON.parse(o.notes || '{}');
          return notes.online?.customerPhone || notes.loyalty?.customerPhone || o.id;
        } catch {
          return o.id;
        }
      })
    ).size;

    return {
      totalRevenue,
      totalOrders,
      aov,
      uniqueCustomers,
    };
  }

  static async getRevenueTrend(restaurantId, startDate, endDate) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('created_at, final_amount')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const grouped = {};
    (orders || []).forEach((o) => {
      const date = o.created_at.split('T')[0];
      grouped[date] = (grouped[date] || 0) + Number(o.final_amount || 0);
    });

    return Object.entries(grouped).map(([date, revenue]) => ({
      date,
      revenue: Number(revenue.toFixed(2)),
    }));
  }

  static async getOrdersVsRevenue(restaurantId, startDate, endDate) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('created_at, final_amount, id')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const grouped = {};
    (orders || []).forEach((o) => {
      const date = o.created_at.split('T')[0];
      if (!grouped[date]) grouped[date] = { orders: 0, revenue: 0 };
      grouped[date].orders += 1;
      grouped[date].revenue += Number(o.final_amount || 0);
    });

    return Object.entries(grouped).map(([date, data]) => ({
      date,
      orders: data.orders,
      revenue: Number(data.revenue.toFixed(2)),
    }));
  }

  static async getCategoryPerformance(restaurantId, startDate, endDate) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_items')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const grouped = {};
    (orders || []).forEach((o) => {
      (o.order_items || []).forEach((item) => {
        const cat = item.category || 'Uncategorized';
        if (!grouped[cat]) grouped[cat] = 0;
        grouped[cat] += Number(item.unit_price || 0) * Number(item.quantity || 0);
      });
    });

    return Object.entries(grouped).map(([name, revenue]) => ({
      name,
      revenue: Number(revenue.toFixed(2)),
    }));
  }

  static async getTopItems(restaurantId, startDate, endDate, limit = 10) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_items')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const grouped = {};
    (orders || []).forEach((o) => {
      (o.order_items || []).forEach((item) => {
        const name = item.name || 'Unknown';
        if (!grouped[name]) grouped[name] = { quantity: 0, revenue: 0 };
        grouped[name].quantity += Number(item.quantity || 0);
        grouped[name].revenue += Number(item.unit_price || 0) * Number(item.quantity || 0);
      });
    });

    return Object.entries(grouped)
      .map(([name, data]) => ({
        name,
        quantity: data.quantity,
        revenue: Number(data.revenue.toFixed(2)),
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  static async getPaymentMethods(restaurantId, startDate, endDate) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('payment_method, final_amount')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const grouped = {};
    (orders || []).forEach((o) => {
      const method = (o.payment_method || 'cash').toUpperCase();
      grouped[method] = (grouped[method] || 0) + Number(o.final_amount || 0);
    });

    return Object.entries(grouped).map(([name, value]) => ({
      name,
      value: Number(value.toFixed(2)),
    }));
  }

  static async getHourlyData(restaurantId, startDate, endDate) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('created_at')
      .eq('restaurant_id', restaurantId)
      .eq('payment_status', 'paid')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (error) throw error;

    const hourly = {};
    for (let h = 0; h < 24; h++) {
      hourly[h] = 0;
    }

    (orders || []).forEach((o) => {
      const hour = new Date(o.created_at).getHours();
      hourly[hour]++;
    });

    return Object.entries(hourly).map(([hour, orders]) => ({
      hour: Number(hour),
      orders,
    }));
  }

  static async generateInsights(restaurantId, dashboardData) {
    const insights = [];

    if (dashboardData.hourlyData?.length > 0) {
      const maxHour = dashboardData.hourlyData.reduce((max, h) => (h.orders > max.orders ? h : max));
      insights.push({
        icon: '🔥',
        title: 'Peak Hour',
        description: `Highest traffic at ${maxHour.hour}:00 with ${maxHour.orders} orders`,
      });
    }

    if (dashboardData.topItems?.length > 0) {
      const topItem = dashboardData.topItems[0];
      insights.push({
        icon: '⭐',
        title: 'Top Item',
        description: `${topItem.name} is your best seller (${topItem.quantity} units)`,
      });
    }

    if (dashboardData.aov > 0) {
      insights.push({
        icon: '💰',
        title: 'Average Order Value',
        description: `Your AOV is ₹${dashboardData.aov.toFixed(2)} - focus on upselling`,
      });
    }

    return insights;
  }
}

export default AnalyticsService;
