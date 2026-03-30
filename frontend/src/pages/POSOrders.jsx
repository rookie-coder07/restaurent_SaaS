import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Loader, RefreshCw, Store, PhoneCall, ShoppingBag, Truck, Package2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { orderAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDisplayOrderNumber } from '../utils/formatters';

const SOURCE_FILTERS = [
  { id: 'all', label: 'All Sources', icon: ShoppingBag },
  { id: 'direct', label: 'Direct', icon: Store },
  { id: 'phone', label: 'Phone', icon: PhoneCall },
  { id: 'website', label: 'Website', icon: ShoppingBag },
  { id: 'swiggy', label: 'Swiggy', icon: Truck },
  { id: 'zomato', label: 'Zomato', icon: Package2 },
];

const WORKFLOW_FILTERS = [
  { id: 'all', label: 'All Statuses' },
  { id: 'new', label: 'New' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'rejected', label: 'Rejected' },
];

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

function formatPromise(value) {
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

export default function POSOrders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [updatingOrderId, setUpdatingOrderId] = useState('');

  const loadOrders = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await orderAPI.getOnlineInbox();
      setOrders(response.data?.data || []);
    } catch (requestError) {
      setOrders([]);
      setError(requestError.response?.data?.message || 'Failed to load the unified online order page.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        const sourceMatches = sourceFilter === 'all' || order.online?.source === sourceFilter;
        const workflowMatches = workflowFilter === 'all' || order.online?.workflowStatus === workflowFilter;
        return sourceMatches && workflowMatches;
      }),
    [orders, sourceFilter, workflowFilter]
  );

  const stats = useMemo(() => {
    return {
      total: filteredOrders.length,
      pending: filteredOrders.filter((order) => ['new', 'accepted', 'preparing'].includes(order.online?.workflowStatus)).length,
      ready: filteredOrders.filter((order) => order.online?.workflowStatus === 'ready').length,
      revenue: filteredOrders.reduce((sum, order) => sum + Number(order.totalAmount || order.total || 0), 0),
    };
  }, [filteredOrders]);

  const handleWorkflowUpdate = async (orderId, workflowStatus) => {
    setUpdatingOrderId(orderId);
    setError('');
    setSuccess('');

    try {
      const response = await orderAPI.updateOnlineOrder(orderId, { workflowStatus });
      const updated = response.data?.data;

      setOrders((current) => current.map((order) => (order.id === orderId ? updated : order)));
      setSuccess(`${formatDisplayOrderNumber(updated)} marked ${workflowStatus}.`);
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to update order workflow.');
    } finally {
      setUpdatingOrderId('');
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-[2rem] border border-[var(--border-color)] bg-[linear-gradient(135deg,var(--color-primary-soft),rgba(255,255,255,0.02))] p-5 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">FOH Orders</p>
            <h1 className="mt-2 text-3xl font-bold text-[var(--text-primary)]">Unified Online Orders</h1>
            <p className="mt-2 max-w-3xl text-sm text-[var(--text-secondary)]">
              One queue for direct, phone, website, Swiggy, and Zomato orders. Open any order in POS to edit items, send to kitchen, or settle.
            </p>
          </div>

          <button
            type="button"
            onClick={loadOrders}
            disabled={loading}
            className="inline-flex min-h-[3.5rem] items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-card-muted)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </section>

      {success ? (
        <section className="rounded-[1.6rem] border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          {success}
        </section>
      ) : null}
      {error ? (
        <section className="rounded-[1.6rem] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {error}
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Visible Orders</p>
          <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">{stats.total}</p>
        </div>
        <div className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">In Progress</p>
          <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">{stats.pending}</p>
        </div>
        <div className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Ready Queue</p>
          <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">{stats.ready}</p>
        </div>
        <div className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Order Value</p>
          <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">{formatCurrency(stats.revenue)}</p>
        </div>
      </div>

      <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Sources</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {SOURCE_FILTERS.map((filter) => {
            const Icon = filter.icon;
            const isActive = sourceFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSourceFilter(filter.id)}
                className={`inline-flex min-h-[3rem] items-center gap-2 rounded-2xl border px-4 text-sm font-semibold transition ${
                  isActive
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-card-muted)] text-[var(--text-primary)] hover:bg-[var(--color-primary-soft)]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {filter.label}
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Workflow</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {WORKFLOW_FILTERS.map((filter) => {
            const isActive = workflowFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setWorkflowFilter(filter.id)}
                className={`min-h-[3rem] rounded-2xl border px-4 text-sm font-semibold transition ${
                  isActive
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'border-[var(--border-color)] bg-[var(--bg-card-muted)] text-[var(--text-primary)] hover:bg-[var(--color-primary-soft)]'
                }`}
              >
                {filter.label}
              </button>
            );
          })}
        </div>
      </section>

      {loading ? (
        <section className="flex min-h-[20rem] items-center justify-center rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-6 shadow-[var(--shadow-card)]">
          <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
        </section>
      ) : filteredOrders.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-[var(--border-color)] bg-[var(--bg-card)] p-8 text-center shadow-[var(--shadow-card)]">
          <p className="text-lg font-bold text-[var(--text-primary)]">No orders match this view</p>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            Try another source or workflow filter, or create a fresh manual online order from the billing screen.
          </p>
        </section>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredOrders.map((order) => {
            const source = order.online?.source || 'direct';
            const sourceMeta = SOURCE_META[source] || SOURCE_META.direct;
            const SourceIcon = sourceMeta.icon;

            return (
              <article
                key={order.id}
                className="rounded-[1.8rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-primary)]">
                        <SourceIcon className="h-3.5 w-3.5" />
                        {sourceMeta.label}
                      </span>
                      <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-amber-300">
                        {String(order.online?.workflowStatus || 'new').replace(/_/g, ' ')}
                      </span>
                    </div>
                    <h2 className="mt-3 text-xl font-black text-[var(--text-primary)]">{formatDisplayOrderNumber(order)}</h2>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      {order.orderType === 'delivery' ? 'Delivery' : 'Takeaway'} • {order.items?.length || 0} lines • {formatCurrency(order.totalAmount || 0)}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/pos?orderId=${order.id}`)}
                    className="inline-flex min-h-[3rem] items-center gap-2 rounded-2xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-95"
                  >
                    Open In POS
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[1.4rem] bg-[var(--bg-card-muted)] px-4 py-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Customer</p>
                    <p className="mt-2 font-semibold text-[var(--text-primary)]">{order.online?.customerName || 'Walk-in / not added'}</p>
                    <p className="mt-1 text-[var(--text-secondary)]">{order.online?.customerPhone || 'No phone added'}</p>
                  </div>
                  <div className="rounded-[1.4rem] bg-[var(--bg-card-muted)] px-4 py-3 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Promise & Payment</p>
                    <p className="mt-2 font-semibold text-[var(--text-primary)]">{formatPromise(order.online?.promisedAt)}</p>
                    <p className="mt-1 text-[var(--text-secondary)]">Channel payment: {order.online?.paymentState || order.paymentStatus || 'pending'}</p>
                  </div>
                </div>

                {order.online?.customerAddress ? (
                  <div className="mt-4 rounded-[1.4rem] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {order.online.customerAddress}
                  </div>
                ) : null}

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {WORKFLOW_ACTIONS.map((action) => (
                    <button
                      key={action.id}
                      type="button"
                      onClick={() => handleWorkflowUpdate(order.id, action.id)}
                      disabled={updatingOrderId === order.id || order.online?.workflowStatus === action.id}
                      className="min-h-[3rem] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updatingOrderId === order.id ? 'Updating...' : action.label}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
