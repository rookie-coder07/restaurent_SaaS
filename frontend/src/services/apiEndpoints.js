import api from './api.js';

export const authAPI = {
  register: (data) => api.post('/v1/auth/register', data),
  login: (email, password) => api.post('/v1/auth/login', { email, password }),
  staffLogin: (email, password) => api.post('/v1/auth/staff/login', { email, password }),
  logout: () => api.post('/v1/auth/logout'),
  getCurrentUser: () => api.get('/v1/auth/me'),
  changePassword: (data) => api.post('/v1/auth/change-password', data),
};

export const restaurantAPI = {
  getProfile: () => api.get('/v1/restaurants/profile'),
  updateProfile: (data) => api.put('/v1/restaurants/profile', data),
  updateSettings: (data) => api.put('/v1/restaurants/settings', data),
  createStaff: (data) => api.post('/v1/restaurants/staff', data),
  getStaff: (filtersOrLimit = {}, skip) => {
    const params =
      typeof filtersOrLimit === 'object'
        ? filtersOrLimit
        : { limit: filtersOrLimit, skip };

    return api.get('/v1/restaurants/staff', { params });
  },
  deactivateStaff: (staffId) => api.delete(`/v1/restaurants/staff/${staffId}`),
};

export const menuAPI = {
  getCategories: () => api.get('/v1/menu/categories'),
  createCategory: (data) => api.post('/v1/menu/categories', data),
  updateCategory: (categoryId, data) => api.put(`/v1/menu/categories/${categoryId}`, data),
  deleteCategory: (categoryId) => api.delete(`/v1/menu/categories/${categoryId}`),

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
  cancelPendingBills: (data) => api.post('/v1/orders/cancel-pending', data),
  getActiveOrderForTable: (tableId) => api.get(`/v1/orders/table/${tableId}/active`),
  getOrder: (orderId) => api.get(`/v1/orders/${orderId}`),
  updateOrder: (orderId, data) => api.put(`/v1/orders/${orderId}`, data),
  sendToKitchen: (orderId) => api.post(`/v1/orders/${orderId}/send-to-kitchen`),
  settleOrder: (orderId, data) => api.post(`/v1/orders/${orderId}/settle`, data),
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
  getOrder: (orderId, tableNumber) => api.get(`/v1/customer/orders/${orderId}`, {
    params: tableNumber ? { table: tableNumber } : {},
  }),
  getOrderByTable: (tableNumber) => api.get(`/v1/customer/orders/table/${tableNumber}`),
};
