import { useMemo, useState } from 'react';
import { BarChart3, Clock3, Download, Loader, Package, Receipt, ShoppingBag, TrendingUp, Wallet } from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { analyticsAPI, inventoryAPI, orderAPI, restaurantAPI } from '../services/apiEndpoints';
import { formatCurrency } from '../utils/formatters';
import {
  buildAnalyticsCsv,
  buildAnalyticsSnapshot,
  getAnalyticsPresetRange,
} from '../utils/analyticsInsights';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import EmptyState from '../components/common/EmptyState';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';

const PIE_COLORS = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

const DATE_FILTER_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

const ORDER_TYPE_OPTIONS = [
  { key: 'all', label: 'All Orders' },
  { key: 'dine-in', label: 'Dine-In' },
  { key: 'takeaway', label: 'Takeaway' },
];

function AnalyticsSection({ title, subtitle, children, className = '' }) {
  return (
    <Card className={`overflow-hidden border border-[var(--border-color)] p-4 shadow-[0_18px_50px_rgba(15,23,42,0.08)] ${className}`.trim()}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[var(--text-secondary)]">{subtitle}</p> : null}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function MetricTile({ label, value, icon: Icon, accentClassName, helper }) {
  return (
    <div className="relative overflow-hidden rounded-[28px] border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-[0_16px_45px_rgba(15,23,42,0.08)]">
      <div className={`absolute inset-x-0 top-0 h-1 ${accentClassName}`} />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">{label}</p>
          <p className="mt-3 break-words text-3xl font-black leading-none text-[var(--text-primary)] sm:text-[2rem]">{value}</p>
          {helper ? <p className="mt-3 text-xs text-[var(--text-secondary)]">{helper}</p> : null}
        </div>
        <div className="rounded-2xl bg-[var(--bg-card-muted)] p-3 text-[var(--text-primary)]">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ItemPerformanceList({ items = [], emptyCopy = 'No item data yet.' }) {
  if (items.length === 0) {
    return (
      <div className="rounded-2xl bg-[var(--bg-card-muted)] px-4 py-5 text-sm text-[var(--text-secondary)]">
        {emptyCopy}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item.name}-${index}`} className="rounded-2xl bg-[var(--bg-card-muted)] px-4 py-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{item.name}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.quantity} sold</p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-[var(--color-primary)]">{formatCurrency(item.revenue)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricMiniCard({ label, value, toneClassName = 'text-[var(--text-primary)]' }) {
  return (
    <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
      <p className="text-sm text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-2 text-xl font-bold ${toneClassName}`}>{value}</p>
    </div>
  );
}

function getStaffPerformance(orders = [], staff = []) {
  const staffLookup = new Map();
  const aggregates = new Map();

  (staff || []).forEach((member) => {
    const normalizedName = String(member?.name || '').trim().toLowerCase();
    const normalizedEmail = String(member?.email || '').trim().toLowerCase();
    if (normalizedName) {
      staffLookup.set(normalizedName, member);
    }
    if (normalizedEmail) {
      staffLookup.set(normalizedEmail, member);
    }
  });

  orders.forEach((order) => {
    const actorKey = String(order?.billing?.cashierName || '').trim().toLowerCase();
    if (!actorKey) {
      return;
    }

    const member = staffLookup.get(actorKey);
    const displayName = member?.name || member?.email || order?.billing?.cashierName || 'Staff';
    const current = aggregates.get(displayName) || {
      name: displayName,
      orders: 0,
      revenue: 0,
    };
    current.orders += 1;
    current.revenue += Number(order?.totalAmount || order?.total || 0);
    aggregates.set(displayName, current);
  });

  return Array.from(aggregates.values())
    .sort((left, right) => right.orders - left.orders || right.revenue - left.revenue)
    .slice(0, 5);
}

export default function Analytics() {
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [dateRange, setDateRange] = useState(() => getAnalyticsPresetRange('monthly'));
  const [orderType, setOrderType] = useState('all');
  const [isEodOpen, setIsEodOpen] = useState(false);

  const { data: ordersData = {}, loading } = useApi(() => orderAPI.getOrders({ limit: 1000 }));
  const { data: staffData = {} } = useApi(() => restaurantAPI.getStaff({ limit: 100, skip: 0, isActive: true }));
  const { data: eodData, loading: eodLoading } = useApi(() => analyticsAPI.getLatestEodSummary({ ensure: true }));

  const orders = ordersData?.items || [];
  const staff = staffData?.staff || [];

  const snapshot = useMemo(
    () => buildAnalyticsSnapshot(orders, dateRange, { orderType }),
    [dateRange, orderType, orders]
  );
  const todaySnapshot = useMemo(
    () => buildAnalyticsSnapshot(orders, getAnalyticsPresetRange('today'), { orderType }),
    [orderType, orders]
  );
  const staffPerformance = useMemo(
    () => getStaffPerformance(snapshot.filteredOrders, staff),
    [snapshot.filteredOrders, staff]
  );

  const summaryCards = useMemo(
    () => [
      {
        label: 'Total Revenue',
        value: formatCurrency(todaySnapshot.totalRevenue),
        helper: 'Today',
        icon: Wallet,
        accentClassName: 'bg-gradient-to-r from-emerald-500 to-teal-400',
      },
      {
        label: 'Total Orders',
        value: snapshot.totalOrders,
        icon: Receipt,
        helper: `${orderType === 'all' ? 'All order types' : orderType} range`,
        accentClassName: 'bg-gradient-to-r from-sky-500 to-cyan-400',
      },
      {
        label: 'Average Order Value',
        value: formatCurrency(snapshot.averageOrderValue),
        icon: ShoppingBag,
        helper: `${snapshot.orderSummary.itemsServed} items sold`,
        accentClassName: 'bg-gradient-to-r from-fuchsia-500 to-rose-400',
      },
      {
        label: 'Active Orders',
        value: snapshot.activeOrdersCount,
        icon: Clock3,
        helper: `${snapshot.orderSummary.open} still running`,
        accentClassName: 'bg-gradient-to-r from-amber-500 to-orange-400',
      },
      {
        label: 'Net Sales',
        value: formatCurrency(snapshot.netSales),
        icon: TrendingUp,
        helper:
          snapshot.comparison.revenueDelta >= 0
            ? `+${formatCurrency(Math.abs(snapshot.comparison.revenueDelta))} vs previous range`
            : `-${formatCurrency(Math.abs(snapshot.comparison.revenueDelta))} vs previous range`,
        accentClassName: 'bg-gradient-to-r from-violet-500 to-indigo-400',
      },
    ],
    [orderType, snapshot, todaySnapshot.totalRevenue]
  );

  const handlePresetChange = (presetKey) => {
    setActiveFilter(presetKey);
    setDateRange(getAnalyticsPresetRange(presetKey));
  };

  const handleDateChange = (field, value) => {
    setActiveFilter('custom');
    setDateRange((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const exportReport = () => {
    const csv = buildAnalyticsCsv(snapshot);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analytics-${dateRange.start}-to-${dateRange.end}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="compact-page space-y-4">
      <div className="flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={() => setIsEodOpen(true)} disabled={!eodData}>
          <BarChart3 className="h-4 w-4" />
          Latest EOD
        </Button>
        <Button variant="secondary" onClick={exportReport}>
          <Download className="h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <Card className="overflow-hidden border border-[var(--border-color)] bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.12),transparent_38%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.10),transparent_32%),var(--bg-card)] p-4 shadow-[0_20px_60px_rgba(15,23,42,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Admin Analytics</p>
            <h1 className="max-w-3xl text-2xl font-black leading-tight text-[var(--text-primary)] sm:text-3xl">
              See what is selling, what is slowing down, and where the floor needs attention.
            </h1>
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]">
                Peak hour: {snapshot.busiestHour?.label || 'N/A'}
              </span>
              <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]">
                Best seller: {snapshot.bestSellingItem?.name || 'N/A'}
              </span>
              <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)]">
                Settled: {snapshot.orderSummary.settled}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--bg-card-muted)] p-2">
              {DATE_FILTER_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => handlePresetChange(option.key)}
                  className={`inline-flex min-w-0 items-center justify-center truncate rounded-xl px-3 py-2 text-xs font-semibold transition sm:px-4 sm:text-sm ${
                    activeFilter === option.key ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="From"
                type="date"
                value={dateRange.start}
                onChange={(event) => handleDateChange('start', event.target.value)}
              />
              <Input
                label="To"
                type="date"
                value={dateRange.end}
                onChange={(event) => handleDateChange('end', event.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {ORDER_TYPE_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setOrderType(option.key)}
              className={`rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
                orderType === option.key
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-card-muted)] text-[var(--text-secondary)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCards.map((card) => (
          <MetricTile
            key={card.label}
            icon={card.icon}
            label={card.label}
            value={card.value}
            helper={card.helper}
            accentClassName={card.accentClassName}
          />
        ))}
      </div>

      {snapshot.filteredOrders.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No analytics data for this range"
          description="Try a wider date range or switch the order type filter."
        />
      ) : (
        <>
          <AnalyticsSection title="Revenue Trend" subtitle="Clean daily movement across the selected window">
            <div className="h-[320px] w-full sm:h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={snapshot.dailyTrend} margin={{ top: 18, right: 12, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="analyticsRevenueFillPremium" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.35} />
                      <stop offset="72%" stopColor="#0ea5e9" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: 'var(--text-secondary)' }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(value) => `₹${Number(value || 0).toFixed(0)}`}
                  />
                  <Tooltip
                    formatter={(value) => formatCurrency(value)}
                    contentStyle={{
                      borderRadius: '16px',
                      border: '1px solid rgba(148,163,184,0.18)',
                      background: 'var(--bg-card)',
                      boxShadow: '0 18px 40px rgba(15,23,42,0.10)',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="none"
                    fill="url(#analyticsRevenueFillPremium)"
                    name="Revenue"
                  />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="#0ea5e9"
                    strokeWidth={3}
                    dot={{ r: 0 }}
                    activeDot={{ r: 5, strokeWidth: 0, fill: '#0ea5e9' }}
                    name="Revenue"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </AnalyticsSection>

          <AnalyticsSection title="Sales Breakdown" subtitle="Order mix and payment split">
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <div>
                <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Dine-In vs Takeaway</p>
                {snapshot.orderTypeMix.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--bg-card-muted)] px-4 py-5 text-sm text-[var(--text-secondary)]">
                    No order mix available yet.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                    <div className="h-[180px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={snapshot.orderTypeMix} dataKey="value" innerRadius={42} outerRadius={72} paddingAngle={3}>
                            {snapshot.orderTypeMix.map((entry, index) => (
                              <Cell key={`${entry.name}-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="space-y-2">
                      {snapshot.orderTypeMix.map((entry, index) => (
                        <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-[var(--bg-card-muted)] px-4 py-3">
                          <div className="flex items-center gap-3">
                            <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                            <span className="text-sm font-medium text-[var(--text-primary)]">{entry.name}</span>
                          </div>
                          <span className="text-sm font-semibold text-[var(--text-primary)]">{entry.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold text-[var(--text-primary)]">Payment Method Split</p>
                <div className="space-y-2">
                  {(snapshot.paymentMix.length > 0 ? snapshot.paymentMix.slice(0, 4) : [{ name: 'No payments yet', value: 0 }]).map((entry, index) => (
                    <div key={entry.name} className="flex items-center justify-between rounded-2xl bg-[var(--bg-card-muted)] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                        <span className="text-sm font-medium text-[var(--text-primary)]">{entry.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-[var(--text-primary)]">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AnalyticsSection>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <AnalyticsSection title="Peak Hours Analysis" subtitle="Orders per hour">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.hourlyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="orders" radius={[10, 10, 0, 0]}>
                      {snapshot.hourlyTrend.map((entry) => (
                        <Cell key={entry.label} fill={entry.label === snapshot.busiestHour?.label ? '#8b5cf6' : '#0ea5e9'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AnalyticsSection>

            <AnalyticsSection title="Top Selling Items Chart" subtitle="Top 5 by quantity sold">
              <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.topItems} layout="vertical" margin={{ left: 8, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(value) => `${value} sold`} />
                    <Bar dataKey="quantity" fill="#14b8a6" radius={[0, 10, 10, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AnalyticsSection>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_0.8fr]">
            <AnalyticsSection title="Menu Performance">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Top Selling</p>
                  <ItemPerformanceList items={snapshot.topItems} />
                </div>
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-[var(--text-primary)]">Least Selling</p>
                  <ItemPerformanceList items={snapshot.lowPerformingItems} />
                </div>
              </div>
            </AnalyticsSection>

            <div className="grid grid-cols-1 gap-4">
              <AnalyticsSection title="Staff Performance" subtitle="Orders handled per staff">
                {staffPerformance.length === 0 ? (
                  <div className="rounded-2xl bg-[var(--bg-card-muted)] px-4 py-5 text-sm text-[var(--text-secondary)]">
                    Staff order handling will appear once bills start getting settled with cashier names.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="h-[220px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={staffPerformance}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} interval={0} angle={-20} textAnchor="end" height={55} />
                          <YAxis tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                          <Tooltip />
                          <Bar dataKey="orders" fill="#8b5cf6" radius={[10, 10, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    {staffPerformance.map((member, index) => (
                      <div key={`${member.name}-${index}`} className="rounded-2xl bg-[var(--bg-card-muted)] px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--text-primary)]">{member.name}</p>
                            <p className="mt-1 text-xs text-[var(--text-secondary)]">{member.orders} orders handled</p>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-[var(--color-primary)]">{formatCurrency(member.revenue)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </AnalyticsSection>
            </div>
          </div>
        </>
      )}

      <Modal
        title={eodData ? `End-of-Day Summary · ${eodData.date}` : 'End-of-Day Summary'}
        isOpen={isEodOpen}
        onClose={() => setIsEodOpen(false)}
        maxWidth="max-w-3xl"
      >
        {eodLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="h-6 w-6 animate-spin text-[var(--color-primary)]" />
          </div>
        ) : eodData ? (
          <div className="space-y-5">
            <p className="text-sm leading-6 text-[var(--text-secondary)]">{eodData.summaryMessage}</p>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Revenue</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{formatCurrency(eodData.totalRevenue)}</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Orders</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{eodData.totalOrders}</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Avg Order</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{formatCurrency(eodData.averageOrderValue)}</p>
              </div>
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm text-[var(--text-secondary)]">Discounts</p>
                <p className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{formatCurrency(eodData.totalDiscounts)}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <p className="text-sm font-semibold text-[var(--text-primary)]">Top selling items</p>
                <div className="mt-3 space-y-2">
                  {(eodData.topItems || []).map((item) => (
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
                  {(eodData.lowPerformingItems || []).map((item) => (
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
                  {(eodData.peakHours || []).map((slot) => (
                    <div key={slot.label} className="flex items-center justify-between text-sm">
                      <span className="text-[var(--text-secondary)]">{slot.label}</span>
                      <span className="font-semibold text-[var(--text-primary)]">{slot.orders} orders</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Package}
            title="No EOD summary yet"
            description="The latest end-of-day summary will appear here after the system captures one."
          />
        )}
      </Modal>
    </div>
  );
}
