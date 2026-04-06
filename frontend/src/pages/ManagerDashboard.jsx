import {
  AlertTriangle,
  ChefHat,
  DollarSign,
  Package,
  Receipt,
  ShoppingBag,
  TableProperties,
  Users,
  Zap,
} from 'lucide-react';
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { inventoryAPI, kitchenAPI, orderAPI, restaurantAPI, tableAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDisplayOrderNumber } from '../utils/formatters';
import {
  getOrderAgeMinutes,
  getOrderSourceLabel,
  getTableActivity,
  getTopSellingItems,
  isBusyTable,
  isDelayedOrder,
  isSettled,
} from '../utils/managerPortal';
import { useManagerStore } from '../context/managerStore';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';
import ResetRequestsPanel from '../components/manager/ResetRequestsPanel';

const QUICK_ACTIONS = [
  { label: 'Quick Open Table', href: '/manager/tables', helper: 'Open or reassign a table fast' },
  { label: 'Quick Add Order', href: '/manager/takeaway-orders', helper: 'Create and settle a takeaway order fast' },
  { label: 'Quick Bill Close', href: '/manager/bills', helper: 'Mark a table bill paid quickly' },
];

export default function ManagerDashboard() {
  const { data: ordersData = {}, loading, refetch: refetchOrders } = useApi(() => orderAPI.getOrders({ limit: 150 }));
  const { data: tablesData = {}, refetch: refetchTables } = useApi(() => tableAPI.getTables({ limit: 200 }));
  const { data: kitchenTickets = [], refetch: refetchKitchen } = useApi(kitchenAPI.getActiveOrders);
  const { data: inventorySummary = {}, refetch: refetchInventory } = useApi(inventoryAPI.getSummary);
  const { data: staffData = {}, refetch: refetchStaff } = useApi(() => restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true }));
  const tableAssignments = useManagerStore((state) => state.tableAssignments);
  const tableClosures = useManagerStore((state) => state.tableClosures);
  const tableTransfers = useManagerStore((state) => state.tableTransfers);
  const tableMerges = useManagerStore((state) => state.tableMerges);
  const prioritizedOrders = useManagerStore((state) => state.prioritizedOrders);

  const orders = ordersData?.items || [];
  const tables = tablesData?.tables || [];
  const staff = staffData?.staff || [];
  const waiters = staff.filter((member) => member.role === 'staff');
  const topSellingItems = useMemo(() => getTopSellingItems(orders), [orders]);

  const todayKey = new Date().toDateString();
  const todayOrders = useMemo(
    () => orders.filter((order) => new Date(order.createdAt).toDateString() === todayKey),
    [orders, todayKey]
  );
  const todayRevenue = todayOrders.filter(isSettled).reduce((sum, order) => sum + Number(order.totalAmount || order.total || 0), 0);
  const runningOrders = orders.filter((order) => ['pending', 'preparing', 'ready', 'served', 'awaiting_waiter_approval'].includes(order.status));
  const delayedOrders = runningOrders.filter((order) => isDelayedOrder(order));
  const floorTables = tables
    .map((table) =>
      getTableActivity(table, runningOrders, tableAssignments, tableClosures, tableTransfers, tableMerges, tables)
    )
    .filter((table) => !table.isMergedSecondary);
  const activeTables = floorTables.filter((table) => table.effectiveStatus === 'busy');
  const lowStockItems = inventorySummary?.lowStockItems || [];
  const busyTables = floorTables.filter(isBusyTable);
  const pendingKot = Array.isArray(kitchenTickets) ? kitchenTickets.filter((ticket) => ticket.status === 'pending') : [];
  const priorityOrders = runningOrders.filter((order) => prioritizedOrders[order.id]?.priority === 'high');

  useAutoRefresh(() => Promise.allSettled([refetchOrders(), refetchTables(), refetchKitchen(), refetchInventory(), refetchStaff()]), 12000);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.href}
            to={action.href}
            className="rounded-2xl border border-[var(--border-color)] bg-[var(--color-surface-muted)] px-4 py-4 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
          >
            <p className="text-sm font-bold text-[var(--text-primary)]">{action.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard icon={TableProperties} label="Active Tables" value={activeTables.length} subtitle="Tables with live service" tone="primary" />
        <StatCard icon={Receipt} label="Running Orders" value={runningOrders.length} subtitle="QR, POS, and waiter orders" tone="neutral" />
        <StatCard icon={DollarSign} label="Today Revenue" value={formatCurrency(todayRevenue)} subtitle="Collected or settled today" tone="success" />
        <StatCard icon={ChefHat} label="Pending KOT" value={pendingKot.length} subtitle="Waiting to start in kitchen" tone="warning" />
        <StatCard icon={AlertTriangle} label="Active Alerts" value={lowStockItems.length + delayedOrders.length + busyTables.length} subtitle="Low stock, delays, busy tables" tone="danger" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-[var(--text-secondary)]">Alerts & Notifications</p>
              <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Priority alerts</h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-surface-muted)] px-3 py-2 text-xs font-semibold text-[var(--text-secondary)]">
              <Zap className="h-4 w-4" />
              System aware
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {lowStockItems.length === 0 && delayedOrders.length === 0 && busyTables.length === 0 && priorityOrders.length === 0 ? (
              <EmptyState icon={Users} title="No urgent alerts" description="Service is stable right now." />
            ) : null}

            {priorityOrders.slice(0, 3).map((order) => (
              <AlertRow
                key={`priority-${order.id}`}
                tone="danger"
                title={`${formatDisplayOrderNumber(order)} is prioritized`}
                detail={`${getOrderSourceLabel(order)} order at table ${order.tableNumber || 'Walk-in'} is marked for immediate handling`}
              />
            ))}

            {lowStockItems.slice(0, 3).map((item) => (
              <AlertRow
                key={`stock-${item.id}`}
                tone="danger"
                title={`${item.name} is low on stock`}
                detail={`${item.quantity} ${item.unit} left in tracked inventory`}
              />
            ))}

            {delayedOrders.slice(0, 4).map((order) => (
              <AlertRow
                key={`delay-${order.id}`}
                tone="warning"
                title={`${formatDisplayOrderNumber(order)} is delayed`}
                detail={`Table ${order.tableNumber || 'Walk-in'} has been open for ${getOrderAgeMinutes(order.createdAt)} mins`}
              />
            ))}

            {busyTables.slice(0, 3).map((table) => (
              <AlertRow
                key={`table-${table.id}`}
                tone="neutral"
                title={`Table ${table.tableNumber} is overloaded`}
                detail={`${table.activeOrders.length} active bills need manager attention`}
              />
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <p className="text-sm text-[var(--text-secondary)]">Daily Reports</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Light summary</h2>
            <div className="mt-4 space-y-3">
              <SummaryRow icon={DollarSign} label="Today revenue" value={formatCurrency(todayRevenue)} />
              <SummaryRow icon={Receipt} label="Total orders" value={String(todayOrders.length)} />
              <SummaryRow icon={Users} label="Waiters on floor" value={String(waiters.length)} />
              <SummaryRow
                icon={ShoppingBag}
                label="Top selling item"
                value={topSellingItems[0] ? `${topSellingItems[0].name} (${topSellingItems[0].quantity})` : 'No sales yet'}
              />
            </div>
          </Card>

          <Card>
            <p className="text-sm text-[var(--text-secondary)]">Kitchen Watch</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Incoming queue</h2>
            <div className="mt-4 space-y-3">
              {pendingKot.length === 0 ? (
                <p className="text-sm text-[var(--text-secondary)]">No pending KOT tickets.</p>
              ) : (
                pendingKot.slice(0, 5).map((ticket) => (
                  <div key={ticket.id} className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                    <p className="font-semibold text-[var(--text-primary)]">{ticket.displayOrderNumber || formatDisplayOrderNumber(ticket)}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">
                      Table {ticket.tableNumber || 'Walk-in'} • {(ticket.items || []).length} items
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <ResetRequestsPanel />

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <p className="text-sm text-[var(--text-secondary)]">Top Sellers</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">What is moving today</h2>
          <div className="mt-4 space-y-3">
            {topSellingItems.slice(0, 5).map((item) => (
              <div key={item.key} className="flex items-center justify-between rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3">
                <div className="flex items-center gap-3">
                  <Package className="h-4 w-4 text-[var(--color-primary)]" />
                  <span className="font-semibold text-[var(--text-primary)]">{item.name}</span>
                </div>
                <span className="text-sm text-[var(--text-secondary)]">{item.quantity} sold</span>
              </div>
            ))}
            {topSellingItems.length === 0 ? <p className="text-sm text-[var(--text-secondary)]">No item movement yet today.</p> : null}
          </div>
        </Card>

        <Card>
          <p className="text-sm text-[var(--text-secondary)]">Running Order Feed</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Operations snapshot</h2>
          <div className="mt-4 space-y-3">
            {runningOrders.slice(0, 5).map((order) => (
              <div key={order.id} className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--text-primary)]">{formatDisplayOrderNumber(order)}</p>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">{getOrderSourceLabel(order)}</span>
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Table {order.tableNumber || 'Walk-in'} • {order.status}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-secondary)]">Refreshing manager metrics...</p>
      ) : null}
    </div>
  );
}

function AlertRow({ tone = 'neutral', title, detail }) {
  const toneClass = tone === 'danger'
    ? 'border-red-500/20 bg-red-500/10'
    : tone === 'warning'
      ? 'border-amber-500/20 bg-amber-500/10'
      : 'border-[var(--border-color)] bg-[var(--color-surface-muted)]';

  return (
    <div className={`rounded-2xl border p-4 ${toneClass}`}>
      <p className="font-semibold text-[var(--text-primary)]">{title}</p>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

function SummaryRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center justify-between rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3">
      <div className="flex items-center gap-3">
        <Icon className="h-4 w-4 text-[var(--color-primary)]" />
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
      <span className="text-sm font-semibold text-[var(--text-primary)]">{value}</span>
    </div>
  );
}
