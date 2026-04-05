import {
  AlertTriangle,
  BarChart3,
  BellRing,
  Calendar,
  ChefHat,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Gift,
  Loader,
  Receipt,
  ShieldAlert,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useApi } from '../hooks/useApi';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { analyticsAPI, restaurantAPI, orderAPI, tableAPI, inventoryAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate, formatDisplayOrderNumber } from '../utils/formatters';
import { useManagerStore } from '../context/managerStore';
import {
  ACTIVE_ORDER_STATUSES,
  buildActivityLog,
  buildPeakHours,
  buildSmartNotifications,
  getPriorityMeta,
  isUnpaidOrder,
} from '../utils/adminMonitoring';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatCard from '../components/common/StatCard';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ResponsiveGrid from '../components/common/ResponsiveGrid';
import Modal from '../components/common/Modal';

function DashboardSection({
  sectionKey,
  title,
  subtitle,
  collapsedSections,
  toggleSection,
  children,
  defaultOpen = true,
}) {
  const isOpen = collapsedSections[sectionKey] ?? defaultOpen;
  const ToggleIcon = isOpen ? ChevronUp : ChevronDown;

  return (
    <Card>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{title}</h3>
        </div>
        <Button variant="ghost" size="sm" onClick={() => toggleSection(sectionKey)} aria-expanded={isOpen}>
          <ToggleIcon className="h-4 w-4" />
          {isOpen ? 'Collapse' : 'Expand'}
        </Button>
      </div>

      {isOpen ? <div className="mt-5">{children}</div> : null}
    </Card>
  );
}

export default function Dashboard() {
  const { data: profile, loading, refetch: refetchProfile } = useApi(restaurantAPI.getProfile);
  const { data: ordersData = {}, refetch: refetchOrders } = useApi(() => orderAPI.getOrders({ limit: 150 }));
  const { data: staffData = {}, refetch: refetchStaff } = useApi(() => restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true }));
  const { data: tablesData = {}, refetch: refetchTables } = useApi(() => tableAPI.getTables({}));
  const { data: inventorySummary = {}, refetch: refetchInventory } = useApi(inventoryAPI.getSummary);
  const { data: latestEodSummary, refetch: refetchEod } = useApi(() => analyticsAPI.getLatestEodSummary({ ensure: true }));
  const { data: loyaltySummary, refetch: refetchLoyalty } = useApi(analyticsAPI.getLoyaltySummary);
  const tableClosures = useManagerStore((state) => state.tableClosures);
  const tableTransfers = useManagerStore((state) => state.tableTransfers);
  const tableMerges = useManagerStore((state) => state.tableMerges);
  const approvedDiscounts = useManagerStore((state) => state.approvedDiscounts);
  const stockRequests = useManagerStore((state) => state.stockRequests);
  const waiterActivity = useManagerStore((state) => state.waiterActivity);

  const orders = ordersData?.items || [];
  const staff = staffData?.staff || [];
  const tables = tablesData?.tables || [];

  const todayDate = new Date().toDateString();
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === todayDate);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const avgOrderValue = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;
  const activeUsers = staff.filter((member) => member.status === 'active').length;
  const availableTables = tables.filter((table) => table.status === 'available').length;
  const lowStockCount = inventorySummary?.lowStockCount || 0;
  const lowStockItems = inventorySummary?.lowStockItems || [];
  const recentHistory = inventorySummary?.recentHistory || [];
  const activeTables = useMemo(
    () =>
      new Set(
        orders
          .filter((order) => ACTIVE_ORDER_STATUSES.has(order.status) && order.tableId)
          .map((order) => order.tableId)
      ).size,
    [orders]
  );
  const totalOrders = orders.length;
  const pendingKot = orders.filter((order) => order.status === 'pending').length;
  const unpaidBills = orders.filter((order) => isUnpaidOrder(order));
  const discountUsageCount = Object.keys(approvedDiscounts || {}).length;
  const waiters = staff.filter((member) => member.role === 'staff' && member.status === 'active');
  const managers = staff.filter((member) => member.role === 'manager' && member.status === 'active');
  const loyaltyMembers = loyaltySummary?.summary?.activeMembers || 0;
  const loyaltyRedeemedAmount = loyaltySummary?.summary?.totalRedeemedAmount || 0;
  const peakHours = useMemo(() => buildPeakHours(orders), [orders]);
  const notifications = useMemo(
    () => buildSmartNotifications({ orders, lowStockItems, approvedDiscounts }).slice(0, 8),
    [approvedDiscounts, lowStockItems, orders]
  );
  const activityLog = useMemo(
    () =>
      buildActivityLog({
        orders,
        staff,
        tables,
        recentHistory,
        tableClosures,
        tableTransfers,
        tableMerges,
        approvedDiscounts,
        stockRequests,
        waiterActivity,
      }).slice(0, 12),
    [
      approvedDiscounts,
      orders,
      recentHistory,
      staff,
      stockRequests,
      tableClosures,
      tableMerges,
      tableTransfers,
      tables,
      waiterActivity,
    ]
  );
  const [collapsedSections, setCollapsedSections] = useState({
    activityLog: false,
    notifications: false,
    peakHours: true,
    billMonitor: true,
    staffMonitor: true,
  });
  const [showEodSummary, setShowEodSummary] = useState(false);

  useAutoRefresh(
    () =>
      Promise.allSettled([
        refetchProfile(),
        refetchOrders(),
        refetchStaff(),
        refetchTables(),
        refetchInventory(),
        refetchEod(),
        refetchLoyalty(),
      ]),
    12000
  );

  const toggleSection = (sectionKey) => {
    setCollapsedSections((current) => ({
      ...current,
      [sectionKey]: !(current[sectionKey] ?? false),
    }));
  };

  useEffect(() => {
    if (!latestEodSummary?.date) {
      return;
    }

    const storageKey = `admin:eod-summary:seen:${latestEodSummary.date}`;
    if (window.localStorage.getItem(storageKey) === 'true') {
      return;
    }

    setShowEodSummary(true);
  }, [latestEodSummary]);

  const dismissEodSummary = () => {
    if (latestEodSummary?.date) {
      window.localStorage.setItem(`admin:eod-summary:seen:${latestEodSummary.date}`, 'true');
    }
    setShowEodSummary(false);
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <ResponsiveGrid>
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 w-full rounded-2xl" />
          ))}
        </ResponsiveGrid>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 w-full rounded-2xl lg:col-span-2" />
          <Skeleton className="h-80 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="compact-page space-y-4">
      <ResponsiveGrid>
        <StatCard
          icon={BarChart3}
          label="Today's Orders"
          value={todayOrders.length}
          subtitle="Orders placed since midnight"
          iconTone="bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
        />
        <StatCard
          icon={TrendingUp}
          label="Today's Revenue"
          value={formatCurrency(todayRevenue)}
          subtitle="Gross sales today"
          iconTone="bg-emerald-500/15 text-emerald-400"
        />
        <StatCard
          icon={Calendar}
          label="Avg Order Value"
          value={formatCurrency(avgOrderValue)}
          subtitle="Average ticket size"
          iconTone="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          icon={Users}
          label="Active Staff"
          value={activeUsers}
          subtitle={`${availableTables} tables available`}
          iconTone="bg-cyan-500/15 text-cyan-400"
        />
        <StatCard
          icon={AlertTriangle}
          label="Low Stock Alerts"
          value={lowStockCount}
          subtitle={lowStockCount > 0 ? 'Needs restock attention' : 'Stock levels look healthy'}
          iconTone="bg-red-500/15 text-red-400"
        />
        <StatCard
          icon={Gift}
          label="Loyalty Members"
          value={loyaltyMembers}
          subtitle={loyaltyMembers > 0 ? `${formatCurrency(loyaltyRedeemedAmount)} redeemed so far` : 'Program ready for members'}
          iconTone="bg-violet-500/15 text-violet-300"
        />
      </ResponsiveGrid>

      <ResponsiveGrid>
        <StatCard
          icon={Calendar}
          label="Latest EOD"
          value={latestEodSummary ? formatCurrency(latestEodSummary.totalRevenue) : '--'}
          subtitle={latestEodSummary ? `${latestEodSummary.totalOrders} orders on ${latestEodSummary.date}` : 'Daily summary pending'}
          iconTone="bg-violet-500/15 text-violet-300"
        />
        <StatCard
          icon={ClipboardList}
          label="Total Orders"
          value={totalOrders}
          subtitle="Loaded for live admin monitoring"
          iconTone="bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
        />
        <StatCard
          icon={Users}
          label="Active Tables"
          value={activeTables}
          subtitle="Tables with live orders right now"
          iconTone="bg-cyan-500/15 text-cyan-400"
        />
        <StatCard
          icon={ChefHat}
          label="Pending KOT"
          value={pendingKot}
          subtitle="Orders waiting to move through kitchen"
          iconTone="bg-amber-500/15 text-amber-400"
        />
      </ResponsiveGrid>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Recent Activity</p>
              <h3 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Latest Orders</h3>
            </div>
            {loading ? <Loader className="h-5 w-5 animate-spin text-[var(--color-primary)]" /> : null}
          </div>

          <div className="mt-5 space-y-4">
            {orders.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No recent activity"
                description="Recent orders will appear here as soon as customers start placing them."
              />
            ) : (
              orders.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  className="flex w-full flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">{formatDisplayOrderNumber(order)}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Table {order.tableNumber || 'N/A'} • {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-xl font-semibold text-[var(--text-primary)]">
                      {formatCurrency(order.totalAmount || 0)}
                    </p>
                    <p className="text-sm capitalize text-[var(--text-secondary)]">{order.status || 'pending'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <p className="text-sm text-[var(--text-secondary)]">Operational Summary</p>
          <h3 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Today&apos;s Snapshot</h3>

          <div className="mt-5 space-y-4">
            <div className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Staff</p>
              <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{staff.length} team members</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{activeUsers} active right now</p>
            </div>

            <div className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Tables</p>
              <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{tables.length} configured tables</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{availableTables} currently available</p>
            </div>

            <div className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Performance</p>
              <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                {todayOrders.length > 0 ? 'Service is active' : 'No order activity yet'}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Average order value is {formatCurrency(avgOrderValue)} today.
              </p>
            </div>

            <div className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Inventory Alerts</p>
              <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                {lowStockCount > 0 ? `${lowStockCount} item${lowStockCount === 1 ? '' : 's'} low` : 'No urgent stock issues'}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                {lowStockItems.length > 0
                  ? lowStockItems.slice(0, 2).map((item) => item.name).join(', ')
                  : 'All tracked items are above their alert threshold.'}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.15fr,0.85fr]">
        <DashboardSection
          sectionKey="activityLog"
          title="System activity feed"
          subtitle="Activity Log"
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--bg-card-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
            <BarChart3 className="h-4 w-4" />
            Live synthesis
          </div>
          <div className="space-y-3">
            {activityLog.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title="No tracked activity yet"
                description="Manager, waiter, order, and inventory actions will appear here."
              />
            ) : (
              activityLog.map((entry) => (
                <div key={entry.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--text-primary)]">{entry.message}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{entry.detail}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                      {entry.actor}
                    </span>
                  </div>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                    {formatDate(entry.timestamp)}
                  </p>
                </div>
              ))
            )}
          </div>
        </DashboardSection>

        <div className="space-y-4">
          <DashboardSection
            sectionKey="notifications"
            title="Admin alert center"
            subtitle="Smart Notifications"
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            defaultOpen
          >
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--bg-card-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
              <BellRing className="h-4 w-4 text-[var(--color-primary)]" />
              Prioritized alerts
            </div>
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <EmptyState
                  icon={BellRing}
                  title="No active alerts"
                  description="Orders, bills, discounts, low stock, and delays are all clear."
                />
              ) : (
                notifications.map((notification) => {
                  const priorityMeta = getPriorityMeta(notification.priority);

                  return (
                    <div key={notification.id} className={`rounded-2xl border p-4 ${priorityMeta.border}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[var(--text-primary)]">{notification.title}</p>
                          <p className="mt-1 text-sm text-[var(--text-secondary)]">{notification.detail}</p>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] ${priorityMeta.badge}`}>
                          {priorityMeta.label}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </DashboardSection>

          <DashboardSection
            sectionKey="peakHours"
            title="Busiest service windows"
            subtitle="Peak Hours"
            collapsedSections={collapsedSections}
            toggleSection={toggleSection}
            defaultOpen={false}
          >
            <div className="space-y-3">
              {peakHours.length === 0 ? (
                <EmptyState
                  icon={TrendingUp}
                  title="No peak-hour data yet"
                  description="Order traffic will surface the busiest hours automatically."
                />
              ) : (
                peakHours.map((slot) => (
                  <div key={slot.hour} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-[var(--text-primary)]">{slot.label}</p>
                      <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                        {slot.orders} orders
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{formatCurrency(slot.revenue)} revenue in this hour</p>
                  </div>
                ))
              )}
            </div>
          </DashboardSection>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DashboardSection
          sectionKey="billMonitor"
          title="Billing visibility"
          subtitle="Bill Monitor"
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          defaultOpen={false}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--bg-card-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
            <Receipt className="h-4 w-4 text-[var(--color-primary)]" />
            Collections focus
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">All bills</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{orders.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Unpaid bills</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{unpaidBills.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Discount usage</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{discountUsageCount}</p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Unpaid exposure</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
              {formatCurrency(unpaidBills.reduce((sum, order) => sum + Number(order.totalAmount || order.total || 0), 0))}
            </p>
          </div>
        </DashboardSection>

        <DashboardSection
          sectionKey="staffMonitor"
          title="Waiters and managers"
          subtitle="Staff Monitor"
          collapsedSections={collapsedSections}
          toggleSection={toggleSection}
          defaultOpen={false}
        >
          <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-[var(--bg-card-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
            <ShieldAlert className="h-4 w-4 text-[var(--color-primary)]" />
            Team visibility
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Active waiters</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{waiters.length}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">Active managers</p>
              <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{managers.length}</p>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {waiters.slice(0, 4).map((waiter) => (
              <div key={waiter.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-[var(--text-primary)]">{waiter.name}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{waiter.email}</p>
                  </div>
                  <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-emerald-400">
                    Active
                  </span>
                </div>
              </div>
            ))}

            {waiters.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No active waiters"
                description="POS staff accounts will appear here once they are active."
              />
            ) : null}
          </div>
        </DashboardSection>
      </div>

      <Modal
        title={latestEodSummary ? `End-of-Day Summary • ${latestEodSummary.date}` : 'End-of-Day Summary'}
        isOpen={showEodSummary}
        onClose={dismissEodSummary}
        maxWidth="max-w-3xl"
      >
        {latestEodSummary ? (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{latestEodSummary.summaryMessage}</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Revenue</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{formatCurrency(latestEodSummary.totalRevenue)}</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Orders</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{latestEodSummary.totalOrders}</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Avg Order</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{formatCurrency(latestEodSummary.averageOrderValue)}</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Discounts</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{formatCurrency(latestEodSummary.totalDiscounts)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Top selling items</p>
                <div className="mt-3 space-y-2">
                  {(latestEodSummary.topItems || []).map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">{item.name}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Low performing items</p>
                <div className="mt-3 space-y-2">
                  {(latestEodSummary.lowPerformingItems || []).map((item) => (
                    <div key={item.name} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">{item.name}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Peak hours</p>
                <div className="mt-3 space-y-2">
                  {(latestEodSummary.peakHours || []).map((slot) => (
                    <div key={slot.label} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">{slot.label}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{slot.orders} orders</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button onClick={dismissEodSummary}>Close summary</Button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Calendar}
            title="No EOD summary yet"
            description="The previous day summary will appear here once the analytics snapshot is available."
          />
        )}
      </Modal>
    </div>
  );
}
