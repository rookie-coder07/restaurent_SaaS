import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader, ShoppingCart, RotateCcw } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { orderAPI, tableAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate, formatDisplayOrderNumber } from '../utils/formatters';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';
import EmptyState from '../components/common/EmptyState';
import StatCard from '../components/common/StatCard';
import PaginationControls from '../components/common/PaginationControls';
import useResponsivePagination from '../hooks/useResponsivePagination';
import { useAuthStore } from '../context/authStore';
import { getOrderSourceLabel } from '../utils/managerPortal';

const STATUS_STYLES = {
  awaiting_waiter_approval: 'bg-sky-100 text-sky-700',
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

function isQrOrderWaitingForFirstKot(order) {
  return (
    order?.origin === 'qr' &&
    order?.orderType === 'dine-in' &&
    order?.status === 'awaiting_waiter_approval' &&
    (!Array.isArray(order?.kitchenTickets) || order.kitchenTickets.length === 0)
  );
}

function formatPaymentMethodLabel(value) {
  return String(value || 'cash').toUpperCase();
}

export default function Orders() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isManagerUser = user?.role === 'manager';
  const canDeleteOrders = user?.role === 'owner';
  const { data: ordersData = {}, loading, execute: refetchOrders, refetch: refetchOrdersLatest } = useApi(() => orderAPI.getOrders({ limit: 100 }));
  const { data: tablesData = {}, refetch: refetchTables } = useApi(() => tableAPI.getTables({}));

  const [filterStatus, setFilterStatus] = useState('all');
  const [datePreset, setDatePreset] = useState('all');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [timeRange, setTimeRange] = useState({ start: '', end: '' });
  const [tableFilter, setTableFilter] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState(null);
  const [isDeletingOrder, setIsDeletingOrder] = useState(false);
  const [selectedOrderIds, setSelectedOrderIds] = useState([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeletingOrders, setIsBulkDeletingOrders] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [pendingDeletionQueue, setPendingDeletionQueue] = useState([]);
  const [deleteClock, setDeleteClock] = useState(Date.now());
  const [deletePassword, setDeletePassword] = useState('');
  const pendingDeletionQueueRef = useRef([]);
  const requiresDeletePassword = user?.role === 'owner';

  const orders = ordersData?.items || [];
  const tables = tablesData?.tables || [];
  const pendingDeletionIds = useMemo(
    () => new Set(pendingDeletionQueue.flatMap((entry) => entry.orderIds)),
    [pendingDeletionQueue]
  );

  const applyDatePreset = (preset) => {
    const now = new Date();
    if (preset === 'today') {
      const today = now.toISOString().split('T')[0];
      setDateRange({ start: today, end: today });
      return;
    }

    if (preset === 'custom') {
      return;
    }

    setDateRange({ start: '', end: '' });
  };

  const filteredOrders = useMemo(() => {
    const visibleOrders = orders.filter((order) => {
      if (pendingDeletionIds.has(order.id)) {
        return false;
      }

      const statusMatch = filterStatus === 'all' || order.status === filterStatus;
      const createdAt = new Date(order.createdAt);
      const startMatch = !dateRange.start || createdAt >= new Date(`${dateRange.start}T00:00:00`);
      const endMatch = !dateRange.end || createdAt <= new Date(`${dateRange.end}T23:59:59`);
      const createdMinutes = createdAt.getHours() * 60 + createdAt.getMinutes();
      const startTimeMinutes = timeRange.start
        ? Number(timeRange.start.split(':')[0]) * 60 + Number(timeRange.start.split(':')[1])
        : null;
      const endTimeMinutes = timeRange.end
        ? Number(timeRange.end.split(':')[0]) * 60 + Number(timeRange.end.split(':')[1])
        : null;
      const timeStartMatch = startTimeMinutes === null || createdMinutes >= startTimeMinutes;
      const timeEndMatch = endTimeMinutes === null || createdMinutes <= endTimeMinutes;
      const tableMatch = tableFilter === 'all' || String(order.tableNumber || '') === String(tableFilter);
      return statusMatch && startMatch && endMatch && timeStartMatch && timeEndMatch && tableMatch;
    });

    return visibleOrders.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [orders, filterStatus, dateRange, timeRange, tableFilter, pendingDeletionIds]);

  const totalRevenue = filteredOrders
    .filter((order) => isSettledOrder(order))
    .reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);

  const bulkDeletableOrders = filteredOrders;
  const selectedBulkOrders = filteredOrders.filter((order) => selectedOrderIds.includes(order.id));
  const activeOrdersCount = filteredOrders.filter((order) => !isSettledOrder(order) && order.status !== 'cancelled').length;
  const paidOrdersCount = filteredOrders.filter((order) => isSettledOrder(order)).length;
  const hasTimelineFilter = Boolean(dateRange.start || dateRange.end);
  const timelineOrders = filteredOrders;
  const {
    paginatedItems: paginatedOrders,
    currentPage,
    totalPages,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
    pageStart,
    hasPagination,
  } = useResponsivePagination(filteredOrders, { mobileItemsPerPage: 6, desktopItemsPerPage: 12 });

  useAutoRefresh(() => Promise.allSettled([refetchOrdersLatest(), refetchTables()]), 12000);

  useEffect(() => {
    pendingDeletionQueueRef.current = pendingDeletionQueue;
  }, [pendingDeletionQueue]);

  useEffect(() => {
    if (pendingDeletionQueue.length === 0) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setDeleteClock(Date.now());
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [pendingDeletionQueue.length]);

  useEffect(() => () => {
    pendingDeletionQueueRef.current.forEach((entry) => window.clearTimeout(entry.timeoutId));
  }, []);

  const handleStatusUpdate = async (orderId, newStatus) => {
    try {
      await orderAPI.updateStatus(
        orderId,
        newStatus === 'cancelled'
          ? { status: newStatus, cancelReason: 'Cancelled from admin order status control.' }
          : { status: newStatus }
      );
      setSuccess('Order status updated');
      await refetchOrders();
      window.setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update order');
    }
  };

  const openOrderDetails = async (order) => {
    setSelectedOrder(order);
    setSelectedOrderDetails(order);
    setDetailsLoading(true);
    setError(null);

    try {
      const response = await orderAPI.getOrder(order.id);
      setSelectedOrderDetails(response.data?.data || order);
    } catch (err) {
      setSelectedOrderDetails(order);
      setError(err.response?.data?.message || 'Failed to load order details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  const closeOrderDetails = () => {
    setSelectedOrder(null);
    setSelectedOrderDetails(null);
    setDetailsLoading(false);
  };

  const removePendingDeletionEntry = (entryId) => {
    setPendingDeletionQueue((current) => current.filter((entry) => entry.id !== entryId));
  };

  const finalizePendingDeletion = async (entry) => {
    try {
      await Promise.all(
        entry.orderIds.map((orderId) =>
          orderAPI.softDeleteOrder(orderId, {
            currentPassword: entry.currentPassword || '',
          })
        )
      );
      removePendingDeletionEntry(entry.id);
      await refetchOrders();
      setSuccess(
        entry.orderIds.length === 1
          ? `${entry.label} deleted permanently.`
          : `${entry.orderIds.length} orders deleted permanently.`
      );
      window.setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      removePendingDeletionEntry(entry.id);
      setError(err.response?.data?.message || 'Failed to delete orders.');
      await refetchOrders();
    }
  };

  const queueDeletion = (ordersToDelete) => {
    const uniqueOrders = Array.from(new Map(ordersToDelete.map((order) => [order.id, order])).values());

    if (uniqueOrders.length === 0) {
      return;
    }

    const entry = {
      id: `delete-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      orderIds: uniqueOrders.map((order) => order.id),
      label: uniqueOrders.length === 1 ? formatDisplayOrderNumber(uniqueOrders[0]) : `${uniqueOrders.length} orders`,
      expiresAt: Date.now() + 10000,
      timeoutId: null,
      currentPassword: requiresDeletePassword ? deletePassword : '',
    };

    entry.timeoutId = window.setTimeout(() => {
      finalizePendingDeletion(entry);
    }, 10000);

    setPendingDeletionQueue((current) => [entry, ...current]);
    setSelectedOrderIds((current) => current.filter((id) => !entry.orderIds.includes(id)));
    setSuccess(
      uniqueOrders.length === 1
        ? `${entry.label} removed from the list. Undo available for 10 seconds.`
        : `${uniqueOrders.length} orders removed from the list. Undo available for 10 seconds.`
    );
    window.setTimeout(() => setSuccess(null), 4000);
  };

  const handleUndoDelete = (entryId) => {
    setPendingDeletionQueue((current) => {
      const entry = current.find((candidate) => candidate.id === entryId);
      if (entry?.timeoutId) {
        window.clearTimeout(entry.timeoutId);
      }

      return current.filter((candidate) => candidate.id !== entryId);
    });
  };

  const handleDeleteOrder = async () => {
    if (!pendingDeleteOrder) {
      return;
    }

    try {
      setIsDeletingOrder(true);
      setError(null);
      if (requiresDeletePassword && !deletePassword.trim()) {
        setError('Enter admin password to delete previous orders.');
        return;
      }
      queueDeletion([pendingDeleteOrder]);
      setPendingDeleteOrder(null);
      setDeletePassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to queue this order for deletion.');
    } finally {
      setIsDeletingOrder(false);
    }
  };

  const toggleOrderSelection = (orderId) => {
    setSelectedOrderIds((current) =>
      current.includes(orderId) ? current.filter((id) => id !== orderId) : [...current, orderId]
    );
  };

  const clearFilters = () => {
    setFilterStatus('all');
    setDatePreset('all');
    setDateRange({ start: '', end: '' });
    setTimeRange({ start: '', end: '' });
    setTableFilter('all');
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = bulkDeletableOrders.map((order) => order.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedOrderIds.includes(id));

    setSelectedOrderIds((current) =>
      allSelected
        ? current.filter((id) => !visibleIds.includes(id))
        : Array.from(new Set([...current, ...visibleIds]))
    );
  };

  const selectTimelineOrders = () => {
    const timelineIds = timelineOrders.map((order) => order.id);
    setSelectedOrderIds((current) => Array.from(new Set([...current, ...timelineIds])));
  };

  const deleteTimelineOrders = () => {
    if (timelineOrders.length === 0) {
      setError('No orders found in the selected timeline.');
      return;
    }

    setSelectedOrderIds(timelineOrders.map((order) => order.id));
    setShowBulkDeleteModal(true);
  };

  const handleBulkDeleteOrders = async () => {
    if (selectedBulkOrders.length === 0) {
      setError('Select at least one order to delete.');
      return;
    }

    try {
      setIsBulkDeletingOrders(true);
      setError(null);
      if (requiresDeletePassword && !deletePassword.trim()) {
        setError('Enter admin password to delete previous orders.');
        return;
      }
      queueDeletion(selectedBulkOrders);
      setShowBulkDeleteModal(false);
      setDeletePassword('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to queue selected orders for deletion.');
    } finally {
      setIsBulkDeletingOrders(false);
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
      {isManagerUser ? (
        <section className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Order Control</p>
          <h1 className="mt-2 text-2xl font-black text-[var(--text-primary)]">Control QR, POS, and waiter orders in one place</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Review service queues, keep kitchen progress moving, and send unpaid bills to the manager billing screen.
          </p>
        </section>
      ) : null}

      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}
      {canDeleteOrders && pendingDeletionQueue.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <div className="flex flex-col gap-3">
            {pendingDeletionQueue.map((entry) => {
              const secondsLeft = Math.max(1, Math.ceil((entry.expiresAt - deleteClock) / 1000));

              return (
                <div key={entry.id} className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-amber-900">
                      {entry.orderIds.length === 1 ? `${entry.label} scheduled for deletion.` : `${entry.orderIds.length} orders scheduled for deletion.`}
                    </p>
                    <p className="text-sm text-amber-800">Undo is available for {secondsLeft} more second{secondsLeft === 1 ? '' : 's'}.</p>
                  </div>
                  <Button variant="secondary" onClick={() => handleUndoDelete(entry.id)}>
                    <RotateCcw className="h-4 w-4" />
                    Undo
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Filtered Orders" value={filteredOrders.length} subtitle="Current result set" />
        <StatCard label="Revenue" value={formatCurrency(totalRevenue)} subtitle="Settled sales only" />
        <StatCard
          label="Settled"
          value={filteredOrders.filter((order) => isSettledOrder(order)).length}
          subtitle="Bills marked paid"
        />
      </div>

      <Card>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-sm text-[var(--color-text-muted)]">Quick Filters</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--color-text)]">Find orders fast without the clutter</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: 'All', value: 'all' },
              { label: 'Pending', value: 'pending' },
              { label: 'Preparing', value: 'preparing' },
              { label: 'Ready', value: 'ready' },
              { label: 'Completed', value: 'completed' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => setFilterStatus(option.value)}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  filterStatus === option.value
                    ? 'bg-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-muted)] text-[var(--color-text-muted)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">Active</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{activeOrdersCount}</p>
          </div>
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">Paid</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{paidOrdersCount}</p>
          </div>
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-[var(--color-text-subtle)]">Total Listed</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--color-text)]">{filteredOrders.length}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setShowAdvancedFilters((current) => !current)}
            >
              {showAdvancedFilters ? 'Hide Advanced Filters' : 'Show Advanced Filters'}
            </Button>
            <Button variant="secondary" onClick={clearFilters}>
              Reset View
            </Button>
          </div>

          <p className="text-sm text-[var(--color-text-muted)]">
            Filters stay local to loaded data for faster browsing.
          </p>
        </div>

        {showAdvancedFilters ? (
          <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">Date Filter</span>
              <select
                value={datePreset}
                onChange={(e) => {
                  const nextPreset = e.target.value;
                  setDatePreset(nextPreset);
                  applyDatePreset(nextPreset);
                }}
                className="input"
              >
                <option value="all">All Dates</option>
                <option value="today">Today</option>
                <option value="custom">Custom Date</option>
              </select>
            </label>

            <Input
              label="From Date"
              type="date"
              value={dateRange.start}
              onChange={(e) => {
                setDatePreset('custom');
                setDateRange({ ...dateRange, start: e.target.value });
              }}
            />

            <Input
              label="To Date"
              type="date"
              value={dateRange.end}
              onChange={(e) => {
                setDatePreset('custom');
                setDateRange({ ...dateRange, end: e.target.value });
              }}
            />

            <Input
              label="From Time"
              type="time"
              value={timeRange.start}
              onChange={(e) => setTimeRange({ ...timeRange, start: e.target.value })}
            />

            <Input
              label="To Time"
              type="time"
              value={timeRange.end}
              onChange={(e) => setTimeRange({ ...timeRange, end: e.target.value })}
            />

            <label className="space-y-2">
              <span className="text-sm font-medium text-[var(--color-text)]">Table</span>
              <select value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} className="input">
                <option value="all">All Tables</option>
                {tables.map((table) => (
                  <option key={table.id} value={table.tableNumber}>
                    Table {table.tableNumber}
                  </option>
                ))}
              </select>
            </label>
          </div>
        ) : null}

        {hasTimelineFilter ? (
          <div className="mt-5 rounded-2xl border border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)]/35 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-[var(--color-text)]">Timeline selection</p>
                <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                  {timelineOrders.length} order{timelineOrders.length === 1 ? '' : 's'} found in the current date range.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canDeleteOrders ? (
                  <>
                    <Button variant="secondary" onClick={selectTimelineOrders} disabled={timelineOrders.length === 0}>
                      Select Timeline
                    </Button>
                    <Button variant="danger" onClick={deleteTimelineOrders} disabled={timelineOrders.length === 0}>
                      Delete Timeline
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </Card>

      {canDeleteOrders && selectedBulkOrders.length > 0 ? (
        <Card className="border-[var(--color-primary)]/20 bg-[var(--color-primary-soft)]/40">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-[var(--color-text)]">{selectedBulkOrders.length} orders selected</p>
              <p className="text-sm text-[var(--color-text-muted)]">Delete the selected orders permanently from the system.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={toggleSelectAllVisible}>
                {bulkDeletableOrders.every((order) => selectedOrderIds.includes(order.id))
                  ? 'Clear Visible Selection'
                  : 'Select Visible'}
              </Button>
              <Button
                variant="danger"
                onClick={() => setShowBulkDeleteModal(true)}
                disabled={selectedBulkOrders.length === 0}
              >
                Delete Selected ({selectedBulkOrders.length})
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={ShoppingCart}
          title="No orders found"
          description="Try adjusting the filters to view the right billing and order history."
        />
      ) : (
        <div className="space-y-4">
          <Card className="hidden overflow-hidden lg:block" padded={false}>
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-[var(--color-surface-muted)]">
                  <tr className="text-left text-xs uppercase tracking-[0.14em] text-[var(--color-text-subtle)]">
                    {canDeleteOrders ? <th className="px-4 py-4 font-semibold">Select</th> : null}
                    <th className="px-4 py-4 font-semibold">S.No.</th>
                    <th className="px-4 py-4 font-semibold">Order</th>
                    <th className="px-4 py-4 font-semibold">Table</th>
                    <th className="px-4 py-4 font-semibold">Created</th>
                    <th className="px-4 py-4 font-semibold">Amount</th>
                    <th className="px-4 py-4 font-semibold">Status</th>
                    <th className="px-4 py-4 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedOrders.map((order, index) => (
                    <tr key={order.id} className="border-t border-[var(--color-border)] text-sm">
                      {canDeleteOrders ? (
                        <td className="px-4 py-4 align-top">
                          <input
                            type="checkbox"
                            checked={selectedOrderIds.includes(order.id)}
                            onChange={() => toggleOrderSelection(order.id)}
                            className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
                          />
                        </td>
                      ) : null}
                      <td className="px-4 py-4 align-top font-semibold text-[var(--color-primary)]">{pageStart + index + 1}</td>
                      <td className="px-4 py-4 align-top">
                        <p className="font-semibold text-[var(--color-text)]">
                          {order.status === 'cancelled'
                            ? `${formatDisplayOrderNumber(order)} (Cancelled)`
                            : formatDisplayOrderNumber(order)}
                        </p>
                        <p className="mt-1 text-xs text-[var(--color-text-muted)]">{order.items?.length || 0} items</p>
                        <span className="mt-2 inline-flex rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                          {getOrderSourceLabel(order)}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-top text-[var(--color-text)]">Table {order.tableNumber || 'N/A'}</td>
                      <td className="px-4 py-4 align-top text-[var(--color-text-muted)]">{formatDate(order.createdAt)}</td>
                      <td className="px-4 py-4 align-top font-semibold text-[var(--color-text)]">
                        {formatCurrency(order.totalAmount || order.total || 0)}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[order.status] || STATUS_STYLES.pending}`}>
                            {order.status}
                          </span>
                          <span className="w-fit rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                            {formatPaymentMethodLabel(order.paymentMethod)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          {isQrOrderWaitingForFirstKot(order) ? (
                            <p className="w-full text-xs font-semibold text-amber-700">
                              Waiter must generate the first KOT before progress can change.
                            </p>
                          ) : null}
                          {order.status !== 'completed' && order.status !== 'cancelled' ? (
                            <select
                              value={order.status}
                              onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                              className="input min-w-[150px]"
                              disabled={isQrOrderWaitingForFirstKot(order)}
                            >
                              <option value="awaiting_waiter_approval">Waiting</option>
                              <option value="pending">Pending</option>
                              <option value="preparing">Preparing</option>
                              <option value="ready">Ready</option>
                              <option value="served">Served</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                          ) : null}
                          {isManagerUser && !isSettledOrder(order) && order.status !== 'cancelled' ? (
                            <Button onClick={() => navigate('/manager/bills')}>
                              Settle Bill
                            </Button>
                          ) : null}
                          {canDeleteOrders ? (
                            <Button variant="danger" onClick={() => setPendingDeleteOrder(order)}>
                              Delete
                            </Button>
                          ) : null}
                          <Button variant="secondary" onClick={() => openOrderDetails(order)}>
                            Details
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="space-y-4 lg:hidden">
            {paginatedOrders.map((order, index) => (
              <Card key={order.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-primary)]">
                        S.No. {pageStart + index + 1}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">
                        {order.status === 'cancelled'
                          ? `${formatDisplayOrderNumber(order)} (Cancelled)`
                          : formatDisplayOrderNumber(order)}
                      </p>
                      <span className="mt-2 inline-flex rounded-full bg-[var(--color-surface-muted)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                        {getOrderSourceLabel(order)}
                      </span>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">Table {order.tableNumber || 'N/A'}</p>
                      <p className="mt-1 text-sm text-[var(--color-text-muted)]">{formatDate(order.createdAt)}</p>
                    </div>
                    {canDeleteOrders ? (
                      <input
                        type="checkbox"
                        checked={selectedOrderIds.includes(order.id)}
                        onChange={() => toggleOrderSelection(order.id)}
                        className="mt-1 h-4 w-4 rounded border-[var(--color-border)]"
                      />
                    ) : null}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[order.status] || STATUS_STYLES.pending}`}>
                      {order.status}
                    </span>
                    <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                      {formatPaymentMethodLabel(order.paymentMethod)}
                    </span>
                    <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-sm font-semibold text-[var(--color-text)]">
                      {formatCurrency(order.totalAmount || order.total || 0)}
                    </span>
                  </div>

                  <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                    <p className="text-sm font-semibold text-[var(--color-text)]">Items</p>
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

                  <div className="flex flex-col gap-3">
                    {isQrOrderWaitingForFirstKot(order) ? (
                      <p className="text-xs font-semibold text-amber-700">
                        Waiter must generate the first KOT before progress can change.
                      </p>
                    ) : null}
                    {order.status !== 'completed' && order.status !== 'cancelled' ? (
                      <select
                        value={order.status}
                        onChange={(e) => handleStatusUpdate(order.id, e.target.value)}
                        className="input"
                        disabled={isQrOrderWaitingForFirstKot(order)}
                      >
                        <option value="awaiting_waiter_approval">Waiting for Waiter</option>
                        <option value="pending">Pending</option>
                        <option value="preparing">Preparing</option>
                        <option value="ready">Ready</option>
                        <option value="served">Served</option>
                        <option value="cancelled">Cancelled</option>
                      </select>
                    ) : null}
                    <div className="flex flex-col gap-3 sm:flex-row">
                      {isManagerUser && !isSettledOrder(order) && order.status !== 'cancelled' ? (
                        <Button onClick={() => navigate('/manager/bills')}>
                          Settle Bill
                        </Button>
                      ) : null}
                      {canDeleteOrders ? (
                        <Button variant="danger" onClick={() => setPendingDeleteOrder(order)}>
                          Delete Order
                        </Button>
                      ) : null}
                      <Button variant="secondary" onClick={() => openOrderDetails(order)}>
                        View Details
                      </Button>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {hasPagination ? (
            <PaginationControls
              currentPage={currentPage}
              totalPages={totalPages}
              canGoPrevious={canGoPrevious}
              canGoNext={canGoNext}
              onPrevious={goPrevious}
              onNext={goNext}
            />
          ) : null}
        </div>
      )}

      <Modal
        title={
          selectedOrder
            ? `${formatDisplayOrderNumber(selectedOrder)}${
                selectedOrder.status === 'cancelled'
                  ? ' (Cancelled)'
                  : ''
              }`
            : 'Order'
        }
        isOpen={Boolean(selectedOrder)}
        onClose={closeOrderDetails}
        maxWidth="max-w-lg"
      >
        {selectedOrder ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_STYLES[(selectedOrderDetails || selectedOrder).status] || STATUS_STYLES.pending}`}>
                {(selectedOrderDetails || selectedOrder).status}
              </span>
              <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                {formatPaymentMethodLabel((selectedOrderDetails || selectedOrder).paymentMethod)}
              </span>
              <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text)]">
                {(selectedOrderDetails || selectedOrder).paymentStatus || 'pending'}
              </span>
              <span className="text-sm text-[var(--color-text-muted)]">{formatDate((selectedOrderDetails || selectedOrder).createdAt)}</span>
            </div>

            {detailsLoading ? (
              <Card className="p-6">
                <div className="flex min-h-[8rem] items-center justify-center">
                  <Loader className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
                </div>
              </Card>
            ) : (
              <Card className="p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">Items</p>
                <div className="mt-3 space-y-3">
                  {((selectedOrderDetails || selectedOrder).items || []).map((item, idx) => (
                    <div key={`${selectedOrder.id}-detail-${idx}`} className="flex items-start justify-between gap-3 text-sm">
                      <div className="min-w-0 flex-1">
                        <p className="break-words text-[var(--color-text)]">
                          {item.quantity}x {item.name}
                        </p>
                        {item.modifiers?.length ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">{item.modifiers.join(', ')}</p> : null}
                        {item.note ? <p className="mt-1 text-xs text-[var(--color-text-muted)]">Note: {item.note}</p> : null}
                      </div>
                      <span className="shrink-0 text-[var(--color-text-muted)]">
                        {formatCurrency((item.unitPrice || item.price || 0) * (item.quantity || 0))}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            <div className="flex items-center justify-between rounded-2xl bg-[var(--color-surface-muted)] p-4">
              <span className="font-semibold text-[var(--color-text)]">Total</span>
              <span className="font-bold text-[var(--color-text)]">
                {formatCurrency((selectedOrderDetails || selectedOrder).totalAmount || (selectedOrderDetails || selectedOrder).total || 0)}
              </span>
            </div>
          </div>
        ) : null}
      </Modal>

      {canDeleteOrders ? (
        <>
          <Modal
            title={pendingDeleteOrder ? `Delete ${formatDisplayOrderNumber(pendingDeleteOrder)}` : 'Delete Order'}
            isOpen={Boolean(pendingDeleteOrder)}
            onClose={() => {
              if (isDeletingOrder) {
                return;
              }

              setPendingDeleteOrder(null);
            }}
            maxWidth="max-w-lg"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                This order will be removed from the list now. You can undo it for 10 seconds before it is deleted permanently.
              </div>

              {requiresDeletePassword ? (
                <Input
                  label="Admin Password"
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="Enter your current password"
                />
              ) : null}

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:flex-1"
                  onClick={() => {
                    setPendingDeleteOrder(null);
                    setDeletePassword('');
                  }}
                  disabled={isDeletingOrder}
                >
                  Keep Order
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="w-full sm:flex-1"
                  onClick={handleDeleteOrder}
                  disabled={isDeletingOrder}
                >
                  {isDeletingOrder ? 'Deleting...' : 'Confirm Delete'}
                </Button>
              </div>
            </div>
          </Modal>

          <Modal
            title={`Delete ${selectedBulkOrders.length} Selected Order${selectedBulkOrders.length === 1 ? '' : 's'}`}
            isOpen={showBulkDeleteModal}
            onClose={() => {
              if (isBulkDeletingOrders) {
                return;
              }

              setShowBulkDeleteModal(false);
              setDeletePassword('');
            }}
            maxWidth="max-w-lg"
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
                The selected orders will be removed from the list now. You can undo them for 10 seconds before they are deleted permanently.
              </div>

              {requiresDeletePassword ? (
                <Input
                  label="Admin Password"
                  type="password"
                  value={deletePassword}
                  onChange={(event) => setDeletePassword(event.target.value)}
                  placeholder="Enter your current password"
                />
              ) : null}

              <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--color-text)]">Selected orders</p>
                <div className="mt-3 space-y-2">
                  {selectedBulkOrders.slice(0, 6).map((order) => (
                    <div key={order.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-[var(--color-text)]">{formatDisplayOrderNumber(order)}</span>
                      <span className="text-[var(--color-text-muted)]">
                        {formatCurrency(order.totalAmount || order.total || 0)}
                      </span>
                    </div>
                  ))}
                  {selectedBulkOrders.length > 6 ? (
                    <p className="text-xs text-[var(--color-text-muted)]">
                      +{selectedBulkOrders.length - 6} more selected order{selectedBulkOrders.length - 6 === 1 ? '' : 's'}
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="secondary"
                  className="w-full sm:flex-1"
                  onClick={() => {
                    setShowBulkDeleteModal(false);
                    setDeletePassword('');
                  }}
                  disabled={isBulkDeletingOrders}
                >
                  Keep Orders
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="w-full sm:flex-1"
                  onClick={handleBulkDeleteOrders}
                  disabled={isBulkDeletingOrders || selectedBulkOrders.length === 0}
                >
                  {isBulkDeletingOrders ? 'Deleting...' : 'Confirm Bulk Delete'}
                </Button>
              </div>
            </div>
          </Modal>
        </>
      ) : null}
    </div>
  );
}
