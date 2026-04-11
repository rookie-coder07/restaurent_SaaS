import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ChevronRight,
  Expand,
  Loader,
  Minus,
  Plus,
  ShoppingCart,
  Sparkles,
  Star,
  X,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { API_BASE_URL } from '../config/api';
import { customerAPI } from '../services/apiEndpoints';
import { formatCurrency } from '../utils/formatters';
import { playLoudBuzzer } from '../utils/alerts';
import { getMenuItemImageUrl } from '../utils/menuItemImage';
import CartDrawer from '../components/customer/CartDrawer';
import FloatingCartButton from '../components/customer/FloatingCartButton';
import { useCustomerCartStore } from '../context/customerCartStore';

function buildStableRequestId() {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function CustomerMenu() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawTableNumber = searchParams.get('table');
  const rawTableId = searchParams.get('tableId');
  const tableNumber = rawTableNumber?.trim() || '';
  const tableId = rawTableId?.trim() || '';
  const isValidUuid =
    !tableId || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tableId);
  const isValidTableNumber = !tableNumber || /^[A-Za-z0-9][A-Za-z0-9\s-]*$/.test(tableNumber);
  const hasValidQrParams = Boolean(tableNumber || tableId) && isValidUuid && isValidTableNumber;
  const cartKey = tableId || `table-${tableNumber}`;
  const placeOrderRequestRef = useRef({ id: '', signature: '' });

  const [showCart, setShowCart] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);
  const [orderMessage, setOrderMessage] = useState('');
  const [cartToast, setCartToast] = useState('');
  const [previewItem, setPreviewItem] = useState(null);
  const [activeCategory, setActiveCategory] = useState('all');
  const sectionRefs = useRef({});

  const cart = useCustomerCartStore((state) => state.carts[cartKey] || []);
  const addItem = useCustomerCartStore((state) => state.addItem);
  const updateQuantity = useCustomerCartStore((state) => state.updateQuantity);
  const clearCart = useCustomerCartStore((state) => state.clearCart);
  const removeCart = useCustomerCartStore((state) => state.removeCart);
  const [menuRetryCount, setMenuRetryCount] = useState(0);

  const {
    data: menuData = { restaurantName: 'Restaurant Menu', categories: [], items: [] },
    loading,
    error: apiError,
    refetch,
  } = useApi(
    () =>
      hasValidQrParams
        ? customerAPI.getPublicMenu({ tableNumber, tableId })
        : Promise.resolve({ data: { data: { restaurantName: 'Restaurant Menu', categories: [], items: [] } } }),
    [tableNumber, tableId, hasValidQrParams, menuRetryCount]
  );

  const restaurantName = menuData?.restaurantName || 'Restaurant Menu';
  const categories = Array.isArray(menuData?.categories)
    ? menuData.categories.map((category) => ({
        ...category,
        id: category.id || category._id || category.categoryId || '',
      }))
    : [];
  const menuItems = Array.isArray(menuData?.items)
    ? menuData.items.map((item) => ({
        ...item,
        id: item.id || item._id || '',
        categoryId: item.categoryId || item.category_id || item.category?.id || item.category?._id || '',
      }))
    : Array.isArray(menuData)
      ? menuData.map((item) => ({
          ...item,
          id: item.id || item._id || '',
          categoryId: item.categoryId || item.category_id || item.category?.id || item.category?._id || '',
        }))
      : [];

  const groupedCategories = useMemo(() => {
    const grouped = categories.map((category) => ({
      id: category.id,
      name: category.name,
      items: menuItems.filter((item) => String(item.categoryId || '') === String(category.id || '')),
    }));

    const uncategorizedItems = menuItems.filter((item) => !item.categoryId);
    if (uncategorizedItems.length > 0) {
      grouped.push({
        id: 'uncategorized',
        name: 'Chef Specials',
        items: uncategorizedItems,
      });
    }

    return grouped;
  }, [categories, menuItems]);

  const cartItemCount = useMemo(() => cart.reduce((sum, item) => sum + item.quantity, 0), [cart]);
  const cartTotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart]);
  const cartQuantityByItemId = useMemo(
    () =>
      cart.reduce((accumulator, item) => {
        accumulator[item.id] = item.quantity;
        return accumulator;
      }, {}),
    [cart]
  );

  useEffect(() => {
    if (!cartToast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCartToast(''), 1400);
    return () => window.clearTimeout(timer);
  }, [cartToast]);

  useEffect(() => {
    if (cartItemCount === 0) {
      setShowCart(false);
    }
  }, [cartItemCount]);

  useEffect(() => {
    if (!groupedCategories.length) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntry = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visibleEntry?.target?.id) {
          setActiveCategory(visibleEntry.target.id.replace('category-', ''));
        }
      },
      {
        rootMargin: '-25% 0px -55% 0px',
        threshold: [0.15, 0.3, 0.6],
      }
    );

    groupedCategories.forEach((category) => {
      const element = sectionRefs.current[category.id];
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [groupedCategories]);

  const scrollToCategory = (categoryId) => {
    if (categoryId === 'all') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setActiveCategory('all');
      return;
    }

    const target = sectionRefs.current[categoryId];
    if (!target) {
      return;
    }

    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveCategory(categoryId);
  };

  if (!tableNumber && !tableId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-6 text-[var(--text-primary)]">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h1 className="mb-2 text-2xl font-bold">Invalid QR Code</h1>
          <p className="text-[var(--text-secondary)]">Please scan a valid table QR code.</p>
        </div>
      </div>
    );
  }

  if (!hasValidQrParams) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-6 text-[var(--text-primary)]">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h1 className="mb-2 text-2xl font-bold">Invalid QR Code</h1>
          <p className="text-[var(--text-secondary)]">This QR code is missing a valid table reference.</p>
        </div>
      </div>
    );
  }

  const handleAddToCart = (item) => {
    if (!item.isAvailable) {
      return;
    }

    addItem(cartKey, {
      id: item.id,
      name: item.name,
      price: item.price,
      description: item.description,
    });

    setCartToast(`${item.name} added to cart`);
  };

  const handleUpdateQuantity = (itemId, quantity) => {
    updateQuantity(cartKey, itemId, quantity);
  };

  const handleClearCart = () => {
    clearCart(cartKey);
    setCartToast('Cart cleared');
  };

  const playOrderConfirmationBuzzer = () => {
    playLoudBuzzer('success');
  };

  const handlePlaceOrder = async () => {
    if (cart.length === 0 || isPlacingOrder) {
      return;
    }

    setIsPlacingOrder(true);
    setOrderStatus(null);

    try {
      const orderData = {
        ...(tableId ? { tableId } : {}),
        ...(tableNumber ? { tableNumber } : {}),
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        totalAmount: cartTotal,
        paymentMethod: 'cash',
      };

      const requestSignature = JSON.stringify({
        tableId: orderData.tableId || '',
        tableNumber: orderData.tableNumber || '',
        totalAmount: Number(orderData.totalAmount || 0),
        items: cart
          .map((item) => `${item.id}:${Number(item.quantity || 0)}:${Number(item.price || 0).toFixed(2)}`)
          .sort()
          .join('|'),
      });

      if (placeOrderRequestRef.current.signature !== requestSignature || !placeOrderRequestRef.current.id) {
        placeOrderRequestRef.current = {
          id: buildStableRequestId(),
          signature: requestSignature,
        };
      }

      const response = await customerAPI.placeOrder({
        ...orderData,
        requestId: placeOrderRequestRef.current.id,
      });
      const createdOrder = response.data?.data;
      placeOrderRequestRef.current = { id: '', signature: '' };

      setOrderStatus('success');
      setOrderMessage('Order placed successfully! A waiter will review it shortly before it is sent to the kitchen.');
      playOrderConfirmationBuzzer();
      removeCart(cartKey);
      setShowCart(false);

      window.setTimeout(() => {
        navigate(`/order-status?order=${createdOrder?.id}&table=${tableNumber || ''}`);
      }, 2200);
    } catch (error) {
      const statusCode = error.response?.status;
      const backendMessage = error.response?.data?.message;
      
      console.error('Order placement error:', {
        status: statusCode,
        message: backendMessage,
        details: error.response?.data?.details,
        stack: error.stack,
      });

      // Check for running bill conflict (409)
      const isBusyTableError = statusCode === 409 || /currently busy|running bill|blocked until that bill is cleared/i.test(backendMessage);
      
      if (isBusyTableError) {
        setOrderStatus('error');
        setOrderMessage(backendMessage || 'This table already has a running bill. New QR orders are blocked until that bill is cleared.');
      } else {
        setOrderStatus('error');
        setOrderMessage(backendMessage || error.message || 'Failed to place order. Please try again.');
      }
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)]">
        <div className="text-center text-[var(--text-primary)]">
          <Loader className="mx-auto mb-4 h-8 w-8 animate-spin text-[var(--color-primary)]" />
          <p className="text-[var(--text-secondary)]">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (apiError) {
    const apiUrl = `${API_BASE_URL}/customer/menu/items?table=${tableNumber || ''}${tableId ? `&tableId=${tableId}` : ''}`;
    const isBusyTableError = /currently busy|running bill|blocked until that bill is cleared/i.test(apiError) || apiError?.includes?.('409');

    if (isBusyTableError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-6">
          <div className="glass-panel max-w-md rounded-3xl p-6 text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-amber-400" />
            <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">Table Is Busy</h1>
            <p className="mb-4 text-[var(--text-secondary)]">{apiError}</p>
            <div className="flex flex-wrap justify-center gap-3">
              <button
                onClick={() => {
                  refetch().catch(() => {
                    setMenuRetryCount((current) => current + 1);
                  });
                }}
                className="rounded-xl bg-[var(--color-primary)] px-6 py-2 text-white transition hover:brightness-110"
              >
                Check Again
              </button>
              <button
                onClick={() => navigate('/')}
                className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-2 text-[var(--text-primary)] transition hover:bg-[var(--bg-card-muted)]"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] p-6">
        <div className="glass-panel max-w-md rounded-3xl p-6 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-400" />
          <h1 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">Unable to Load Menu</h1>
          <p className="mb-4 text-[var(--text-secondary)]">{apiError}</p>
          <div className="mb-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4 text-left">
            <p className="break-all font-mono text-xs text-[var(--text-secondary)]">{apiUrl}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => {
                refetch().catch(() => {
                  setMenuRetryCount((current) => current + 1);
                });
              }}
              className="rounded-xl bg-[var(--color-primary)] px-6 py-2 text-white transition hover:brightness-110"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/')}
              className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-6 py-2 text-[var(--text-primary)] transition hover:bg-[var(--bg-card-muted)]"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-main)] pb-32 text-[var(--text-primary)]">
      {orderStatus === 'success' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="glass-panel w-full max-w-md rounded-3xl p-8 text-center">
            <Check className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
            <h2 className="mb-2 text-2xl font-bold text-[var(--text-primary)]">Order Confirmed!</h2>
            <p className="text-[var(--text-secondary)]">{orderMessage}</p>
          </div>
        </div>
      )}

      {orderStatus === 'error' && (
        <div className="fixed right-4 top-4 z-50 flex max-w-md items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300 shadow-lg">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p>{orderMessage}</p>
        </div>
      )}

      {cartToast && (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-lg">
          {cartToast}
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4">
          <button type="button" aria-label="Close image preview" onClick={() => setPreviewItem(null)} className="absolute inset-0" />

          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-700 shadow-lg transition hover:bg-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl">
              <div className="flex min-h-[65vh] items-center justify-center bg-gradient-to-br from-slate-100 via-white to-orange-50 p-4 sm:p-6">
                <img
                  src={previewItem.imageUrl}
                  alt={previewItem.name}
                  className="max-h-[75vh] w-full rounded-[1.5rem] object-contain"
                />
              </div>

              <div className="border-t border-slate-200 px-5 py-4 sm:px-6">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h3 className="break-words text-lg font-bold text-slate-900 sm:text-xl">{previewItem.name}</h3>
                    <p className="mt-1 break-words text-sm leading-6 text-slate-600">{previewItem.description}</p>
                  </div>
                  <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-900">
                    {formatCurrency(previewItem.price)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <CartDrawer
        isOpen={showCart}
        items={cart}
        total={cartTotal}
        isPlacingOrder={isPlacingOrder}
        onClose={() => setShowCart(false)}
        onClearCart={handleClearCart}
        onUpdateQuantity={handleUpdateQuantity}
        onPlaceOrder={handlePlaceOrder}
      />

      {cartItemCount > 0 && !showCart && (
        <FloatingCartButton itemCount={cartItemCount} onClick={() => setShowCart(true)} />
      )}

      <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-panel)_92%,transparent)] backdrop-blur-xl">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[var(--color-warning)]">Scan to Order</p>
              <h1 className="mt-2 break-words text-xl font-bold text-[var(--text-primary)] sm:text-2xl">{restaurantName}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-[var(--text-secondary)]">
                <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-3 py-1">Table {tableNumber || 'Guest'}</span>
                <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-3 py-1">{menuItems.length} dishes</span>
              </div>
            </div>

            <button
              onClick={() => setShowCart(true)}
              className="relative rounded-full border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-3 text-[var(--text-primary)] transition hover:scale-[1.02] hover:bg-[var(--color-primary-soft)]"
            >
              <ShoppingCart className="h-6 w-6" />
              {cartItemCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">
                  {cartItemCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <section className="glass-panel overflow-hidden rounded-[2rem] p-5 sm:p-6">
          <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-orange-400/10 via-cyan-400/10 to-transparent" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-warning)]">
                <Sparkles className="h-3.5 w-3.5" />
                Premium Ordering
              </div>
              <h2 className="mt-4 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">Fresh picks for your table</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
                Discover the menu by category, preview dishes in full view, and add favorites to your cart with one tap.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">Categories</p>
                <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">{groupedCategories.length}</p>
              </div>
              <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3">
                <p className="text-xs uppercase tracking-[0.22em] text-[var(--text-secondary)]">Cart Total</p>
                <p className="mt-2 text-xl font-bold text-[var(--text-primary)]">{formatCurrency(cartTotal)}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="sticky top-[88px] z-20 -mx-4 mt-6 border-y border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-panel)_94%,transparent)] px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <label className="block w-full sm:max-w-xs">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
              Browse Category
            </span>
            <select
              value={activeCategory}
              onChange={(event) => scrollToCategory(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
            >
              <option value="all">All</option>
              {groupedCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        {groupedCategories.length === 0 ? (
          <div className="glass-panel mt-8 rounded-3xl border-dashed px-6 py-16 text-center">
            <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-[var(--text-secondary)]" />
            <h2 className="text-xl font-semibold text-[var(--text-primary)]">No dishes available</h2>
            <p className="mt-2 text-[var(--text-secondary)]">Please check back in a bit or ask the restaurant staff for help.</p>
          </div>
        ) : (
          <div className="mt-8 space-y-10">
            {groupedCategories.map((category) => (
              <section
                key={category.id}
                id={`category-${category.id}`}
                ref={(element) => {
                  sectionRefs.current[category.id] = element;
                }}
                className="scroll-mt-40"
              >
                <div className="mb-4 mt-6 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-medium text-[var(--text-secondary)]">
                      <Star className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                      Featured Category
                    </div>
                    <h2 className="mt-3 text-2xl font-bold text-[var(--text-primary)]">{category.name}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {category.items.length > 0 ? `${category.items.length} dishes available` : 'No items available'}
                    </p>
                  </div>
                  <ChevronRight className="hidden h-6 w-6 text-[var(--text-secondary)] sm:block" />
                </div>

                {category.items.length === 0 ? (
                  <div className="glass-panel rounded-3xl border-dashed px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
                    No dishes available
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {category.items.map((item) => {
                      const itemImageUrl = getMenuItemImageUrl(item);
                      const itemQuantity = cartQuantityByItemId[item.id] || 0;

                      return (
                        <article
                          key={item.id}
                          className="overflow-hidden rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] shadow-md transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-floating)]"
                        >
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewItem({
                                imageUrl: itemImageUrl,
                                name: item.name,
                                description: item.description,
                                price: item.price,
                              })
                            }
                            className="relative block w-full overflow-hidden bg-[var(--bg-card-muted)] text-left"
                          >
                            <div className="aspect-[4/3] w-full">
                              {itemImageUrl ? (
                                <img
                                  src={itemImageUrl}
                                  alt={item.name}
                                  className="h-full w-full object-cover transition duration-500 hover:scale-[1.04]"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center bg-[var(--bg-card-muted)]">
                                  <span className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                                    No Image
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent px-4 pb-4 pt-14">
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                                  <p className="text-xs text-slate-200">Tap to view</p>
                                </div>
                                <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-950/35 text-white backdrop-blur">
                                  <Expand className="h-4 w-4" />
                                </span>
                              </div>
                            </div>
                          </button>

                          <div className="p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <h3 className="break-words text-lg font-bold text-[var(--text-primary)]">{item.name}</h3>
                                {item.description ? (
                                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">
                                    {item.description}
                                  </p>
                                ) : null}
                              </div>
                              <span className="shrink-0 rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-sm font-semibold text-[var(--text-primary)]">
                                {formatCurrency(item.price)}
                              </span>
                            </div>

                            <div className="mt-4 flex items-center justify-between gap-3">
                              <span
                                className="text-sm font-medium"
                                style={{ color: item.isAvailable ? 'var(--color-success)' : 'var(--color-danger)' }}
                              >
                                {item.isAvailable ? 'Available now' : 'Unavailable'}
                              </span>
                              {itemQuantity > 0 ? (
                                <div className="inline-flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] shadow-sm">
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateQuantity(item.id, itemQuantity - 1)}
                                    className="rounded-full p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]"
                                    aria-label={`Decrease quantity for ${item.name}`}
                                  >
                                    <Minus className="h-4 w-4" />
                                  </button>
                                  <span className="min-w-10 text-center text-sm font-semibold text-[var(--text-primary)]">
                                    {itemQuantity}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => handleAddToCart(item)}
                                    disabled={!item.isAvailable}
                                    className="rounded-full p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-50"
                                    aria-label={`Increase quantity for ${item.name}`}
                                  >
                                    <Plus className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => handleAddToCart(item)}
                                  disabled={!item.isAvailable}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-3 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <Plus className="h-4 w-4" />
                                  Add
                                </button>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </div>

      {cartItemCount > 0 && !showCart && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-color)] bg-[color-mix(in_srgb,var(--bg-panel)_96%,transparent)] px-4 py-3 backdrop-blur-xl md:px-6">
          <div className="mx-auto flex max-w-6xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[var(--text-primary)]">
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in cart
              </p>
              <p className="text-sm text-[var(--text-secondary)]">{formatCurrency(cartTotal)}</p>
            </div>

            <button
              onClick={() => setShowCart(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
            >
              Proceed to Order
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
