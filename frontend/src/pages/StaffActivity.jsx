import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import {
  Clock,
  User,
  Package,
  LogIn,
  AlertCircle,
  RefreshCw,
  Loader,
} from 'lucide-react';

const StaffActivity = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('[StaffActivity] Fetching logs for userId:', user?.id);
      const url = `/v1/activity/${user?.id}/logs`;
      console.log('[StaffActivity] Full URL:', url);
      
      const res = await api.get(url);
      console.log('[StaffActivity] Response:', res);
      
      const logsData = res.data?.data || [];
      console.log('[StaffActivity] Logs data:', logsData);
      
      setLogs(logsData);
    } catch (err) {
      console.error('[StaffActivity] Error fetching logs:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        fullError: err
      });
      setError(`Failed to load activity: ${err.response?.data?.message || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[StaffActivity] useEffect - user:', user);
    if (user?.id) {
      console.log('[StaffActivity] Calling fetchLogs');
      fetchLogs();
    } else {
      console.log('[StaffActivity] user.id not available yet');
      // Don't set error - just wait for user to load
    }
  }, [user?.id]);

  const getActionIcon = (action) => {
    switch (action) {
      case 'user_login':
        return <LogIn className="w-4 h-4 text-blue-500" />;
      case 'order_created':
        return <Package className="w-4 h-4 text-green-500" />;
      case 'user_logout':
        return <LogIn className="w-4 h-4 text-red-500" />;
      default:
        return <AlertCircle className="w-4 h-4 text-gray-500" />;
    }
  };

  const getActionLabel = (action) => {
    const labels = {
      user_login: 'Login',
      user_logout: 'Logout',
      order_created: 'Order Created',
      order_deleted: 'Order Deleted',
      order_settled: 'Order Settled',
      item_added: 'Item Added',
      item_removed: 'Item Removed',
    };
    return labels[action] || action;
  };

  const filteredLogs = filter === 'all' 
    ? logs 
    : logs.filter(log => log.action === filter);

  const formatTime = (timestamp) => {
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            Staff Activity Log
          </h1>
          <p className="text-slate-600">
            View your activity logs
          </p>
        </div>

        {/* Controls */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Actions</option>
              <option value="user_login">Login</option>
              <option value="order_created">Orders Created</option>
              <option value="order_deleted">Orders Deleted</option>
              <option value="order_settled">Orders Settled</option>
            </select>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 transition flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-600" />
            <p className="text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        )}

        {/* Logs Table */}
        {!loading && filteredLogs.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Action
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      User
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-slate-900">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <tr
                      key={log.id || index}
                      className="border-b border-slate-200 hover:bg-slate-50 transition"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action)}
                          <span className="text-sm font-medium text-slate-900">
                            {getActionLabel(log.action)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600">
                          {log.details?.actorName || log.user_id?.substring(0, 8)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-slate-600 max-w-xs truncate">
                          {log.details?.email || 
                           log.details?.orderId || 
                           log.details?.role || 
                           '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Clock className="w-4 h-4" />
                          {formatTime(log.created_at)}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredLogs.length === 0 && (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No activity available</h3>
            <p className="text-slate-600">
              {filter === 'all' 
                ? 'No activity has been recorded yet.'
                : `No ${getActionLabel(filter).toLowerCase()} activity found.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffActivity;
