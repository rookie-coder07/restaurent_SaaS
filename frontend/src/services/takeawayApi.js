import api from './api';
import { menuAPI } from './apiEndpoints';

export const takeawayApi = {
  fetchCategories: () =>
    menuAPI.getCategories().then((r) => r.data?.data?.categories || []),
  fetchItems: () =>
    menuAPI.getItems({ status: 'active', limit: 300 }).then((r) => r.data?.data?.items || []),
  createOrder: (payload) =>
    api.post('/v1/takeaway', payload).then((r) => r.data?.data),
  settleOrder: (orderId, payload) =>
    api.post(`/v1/takeaway/${orderId}/settle`, payload).then((r) => r.data?.data),
};
