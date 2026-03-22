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
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="mb-6 sm:mb-8">
        <h1 className="break-words text-2xl font-bold text-gray-900 sm:text-3xl">
          Welcome back, {profile?.name}!
        </h1>
        <p className="mt-1 text-sm text-gray-600 sm:text-base">
          Here's what's happening in your restaurant today
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-600">Today's Orders</p>
              <p className="mt-2 break-words text-3xl font-bold text-gray-900">{todayOrders.length}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-100">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
              <p className="mt-2 break-words text-3xl font-bold text-gray-900">{formatCurrency(todayRevenue)}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-green-100">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
              <p className="mt-2 break-words text-3xl font-bold text-gray-900">{formatCurrency(avgOrderValue)}</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-yellow-100">
              <Calendar className="h-6 w-6 text-yellow-600" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-600">Active Users</p>
              <p className="mt-2 break-words text-3xl font-bold text-gray-900">{activeUsers}</p>
              <p className="mt-1 text-xs text-gray-500">{availableTables} tables available</p>
            </div>
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-purple-100">
              <Users className="h-6 w-6 text-purple-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Recent Orders</h2>
        <div className="space-y-3">
          {orders.slice(0, 5).map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-2 border-b border-gray-100 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="break-words font-semibold text-gray-900">Order #{order.id?.slice(-8)}</p>
                <p className="text-sm text-gray-600">Table {order.tableNumber || 'N/A'}</p>
              </div>
              <div className="text-left sm:text-right">
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
