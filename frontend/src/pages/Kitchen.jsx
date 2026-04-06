import { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckCircle,
  Clock,
  Loader,
  RefreshCw,
  X,
} from 'lucide-react';
import { usePolling } from '../hooks/usePolling';
import { useOrderSubscription } from '../hooks/useOrderSubscription';
import { useAuthStore } from '../context/authStore';
import { kitchenAPI, orderAPI } from '../services/apiEndpoints';
import { formatCompactTableLabel, formatCurrency, formatDate } from '../utils/formatters';

const POLLING_INTERVAL_MS = 5000;

const STATUS_META = {
  pending: {
    label: 'Pending',
    sectionTitle: 'Pending Orders',
    emptyMessage: 'No pending orders right now.',
    chipClass: 'border-amber-500/20 bg-amber-500/10 text-amber-300',
    accentClass: 'bg-amber-400',
  },
  preparing: {
    label: 'Preparing',
    sectionTitle: 'Preparing Now',
    emptyMessage: 'Nothing is currently being prepared.',
    chipClass: 'border-sky-500/20 bg-sky-500/10 text-sky-300',
    accentClass: 'bg-sky-400',
  },
  ready: {
    label: 'Ready',
    sectionTitle: 'Ready for Pickup',
    emptyMessage: 'No ready orders at the moment.',
    chipClass: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
    accentClass: 'bg-emerald-400',
  },
};

const STATUS_FLOW = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'completed',
};

function getElapsedMinutes(createdAt) {
  const elapsedMs = Date.now() - new Date(createdAt).getTime();
  return Math.max(0, Math.floor(elapsedMs / 1000 / 60));
}

function getStatusIcon(status) {
  switch (status) {
    case 'pending':
      return <AlertCircle className="h-4 w-4" />;
    case 'preparing':
      return <Clock className="h-4 w-4" />;
    case 'ready':
      return <CheckCircle className="h-4 w-4" />;
    default:
      return null;
  }
}

export default function Kitchen() {
  const restaurantId = useAuthStore((state) => state.restaurantId);
  const { data: pollingData, loading, error, refresh } = usePolling(
    orderAPI.getActiveOrders,
    POLLING_INTERVAL_MS
  );
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(null);

  useOrderSubscription(restaurantId, () => {
    refresh();
  });

  const orders = Array.isArray(pollingData) ? pollingData : [];

  const groupedOrders = useMemo(
    () => ({
      pending: orders.filter((order) => order.status === 'pending'),
      preparing: orders.filter((order) => order.status === 'preparing'),
      ready: orders.filter((order) => order.status === 'ready'),
    }),
    [orders]
  );

  const summaryCards = [
    {
      key: 'pending',
      title: 'Pending',
      count: groupedOrders.pending.length,
      valueClass: 'text-amber-600',
    },
    {
      key: 'preparing',
      title: 'Preparing',
      count: groupedOrders.preparing.length,
      valueClass: 'text-sky-600',
    },
    {
      key: 'ready',
      title: 'Ready',
      count: groupedOrders.ready.length,
      valueClass: 'text-emerald-600',
    },
  ];

  const handleStatusUpdate = async (orderId, newStatus) => {
    if (!orderId || !newStatus || updating === orderId) {
      return;
    }

    setUpdating(orderId);
    setActionError(null);

    try {
      await orderAPI.updateKitchenStatus(orderId, { status: newStatus });
      setSuccess(`Order moved to ${newStatus}.`);

      if (selectedOrder?.id === orderId) {
        setSelectedOrder((current) => (current ? { ...current, status: newStatus } : current));
      }

      window.setTimeout(() => setSuccess(null), 2500);
    } catch (err) {
      setActionError(err.response?.data?.message || 'Failed to update order status.');
      window.setTimeout(() => setActionError(null), 3000);
    } finally {
      setUpdating(null);
    }
  };

  const openOrderDetails = async (order) => {
    setSelectedOrder(order);
    setSelectedOrderDetails(order);
    setDetailsLoading(true);
    setActionError(null);

    try {
      const response = await kitchenAPI.getOrderDetail(order.id);
      setSelectedOrderDetails(response.data?.data || order);
    } catch (err) {
      setSelectedOrderDetails(order);
      setActionError(err.response?.data?.message || 'Failed to load kitchen order details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
    setSelectedOrderDetails(null);
    setDetailsLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel rounded-3xl p-5 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[var(--text-secondary)]">Kitchen Control</p>
            <h1 className="mt-2 break-words text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">
              Real-time kitchen dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">
              Track active orders, update status from pending to completed, and keep the line moving with safe 5-second
              polling.
            </p>
          </div>

          <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)] md:w-auto">
            <RefreshCw className="h-4 w-4" />
            Refreshes every 5 seconds
          </div>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {(actionError || error) && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-red-300">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{actionError || error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.key} className="glass-panel rounded-3xl p-5">
            <p className="text-sm font-medium text-[var(--text-secondary)]">{card.title}</p>
            <p className={`mt-3 text-3xl font-bold ${card.valueClass}`}>{card.count}</p>
          </div>
        ))}
      </div>

      {loading && orders.length === 0 ? (
        <div className="glass-panel flex min-h-[280px] items-center justify-center rounded-3xl">
          <div className="text-center">
            <Loader className="mx-auto h-8 w-8 animate-spin text-[var(--color-primary)]" />
            <p className="mt-4 text-sm text-[var(--text-secondary)]">Loading active kitchen orders...</p>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="glass-panel rounded-3xl border-dashed px-6 py-16 text-center">
          <CheckCircle className="mx-auto h-14 w-14 text-emerald-400" />
          <h2 className="mt-4 text-2xl font-semibold text-[var(--text-primary)]">All caught up</h2>
          <p className="mt-2 text-[var(--text-secondary)]">
            There are no pending, preparing, or ready orders right now.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(['pending', 'preparing', 'ready']).map((statusKey) => {
            const statusOrders = groupedOrders[statusKey];
            const meta = STATUS_META[statusKey];

            return (
              <section key={statusKey} className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-bold text-[var(--text-primary)] sm:text-xl">{meta.sectionTitle}</h2>
                    <p className="text-sm text-[var(--text-secondary)]">{statusOrders.length} active orders</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${meta.chipClass}`}>
                    {meta.label}
                  </span>
                </div>

                {statusOrders.length === 0 ? (
                  <div className="glass-panel rounded-3xl border-dashed px-6 py-10 text-center text-sm text-[var(--text-secondary)]">
                    {meta.emptyMessage}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {statusOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        updating={updating}
                        onOpen={() => openOrderDetails(order)}
                        onStatusUpdate={handleStatusUpdate}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <OrderDetailModal
          order={selectedOrder}
          orderDetails={selectedOrderDetails || selectedOrder}
          loadingDetails={detailsLoading}
          updating={updating}
          onClose={closeOrderDetails}
          onStatusUpdate={handleStatusUpdate}
        />
      )}
    </div>
  );
}

function OrderCard({ order, onOpen, onStatusUpdate, updating }) {
  const nextStatus = STATUS_FLOW[order.status];
  const meta = STATUS_META[order.status] || STATUS_META.pending;
  const elapsedTime = getElapsedMinutes(order.createdAt);
  const tableLabel = formatCompactTableLabel(order.tableNumber);
  const nextActionLabel =
    nextStatus === 'preparing'
      ? 'Start Preparing'
      : nextStatus === 'ready'
        ? 'Mark Ready'
        : nextStatus === 'completed'
          ? 'Mark Completed'
          : `Move to ${STATUS_META[nextStatus]?.label || nextStatus}`;

  return (
    <div className="glass-panel overflow-hidden rounded-3xl transition hover:-translate-y-0.5">
      <div className={`h-1.5 w-full ${meta.accentClass}`} />

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Table</p>
            <h3 className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{tableLabel}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDate(order.createdAt)}</p>
          </div>

          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${meta.chipClass}`}>
            {getStatusIcon(order.status)}
            {meta.label}
          </span>
        </div>

        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Items</p>
            <p className="text-xs font-medium text-[var(--text-secondary)]">{order.items?.length || 0} lines</p>
          </div>

          <div className="space-y-2">
            {order.items?.map((item, index) => (
              <div key={`${order.id}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                <p className="min-w-0 flex-1 break-words text-[var(--text-secondary)]">
                  <span className="font-semibold text-[var(--text-primary)]">{item.quantity}x</span> {item.name}
                </p>
                <span className="shrink-0 text-[var(--text-secondary)]">{item.preparationTime || 20} min</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[var(--text-secondary)]">
            <p>{elapsedTime} min elapsed</p>
            <p>Total: {formatCurrency(order.totalAmount || 0)}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onOpen}
              className="rounded-full border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
            >
              View details
            </button>

            {nextStatus && (
              <button
                type="button"
                onClick={() => onStatusUpdate(order.id, nextStatus)}
                disabled={updating === order.id}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updating === order.id ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {updating === order.id ? 'Updating...' : nextActionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, orderDetails, loadingDetails, updating, onClose, onStatusUpdate }) {
  const detailSource = orderDetails || order;
  const nextStatus = STATUS_FLOW[detailSource.status];
  const meta = STATUS_META[detailSource.status] || STATUS_META.pending;
  const tableLabel = formatCompactTableLabel(detailSource.tableNumber);
  const nextActionLabel =
    nextStatus === 'preparing'
      ? 'Start Preparing'
      : nextStatus === 'ready'
        ? 'Mark Ready'
        : nextStatus === 'completed'
          ? 'Mark Completed'
          : `Move to ${STATUS_META[nextStatus]?.label || nextStatus}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-3 sm:items-center sm:justify-center sm:p-4">
      <button type="button" aria-label="Close order details" onClick={onClose} className="absolute inset-0" />

      <div className="glass-panel relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[var(--border-color)] bg-[linear-gradient(135deg,var(--bg-card),var(--bg-card-muted))] px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Order detail</p>
            <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Table {tableLabel}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-4 py-5 sm:px-6 sm:py-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${meta.chipClass}`}>
              {getStatusIcon(order.status)}
              {meta.label}
            </span>
            <p className="text-sm text-[var(--text-secondary)]">{formatDate(detailSource.createdAt)}</p>
          </div>

          {loadingDetails ? (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-8">
              <div className="flex items-center justify-center">
                <Loader className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm font-semibold text-[var(--text-primary)]">Items in this order</p>
              <div className="mt-3 space-y-3">
                {detailSource.items?.map((item, idx) => (
                  <div key={`${order.id}-detail-${idx}`} className="flex items-start justify-between gap-3 border-b border-[var(--border-color)] pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="break-words font-medium text-[var(--text-primary)]">
                        {item.quantity}x {item.name}
                      </p>
                      {item.modifiers?.length ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.modifiers.join(', ')}</p> : null}
                      {item.notes || item.note ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{item.notes || item.note}</p> : null}
                    </div>
                    <span className="shrink-0 text-sm text-[var(--text-secondary)]">{item.preparationTime || 20} min</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Elapsed</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{getElapsedMinutes(detailSource.createdAt)} minutes</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--text-tertiary)]">Total amount</p>
              <p className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{formatCurrency(detailSource.totalAmount || 0)}</p>
            </div>
          </div>

          {detailSource.notes ? (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-300">Special requests</p>
              <p className="mt-2 text-sm leading-6 text-amber-100">{detailSource.notes}</p>
            </div>
          ) : null}

          {nextStatus ? (
            <button
              type="button"
              onClick={() => onStatusUpdate(order.id, nextStatus)}
              disabled={updating === order.id}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--color-primary)] to-[var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {updating === order.id ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {updating === order.id ? 'Updating...' : nextActionLabel}
          </button>
        ) : null}
      </div>
      </div>
    </div>
  );
}
