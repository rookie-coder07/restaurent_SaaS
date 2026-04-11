import { useState, useEffect } from 'react';
import { BarChart3, Users, LogOut, Loader, AlertCircle, Search } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';
import { restaurantAPI } from '../services/apiEndpoints';
import { useAuthStore } from '../context/authStore';
import { getFormattedActivity } from '../utils/activityFormatter';
import { getUserErrorMessage, reportClientError, showToast } from '../utils/errorHandling';

export default function StaffActivity() {
  const currentUser = useAuthStore((state) => state.user);
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [activityLogs, setActivityLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchStaffList();
  }, []);

  useEffect(() => {
    const term = searchTerm.toLowerCase();
    if (term === '') {
      setFilteredStaff(staff);
    } else {
      setFilteredStaff(
        staff.filter((user) =>
          user.email?.toLowerCase().includes(term) ||
          user.name?.toLowerCase().includes(term) ||
          user.role?.toLowerCase().includes(term)
        )
      );
    }
  }, [searchTerm, staff]);

  const fetchStaffList = async () => {
    setLoading(true);
    setError('');
    try {
      console.log('[Activity] Fetching staff list...');
      const response = await restaurantAPI.getActivityStaffList();
      
      // GUARD: Validate response structure
      if (!response?.data) {
        console.error('[Activity] Invalid staff list response:', response);
        throw new Error('Invalid server response - missing data');
      }
      
      // DEBUG: Log raw response structure
      console.log('[Activity] Raw response:', {
        status: response.status,
        hasData: !!response.data,
        dataKeys: Object.keys(response.data || {}),
        data: response.data,
        'data.data': response.data?.data,
        'data.staff': response.data?.staff,
      });
      
      // Backend returns: { statusCode, data: { staff: [...] }, message, success }
      let staffList = [];
      
      // Try multiple response formats
      if (response.data?.data?.staff && Array.isArray(response.data.data.staff)) {
        staffList = response.data.data.staff;
        console.log('[Activity] Found staff in response.data.data.staff');
      } else if (response.data?.staff && Array.isArray(response.data.staff)) {
        staffList = response.data.staff;
        console.log('[Activity] Found staff in response.data.staff');
      } else if (Array.isArray(response.data)) {
        staffList = response.data;
        console.log('[Activity] Found staff in response.data (array)');
      }
      
      // DEBUG: Log the entire data structure
      console.log('[Activity] Full response structure:', {
        'response.data': response.data,
        'response.data.data': response.data?.data,
        'response.data.data.staff': response.data?.data?.staff,
        'staffListExtracted': staffList,
        'staffListLength': staffList.length,
      });
      
      if (!Array.isArray(staffList)) {
        console.error('[Activity] Staff list is not an array:', typeof staffList, staffList);
        throw new Error('Invalid staff list format');
      }
      
      console.log('[Activity] Successfully loaded', staffList.length, 'staff members');
      
      if (staffList.length === 0) {
        const restaurantId = (currentUser && currentUser.restaurantId) || localStorage.getItem('restaurantId') || 'unknown';
        const userRole = (currentUser && currentUser.role) || 'unknown';
        const userId = (currentUser && currentUser.id) || 'unknown';
        const userEmail = (currentUser && currentUser.email) || 'unknown';
        
        console.warn('[Activity] ⚠️ Staff list is empty (0 records) - Debugging info:');
        console.warn('[Activity] Current User Context:', {
          id: userId,
          role: userRole,
          restaurantId: restaurantId,
          email: userEmail,
        });
        console.warn('[Activity]   1. Check if users exist:');
        console.warn('[Activity]      SELECT COUNT(*) FROM users WHERE restaurant_id =', restaurantId);
        console.warn('[Activity]   2. Check staff with correct roles:');
        console.warn('[Activity]      SELECT id, name, role FROM users WHERE restaurant_id =', restaurantId, 'AND role IN (manager, staff, kitchen_staff, waiter)');
        console.warn('[Activity]   3. Backend returned:', response.data);
      }
      
      setStaff(staffList);
      setFilteredStaff(staffList);
    } catch (err) {
      console.error('[Activity] Error loading staff list:', err?.message, err);
      console.error('[Activity] Error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        message: err.response?.data?.message || err.message,
        responseData: err.response?.data,
      });
      reportClientError(err, 'Staff list error');
      const message = getUserErrorMessage(err, 'Failed to load staff list');
      setError(message);
      showToast(message);
    } finally {
      setLoading(false);
    }
  };

  const fetchActivityLogs = async (userId) => {
    // GUARD #1: Validate userId parameter
    if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
      console.error('[Activity] Invalid userId:', userId);
      setError('Invalid staff member. Please select again.');
      setActivityLogs([]);
      return;
    }

    setLoadingLogs(true);
    setError('');
    try {
      console.log('[Activity] Fetching logs for userId:', userId);
      const response = await restaurantAPI.getActivityLogs(userId);
      
      // GUARD #2: Validate response structure
      if (!response?.data) {
        console.error('[Activity] Missing response.data:', response);
        throw new Error('Invalid server response: missing data');
      }
      
      // Backend returns: { statusCode, data: { logs: [...] }, message, success }
      // So: response.data = { statusCode, data: { logs }, message, success }
      // Or: response.data = { logs: [...] } depending on wrapper
      let logs = [];
      
      // GUARD #3: Try multiple response formats
      if (response.data.logs && Array.isArray(response.data.logs)) {
        logs = response.data.logs; // Direct format: { logs: [...] }
      } else if (response.data.data?.logs && Array.isArray(response.data.data.logs)) {
        logs = response.data.data.logs; // Wrapped format: { data: { logs: [...] } }
      } else if (Array.isArray(response.data)) {
        logs = response.data; // Array format: [...]
      }
      
      // GUARD #4: Validate logs is an array
      if (!Array.isArray(logs)) {
        console.warn('[Activity] Logs is not an array:', typeof logs, logs);
        logs = [];
      }
      
      setActivityLogs(logs);
      
      // DEBUG: Log success
      console.log('[Activity] Successfully loaded', logs.length, 'logs for', userId);
    } catch (err) {
      console.error('[Activity] Error loading logs:', err?.message, err);
      reportClientError(err, 'Activity logs error');
      const message = getUserErrorMessage(err, 'Failed to load activity logs. Try refreshing the page.');
      setError(message);
      showToast(message);
      setActivityLogs([]); // Clear logs on error to prevent empty state
    } finally {
      setLoadingLogs(false);
    }
  };

  const handleSelectStaff = async (staffMember) => {
    // GUARD: Validate staff member selection
    if (!staffMember?.id) {
      console.error('[Activity] Invalid staffMember:', staffMember);
      setError('Invalid staff member selected');
      return;
    }
    console.log('[Activity] Selected staff:', staffMember.id, staffMember.name);
    setSelectedStaff(staffMember);
    await fetchActivityLogs(staffMember.id);
  };

  const getActionLabel = (action) => {
    const labels = {
      'order_created': '📋 Order Created',
      'item_added': '➕ Item Added',
      'kot_sent': '🍳 Sent to Kitchen',
      'bill_generated': '📜 Bill Generated',
      'payment_completed': '💳 Payment Completed',
      'table_assigned': '🪑 Table Assigned',
    };
    return labels[action] || action;
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: 'var(--bg-page)' }}>
        <div className="text-center">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: 'var(--primary-color)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading staff activity...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: 'var(--bg-page)' }}>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-8 h-8" style={{ color: 'var(--primary-color)' }} />
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Staff Activity</h1>
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Monitor staff activities and performance</p>
        </div>

        {error && <Toast message={error} type="error" onClose={() => setError('')} />}
        {success && <Toast message={success} type="success" onClose={() => setSuccess('')} />}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Staff List */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                  <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Staff ({filteredStaff.length})
                  </h2>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                  <input
                    type="text"
                    placeholder="Search staff..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 rounded-lg focus:ring-2 focus:border-transparent transition-all"
                    style={{
                      border: `1px solid var(--border-color)`,
                      backgroundColor: 'var(--bg-card-muted)',
                      color: 'var(--text-primary)',
                      '--tw-ring-color': 'var(--primary-color)',
                    }}
                  />
                </div>
              </div>

              {filteredStaff.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                  <p style={{ color: 'var(--text-secondary)' }}>
                    {searchTerm ? 'No staff found' : 'No staff available'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {filteredStaff.map((staffMember) => (
                    <button
                      key={staffMember.id}
                      onClick={() => handleSelectStaff(staffMember)}
                      className="w-full p-3 text-left rounded-lg border-2 transition-all"
                      style={{
                        borderColor: selectedStaff?.id === staffMember.id ? 'var(--primary-color)' : 'var(--border-color)',
                        backgroundColor: selectedStaff?.id === staffMember.id ? 'var(--bg-card-muted)' : 'var(--bg-card)',
                      }}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                            {staffMember.name || 'N/A'}
                          </p>
                          <p className="text-sm truncate" style={{ color: 'var(--text-secondary)' }}>
                            {staffMember.email}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="inline-block px-2 py-1 text-xs font-semibold rounded" style={{
                              backgroundColor: 'var(--bg-card-muted)',
                              color: 'var(--text-primary)',
                            }}>
                              {staffMember.role}
                            </span>
                            {staffMember.totalOrders > 0 && (
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                {staffMember.totalOrders} orders
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <Button
                onClick={fetchStaffList}
                variant="secondary"
                className="w-full mt-4"
              >
                Refresh List
              </Button>
            </Card>
          </div>

          {/* Activity Timeline */}
          <div className="lg:col-span-2">
            {selectedStaff ? (
              <Card>
                <div className="mb-6">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-card-muted)' }}>
                      <span className="text-2xl">👤</span>
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                        {selectedStaff.name || 'N/A'}
                      </h2>
                      <p style={{ color: 'var(--text-secondary)' }}>{selectedStaff.email}</p>
                    </div>
                  </div>

                  {/* Staff Stats */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card-muted)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Orders</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--primary-color)' }}>
                        {selectedStaff.totalOrders || 0}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-card-muted)' }}>
                      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Last Active</p>
                      <p className="text-xs font-semibold" style={{ color: 'var(--primary-color)' }}>
                        {selectedStaff.lastActive
                          ? formatDate(selectedStaff.lastActive)
                          : 'Never'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <LogOut className="w-5 h-5" />
                    Activity Timeline
                  </h3>

                  {loadingLogs ? (
                    <div className="flex justify-center py-8">
                      <Loader className="w-6 h-6 animate-spin" style={{ color: 'var(--primary-color)' }} />
                    </div>
                  ) : activityLogs.length === 0 ? (
                    <div className="text-center py-8">
                      <AlertCircle className="w-12 h-12 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
                      <p style={{ color: 'var(--text-secondary)' }}>No activity recorded yet</p>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-96 overflow-y-auto">
                      {activityLogs.map((log, index) => {
                        const formatted = getFormattedActivity(log);
                        return (
                          <div
                            key={log.id || index}
                            className="rounded-lg p-4 hover:shadow-md transition-all"
                            style={{
                              border: `1px solid var(--border-color)`,
                              backgroundColor: 'var(--bg-card)',
                            }}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <span className="font-semibold text-base" style={{ color: 'var(--text-primary)' }}>
                                {getActionLabel(log.action)}
                              </span>
                              <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
                                {formatDate(log.created_at)}
                              </span>
                            </div>

                            {formatted && formatted.items && formatted.items.length > 0 && (
                              <div className="space-y-2">
                                {formatted.items.map((item, idx) => (
                                  <div
                                    key={idx}
                                    className="flex items-start justify-between text-sm"
                                    style={{ paddingLeft: '0.5rem' }}
                                  >
                                    <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>
                                      {item.label}:
                                    </span>
                                    <span
                                      style={{
                                        color: 'var(--text-primary)',
                                        fontWeight: item.label.includes('Order ID') ? '600' : '400',
                                        maxWidth: '200px',
                                        textAlign: 'right',
                                        wordBreak: 'break-word'
                                      }}
                                    >
                                      {item.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {formatted && formatted.highlight && (
                              <div
                                className="mt-3 p-2 rounded text-center font-semibold text-sm"
                                style={{
                                  backgroundColor: 'var(--bg-card-muted)',
                                  color: 'var(--primary-color)',
                                  border: `1px solid var(--border-color)`,
                                }}
                              >
                                ✨ {formatted.highlight}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </Card>
            ) : (
              <Card>
                <div className="flex flex-col items-center justify-center py-16">
                  <Users className="w-16 h-16 mb-4" style={{ color: 'var(--text-tertiary)' }} />
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Select a staff member
                  </h3>
                  <p className="text-center max-w-sm" style={{ color: 'var(--text-secondary)' }}>
                    Choose a staff member from the list to view their activity timeline
                  </p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
