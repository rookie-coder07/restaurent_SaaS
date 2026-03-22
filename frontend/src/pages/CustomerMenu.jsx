import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Plus,
  Loader,
  Check,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Expand,
  X,
} from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { customerAPI } from '../services/apiEndpoints';
import { formatCurrency } from '../utils/formatters';
import { getMenuItemImageUrl } from '../utils/menuItemImage';
import CartDrawer from '../components/customer/CartDrawer';
import FloatingCartButton from '../components/customer/FloatingCartButton';
import { useCustomerCartStore } from '../context/customerCartStore';

const PRODUCTION_API_BASE_URL = 'https://restaurent-backend-448t.onrender.com/api';
const DEVELOPMENT_API_BASE_URL = 'http://localhost:3000/api';

const ADDED_STATE_TIMEOUT_MS = 1400;

export default function CustomerMenu() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const rawTableNumber = searchParams.get('table');
  const rawTableId = searchParams.get('tableId');
  const tableNumber = rawTableNumber?.trim() || '';
  const tableId = rawTableId?.trim() || '';
  const isValidUuid =
    !tableId || /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(tableId);
  const parsedTableNumber = tableNumber ? Number(tableNumber) : null;
  const isValidTableNumber = !tableNumber || (Number.isInteger(parsedTableNumber) && parsedTableNumber > 0);
  const hasValidQrParams = Boolean(tableNumber || tableId) && isValidUuid && isValidTableNumber;
  const cartKey = tableId || `table-${tableNumber}`;

  const [showCart, setShowCart] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null);
  const [orderMessage, setOrderMessage] = useState('');
  const [recentlyAddedItemId, setRecentlyAddedItemId] = useState(null);
  const [cartToast, setCartToast] = useState('');
  const [blockedItemIds, setBlockedItemIds] = useState({});
  const [previewItem, setPreviewItem] = useState(null);

  const cart = useCustomerCartStore((state) => state.carts[cartKey] || []);
  const addItem = useCustomerCartStore((state) => state.addItem);
  const updateQuantity = useCustomerCartStore((state) => state.updateQuantity);
  const clearCart = useCustomerCartStore((state) => state.clearCart);
  const removeCart = useCustomerCartStore((state) => state.removeCart);

  const { data: menuItems = [], loading, error: apiError } = useApi(
    () => (
      hasValidQrParams
        ? customerAPI.getPublicMenu({ tableNumber, tableId })
        : Promise.resolve({ data: { data: [] } })
    ),
    [tableNumber, tableId, hasValidQrParams]
  );

  const cartItemCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );
  const cartTotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );

  useEffect(() => {
    if (!cartToast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setCartToast(''), ADDED_STATE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [cartToast]);

  useEffect(() => {
    if (!recentlyAddedItemId) {
      return undefined;
    }

    const timer = window.setTimeout(() => setRecentlyAddedItemId(null), ADDED_STATE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [recentlyAddedItemId]);

  useEffect(() => {
    if (cartItemCount === 0) {
      setShowCart(false);
    }
  }, [cartItemCount]);

  useEffect(() => {
    if (!apiError) {
      return;
    }

    console.error('API Error fetching menu:', apiError);
  }, [apiError]);

  if (!tableNumber && !tableId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Invalid QR Code</h1>
          <p className="text-gray-600">Please scan a valid table QR code.</p>
        </div>
      </div>
    );
  }

  if (!hasValidQrParams) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Invalid QR Code</h1>
          <p className="text-gray-600">This QR code is missing a valid table reference.</p>
        </div>
      </div>
    );
  }

  const handleAddToCart = (item) => {
    if (!item.isAvailable || blockedItemIds[item.id]) {
      return;
    }

    addItem(cartKey, {
      id: item.id,
      name: item.name,
      price: item.price,
      description: item.description,
    });

    setRecentlyAddedItemId(item.id);
    setCartToast(`${item.name} added to cart`);
    setBlockedItemIds((current) => ({ ...current, [item.id]: true }));

    window.setTimeout(() => {
      setBlockedItemIds((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
    }, 450);
  };

  const handleUpdateQuantity = (itemId, quantity) => {
    updateQuantity(cartKey, itemId, quantity);
  };

  const handleClearCart = () => {
    clearCart(cartKey);
    setCartToast('Cart cleared');
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
        ...(tableNumber ? { tableNumber: parsedTableNumber } : {}),
        items: cart.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        totalAmount: cartTotal,
        paymentMethod: 'cash',
        notes: '',
      };

      const response = await customerAPI.placeOrder(orderData);
      const createdOrder = response.data?.data;

      setOrderStatus('success');
      setOrderMessage('Order placed successfully! The kitchen will start preparing your food.');
      removeCart(cartKey);
      setShowCart(false);

      window.setTimeout(() => {
        navigate(`/order-status?order=${createdOrder?.id}&table=${tableNumber || ''}`);
      }, 2200);
    } catch (error) {
      setOrderStatus('error');
      setOrderMessage(
        error.response?.data?.message || error.message || 'Failed to place order. Please try again.'
      );
    } finally {
      setIsPlacingOrder(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader className="mx-auto mb-4 h-8 w-8 animate-spin text-blue-600" />
          <p className="text-gray-600">Loading menu...</p>
        </div>
      </div>
    );
  }

  if (apiError) {
    const apiBaseUrl =
      import.meta.env.VITE_API_BASE_URL ||
      import.meta.env.NEXT_PUBLIC_API_URL ||
      (import.meta.env.PROD ? PRODUCTION_API_BASE_URL : DEVELOPMENT_API_BASE_URL);
    const apiUrl = `${apiBaseUrl}/v1/customer/menu/items?table=${tableNumber || ''}${tableId ? `&tableId=${tableId}` : ''}`;

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
        <div className="max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
          <h1 className="mb-2 text-2xl font-bold text-gray-900">Unable to Load Menu</h1>
          <p className="mb-4 text-gray-600">{apiError}</p>
          <div className="mb-4 rounded-2xl bg-gray-100 p-4 text-left">
            <p className="break-all font-mono text-xs text-gray-600">{apiUrl}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="rounded-xl bg-gray-700 px-6 py-2 text-white transition hover:bg-gray-800"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#fef3c7,_#f8fafc_35%,_#f8fafc)] pb-32">
      {orderStatus === 'success' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
            <Check className="mx-auto mb-4 h-12 w-12 text-green-600" />
            <h2 className="mb-2 text-2xl font-bold text-gray-900">Order Confirmed!</h2>
            <p className="text-gray-600">{orderMessage}</p>
          </div>
        </div>
      )}

      {orderStatus === 'error' && (
        <div className="fixed right-4 top-4 z-50 flex max-w-md items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 shadow-lg">
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
          <button
            type="button"
            aria-label="Close image preview"
            onClick={() => setPreviewItem(null)}
            className="absolute inset-0"
          />

          <div className="relative w-full max-w-5xl">
            <button
              type="button"
              onClick={() => setPreviewItem(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/90 p-2 text-slate-700 shadow-lg transition hover:bg-white"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="overflow-hidden rounded-[2rem] bg-white shadow-2xl">
              <div className="flex min-h-[65vh] items-center justify-center bg-gradient-to-br from-slate-100 via-white to-amber-50 p-4 sm:p-6">
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

      <header className="sticky top-0 z-30 border-b border-gray-200/70 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-start justify-between gap-3 px-4 py-4 sm:items-center sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-amber-500">Scan to Order</p>
            <h1 className="mt-1 text-xl font-bold text-gray-900 sm:text-2xl">Menu</h1>
            <p className="break-words text-sm text-gray-600">Table {tableNumber || 'Guest'}</p>
          </div>

          <button
            onClick={() => setShowCart(true)}
            className="relative rounded-full border border-gray-200 bg-white p-3 text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
          >
            <ShoppingCart className="h-6 w-6" />
            {cartItemCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-6 rounded-3xl border border-amber-100 bg-white/80 p-4 shadow-sm sm:mb-8 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Ready when you are</h2>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Add dishes to your cart as you browse. Your order stays saved on this table until you place it.
              </p>
            </div>
          </div>
        </div>

        {menuItems?.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-gray-300 bg-white px-6 py-16 text-center shadow-sm">
            <ShoppingCart className="mx-auto mb-4 h-12 w-12 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-900">No menu items available yet</h2>
            <p className="mt-2 text-gray-500">Please check back in a bit or ask the restaurant staff for help.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 xl:grid-cols-3">
            {menuItems.map((item) => {
              const buttonAdded = recentlyAddedItemId === item.id;
              const buttonBlocked = blockedItemIds[item.id];
              const itemImageUrl = getMenuItemImageUrl(item);

              return (
                <div
                  key={item.id}
                  className="group overflow-hidden rounded-[2rem] border border-gray-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
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
                    className="relative block w-full overflow-hidden bg-slate-100 text-left"
                  >
                    <div className="aspect-[4/3] w-full sm:aspect-[5/4]">
                      <img
                        src={itemImageUrl}
                        alt={item.name}
                        className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      />
                    </div>

                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-slate-950/80 via-slate-950/20 to-transparent px-4 pb-4 pt-12 text-white">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold sm:text-base">{item.name}</p>
                        <p className="text-xs text-white/80">Tap to view full image</p>
                      </div>
                      <span className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                        <Expand className="h-4 w-4" />
                      </span>
                    </div>
                  </button>

                  <div className="p-4 sm:p-5">
                    <div className="flex min-w-0 flex-col gap-3">
                      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-base font-bold text-gray-900 sm:text-lg">{item.name}</h3>
                          <p className="mt-2 break-words text-sm leading-6 text-gray-600">{item.description}</p>
                        </div>
                        <span className="w-fit shrink-0 rounded-full bg-gray-100 px-3 py-1 text-sm font-semibold text-gray-900">
                          {formatCurrency(item.price)}
                        </span>
                      </div>

                      <div className="mt-2 flex flex-col gap-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between">
                        <span className={`text-sm font-medium ${item.isAvailable ? 'text-emerald-600' : 'text-red-500'}`}>
                          {item.isAvailable ? 'Available now' : 'Currently unavailable'}
                        </span>

                        <button
                          onClick={() => handleAddToCart(item)}
                          disabled={!item.isAvailable || buttonBlocked}
                          className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition sm:w-auto sm:min-w-[8.5rem] ${
                            buttonAdded
                              ? 'scale-105 bg-emerald-500 text-white'
                              : 'bg-gray-900 text-white hover:bg-black'
                          } disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500`}
                        >
                          {buttonAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                          {buttonAdded ? 'Added' : 'Add to Cart'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {cartItemCount > 0 && !showCart && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur md:px-6">
          <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900">
                {cartItemCount} {cartItemCount === 1 ? 'item' : 'items'} in cart
              </p>
              <p className="text-sm text-gray-500">{formatCurrency(cartTotal)}</p>
            </div>

            <button
              onClick={() => setShowCart(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 sm:w-auto"
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
