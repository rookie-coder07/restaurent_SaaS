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

export default function OrderStatus() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const orderId = searchParams.get('orderId');
  const tableNumber = searchParams.get('table');

  // ✅ FIX 1: Guard against undefined orderId
  if (!orderId) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Invalid Order</h1>
          <p className="text-gray-600 mb-4">Order ID not provided</p>
          <button
            onClick={() => navigate('/menu')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Menu
          </button>
        </div>
      </div>
    );
  }

  // ✅ FIX 2: Stable polling interval state
  const [pollingInterval, setPollingInterval] = useState(null);

  // ✅ FIX 3: Memoize the API function to prevent infinite re-renders
  const fetchOrder = useCallback(() => {
    return customerAPI.getOrder(orderId, tableNumber);
  }, [orderId, tableNumber]);

  const { data: order = {}, loading, error } = useApi(
    fetchOrder,
    [orderId, tableNumber],
    { enableCache: true, cacheTTL: 3000 } // Cache for 3 seconds to avoid duplicate calls
  );

  // ✅ FIX 4: Determine polling interval based on order status
  const effectivePollingInterval = useMemo(() => {
    if (order?.status === 'ready' || order?.status === 'served' || order?.status === 'completed') {
      return 10000; // Slower polling (10s) when order is complete
    }
    return 3000; // Faster polling (3s) while order is being prepared
  }, [order?.status]);

  // ✅ FIX 5: Use effect for polling with proper cleanup and stability
  useEffect(() => {
    let intervalId;
    let isActive = true;

    if (order?.id && effectivePollingInterval) {
      // Set up polling interval
      intervalId = setInterval(async () => {
        if (!isActive) return;
        try {
          await customerAPI.getOrder(orderId, tableNumber);
        } catch (err) {
          // Error handled by useApi hook
        }
      }, effectivePollingInterval);
    }

    return () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [effectivePollingInterval, order?.id, orderId, tableNumber]);

  if (loading && !order?.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading order status...</p>
        </div>
      </div>
    );
  }

  if (error || !order?.id) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Not Found</h1>
          <p className="text-gray-600 mb-4">Unable to load order details</p>
          <button
            onClick={() => navigate('/menu')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Back to Menu
          </button>
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
