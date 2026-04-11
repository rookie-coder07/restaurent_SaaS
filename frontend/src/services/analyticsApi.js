import api, { API_BASE_URL, getCurrentRestaurantId, getCurrentPortalAccessToken } from './api';

const ANALYTICS_BASE = `${API_BASE_URL}/analytics`;

const analyticsApi = {
  // Dashboard endpoints
  getDashboard: async (params = {}) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/dashboard`, { params });
    return data.data;
  },

  getKPI: async (params = {}) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/kpi`, { params });
    return data.data;
  },

  getRevenueTrend: async (params = {}) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/revenue-trend`, { params });
    return data.data;
  },

  getOrdersVsRevenue: async (params = {}) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/orders-vs-revenue`, { params });
    return data.data;
  },

  getCategoryPerformance: async (params = {}) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/category-performance`, { params });
    return data.data;
  },

  getTopItems: async (params = {}) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/items`, { params });
    return data.data;
  },

  getPaymentMethods: async (params = {}) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/payment-methods`, { params });
    return data.data;
  },

  getHourlyData: async (params = {}) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/hourly-data`, { params });
    return data.data;
  },

  // Legacy endpoints (keep for backward compatibility)
  getDailySalesReport: async (date) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/daily-sales`, {
      params: { date: date?.toISOString() || new Date().toISOString() },
    });
    return data.data;
  },

  getMonthlySalesReport: async (year, month) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/monthly-sales`, {
      params: { year, month },
    });
    return data.data;
  },

  getLoyaltySummary: async () => {
    const { data } = await api.get(`${ANALYTICS_BASE}/loyalty`);
    return data.data;
  },

  getLatestEodSummary: async () => {
    const { data } = await api.get(`${ANALYTICS_BASE}/eod/latest`);
    return data.data;
  },

  getEodSummaryHistory: async (limit = 7) => {
    const { data } = await api.get(`${ANALYTICS_BASE}/eod/history`, {
      params: { limit },
    });
    return data.data;
  },
};

export { analyticsApi };
export default analyticsApi;
