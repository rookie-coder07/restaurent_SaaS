import api from './api.js';
import { getCurrentPortalAccessToken, getCurrentRestaurantId } from './api.js';

export const authAPI = {
  register: (data) => api.post('/v1/auth/register', data),
  login: (email, password, portal = 'admin') => api.post('/v1/auth/login', { email, password, portal }),
  logout: () => api.post('/v1/auth/logout'),
  getCurrentUser: () => api.get('/v1/auth/me'),
  changePassword: (data) => api.post('/v1/auth/change-password', data),
  resetUserPassword: (data) => api.post('/v1/manager/reset-user-password', data),
};

export const restaurantAPI = {
  getProfile: () => api.get('/v1/restaurants/profile'),
  updateProfile: (data) => api.put('/v1/restaurants/profile', data),
  updateSettings: (data) => api.put('/v1/restaurants/settings', data),
  updateInvoiceSettings: (data) => api.put('/v1/restaurants/settings/invoice', data),
  getBroadcasts: (params) => api.get('/v1/restaurants/broadcasts', { params }),
  createStaff: (data) => api.post('/v1/restaurants/staff', data),
  updateStaff: (staffId, data) => api.put(`/v1/restaurants/staff/${staffId}`, data),
  getStaff: (filtersOrLimit = {}, skip) => {
    const params =
      typeof filtersOrLimit === 'object'
        ? filtersOrLimit
        : { limit: filtersOrLimit, skip };

    return api.get('/v1/restaurants/staff', { params });
  },
  deactivateStaff: (staffId) => api.delete(`/v1/restaurants/staff/${staffId}`),
  resetStaffPassword: (staffId, data) => api.put(`/v1/restaurants/staff/${staffId}/reset-password`, data),
  
  // Activity API
  getActivityStaffList: () => api.get('/v1/activity/staff'),
  getActivityLogs: (userId) => api.get(`/v1/activity/${userId}/logs`),
  getUserActivityInfo: (userId) => api.get(`/v1/activity/${userId}/info`),
};

export const menuAPI = {
  getCategories: () => api.get('/v1/menu/categories'),
  createCategory: (data) => api.post('/v1/menu/categories', data),
  updateCategory: (categoryId, data) => api.put(`/v1/menu/categories/${categoryId}`, data),
  deleteCategory: (categoryId) => api.delete(`/v1/menu/categories/${categoryId}`),
  bulkUpload: (formData) =>
    api.post('/v1/menu/bulk-upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }),

  getItems: (filters) => api.get('/v1/menu/items', { params: filters }),
  createItem: (data) => api.post('/v1/menu/items', data),
  getItem: (itemId) => api.get(`/v1/menu/items/${itemId}`),
  updateItem: (itemId, data) => api.put(`/v1/menu/items/${itemId}`, data),
  deleteItem: (itemId) => api.delete(`/v1/menu/items/${itemId}`),
  toggleAvailability: (itemId, isAvailable) =>
    api.patch(`/v1/menu/items/${itemId}/availability`, { isAvailable }),
};

export const orderAPI = {
  createOrder: (data) => api.post('/v1/orders', data),
  getOrders: (filters) => api.get('/v1/orders', { params: filters }),
  getActiveOrders: () => api.get('/v1/orders/active'),
  getOpenBills: () => api.get('/v1/orders/open'),
  getOnlineInbox: (filters) => api.get('/v1/orders/inbox/online', { params: filters }),
  cancelPendingBills: (data) => api.post('/v1/orders/cancel-pending', data),
  getActiveOrderForTable: (tableId) => {
    const token = getCurrentPortalAccessToken();
    const restaurantId = getCurrentRestaurantId();
    return api.get(`/v1/orders/table/${tableId}/active`, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(restaurantId ? { 'X-Restaurant-Id': restaurantId } : {}),
      },
    });
  },
  getOrder: (orderId) => api.get(`/v1/orders/${orderId}`),
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
  getLoyaltyProfile: (phone) => api.get('/v1/orders/loyalty/profile', { params: { phone } }),
  updateStatus: (orderId, data) => api.put(`/v1/orders/${orderId}/status`, data),
  updateKitchenStatus: (orderId, data) => api.patch(`/v1/orders/${orderId}/status`, data),
};

export const kitchenAPI = {
  getActiveOrders: () => api.get('/v1/kitchen/orders'),
  getAllOrders: (filters) => api.get('/v1/kitchen/orders/all', { params: filters }),
  getOrderDetail: (orderId) => api.get(`/v1/kitchen/orders/${orderId}`),
  updateStatus: (orderId, ticketId, data) => api.put(`/v1/kitchen/orders/${orderId}/tickets/${ticketId}/status`, data),
  reprintTicket: (orderId, ticketId) => api.post(`/v1/kitchen/orders/${orderId}/tickets/${ticketId}/reprint`),
  refireTicket: (orderId, ticketId) => api.post(`/v1/kitchen/orders/${orderId}/tickets/${ticketId}/refire`),
};

export const tableAPI = {
  getTables: (filters) => api.get('/v1/tables', { params: filters }),
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
  getDailySalesReport: (filters) => api.get('/v1/analytics/daily-sales', { params: filters }),
  getMonthlySalesReport: (filters) => api.get('/v1/analytics/monthly-sales', { params: filters }),
  getTopItems: (filters) => api.get('/v1/analytics/top-items', { params: filters }),
  getPeakHours: (date) => api.get('/v1/analytics/peak-hours', { params: { date } }),
  getLatestEodSummary: (filters) => api.get('/v1/analytics/eod/latest', { params: filters }),
  getEodSummaryHistory: (filters) => api.get('/v1/analytics/eod/history', { params: filters }),
  getLoyaltySummary: () => api.get('/v1/analytics/loyalty'),
};

export const inventoryAPI = {
  getItems: () => api.get('/v1/inventory/items'),
  getSummary: () => api.get('/v1/inventory/summary'),
  getHistory: (filters) => api.get('/v1/inventory/history', { params: filters }),
  createItem: (data) => api.post('/v1/inventory/items', data),
  updateItem: (itemId, data) => api.put(`/v1/inventory/items/${itemId}`, data),
  addStock: (itemId, data) => api.post(`/v1/inventory/items/${itemId}/add-stock`, data),
  adjustStock: (itemId, data) => api.post(`/v1/inventory/items/${itemId}/adjust`, data),
};

export const customerAPI = {
  getPublicMenu: ({ tableNumber, tableId }) => api.get('/v1/customer/menu/items', {
    params: {
      ...(tableNumber ? { table: tableNumber } : {}),
      ...(tableId ? { tableId } : {}),
    },
  }),
  getMenuByQR: (qrCodeData) => api.get(`/v1/customer/menu/${qrCodeData}/items`),
  createOrder: (data) => api.post('/v1/customer/orders', data),
  placeOrder: (data) => api.post('/v1/customer/orders', data),
  getOrder: (orderId, tableNumber) => {
    if (!orderId) {
      return Promise.reject(new Error('Order ID is required'));
    }
    return api.get(`/v1/customer/orders/${orderId}`, {
      params: tableNumber ? { table: tableNumber } : {},
    });
  },
  getOrderByTable: (tableNumber) => api.get(`/v1/customer/orders/table/${tableNumber}`),
};

export const developerAPI = {
  getDashboard: () => api.get('/v1/developer/dashboard'),
  getOverview: () => api.get('/v1/developer/control-center/overview'),
  getLiveMonitor: () => api.get('/v1/developer/control-center/live'),
  getSecurityOverview: () => api.get('/v1/developer/control-center/security'),
  getErrorTracking: (params) => api.get('/v1/developer/control-center/errors', { params }),
  exportData: (resource) => api.get(`/v1/developer/control-center/exports/${resource}`),
  createRestaurant: (data) => api.post('/v1/developer/restaurants', data),
  getRestaurants: (params) => api.get('/v1/developer/restaurants', { params }),
  updateRestaurantAccess: (restaurantId, data) => api.patch(`/v1/developer/restaurants/${restaurantId}/access`, data),
  forceLogoutRestaurantUsers: (restaurantId) => api.post(`/v1/developer/restaurants/${restaurantId}/force-logout`),
  getUsers: (params) => api.get('/v1/developer/users', { params }),
  updateUserStatus: (userId, data) => api.patch(`/v1/developer/users/${userId}/status`, data),
  updateUserRole: (userId, data) => api.patch(`/v1/developer/users/${userId}/role`, data),
  resetUserPassword: (userId, data) => api.post(`/v1/developer/users/${userId}/reset-password`, data),
  forceLogoutUser: (userId) => api.post(`/v1/developer/users/${userId}/force-logout`),
  getUserLoginHistory: (userId, params) => api.get(`/v1/developer/users/${userId}/login-history`, { params }),
  getSystemSettings: () => api.get('/v1/developer/settings'),
  updateSystemSettings: (data) => api.put('/v1/developer/settings', data),
  getFeatureFlags: () => api.get('/v1/developer/feature-flags'),
  updateMaintenance: (data) => api.put('/v1/developer/settings/maintenance', data),
  updateFeatureFlag: (data) => api.put('/v1/developer/feature-flags', data),
  getAuditLogs: (params) => api.get('/v1/developer/audit-logs', { params }),
  getHealth: () => api.get('/v1/developer/health'),
  createBroadcast: (data) => api.post('/v1/developer/broadcasts', data),
};
