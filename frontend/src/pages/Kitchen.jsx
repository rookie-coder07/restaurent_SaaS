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
import { kitchenAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate } from '../utils/formatters';

const POLLING_INTERVAL_MS = 5000;

const STATUS_META = {
  pending: {
    label: 'Pending',
    sectionTitle: 'Pending Orders',
    emptyMessage: 'No pending orders right now.',
    chipClass: 'border-amber-200 bg-amber-50 text-amber-700',
    accentClass: 'bg-amber-500',
  },
  preparing: {
    label: 'Preparing',
    sectionTitle: 'Preparing Now',
    emptyMessage: 'Nothing is currently being prepared.',
    chipClass: 'border-sky-200 bg-sky-50 text-sky-700',
    accentClass: 'bg-sky-500',
  },
  ready: {
    label: 'Ready',
    sectionTitle: 'Ready for Pickup',
    emptyMessage: 'No ready orders at the moment.',
    chipClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    accentClass: 'bg-emerald-500',
  },
};

const STATUS_FLOW = {
  pending: 'preparing',
  preparing: 'ready',
  ready: 'served',
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
  const { data: pollingData, loading, error } = usePolling(
    kitchenAPI.getActiveOrders,
    POLLING_INTERVAL_MS
  );
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [updating, setUpdating] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [success, setSuccess] = useState(null);

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
      await kitchenAPI.updateStatus(orderId, { status: newStatus });
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

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Kitchen Control</p>
            <h1 className="mt-2 break-words text-2xl font-bold text-slate-900 sm:text-3xl">
              Real-time kitchen dashboard
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Track active orders, update status from pending to served, and keep the line moving with safe 5-second
              polling.
            </p>
          </div>

          <div className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 md:w-auto">
            <RefreshCw className="h-4 w-4" />
            Refreshes every 5 seconds
          </div>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700">
          <CheckCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{success}</p>
        </div>
      )}

      {(actionError || error) && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <p className="text-sm font-medium">{actionError || error}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {summaryCards.map((card) => (
          <div key={card.key} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-slate-500">{card.title}</p>
            <p className={`mt-3 text-3xl font-bold ${card.valueClass}`}>{card.count}</p>
          </div>
        ))}
      </div>

      {loading && orders.length === 0 ? (
        <div className="flex min-h-[280px] items-center justify-center rounded-3xl border border-slate-200 bg-white">
          <div className="text-center">
            <Loader className="mx-auto h-8 w-8 animate-spin text-sky-600" />
            <p className="mt-4 text-sm text-slate-600">Loading active kitchen orders...</p>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center shadow-sm">
          <CheckCircle className="mx-auto h-14 w-14 text-emerald-500" />
          <h2 className="mt-4 text-2xl font-semibold text-slate-900">All caught up</h2>
          <p className="mt-2 text-slate-600">
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
                    <h2 className="text-lg font-bold text-slate-900 sm:text-xl">{meta.sectionTitle}</h2>
                    <p className="text-sm text-slate-500">{statusOrders.length} active orders</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${meta.chipClass}`}>
                    {meta.label}
                  </span>
                </div>

                {statusOrders.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
                    {meta.emptyMessage}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {statusOrders.map((order) => (
                      <OrderCard
                        key={order.id}
                        order={order}
                        updating={updating}
                        onOpen={() => setSelectedOrder(order)}
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
          updating={updating}
          onClose={() => setSelectedOrder(null)}
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

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className={`h-1.5 w-full ${meta.accentClass}`} />

      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Table</p>
            <h3 className="mt-2 text-2xl font-bold text-slate-900">#{order.tableNumber || 'Walk-in'}</h3>
            <p className="mt-1 text-sm text-slate-500">{formatDate(order.createdAt)}</p>
          </div>

          <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-sm font-semibold ${meta.chipClass}`}>
            {getStatusIcon(order.status)}
            {meta.label}
          </span>
        </div>

        <div className="rounded-2xl bg-slate-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-700">Items</p>
            <p className="text-xs font-medium text-slate-500">{order.items?.length || 0} lines</p>
          </div>

          <div className="space-y-2">
            {order.items?.map((item, index) => (
              <div key={`${order.id}-${index}`} className="flex items-start justify-between gap-3 text-sm">
                <p className="min-w-0 flex-1 break-words text-slate-700">
                  <span className="font-semibold text-slate-900">{item.quantity}x</span> {item.name}
                </p>
                <span className="shrink-0 text-slate-500">{item.preparationTime || 20} min</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-slate-500">
            <p>{elapsedTime} min elapsed</p>
            <p>Total: {formatCurrency(order.totalAmount || 0)}</p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={onOpen}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              View details
            </button>

            {nextStatus && (
              <button
                type="button"
                onClick={() => onStatusUpdate(order.id, nextStatus)}
                disabled={updating === order.id}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {updating === order.id ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                {updating === order.id ? 'Updating...' : `Move to ${STATUS_META[nextStatus]?.label || nextStatus}`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderDetailModal({ order, updating, onClose, onStatusUpdate }) {
  const nextStatus = STATUS_FLOW[order.status];
  const meta = STATUS_META[order.status] || STATUS_META.pending;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-3 sm:items-center sm:justify-center sm:p-4">
      <button type="button" aria-label="Close order details" onClick={onClose} className="absolute inset-0" />

      <div className="relative max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Order detail</p>
            <h2 className="mt-1 text-xl font-bold text-slate-900">Table #{order.tableNumber || 'Walk-in'}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
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
            <p className="text-sm text-slate-500">{formatDate(order.createdAt)}</p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-700">Items in this order</p>
            <div className="mt-3 space-y-3">
              {order.items?.map((item, idx) => (
                <div key={`${order.id}-detail-${idx}`} className="flex items-start justify-between gap-3 border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="break-words font-medium text-slate-900">
                      {item.quantity}x {item.name}
                    </p>
                    {item.notes ? <p className="mt-1 text-sm text-slate-500">{item.notes}</p> : null}
                  </div>
                  <span className="shrink-0 text-sm text-slate-500">{item.preparationTime || 20} min</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Elapsed</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{getElapsedMinutes(order.createdAt)} minutes</p>
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Total amount</p>
              <p className="mt-2 text-lg font-semibold text-slate-900">{formatCurrency(order.totalAmount || 0)}</p>
            </div>
          </div>

          {order.notes ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-700">Special requests</p>
              <p className="mt-2 text-sm leading-6 text-amber-900">{order.notes}</p>
            </div>
          ) : null}

          {nextStatus ? (
            <button
              type="button"
              onClick={() => onStatusUpdate(order.id, nextStatus)}
              disabled={updating === order.id}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {updating === order.id ? <Loader className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {updating === order.id ? 'Updating...' : `Move to ${STATUS_META[nextStatus]?.label || nextStatus}`}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
