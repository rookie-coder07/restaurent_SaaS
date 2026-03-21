import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const getCartItems = (carts, cartKey) => carts[cartKey] || [];

export const useCustomerCartStore = create(
  persist(
    (set, get) => ({
      carts: {},

      addItem: (cartKey, item) =>
        set((state) => {
          const existingItems = getCartItems(state.carts, cartKey);
          const existingItem = existingItems.find((cartItem) => cartItem.id === item.id);

          const nextItems = existingItem
            ? existingItems.map((cartItem) =>
                cartItem.id === item.id
                  ? { ...cartItem, quantity: cartItem.quantity + 1 }
                  : cartItem
              )
            : [...existingItems, { ...item, quantity: 1 }];

          return {
            carts: {
              ...state.carts,
              [cartKey]: nextItems,
            },
          };
        }),

      updateQuantity: (cartKey, itemId, quantity) =>
        set((state) => {
          const existingItems = getCartItems(state.carts, cartKey);
          const nextItems =
            quantity <= 0
              ? existingItems.filter((cartItem) => cartItem.id !== itemId)
              : existingItems.map((cartItem) =>
                  cartItem.id === itemId ? { ...cartItem, quantity } : cartItem
                );

          return {
            carts: {
              ...state.carts,
              [cartKey]: nextItems,
            },
          };
        }),

      clearCart: (cartKey) =>
        set((state) => ({
          carts: {
            ...state.carts,
            [cartKey]: [],
          },
        })),

      removeCart: (cartKey) =>
        set((state) => {
          const nextCarts = { ...state.carts };
          delete nextCarts[cartKey];
          return { carts: nextCarts };
        }),

      getCart: (cartKey) => getCartItems(get().carts, cartKey),
    }),
    {
      name: 'customer-cart-store',
      partialize: (state) => ({ carts: state.carts }),
    }
  )
);
