import { useMemo, useState } from 'react';
import { Download, Loader, TrendingUp } from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { orderAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate, formatDisplayOrderNumber } from '../utils/formatters';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import StatCard from '../components/common/StatCard';
import EmptyState from '../components/common/EmptyState';

function isSettledOrder(order) {
  return order?.status === 'completed' || order?.paymentStatus === 'paid';
}

export default function Analytics() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });
  const { data: ordersData = {}, loading } = useApi(() => orderAPI.getOrders({ limit: 1000 }));
  const orders = ordersData?.items || [];

  const filteredOrders = useMemo(() => {
    return orders.filter((order) => {
      const createdAt = new Date(order.createdAt);
      const startMatch = !dateRange.start || createdAt >= new Date(dateRange.start);
      const endMatch = !dateRange.end || createdAt <= new Date(`${dateRange.end}T23:59:59`);
      return startMatch && endMatch;
    });
  }, [orders, dateRange]);

  const settledOrders = filteredOrders.filter((order) => isSettledOrder(order));
  const totalOrders = filteredOrders.length;
  const totalRevenue = settledOrders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);
  const avgOrderValue = settledOrders.length > 0 ? totalRevenue / settledOrders.length : 0;
  const completedOrders = settledOrders.length;

  const dailyData = {};
  settledOrders.forEach((order) => {
    const date = new Date(order.createdAt).toLocaleDateString();
    if (!dailyData[date]) {
      dailyData[date] = { date, orders: 0, revenue: 0 };
    }
    dailyData[date].orders += 1;
    dailyData[date].revenue += order.totalAmount || order.total || 0;
  });
  const chartData = Object.values(dailyData).sort((a, b) => new Date(a.date) - new Date(b.date));

  const statusData = [
    { name: 'Settled', value: completedOrders, color: '#10B981' },
    { name: 'Pending', value: filteredOrders.filter((order) => order.status === 'pending').length, color: '#F59E0B' },
    { name: 'Preparing', value: filteredOrders.filter((order) => order.status === 'preparing').length, color: '#3B82F6' },
    { name: 'Ready', value: filteredOrders.filter((order) => order.status === 'ready').length, color: '#8B5CF6' },
    { name: 'Served', value: filteredOrders.filter((order) => order.status === 'served').length, color: '#64748B' },
    { name: 'Cancelled', value: filteredOrders.filter((order) => order.status === 'cancelled').length, color: '#EF4444' },
  ].filter((entry) => entry.value > 0);

  const topItemsFrequency = {};
  filteredOrders.forEach((order) => {
    (order.items || []).forEach((item) => {
      if (!topItemsFrequency[item.name]) {
        topItemsFrequency[item.name] = { name: item.name, quantity: 0, revenue: 0 };
      }
      topItemsFrequency[item.name].quantity += item.quantity || 1;
      topItemsFrequency[item.name].revenue += (item.price * (item.quantity || 1)) || 0;
    });
  });
  const topItems = Object.values(topItemsFrequency).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(79,70,229,0.14),_transparent_35%),var(--color-surface)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Analytics</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Restaurant performance at a glance</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Review revenue trends, order health, and top-performing items across your selected date range.
            </p>
          </div>
          <Button variant="secondary">
            <Download className="h-4 w-4" />
            Export Report
          </Button>
        </div>
      </Card>

      <Card>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Input label="From Date" type="date" value={dateRange.start} onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })} />
          <Input label="To Date" type="date" value={dateRange.end} onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })} />
          <div className="rounded-[1.25rem] bg-[var(--color-surface-muted)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Range Summary</p>
            <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{totalOrders} orders in selected period</p>
            <p className="mt-1 text-sm text-[var(--color-text-muted)]">Settled revenue: {formatCurrency(totalRevenue)}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Orders" value={totalOrders} subtitle="Within selected range" tone="primary" />
        <StatCard label="Revenue" value={formatCurrency(totalRevenue)} subtitle="Settled sales only" tone="success" />
        <StatCard label="Avg Order Value" value={formatCurrency(avgOrderValue)} subtitle="Per settled bill" tone="neutral" />
        <StatCard
          icon={TrendingUp}
          label="Settled"
          value={completedOrders}
          subtitle={`${totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}% of orders collected`}
          tone="warning"
        />
      </div>

      {filteredOrders.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No analytics data yet"
          description="Once orders are placed, charts and performance metrics will appear here."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Card>
              <h2 className="text-lg font-bold text-[var(--color-text)]">Revenue Trend</h2>
              <div className="mt-4 h-[280px] w-full sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} name="Revenue" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card>
              <h2 className="text-lg font-bold text-[var(--color-text)]">Orders Trend</h2>
              <div className="mt-4 h-[280px] w-full sm:h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="orders" fill="#10B981" name="Orders" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            {statusData.length > 0 ? (
              <Card>
                <h2 className="text-lg font-bold text-[var(--color-text)]">Order Status Distribution</h2>
                <div className="mt-4 h-[280px] w-full sm:h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} cx="50%" cy="50%" outerRadius={96} dataKey="value" labelLine={false}>
                        {statusData.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            ) : null}

            {topItems.length > 0 ? (
              <Card>
                <h2 className="text-lg font-bold text-[var(--color-text)]">Top Menu Items</h2>
                <div className="mt-4 space-y-3">
                  {topItems.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--color-surface-muted)] p-4">
                      <div className="min-w-0">
                        <p className="break-words font-semibold text-[var(--color-text)]">{item.name}</p>
                        <p className="text-sm text-[var(--color-text-muted)]">{item.quantity} sold</p>
                      </div>
                      <p className="shrink-0 font-semibold text-[var(--color-primary)]">{formatCurrency(item.revenue)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}
          </div>

          <Card>
            <h2 className="text-lg font-bold text-[var(--color-text)]">Recent Orders</h2>
            <div className="mt-4 space-y-3">
              {filteredOrders.slice(0, 10).map((order) => (
                <div key={order.id} className="flex flex-col gap-3 rounded-2xl border border-[var(--color-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold text-[var(--color-text)]">{formatDisplayOrderNumber(order)}</p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{formatDate(order.createdAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                    <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-sm font-semibold text-[var(--color-text)]">
                      {formatCurrency(order.totalAmount || order.total || 0)}
                    </span>
                    <span className="rounded-full bg-[var(--color-primary-soft)] px-3 py-1 text-xs font-semibold text-[var(--color-primary)]">
                      {order.status}
                    </span>
                    <span className="rounded-full bg-[var(--color-surface-muted)] px-3 py-1 text-xs font-semibold text-[var(--color-text)]">
                      {order.paymentStatus || 'unpaid'}
                    </span>
                    <span className="text-sm text-[var(--color-text-muted)]">{order.items?.length || 0} items</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
