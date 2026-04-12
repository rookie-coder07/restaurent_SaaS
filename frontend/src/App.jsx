import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/shared/ErrorBoundary';
import ProtectedRoute from './components/shared/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import PosLayout from './components/layout/PosLayout';
import KOTLayout from './components/layout/KOTLayout';

// Pages
const HomeAccess = lazy(() => import('./pages/HomeAccess'));
const Login = lazy(() => import('./pages/Login'));
const PosLogin = lazy(() => import('./pages/pos/PosLogin'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const StaffPasswordResetOTP = lazy(() => import('./pages/StaffPasswordResetOTP'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Notifications = lazy(() => import('./pages/Notifications'));
const MenuManagement = lazy(() => import('./pages/MenuManagement'));
const Orders = lazy(() => import('./pages/Orders'));
const Analytics = lazy(() => import('./pages/Analytics'));
const Loyalty = lazy(() => import('./pages/Loyalty'));
const POS = lazy(() => import('./pages/POS'));
const POSOrders = lazy(() => import('./pages/POSOrders'));
const CustomerMenu = lazy(() => import('./pages/CustomerMenu'));
const OrderStatus = lazy(() => import('./pages/OrderStatus'));
const Tables = lazy(() => import('./pages/Tables'));
const Staff = lazy(() => import('./pages/Staff'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Settings = lazy(() => import('./pages/Settings'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Kitchen = lazy(() => import('./pages/Kitchen'));
const BillView = lazy(() => import('./pages/BillView'));
const KitchenTicket = lazy(() => import('./pages/KitchenTicket'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const ManagerOrders = lazy(() => import('./pages/ManagerOrders'));
const ManagerTables = lazy(() => import('./pages/ManagerTables'));
const ManagerKitchen = lazy(() => import('./pages/ManagerKitchen'));
const ManagerWaiters = lazy(() => import('./pages/ManagerWaiters'));
const ManagerInventory = lazy(() => import('./pages/ManagerInventory'));
const ManagerBills = lazy(() => import('./pages/ManagerBills'));
const DeveloperConsole = lazy(() => import('./pages/DeveloperConsole'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const UserPasswordManagement = lazy(() => import('./pages/UserPasswordManagement'));
const StaffActivity = lazy(() => import('./pages/StaffActivity'));
import { useAuthStore } from './context/authStore';
import { useManagerStore } from './context/managerStore';
import { readPortalSession } from './utils/authStorage';
import { canAccessPortal, resolvePortalHome } from './utils/portalRouting';
import { AuthSessionRedirectListener } from './components/shared/AuthSessionRedirectListener';
import ToastViewport from './components/common/ToastViewport';

function RouteLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] px-4 text-[var(--text-primary)]">
      <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-4 text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-card)]">
        Loading page...
      </div>
    </div>
  );
}

function withSuspense(element) {
  return <Suspense fallback={<RouteLoader />}>{element}</Suspense>;
}

function TablesEntryRedirect() {
  const activePortal = useAuthStore((state) => state.activePortal);
  const adminUser = readPortalSession('admin')?.user;
  const posUser = readPortalSession('pos')?.user;

  if (activePortal === 'pos' && canAccessPortal(posUser?.role, 'pos')) {
    return <Navigate to="/pos/tables" replace />;
  }

  if (activePortal === 'admin' && canAccessPortal(adminUser?.role, 'admin')) {
    return <Navigate to={adminUser?.role === 'manager' ? '/manager/tables' : '/admin/tables'} replace />;
  }

  if (canAccessPortal(adminUser?.role, 'admin')) {
    return <Navigate to={adminUser?.role === 'manager' ? '/manager/tables' : '/admin/tables'} replace />;
  }

  if (canAccessPortal(posUser?.role, 'pos')) {
    return <Navigate to="/pos/tables" replace />;
  }

  return <Navigate to="/admin/tables" replace />;
}

function App() {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const isHydrated = useAuthStore((state) => state.isHydrated);
  const restaurantId = useAuthStore((state) => state.restaurantId);
  const setManagerRestaurantContext = useManagerStore((state) => state.setRestaurantContext);
  const clearManagerTenantState = useManagerStore((state) => state.clearTenantState);

  useEffect(() => {
    initializeAuth(window.location.pathname);
  }, [initializeAuth]);

  useEffect(() => {
    if (restaurantId) {
      setManagerRestaurantContext(restaurantId);
      return;
    }

    clearManagerTenantState();
  }, [clearManagerTenantState, restaurantId, setManagerRestaurantContext]);

  if (!isHydrated) {
    return null;
  }

  return (
    <ErrorBoundary>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <AuthSessionRedirectListener />
        <ToastViewport />
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={withSuspense(<HomeAccess />)} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/admin/login" element={withSuspense(<Login portal="admin" />)} />
          <Route path="/admin/reset-password" element={withSuspense(<ResetPassword />)} />
          <Route path="/manager/login" element={withSuspense(<Login portal="admin" initialModeKey="manager" />)} />
          <Route path="/developer/login" element={withSuspense(<Login portal="admin" initialModeKey="developer" />)} />
          <Route path="/pos/login" element={withSuspense(<PosLogin />)} />
          <Route path="/staff/login" element={withSuspense(<PosLogin />)} />
          <Route path="/register" element={withSuspense(<Register />)} />
          <Route path="/menu" element={withSuspense(<CustomerMenu />)} />
          <Route path="/order-status" element={withSuspense(<OrderStatus />)} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute layout={AdminLayout} allowedRoles={['owner']} portal="admin" />}>
            <Route path="/admin" element={withSuspense(<Dashboard />)} />
            <Route path="/admin/notifications" element={withSuspense(<Notifications />)} />
            <Route path="/admin/menu" element={withSuspense(<MenuManagement />)} />
            <Route path="/admin/orders" element={withSuspense(<Orders />)} />
            <Route path="/admin/inventory" element={withSuspense(<Inventory />)} />
            <Route path="/admin/staff" element={withSuspense(<Staff />)} />
            <Route path="/admin/loyalty" element={withSuspense(<Loyalty />)} />
            <Route path="/admin/analytics" element={withSuspense(<Analytics />)} />
            <Route path="/admin/staff-activity" element={withSuspense(<StaffActivity />)} />
            <Route path="/admin/tables" element={withSuspense(<Tables />)} />
            <Route path="/admin/settings" element={withSuspense(<Settings />)} />
            <Route path="/admin/change-password" element={withSuspense(<ChangePassword />)} />
            <Route path="/admin/manage-user-passwords" element={withSuspense(<UserPasswordManagement />)} />
          </Route>

          <Route element={<ProtectedRoute layout={AdminLayout} allowedRoles={['manager']} portal="admin" />}>
            <Route path="/manager" element={withSuspense(<ManagerDashboard />)} />
            <Route path="/manager/orders" element={withSuspense(<Orders />)} />
            <Route path="/manager/takeaway-orders" element={withSuspense(<ManagerOrders />)} />
            <Route path="/manager/tables" element={withSuspense(<ManagerTables />)} />
            <Route path="/manager/kitchen" element={withSuspense(<ManagerKitchen />)} />
            <Route path="/manager/waiters" element={withSuspense(<ManagerWaiters />)} />
            <Route path="/manager/inventory" element={withSuspense(<ManagerInventory />)} />
            <Route path="/manager/bills" element={withSuspense(<ManagerBills />)} />
            <Route path="/manager/bills/:orderId" element={withSuspense(<BillView />)} />
            <Route path="/manager/staff-activity" element={withSuspense(<StaffActivity />)} />
            <Route path="/manager/settings" element={withSuspense(<Settings />)} />
            <Route path="/manager/change-password" element={withSuspense(<ChangePassword />)} />
            <Route path="/manager/manage-user-passwords" element={withSuspense(<UserPasswordManagement />)} />
          </Route>

          <Route element={<ProtectedRoute layout={AdminLayout} allowedRoles={['developer']} portal="admin" />}>
            <Route path="/developer" element={withSuspense(<DeveloperConsole view="overview" />)} />
            <Route path="/developer/restaurants" element={withSuspense(<DeveloperConsole view="restaurants" />)} />
            <Route path="/developer/users" element={withSuspense(<DeveloperConsole view="users" />)} />
            <Route path="/developer/system" element={withSuspense(<DeveloperConsole view="system" />)} />
            <Route path="/developer/audit" element={withSuspense(<DeveloperConsole view="audit" />)} />
            <Route path="/developer/change-password" element={withSuspense(<ChangePassword />)} />
          </Route>

          <Route element={<ProtectedRoute layout={PosLayout} allowedRoles={['staff']} portal="pos" />}>
            <Route path="/pos" element={withSuspense(<POS />)} />
            <Route path="/pos/billing" element={<Navigate to="/pos" replace />} />
            <Route path="/pos/orders" element={withSuspense(<POSOrders />)} />
            <Route path="/pos/tables" element={withSuspense(<Tables />)} />
            <Route path="/pos/settings" element={withSuspense(<Settings />)} />
            <Route path="/pos/change-password" element={withSuspense(<ChangePassword />)} />
            <Route path="/pos/kot/:orderId" element={withSuspense(<KitchenTicket />)} />
          </Route>

          <Route element={<ProtectedRoute layout={KOTLayout} allowedRoles={['kitchen_staff']} portal="kot" />}>
            <Route path="/kot" element={withSuspense(<Kitchen />)} />
          </Route>

          {/* Legacy Redirects */}
          <Route path="/menu-management" element={<Navigate to="/admin/menu" replace />} />
          <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
          <Route path="/analytics" element={<Navigate to="/admin/analytics" replace />} />
          <Route path="/staff" element={<Navigate to="/staff/login" replace />} />
          <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/tables" element={<TablesEntryRedirect />} />
          <Route path="/kitchen" element={<Navigate to="/kot" replace />} />
          <Route path="/manager/*" element={<Navigate to={resolvePortalHome('admin', readPortalSession('admin')?.user?.role)} replace />} />

          {/* 404 */}
          <Route path="*" element={withSuspense(<NotFound />)} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
