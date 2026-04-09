import React, { useState } from 'react';
import { format, subDays } from 'date-fns';
import KPICard from '../../components/analytics/KPICard';
import RevenueChart from '../../components/analytics/RevenueChart';
import OrdersVsRevenueChart from '../../components/analytics/OrdersVsRevenueChart';
import CategoryChart from '../../components/analytics/CategoryChart';
import TopItemsChart from '../../components/analytics/TopItemsChart';
import PaymentChart from '../../components/analytics/PaymentChart';
import HourlyHeatmap from '../../components/analytics/HourlyHeatmap';
import useAnalyticsDashboard from '../../hooks/useAnalyticsDashboard';
import './Dashboard.css';

const PERIODS = {
  today: 'today',
  week: 'week',
  month: 'month',
};

export default function Dashboard() {
  const [period, setPeriod] = useState(PERIODS.today);

  const handlePeriodChange = (newPeriod) => {
    setPeriod(newPeriod);
  };

  const { data, loading, error, refetch } = useAnalyticsDashboard({ period });

  if (error) {
    return <div className="dashboard-error">Failed to load analytics: {error}</div>;
  }

  return (
    <div className="dashboard-container">
      {/* HEADER */}
      <div className="dashboard-header">
        <h1>📊 Analytics Dashboard</h1>
        <div className="period-toggle">
          <button
            className={`toggle-btn ${period === PERIODS.today ? 'active' : ''}`}
            onClick={() => handlePeriodChange(PERIODS.today)}
          >
            Today
          </button>
          <button
            className={`toggle-btn ${period === PERIODS.week ? 'active' : ''}`}
            onClick={() => handlePeriodChange(PERIODS.week)}
          >
            This Week
          </button>
          <button
            className={`toggle-btn ${period === PERIODS.month ? 'active' : ''}`}
            onClick={() => handlePeriodChange(PERIODS.month)}
          >
            This Month
          </button>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="kpi-grid">
        <KPICard
          title="Total Revenue"
          value={`₹${(data?.totalRevenue || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`}
          icon="💰"
          trend={data?.revenueTrend}
          loading={loading}
        />
        <KPICard
          title="Total Orders"
          value={data?.totalOrders || 0}
          icon="🛒"
          trend={data?.ordersVsRevenue}
          loading={loading}
        />
        <KPICard
          title="Avg Order Value"
          value={`₹${(data?.aov || 0).toFixed(2)}`}
          icon="📈"
          loading={loading}
        />
        <KPICard
          title="Unique Customers"
          value={data?.uniqueCustomers || 0}
          icon="👥"
          loading={loading}
        />
        {data?.hourlyData && data.hourlyData.length > 0 && (
          <KPICard
            title="Peak Hour"
            value={`${data.hourlyData.reduce((max, h) => (h.orders > max.orders ? h : max)).hour}:00`}
            icon="🔥"
            subtitle={`${data.hourlyData.reduce((max, h) => (h.orders > max.orders ? h : max)).orders} orders`}
            loading={loading}
          />
        )}
        {data?.topItems && data.topItems.length > 0 && (
          <KPICard
            title="Top Item"
            value={data.topItems[0]?.name || 'N/A'}
            icon="⭐"
            subtitle={`${data.topItems[0]?.quantity || 0} sold`}
            loading={loading}
          />
        )}
      </div>

      {/* CHARTS - ROW 1 */}
      <div className="charts-grid-2">
        <div className="chart-card">
          <h3>Revenue Trend</h3>
          {loading ? <div className="skeleton" /> : <RevenueChart data={data?.revenueTrend || []} />}
        </div>
        <div className="chart-card">
          <h3>Orders vs Revenue</h3>
          {loading ? <div className="skeleton" /> : <OrdersVsRevenueChart data={data?.ordersVsRevenue || []} />}
        </div>
      </div>

      {/* CHARTS - ROW 2 */}
      <div className="charts-grid-2">
        <div className="chart-card">
          <h3>Category Performance</h3>
          {loading ? <div className="skeleton" /> : <CategoryChart data={data?.categoryPerformance || []} />}
        </div>
        <div className="chart-card">
          <h3>Payment Methods</h3>
          {loading ? <div className="skeleton" /> : <PaymentChart data={data?.paymentMethods || []} />}
        </div>
      </div>

      {/* CHARTS - ROW 3 */}
      <div className="charts-grid-1">
        <div className="chart-card">
          <h3>Top 10 Items</h3>
          {loading ? <div className="skeleton" /> : <TopItemsChart data={data?.topItems || []} />}
        </div>
      </div>

      {/* HEATMAP */}
      <div className="charts-grid-1">
        <div className="chart-card">
          <h3>📅 Hourly Activity Heatmap</h3>
          {loading ? <div className="skeleton" /> : <HourlyHeatmap data={data?.hourlyData || []} />}
        </div>
      </div>

      {/* INSIGHTS */}
      {data?.insights && data.insights.length > 0 && (
        <div className="insights-section">
          <h3>💡 Key Insights</h3>
          <div className="insights-grid">
            {data.insights.map((insight, idx) => (
              <div key={idx} className="insight-card">
                <div className="insight-icon">{insight.icon}</div>
                <div className="insight-content">
                  <h4>{insight.title}</h4>
                  <p>{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
