import { create } from 'zustand';
import { menuAPI, orderAPI, tableAPI } from '../services/apiEndpoints';

const CACHE_TTL_MS = 60 * 1000;
const BILLING_TARGET_TTL_MS = 10 * 1000;

const DEFAULT_WORKSPACE = {
  orderType: '',
  selectedTableId: '',
  pinnedOrderId: '',
  cartItems: [],
  discountType: 'flat',
  discountValue: '',
  activeOrder: null,
  paymentMethod: 'cash',
  cashReceived: '',
  paymentNote: '',
  onlineSource: 'direct',
  promisedAt: '',
  onlinePaymentState: 'pending',
  customerName: '',
  customerPhone: '',
  customerAddress: '',
  channelOrderId: '',
};

function isFresh(timestamp) {
  return Number.isFinite(timestamp) && Date.now() - timestamp < CACHE_TTL_MS;
}

export const usePosStore = create((set, get) => ({
  menuItemsData: {},
  categoryData: {},
  tableData: {},
  openBillsData: [],
  onlineInbox: [],
  menuLoading: false,
  categoryLoading: false,
  tableLoading: false,
  openBillsLoading: false,
  onlineInboxLoading: false,
  menuError: '',
  categoryError: '',
  tableError: '',
  openBillsError: '',
  onlineInboxError: '',
  menuLoadedAt: 0,
  categoryLoadedAt: 0,
  tableLoadedAt: 0,
  openBillsLoadedAt: 0,
  onlineInboxLoadedAt: 0,
  currentWorkspace: DEFAULT_WORKSPACE,
  workspaceDrafts: {},
  tableOrderCache: {},
  pendingBillingTarget: null,

  preloadCoreData: async ({ force = false } = {}) => {
    const state = get();
    const requests = [];

    if (force || !isFresh(state.menuLoadedAt) || !(state.menuItemsData?.items || []).length) {
      set({ menuLoading: true, menuError: '' });
      requests.push(
        menuAPI.getItems({ limit: 300 })
          .then((response) => {
            set({
              menuItemsData: response.data?.data || {},
              menuLoadedAt: Date.now(),
              menuError: '',
            });
          })
          .catch((error) => {
            set({ menuError: error.response?.data?.message || error.message || 'Failed to load menu items.' });
          })
          .finally(() => set({ menuLoading: false }))
      );
    }

    if (force || !isFresh(state.categoryLoadedAt) || !(state.categoryData?.categories || []).length) {
      set({ categoryLoading: true, categoryError: '' });
      requests.push(
        menuAPI.getCategories()
          .then((response) => {
            set({
              categoryData: response.data?.data || {},
              categoryLoadedAt: Date.now(),
              categoryError: '',
            });
          })
          .catch((error) => {
            set({ categoryError: error.response?.data?.message || error.message || 'Failed to load categories.' });
          })
          .finally(() => set({ categoryLoading: false }))
      );
    }

    if (force || !isFresh(state.tableLoadedAt) || !(state.tableData?.tables || []).length) {
      set({ tableLoading: true, tableError: '' });
      requests.push(
        tableAPI.getTables({ limit: 200 })
          .then((response) => {
            set({
              tableData: response.data?.data || {},
              tableLoadedAt: Date.now(),
              tableError: '',
            });
          })
          .catch((error) => {
            set({ tableError: error.response?.data?.message || error.message || 'Failed to load tables.' });
          })
          .finally(() => set({ tableLoading: false }))
      );
    }

    await Promise.all(requests);
  },

  refreshTableOverview: async ({ force = false } = {}) => {
    const state = get();
    const requests = [];

    if (force || !isFresh(state.tableLoadedAt) || !(state.tableData?.tables || []).length) {
      set({ tableLoading: true, tableError: '' });
      requests.push(
        tableAPI.getTables({ limit: 200 })
          .then((response) => {
            set({
              tableData: response.data?.data || {},
              tableLoadedAt: Date.now(),
              tableError: '',
            });
          })
          .catch((error) => {
            set({ tableError: error.response?.data?.message || error.message || 'Failed to load tables.' });
          })
          .finally(() => set({ tableLoading: false }))
      );
    }

    if (force || !isFresh(state.openBillsLoadedAt) || !Array.isArray(state.openBillsData)) {
      set({ openBillsLoading: true, openBillsError: '' });
      requests.push(
        orderAPI.getOpenBills()
          .then((response) => {
            set({
              openBillsData: response.data?.data || [],
              openBillsLoadedAt: Date.now(),
              openBillsError: '',
            });
          })
          .catch((error) => {
            set({ openBillsError: error.response?.data?.message || error.message || 'Failed to load open bills.' });
          })
          .finally(() => set({ openBillsLoading: false }))
      );
    }

    await Promise.all(requests);
  },

  refreshOnlineInbox: async ({ force = false } = {}) => {
    const state = get();
    if (!force && isFresh(state.onlineInboxLoadedAt) && Array.isArray(state.onlineInbox)) {
      return;
    }

    set({ onlineInboxLoading: true, onlineInboxError: '' });

    try {
      const response = await orderAPI.getOnlineInbox();
      set({
        onlineInbox: response.data?.data || [],
        onlineInboxLoadedAt: Date.now(),
        onlineInboxError: '',
      });
    } catch (error) {
      set({
        onlineInbox: [],
        onlineInboxError: error.response?.data?.message || error.message || 'Failed to load online order inbox.',
      });
    } finally {
      set({ onlineInboxLoading: false });
    }
  },

  setCurrentWorkspace: (workspace) => set({ currentWorkspace: { ...DEFAULT_WORKSPACE, ...workspace } }),
  resetCurrentWorkspace: () => set({ currentWorkspace: DEFAULT_WORKSPACE }),
  saveWorkspaceDraft: (key, workspace) =>
    set((state) => ({
      workspaceDrafts: {
        ...state.workspaceDrafts,
        [key]: { ...DEFAULT_WORKSPACE, ...workspace },
      },
    })),
  clearWorkspaceDraft: (key) =>
    set((state) => {
      const nextDrafts = { ...state.workspaceDrafts };
      delete nextDrafts[key];
      return { workspaceDrafts: nextDrafts };
    }),
  cacheTableOrder: (tableId, order) =>
    set((state) => ({
      tableOrderCache: {
        ...state.tableOrderCache,
        [tableId]: {
          order: order || null,
          cachedAt: Date.now(),
        },
      },
    })),
  clearTableOrderCache: (tableId) =>
    set((state) => {
      const nextCache = { ...state.tableOrderCache };
      delete nextCache[tableId];
      return { tableOrderCache: nextCache };
    }),
  setPendingBillingTarget: ({ tableId = '', orderId = '' } = {}) =>
    set({
      pendingBillingTarget: {
        tableId,
        orderId,
        createdAt: Date.now(),
      },
    }),
  clearPendingBillingTarget: () => set({ pendingBillingTarget: null }),
  consumePendingBillingTarget: () => {
    const pendingBillingTarget = get().pendingBillingTarget;
    if (!pendingBillingTarget) {
      return null;
    }

    set({ pendingBillingTarget: null });

    if (Date.now() - Number(pendingBillingTarget.createdAt || 0) > BILLING_TARGET_TTL_MS) {
      return null;
    }

    return pendingBillingTarget;
  },
}));

export function getPosWorkspaceDraftKey(orderType, tableId = '') {
  if (orderType === 'dine-in') {
    return tableId ? `dine-in:${tableId}` : 'dine-in:unassigned';
  }

  if (!orderType) {
    return 'idle';
  }

  return `${orderType}:default`;
}
