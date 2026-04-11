import {
  BarChart3,
  BellRing,
  Calendar,
  ChefHat,
  ClipboardList,
  Loader,
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
  isUnpaidOrder,
} from '../utils/adminMonitoring';
import { isSettled } from '../utils/managerPortal';
import { isSettledAnalyticsOrder } from '../utils/analyticsInsights';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatCard from '../components/common/StatCard';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ResponsiveGrid from '../components/common/ResponsiveGrid';
import Modal from '../components/common/Modal';

export default function Dashboard() {
  const { data: profile, loading, refetch: refetchProfile } = useApi(restaurantAPI.getProfile);
  const { data: ordersData = {}, refetch: refetchOrders } = useApi(() => orderAPI.getOrders({ limit: 150 }));
  const { data: staffData = {}, refetch: refetchStaff } = useApi(() => restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true }));
  const { data: tablesData = {}, refetch: refetchTables } = useApi(() => tableAPI.getTables({}));
  const { data: broadcastsData = {}, refetch: refetchBroadcasts } = useApi(() => restaurantAPI.getBroadcasts({ limit: 5 }));
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
  const broadcasts = broadcastsData?.items || [];

  const todayDate = new Date().toDateString();
  const todayOrders = useMemo(
    () => orders.filter((order) => new Date(order.createdAt).toDateString() === todayDate),
    [orders, todayDate]
  );
  // Count SETTLED orders for today's revenue using analytics-consistent logic
  // Includes both 'completed' and 'served' order statuses as settled
  const todayRevenue = useMemo(() => {
    const getOrderAmount = (order) => {
      return Number(
        order?.finalAmount ||
        order?.totalAmount ||
        order?.total ||
        order?.billing?.grandTotal ||
        order?.billing?.totalAmount ||
        0
      );
    };

    // First try to get settled orders from today
    const todaySettled = todayOrders.filter(isSettledAnalyticsOrder);
    if (todaySettled.length > 0) {
      return todaySettled.reduce((sum, order) => sum + getOrderAmount(order), 0);
    }
    
    // Fallback: if no orders today but orders exist, show settled revenue from recent orders
    // This handles timezone shift scenarios
    if (orders.length > 0) {
      const recentSettled = orders.filter(isSettledAnalyticsOrder);
      if (recentSettled.length > 0) {
        return recentSettled.reduce((sum, order) => sum + getOrderAmount(order), 0);
      }
    }
    
    return 0;
  }, [todayOrders, orders]);
  const activeUsers = staff.filter((member) => member.status === 'active').length;
  const availableTables = tables.filter((table) => table.status === 'available').length;
  const lowStockCount = inventorySummary?.lowStockCount || 0;
  const lowStockItems = inventorySummary?.lowStockItems || [];
  // Count unique tables with active orders (pending, preparing, ready, served, awaiting approval)
  const activeTables = useMemo(
    () => {
      const activeTableIds = new Set(
        orders
          .filter((order) => ACTIVE_ORDER_STATUSES.has(order.status) && order.tableId)
          .map((order) => order.tableId)
      );
      // Also count tables that are marked as occupied/busy
      const busyTables = tables.filter((table) => table.status === 'occupied' || table.status === 'busy');
      busyTables.forEach((table) => activeTableIds.add(table.id));
      return activeTableIds.size;
    },
    [orders, tables]
  );
  const totalOrders = orders.length;
  const pendingKot = orders.filter((order) => order.status === 'pending').length;
  const [showEodSummary, setShowEodSummary] = useState(false);

  useAutoRefresh(
    () =>
      Promise.allSettled([
        refetchProfile(),
        refetchOrders(),
        refetchStaff(),
        refetchTables(),
        refetchBroadcasts(),
        refetchInventory(),
        refetchEod(),
        refetchLoyalty(),
      ]),
    12000
  );

  // Debug: Log orders data to diagnose revenue calculation
  useEffect(() => {
    if (orders && orders.length > 0) {
      console.log('📊 Dashboard Orders DEBUG:', {
        totalOrders: orders.length,
        firstOrder: orders[0],
        allStatuses: [...new Set(orders.map(o => o.status))],
        settledOrders: orders.filter(isSettledAnalyticsOrder),
        todayOrders: orders.filter((order) => new Date(order.createdAt).toDateString() === new Date().toDateString()),
      });
    }
  }, [orders]);

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
          label="Total Revenue"
          value={formatCurrency(orders.filter(isSettledAnalyticsOrder).reduce((sum, order) => sum + Number(order.finalAmount || order.totalAmount || order.total || 0), 0))}
          subtitle="All settled orders loaded"
          iconTone="bg-emerald-500/15 text-emerald-400"
        />
        <StatCard
          icon={Users}
          label="Active Staff"
          value={activeUsers}
          subtitle={`${availableTables} tables available`}
          iconTone="bg-cyan-500/15 text-cyan-400"
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
              <p className="mt-1 text-sm text-[var(--text-secondary)]">Track today&apos;s orders and revenue live from this dashboard.</p>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Platform Updates</p>
            <h3 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Broadcast Notifications</h3>
          </div>
          <BellRing className="h-5 w-5 text-[var(--color-primary)]" />
        </div>

        <div className="mt-5 space-y-3">
          {broadcasts.length === 0 ? (
            <EmptyState
              icon={BellRing}
              title="No broadcast messages"
              description="Platform-wide announcements from the developer console will appear here."
            />
          ) : (
            broadcasts.map((broadcast) => (
              <div
                key={broadcast.id}
                className="rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-base font-semibold text-[var(--text-primary)]">{broadcast.title}</p>
                    <p className="mt-2 text-sm text-[var(--text-secondary)]">{broadcast.message}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                    Broadcast
                  </span>
                </div>
                <p className="mt-3 text-xs text-[var(--text-secondary)]">{formatDate(broadcast.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      </Card>

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
