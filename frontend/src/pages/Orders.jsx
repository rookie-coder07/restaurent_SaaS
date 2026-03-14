import { useState } from 'react';
import { useApi } from '../hooks/useApi';
import { orderAPI, menuAPI, tableAPI } from '../services/apiEndpoints';
import { Loader, Download, Plus, X, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

const STATUS_COLORS = {
  pending: 'bg-yellow-100 text-yellow-800',
  preparing: 'bg-blue-100 text-blue-800',
  ready: 'bg-green-100 text-green-800',
  served: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function Orders() {
  const { data: ordersData = {}, loading, execute: refetchOrders } = useApi(() =>
    orderAPI.getOrders({ limit: 100 })
  );

  const { data: itemsData = {} } = useApi(() =>
    menuAPI.getItems({ limit: 100 })
  );

  const { data: tablesData = {} } = useApi(() =>
    tableAPI.getTables({})
  );

  const [filterStatus, setFilterStatus] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');

  const orders = ordersData?.items || [];
  const items = itemsData?.items || [];
  const tables = tablesData?.tables || [];

  const filteredOrders = filterStatus === 'all'
    ? orders
    : orders.filter(order => order.status === filterStatus);

  const handleAddItem = (item) => {
    const existing = selectedItems.find(i => i.id === item.id);
    if (existing) {
      setSelectedItems(selectedItems.map(i =>
        i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
      ));
    } else {
      setSelectedItems([...selectedItems, { ...item, quantity: 1 }]);
    }
  };

  const handleRemoveItem = (itemId) => {
    setSelectedItems(selectedItems.filter(i => i.id !== itemId));
  };

  const handleQuantityChange = (itemId, quantity) => {
    if (quantity <= 0) {
      handleRemoveItem(itemId);
    } else {
      setSelectedItems(selectedItems.map(i =>
        i.id === itemId ? { ...i, quantity } : i
      ));
    }
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!selectedTable) {
        setError('Please select a table');
        setSubmitting(false);
        return;
      }

      if (selectedItems.length === 0) {
        setError('Please add at least one item');
        setSubmitting(false);
        return;
      }

      const orderData = {
        tableId: selectedTable,
        items: selectedItems.map(item => ({
          menuItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        notes: (e.target.specialRequests?.value || '').trim(),
        totalAmount: selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
      };

      await orderAPI.createOrder(orderData);
      setSuccess('Order created successfully');
      setShowCreateForm(false);
      setSelectedItems([]);
      setSelectedTable('');
      await refetchOrders(); // Wait for data to reload
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderAPI.updateStatus(orderId, { status: newStatus });
      setSuccess('Order status updated');
      await refetchOrders(); // Wait for data to reload
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);

  return (
    <div className="space-y-6">
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

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">Total Revenue: {formatCurrency(totalRevenue)}</p>
        </div>
        <div className="flex gap-4">
          <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
            <Download className="w-5 h-5" />
            Export
          </button>
          <button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus className="w-5 h-5" />
            New Order
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="card p-4 space-y-4 md:space-y-0 md:flex md:items-center md:gap-4 md:flex-wrap">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="all">All Orders</option>
            <option value="pending">Pending</option>
            <option value="preparing">Preparing</option>
            <option value="ready">Ready</option>
            <option value="served">Served</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* Orders Table */}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Order ID</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Table</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Items</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Amount</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Time</th>
              <th className="px-6 py-3 text-left font-semibold text-gray-900">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredOrders.map((order) => (
              <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="px-6 py-4 font-mono text-blue-600 text-xs">#{order.id?.slice(-8)}</td>
                <td className="px-6 py-4 font-semibold text-gray-900">{order.tableNumber || 'N/A'}</td>
                <td className="px-6 py-4 text-gray-600">{order.items?.length || 0} items</td>
                <td className="px-6 py-4 font-semibold text-gray-900">{formatCurrency(order.totalAmount || order.total || 0)}</td>
                <td className="px-6 py-4">
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                    className={`px-3 py-1 rounded-full text-xs font-semibold cursor-pointer border-0 ${STATUS_COLORS[order.status]}`}
                  >
                    <option value="pending">Pending</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="served">Served</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-6 py-4 text-gray-600 text-xs">{formatDate(order.createdAt)}</td>
                <td className="px-6 py-4">
                  <button
                    onClick={() => setSelectedOrder(order)}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredOrders.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">No orders found</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-600">Showing {filteredOrders.length} of {orders.length} orders</p>
      </div>

      {/* Create Order Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full my-8">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between sticky top-0 bg-white">
              <h2 className="text-xl font-bold text-gray-900">Create New Order</h2>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setSelectedItems([]);
                  setSelectedTable('');
                  setError(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateOrder} className="p-6 space-y-4 max-h-96 overflow-y-auto">
              {/* Table Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Table *</label>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  required
                >
                  <option value="">Choose a table...</option>
                  {tables.map(table => (
                    <option key={table.id} value={table.id}>
                      Table {table.tableNumber} (Capacity: {table.seatCapacity})
                    </option>
                  ))}
                </select>
              </div>

              {/* Items Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Add Items *</label>
                <div className="border border-gray-200 rounded-lg p-3 max-h-40 overflow-y-auto space-y-2">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                      <div className="flex-1">
                        <p className="font-medium text-sm text-gray-900">{item.name}</p>
                        <p className="text-xs text-gray-600">{formatCurrency(item.price)}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAddItem(item)}
                        className="px-3 py-1 bg-blue-100 text-blue-600 rounded text-sm hover:bg-blue-200"
                      >
                        Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected Items */}
              {selectedItems.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Selected Items</label>
                  <div className="space-y-2 border border-gray-200 rounded-lg p-3">
                    {selectedItems.map(item => (
                      <div key={item.id} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{item.name}</p>
                          <p className="text-xs text-gray-600">{formatCurrency(item.price)} each</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                            className="w-12 px-2 py-1 border border-gray-300 rounded text-center text-sm"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(item.id)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-gray-200 pt-2 mt-2 text-sm font-medium">
                      <p>Total: {formatCurrency(
                        selectedItems.reduce((sum, item) => sum + (item.price * item.quantity), 0)
                      )}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Special Requests */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Special Requests</label>
                <textarea
                  name="specialRequests"
                  placeholder="Any special requests or notes?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm h-16"
                />
              </div>

              <div className="flex gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(false);
                    setSelectedItems([]);
                    setSelectedTable('');
                    setError(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || selectedItems.length === 0}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 font-medium flex items-center justify-center gap-2"
                >
                  {submitting ? <Loader className="w-4 h-4 animate-spin" /> : null}
                  Create Order
                </button>
              </div>
            </form>
          </div>
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
                <p className="text-xs text-gray-500 uppercase tracking-wide">Order ID</p>
                <p className="font-mono text-sm text-gray-900">#{selectedOrder.id?.slice(-8)}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Status</p>
                <p className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[selectedOrder.status]}`}>
                  {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Items</p>
                <div className="space-y-1">
                  {selectedOrder.items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span>{item.quantity}x {item.name}</span>
                      <span className="text-gray-600">{formatCurrency((item.unitPrice || item.price) * item.quantity)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-200 pt-4">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(selectedOrder.totalAmount || selectedOrder.total || 0)}</span>
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide">Time</p>
                <p className="text-sm text-gray-900">{formatDate(selectedOrder.createdAt)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

