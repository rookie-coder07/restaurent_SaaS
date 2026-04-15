import { useNavigate, useSearchParams } from 'react-router-dom';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useApi } from '../hooks/useApi';
import { customerAPI } from '../services/apiEndpoints';
import { Clock, Check, AlertCircle, ChefHat, Loader, UserCheck } from 'lucide-react';
import { formatDisplayOrderNumber } from '../utils/formatters';

const STATUS_STEPS = [
  { status: 'awaiting_waiter_approval', label: 'Waiting for Waiter', icon: UserCheck },
  { status: 'pending', label: 'Order Received', icon: Clock },
  { status: 'preparing', label: 'Preparing', icon: ChefHat },
  { status: 'ready', label: 'Ready to Serve', icon: Check },
  { status: 'served', label: 'Completed', icon: Check },
];

function formatStatusLabel(status) {
  if (status === 'awaiting_waiter_approval') {
    return 'Waiting for Waiter';
  }

  if (status === 'completed') {
    return 'Completed';
  }

  return status?.charAt(0).toUpperCase() + status?.slice(1);
}

const TRACKABLE_ORDER_STATUSES = new Set([
  'awaiting_waiter_approval',
  'pending',
  'preparing',
  'ready',
  'served',
  'completed',
]);

export default function OrderStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [orderUnavailable, setOrderUnavailable] = useState(false);
  const [trackedOrderId, setTrackedOrderId] = useState('');
  const [isRecoveringOrder, setIsRecoveringOrder] = useState(false);
  
  // ✅ Extract and validate parameters early (NOT a hook)
  const rawOrderId = searchParams.get('orderId') || searchParams.get('order');
  const tableNumber = searchParams.get('table');
  const orderId = rawOrderId && typeof rawOrderId === 'string' && rawOrderId.trim().length > 0 
    ? rawOrderId.trim() 
    : null;

  useEffect(() => {
    setTrackedOrderId(orderId || '');
    setOrderUnavailable(false);
  }, [orderId]);

  // ✅ CRITICAL: ALL HOOKS DECLARED BEFORE ANY EARLY RETURNS
  // This prevents hook count mismatches between renders
  
  // ✅ FIX 1: Memoize the API function to prevent infinite re-renders
  const fetchOrder = useCallback(() => {
    if (!trackedOrderId) return Promise.resolve({});
    return customerAPI.getOrder(trackedOrderId, tableNumber);
  }, [trackedOrderId, tableNumber]);

  const { data: order = {}, loading, error, refetch } = useApi(
    fetchOrder,
    [trackedOrderId, tableNumber],
    { enableCache: true, cacheTTL: 3000, trackRestaurantContext: false } // Cache for 3 seconds to avoid duplicate calls
  );

  const recoverOrderByTable = useCallback(async () => {
    if (!tableNumber || !trackedOrderId) {
      return null;
    }

    const tableOrdersResponse = await customerAPI.getOrderByTable(tableNumber);
    const tableOrders = Array.isArray(tableOrdersResponse?.data?.data) ? tableOrdersResponse.data.data : [];
    const replacementOrder = tableOrders.find((candidate) => {
      const candidateStatus = String(candidate?.status || '').toLowerCase();
      return candidate?.id && candidate.id !== trackedOrderId && TRACKABLE_ORDER_STATUSES.has(candidateStatus);
    });

    if (!replacementOrder?.id) {
      return null;
    }

    const replacementResponse = await customerAPI.getOrder(replacementOrder.id, tableNumber);
    return replacementResponse?.data?.data || null;
  }, [tableNumber, trackedOrderId]);

  // ✅ FIX 2: Determine polling interval based on order status
  const effectivePollingInterval = useMemo(() => {
    if (order?.status === 'ready' || order?.status === 'served' || order?.status === 'completed') {
      return 10000; // Slower polling (10s) when order is complete
    }
    return 3000; // Faster polling (3s) while order is being prepared
  }, [order?.status]);

  // ✅ FIX 3: Use effect for polling with proper cleanup and stability
  useEffect(() => {
    let intervalId;
    let isActive = true;

    if (order?.id && effectivePollingInterval) {
      // Set up polling interval
      intervalId = setInterval(async () => {
        if (!isActive) return;
        try {
          if (!trackedOrderId) {
            return;
          }

          const latestOrder = await refetch();
          if (!latestOrder?.id && isActive) {
            setOrderUnavailable(true);
          } else if (isActive) {
            setOrderUnavailable(false);
          }
        } catch (err) {
          if (!isActive) {
            return;
          }

          const statusCode = err?.response?.status;
          if (statusCode === 404 || statusCode === 410) {
            setOrderUnavailable(true);
          }
        }
      }, effectivePollingInterval);
    }

    return () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [effectivePollingInterval, order?.id, trackedOrderId, refetch]);

  useEffect(() => {
    let isActive = true;
    const hasMissingOrder = !order?.id;
    const shouldAttemptRecovery =
      !loading &&
      !isRecoveringOrder &&
      Boolean(tableNumber) &&
      Boolean(trackedOrderId) &&
      (orderUnavailable || hasMissingOrder);

    if (!shouldAttemptRecovery) {
      return undefined;
    }

    const recover = async () => {
      try {
        setIsRecoveringOrder(true);
        const recoveredOrder = await recoverOrderByTable();

        if (!isActive) {
          return;
        }

        if (recoveredOrder?.id) {
          setTrackedOrderId(recoveredOrder.id);
          setOrderUnavailable(false);
          navigate(
            `/order-status?orderId=${encodeURIComponent(recoveredOrder.id)}${tableNumber ? `&table=${encodeURIComponent(tableNumber)}` : ''}`,
            { replace: true }
          );
          return;
        }

        setOrderUnavailable(true);
      } catch {
        if (isActive) {
          setOrderUnavailable(true);
        }
      } finally {
        if (isActive) {
          setIsRecoveringOrder(false);
        }
      }
    };

    recover();

    return () => {
      isActive = false;
    };
  }, [isRecoveringOrder, loading, navigate, order?.id, orderUnavailable, recoverOrderByTable, tableNumber, trackedOrderId]);

  // ✅ FIX 4: Log successful order fetch
  useEffect(() => {
    if (order?.id) {
      setOrderUnavailable(false);
      console.log('[ORDER_LOADED] Order successfully fetched', {
        orderId: order.id,
        status: order.status,
        tableNumber: order.tableNumber || tableNumber,
        itemCount: order.items?.length || 0,
      });
    }
  }, [order?.id]);

  // ✅ NOW: Early returns after all hooks are declared

  // ✅ FIX 1: Enhanced guard against undefined orderId with detailed diagnostics
  // NOW PLACED AFTER ALL HOOKS ARE DECLARED
  if (!orderId) {
    const allParams = Array.from(searchParams.entries());
    const urlDebugInfo = {
      currentUrl: window.location.href,
      searchString: window.location.search,
      allParams: allParams.length > 0 ? Object.fromEntries(allParams) : 'NONE',
      paramCount: allParams.length,
      rawOrderId: rawOrderId,
      typeOf: typeof rawOrderId,
    };
    
    console.error('[ORDER_INVALID] Order ID missing from URL', urlDebugInfo);
    
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order ID Not Found</h1>
          <p className="text-gray-600 mb-4">
            Unable to load your order. The order ID was not provided. This usually happens when:
          </p>
          <ul className="text-left text-sm text-gray-600 mb-6 bg-gray-100 rounded-lg p-4 space-y-2">
            <li>• The page was refreshed before the order was fully processed</li>
            <li>• The QR code link was modified</li>
            <li>• The order failed on the backend</li>
          </ul>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/menu')}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Back to Menu
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Retry
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-left text-xs text-gray-700 overflow-auto max-h-40">
              <p className="font-bold mb-2">DEBUG INFO:</p>
              <p className="font-mono break-all">{JSON.stringify(urlDebugInfo, null, 2)}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  if ((loading || isRecoveringOrder) && !order?.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">{isRecoveringOrder ? 'Reconnecting to your live order...' : 'Loading order status...'}</p>
        </div>
      </div>
    );
  }

  if (orderUnavailable) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order No Longer Available</h1>
          <p className="text-gray-600 mb-4">
            This order was removed or cleared by the restaurant, so this status page is no longer active.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => navigate(`/menu${tableNumber ? `?table=${encodeURIComponent(tableNumber)}` : ''}`)}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Back to Menu
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Refresh Status
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !order?.id) {
    console.error('[ORDER_FETCH_ERROR] Failed to fetch order', {
      orderId,
      tableNumber,
      error: error?.message,
      order,
      hasOrderId: !!order?.id,
    });
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-600 mb-4">Unable to load order details. Please try again or contact support if the issue persists.</p>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/menu')}
              className="w-full px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
            >
              Back to Menu
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 font-medium"
            >
              Retry
            </button>
          </div>
          {process.env.NODE_ENV === 'development' && (
            <div className="mt-4 p-3 bg-gray-100 rounded text-left text-xs text-gray-700 overflow-auto max-h-40">
              <p className="font-mono">Error: {error?.message}</p>
              <p className="font-mono">OrderId: {orderId}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const progressStatus = order.status === 'completed' ? 'served' : order.status;
  const currentStepIndex = STATUS_STEPS.findIndex(step => step.status === progressStatus);

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{formatDisplayOrderNumber(order)}</h1>
              <p className="text-gray-600 mt-1">Table {tableNumber}</p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-gray-900">₹{order.totalAmount?.toFixed(2)}</p>
              <p className={`text-sm font-medium mt-1 px-3 py-1 rounded-full inline-block ${
                order.status === 'served' || order.status === 'completed' ? 'bg-green-100 text-green-800' :
                order.status === 'ready' ? 'bg-blue-100 text-blue-800' :
                order.status === 'preparing' ? 'bg-amber-100 text-amber-800' :
                order.status === 'awaiting_waiter_approval' ? 'bg-sky-100 text-sky-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {formatStatusLabel(order.status)}
              </p>
            </div>
          </div>
        </div>

        {/* Order Timeline */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-gray-900 mb-6">Order Progress</h2>
          
          <div className="relative">
            {/* Timeline Line */}
            <div className="absolute left-6 top-0 bottom-0 w-1 bg-gray-200" />

            {/* Timeline Steps */}
            <div className="space-y-6">
              {STATUS_STEPS.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;

                return (
                  <div key={step.status} className="relative pl-20">
                    {/* Icon Circle */}
                    <div className={`absolute left-0 w-12 h-12 rounded-full flex items-center justify-center ${
                      isCompleted ? 'bg-blue-600' : 'bg-gray-200'
                    }`}>
                      <StepIcon className={`w-6 h-6 ${isCompleted ? 'text-white' : 'text-gray-400'}`} />
                    </div>

                    {/* Content */}
                    <div>
                      <h3 className={`font-semibold ${isCompleted ? 'text-gray-900' : 'text-gray-500'}`}>
                        {step.label}
                      </h3>
                      {isCurrent && (
                        <p className="text-sm text-blue-600 mt-1">
                          ⏳ Currently {step.label.toLowerCase()}...
                        </p>
                      )}
                      {isCompleted && index < currentStepIndex && (
                        <p className="text-sm text-green-600 mt-1">✓ Completed</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Items */}
        {order.orderItems && order.orderItems.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="font-semibold text-gray-900 mb-4">Order Items</h2>
            <div className="space-y-3">
              {order.orderItems.map(item => (
                <div key={item.id} className="flex justify-between items-center pb-3 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-gray-900">Item #{item.id?.slice(0, 6)}</p>
                    <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                  </div>
                  <p className="font-semibold text-gray-900">₹{(item.unitPrice * item.quantity).toFixed(2)}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Messages */}
        <div className="space-y-4">
          {(order.status === 'served' || order.status === 'completed') && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Check className="w-6 h-6 text-green-600" />
                <p className="text-green-800 font-medium">Order has been completed! Enjoy your food.</p>
              </div>
            </div>
          )}

          {order.status === 'ready' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <ChefHat className="w-6 h-6 text-blue-600" />
                <p className="text-blue-800 font-medium">Your order is ready! Please collect from the counter.</p>
              </div>
            </div>
          )}

          {order.status === 'preparing' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-amber-600 animate-spin" />
                <p className="text-amber-800 font-medium">Your order is being prepared... Please wait.</p>
              </div>
            </div>
          )}

          {order.status === 'awaiting_waiter_approval' && (
            <div className="bg-sky-50 border border-sky-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <UserCheck className="w-6 h-6 text-sky-600" />
                <p className="text-sky-800 font-medium">Your order has been sent to the waiter for confirmation.</p>
              </div>
            </div>
          )}

          {order.status === 'pending' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6 text-gray-600 animate-pulse" />
                <p className="text-gray-800 font-medium">Your waiter approved the order. Kitchen has received it.</p>
              </div>
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6 border border-gray-100">
          <h3 className="font-semibold text-gray-900 mb-2">Need Help?</h3>
          <p className="text-gray-600 text-sm mb-4">
            For any issues with your order, please notify our staff. You can also check with them directly via the call button at your table.
          </p>
          <button
            onClick={() => window.open('tel:+919999999999')}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium text-sm"
          >
            Contact Staff
          </button>
        </div>
      </div>
    </div>
  );
}
