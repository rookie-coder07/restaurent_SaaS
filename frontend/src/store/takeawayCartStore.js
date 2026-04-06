import { create } from 'zustand';

export const useTakeawayCart = create((set, get) => ({
  categories: [{ id: 'all', name: 'All' }],
  activeCategoryId: 'all',
  items: [],
  cart: [],
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,

  loadCategories: (cats) =>
    set(() => ({
      categories: [{ id: 'all', name: 'All' }, ...cats.map((c) => ({ id: c.id, name: c.name }))],
      activeCategoryId: 'all',
    })),

  hydrateMenu: (items) => set(() => ({ items })),

  setActiveCategory: (id) => set({ activeCategoryId: id }),

  addItem: (item) => {
    const cart = get().cart.slice();
    const existing = cart.find((i) => i.id === item.id);
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ id: item.id, name: item.name, price: item.price, qty: 1 });
    }
    get().recalc(cart);
  },

  decreaseItem: (id) => {
    const cart = get()
      .cart.map((i) => (i.id === id ? { ...i, qty: i.qty - 1 } : i))
      .filter((i) => i.qty > 0);
    get().recalc(cart);
  },

  removeItem: (id) => {
    const cart = get().cart.filter((i) => i.id !== id);
    get().recalc(cart);
  },

  clearCart: () => set({ cart: [], subtotal: 0, discount: 0, tax: 0, total: 0 }),

  recalc: (cart) => {
    const subtotal = cart.reduce((s, i) => s + i.qty * i.price, 0);
    const discount = 0;
    const taxable = subtotal - discount;
    const cgst = taxable * 0.025;
    const sgst = taxable * 0.025;
    const tax = cgst + sgst;
    const total = Math.round(taxable + tax);
    set({ cart, subtotal, discount, tax, total });
  },
}));
