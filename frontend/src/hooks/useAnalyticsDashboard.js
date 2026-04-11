import { useState, useEffect, useCallback } from 'react';
import { analyticsApi } from '../services/analyticsApi';
import { getUserErrorMessage, reportClientError, showToast } from '../utils/errorHandling';

export default function useAnalyticsDashboard({ period = 'today' } = {}) {
  const [data, setData] = useState({
    totalRevenue: 0,
    totalOrders: 0,
    aov: 0,
    uniqueCustomers: 0,
    revenueTrend: [],
    ordersVsRevenue: [],
    categoryPerformance: [],
    topItems: [],
    paymentMethods: [],
    hourlyData: [],
    insights: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [
        kpiData,
        trendData,
        ordersData,
        categoryData,
        itemsData,
        paymentData,
        hourlyData,
      ] = await Promise.all([
        analyticsApi.getKPI({ period }),
        analyticsApi.getRevenueTrend({ period }),
        analyticsApi.getOrdersVsRevenue({ period }),
        analyticsApi.getCategoryPerformance({ period }),
        analyticsApi.getTopItems({ period, limit: 10 }),
        analyticsApi.getPaymentMethods({ period }),
        analyticsApi.getHourlyData({ period }),
      ]);

      setData({
        totalRevenue: kpiData?.totalRevenue || 0,
        totalOrders: kpiData?.totalOrders || 0,
        aov: kpiData?.aov || 0,
        uniqueCustomers: kpiData?.uniqueCustomers || 0,
        revenueTrend: trendData || [],
        ordersVsRevenue: ordersData || [],
        categoryPerformance: categoryData || [],
        topItems: itemsData || [],
        paymentMethods: paymentData || [],
        hourlyData: hourlyData || [],
        insights: generateInsights({
          kpi: kpiData,
          hourly: hourlyData,
          topItems: itemsData,
        }),
      });
    } catch (err) {
      reportClientError(err, 'Failed to fetch dashboard data');
      const message = getUserErrorMessage(err, 'Failed to load analytics data');
      setError(message);
      showToast(message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  const generateInsights = (data) => {
    const insights = [];

    if (data.hourly?.length > 0) {
      const maxHour = data.hourly.reduce((max, h) => (h.orders > max.orders ? h : max));
      insights.push({
        icon: '🔥',
        title: 'Peak Hour',
        description: `Highest traffic at ${maxHour.hour}:00 with ${maxHour.orders} orders`,
      });
    }

    if (data.topItems?.length > 0) {
      const topItem = data.topItems[0];
      insights.push({
        icon: '⭐',
        title: 'Top Item',
        description: `${topItem.name} is your best seller (${topItem.quantity} units)`,
      });
    }

    if (data.kpi?.aov > 0) {
      insights.push({
        icon: '💰',
        title: 'Average Order Value',
        description: `Your AOV is ₹${data.kpi.aov.toFixed(2)} - focus on upselling`,
      });
    }

    return insights;
  };

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  return { data, loading, error, refetch: fetchDashboard };
}

export const useAnalyticsChart = (chartType, period = 'today') => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState([]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const fetchChartData = async () => {
      try {
        let chartData = [];

        switch (chartType) {
          case 'revenue-trend':
            chartData = await analyticsApi.getRevenueTrend({ period });
            break;
          case 'orders-vs-revenue':
            chartData = await analyticsApi.getOrdersVsRevenue({ period });
            break;
          case 'category-performance':
            chartData = await analyticsApi.getCategoryPerformance({ period });
            break;
          case 'top-items':
            chartData = await analyticsApi.getTopItems({ period, limit: 10 });
            break;
          case 'payment-methods':
            chartData = await analyticsApi.getPaymentMethods({ period });
            break;
          case 'hourly-data':
            chartData = await analyticsApi.getHourlyData({ period });
            break;
          default:
            chartData = [];
        }

        setData(chartData || []);
      } catch (err) {
        reportClientError(err, `Failed to fetch ${chartType} data`);
        const message = getUserErrorMessage(err, `Failed to load ${chartType}`);
        setError(message);
        showToast(message);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, [chartType, period]);

  return { loading, error, data };
}
