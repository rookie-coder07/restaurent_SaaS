import { BarChart3, Calendar, Loader, TrendingUp, Users } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { restaurantAPI, orderAPI, tableAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate } from '../utils/formatters';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import Skeleton from '../components/common/Skeleton';
import EmptyState from '../components/common/EmptyState';
import ResponsiveGrid from '../components/common/ResponsiveGrid';

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
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-cyan-400/10 to-transparent" />
        <div className="relative mb-1 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--text-secondary)]">Dashboard</p>
            <h2 className="mt-2 text-lg font-bold text-[var(--text-primary)] md:text-2xl">Restaurant Overview</h2>
            <p className="mt-1 text-xs text-[var(--text-secondary)] md:text-sm">
              Welcome back, {profile?.name || 'Restaurant Admin'}. Here&apos;s your restaurant performance for today.
            </p>
          </div>
        </div>
      </Card>

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
                  className="flex w-full flex-col gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-5 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[var(--text-primary)]">Order #{order.id?.slice(-8)}</p>
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
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-5">
              <p className="text-sm text-[var(--text-secondary)]">Staff</p>
              <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{staff.length} team members</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{activeUsers} active right now</p>
            </div>

            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-5">
              <p className="text-sm text-[var(--text-secondary)]">Tables</p>
              <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{tables.length} configured tables</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{availableTables} currently available</p>
            </div>

            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-5">
              <p className="text-sm text-[var(--text-secondary)]">Performance</p>
              <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                {todayOrders.length > 0 ? 'Service is active' : 'No order activity yet'}
              </p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">
                Average order value is {formatCurrency(avgOrderValue)} today.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
