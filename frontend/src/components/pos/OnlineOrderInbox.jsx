import { memo } from 'react';
import { Clock3, Package2, PhoneCall, RefreshCw, ShoppingBag, Store, Truck } from 'lucide-react';
import { formatCurrency, formatDisplayOrderNumber } from '../../utils/formatters';

const WORKFLOW_ACTIONS = [
  { id: 'accepted', label: 'Accept' },
  { id: 'rejected', label: 'Reject' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'dispatched', label: 'Dispatched' },
];

const SOURCE_META = {
  direct: { label: 'Direct', icon: Store },
  phone: { label: 'Phone', icon: PhoneCall },
  website: { label: 'Website', icon: ShoppingBag },
  swiggy: { label: 'Swiggy', icon: Truck },
  zomato: { label: 'Zomato', icon: Package2 },
};

function formatDateTime(value) {
  if (!value) {
    return 'No promised time';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'No promised time';
  }

  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatWorkflowStatus(value) {
  return String(value || 'new').replace(/_/g, ' ');
}

function OnlineOrderInbox({
  orders,
  loading = false,
  selectedOrderId = '',
  updatingOrderId = '',
  onOpenOrder,
  onCreateOrder,
  onRefresh,
  onUpdateWorkflow,
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">FOH Inbox</p>
          <h2 className="mt-1 text-2xl font-bold text-[var(--text-primary)]">Online Order Queue</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Direct, phone, website, Swiggy, and Zomato orders now stay inside the same POS workspace.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex min-h-[3.25rem] items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={onCreateOrder}
            className="min-h-[3.25rem] rounded-2xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-95"
          >
            New Online Order
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-3 xl:grid-cols-2">
        {orders.length === 0 ? (
          <div className="rounded-[1.6rem] border border-dashed border-[var(--border-color)] bg-[var(--bg-card-muted)] p-6 text-center xl:col-span-2">
            <p className="text-base font-semibold text-[var(--text-primary)]">No online orders in the queue</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">
              Create a manual order here first. Real channel integrations can plug into this same inbox later.
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const source = order.online?.source || 'direct';
            const sourceMeta = SOURCE_META[source] || SOURCE_META.direct;
            const SourceIcon = sourceMeta.icon;
            const isSelected = selectedOrderId === order.id;
            const isUpdating = updatingOrderId === order.id;

            return (
              <article
                key={order.id}
                className={`rounded-[1.6rem] border p-4 transition ${
                  isSelected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-card-muted)]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-card)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-primary)]">
                        <SourceIcon className="h-3.5 w-3.5" />
                        {sourceMeta.label}
                      </span>
                      <span className="rounded-full bg-[var(--bg-card)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-primary)]">
                        {formatWorkflowStatus(order.online?.workflowStatus)}
                      </span>
                    </div>
                    <h3 className="mt-3 text-lg font-bold text-[var(--text-primary)]">
                      {formatDisplayOrderNumber(order)}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {order.orderType === 'delivery' ? 'Delivery' : 'Takeaway'} • {order.items?.length || 0} lines • {formatCurrency(order.totalAmount || 0)}
                    </p>
                    <div className="mt-3 space-y-1 text-sm text-[var(--text-secondary)]">
                      <p className="inline-flex items-center gap-2">
                        <Clock3 className="h-4 w-4" />
                        Promise: <span className="font-semibold text-[var(--text-primary)]">{formatDateTime(order.online?.promisedAt)}</span>
                      </p>
                      <p>
                        Payment: <span className="font-semibold text-[var(--text-primary)]">{order.online?.paymentState || order.paymentStatus || 'pending'}</span>
                      </p>
                      {order.online?.customerName ? (
                        <p>
                          Customer: <span className="font-semibold text-[var(--text-primary)]">{order.online.customerName}</span>
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenOrder(order)}
                    className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
                  >
                    Open
                  </button>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {WORKFLOW_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => onUpdateWorkflow(order, action.id)}
                      disabled={isUpdating || order.online?.workflowStatus === action.id}
                      className="min-h-[3rem] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {isUpdating && updatingOrderId === order.id ? 'Updating...' : action.label}
                    </button>
                  ))}
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

export default memo(OnlineOrderInbox);
