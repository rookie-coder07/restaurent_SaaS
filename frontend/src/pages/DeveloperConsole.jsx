import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, Loader2, RefreshCw, Send, ShieldCheck, Store, Users } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Toast from '../components/common/Toast';
import { developerAPI } from '../services/apiEndpoints';

function formatDate(value) {
  if (!value) return 'N/A';
  try {
    return new Date(value).toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return String(value);
  }
}

function StatCard({ icon: Icon, label, value, tone = 'default' }) {
  const toneClass =
    tone === 'danger'
      ? 'from-rose-500/15 to-red-500/10'
      : tone === 'success'
        ? 'from-emerald-500/15 to-teal-500/10'
        : 'from-sky-500/15 to-indigo-500/10';

  return (
    <Card className={`bg-gradient-to-br ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">{label}</p>
          <p className="mt-3 text-3xl font-bold text-[var(--text-primary)]">{value}</p>
        </div>
        <div className="rounded-2xl bg-white/60 p-3 text-[var(--color-primary)] shadow-sm dark:bg-white/10">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

export default function DeveloperConsole({ view = 'overview' }) {
  const [dashboard, setDashboard] = useState(null);
  const [restaurants, setRestaurants] = useState([]);
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState(null);
  const [health, setHealth] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState('');
  const [toast, setToast] = useState({ type: '', message: '' });
  const [userFilters, setUserFilters] = useState({
    search: '',
    role: '',
    status: '',
  });
  const [resetState, setResetState] = useState({
    userId: '',
    password: '',
  });
  const [broadcastForm, setBroadcastForm] = useState({
    title: '',
    message: '',
  });
  const [globalMaintenanceForm, setGlobalMaintenanceForm] = useState({
    enabled: false,
    message: '',
  });

  const loadOverview = async () => {
    const [dashboardResponse, healthResponse, settingsResponse] = await Promise.all([
      developerAPI.getDashboard(),
      developerAPI.getHealth(),
      developerAPI.getSystemSettings(),
    ]);
    setDashboard(dashboardResponse.data.data);
    setHealth(healthResponse.data.data);
    setSettings(settingsResponse.data.data);
  };

  const loadRestaurants = async () => {
    const response = await developerAPI.getRestaurants();
    setRestaurants(response.data.data.items || []);
  };

  const loadUsers = async () => {
    const response = await developerAPI.getUsers(userFilters);
    setUsers(response.data.data.items || []);
  };

  const loadSystem = async () => {
    const [settingsResponse, healthResponse] = await Promise.all([
      developerAPI.getSystemSettings(),
      developerAPI.getHealth(),
    ]);
    setSettings(settingsResponse.data.data);
    setHealth(healthResponse.data.data);
    setGlobalMaintenanceForm({
      enabled: Boolean(settingsResponse.data.data?.globalMaintenance?.enabled),
      message: settingsResponse.data.data?.globalMaintenance?.message || '',
    });
  };

  const loadAudit = async () => {
    const response = await developerAPI.getAuditLogs({ limit: 100 });
    setAuditLogs(response.data.data.items || []);
  };

  const refreshView = async () => {
    setLoading(true);
    try {
      if (view === 'overview') {
        await loadOverview();
      } else if (view === 'restaurants') {
        await loadRestaurants();
      } else if (view === 'users') {
        await loadUsers();
      } else if (view === 'system') {
        await loadSystem();
      } else if (view === 'audit') {
        await loadAudit();
      }
    } catch (error) {
      setToast({
        type: 'error',
        message: error.response?.data?.message || 'Unable to load developer console data.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshView();
  }, [view]);

  useEffect(() => {
    if (view === 'users') {
      refreshView();
    }
  }, [userFilters.role, userFilters.search, userFilters.status]);

  const globalFlags = useMemo(
    () => (settings?.featureFlags || []).filter((flag) => !flag.restaurantId),
    [settings?.featureFlags]
  );

  const selectedResetUser = useMemo(
    () => users.find((user) => user.id === resetState.userId) || null,
    [resetState.userId, users]
  );

  const handleRestaurantPatch = async (restaurantId, payload, successMessage) => {
    const key = `restaurant:${restaurantId}:${Object.keys(payload).join(',')}`;
    setActionKey(key);
    try {
      await developerAPI.updateRestaurantAccess(restaurantId, payload);
      await loadRestaurants();
      if (view === 'system') {
        await loadSystem();
      }
      setToast({ type: 'success', message: successMessage });
    } catch (error) {
      setToast({ type: 'error', message: error.response?.data?.message || 'Unable to update restaurant.' });
    } finally {
      setActionKey('');
    }
  };

  const handleRestaurantMaintenanceToggle = async (restaurantId, currentState) => {
    const key = `maintenance:${restaurantId}`;
    setActionKey(key);
    try {
      await developerAPI.updateMaintenance({
        restaurantId,
        enabled: !currentState,
        message: !currentState ? 'Restaurant maintenance enabled by developer console.' : '',
      });
      await Promise.all([loadRestaurants(), loadSystem()]);
      setToast({ type: 'success', message: 'Restaurant maintenance updated.' });
    } catch (error) {
      setToast({ type: 'error', message: error.response?.data?.message || 'Unable to update maintenance.' });
    } finally {
      setActionKey('');
    }
  };

  const handleUserStatus = async (userId, nextStatus) => {
    const key = `user:${userId}:${nextStatus}`;
    setActionKey(key);
    try {
      await developerAPI.updateUserStatus(userId, { status: nextStatus });
      await loadUsers();
      setToast({ type: 'success', message: 'User status updated.' });
    } catch (error) {
      setToast({ type: 'error', message: error.response?.data?.message || 'Unable to update user.' });
    } finally {
      setActionKey('');
    }
  };

  const handleResetPassword = async () => {
    if (!resetState.userId || !resetState.password) {
      setToast({ type: 'error', message: 'Select a user and enter a new password first.' });
      return;
    }

    setActionKey(`reset:${resetState.userId}`);
    try {
      await developerAPI.resetUserPassword(resetState.userId, { newPassword: resetState.password });
      setResetState({ userId: '', password: '' });
      setToast({ type: 'success', message: 'Password reset successfully.' });
    } catch (error) {
      setToast({ type: 'error', message: error.response?.data?.message || 'Unable to reset password.' });
    } finally {
      setActionKey('');
    }
  };

  const handleGlobalMaintenanceSave = async () => {
    setActionKey('global-maintenance');
    try {
      await developerAPI.updateMaintenance(globalMaintenanceForm);
      await Promise.all([loadSystem(), loadOverview()]);
      setToast({ type: 'success', message: 'Global maintenance updated.' });
    } catch (error) {
      setToast({ type: 'error', message: error.response?.data?.message || 'Unable to update maintenance.' });
    } finally {
      setActionKey('');
    }
  };

  const handleFeatureFlagToggle = async (featureKey, enabled) => {
    const key = `feature:${featureKey}`;
    setActionKey(key);
    try {
      await developerAPI.updateFeatureFlag({ featureKey, enabled: !enabled });
      await loadSystem();
      setToast({ type: 'success', message: `${featureKey.replace('_', ' ')} updated.` });
    } catch (error) {
      setToast({ type: 'error', message: error.response?.data?.message || 'Unable to update feature flag.' });
    } finally {
      setActionKey('');
    }
  };

  const handleBroadcast = async () => {
    if (!broadcastForm.title || !broadcastForm.message) {
      setToast({ type: 'error', message: 'Enter both title and message before broadcasting.' });
      return;
    }

    setActionKey('broadcast');
    try {
      await developerAPI.createBroadcast(broadcastForm);
      setBroadcastForm({ title: '', message: '' });
      await loadSystem();
      setToast({ type: 'success', message: 'Broadcast sent successfully.' });
    } catch (error) {
      setToast({ type: 'error', message: error.response?.data?.message || 'Unable to send broadcast.' });
    } finally {
      setActionKey('');
    }
  };

  if (loading) {
    return (
      <Card className="flex min-h-[240px] items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-[var(--text-secondary)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading developer console...
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {toast.message ? (
        <Toast type={toast.type || 'success'} message={toast.message} onClose={() => setToast({ type: '', message: '' })} />
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-[var(--text-secondary)]">Platform-wide developer controls</p>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Developer Console</h1>
        </div>
        <Button type="button" variant="secondary" onClick={refreshView}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {view === 'overview' ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatCard icon={Store} label="Restaurants" value={dashboard?.totalRestaurants || 0} />
            <StatCard icon={Users} label="Active Users" value={dashboard?.activeUsers || 0} />
            <StatCard icon={Activity} label="Orders Today" value={dashboard?.totalOrdersToday || 0} />
            <StatCard
              icon={dashboard?.systemStatus === 'maintenance' ? AlertTriangle : ShieldCheck}
              label="System Status"
              value={dashboard?.systemStatus || 'unknown'}
              tone={dashboard?.systemStatus === 'maintenance' ? 'danger' : 'success'}
            />
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
            <Card>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-[var(--text-primary)]">System Health</p>
                  <p className="text-sm text-[var(--text-secondary)]">Core API and database status</p>
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  {health?.apiStatus || 'healthy'}
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">API</p>
                  <p className="mt-2 text-lg font-semibold">{health?.apiStatus || 'healthy'}</p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Database</p>
                  <p className="mt-2 text-lg font-semibold">{health?.dbStatus || 'connected'}</p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Errors</p>
                  <p className="mt-2 text-lg font-semibold">{health?.errorCount || 0}</p>
                </div>
              </div>
            </Card>

            <Card>
              <p className="text-sm font-semibold text-[var(--text-primary)]">Quick Actions</p>
              <div className="mt-4 grid gap-3">
                <div className="rounded-2xl border border-[var(--border-color)] p-4">
                  <p className="text-sm font-medium">Maintenance</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    {settings?.globalMaintenance?.enabled ? 'Global maintenance is active.' : 'System is open to restaurants.'}
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--border-color)] p-4">
                  <p className="text-sm font-medium">Recent Broadcasts</p>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    Open the system tab to send platform-wide notices to restaurants.
                  </p>
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}

      {view === 'restaurants' ? (
        <Card padded={false} className="overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-5 py-4">
            <p className="text-lg font-semibold text-[var(--text-primary)]">Restaurant Management</p>
            <p className="text-sm text-[var(--text-secondary)]">Activate, block, and maintain restaurants from one console.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border-color)] text-sm">
              <thead className="bg-[var(--bg-card-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Restaurant</th>
                  <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Status</th>
                  <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Access</th>
                  <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Maintenance</th>
                  <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {restaurants.map((restaurant) => (
                  <tr key={restaurant.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[var(--text-primary)]">{restaurant.name}</p>
                      <p className="text-[var(--text-secondary)]">{restaurant.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${restaurant.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-500/10 text-slate-700'}`}>
                        {restaurant.status}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${restaurant.accessEnabled ? 'bg-sky-500/10 text-sky-700' : 'bg-rose-500/10 text-rose-700'}`}>
                        {restaurant.accessEnabled ? 'enabled' : 'blocked'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${restaurant.maintenanceEnabled ? 'bg-amber-500/10 text-amber-700' : 'bg-emerald-500/10 text-emerald-700'}`}>
                        {restaurant.maintenanceEnabled ? 'active' : 'off'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleRestaurantPatch(
                              restaurant.id,
                              { status: restaurant.status === 'active' ? 'inactive' : 'active' },
                              'Restaurant status updated.'
                            )
                          }
                        >
                          {restaurant.status === 'active' ? 'Deactivate' : 'Activate'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            handleRestaurantPatch(
                              restaurant.id,
                              { accessEnabled: !restaurant.accessEnabled },
                              'Restaurant access updated.'
                            )
                          }
                        >
                          {restaurant.accessEnabled ? 'Block Access' : 'Enable Access'}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          disabled={actionKey === `maintenance:${restaurant.id}`}
                          onClick={() => handleRestaurantMaintenanceToggle(restaurant.id, restaurant.maintenanceEnabled)}
                        >
                          {restaurant.maintenanceEnabled ? 'Disable Maintenance' : 'Enable Maintenance'}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}

      {view === 'users' ? (
        <div className="space-y-4">
          <Card>
            <div className="grid gap-4 md:grid-cols-3">
              <Input
                label="Search"
                value={userFilters.search}
                onChange={(event) => setUserFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search by name or email"
              />
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Role</span>
                <select
                  className="input"
                  value={userFilters.role}
                  onChange={(event) => setUserFilters((current) => ({ ...current, role: event.target.value }))}
                >
                  <option value="">All roles</option>
                  <option value="developer">Developer</option>
                  <option value="manager">Manager</option>
                  <option value="staff">POS Staff</option>
                  <option value="kitchen_staff">Kitchen Staff</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Status</span>
                <select
                  className="input"
                  value={userFilters.status}
                  onChange={(event) => setUserFilters((current) => ({ ...current, status: event.target.value }))}
                >
                  <option value="">All users</option>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            </div>
          </Card>

          <Card>
            <p className="text-sm font-semibold text-[var(--text-primary)]">Reset Password</p>
            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]">
              <label className="space-y-2">
                <span className="text-sm font-medium text-[var(--text-primary)]">Target User</span>
                <select
                  className="input"
                  value={resetState.userId}
                  onChange={(event) => setResetState((current) => ({ ...current, userId: event.target.value }))}
                >
                  <option value="">Select user</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name} ({user.role})
                    </option>
                  ))}
                </select>
              </label>
              <Input
                label="New Password"
                type="password"
                value={resetState.password}
                onChange={(event) => setResetState((current) => ({ ...current, password: event.target.value }))}
                placeholder="Enter new password"
              />
              <div className="flex items-end">
                <Button type="button" disabled={actionKey === `reset:${resetState.userId}`} onClick={handleResetPassword}>
                  {actionKey === `reset:${resetState.userId}` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Reset Password
                </Button>
              </div>
            </div>
            {selectedResetUser ? (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Resetting password for <span className="font-semibold text-[var(--text-primary)]">{selectedResetUser.name}</span>.
              </p>
            ) : null}
          </Card>

          <Card padded={false} className="overflow-hidden">
            <div className="border-b border-[var(--border-color)] px-5 py-4">
              <p className="text-lg font-semibold text-[var(--text-primary)]">User Management</p>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[var(--border-color)] text-sm">
                <thead className="bg-[var(--bg-card-muted)]">
                  <tr>
                    <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">User</th>
                    <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Restaurant</th>
                    <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Role</th>
                    <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Status</th>
                    <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-color)]">
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[var(--text-primary)]">{user.name}</p>
                        <p className="text-[var(--text-secondary)]">{user.email}</p>
                      </td>
                      <td className="px-5 py-4 text-[var(--text-secondary)]">{user.restaurantName}</td>
                      <td className="px-5 py-4">
                        <span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]">
                          {user.role}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${user.status === 'active' ? 'bg-emerald-500/10 text-emerald-700' : 'bg-slate-500/10 text-slate-700'}`}>
                          {user.status}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          disabled={actionKey === `user:${user.id}:${user.status === 'active' ? 'inactive' : 'active'}`}
                          onClick={() => handleUserStatus(user.id, user.status === 'active' ? 'inactive' : 'active')}
                        >
                          {user.status === 'active' ? 'Disable' : 'Enable'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      ) : null}

      {view === 'system' ? (
        <div className="grid gap-4 xl:grid-cols-[1.1fr_1fr]">
          <div className="space-y-4">
            <Card>
              <p className="text-lg font-semibold text-[var(--text-primary)]">Global Maintenance</p>
              <div className="mt-4 grid gap-4">
                <label className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] px-4 py-3">
                  <div>
                    <p className="font-medium text-[var(--text-primary)]">Enable maintenance mode</p>
                    <p className="text-sm text-[var(--text-secondary)]">Blocks non-developer access platform-wide.</p>
                  </div>
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={globalMaintenanceForm.enabled}
                    onChange={(event) => setGlobalMaintenanceForm((current) => ({ ...current, enabled: event.target.checked }))}
                  />
                </label>
                <Input
                  label="Maintenance Message"
                  value={globalMaintenanceForm.message}
                  onChange={(event) => setGlobalMaintenanceForm((current) => ({ ...current, message: event.target.value }))}
                  placeholder="System is under maintenance."
                />
                <div>
                  <Button type="button" disabled={actionKey === 'global-maintenance'} onClick={handleGlobalMaintenanceSave}>
                    {actionKey === 'global-maintenance' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save Maintenance Settings
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <p className="text-lg font-semibold text-[var(--text-primary)]">Feature Flags</p>
              <div className="mt-4 space-y-3">
                {globalFlags.map((flag) => (
                  <label key={flag.id} className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] px-4 py-3">
                    <div>
                      <p className="font-medium capitalize text-[var(--text-primary)]">{flag.featureKey.replaceAll('_', ' ')}</p>
                      <p className="text-sm text-[var(--text-secondary)]">Global platform setting</p>
                    </div>
                    <input
                      type="checkbox"
                      className="h-5 w-5"
                      checked={flag.enabled}
                      onChange={() => handleFeatureFlagToggle(flag.featureKey, flag.enabled)}
                      disabled={actionKey === `feature:${flag.featureKey}`}
                    />
                  </label>
                ))}
              </div>
            </Card>

            <Card>
              <p className="text-lg font-semibold text-[var(--text-primary)]">Broadcast Notifications</p>
              <div className="mt-4 grid gap-4">
                <Input
                  label="Title"
                  value={broadcastForm.title}
                  onChange={(event) => setBroadcastForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Scheduled maintenance"
                />
                <label className="space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Message</span>
                  <textarea
                    className="input min-h-[120px]"
                    value={broadcastForm.message}
                    onChange={(event) => setBroadcastForm((current) => ({ ...current, message: event.target.value }))}
                    placeholder="Message to all restaurants"
                  />
                </label>
                <div>
                  <Button type="button" disabled={actionKey === 'broadcast'} onClick={handleBroadcast}>
                    {actionKey === 'broadcast' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Send Broadcast
                  </Button>
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <p className="text-lg font-semibold text-[var(--text-primary)]">System Health</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">API Status</p>
                  <p className="mt-2 text-lg font-semibold">{health?.apiStatus || 'healthy'}</p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">DB Status</p>
                  <p className="mt-2 text-lg font-semibold">{health?.dbStatus || 'connected'}</p>
                </div>
                <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Error Count</p>
                  <p className="mt-2 text-lg font-semibold">{health?.errorCount || 0}</p>
                </div>
              </div>
            </Card>

            <Card>
              <p className="text-lg font-semibold text-[var(--text-primary)]">Restaurant Maintenance</p>
              <div className="mt-4 space-y-3">
                {(settings?.restaurantMaintenance || []).length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No restaurants are currently in maintenance mode.</p>
                ) : (
                  (settings?.restaurantMaintenance || []).map((entry) => (
                    <div key={entry.restaurantId} className="rounded-2xl border border-[var(--border-color)] px-4 py-3">
                      <p className="font-medium text-[var(--text-primary)]">{entry.restaurantId}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{entry.message || 'Maintenance enabled'}</p>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">Updated {formatDate(entry.updatedAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card>
              <p className="text-lg font-semibold text-[var(--text-primary)]">Recent Broadcasts</p>
              <div className="mt-4 space-y-3">
                {(settings?.broadcasts || []).length === 0 ? (
                  <p className="text-sm text-[var(--text-secondary)]">No broadcasts sent yet.</p>
                ) : (
                  (settings?.broadcasts || []).map((broadcast) => (
                    <div key={broadcast.id} className="rounded-2xl border border-[var(--border-color)] px-4 py-3">
                      <p className="font-medium text-[var(--text-primary)]">{broadcast.title}</p>
                      <p className="mt-1 text-sm text-[var(--text-secondary)]">{broadcast.message}</p>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">{formatDate(broadcast.createdAt)}</p>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      ) : null}

      {view === 'audit' ? (
        <Card padded={false} className="overflow-hidden">
          <div className="border-b border-[var(--border-color)] px-5 py-4">
            <p className="text-lg font-semibold text-[var(--text-primary)]">Audit Logs</p>
            <p className="text-sm text-[var(--text-secondary)]">Developer actions across restaurants and system controls.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border-color)] text-sm">
              <thead className="bg-[var(--bg-card-muted)]">
                <tr>
                  <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Action</th>
                  <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Actor</th>
                  <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Target</th>
                  <th className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-color)]">
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold text-[var(--text-primary)]">{log.action}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{log.targetType}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-[var(--text-primary)]">{log.actorEmail || 'system'}</p>
                      <p className="text-xs text-[var(--text-secondary)]">{log.actorRole || 'n/a'}</p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-[var(--text-primary)]">{log.targetId || 'system'}</p>
                      {Object.keys(log.metadata || {}).length > 0 ? (
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">{JSON.stringify(log.metadata)}</p>
                      ) : null}
                    </td>
                    <td className="px-5 py-4 text-[var(--text-secondary)]">{formatDate(log.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
