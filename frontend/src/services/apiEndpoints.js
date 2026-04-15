import api from './api.js';
import { getCurrentPortalAccessToken, getCurrentRestaurantId } from './api.js';
import { deduplicator, responseCache } from '../utils/requestDedup';

const DEFAULT_CACHE_TTL_MS = 30 * 1000;

function stableStringify(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${key}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }

  return String(value);
}

function buildGetRequestKey(url, config = {}) {
  const token = getCurrentPortalAccessToken();
  const restaurantId = getCurrentRestaurantId();

  return [
    'GET',
    url,
    stableStringify(config.params || {}),
    stableStringify(config.headers || {}),
    restaurantId,
    token ? token.slice(-16) : '',
  ].join('|');
}

function getCacheTtlMs(url) {
  if (url.includes('/v1/customer/menu')) {
    return 60 * 1000;
  }

  if (
    url.includes('/v1/menu/items') ||
    url.includes('/v1/menu/categories') ||
    url.includes('/v1/tables') ||
    url.includes('/v1/restaurants/profile')
  ) {
    return 2 * 60 * 1000;
  }

  if (
    url.includes('/v1/orders?') ||
    url.endsWith('/v1/orders') ||
    url.includes('/v1/orders/open') ||
    url.includes('/v1/orders/active') ||
    url.includes('/v1/orders/inbox/online') ||
    url.includes('/v1/kitchen/orders')
  ) {
    return 20 * 1000;
  }

  return DEFAULT_CACHE_TTL_MS;
}

function cachedGet(url, config = {}, { forceRefresh = false, ttlMs = getCacheTtlMs(url) } = {}) {
  const requestKey = buildGetRequestKey(url, config);

  if (!forceRefresh) {
    const cachedResponse = responseCache.get(requestKey);
    if (cachedResponse) {
      return Promise.resolve(cachedResponse);
    }
  } else {
    responseCache.invalidatePrefix(requestKey);
  }

  return deduplicator.deduplicate(requestKey, async () => {
    const response = await api.get(url, config);
    responseCache.set(requestKey, response, ttlMs);
    return response;
  });
}

export function invalidateOrderReadCaches({ orderId = '', tableId = '' } = {}) {
  const normalizedOrderId = String(orderId || '').trim();
  const normalizedTableId = String(tableId || '').trim();

  responseCache.clear();
  deduplicator.clear();

  if (normalizedOrderId) {
    responseCache.invalidatePrefix(`GET|/v1/orders/${normalizedOrderId}`);
  }

  if (normalizedTableId) {
    responseCache.invalidatePrefix(`GET|/v1/orders/table/${normalizedTableId}/active`);
  }

  responseCache.invalidatePrefix('GET|/v1/orders');
  responseCache.invalidatePrefix('GET|/v1/tables');
}

export function preloadManagerOrderWorkspace() {
  return Promise.allSettled([
    cachedGet('/v1/restaurants/profile', {}, { ttlMs: 2 * 60 * 1000 }),
    cachedGet('/v1/menu/categories', {}, { ttlMs: 2 * 60 * 1000 }),
    cachedGet('/v1/menu/items', { params: { limit: 300 } }, { ttlMs: 2 * 60 * 1000 }),
    cachedGet('/v1/tables', { params: { limit: 200 } }, { ttlMs: 2 * 60 * 1000 }),
    cachedGet('/v1/orders', { params: { limit: 50, skip: 0 } }, { ttlMs: 20 * 1000 }),
    cachedGet('/v1/orders/open', {}, { ttlMs: 20 * 1000 }),
  ]);
}

export const authAPI = {
  register: (data) => api.post('/v1/auth/register', data),
  login: (email, password, portal = 'admin') => api.post('/v1/auth/login', { email, password, portal }),
  logout: () => api.post('/v1/auth/logout'),
  getCurrentUser: () => cachedGet('/v1/auth/me', {}, { ttlMs: 8 * 1000 }),
  changePassword: async (data) => {
    try {
      return await api.post('/v1/auth/change-password', data);
    } catch (error) {
      if (error?.response?.status !== 404) {
        throw error;
      }

      try {
        return await api.put('/v1/auth/change-password', data);
      } catch (putError) {
        if (putError?.response?.status !== 404) {
          throw putError;
        }
      }

      return await api.post('/v1/auth/password/change', data);
    }
  },
  resetUserPassword: (data) => api.post('/v1/manager/reset-user-password', data),
};

export const restaurantAPI = {
  getProfile: () => cachedGet('/v1/restaurants/profile'),
  updateProfile: (data) => api.put('/v1/restaurants/profile', data),
  updateSettings: (data) => api.put('/v1/restaurants/settings', data),
  updateInvoiceSettings: (data) => api.put('/v1/restaurants/settings/invoice', data),
  getBroadcasts: (params) => cachedGet('/v1/restaurants/broadcasts', { params }),
  createStaff: (data) => api.post('/v1/restaurants/staff', data),
  updateStaff: (staffId, data) => api.put(`/v1/restaurants/staff/${staffId}`, data),
  getStaff: (filtersOrLimit = {}, skip) => {
    const params =
      typeof filtersOrLimit === 'object'
        ? filtersOrLimit
        : { limit: filtersOrLimit, skip };

    return cachedGet('/v1/restaurants/staff', { params });
  },
  deactivateStaff: (staffId) => api.delete(`/v1/restaurants/staff/${staffId}`),
  resetStaffPassword: (staffId, data) => api.put(`/v1/restaurants/staff/${staffId}/reset-password`, data),
  
  // Activity API
  getActivityStaffList: () => cachedGet('/v1/activity/staff'),
  getActivityLogs: (userId) => cachedGet(`/v1/activity/${userId}/logs`),
  getUserActivityInfo: (userId) => cachedGet(`/v1/activity/${userId}/info`),
};

export const menuAPI = {
  getCategories: () => cachedGet('/v1/menu/categories'),
  createCategory: (data) => api.post('/v1/menu/categories', data),
  updateCategory: (categoryId, data) => api.put(`/v1/menu/categories/${categoryId}`, data),
  deleteCategory: (categoryId) => api.delete(`/v1/menu/categories/${categoryId}`),
  bulkUpload: (formData) =>
    api.post('/v1/menu/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  getItems: (filters) => cachedGet('/v1/menu/items', { params: filters }),
  createItem: (data) => api.post('/v1/menu/items', data),
  getItem: (itemId) => cachedGet(`/v1/menu/items/${itemId}`),
  updateItem: (itemId, data) => api.put(`/v1/menu/items/${itemId}`, data),
  deleteItem: (itemId) => api.delete(`/v1/menu/items/${itemId}`),
  toggleAvailability: (itemId, isAvailable) =>
    api.patch(`/v1/menu/items/${itemId}/availability`, { isAvailable }),
};

export const orderAPI = {
  createOrder: (data) => api.post('/v1/orders', data),
  getOrders: (filters, options = {}) => cachedGet('/v1/orders', { params: filters }, options),
  getActiveOrders: () => cachedGet('/v1/orders/active'),
  getOpenBills: (options = {}) => cachedGet('/v1/orders/open', {}, options),
  getOnlineInbox: (filters) => cachedGet('/v1/orders/inbox/online', { params: filters }),
  cancelPendingBills: (data) => api.post('/v1/orders/cancel-pending', data),
  getActiveOrderForTable: (tableId, options = {}) => {
    const token = getCurrentPortalAccessToken();
    const restaurantId = getCurrentRestaurantId();
    return cachedGet(`/v1/orders/table/${tableId}/active`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(restaurantId ? { 'X-Restaurant-Id': restaurantId } : {}),
      },
    }, options);
  },
  getOrder: (orderId, options = {}) => cachedGet(`/v1/orders/${orderId}`, {}, options),
  updateOrder: (orderId, data) => api.put(`/v1/orders/${orderId}`, data),
  approveDiscount: (orderId, data) => api.post(`/v1/orders/${orderId}/discount-approval`, data),
  updateOnlineOrder: (orderId, data) => api.patch(`/v1/orders/${orderId}/online`, data),
  sendToKitchen: (orderId) => api.post(`/v1/orders/${orderId}/send-to-kitchen`),
  settleOrder: (orderId, data) => api.post(`/v1/orders/${orderId}/settle`, data),
  markOrderPaid: (orderId, data) => api.post(`/v1/orders/${orderId}/mark-paid`, data),
  softDeleteOrder: (orderId, data) => {
    // GUARD: Validate orderId exists
    if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
      console.error('[OrderDelete] Invalid orderId:', orderId);
      return Promise.reject(new Error('Order ID is required for deletion'));
    }

    // GUARD: Get token and validate it exists
    const token = getCurrentPortalAccessToken();
    if (!token) {
      console.error('[OrderDelete] Missing authorization token - cannot delete order');
      return Promise.reject(new Error('Authentication token required for order deletion'));
    }

    // DEBUG: Log deletion attempt
    console.log('[OrderDelete] Initiating delete for orderId:', orderId, 'with token:', token.substring(0, 20) + '...[REDACTED]');

    // IMPORTANT: Explicitly include Authorization header to ensure 403 is not due to missing token
    return api.post(`/v1/orders/${orderId}/delete`, data, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
  },
  getLoyaltyProfile: (phone) => cachedGet('/v1/orders/loyalty/profile', { params: { phone } }, { ttlMs: 15 * 1000 }),
  updateStatus: (orderId, data) => api.put(`/v1/orders/${orderId}/status`, data),
  updateKitchenStatus: (orderId, data) => api.patch(`/v1/orders/${orderId}/status`, data),
};

export const kitchenAPI = {
  getActiveOrders: () => cachedGet('/v1/kitchen/orders', {}, { ttlMs: 10 * 1000 }),
  getAllOrders: (filters) => cachedGet('/v1/kitchen/orders/all', { params: filters }, { ttlMs: 10 * 1000 }),
  getOrderDetail: (orderId) => cachedGet(`/v1/kitchen/orders/${orderId}`, {}, { ttlMs: 10 * 1000 }),
  updateStatus: (orderId, ticketId, data) => api.put(`/v1/kitchen/orders/${orderId}/tickets/${ticketId}/status`, data),
  reprintTicket: (orderId, ticketId) => api.post(`/v1/kitchen/orders/${orderId}/tickets/${ticketId}/reprint`),
  refireTicket: (orderId, ticketId) => api.post(`/v1/kitchen/orders/${orderId}/tickets/${ticketId}/refire`),
};

export const tableAPI = {
  getTables: (filters) => cachedGet('/v1/tables', { params: filters }),
  createTable: (data) => api.post('/v1/tables', data),
  createMultipleTables: (data) => api.post('/v1/tables/batch', data),
  updateTable: (tableId, data) => api.put(`/v1/tables/${tableId}`, data),
  claimTable: (tableId) => api.post(`/v1/tables/${tableId}/claim`),
  deleteTable: (tableId) => api.delete(`/v1/tables/${tableId}`),
  reserveTable: (tableId, data) => api.post(`/v1/tables/${tableId}/reserve`, data),
  releaseTable: (tableId) => api.post(`/v1/tables/${tableId}/release`),
  generateQRs: (tableIds) => api.post('/v1/tables/qr/generate', { tableIds }),
};

export const analyticsAPI = {
  getDailySalesReport: (filters) => cachedGet('/v1/analytics/daily-sales', { params: filters }),
  getMonthlySalesReport: (filters) => cachedGet('/v1/analytics/monthly-sales', { params: filters }),
  getTopItems: (filters) => cachedGet('/v1/analytics/top-items', { params: filters }),
  getPeakHours: (date) => cachedGet('/v1/analytics/peak-hours', { params: { date } }),
  getLatestEodSummary: (filters) => cachedGet('/v1/analytics/eod/latest', { params: filters }, { ttlMs: 20 * 1000 }),
  getEodSummaryHistory: (filters) => cachedGet('/v1/analytics/eod/history', { params: filters }),
  getLoyaltySummary: () => cachedGet('/v1/analytics/loyalty'),
};

export const inventoryAPI = {
  getItems: () => cachedGet('/v1/inventory/items'),
  getSummary: () => cachedGet('/v1/inventory/summary'),
  getHistory: (filters) => cachedGet('/v1/inventory/history', { params: filters }),
  createItem: (data) => api.post('/v1/inventory/items', data),
  updateItem: (itemId, data) => api.put(`/v1/inventory/items/${itemId}`, data),
  addStock: (itemId, data) => api.post(`/v1/inventory/items/${itemId}/add-stock`, data),
  adjustStock: (itemId, data) => api.post(`/v1/inventory/items/${itemId}/adjust`, data),
};

export const customerAPI = {
  getPublicMenu: ({ tableNumber, tableId }) => cachedGet('/v1/customer/menu/items', {
    params: {
      ...(tableNumber ? { table: tableNumber } : {}),
      ...(tableId ? { tableId } : {}),
    },
  }, { ttlMs: 60 * 1000 }),
  getMenuByQR: (qrCodeData) => cachedGet(`/v1/customer/menu/${qrCodeData}/items`, {}, { ttlMs: 60 * 1000 }),
  createOrder: (data) => api.post('/v1/customer/orders', data),
  placeOrder: (data) => api.post('/v1/customer/orders', data),
  getOrder: (orderId, tableNumber) => {
    if (!orderId) {
      return Promise.reject(new Error('Order ID is required'));
    }
    return cachedGet(`/v1/customer/orders/${orderId}`, {
      params: tableNumber ? { table: tableNumber } : {},
    });
  },
  getOrderByTable: (tableNumber) => cachedGet(`/v1/customer/orders/table/${tableNumber}`),
};

export const developerAPI = {
  getDashboard: () => cachedGet('/developer/dashboard'),
  getOverview: () => cachedGet('/developer/control-center/overview'),
  getLiveMonitor: () => cachedGet('/developer/control-center/live'),
  getSecurityOverview: () => cachedGet('/developer/control-center/security'),
  getErrorTracking: (params) => cachedGet('/developer/control-center/errors', { params }),
  exportData: (resource) => cachedGet(`/developer/control-center/exports/${resource}`),
  createRestaurant: (data) => api.post('/developer/restaurants', data),
  getRestaurants: (params) => cachedGet('/developer/restaurants', { params }),
  updateRestaurantAccess: (restaurantId, data) => api.patch(`/developer/restaurants/${restaurantId}/access`, data),
  forceLogoutRestaurantUsers: (restaurantId) => api.post(`/developer/restaurants/${restaurantId}/force-logout`),
  getUsers: (params) => cachedGet('/developer/users', { params }),
  updateUserStatus: (userId, data) => api.patch(`/developer/users/${userId}/status`, data),
  updateUserRole: (userId, data) => api.patch(`/developer/users/${userId}/role`, data),
  resetUserPassword: (userId, data) => api.post(`/developer/users/${userId}/reset-password`, data),
  forceLogoutUser: (userId) => api.post(`/developer/users/${userId}/force-logout`),
  getUserLoginHistory: (userId, params) => cachedGet(`/developer/users/${userId}/login-history`, { params }),
  getSystemSettings: () => cachedGet('/developer/settings'),
  updateSystemSettings: (data) => api.put('/developer/settings', data),
  getFeatureFlags: () => cachedGet('/developer/feature-flags'),
  updateMaintenance: (data) => api.put('/developer/settings/maintenance', data),
  updateFeatureFlag: (data) => api.put('/developer/feature-flags', data),
  getAuditLogs: (params) => cachedGet('/developer/audit-logs', { params }),
  getHealth: () => cachedGet('/developer/health', {}, { ttlMs: 10 * 1000 }),
  createBroadcast: (data) => api.post('/developer/broadcasts', data),
};
