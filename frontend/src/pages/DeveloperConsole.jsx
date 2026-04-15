import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Activity, AlertTriangle, Download, Loader2, RefreshCw, Send, ShieldCheck, ShieldAlert, Store, UserCog, Users, Zap } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import EmptyState from '../components/common/EmptyState';
import Toast from '../components/common/Toast';
import { developerAPI } from '../services/apiEndpoints';

const PAGE_SIZE = 20;

const formatDate = (value) => {
  if (!value) return 'No data';
  try {
    return new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return String(value);
  }
};

const formatCurrency = (value) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount === 0) return 'No data';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

const metricValue = (value, formatter) => {
  if (value === null || value === undefined || value === 0 || value === '0') return 'No data';
  return formatter ? formatter(value) : value;
};

function SectionHeader({ title, subtitle, actions }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">{title}</h1>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone = 'default', caption }) {
  const tones = {
    default: 'from-sky-500/15 to-indigo-500/10',
    success: 'from-emerald-500/15 to-teal-500/10',
    warning: 'from-amber-500/15 to-orange-500/10',
    danger: 'from-rose-500/15 to-red-500/10',
  };

  return (
    <Card className={`bg-gradient-to-br ${tones[tone] || tones.default}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">{label}</p>
          <p className="mt-3 text-3xl font-bold text-[var(--text-primary)]">{value}</p>
          {caption ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{caption}</p> : null}
        </div>
        <div className="rounded-2xl bg-white/60 p-3 text-[var(--color-primary)] shadow-sm dark:bg-white/10">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

function ChartCard({ title, subtitle, children }) {
  return (
    <Card>
      <div className="mb-4">
        <p className="text-lg font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
      </div>
      <div className="h-72">{children}</div>
    </Card>
  );
}

function TableCard({ title, subtitle, columns, rows, renderRow, emptyTitle, emptyDescription }) {
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="border-b border-[var(--border-color)] px-5 py-4">
        <p className="text-lg font-semibold text-[var(--text-primary)]">{title}</p>
        <p className="text-sm text-[var(--text-secondary)]">{subtitle}</p>
      </div>
      {rows.length === 0 ? (
        <div className="p-5">
          <EmptyState icon={Activity} title={emptyTitle} description={emptyDescription} />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-[var(--border-color)] text-sm">
            <thead className="bg-[var(--bg-card-muted)]">
              <tr>{columns.map((column) => <th key={column} className="px-5 py-3 text-left font-semibold text-[var(--text-secondary)]">{column}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-color)]">{rows.map(renderRow)}</tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

export default function DeveloperConsole({ view = 'overview' }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [actionKey, setActionKey] = useState('');
  const [toast, setToast] = useState({ type: '', message: '' });
  const [overview, setOverview] = useState(null);
  const [liveMonitor, setLiveMonitor] = useState(null);
  const [restaurants, setRestaurants] = useState({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 });
  const [users, setUsers] = useState({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 });
  const [settings, setSettings] = useState(null);
  const [auditLogs, setAuditLogs] = useState({ items: [], total: 0, limit: PAGE_SIZE, offset: 0 });
  const [security, setSecurity] = useState({ alerts: [], failedLoginAttempts: [], suspiciousActivity: [] });
  const [errors, setErrors] = useState({ items: [] });
  const [selectedUserId, setSelectedUserId] = useState('');
  const [loginHistory, setLoginHistory] = useState([]);
  const [userFilters, setUserFilters] = useState({ search: '', role: '', status: '' });
  const [restaurantPage, setRestaurantPage] = useState(0);
  const [userPage, setUserPage] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const [broadcastForm, setBroadcastForm] = useState({ title: '', message: '' });
  const [maintenanceForm, setMaintenanceForm] = useState({ enabled: false, message: '' });
  const [systemForm, setSystemForm] = useState({ globalTaxConfig: { taxRate: 0, serviceChargeRate: 0, taxLabel: 'GST' }, invoiceSettings: { prefix: 'INV', footer: '', supportEmail: '' }, defaultConfigs: { timezone: 'Asia/Kolkata', currency: 'INR', orderAutoRefreshSeconds: 10 } });
  const [passwordForm, setPasswordForm] = useState({ userId: '', newPassword: '' });
  const [selectedFlagScope, setSelectedFlagScope] = useState('global');

  const loadOverview = async () => {
    try {
      const response = await developerAPI.getOverview();
      const payload = response.data.data;
      setOverview(payload);
      setLiveMonitor(payload.liveMonitor);
      setSecurity(payload.security);
      setErrors(payload.errors);
    } catch (error) {
      console.error('Failed to load overview:', error);
      // Set default structure to prevent undefined errors
      setOverview({
        analytics: { totalRevenue: 0, ordersPerDay: 0, ordersPerWeek: 0, ordersPerMonth: 0, dailySeries: [], peakHours: [], topRestaurants: [] },
        liveMonitor: { activeUsers: 0, errorRate: 0, responseTime: 0, liveOrders: [] },
        security: { alerts: [], failedLoginAttempts: [], suspiciousActivity: [] },
        errors: { items: [] },
        systemHealth: { errorCount: 0 }
      });
      throw error;
    }
  };

  const loadLiveMonitor = async () => {
    const response = await developerAPI.getLiveMonitor();
    setLiveMonitor(response.data.data);
  };

  const loadRestaurants = async () => {
    const response = await developerAPI.getRestaurants({ limit: PAGE_SIZE, offset: restaurantPage * PAGE_SIZE });
    setRestaurants(response.data.data);
  };

  const loadUsers = async () => {
    const response = await developerAPI.getUsers({ ...userFilters, limit: PAGE_SIZE, offset: userPage * PAGE_SIZE });
    setUsers(response.data.data);
  };

  const loadSystem = async () => {
    const [settingsResponse, errorResponse, restaurantsResponse] = await Promise.all([developerAPI.getSystemSettings(), developerAPI.getErrorTracking({ limit: 20 }), developerAPI.getRestaurants({ limit: PAGE_SIZE, offset: 0 })]);
    const payload = settingsResponse.data.data;
    setSettings(payload);
    setErrors(errorResponse.data.data);
    setRestaurants(restaurantsResponse.data.data);
    setMaintenanceForm({ enabled: Boolean(payload.globalMaintenance?.enabled), message: payload.globalMaintenance?.message || '' });
    setSystemForm({
      globalTaxConfig: payload.globalTaxConfig || { taxRate: 0, serviceChargeRate: 0, taxLabel: 'GST' },
      invoiceSettings: payload.invoiceSettings || { prefix: 'INV', footer: '', supportEmail: '' },
      defaultConfigs: payload.defaultConfigs || { timezone: 'Asia/Kolkata', currency: 'INR', orderAutoRefreshSeconds: 10 },
    });
  };

  const loadAudit = async () => {
    const [auditResponse, securityResponse] = await Promise.all([
      developerAPI.getAuditLogs({ limit: PAGE_SIZE, offset: auditPage * PAGE_SIZE }),
      developerAPI.getSecurityOverview(),
    ]);
    setAuditLogs(auditResponse.data.data);
    setSecurity(securityResponse.data.data);
  };

  const refreshView = async () => {
    setLoading(true);
    try {
      if (view === 'overview') await loadOverview();
      if (view === 'restaurants') await loadRestaurants();
      if (view === 'users') await loadUsers();
      if (view === 'system') await loadSystem();
      if (view === 'audit') await loadAudit();
    } catch (error) {
      setToast({ type: 'error', message: error.response?.data?.message || 'Unable to load control center.' });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { refreshView(); }, [view, restaurantPage, userPage, auditPage]);
  useEffect(() => { if (view === 'users') loadUsers().catch(() => {}); }, [userFilters.search, userFilters.role, userFilters.status]);
  useEffect(() => {
    if (view !== 'overview') return undefined;
    const intervalId = setInterval(() => { loadLiveMonitor().catch(() => {}); }, 10000);
    return () => clearInterval(intervalId);
  }, [view]);
  useEffect(() => {
    if (!selectedUserId) {
      setLoginHistory([]);
      return;
    }
    developerAPI.getUserLoginHistory(selectedUserId, { limit: 20 }).then((response) => setLoginHistory(response.data.data.items || [])).catch(() => setLoginHistory([]));
  }, [selectedUserId]);

  const featureFlags = settings?.featureFlags || [];
  const scopedFlags = useMemo(() => featureFlags.filter((flag) => (selectedFlagScope === 'global' ? !flag.restaurantId : flag.restaurantId === selectedFlagScope)), [featureFlags, selectedFlagScope]);
  const totalRestaurantPages = Math.max(1, Math.ceil((restaurants.total || 0) / PAGE_SIZE));
  const totalUserPages = Math.max(1, Math.ceil((users.total || 0) / PAGE_SIZE));

  const setSuccess = (message) => setToast({ type: 'success', message });
  const setError = (error, fallback) => setToast({ type: 'error', message: error.response?.data?.message || fallback });

  const runAction = async (key, fn, message) => {
    setActionKey(key);
    try {
      await fn();
      if (message) setSuccess(message);
    } catch (error) {
      setError(error, 'Action failed.');
    } finally {
      setActionKey('');
    }
  };

  const downloadExport = async (resource) => {
    await runAction(`export:${resource}`, async () => {
      const response = await developerAPI.exportData(resource);
      const payload = response.data.data;
      const blob = new Blob([payload.content || ''], { type: payload.mimeType || 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = payload.filename || `${resource}-export.txt`;
      anchor.click();
      window.URL.revokeObjectURL(url);
    }, `${resource} export downloaded.`);
  };

  const saveMaintenance = async () => runAction('maintenance', async () => {
    await developerAPI.updateMaintenance(maintenanceForm);
    await Promise.all([loadSystem(), loadOverview().catch(() => {})]);
  }, 'Maintenance settings updated.');

  const saveSystemSettings = async () => runAction('system-settings', async () => {
    await developerAPI.updateSystemSettings(systemForm);
    await loadSystem();
  }, 'System settings updated.');

  const sendBroadcast = async () => {
    if (!broadcastForm.title || !broadcastForm.message) {
      setToast({ type: 'error', message: 'Enter title and message first.' });
      return;
    }
    await runAction('broadcast', async () => {
      await developerAPI.createBroadcast(broadcastForm);
      setBroadcastForm({ title: '', message: '' });
      await loadSystem();
    }, 'Broadcast sent successfully.');
  };

  const resetPassword = async () => {
    if (!passwordForm.userId || !passwordForm.newPassword) {
      setToast({ type: 'error', message: 'Select a user and enter a password first.' });
      return;
    }
    await runAction(`password:${passwordForm.userId}`, async () => {
      await developerAPI.resetUserPassword(passwordForm.userId, { newPassword: passwordForm.newPassword });
      setPasswordForm({ userId: '', newPassword: '' });
    }, 'Password reset successfully.');
  };

  if (loading) {
    return <Card className="flex min-h-[260px] items-center justify-center"><div className="flex items-center gap-3 text-sm font-medium text-[var(--text-secondary)]"><Loader2 className="h-4 w-4 animate-spin" />Loading SaaS Control Center...</div></Card>;
  }

  const analytics = overview?.analytics;

  if (view === 'overview') {
    return (
      <div className="space-y-4">
        {toast.message ? <Toast type={toast.type || 'success'} message={toast.message} onClose={() => setToast({ type: '', message: '' })} /> : null}
        <SectionHeader title="SaaS Control Center" subtitle="Global analytics, live traffic, and production visibility" actions={<Button type="button" variant="secondary" onClick={refreshView}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={Store} label="Total Revenue" value={metricValue(analytics?.totalRevenue, formatCurrency)} tone="success" />
          <StatCard icon={Activity} label="Orders Today" value={metricValue(analytics?.ordersPerDay)} />
          <StatCard icon={Users} label="Active Users" value={metricValue(liveMonitor?.activeUsers)} />
          <StatCard icon={liveMonitor?.errorRate > 10 ? ShieldAlert : ShieldCheck} label="Error Rate" value={metricValue(liveMonitor?.errorRate, (value) => `${value}%`)} tone={liveMonitor?.errorRate > 10 ? 'danger' : 'success'} />
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          <ChartCard title="Orders and Revenue" subtitle="Last 30 days across all restaurants">
            {(analytics?.dailySeries || []).length === 0 ? <EmptyState icon={Activity} title="No analytics yet" description="Completed orders will populate this chart." /> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={analytics.dailySeries}><defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.35} /><stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.02} /></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Area type="monotone" dataKey="revenue" stroke="#0ea5e9" fill="url(#revenueFill)" /><Line type="monotone" dataKey="orders" stroke="#14b8a6" dot={false} /></AreaChart></ResponsiveContainer>}
          </ChartCard>
          <ChartCard title="Peak Hours" subtitle="Completed order distribution by hour">
            {(analytics?.peakHours || []).length === 0 ? <EmptyState icon={Zap} title="No peak-hour data" description="Peak-hour analysis appears after settled orders are available." /> : <ResponsiveContainer width="100%" height="100%"><BarChart data={analytics.peakHours}><CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.18)" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Bar dataKey="orders" fill="#f59e0b" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer>}
          </ChartCard>
        </div>
        <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
          <TableCard title="Live Order Feed" subtitle="Most recent orders across every restaurant" columns={['Order', 'Restaurant', 'Status', 'Updated']} rows={liveMonitor?.liveOrders || []} emptyTitle="No live orders" emptyDescription="Incoming orders will appear here." renderRow={(order) => <tr key={order.id}><td className="px-5 py-4"><p className="font-semibold text-[var(--text-primary)]">{order.displayOrderNumber}</p><p className="text-[var(--text-secondary)]">{metricValue(order.totalAmount, formatCurrency)}</p></td><td className="px-5 py-4"><p className="font-medium text-[var(--text-primary)]">{order.restaurantName}</p><p className="text-[var(--text-secondary)]">Table {order.tableNumber || 'No data'}</p></td><td className="px-5 py-4"><span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]">{order.status}</span></td><td className="px-5 py-4 text-[var(--text-secondary)]">{formatDate(order.updatedAt)}</td></tr>} />
          <Card>
            <p className="text-lg font-semibold text-[var(--text-primary)]">Top Performing Restaurants</p>
            <div className="mt-4 space-y-3">{(analytics?.topRestaurants || []).length === 0 ? <EmptyState icon={Store} title="No rankings yet" description="Rankings appear after completed sales start flowing." /> : analytics.topRestaurants.map((restaurant, index) => <div key={restaurant.restaurantId} className="rounded-2xl border border-[var(--border-color)] px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-[var(--text-primary)]">#{index + 1} {restaurant.restaurantName}</p><p className="text-sm text-[var(--text-secondary)]">{metricValue(restaurant.orders)} orders</p></div><p className="text-lg font-semibold text-[var(--text-primary)]">{metricValue(restaurant.revenue, formatCurrency)}</p></div></div>)}</div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-[var(--bg-card-muted)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Req/Min</p><p className="mt-2 text-lg font-semibold">{metricValue(liveMonitor?.apiRequestRate)}</p></div><div className="rounded-2xl bg-[var(--bg-card-muted)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Latency</p><p className="mt-2 text-lg font-semibold">{metricValue(liveMonitor?.responseTime, (value) => `${value} ms`)}</p></div><div className="rounded-2xl bg-[var(--bg-card-muted)] p-4"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Errors</p><p className="mt-2 text-lg font-semibold">{metricValue(overview?.systemHealth?.errorCount)}</p></div></div>
          </Card>
        </div>
      </div>
    );
  }
  if (view === 'restaurants') {
    return (
      <div className="space-y-4">
        {toast.message ? <Toast type={toast.type || 'success'} message={toast.message} onClose={() => setToast({ type: '', message: '' })} /> : null}
        <SectionHeader title="Restaurant Control Panel" subtitle="Activation, maintenance, performance, and tenant-wide logout" actions={<><Button type="button" onClick={() => navigate('/developer/create-restaurant')}>Create Restaurant</Button><Button type="button" variant="secondary" onClick={refreshView}><RefreshCw className="h-4 w-4" />Refresh</Button></>} />
        <TableCard title="Restaurants" subtitle="Full tenant visibility for the developer role" columns={['Restaurant', 'Health', 'Performance', 'Actions']} rows={restaurants.items || []} emptyTitle="No restaurants found" emptyDescription="Restaurants will appear here once tenant records exist." renderRow={(restaurant) => <tr key={restaurant.id}><td className="px-5 py-4"><p className="font-semibold text-[var(--text-primary)]">{restaurant.name}</p><p className="text-[var(--text-secondary)]">{restaurant.email || 'No data'} • {restaurant.city || 'No data'}</p></td><td className="px-5 py-4"><p className="text-[var(--text-primary)]">Status: {restaurant.status}</p><p className="text-[var(--text-secondary)]">Access: {restaurant.accessEnabled ? 'enabled' : 'blocked'} • Maintenance: {restaurant.maintenanceEnabled ? 'on' : 'off'}</p><p className="text-[var(--text-secondary)]">Users: {metricValue(restaurant.activeUsers)} active / {metricValue(restaurant.totalUsers)}</p></td><td className="px-5 py-4"><p className="text-[var(--text-primary)]">Revenue: {metricValue(restaurant.revenue, formatCurrency)}</p><p className="text-[var(--text-secondary)]">Orders: {metricValue(restaurant.orderCount)} total • {metricValue(restaurant.ordersToday)} today</p></td><td className="px-5 py-4"><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" disabled={actionKey === `restaurant:${restaurant.id}:status`} onClick={() => runAction(`restaurant:${restaurant.id}:status`, async () => { await developerAPI.updateRestaurantAccess(restaurant.id, { status: restaurant.status === 'active' ? 'inactive' : 'active' }); await loadRestaurants(); }, 'Restaurant status updated.')}>{restaurant.status === 'active' ? 'Deactivate' : 'Activate'}</Button><Button type="button" size="sm" variant="secondary" disabled={actionKey === `restaurant:${restaurant.id}:access`} onClick={() => runAction(`restaurant:${restaurant.id}:access`, async () => { await developerAPI.updateRestaurantAccess(restaurant.id, { accessEnabled: !restaurant.accessEnabled }); await loadRestaurants(); }, 'Restaurant access updated.')}>{restaurant.accessEnabled ? 'Block Access' : 'Enable Access'}</Button><Button type="button" size="sm" variant="ghost" disabled={actionKey === `restaurant:${restaurant.id}:maintenance`} onClick={() => runAction(`restaurant:${restaurant.id}:maintenance`, async () => { await developerAPI.updateMaintenance({ restaurantId: restaurant.id, enabled: !restaurant.maintenanceEnabled, message: !restaurant.maintenanceEnabled ? 'Maintenance enabled by developer.' : '' }); await loadRestaurants(); }, 'Restaurant maintenance updated.')}>{restaurant.maintenanceEnabled ? 'Disable Maint.' : 'Enable Maint.'}</Button><Button type="button" size="sm" variant="ghost" disabled={actionKey === `restaurant:${restaurant.id}:logout`} onClick={() => runAction(`restaurant:${restaurant.id}:logout`, async () => { await developerAPI.forceLogoutRestaurantUsers(restaurant.id); }, 'Restaurant users logged out.')}>Force Logout</Button></div></td></tr>} />
        <div className="flex items-center justify-end gap-2"><Button type="button" variant="secondary" disabled={restaurantPage === 0} onClick={() => setRestaurantPage((page) => Math.max(0, page - 1))}>Previous</Button><span className="text-sm text-[var(--text-secondary)]">Page {restaurantPage + 1} of {totalRestaurantPages}</span><Button type="button" variant="secondary" disabled={restaurantPage + 1 >= totalRestaurantPages} onClick={() => setRestaurantPage((page) => page + 1)}>Next</Button></div>
      </div>
    );
  }

  if (view === 'users') {
    return (
      <div className="space-y-4">
        {toast.message ? <Toast type={toast.type || 'success'} message={toast.message} onClose={() => setToast({ type: '', message: '' })} /> : null}
        <SectionHeader title="Advanced User Management" subtitle="Role changes, bans, password resets, force logout, and login history" actions={<><Button type="button" onClick={() => navigate('/developer/reset-user-password')}>Reset User Password</Button><Button type="button" variant="secondary" onClick={refreshView}><RefreshCw className="h-4 w-4" />Refresh</Button></>} />
        <Card><div className="grid gap-4 md:grid-cols-3"><Input label="Search" value={userFilters.search} onChange={(event) => setUserFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Search by name or email" /><label className="space-y-2"><span className="text-sm font-medium text-[var(--text-primary)]">Role</span><select className="input" value={userFilters.role} onChange={(event) => setUserFilters((current) => ({ ...current, role: event.target.value }))}><option value="">All roles</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="staff">Staff</option><option value="kitchen_staff">Kitchen</option><option value="developer">Developer</option></select></label><label className="space-y-2"><span className="text-sm font-medium text-[var(--text-primary)]">Status</span><select className="input" value={userFilters.status} onChange={(event) => setUserFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option><option value="disabled">Disabled</option><option value="banned">Banned</option></select></label></div></Card>
        <Card><p className="text-lg font-semibold text-[var(--text-primary)]">Reset Password</p><div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr_auto]"><label className="space-y-2"><span className="text-sm font-medium text-[var(--text-primary)]">Target User</span><select className="input" value={passwordForm.userId} onChange={(event) => setPasswordForm((current) => ({ ...current, userId: event.target.value }))}><option value="">Select user</option>{(users.items || []).map((user) => <option key={user.id} value={user.id}>{user.name} ({user.role})</option>)}</select></label><Input label="New Password" type="password" value={passwordForm.newPassword} onChange={(event) => setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))} placeholder="Enter new password" /><div className="flex items-end"><Button type="button" disabled={actionKey === `password:${passwordForm.userId}`} onClick={resetPassword}>Reset Password</Button></div></div></Card>
        <TableCard title="Users" subtitle="Developer can manage every account across every restaurant" columns={['User', 'Restaurant', 'Controls', 'Actions']} rows={users.items || []} emptyTitle="No users found" emptyDescription="Users will appear here once accounts exist." renderRow={(user) => <tr key={user.id}><td className="px-5 py-4"><p className="font-semibold text-[var(--text-primary)]">{user.name}</p><p className="text-[var(--text-secondary)]">{user.email}</p></td><td className="px-5 py-4"><p className="text-[var(--text-primary)]">{user.restaurantName}</p><p className="text-[var(--text-secondary)]">{user.phone || 'No data'}</p></td><td className="px-5 py-4"><div className="grid gap-2"><select className="input" value={user.role} onChange={(event) => { const nextRole = event.target.value; runAction(`role:${user.id}`, async () => { await developerAPI.updateUserRole(user.id, { role: nextRole }); await loadUsers(); }, 'User role updated.'); }}><option value="admin">Admin</option><option value="manager">Manager</option><option value="staff">Staff</option><option value="kitchen_staff">Kitchen</option><option value="developer">Developer</option></select><select className="input" value={user.status} onChange={(event) => { const nextStatus = event.target.value; runAction(`status:${user.id}`, async () => { await developerAPI.updateUserStatus(user.id, { status: nextStatus }); await loadUsers(); }, 'User status updated.'); }}><option value="active">Active</option><option value="inactive">Inactive</option><option value="disabled">Disabled</option><option value="banned">Banned</option></select></div></td><td className="px-5 py-4"><div className="flex flex-wrap gap-2"><Button type="button" size="sm" variant="secondary" onClick={() => setSelectedUserId(user.id)}>Login History</Button><Button type="button" size="sm" variant="ghost" disabled={actionKey === `logout:${user.id}`} onClick={() => runAction(`logout:${user.id}`, async () => { await developerAPI.forceLogoutUser(user.id); }, 'User logged out successfully.')}>Force Logout</Button></div></td></tr>} />
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]"><div className="flex items-center justify-end gap-2"><Button type="button" variant="secondary" disabled={userPage === 0} onClick={() => setUserPage((page) => Math.max(0, page - 1))}>Previous</Button><span className="text-sm text-[var(--text-secondary)]">Page {userPage + 1} of {totalUserPages}</span><Button type="button" variant="secondary" disabled={userPage + 1 >= totalUserPages} onClick={() => setUserPage((page) => page + 1)}>Next</Button></div><Card><p className="text-lg font-semibold text-[var(--text-primary)]">Login History</p><div className="mt-4 space-y-3">{loginHistory.length === 0 ? <EmptyState icon={UserCog} title="Select a user" description="Login history and session records appear here." /> : loginHistory.map((entry) => <div key={entry.id} className="rounded-2xl border border-[var(--border-color)] px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="font-medium text-[var(--text-primary)]">{entry.type}</p><span className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-primary)]">{entry.status}</span></div><p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDate(entry.createdAt || entry.lastUsedAt)}</p>{entry.metadata?.ipAddress || entry.metadata?.userAgent ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{entry.metadata.ipAddress || 'No IP'} • {entry.metadata.userAgent || 'No agent'}</p> : null}</div>)}</div></Card></div>
      </div>
    );
  }

  if (view === 'system') {
    return (
      <div className="space-y-4">
        {toast.message ? <Toast type={toast.type || 'success'} message={toast.message} onClose={() => setToast({ type: '', message: '' })} /> : null}
        <SectionHeader title="System Settings & Feature Flags" subtitle="Global tax config, invoice defaults, exports, feature delivery, and error tracking" actions={<Button type="button" variant="secondary" onClick={refreshView}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]"><div className="space-y-4"><Card><p className="text-lg font-semibold text-[var(--text-primary)]">Global Maintenance</p><div className="mt-4 grid gap-4"><label className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] px-4 py-3"><div><p className="font-medium text-[var(--text-primary)]">Enable maintenance mode</p><p className="text-sm text-[var(--text-secondary)]">Blocks non-developer access across the platform.</p></div><input type="checkbox" className="h-5 w-5" checked={maintenanceForm.enabled} onChange={(event) => setMaintenanceForm((current) => ({ ...current, enabled: event.target.checked }))} /></label><Input label="Maintenance Message" value={maintenanceForm.message} onChange={(event) => setMaintenanceForm((current) => ({ ...current, message: event.target.value }))} placeholder="System is under maintenance." /><div><Button type="button" disabled={actionKey === 'maintenance'} onClick={saveMaintenance}>Save Maintenance</Button></div></div></Card><Card><p className="text-lg font-semibold text-[var(--text-primary)]">Global Settings</p><div className="mt-4 grid gap-4 md:grid-cols-2"><Input label="Tax Rate" type="number" value={systemForm.globalTaxConfig.taxRate} onChange={(event) => setSystemForm((current) => ({ ...current, globalTaxConfig: { ...current.globalTaxConfig, taxRate: Number(event.target.value) } }))} /><Input label="Service Charge" type="number" value={systemForm.globalTaxConfig.serviceChargeRate} onChange={(event) => setSystemForm((current) => ({ ...current, globalTaxConfig: { ...current.globalTaxConfig, serviceChargeRate: Number(event.target.value) } }))} /><Input label="Tax Label" value={systemForm.globalTaxConfig.taxLabel} onChange={(event) => setSystemForm((current) => ({ ...current, globalTaxConfig: { ...current.globalTaxConfig, taxLabel: event.target.value } }))} /><Input label="Invoice Prefix" value={systemForm.invoiceSettings.prefix} onChange={(event) => setSystemForm((current) => ({ ...current, invoiceSettings: { ...current.invoiceSettings, prefix: event.target.value } }))} /><Input label="Support Email" value={systemForm.invoiceSettings.supportEmail} onChange={(event) => setSystemForm((current) => ({ ...current, invoiceSettings: { ...current.invoiceSettings, supportEmail: event.target.value } }))} /><Input label="Auto Refresh (sec)" type="number" value={systemForm.defaultConfigs.orderAutoRefreshSeconds} onChange={(event) => setSystemForm((current) => ({ ...current, defaultConfigs: { ...current.defaultConfigs, orderAutoRefreshSeconds: Number(event.target.value) } }))} /></div><label className="mt-4 block space-y-2"><span className="text-sm font-medium text-[var(--text-primary)]">Invoice Footer</span><textarea className="input min-h-[100px]" value={systemForm.invoiceSettings.footer} onChange={(event) => setSystemForm((current) => ({ ...current, invoiceSettings: { ...current.invoiceSettings, footer: event.target.value } }))} /></label><div className="mt-4"><Button type="button" disabled={actionKey === 'system-settings'} onClick={saveSystemSettings}>Save System Settings</Button></div></Card><Card><p className="text-lg font-semibold text-[var(--text-primary)]">Exports & Backup</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={actionKey === 'export:orders'} onClick={() => downloadExport('orders')}><Download className="h-4 w-4" />Export Orders</Button><Button type="button" variant="secondary" disabled={actionKey === 'export:users'} onClick={() => downloadExport('users')}><Download className="h-4 w-4" />Export Users</Button><Button type="button" variant="secondary" disabled={actionKey === 'export:backup'} onClick={() => downloadExport('backup')}><Download className="h-4 w-4" />Backup Database</Button></div></Card></div><div className="space-y-4"><Card><div className="flex items-center justify-between gap-3"><div><p className="text-lg font-semibold text-[var(--text-primary)]">Feature Flags</p><p className="text-sm text-[var(--text-secondary)]">Toggle globally or per restaurant.</p></div><select className="input max-w-[240px]" value={selectedFlagScope} onChange={(event) => setSelectedFlagScope(event.target.value)}><option value="global">Global</option>{(restaurants.items || []).map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}</select></div><div className="mt-4 space-y-3">{scopedFlags.length === 0 ? <EmptyState icon={Zap} title="No feature flags" description="Flags appear here when configuration is available." /> : scopedFlags.map((flag) => <label key={flag.id} className="flex items-center justify-between rounded-2xl border border-[var(--border-color)] px-4 py-3"><div><p className="font-medium capitalize text-[var(--text-primary)]">{flag.featureKey.replaceAll('_', ' ')}</p><p className="text-sm text-[var(--text-secondary)]">{flag.restaurantName}</p></div><input type="checkbox" className="h-5 w-5" checked={flag.enabled} onChange={() => runAction(`flag:${flag.id}`, async () => { await developerAPI.updateFeatureFlag({ featureKey: flag.featureKey, enabled: !flag.enabled, restaurantId: flag.restaurantId }); await loadSystem(); }, 'Feature flag updated.')} /></label>)}</div></Card><Card><p className="text-lg font-semibold text-[var(--text-primary)]">Broadcast Notifications</p><div className="mt-4 grid gap-4"><Input label="Title" value={broadcastForm.title} onChange={(event) => setBroadcastForm((current) => ({ ...current, title: event.target.value }))} placeholder="Scheduled maintenance" /><label className="space-y-2"><span className="text-sm font-medium text-[var(--text-primary)]">Message</span><textarea className="input min-h-[120px]" value={broadcastForm.message} onChange={(event) => setBroadcastForm((current) => ({ ...current, message: event.target.value }))} placeholder="Message to all restaurants" /></label><div><Button type="button" disabled={actionKey === 'broadcast'} onClick={sendBroadcast}>{actionKey === 'broadcast' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Send Broadcast</Button></div></div></Card><Card><p className="text-lg font-semibold text-[var(--text-primary)]">Error Tracking</p><div className="mt-4 space-y-3">{(errors.items || []).length === 0 ? <EmptyState icon={AlertTriangle} title="No error logs" description="API and crash errors will appear here." /> : errors.items.map((entry) => <div key={entry.id} className="rounded-2xl border border-[var(--border-color)] px-4 py-3"><div className="flex items-center justify-between gap-3"><div><p className="font-medium text-[var(--text-primary)]">{entry.message}</p>{entry.occurrences > 1 ? <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[var(--text-secondary)]">{entry.occurrences} occurrences aggregated</p> : null}</div><span className="rounded-full bg-rose-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-rose-700">{entry.level}</span></div><p className="mt-1 text-sm text-[var(--text-secondary)]">{entry.file} • {formatDate(entry.timestamp)}</p>{entry.stack ? <pre className="mt-3 overflow-x-auto rounded-xl bg-[var(--bg-card-muted)] p-3 text-xs text-[var(--text-secondary)]">{entry.stack}</pre> : null}</div>)}</div></Card></div></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {toast.message ? <Toast type={toast.type || 'success'} message={toast.message} onClose={() => setToast({ type: '', message: '' })} /> : null}
      <SectionHeader title="Audit Logs & Security" subtitle="System actions, failed logins, suspicious activity, and security alerts" actions={<Button type="button" variant="secondary" onClick={refreshView}><RefreshCw className="h-4 w-4" />Refresh</Button>} />
      <div className="grid gap-4 md:grid-cols-3"><StatCard icon={ShieldAlert} label="Security Alerts" value={metricValue(security.alerts?.length)} tone={(security.alerts?.length || 0) > 0 ? 'danger' : 'success'} /><StatCard icon={AlertTriangle} label="Failed Logins" value={metricValue(security.failedLoginAttempts?.length)} tone={(security.failedLoginAttempts?.length || 0) > 0 ? 'warning' : 'success'} /><StatCard icon={ShieldCheck} label="Suspicious Activity" value={metricValue(security.suspiciousActivity?.length)} tone={(security.suspiciousActivity?.length || 0) > 0 ? 'danger' : 'success'} /></div>
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]"><TableCard title="Audit Timeline" subtitle="Logins, order creation, deletion, approvals, and developer actions" columns={['Action', 'Actor', 'Target', 'Time']} rows={auditLogs.items || []} emptyTitle="No audit logs" emptyDescription="Audit events will appear here." renderRow={(log) => <tr key={log.id}><td className="px-5 py-4"><p className="font-semibold text-[var(--text-primary)]">{log.action}</p><p className="text-xs text-[var(--text-secondary)]">{log.source} • {log.targetType}</p></td><td className="px-5 py-4"><p className="font-medium text-[var(--text-primary)]">{log.actorEmail || 'system'}</p><p className="text-xs text-[var(--text-secondary)]">{log.actorRole || 'No data'}</p></td><td className="px-5 py-4"><p className="text-[var(--text-primary)]">{log.targetId || 'system'}</p>{Object.keys(log.metadata || {}).length > 0 ? <p className="mt-1 text-xs text-[var(--text-secondary)]">{JSON.stringify(log.metadata)}</p> : null}</td><td className="px-5 py-4 text-[var(--text-secondary)]">{formatDate(log.createdAt)}</td></tr>} /><div className="space-y-4"><Card><p className="text-lg font-semibold text-[var(--text-primary)]">Security Alerts</p><div className="mt-4 space-y-3">{(security.alerts || []).length === 0 ? <EmptyState icon={ShieldCheck} title="No active alerts" description="Security alerts will be raised here when conditions are detected." /> : security.alerts.map((alert, index) => <div key={`${alert.severity}-${index}`} className="rounded-2xl border border-[var(--border-color)] px-4 py-3"><div className="flex items-center justify-between gap-3"><p className="font-medium text-[var(--text-primary)]">{alert.message}</p><span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${alert.severity === 'critical' ? 'bg-rose-500/10 text-rose-700' : 'bg-amber-500/10 text-amber-700'}`}>{alert.severity}</span></div></div>)}</div></Card><Card><p className="text-lg font-semibold text-[var(--text-primary)]">Failed Login Attempts</p><div className="mt-4 space-y-3">{(security.failedLoginAttempts || []).length === 0 ? <p className="text-sm text-[var(--text-secondary)]">No failed logins detected.</p> : security.failedLoginAttempts.map((entry) => <div key={entry.id} className="rounded-2xl bg-[var(--bg-card-muted)] p-4"><p className="text-sm font-medium text-[var(--text-primary)]">{entry.message}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{entry.file} • {formatDate(entry.timestamp)}</p></div>)}</div></Card><Card><p className="text-lg font-semibold text-[var(--text-primary)]">Suspicious Activity</p><div className="mt-4 space-y-3">{(security.suspiciousActivity || []).length === 0 ? <p className="text-sm text-[var(--text-secondary)]">No suspicious activity alerts.</p> : security.suspiciousActivity.map((entry) => <div key={entry.id} className="rounded-2xl bg-[var(--bg-card-muted)] p-4"><p className="text-sm font-medium text-[var(--text-primary)]">{entry.message}</p><p className="mt-1 text-xs text-[var(--text-secondary)]">{entry.file} • {formatDate(entry.timestamp)}</p></div>)}</div></Card></div></div>
    </div>
  );
}
