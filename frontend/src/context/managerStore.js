import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useAuthStore } from './authStore';

const DEFAULT_DISCOUNT_LIMIT = 15;
const createTenantState = (restaurantId = null) => ({
  restaurantId,
  tableAssignments: {},
  overrideAccess: {},
  tableClosures: {},
  tableTransfers: [],
  tableMerges: [],
  approvedDiscounts: {},
  stockRequests: [],
  prioritizedOrders: {},
  waiterActivity: {},
  discountLimitPercent: DEFAULT_DISCOUNT_LIMIT,
});

export const useManagerStore = create(
  persist(
    (set) => ({
      ...createTenantState(),

      setRestaurantContext: (restaurantId) =>
        set((state) => {
          const normalizedRestaurantId = restaurantId ? String(restaurantId) : null;
          const currentRestaurantId = state.restaurantId ? String(state.restaurantId) : null;

          if (normalizedRestaurantId === currentRestaurantId) {
            return state;
          }

          return {
            ...createTenantState(normalizedRestaurantId),
          };
        }),

      clearTenantState: () =>
        set(() => ({
          ...createTenantState(),
        })),

      assignTable: (tableId, waiterId) =>
        set((state) => ({
          tableAssignments: {
            ...state.tableAssignments,
            [tableId]: waiterId,
          },
        })),

      unassignTable: (tableId) =>
        set((state) => {
          const nextAssignments = { ...state.tableAssignments };
          delete nextAssignments[tableId];

          return {
            tableAssignments: nextAssignments,
          };
        }),

      toggleOverrideAccess: (waiterId) =>
        set((state) => ({
          overrideAccess: {
            ...state.overrideAccess,
            [waiterId]: !state.overrideAccess[waiterId],
          },
        })),

      setOrderPriority: (orderId, priority = 'normal') =>
        set((state) => ({
          prioritizedOrders: {
            ...state.prioritizedOrders,
            [orderId]: {
              priority,
              updatedAt: new Date().toISOString(),
            },
          },
        })),

      logWaiterActivity: ({ waiterId, action, tableId = '', orderId = '' }) =>
        set((state) => ({
          waiterActivity: {
            ...state.waiterActivity,
            [waiterId]: {
              action,
              tableId,
              orderId,
              updatedAt: new Date().toISOString(),
            },
          },
        })),

      setTableClosed: (tableId, closed, note = '') =>
        set((state) => {
          const nextClosures = { ...state.tableClosures };

          if (closed) {
            nextClosures[tableId] = {
              closed: true,
              note,
              updatedAt: new Date().toISOString(),
            };
          } else {
            delete nextClosures[tableId];
          }

          return {
            tableClosures: nextClosures,
          };
        }),

      transferTable: ({ fromTableId, toTableId, fromTableNumber = '', toTableNumber = '', waiterId, note }) =>
        set((state) => {
          const nextAssignments = { ...state.tableAssignments };
          delete nextAssignments[fromTableId];

          if (waiterId) {
            nextAssignments[toTableId] = waiterId;
          }

          return {
            tableAssignments: nextAssignments,
            tableTransfers: [
              {
                id: `transfer-${Date.now()}`,
                fromTableId,
                toTableId,
                fromTableNumber,
                toTableNumber,
                waiterId,
                note,
                createdAt: new Date().toISOString(),
              },
              ...state.tableTransfers,
            ].slice(0, 40),
          };
        }),

      mergeTables: ({ primaryTableId, secondaryTableIds, note }) =>
        set((state) => {
          const nextAssignments = { ...state.tableAssignments };
          (secondaryTableIds || []).forEach((tableId) => {
            delete nextAssignments[tableId];
          });

          return {
            tableAssignments: nextAssignments,
            tableMerges: [
              {
                id: `merge-${Date.now()}`,
                primaryTableId,
                secondaryTableIds,
                note,
                createdAt: new Date().toISOString(),
              },
              ...state.tableMerges,
            ].slice(0, 40),
          };
        }),

      unmergeTables: ({ tableIds = [] }) =>
        set((state) => ({
          tableMerges: (state.tableMerges || []).filter((merge) => {
            const mergeTableIds = [merge.primaryTableId, ...(merge.secondaryTableIds || [])];
            return !mergeTableIds.some((tableId) => tableIds.includes(tableId));
          }),
        })),

      approveDiscount: ({ orderId, percent, note, approvedBy }) =>
        set((state) => ({
          approvedDiscounts: {
            ...state.approvedDiscounts,
            [orderId]: {
              percent,
              note,
              approvedBy,
              approvedAt: new Date().toISOString(),
            },
          },
        })),

      requestStockRefill: ({ itemId, itemName, quantity, note }) =>
        set((state) => ({
          stockRequests: [
            {
              id: `stock-${Date.now()}`,
              itemId,
              itemName,
              quantity,
              note,
              status: 'requested',
              createdAt: new Date().toISOString(),
            },
            ...state.stockRequests,
          ].slice(0, 60),
        })),
    }),
    {
      name: 'manager-ops-store',
      partialize: (state) => ({
        restaurantId: state.restaurantId,
        tableAssignments: state.tableAssignments,
        overrideAccess: state.overrideAccess,
        tableClosures: state.tableClosures,
        tableTransfers: state.tableTransfers,
        tableMerges: state.tableMerges,
        approvedDiscounts: state.approvedDiscounts,
        stockRequests: state.stockRequests,
        prioritizedOrders: state.prioritizedOrders,
        waiterActivity: state.waiterActivity,
        discountLimitPercent: state.discountLimitPercent,
      }),
      merge: (persistedState, currentState) => {
        const currentRestaurantId = useAuthStore.getState().restaurantId
          ? String(useAuthStore.getState().restaurantId)
          : null;
        const persistedRestaurantId = persistedState?.restaurantId
          ? String(persistedState.restaurantId)
          : null;

        if (currentRestaurantId && persistedRestaurantId && currentRestaurantId !== persistedRestaurantId) {
          return {
            ...currentState,
            ...createTenantState(currentRestaurantId),
          };
        }

        const merged = {
          ...currentState,
          ...persistedState,
        };

        Object.keys(merged.tableAssignments || {}).forEach((key) => {
          if (merged.tableAssignments[key] === undefined) {
            delete merged.tableAssignments[key];
          }
        });

        Object.keys(merged.tableClosures || {}).forEach((key) => {
          if (!merged.tableClosures[key]) {
            delete merged.tableClosures[key];
          }
        });

        Object.keys(merged.prioritizedOrders || {}).forEach((key) => {
          if (!merged.prioritizedOrders[key]) {
            delete merged.prioritizedOrders[key];
          }
        });

        return merged;
      },
    }
  )
);
