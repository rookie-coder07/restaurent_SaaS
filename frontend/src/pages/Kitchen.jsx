import { usePolling } from '../hooks/usePolling';
import { kitchenAPI } from '../services/apiEndpoints';
import { Clock, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useState } from 'react';
import { formatDate } from '../utils/formatters';

export default function Kitchen() {
  const { data: orders = [], loading } = usePolling(kitchenAPI.getActiveOrders, 3000);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'preparing':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'ready':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <AlertCircle className="w-5 h-5" />;
      case 'preparing':
        return <Clock className="w-5 h-5 animate-spin" />;
      case 'ready':
        return <CheckCircle className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getNextStatus = (currentStatus) => {
    const statusFlow = {
      'pending': 'preparing',
      'preparing': 'ready',
      'ready': 'served'
    };
    return statusFlow[currentStatus] || null;
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    setUpdating(orderId);
    try {
      await kitchenAPI.updateStatus(orderId, { status: newStatus });
      setSuccess(`Order moved to ${newStatus}`);
      setTimeout(() => setSuccess(null), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order');
      setTimeout(() => setError(null), 3000);
    } finally {
      setUpdating(null);
    }
  };

  // Categorize orders by status
  const pendingOrders = orders.filter(o => o.status === 'pending');
  const preparingOrders = orders.filter(o => o.status === 'preparing');
  const readyOrders = orders.filter(o => o.status === 'ready');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Kitchen Dashboard</h1>
        <p className="text-gray-600 mt-1">Manage and prepare orders in real-time (Auto-refresh: 3s)</p>
      </div>

      {/* Alerts */}
      {success && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
          <div className="w-2 h-2 bg-green-600 rounded-full"></div>
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}
      
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Status Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-gray-600 text-sm font-medium">Pending</p>
          <p className="text-3xl font-bold text-yellow-600 mt-2">{pendingOrders.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-gray-600 text-sm font-medium">Preparing</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{preparingOrders.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-gray-600 text-sm font-medium">Ready</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{readyOrders.length}</p>
        </div>
      </div>

      {/* Pending Orders */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">🔴 Pending Orders</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pendingOrders.length > 0 ? (
            pendingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusUpdate={handleStatusUpdate}
                onSelect={setSelectedOrder}
                updating={updating}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                getNextStatus={getNextStatus}
              />
            ))
          ) : (
            <div className="col-span-full card text-center py-8 text-gray-600">
              No pending orders
            </div>
          )}
        </div>
      </div>

      {/* Preparing Orders */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">🟠 Preparing Orders</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {preparingOrders.length > 0 ? (
            preparingOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusUpdate={handleStatusUpdate}
                onSelect={setSelectedOrder}
                updating={updating}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                getNextStatus={getNextStatus}
              />
            ))
          ) : (
            <div className="col-span-full card text-center py-8 text-gray-600">
              No orders being prepared
            </div>
          )}
        </div>
      </div>

      {/* Ready Orders */}
      <div>
        <h2 className="text-lg font-bold text-gray-900 mb-4">🟢 Ready for Pickup</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {readyOrders.length > 0 ? (
            readyOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onStatusUpdate={handleStatusUpdate}
                onSelect={setSelectedOrder}
                updating={updating}
                getStatusColor={getStatusColor}
                getStatusIcon={getStatusIcon}
                getNextStatus={getNextStatus}
              />
            ))
          ) : (
            <div className="col-span-full card text-center py-8 text-gray-600">
              No ready orders
            </div>
          )}
        </div>
      </div>

      {/* All Completed */}
      {orders.length === 0 && (
        <div className="card text-center py-16">
          <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
          <p className="text-2xl font-semibold text-gray-900">All orders completed! 🎉</p>
          <p className="text-gray-600 mt-2">No pending, preparing, or ready orders at the moment</p>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Order Details</h2>
              <button
                onClick={() => setSelectedOrder(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Table</p>
                <p className="text-2xl font-bold text-gray-900">#{selectedOrder.tableNumber}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <div className="space-y-2 bg-gray-50 p-3 rounded">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="font-medium">{item.quantity}x {item.name}</span>
                      <span className="text-gray-600">{item.preparationTime || 20} min</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Order Time</p>
                <p className="text-sm text-gray-900">{formatDate(selectedOrder.createdAt)}</p>
              </div>

              {selectedOrder.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Special Requests</p>
                  <p className="text-sm text-gray-900 bg-yellow-50 p-2 rounded">{selectedOrder.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderCard({ order, onStatusUpdate, onSelect, updating, getStatusColor, getStatusIcon, getNextStatus }) {
  const nextStatus = getNextStatus(order.status);
  const elapsedTime = Math.floor((Date.now() - new Date(order.createdAt).getTime()) / 1000 / 60);

  return (
    <div
      onClick={() => onSelect(order)}
      className={`card cursor-pointer border-2 hover:shadow-lg transition ${getStatusColor(order.status)}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm font-medium opacity-75">Table</p>
          <p className="text-3xl font-bold">#{order.tableNumber}</p>
        </div>
        <div className={`px-3 py-2 rounded-full text-sm font-semibold flex items-center gap-1 bg-white ${getStatusColor(order.status).replace('bg-', 'text-')}`}>
          {getStatusIcon(order.status)}
          {order.status.toUpperCase()}
        </div>
      </div>

      {/* Items */}
      <div className={`space-y-2 mb-4 pb-4 border-b border-current border-opacity-20`}>
        <p className="text-sm font-semibold opacity-75">Items:</p>
        {order.items?.map((item, index) => (
          <div key={index} className="text-sm flex justify-between opacity-90">
            <span>{item.quantity}x {item.name}</span>
            <span className="font-medium">{item.preparationTime || 20}m</span>
          </div>
        ))}
      </div>

      {/* Time & Action */}
      <div className="flex items-end justify-between">
        <div className="text-xs opacity-75">
          <p>⏱️ {elapsedTime} min</p>
        </div>
        {nextStatus && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onStatusUpdate(order.id, nextStatus);
            }}
            disabled={updating === order.id}
            className={`px-3 py-1 rounded font-semibold text-xs bg-white ${getStatusColor(order.status).replace('bg-', 'text-')} hover:opacity-80 disabled:opacity-50`}
          >
            {updating === order.id ? 'Updating...' : `→ ${nextStatus.toUpperCase()}`}
          </button>
        )}
      </div>
    </div>
  );
}
