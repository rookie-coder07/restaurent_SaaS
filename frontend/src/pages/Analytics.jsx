import { useApi } from '../hooks/useApi';
import { orderAPI } from '../services/apiEndpoints';
import { Loader, Download } from 'lucide-react';
import { useState } from 'react';
import { formatCurrency, formatDate } from '../utils/formatters';
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

export default function Analytics() {
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0],
  });

  const { data: ordersData = {}, loading } = useApi(() =>
    orderAPI.getOrders({ limit: 1000 })
  );

  const orders = ordersData?.items || [];

  // Calculate metrics
  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, order) => sum + (order.totalAmount || order.total || 0), 0);
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  const completedOrders = orders.filter(o => o.status === 'served' || o.status === 'completed').length;

  // Group orders by date for timeline
  const dailyData = {};
  orders.forEach(order => {
    const date = new Date(order.createdAt).toLocaleDateString();
    if (!dailyData[date]) {
      dailyData[date] = { date, orders: 0, revenue: 0 };
    }
    dailyData[date].orders++;
    dailyData[date].revenue += order.totalAmount || order.total || 0;
  });

  const chartData = Object.values(dailyData).sort((a, b) => {
    const dateA = new Date(a.date).getTime();
    const dateB = new Date(b.date).getTime();
    return dateA - dateB;
  });

  // Status breakdown
  const statusData = [
    { name: 'Completed', value: completedOrders, color: '#10B981' },
    { name: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: '#F59E0B' },
    { name: 'Preparing', value: orders.filter(o => o.status === 'preparing').length, color: '#3B82F6' },
    { name: 'Ready', value: orders.filter(o => o.status === 'ready').length, color: '#8B5CF6' },
    { name: 'Cancelled', value: orders.filter(o => o.status === 'cancelled').length, color: '#EF4444' },
  ].filter(d => d.value > 0);

  // Top items by frequency
  const itemFrequency = {};
  orders.forEach(order => {
    (order.items || []).forEach(item => {
      if (!itemFrequency[item.name]) {
        itemFrequency[item.name] = { name: item.name, quantity: 0, revenue: 0 };
      }
      itemFrequency[item.name].quantity += item.quantity || 1;
      itemFrequency[item.name].revenue += (item.price * (item.quantity || 1)) || 0;
    });
  });

  const topItems = Object.values(itemFrequency)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Analytics & Reports</h1>
        <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          <Download className="w-5 h-5" />
          Export Report
        </button>
      </div>

      {/* Date Range Filter */}
      <div className="card p-4 flex gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
          <input
            type="date"
            value={dateRange.start}
            onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
          <input
            type="date"
            value={dateRange.end}
            onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <p className="text-gray-600 text-sm font-medium">Total Orders</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{totalOrders}</p>
          <p className="text-xs text-gray-600 mt-2">Period total</p>
        </div>
        <div className="card p-6">
          <p className="text-gray-600 text-sm font-medium">Total Revenue</p>
          <p className="text-3xl font-bold text-green-600 mt-2">{formatCurrency(totalRevenue)}</p>
          <p className="text-xs text-gray-600 mt-2">All orders</p>
        </div>
        <div className="card p-6">
          <p className="text-gray-600 text-sm font-medium">Avg Order Value</p>
          <p className="text-3xl font-bold text-blue-600 mt-2">{formatCurrency(avgOrderValue)}</p>
          <p className="text-xs text-gray-600 mt-2">Per order</p>
        </div>
        <div className="card p-6">
          <p className="text-gray-600 text-sm font-medium">Completed Orders</p>
          <p className="text-3xl font-bold text-purple-600 mt-2">{completedOrders}</p>
          <p className="text-xs text-gray-600 mt-2">{totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0}% completion</p>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip formatter={(value) => formatCurrency(value)} />
              <Legend />
              <Line
                type="monotone"
                dataKey="revenue"
                stroke="#3B82F6"
                strokeWidth={2}
                name="Revenue"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Orders Trend */}
        <div className="card p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4">Orders Trend</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="orders" fill="#10B981" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Order Status Distribution */}
        {statusData.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Order Status Distribution</h2>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Top Menu Items */}
        {topItems.length > 0 && (
          <div className="card p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Top Menu Items</h2>
            <div className="space-y-3">
              {topItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{item.name}</p>
                    <p className="text-xs text-gray-600">{item.quantity} sold</p>
                  </div>
                  <p className="font-semibold text-blue-600">{formatCurrency(item.revenue)}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Orders Table */}
      <div className="card">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-bold text-gray-900">Recent Orders</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Order ID</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Amount</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Items</th>
                <th className="px-6 py-3 text-left font-semibold text-gray-900">Date</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 10).map((order) => (
                <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-6 py-3 font-mono text-blue-600 text-xs">#{order.id?.slice(-8)}</td>
                  <td className="px-6 py-3 font-semibold">{formatCurrency(order.totalAmount || order.total || 0)}</td>
                  <td className="px-6 py-3">
                    <span className="px-2 py-1 rounded text-xs font-semibold bg-gray-100 text-gray-800">
                      {order.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{order.items?.length || 0} items</td>
                  <td className="px-6 py-3 text-gray-600 text-xs">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
