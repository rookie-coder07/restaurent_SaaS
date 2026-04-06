import api from './api';

export const takeawayApi = {
  fetchCategories: () =>
    api.get('/v1/menu/categories').then((r) => r.data?.data?.categories || []),
  fetchItems: () =>
    api
      .get('/v1/menu/items', { params: { status: 'active', limit: 300 } })
      .then((r) => r.data?.data?.items || []),
  createOrder: (payload) =>
    api.post('/v1/takeaway', payload).then((r) => r.data?.data),
  settleOrder: (orderId, payload) =>
    api.post(`/v1/takeaway/${orderId}/settle`, payload).then((r) => r.data?.data),
};
