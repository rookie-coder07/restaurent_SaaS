import React, { useState, useEffect } from 'react';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import {
  Clock,
  Package,
  LogIn,
  AlertCircle,
  RefreshCw,
  Loader,
  Activity,
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

      // Get all activity logs for the restaurant (admin/manager view)
      const url = `/v1/activity/logs/all`;
      const res = await api.get(url);
      
      // Safely extract logs data - handle various response formats
      let logsData = [];
      if (Array.isArray(res.data?.data)) {
        logsData = res.data.data;
      } else if (Array.isArray(res.data)) {
        logsData = res.data;
      } else if (res.data?.logs && Array.isArray(res.data.logs)) {
        logsData = res.data.logs;
      }
      
      setLogs(logsData);
      if (logsData.length === 0) {
        setError(null); // No error if empty, just no data
      }
    } catch (err) {
      // If endpoint not found or no activity, don't show as error
      if (err.response?.status === 404 || err.response?.status === 403) {
        setLogs([]);
        setError(null);
      } else {
        setError(`Failed to load activity: ${err.response?.data?.message || err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

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
    <div className="min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-full mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-4 shadow-[var(--shadow-card)]">
            <div className="flex items-center gap-3 mb-4">
              <Activity className="h-6 w-6 text-[var(--color-primary)]" />
              <h1 className="text-2xl font-black text-[var(--text-primary)]">
                Staff Activity Tracking
              </h1>
            </div>
            <p className="text-sm text-[var(--text-secondary)]">
              View your activity logs
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2 text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
          >
            <option value="all">All Actions</option>
            <option value="user_login">Login</option>
            <option value="order_created">Orders Created</option>
            <option value="order_deleted">Orders Deleted</option>
            <option value="order_settled">Orders Settled</option>
          </select>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-6 py-2 font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
            <AlertCircle className="h-5 w-5 text-red-600" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] py-12">
            <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
          </div>
        )}

        {/* Logs Table */}
        {!loading && filteredLogs.length > 0 && (
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] shadow-[var(--shadow-card)] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-[var(--border-color)] bg-[var(--color-surface-muted)]">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-primary)]">
                      Action
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-primary)]">
                      Details
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-[var(--text-primary)]">
                      Timestamp
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLogs.map((log, index) => (
                    <tr
                      key={log.id || index}
                      className="border-b border-[var(--border-color)] transition hover:bg-[var(--color-surface-muted)]"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          {getActionIcon(log.action)}
                          <span className="text-sm font-medium text-[var(--text-primary)]">
                            {getActionLabel(log.action)}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="max-w-xs truncate text-sm text-[var(--text-secondary)]">
                          {log.details?.email || 
                           log.details?.orderId || 
                           log.details?.role || 
                           log.details?.actorName ||
                           '—'}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                          <Clock className="h-4 w-4" />
                          {formatTime(log.created_at || log.timestamp)}
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
          <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] p-12 text-center shadow-[var(--shadow-card)]">
            <Activity className="mx-auto mb-4 h-12 w-12 text-[var(--text-secondary)]" />
            <h3 className="mb-2 text-lg font-semibold text-[var(--text-primary)]">
              No activity available
            </h3>
            <p className="text-sm text-[var(--text-secondary)]">
              {filter === 'all' 
                ? 'No order created activity found.'
                : `No ${getActionLabel(filter).toLowerCase()} activity found.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffActivity;
