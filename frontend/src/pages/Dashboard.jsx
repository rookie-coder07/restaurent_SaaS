import { useApi } from '../hooks/useApi';
import { restaurantAPI, orderAPI, tableAPI } from '../services/apiEndpoints';
import { BarChart3, Users, TrendingUp, Calendar, Loader } from 'lucide-react';
import { formatCurrency, formatDate } from '../utils/formatters';

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
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome back, {profile?.name}! 👋</h1>
        <p className="text-gray-600 mt-1">Here's what's happening in your restaurant today</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Today's Orders */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Today's Orders</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{todayOrders.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
        </div>

        {/* Today's Revenue */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Today's Revenue</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(todayRevenue)}</p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
        </div>

        {/* Avg Order Value */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Avg Order Value</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{formatCurrency(avgOrderValue)}</p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-6 h-6 text-yellow-600" />
            </div>
          </div>
        </div>

        {/* Active Users */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">Active Users</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">{activeUsers}</p>
              <p className="text-xs text-gray-500 mt-1">{availableTables} tables available</p>
            </div>
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="card">
        <h2 className="text-lg font-bold text-gray-900 mb-4">Recent Orders</h2>
        <div className="space-y-3">
          {orders.slice(0, 5).map((order) => (
            <div key={order.id} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div>
                <p className="font-semibold text-gray-900">Order #{order.id?.slice(-8)}</p>
                <p className="text-sm text-gray-600">Table {order.tableNumber || 'N/A'}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-gray-900">{formatCurrency(order.totalAmount || 0)}</p>
                <p className="text-sm text-gray-600">{formatDate(order.createdAt)}</p>
              </div>
            </div>
          ))}
          {orders.length === 0 && <p className="text-gray-600">No recent orders yet</p>}
        </div>
      </div>
    </div>
  );
}
