import { BarChart3, Calendar, Loader, TrendingUp, Users } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { restaurantAPI, orderAPI, tableAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate } from '../utils/formatters';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';

export default function Dashboard() {
  const { data: profile, loading } = useApi(restaurantAPI.getProfile);
  const { data: ordersData = {} } = useApi(() => orderAPI.getOrders({ limit: 20 }));
  const { data: staffData = {} } = useApi(() => restaurantAPI.getStaff(100, 0));
  const { data: tablesData = {} } = useApi(() => tableAPI.getTables({}));

  const orders = ordersData?.items || [];
  const staff = staffData?.staff || [];
  const tables = tablesData?.tables || [];

  const todayDate = new Date().toDateString();
  const todayOrders = orders.filter((order) => new Date(order.createdAt).toDateString() === todayDate);
  const todayRevenue = todayOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0);
  const avgOrderValue = todayOrders.length > 0 ? todayRevenue / todayOrders.length : 0;
  const activeUsers = staff.filter((member) => member.status === 'active').length;
  const availableTables = tables.filter((table) => table.status === 'available').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-40 w-full" />
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(79,70,229,0.16),_transparent_40%),var(--color-surface)]">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--color-text-subtle)]">
              SaaS Command Center
            </p>
            <h1 className="mt-3 break-words text-3xl font-bold text-[var(--color-text)] sm:text-4xl">
              Welcome back, {profile?.name || 'Restaurant Admin'}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--color-text-muted)] sm:text-base">
              Keep an eye on orders, revenue, staff activity, and table availability from one consistent workspace.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div className="rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Live Orders</p>
              <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">{todayOrders.length}</p>
            </div>
            <div className="rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Revenue</p>
              <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">{formatCurrency(todayRevenue)}</p>
            </div>
            <div className="rounded-2xl bg-[var(--color-surface-muted)] px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Tables Open</p>
              <p className="mt-2 text-2xl font-bold text-[var(--color-text)]">{availableTables}</p>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          icon={BarChart3}
          label="Today's Orders"
          value={todayOrders.length}
          subtitle="Orders placed since midnight"
          tone="primary"
        />
        <StatCard
          icon={TrendingUp}
          label="Today's Revenue"
          value={formatCurrency(todayRevenue)}
          subtitle="Gross sales today"
          tone="success"
        />
        <StatCard
          icon={Calendar}
          label="Avg Order Value"
          value={formatCurrency(avgOrderValue)}
          subtitle="Average ticket size"
          tone="warning"
        />
        <StatCard
          icon={Users}
          label="Active Staff"
          value={activeUsers}
          subtitle={`${availableTables} tables currently available`}
          tone="neutral"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr,0.8fr]">
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)]">Recent Orders</h2>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">Most recent order activity in your restaurant</p>
            </div>
            {loading ? <Loader className="h-5 w-5 animate-spin text-[var(--color-primary)]" /> : null}
          </div>

          <div className="mt-5 space-y-3">
            {orders.length === 0 ? (
              <EmptyState
                icon={BarChart3}
                title="No orders yet"
                description="New orders will appear here once customers begin placing them."
              />
            ) : (
              orders.slice(0, 6).map((order) => (
                <div
                  key={order.id}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-[var(--color-text)]">
                      Order #{order.id?.slice(-8)}
                    </p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      Table {order.tableNumber || 'N/A'} • {formatDate(order.createdAt)}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-base font-bold text-[var(--color-text)]">
                      {formatCurrency(order.totalAmount || 0)}
                    </p>
                    <p className="text-sm capitalize text-[var(--color-text-muted)]">{order.status || 'pending'}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-bold text-[var(--color-text)]">Operational Snapshot</h2>
          <p className="mt-1 text-sm text-[var(--color-text-muted)]">A quick summary of your current workspace.</p>

          <div className="mt-5 space-y-4">
            <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Staff</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{staff.length} team members</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{activeUsers} active right now</p>
            </div>

            <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Tables</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">{tables.length} configured tables</p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">{availableTables} currently available</p>
            </div>

            <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Performance</p>
              <p className="mt-2 text-lg font-semibold text-[var(--color-text)]">
                {todayOrders.length > 0 ? 'Service is active today' : 'No order activity yet'}
              </p>
              <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                Avg order value is {formatCurrency(avgOrderValue)} today.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
