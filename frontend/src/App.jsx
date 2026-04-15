import { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/shared/ErrorBoundary';
import ProtectedRoute from './components/shared/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import PosLayout from './components/layout/PosLayout';
import KOTLayout from './components/layout/KOTLayout';
import { initializeAudioContext, setupAudioUnlock } from './utils/alerts';

// Pages
const HomeAccess = lazyWithPreload(() => import('./pages/HomeAccess'));
const Login = lazyWithPreload(() => import('./pages/Login'));
const PosLogin = lazyWithPreload(() => import('./pages/pos/PosLogin'));
const ResetPassword = lazyWithPreload(() => import('./pages/ResetPassword'));
const Register = lazyWithPreload(() => import('./pages/Register'));
const Dashboard = lazyWithPreload(() => import('./pages/Dashboard'));
const Notifications = lazyWithPreload(() => import('./pages/Notifications'));
const MenuManagement = lazyWithPreload(() => import('./pages/MenuManagement'));
const Orders = lazyWithPreload(() => import('./pages/Orders'));
const Analytics = lazyWithPreload(() => import('./pages/Analytics'));
const Loyalty = lazyWithPreload(() => import('./pages/Loyalty'));
const POS = lazyWithPreload(() => import('./pages/POS'));
const POSOrders = lazyWithPreload(() => import('./pages/POSOrders'));
const CustomerMenu = lazyWithPreload(() => import('./pages/CustomerMenu'));
const QRLanding = lazyWithPreload(() => import('./pages/QRLanding'));
const OrderStatus = lazyWithPreload(() => import('./pages/OrderStatus'));
const Tables = lazyWithPreload(() => import('./pages/Tables'));
const Staff = lazyWithPreload(() => import('./pages/Staff'));
const NotFound = lazyWithPreload(() => import('./pages/NotFound'));
const Settings = lazyWithPreload(() => import('./pages/Settings'));
const Inventory = lazyWithPreload(() => import('./pages/Inventory'));
const Kitchen = lazyWithPreload(() => import('./pages/Kitchen'));
const BillView = lazyWithPreload(() => import('./pages/BillView'));
const KitchenTicket = lazyWithPreload(() => import('./pages/KitchenTicket'));
const ManagerDashboard = lazyWithPreload(() => import('./pages/ManagerDashboard'));
const ManagerOrders = lazyWithPreload(() => import('./pages/ManagerOrders'));
const ManagerTables = lazyWithPreload(() => import('./pages/ManagerTables'));
const ManagerKitchen = lazyWithPreload(() => import('./pages/ManagerKitchen'));
const ManagerWaiters = lazyWithPreload(() => import('./pages/ManagerWaiters'));
const ManagerInventory = lazyWithPreload(() => import('./pages/ManagerInventory'));
const ManagerBills = lazyWithPreload(() => import('./pages/ManagerBills'));
const DeveloperConsole = lazyWithPreload(() => import('./pages/DeveloperConsole'));
const ChangePassword = lazyWithPreload(() => import('./pages/ChangePassword'));
const UserPasswordManagement = lazyWithPreload(() => import('./pages/UserPasswordManagement'));
const StaffActivity = lazyWithPreload(() => import('./pages/StaffActivity'));
const Terms = lazyWithPreload(() => import('./pages/Terms'));
const Privacy = lazyWithPreload(() => import('./pages/Privacy'));
const CreateRestaurant = lazyWithPreload(() => import('./pages/developer/CreateRestaurant'));
const ResetUserPassword = lazyWithPreload(() => import('./pages/developer/ResetUserPassword'));
import { useAuthStore } from './context/authStore';
import { useManagerStore } from './context/managerStore';
import { usePosStore } from './context/posStore';
import { readPortalSession } from './utils/authStorage';
import { canAccessPortal, resolvePortalHome } from './utils/portalRouting';
import { AuthSessionRedirectListener } from './components/shared/AuthSessionRedirectListener';
import ToastViewport from './components/common/ToastViewport';
import { restaurantAPI } from './services/apiEndpoints';

function lazyWithPreload(factory) {
  const Component = lazy(factory);
  Component.preload = factory;
  return Component;
}

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
  const activePortal = useAuthStore((state) => state.activePortal);
  const setManagerRestaurantContext = useManagerStore((state) => state.setRestaurantContext);
  const clearManagerTenantState = useManagerStore((state) => state.clearTenantState);

  useEffect(() => {
    initializeAuth(window.location.pathname);
    
    // Initialize audio system for buzzer notifications
    initializeAudioContext();
    setupAudioUnlock();
  }, [initializeAuth]);

  useEffect(() => {
    if (restaurantId) {
      setManagerRestaurantContext(restaurantId);
      return;
    }

    clearManagerTenantState();
  }, [clearManagerTenantState, restaurantId, setManagerRestaurantContext]);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const preloadTasks = [];

    if (activePortal === 'pos') {
      preloadTasks.push(POS.preload?.(), POSOrders.preload?.(), Tables.preload?.(), KitchenTicket.preload?.());
      usePosStore.getState().preloadCoreData().catch(() => {});
      usePosStore.getState().refreshTableOverview({ silent: true }).catch(() => {});
    }

    if (activePortal === 'admin') {
      preloadTasks.push(
        Dashboard.preload?.(),
        Orders.preload?.(),
        Tables.preload?.(),
        MenuManagement.preload?.(),
        Settings.preload?.()
      );
    }

    if (window.location.pathname.startsWith('/manager')) {
      preloadTasks.push(
        ManagerDashboard.preload?.(),
        ManagerTables.preload?.(),
        ManagerOrders.preload?.(),
        ManagerBills.preload?.(),
        ManagerWaiters.preload?.()
      );
    }

    if (restaurantId) {
      restaurantAPI.getProfile().catch(() => {});
    }

    Promise.allSettled(preloadTasks.filter(Boolean));
  }, [activePortal, isHydrated, restaurantId]);

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
          <Route path="/manager/login" element={withSuspense(<Login portal="admin" initialModeKey="manager" />)} />
          <Route path="/developer/login" element={withSuspense(<Login portal="admin" initialModeKey="developer" />)} />
          <Route path="/reset-password" element={withSuspense(<ResetPassword />)} />
          <Route path="/admin/reset-password" element={withSuspense(<ResetPassword />)} />
          <Route path="/manager/reset-password" element={withSuspense(<ResetPassword />)} />
          <Route path="/developer/reset-password" element={withSuspense(<ResetPassword />)} />
          <Route path="/pos/login" element={withSuspense(<PosLogin />)} />
          <Route path="/staff/login" element={withSuspense(<PosLogin />)} />
          <Route path="/pos/reset-password" element={withSuspense(<ResetPassword />)} />
          <Route path="/register" element={withSuspense(<Register />)} />
          <Route path="/qr-landing" element={withSuspense(<QRLanding />)} />
          <Route path="/menu" element={withSuspense(<CustomerMenu />)} />
          <Route path="/order-status" element={withSuspense(<OrderStatus />)} />
          <Route path="/terms" element={withSuspense(<Terms />)} />
          <Route path="/privacy" element={withSuspense(<Privacy />)} />

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
            <Route path="/developer/create-restaurant" element={withSuspense(<CreateRestaurant />)} />
            <Route path="/developer/reset-user-password" element={withSuspense(<ResetUserPassword />)} />
            <Route path="/developer/restaurants" element={withSuspense(<DeveloperConsole view="restaurants" />)} />
            <Route path="/dev/create-restaurant" element={<Navigate to="/developer/create-restaurant" replace />} />
            <Route path="/developer/users" element={withSuspense(<DeveloperConsole view="users" />)} />
            <Route path="/developer/system" element={withSuspense(<DeveloperConsole view="system" />)} />
            <Route path="/developer/audit" element={withSuspense(<DeveloperConsole view="audit" />)} />
            <Route path="/developer/change-password" element={withSuspense(<ChangePassword />)} />
          </Route>

          <Route element={<ProtectedRoute layout={PosLayout} allowedRoles={['staff']} portal="pos" />}>
            <Route path="/pos" element={<Navigate to="/pos/tables" replace />} />
            <Route path="/pos/billing" element={withSuspense(<POS />)} />
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
