import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Loader,
  RefreshCw,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from '../hooks/useApi';
import { getCurrentPortalAccessToken } from '../services/api';
import { subscribeToOrderEvents } from '../utils/liveOrderEvents';
import { inventoryAPI, orderAPI, restaurantAPI, tableAPI, authAPI } from '../services/apiEndpoints';
import { useManagerStore } from '../context/managerStore';
import { formatDate } from '../utils/formatters';
import { buildSmartNotifications, getPriorityMeta } from '../utils/adminMonitoring';
import { playLoudBuzzer } from '../utils/alerts';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import PaginationControls from '../components/common/PaginationControls';
import Toast from '../components/common/Toast';
import useResponsivePagination from '../hooks/useResponsivePagination';

const QUICK_FILTERS = [
  { id: 'all', label: 'Show Everything' },
  { id: 'live', label: 'Need Action Now' },
  { id: 'critical', label: 'Very Important' },
  { id: 'warning', label: 'Check Soon' },
  { id: 'resolved', label: 'Already Done' },
];

function getFriendlyStaffName(value) {
  const cleanedValue = String(value || '').trim();
  return cleanedValue || 'A team member';
}

function getFriendlyTimestamp(value) {
  if (!value) {
    return 'Updated just now';
  }

  return `Updated ${formatDate(value)}`;
}

function getTableLabel(tableMap, tableId, fallback = 'the selected table') {
  const normalizedId = String(tableId || '').trim();
  const tableNumber = tableMap.get(normalizedId);

  if (tableNumber) {
    return `Table ${tableNumber}`;
  }

  return fallback;
}

function getTransferTableLabel(tableMap, transfer, idKey, numberKeys = [], fallback = 'the selected table') {
  const mappedLabel = getTableLabel(tableMap, transfer?.[idKey], '');
  if (mappedLabel) {
    return mappedLabel;
  }

  for (const key of numberKeys) {
    const value = transfer?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return `Table ${value}`;
    }
  }

  return fallback;
}

function getWaiterActivityTitle(action, tableLabel) {
  if (action === 'assigned_table') {
    return `Waiter assigned to ${tableLabel}`;
  }

  return `Waiter update for ${tableLabel}`;
}

export default function Notifications() {
  const {
    data: ordersData = {},
    loading: ordersLoading,
    error: ordersError,
    refetch: refetchOrders,
  } = useApi(() => orderAPI.getOrders({ limit: 200 }));
  const {
    data: inventorySummary = {},
    loading: inventoryLoading,
    error: inventoryError,
    refetch: refetchInventory,
  } = useApi(inventoryAPI.getSummary);
  const {
    data: staffData = {},
    error: staffError,
    refetch: refetchStaff,
  } = useApi(() => restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true }));
  const {
    data: tablesData = {},
    error: tablesError,
    refetch: refetchTables,
  } = useApi(() => tableAPI.getTables({}));
  const {
    data: broadcastsData = {},
    error: broadcastsError,
    refetch: refetchBroadcasts,
  } = useApi(() => restaurantAPI.getBroadcasts({ limit: 20 }));
  const approvedDiscounts = useManagerStore((state) => state.approvedDiscounts);
  const tableClosures = useManagerStore((state) => state.tableClosures);
  const tableTransfers = useManagerStore((state) => state.tableTransfers);
  const tableMerges = useManagerStore((state) => state.tableMerges);
  const stockRequests = useManagerStore((state) => state.stockRequests);
  const waiterActivity = useManagerStore((state) => state.waiterActivity);
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const previousLiveIdsRef = useRef(new Set());

  const orders = ordersData?.items || [];
  const lowStockItems = inventorySummary?.lowStockItems || [];
  const staff = staffData?.staff || [];
  const tables = tablesData?.tables || [];
  const broadcasts = broadcastsData?.items || [];
  const loading = ordersLoading || inventoryLoading;
  const notificationsFeatureDisabled =
    typeof broadcastsError === 'string' &&
    broadcastsError.toLowerCase().includes('disabled by the platform administrator');

  const notifications = useMemo(() => {
    const liveNotifications = buildSmartNotifications({ orders, lowStockItems, approvedDiscounts });
    const extraNotifications = [];
    const assignedWaiterByTableId = new Map();
    const tableNumberMap = new Map(
      tables.flatMap((table) => {
        const keys = [table.id, table._id].filter(Boolean).map((value) => String(value));
        return keys.map((key) => [key, table.tableNumber]);
      })
    );
    const staffNameMap = new Map(staff.map((member) => [member.id, getFriendlyStaffName(member.name || member.email)]));

    staff
      .filter((member) => member.role === 'staff')
      .forEach((member) => {
        (member.assignedTables || []).forEach((tableId) => {
          assignedWaiterByTableId.set(String(tableId), member);
        });
      });

    orders
      .filter((order) => order.status === 'awaiting_waiter_approval' && order.tableId && order.origin === 'qr')
      .forEach((order) => {
        const assignedWaiter = assignedWaiterByTableId.get(String(order.tableId));
        extraNotifications.push({
          id: `waiter-routing-${order.id}`,
          title: assignedWaiter
            ? `New order for Table ${order.tableNumber || 'N/A'}`
            : `Manager attention needed for Table ${order.tableNumber || 'N/A'}`,
          detail: assignedWaiter
            ? `Routed to ${getFriendlyStaffName(assignedWaiter.name || assignedWaiter.email)} for waiter approval.`
            : 'No waiter is assigned to this table yet, so the manager should review it.',
          timestamp: order.updatedAt || order.createdAt,
          priority: assignedWaiter ? 'warning' : 'critical',
          category: 'orders',
          sourceRole: assignedWaiter ? 'waiter' : 'manager',
          status: 'live',
        });
      });

    Object.entries(waiterActivity || {}).forEach(([waiterId, activity]) => {
      if (!activity?.tableId) {
        return;
      }

      const tableLabel = getTableLabel(tableNumberMap, activity.tableId, 'the selected table');

      extraNotifications.push({
        id: `waiter-activity-${waiterId}`,
        title: getWaiterActivityTitle(activity.action, tableLabel),
        detail: 'Please review the latest waiter update.',
        timestamp: activity.updatedAt,
        priority: 'warning',
        category: 'orders',
        sourceRole: 'waiter',
        status: 'live',
      });
    });

    Object.entries(tableClosures || {}).forEach(([tableId, closure]) => {
      if (!closure?.closed) {
        return;
      }

      extraNotifications.push({
        id: `manager-close-${tableId}`,
        title: `${getTableLabel(tableNumberMap, tableId, 'A table')} was closed`,
        detail: closure.note || 'This table has been closed by the manager.',
        timestamp: closure.updatedAt,
        priority: 'warning',
        category: 'billing',
        sourceRole: 'manager',
        status: 'resolved',
      });
    });

    tableTransfers.forEach((transfer) => {
      const toTableLabel = getTransferTableLabel(
        tableNumberMap,
        transfer,
        'toTableId',
        ['toTableNumber', 'newTableNumber', 'targetTableNumber'],
        'another table'
      );
      const fromTableLabel = getTransferTableLabel(
        tableNumberMap,
        transfer,
        'fromTableId',
        ['fromTableNumber', 'oldTableNumber', 'sourceTableNumber'],
        'the previous table'
      );

      extraNotifications.push({
        id: transfer.id,
        title: `Guests were moved to ${toTableLabel}`,
        detail: `Moved from ${fromTableLabel}.`,
        timestamp: transfer.createdAt,
        priority: 'warning',
        category: 'orders',
        sourceRole: 'manager',
        status: 'resolved',
      });
    });

    tableMerges.forEach((merge) => {
      extraNotifications.push({
        id: merge.id,
        title: `Tables were combined into ${getTableLabel(tableNumberMap, merge.primaryTableId, 'the main table')}`,
        detail: `${merge.secondaryTableIds?.length || 0} table(s) were joined together.`,
        timestamp: merge.createdAt,
        priority: 'warning',
        category: 'orders',
        sourceRole: 'manager',
        status: 'resolved',
      });
    });

    stockRequests.forEach((request) => {
      extraNotifications.push({
        id: request.id,
        title: `${request.itemName} needs to be refilled`,
        detail: `${request.quantity} more unit(s) were requested.`,
        timestamp: request.createdAt,
        priority: 'warning',
        category: 'inventory',
        sourceRole: 'manager',
        status: request.status === 'requested' ? 'live' : 'resolved',
      });
    });

    broadcasts.forEach((broadcast) => {
      extraNotifications.push({
        id: `broadcast-${broadcast.id}`,
        title: broadcast.title || 'Platform broadcast',
        detail: broadcast.message || '',
        timestamp: broadcast.createdAt,
        priority: 'warning',
        category: 'notifications',
        sourceRole: 'developer',
        status: 'live',
      });
    });

    return [...liveNotifications, ...extraNotifications].sort(
      (left, right) => new Date(right.timestamp || 0) - new Date(left.timestamp || 0)
    );
  }, [
    approvedDiscounts,
    broadcasts,
    lowStockItems,
    orders,
    staff,
    stockRequests,
    tableClosures,
    tableMerges,
    tableTransfers,
    tables,
    waiterActivity,
  ]);

  const filteredNotifications = useMemo(() => {
    if (activeFilter === 'all') {
      return notifications;
    }

    if (activeFilter === 'critical' || activeFilter === 'warning') {
      return notifications.filter((notification) => notification.priority === activeFilter);
    }

    return notifications.filter((notification) => notification.status === activeFilter);
  }, [activeFilter, notifications]);
  const {
    paginatedItems: paginatedNotifications,
    currentPage,
    totalPages,
    canGoPrevious,
    canGoNext,
    goPrevious,
    goNext,
    hasPagination,
  } = useResponsivePagination(filteredNotifications, { mobileItemsPerPage: 6, desktopItemsPerPage: 10 });

  const liveCount = notifications.filter((notification) => notification.status === 'live').length;
  const criticalCount = notifications.filter((notification) => notification.priority === 'critical').length;
  const resolvedCount = notifications.filter((notification) => notification.status === 'resolved').length;
  const dataSourceErrors = [
    ordersError ? `orders: ${ordersError}` : null,
    inventoryError ? `inventory: ${inventoryError}` : null,
    staffError ? `staff: ${staffError}` : null,
    tablesError ? `tables: ${tablesError}` : null,
    broadcastsError ? `broadcasts: ${broadcastsError}` : null,
  ].filter(Boolean);

  const refreshNow = async () => {
    setRefreshing(true);
    try {
      await Promise.allSettled([refetchOrders(), refetchInventory(), refetchStaff(), refetchTables(), refetchBroadcasts()]);
    } finally {
      window.setTimeout(() => setRefreshing(false), 500);
    }
  };

  useEffect(() => {
    const currentLiveIds = new Set(
      notifications
        .filter((notification) => notification.status === 'live' || notification.priority === 'critical')
        .map((notification) => notification.id)
        .filter(Boolean)
    );

    if (previousLiveIdsRef.current.size === 0) {
      previousLiveIdsRef.current = currentLiveIds;
      return;
    }

    const newLiveNotifications = notifications.filter(
      (notification) =>
        (notification.status === 'live' || notification.priority === 'critical') &&
        notification.id &&
        !previousLiveIdsRef.current.has(notification.id)
    );

    previousLiveIdsRef.current = currentLiveIds;

    if (newLiveNotifications.length > 0) {
      playLoudBuzzer('manager');
      setAlertMessage(
        newLiveNotifications.length > 1
          ? `${newLiveNotifications.length} new live notifications need attention.`
          : newLiveNotifications[0].title
      );
    }
  }, [notifications]);

  useEffect(() => {
    const accessToken = getCurrentPortalAccessToken();
    if (!accessToken) {
      return undefined;
    }

    return subscribeToOrderEvents(
      (payload) => {
        if (payload?.type === 'order.discount_approved') {
          refetchOrders();
        }
      },
      { eventName: 'notification' }
    );
  }, [refetchOrders]);

  if (notificationsFeatureDisabled) {
    return (
      <Card className="p-6">
        <EmptyState
          icon={BellRing}
          title="Notifications are disabled"
          description="This feature has been turned off from the developer console."
        />
      </Card>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {alertMessage ? <Toast type="warning" message={alertMessage} onClose={() => setAlertMessage('')} autoDismissMs={6200} /> : null}
      {dataSourceErrors.length > 0 ? (
        <Toast
          type="error"
          message="Live notifications are temporarily unavailable. Please refresh in a moment."
          onClose={() => {}}
          autoDismissMs={5200}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-card)]">
        <div className="flex items-start gap-3">
          <BellRing className="mt-0.5 h-5 w-5 text-[var(--color-primary)]" />
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Notification alert queue</p>
            <p className="text-sm text-[var(--text-secondary)]">Live items stay visible here with the same louder manager buzzer.</p>
          </div>
        </div>
        <Button variant="secondary" onClick={refreshNow} className={refreshing ? 'animate-pulse' : ''}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          icon={BellRing}
          label="All Updates"
          value={notifications.length}
          helper="Everything in the feed"
        />
        <SummaryCard
          icon={AlertTriangle}
          label="Need Attention"
          value={liveCount + criticalCount}
          helper="Live and critical items"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Resolved"
          value={resolvedCount}
          helper="Completed updates"
        />
      </div>

      {dataSourceErrors.length > 0 ? (
        <Card className="border-amber-500/30 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-700 dark:text-amber-200">
            Live updates are temporarily unavailable.
          </p>
          <p className="mt-1 text-sm leading-6 text-amber-700/80 dark:text-amber-100/80">
            Please refresh the page in a moment.
          </p>
        </Card>
      ) : null}

      <Card className="p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {QUICK_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setActiveFilter(filter.id)}
              className={`min-h-[2.75rem] rounded-xl border px-4 text-sm font-semibold transition ${
                activeFilter === filter.id
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-card-muted)] text-[var(--text-primary)] hover:bg-[var(--color-primary-soft)]'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Feed</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Latest notifications</h2>
          </div>
          {loading ? <Loader className="h-5 w-5 animate-spin text-[var(--color-primary)]" /> : null}
        </div>

        <div className="mt-4 space-y-3">
          {filteredNotifications.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="No notifications to show"
              description="This view is clear right now."
            />
          ) : (
            paginatedNotifications.map((notification) => {
              const priorityMeta = getPriorityMeta(notification.priority);
              const statusLabel =
                notification.status === 'live'
                  ? 'Needs action'
                  : notification.status === 'resolved'
                    ? 'Done'
                    : '';

              return (
                <article
                  key={notification.id}
                  className={`rounded-2xl border p-4 sm:p-5 ${priorityMeta.border}`}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-base font-semibold text-[var(--text-primary)] sm:text-lg">{notification.title}</h3>
                      </div>
                      {statusLabel ? (
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                          notification.status === 'live'
                            ? 'bg-amber-500/15 text-amber-700 dark:text-amber-200'
                            : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-200'
                        }`}>
                          {statusLabel}
                        </span>
                      ) : null}
                    </div>

                    <div className="min-w-0">
                      <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{notification.detail}</p>
                    </div>

                    <p className="text-xs font-medium text-[var(--text-secondary)]">
                      {getFriendlyTimestamp(notification.timestamp)}
                    </p>
                  </div>
                </article>
              );
            })
          )}
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
      </Card>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, helper }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-[var(--text-secondary)]">{label}</p>
          <p className="mt-2 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">{value}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{helper}</p>
        </div>
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}
