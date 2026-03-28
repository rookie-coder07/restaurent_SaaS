import { useMemo, useState } from 'react';
import { Download, Loader, Plus, ShoppingCart, X } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { orderAPI, menuAPI, tableAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate, formatDisplayOrderNumber } from '../utils/formatters';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import SortDropdown from '../components/common/SortDropdown';

const STATUS_STYLES = {
  pending: 'bg-amber-100 text-amber-700',
  preparing: 'bg-sky-100 text-sky-700',
  ready: 'bg-emerald-100 text-emerald-700',
  served: 'bg-slate-200 text-slate-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
};

function isSettledOrder(order) {
  return order?.status === 'completed' || order?.paymentStatus === 'paid';
}

function formatPaymentMethodLabel(value) {
  return String(value || 'cash').toUpperCase();
}

export default function Orders() {
  const { data: ordersData = {}, loading, execute: refetchOrders } = useApi(() => orderAPI.getOrders({ limit: 100 }));
  const { data: itemsData = {} } = useApi(() => menuAPI.getItems({ limit: 100 }));
  const { data: tablesData = {} } = useApi(() => tableAPI.getTables({}));

  const [filterStatus, setFilterStatus] = useState('all');
  const [sort, setSort] = useState('recent');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedTable, setSelectedTable] = useState('');
  const [showBulkCancelModal, setShowBulkCancelModal] = useState(false);
  const [bulkCancelReason, setBulkCancelReason] = useState('');
  const [isBulkCancelling, setIsBulkCancelling] = useState(false);

  const orders = ordersData?.items || [];
  const items = itemsData?.items || [];
  const tables = tablesData?.tables || [];

  const filteredOrders = useMemo(() => {
    const sortedData = orders.filter((order) => {
      const statusMatch = filterStatus === 'all' || order.status === filterStatus;
      const createdAt = new Date(order.createdAt);
      const startMatch = !dateRange.start || createdAt >= new Date(dateRange.start);
      const endMatch = !dateRange.end || createdAt <= new Date(`${dateRange.end}T23:59:59`);
      return statusMatch && startMatch && endMatch;
    });

    switch (sort) {
      case 'priceLowHigh':
        sortedData.sort((a, b) => (a.totalAmount || a.total || 0) - (b.totalAmount || b.total || 0));
        break;
      case 'priceHighLow':
        sortedData.sort((a, b) => (b.totalAmount || b.total || 0) - (a.totalAmount || a.total || 0));
        break;
      case 'nameAsc':
        sortedData.sort((a, b) => String(a.tableNumber || '').localeCompare(String(b.tableNumber || '')));
        break;
      case 'nameDesc':
        sortedData.sort((a, b) => String(b.tableNumber || '').localeCompare(String(a.tableNumber || '')));
        break;
      case 'recent':
      default:
        sortedData.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        break;
    }

    return sortedData;
  }, [orders, filterStatus, dateRange, sort]);

  const totalRevenue = filteredOrders
    .filter((order) => isSettledOrder(order))
    .reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);

  const handleAddItem = (item) => {
    setSelectedItems((current) => {
      const existing = current.find((candidate) => candidate.id === item.id);
      if (existing) {
        return current.map((candidate) =>
          candidate.id === item.id ? { ...candidate, quantity: candidate.quantity + 1 } : candidate
        );
      }
      return [...current, { ...item, quantity: 1 }];
    });
  };

  const handleRemoveItem = (itemId) => setSelectedItems((current) => current.filter((item) => item.id !== itemId));

  const handleQuantityChange = (itemId, quantity) => {
    if (quantity <= 0) {
      handleRemoveItem(itemId);
      return;
    }

    setSelectedItems((current) =>
      current.map((item) => (item.id === itemId ? { ...item, quantity } : item))
    );
  };

  const resetCreateState = () => {
    setShowCreateForm(false);
    setSelectedItems([]);
    setSelectedTable('');
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!selectedTable) {
        setError('Please select a table');
        return;
      }

      if (selectedItems.length === 0) {
        setError('Please add at least one item');
        return;
      }

      const specialRequests = (e.target.specialRequests?.value || '').trim();
      const orderData = {
        tableId: selectedTable,
        items: selectedItems.map((item) => ({
          menuItemId: item.id,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        totalAmount: selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
      };

      if (specialRequests) {
        orderData.notes = specialRequests;
      }

      await orderAPI.createOrder(orderData);
      setSuccess('Order created successfully');
      resetCreateState();
      await refetchOrders();
      window.setTimeout(() => setSuccess(null), 3000);
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
      await refetchOrders();
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order');
    }
  };

  const handleBulkCancelPendingBills = async () => {
    const trimmedReason = bulkCancelReason.trim();
    if (!trimmedReason) {
      setError('Add a reason before cancelling pending bills.');
      return;
    }

    try {
      setIsBulkCancelling(true);
      setError(null);

      const response = await orderAPI.cancelPendingBills({ reason: trimmedReason });
      const result = response.data?.data || {};

      setShowBulkCancelModal(false);
      setBulkCancelReason('');
      setSuccess(
        result.cancelledCount > 0
          ? `${result.cancelledCount} pending bill${result.cancelledCount === 1 ? '' : 's'} cancelled successfully.`
          : 'No pending bills were available to cancel.'
      );
      await refetchOrders();
      window.setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to cancel pending bills');
    } finally {
      setIsBulkCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.14),_transparent_35%),var(--color-surface)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Orders</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Track live service and manual orders</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Review order history, filter by status, and create a new order directly from the admin panel.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              variant="danger"
              onClick={() => setShowBulkCancelModal(true)}
            >
              Cancel Pending Bills
            </Button>
            <Button variant="secondary">
              <Download className="h-4 w-4" />
              Export
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4" />
              New Order
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Filtered Orders" value={filteredOrders.length} subtitle="Current result set" tone="primary" />
        <StatCard label="Revenue" value={formatCurrency(totalRevenue)} subtitle="Settled sales only" tone="success" />
        <StatCard
          label="Settled"
          value={filteredOrders.filter((order) => isSettledOrder(order)).length}
          subtitle="Bills marked paid"
          tone="neutral"
        />
      </div>

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--color-text)]">Status</span>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="input"
            >
              <option value="all">All Orders</option>
              <option value="pending">Pending</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="served">Served</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </label>

          <Input
            label="From Date"
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
          />

          <Input
            label="To Date"
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
          />
          <SortDropdown
            value={sort}
            onChange={setSort}
            options={[
              { label: 'Table (Low -> High)', value: 'nameAsc' },
              { label: 'Table (High -> Low)', value: 'nameDesc' },
              { label: 'Amount (Low -> High)', value: 'priceLowHigh' },
              { label: 'Amount (High -> Low)', value: 'priceHighLow' },
              { label: 'Recently Added', value: 'recent' },
            ]}
          />
        </div>
      </Card>

      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders found"
          description="Try adjusting the filters or create a new order to get started."
          action={
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="h-4 w-4" />
              Create Order
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <Card key={order.id} className="p-4 sm:p-5">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">
                      {formatDisplayOrderNumber(order)}
                    </p>
                    <h3 className="mt-2 text-lg font-bold text-[var(--color-text)]">Table {order.tableNumber || 'N/A'}</h3>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{formatDate(order.createdAt)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[order.status] || STATUS_STYLES.pending}`}>
                      {order.status}
                    </span>
                    <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                      {formatPaymentMethodLabel(order.paymentMethod)}
                    </span>
                    <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text)]">
                      {order.paymentStatus || 'unpaid'}
                    </span>
                    <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-sm font-semibold text-[var(--color-text)]">
                      {formatCurrency(order.totalAmount || order.total || 0)}
                    </span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Items</p>
                    <p className="text-xs text-[var(--color-text-muted)]">{order.items?.length || 0} lines</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    {(order.items || []).slice(0, 3).map((item, idx) => (
                      <div key={`${order.id}-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                        <p className="min-w-0 flex-1 break-words text-[var(--color-text)]">
                          {item.quantity}x {item.name}
                        </p>
                        <span className="shrink-0 text-[var(--color-text-muted)]">
                          {formatCurrency((item.unitPrice || item.price) * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="space-y-2 sm:max-w-[220px]">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">
                      Update Status
                    </span>
                    <select
                      value={order.status}
                      onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                      disabled={order.status === 'completed' || order.status === 'cancelled'}
                      className="input"
                    >
                      <option value="pending">Pending</option>
                      <option value="preparing">Preparing</option>
                      <option value="ready">Ready</option>
                      <option value="served">Served</option>
                      {order.status === 'completed' ? <option value="completed">Completed</option> : null}
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>

                  <Button variant="secondary" onClick={() => setSelectedOrder(order)}>
                    View Details
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="Create New Order"
        isOpen={showCreateForm}
        onClose={() => {
          resetCreateState();
          setError(null);
        }}
        maxWidth="max-w-3xl"
      >
        <form onSubmit={handleCreateOrder} className="space-y-5">
          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--color-text)]">Select Table</span>
            <select value={selectedTable} onChange={(e) => setSelectedTable(e.target.value)} className="input" required>
              <option value="">Choose a table...</option>
              {tables.map((table) => (
                <option key={table.id} value={table.id}>
                  Table {table.tableNumber} (Capacity: {table.seatCapacity})
                </option>
              ))}
            </select>
          </label>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr,1fr]">
            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--color-text)]">Available Menu Items</p>
              <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-surface-muted)] p-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold text-[var(--color-text)]">{item.name}</p>
                      <p className="text-xs text-[var(--color-text-muted)]">{formatCurrency(item.price)}</p>
                    </div>
                    <Button size="sm" onClick={() => handleAddItem(item)}>
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--color-text)]">Selected Items</p>
              {selectedItems.length === 0 ? (
                <p className="mt-4 text-sm text-[var(--color-text-muted)]">No items added yet.</p>
              ) : (
                <div className="mt-3 space-y-3">
                  {selectedItems.map((item) => (
                    <div key={item.id} className="rounded-2xl bg-[var(--color-surface-muted)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-[var(--color-text)]">{item.name}</p>
                          <p className="text-xs text-[var(--color-text-muted)]">{formatCurrency(item.price)} each</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item.id)}
                          className="rounded-full p-2 text-red-600 transition hover:bg-red-50"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <span className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Qty</span>
                        <input
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => handleQuantityChange(item.id, Number(e.target.value))}
                          className="input max-w-[84px] text-center"
                        />
                      </div>
                    </div>
                  ))}
                  <div className="rounded-2xl border border-[var(--color-border)] p-4">
                    <p className="text-sm font-semibold text-[var(--color-text)]">
                      Total: {formatCurrency(selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0))}
                    </p>
                  </div>
                </div>
              )}
            </Card>
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--color-text)]">Special Requests</span>
            <textarea
              name="specialRequests"
              className="input min-h-[110px] resize-y"
              placeholder="Any special requests or notes?"
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button type="button" variant="secondary" className="w-full sm:flex-1" onClick={resetCreateState}>
              Cancel
            </Button>
            <Button type="submit" className="w-full sm:flex-1" disabled={submitting || selectedItems.length === 0}>
              {submitting ? <Loader className="h-4 w-4 animate-spin" /> : null}
              Create Order
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        title={`Order #${selectedOrder?.id?.slice(-8) || ''}`}
        isOpen={Boolean(selectedOrder)}
        onClose={() => setSelectedOrder(null)}
        maxWidth="max-w-lg"
      >
        {selectedOrder ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[selectedOrder.status] || STATUS_STYLES.pending}`}>
                {selectedOrder.status}
              </span>
              <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                {formatPaymentMethodLabel(selectedOrder.paymentMethod)}
              </span>
              <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text)]">
                {selectedOrder.paymentStatus || 'unpaid'}
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">{formatDate(selectedOrder.createdAt)}</span>
            </div>

            <Card className="p-4">
              <p className="text-sm font-semibold text-[var(--color-text)]">Items</p>
              <div className="mt-3 space-y-3">
                {(selectedOrder.items || []).map((item, idx) => (
                  <div key={`${selectedOrder.id}-detail-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                    <p className="min-w-0 flex-1 break-words text-[var(--color-text)]">
                      {item.quantity}x {item.name}
                    </p>
                    <span className="shrink-0 text-[var(--color-text-muted)]">
                      {formatCurrency((item.unitPrice || item.price) * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="flex items-center justify-between rounded-2xl bg-[var(--color-surface-muted)] p-4">
              <span className="font-semibold text-[var(--color-text)]">Total</span>
              <span className="font-bold text-[var(--color-text)]">
                {formatCurrency(selectedOrder.totalAmount || selectedOrder.total || 0)}
              </span>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        title="Cancel All Pending Bills"
        isOpen={showBulkCancelModal}
        onClose={() => {
          if (isBulkCancelling) {
            return;
          }

          setShowBulkCancelModal(false);
          setBulkCancelReason('');
        }}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
            This will cancel every unpaid bill that is still in the <strong>pending</strong> state for this restaurant.
            Preparing, ready, served, and settled bills will not be touched.
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-[var(--color-text)]">Reason</span>
            <textarea
              value={bulkCancelReason}
              onChange={(event) => setBulkCancelReason(event.target.value)}
              className="input min-h-[110px] resize-y"
              placeholder="Example: day-end cleanup of stale pending bills."
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button
              type="button"
              variant="secondary"
              className="w-full sm:flex-1"
              onClick={() => {
                setShowBulkCancelModal(false);
                setBulkCancelReason('');
              }}
              disabled={isBulkCancelling}
            >
              Keep Bills
            </Button>
            <Button
              type="button"
              variant="danger"
              className="w-full sm:flex-1"
              onClick={handleBulkCancelPendingBills}
              disabled={isBulkCancelling}
            >
              {isBulkCancelling ? 'Cancelling...' : 'Confirm Cancel'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
