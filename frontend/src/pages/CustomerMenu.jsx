import { useSearchParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { customerAPI } from '../services/apiEndpoints';
import { ShoppingCart, Plus, Minus, Loader, ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../utils/formatters';

const PRODUCTION_API_BASE_URL = 'https://restaurent-backend-448t.onrender.com/api';
const DEVELOPMENT_API_BASE_URL = 'http://localhost:3000/api';

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

  const [cart, setCart] = useState([]);
  const [showCart, setShowCart] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [orderStatus, setOrderStatus] = useState(null); // 'success', 'error'
  const [orderMessage, setOrderMessage] = useState('');

  console.log('🔍 CustomerMenu loaded - Query params:', Object.fromEntries(searchParams));
  console.log('📊 Table number from QR:', tableNumber);
  console.log('🆔 Table id from QR:', tableId);

  const { data: menuItems = [], loading, error: apiError } = useApi(
    () => (
      hasValidQrParams
        ? customerAPI.getPublicMenu({ tableNumber, tableId })
        : Promise.resolve({ data: { data: [] } })
    ),
    [tableNumber, tableId, hasValidQrParams]
  );

  // Log API errors
  if (apiError) {
    console.error('❌ API Error fetching menu:', apiError);
  }

  if (!tableNumber && !tableId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid QR Code</h1>
          <p className="text-gray-600">Please scan a valid table QR code</p>
        </div>
      </div>
    );
  }

  if (!hasValidQrParams) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid QR Code</h1>
          <p className="text-gray-600">This QR code is missing a valid table reference.</p>
        </div>
      </div>
    );
  }

  const addToCart = (item) => {
    const existing = cart.find(c => c.id === item.id);
    if (existing) {
      setCart(cart.map(c =>
        c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c
      ));
    } else {
      setCart([...cart, { ...item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(c => c.id !== itemId));
  };

  const updateQuantity = (itemId, quantity) => {
    if (quantity <= 0) {
      removeFromCart(itemId);
    } else {
      setCart(cart.map(c =>
        c.id === itemId ? { ...c, quantity } : c
      ));
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      setOrderStatus('error');
      setOrderMessage('Your cart is empty');
      setTimeout(() => setOrderStatus(null), 3000);
      return;
    }

    setIsPlacingOrder(true);
    setOrderStatus(null);

    try {
      const orderData = {
        ...(tableId ? { tableId } : {}),
        ...(tableNumber ? { tableNumber: parsedTableNumber } : {}),
        items: cart.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        totalAmount: cartTotal,
        paymentMethod: 'cash',
        notes: '',
      };

      console.log('📤 Submitting order:', orderData);

      const response = await customerAPI.placeOrder(orderData);
      const createdOrder = response.data?.data;

      console.log('✅ Order placed successfully:', response);

      setOrderStatus('success');
      setOrderMessage('Order placed successfully! The kitchen will start preparing your food.');
      setCart([]);
      setShowCart(false);

      setTimeout(() => {
        navigate(`/order-status?order=${createdOrder?.id}&table=${tableNumber || ''}`);
      }, 3000);
    } catch (error) {
      console.error('❌ Error placing order:', error);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-4" />
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Unable to Load Menu</h1>
          <p className="text-gray-600 mb-4">{apiError}</p>
          <div className="bg-gray-100 p-4 rounded text-left mb-4">
            <p className="text-xs text-gray-600 font-mono break-all">{apiUrl}</p>
          </div>
          <div className="space-x-2">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Retry
            </button>
            <button
              onClick={() => window.location.href = '/'}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Status Messages */}
      {orderStatus === 'success' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center max-w-md w-full">
            <Check className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h2>
            <p className="text-gray-600">{orderMessage}</p>
          </div>
        </div>
      )}

      {orderStatus === 'error' && (
        <div className="fixed top-4 right-4 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3 z-50 max-w-md">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <p className="text-red-700">{orderMessage}</p>
        </div>
      )}

      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Menu</h1>
            <p className="text-sm text-gray-600">Table {tableNumber || 'Guest'}</p>
          </div>
          <button
            onClick={() => setShowCart(!showCart)}
            className="relative p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <ShoppingCart className="w-6 h-6 text-gray-700" />
            {cart.length > 0 && (
              <span className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                {cart.length}
              </span>
            )}
          </button>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {showCart ? (
          <div>
            <button
              onClick={() => setShowCart(false)}
              className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-semibold mb-6"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Menu
            </button>

            {cart.length === 0 ? (
              <div className="text-center py-12">
                <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">Your cart is empty</p>
              </div>
            ) : (
              <div className="space-y-4">
                {cart.map(item => (
                  <div key={item.id} className="bg-white rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900">{item.name}</h3>
                      <p className="text-gray-600">{formatCurrency(item.price)} each</p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-gray-100 rounded-lg">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="p-1 hover:bg-gray-200"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="px-3 font-semibold">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="p-1 hover:bg-gray-200"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="font-semibold text-gray-900 w-20 text-right">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                ))}

                <div className="bg-white rounded-lg p-4 border-t-2 border-gray-200">
                  <div className="flex justify-between items-center mb-4 text-lg font-bold">
                    <span>Total:</span>
                    <span>{formatCurrency(cartTotal)}</span>
                  </div>
                  <button
                    onClick={handlePlaceOrder}
                    disabled={isPlacingOrder || cart.length === 0}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isPlacingOrder ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Placing Order...
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5" />
                        Place Order
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {menuItems?.map(item => (
              <div key={item.id} className="bg-white rounded-lg shadow-soft hover:shadow-md-soft transition overflow-hidden">
                {item.cloudinaryImageUrl && (
                  <img
                    src={item.cloudinaryImageUrl}
                    alt={item.name}
                    className="w-full h-40 object-cover"
                  />
                )}
                <div className="p-4">
                  <h3 className="font-bold text-gray-900 mb-1">{item.name}</h3>
                  <p className="text-gray-600 text-sm mb-3 line-clamp-2">{item.description}</p>
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(item.price)}
                    </span>
                    <button
                      onClick={() => addToCart(item)}
                      disabled={!item.isAvailable}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {menuItems?.length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-600">No menu items are available for this table yet.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
