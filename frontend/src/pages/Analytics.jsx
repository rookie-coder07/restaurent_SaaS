import { useEffect, useMemo, useState } from 'react';
import { BarChart3, Download, Loader, Percent, TrendingDown, TrendingUp } from 'lucide-react';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useApi } from '../hooks/useApi';
import { analyticsAPI, orderAPI } from '../services/apiEndpoints';
import { formatCurrency, formatDate, formatDisplayOrderNumber } from '../utils/formatters';
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
import StatCard from '../components/common/StatCard';

const FILTER_OPTIONS = [
  { key: 'today', label: 'Today' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
];

function AnalyticsSection({ eyebrow, title, children }) {
  return (
    <Card>
      <p className="text-sm text-[var(--text-secondary)]">{eyebrow}</p>
      <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">{title}</h2>
      <div className="mt-5">{children}</div>
    </Card>
  );
}

export default function Analytics() {
  const [activeFilter, setActiveFilter] = useState('monthly');
  const [dateRange, setDateRange] = useState(() => getAnalyticsPresetRange('monthly'));
  const [isEodOpen, setIsEodOpen] = useState(false);
  const { data: ordersData = {}, loading } = useApi(() => orderAPI.getOrders({ limit: 1000 }));
  const { data: eodData, loading: eodLoading } = useApi(() => analyticsAPI.getLatestEodSummary({ ensure: true }));
  const orders = ordersData?.items || [];

  useEffect(() => {
    setDateRange(getAnalyticsPresetRange(activeFilter));
  }, [activeFilter]);

  const snapshot = useMemo(() => buildAnalyticsSnapshot(orders, dateRange), [dateRange, orders]);

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
    <div className="space-y-6">
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

      <Card>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Filters</p>
            <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Switch between today, weekly, and monthly views</h2>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[var(--bg-card-muted)] p-2">
              {FILTER_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setActiveFilter(option.key)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    activeFilter === option.key
                      ? 'bg-[var(--color-primary)] text-white'
                      : 'text-[var(--text-secondary)]'
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
                onChange={(event) => setDateRange((current) => ({ ...current, start: event.target.value }))}
              />
              <Input
                label="To"
                type="date"
                value={dateRange.end}
                onChange={(event) => setDateRange((current) => ({ ...current, end: event.target.value }))}
              />
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Revenue" value={formatCurrency(snapshot.totalRevenue)} subtitle="Settled sales in range" iconTone="bg-emerald-500/15 text-emerald-400" />
        <StatCard label="Orders" value={snapshot.totalOrders} subtitle="All orders in range" iconTone="bg-[var(--color-primary-soft)] text-[var(--color-primary)]" />
        <StatCard label="Avg Order" value={formatCurrency(snapshot.averageOrderValue)} subtitle="Per settled bill" iconTone="bg-slate-500/15 text-slate-300" />
        <StatCard
          icon={Percent}
          label="Discounts"
          value={formatCurrency(snapshot.totalDiscounts)}
          subtitle={`${snapshot.discountedOrdersCount} discounted orders`}
          iconTone="bg-amber-500/15 text-amber-400"
        />
        <StatCard
          icon={snapshot.comparison.revenueDelta >= 0 ? TrendingUp : TrendingDown}
          label="Vs Previous"
          value={`${snapshot.comparison.revenueDelta >= 0 ? '+' : ''}${formatCurrency(snapshot.comparison.revenueDelta)}`}
          subtitle={`${snapshot.comparison.orderDelta >= 0 ? '+' : ''}${snapshot.comparison.orderDelta} orders`}
          iconTone={snapshot.comparison.revenueDelta >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}
        />
      </div>

      {snapshot.filteredOrders.length === 0 ? (
        <EmptyState
          icon={TrendingUp}
          title="No analytics data for this range"
          description="Try a wider date range or wait for new orders to come in."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AnalyticsSection eyebrow="Revenue Overview" title="Revenue, order volume, and discount flow">
              <div className="h-[280px] w-full sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={snapshot.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} name="Revenue" />
                    <Line type="monotone" dataKey="discounts" stroke="#f59e0b" strokeWidth={2.5} name="Discounts" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </AnalyticsSection>

            <AnalyticsSection eyebrow="Orders Count" title="Order movement by day">
              <div className="h-[280px] w-full sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.dailyTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="orders" fill="#10B981" name="Orders" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AnalyticsSection>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <AnalyticsSection eyebrow="Top Items" title="Best sellers right now">
              <div className="space-y-3">
                {snapshot.topItems.map((item) => (
                  <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg-card-muted)] p-4">
                    <div className="min-w-0">
                      <p className="font-semibold text-[var(--text-primary)]">{item.name}</p>
                      <p className="text-sm text-[var(--text-secondary)]">{item.quantity} sold</p>
                    </div>
                    <p className="font-semibold text-[var(--color-primary)]">{formatCurrency(item.revenue)}</p>
                  </div>
                ))}
              </div>
            </AnalyticsSection>

            <AnalyticsSection eyebrow="Low Performing Items" title="Items needing attention">
              <div className="space-y-3">
                {snapshot.lowPerformingItems.length === 0 ? (
                  <EmptyState
                    icon={TrendingDown}
                    title="Not enough item variance yet"
                    description="Low-performing items will appear once the menu has enough sales history."
                  />
                ) : (
                  snapshot.lowPerformingItems.map((item) => (
                    <div key={item.name} className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--bg-card-muted)] p-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-[var(--text-primary)]">{item.name}</p>
                        <p className="text-sm text-[var(--text-secondary)]">{item.quantity} sold</p>
                      </div>
                      <p className="font-semibold text-red-400">{formatCurrency(item.revenue)}</p>
                    </div>
                  ))
                )}
              </div>
            </AnalyticsSection>

            <AnalyticsSection eyebrow="Discount Analysis" title="How discounts affect daily revenue">
              <div className="space-y-4">
                <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Total discounts</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{formatCurrency(snapshot.totalDiscounts)}</p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Discounted orders</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{snapshot.discountedOrdersCount}</p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <p className="text-sm text-[var(--text-secondary)]">Discount share of revenue</p>
                  <p className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                    {snapshot.totalRevenue > 0 ? `${((snapshot.totalDiscounts / snapshot.totalRevenue) * 100).toFixed(1)}%` : '0.0%'}
                  </p>
                </div>
              </div>
            </AnalyticsSection>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <AnalyticsSection eyebrow="Peak Hours Chart" title="When service is busiest">
              <div className="h-[280px] w-full sm:h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={snapshot.peakHours}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="orders" fill="#06b6d4" name="Orders" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </AnalyticsSection>

            <AnalyticsSection eyebrow="Orders Mix" title="Current status distribution">
              {snapshot.statusData.length === 0 ? (
                <EmptyState
                  icon={BarChart3}
                  title="No status spread yet"
                  description="Status distribution appears once orders are flowing in this range."
                />
              ) : (
                <div className="h-[280px] w-full sm:h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={snapshot.statusData} cx="50%" cy="50%" outerRadius={98} dataKey="value" labelLine={false}>
                        {snapshot.statusData.map((entry, index) => (
                          <Cell key={`${entry.name}-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </AnalyticsSection>
          </div>

          <AnalyticsSection eyebrow="Recent Orders" title="Latest bills in the selected range">
            <div className="space-y-3">
              {snapshot.filteredOrders.slice(0, 10).map((order) => (
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
                  </div>
                </div>
              ))}
            </div>
          </AnalyticsSection>
        </>
      )}

      <Modal
        title={eodData ? `End-of-Day Summary • ${eodData.date}` : 'End-of-Day Summary'}
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
            icon={BarChart3}
            title="No EOD summary yet"
            description="The latest end-of-day summary will appear here after the system captures one."
          />
        )}
      </Modal>
    </div>
  );
}
