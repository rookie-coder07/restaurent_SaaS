import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Loader, RefreshCw, Store, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../context/authStore';
import { authAPI, orderAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDisplayOrderNumber } from '../utils/formatters';
import { playLoudBuzzer } from '../utils/alerts';
import { subscribeToOrderEvents } from '../utils/liveOrderEvents';
import { useOrderSubscription } from '../hooks/useOrderSubscription';
import { syncPortalSessionUser } from '../utils/sessionUserSync';
import Toast from '../components/common/Toast';

const WORKFLOW_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'preparing', label: 'Preparing' },
  { id: 'ready', label: 'Ready' },
  { id: 'completed', label: 'Completed' },
];

const SOURCE_FILTERS = [
  { id: 'all', label: 'All Orders' },
  { id: 'qr', label: 'QR Orders' },
  { id: 'manual', label: 'Manual POS' },
];

const SOURCE_META = {
  direct: { label: 'Direct', icon: Store },
  pos: { label: 'POS Order', icon: Store },
  qr: { label: 'QR Order', icon: ShoppingBag },
};

const STATUS_META = {
  awaiting_waiter_approval: 'border-sky-300 bg-sky-50 text-sky-900',
  pending: 'border-amber-300 bg-amber-50 text-amber-900',
  accepted: 'border-indigo-300 bg-indigo-50 text-indigo-900',
  preparing: 'border-violet-300 bg-violet-50 text-violet-900',
  ready: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  completed: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  rejected: 'border-rose-300 bg-rose-50 text-rose-900',
  unpaid: 'border-rose-300 bg-rose-50 text-rose-900',
  paid: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  cash: 'border-slate-300 bg-slate-50 text-slate-900',
  upi: 'border-teal-300 bg-teal-50 text-teal-900',
};

function getOrderWorkflow(order) {
  const status = String(order?.status || order?.online?.workflowStatus || 'pending');
  if (status === 'awaiting_waiter_approval') {
    return 'pending';
  }
  if (status === 'served') {
    return 'completed';
  }
  return status;
}

function isLiveWorkflow(status) {
  return ['preparing', 'pending', 'ready'].includes(status);
}

function isWaiterApprovalOrder(order) {
  return order?.origin === 'qr' && order?.orderType === 'dine-in' && String(order?.status || '') === 'awaiting_waiter_approval';
}

function getOrderSourceKey(order) {
  return order?.origin === 'qr' ? 'qr' : 'manual';
}

function getStatusChipClass(value, fallback = 'border-slate-300 bg-slate-50 text-slate-900') {
  return STATUS_META[String(value || '').trim().toLowerCase()] || fallback;
}

export default function POSOrders() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const restaurantId = useAuthStore((state) => state.restaurantId);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [workflowFilter, setWorkflowFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [waiterAlertMessage, setWaiterAlertMessage] = useState('');
  const isWaiterAccount = user?.role === 'staff';
  const qrAlertedOrderIdsRef = useRef(new Set());
  const hasPrimedQrAlertsRef = useRef(false);
  const reloadTimeoutRef = useRef(null);
  const assignedTableIds = useMemo(
    () => (Array.isArray(user?.assignedTables) ? user.assignedTables.filter(Boolean) : []),
    [user?.assignedTables]
  );
  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const response = await orderAPI.getOrders({ limit: 150 });
      const nextOrders = response.data?.data?.items || response.data?.data || [];
      setOrders(Array.isArray(nextOrders) ? nextOrders.filter((order) => order.orderType === 'dine-in') : []);
    } catch (requestError) {
      setOrders([]);
      setError(requestError.response?.data?.message || 'Failed to load POS orders.');
    } finally {
      setLoading(false);
    }
  }, []);

  const queueOrderReload = useCallback(() => {
    if (reloadTimeoutRef.current) {
      window.clearTimeout(reloadTimeoutRef.current);
    }

    reloadTimeoutRef.current = window.setTimeout(() => {
      loadOrders();
    }, 200);
  }, [loadOrders]);

  useEffect(() => {
    loadOrders();
    return () => {
      if (reloadTimeoutRef.current) {
        window.clearTimeout(reloadTimeoutRef.current);
      }
    };
  }, [loadOrders]);

  useEffect(() => {
    const cleanup = subscribeToOrderEvents(() => {
      queueOrderReload();
    });

    return cleanup;
  }, [queueOrderReload]);

  useOrderSubscription(restaurantId, () => {
    queueOrderReload();
  });

  useEffect(() => {
    const syncCurrentWaiter = async () => {
      if (!isWaiterAccount) {
        return;
      }

      try {
        const response = await authAPI.getCurrentUser();
        const latestUser = response.data?.data?.user;

        if (latestUser?.id === user?.id) {
          syncPortalSessionUser('pos', latestUser);
        }
      } catch {
        // Auth/api layers already handle session errors.
      }
    };

    syncCurrentWaiter();
    const intervalId = window.setInterval(() => {
      syncCurrentWaiter();
      queueOrderReload();
    }, 12000);

    return () => window.clearInterval(intervalId);
  }, [isWaiterAccount, queueOrderReload, user?.id]);

  const pendingAssignedQrOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order?.origin === 'qr' &&
          order?.orderType === 'dine-in' &&
          String(order?.status || '') === 'awaiting_waiter_approval' &&
          (!isWaiterAccount || assignedTableIds.includes(order.tableId))
      ),
    [assignedTableIds, isWaiterAccount, orders]
  );

  useEffect(() => {
    const nextIds = new Set(pendingAssignedQrOrders.map((order) => order.id).filter(Boolean));

    if (!hasPrimedQrAlertsRef.current) {
      qrAlertedOrderIdsRef.current = nextIds;
      hasPrimedQrAlertsRef.current = true;
      return;
    }

    const hasNewQrAlert = Array.from(nextIds).some((id) => !qrAlertedOrderIdsRef.current.has(id));
    const newQrOrders = pendingAssignedQrOrders.filter(
      (order) => order.id && !qrAlertedOrderIdsRef.current.has(order.id)
    );
    qrAlertedOrderIdsRef.current = nextIds;

    if (isWaiterAccount && hasNewQrAlert) {
      playLoudBuzzer('waiter');
      const affectedTables = Array.from(
        new Set(newQrOrders.map((order) => order.tableNumber || 'your assigned table').filter(Boolean))
      );
      setWaiterAlertMessage(
        affectedTables.length > 1
          ? `New QR orders waiting for ${affectedTables.join(', ')}`
          : `New QR order waiting for ${affectedTables[0] || 'your assigned table'}`
      );
    }
  }, [isWaiterAccount, pendingAssignedQrOrders]);

  const filteredOrders = useMemo(
    () =>
      orders.filter((order) => {
        if (isWaiterAccount && !assignedTableIds.includes(order.tableId)) {
          return false;
        }

        const currentWorkflow = getOrderWorkflow(order);
        const currentSource = getOrderSourceKey(order);

        if (sourceFilter !== 'all' && currentSource !== sourceFilter) {
          return false;
        }

        if (workflowFilter === 'all') {
          return true;
        }

        if (workflowFilter === 'live') {
          return isLiveWorkflow(currentWorkflow);
        }

        return currentWorkflow === workflowFilter;
      }),
    [assignedTableIds, isWaiterAccount, orders, sourceFilter, workflowFilter]
  );

  const queueCounts = useMemo(
    () => ({
      all: filteredOrders.length,
      live: filteredOrders.filter((order) => isLiveWorkflow(getOrderWorkflow(order))).length,
      preparing: filteredOrders.filter((order) => getOrderWorkflow(order) === 'preparing').length,
      ready: filteredOrders.filter((order) => getOrderWorkflow(order) === 'ready').length,
      completed: filteredOrders.filter((order) => getOrderWorkflow(order) === 'completed').length,
    }),
    [filteredOrders]
  );

  const sourceCounts = useMemo(
    () => ({
      all: filteredOrders.length,
      qr: filteredOrders.filter((order) => getOrderSourceKey(order) === 'qr').length,
      manual: filteredOrders.filter((order) => getOrderSourceKey(order) === 'manual').length,
    }),
    [filteredOrders]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Dine-In Queue</p>
          <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
            {filteredOrders.length} visible
          </p>
        </div>
        <button
          type="button"
          onClick={loadOrders}
          disabled={loading}
          className="inline-flex min-h-[3rem] items-center gap-2 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {waiterAlertMessage ? <Toast type="warning" message={waiterAlertMessage} onClose={() => setWaiterAlertMessage('')} autoDismissMs={6200} /> : null}
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      <section className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-wrap gap-2 border-b border-[var(--border-color)] pb-4">
          {SOURCE_FILTERS.map((filter) => {
            const isActive = sourceFilter === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                onClick={() => setSourceFilter(filter.id)}
                className={`min-h-[3rem] rounded-2xl border px-4 text-sm font-semibold transition ${
                  isActive
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)] text-white'
                    : 'border-[var(--border-color)] bg-[var(--bg-card-muted)] text-[var(--text-primary)] hover:bg-[var(--color-primary-soft)]'
                }`}
              >
                {filter.label} ({sourceCounts[filter.id] || 0})
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
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
                {filter.label} ({queueCounts[filter.id] || 0})
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
            Try another source or workflow filter, or create a fresh dine-in order from the POS billing screen.
          </p>
        </section>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const source = order.online?.source || order.origin || 'pos';
            const sourceMeta = SOURCE_META[source] || SOURCE_META.direct;
            const SourceIcon = sourceMeta.icon;
            const workflowKey = getOrderWorkflow(order);
            const currentWorkflow = workflowKey.replace(/_/g, ' ');
            const paymentValue = String(order.online?.paymentState || order.paymentStatus || order.paymentMethod || 'pending');

            return (
              <article
                key={order.id}
                className="rounded-[1.5rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)]"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-2 rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--text-primary)]">
                        <SourceIcon className="h-3.5 w-3.5" />
                        {sourceMeta.label}
                      </span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${getStatusChipClass(workflowKey)}`}>
                        {currentWorkflow}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <h2 className="text-base font-black text-[var(--text-primary)]">{formatDisplayOrderNumber(order)}</h2>
                      <span className="text-sm text-[var(--text-secondary)]">{`Table ${order.tableNumber || 'Walk-in'}`}</span>
                      <span className="text-sm text-[var(--text-secondary)]">{order.items?.length || 0} items</span>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{formatCurrency(order.totalAmount || 0)}</span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">
                      {order.origin === 'qr'
                        ? 'Customer placed from QR and is waiting in the service queue.'
                        : 'Created from POS billing.'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate(`/pos?orderId=${order.id}`)}
                    className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-95 lg:min-w-[9rem]"
                  >
                    Open
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[1.2rem] bg-[var(--bg-card-muted)] px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Guest</p>
                    <p className="mt-1 font-semibold text-[var(--text-primary)]">{`Table ${order.tableNumber || 'Walk-in'}`}</p>
                  </div>
                  <div className="rounded-[1.2rem] bg-[var(--bg-card-muted)] px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Status</p>
                    <div className="mt-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${getStatusChipClass(workflowKey)}`}>
                        {currentWorkflow}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-[1.2rem] bg-[var(--bg-card-muted)] px-3 py-2 text-sm">
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">Payment</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] ${getStatusChipClass(paymentValue)}`}>
                        {paymentValue}
                      </span>
                    </div>
                  </div>
                </div>

                {order.online?.customerAddress ? (
                  <div className="mt-3 rounded-[1.2rem] bg-[var(--bg-card-muted)] px-3 py-2 text-sm text-[var(--text-secondary)]">
                    {order.online.customerAddress}
                  </div>
                ) : null}

                {isWaiterApprovalOrder(order) ? (
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-medium text-[var(--text-secondary)]">
                      Open this QR bill and use <span className="font-bold text-[var(--text-primary)]">Approve & Send to Kitchen</span>.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(`/pos?tableId=${order.tableId}&orderId=${order.id}`)}
                      className="inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-2xl bg-[var(--color-primary)] px-4 text-sm font-semibold text-white transition hover:opacity-95"
                    >
                      Approve Order
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
