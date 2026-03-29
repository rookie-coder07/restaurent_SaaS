import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/shared/ErrorBoundary';
import ProtectedRoute from './components/shared/ProtectedRoute';
import AdminLayout from './components/layout/AdminLayout';
import PosLayout from './components/layout/PosLayout';
import KOTLayout from './components/layout/KOTLayout';

// Pages
import HomeAccess from './pages/HomeAccess';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import Orders from './pages/Orders';
import KOT from './pages/KOT';
import Analytics from './pages/Analytics';
import POS from './pages/POS';
import CustomerMenu from './pages/CustomerMenu';
import OrderStatus from './pages/OrderStatus';
import Tables from './pages/Tables';
import Staff from './pages/Staff';
import QRTest from './pages/QRTest';
import NotFound from './pages/NotFound';
import Settings from './pages/Settings';
import StaffAccess from './pages/StaffAccess';
import { useAuthStore } from './context/authStore';
import { readPortalSession } from './utils/authStorage';
import { canAccessPortal } from './utils/portalRouting';

function TablesEntryRedirect() {
  const activePortal = useAuthStore((state) => state.activePortal);
  const adminUser = readPortalSession('admin')?.user;
  const posUser = readPortalSession('pos')?.user;

  if (activePortal === 'pos' && canAccessPortal(posUser?.role, 'pos')) {
    return <Navigate to="/pos/tables" replace />;
  }

  if (activePortal === 'admin' && canAccessPortal(adminUser?.role, 'admin')) {
    return <Navigate to="/admin/tables" replace />;
  }

  if (canAccessPortal(adminUser?.role, 'admin')) {
    return <Navigate to="/admin/tables" replace />;
  }

  if (canAccessPortal(posUser?.role, 'pos')) {
    return <Navigate to="/pos/tables" replace />;
  }

  return <Navigate to="/admin/tables" replace />;
}

function App() {

  return (
    <ErrorBoundary>
      <Router
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<HomeAccess />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/staff/login" element={<StaffAccess />} />
          <Route path="/admin/login" element={<Login portal="admin" />} />
          <Route path="/pos/login" element={<Login portal="pos" />} />
          <Route path="/kot/login" element={<Login portal="kot" />} />
          <Route path="/register" element={<Register />} />
          <Route path="/menu" element={<CustomerMenu />} />
          <Route path="/order-status" element={<OrderStatus />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute layout={AdminLayout} allowedRoles={['owner']} portal="admin" />}>
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/menu" element={<MenuManagement />} />
            <Route path="/admin/orders" element={<Orders />} />
            <Route path="/admin/staff" element={<Staff />} />
            <Route path="/admin/analytics" element={<Analytics />} />
            <Route path="/admin/tables" element={<Tables />} />
            <Route path="/admin/qr-tools" element={<QRTest />} />
            <Route path="/admin/settings" element={<Settings />} />
          </Route>

          <Route element={<ProtectedRoute layout={PosLayout} allowedRoles={['staff']} portal="pos" />}>
            <Route path="/pos" element={<POS />} />
            <Route path="/pos/tables" element={<Tables />} />
          </Route>

          <Route element={<ProtectedRoute layout={KOTLayout} allowedRoles={['kitchen_staff']} portal="kot" />}>
            <Route path="/kot" element={<KOT />} />
          </Route>

          {/* Legacy Redirects */}
          <Route path="/menu-management" element={<Navigate to="/admin/menu" replace />} />
          <Route path="/orders" element={<Navigate to="/admin/orders" replace />} />
          <Route path="/analytics" element={<Navigate to="/admin/analytics" replace />} />
          <Route path="/staff" element={<Navigate to="/admin/staff" replace />} />
          <Route path="/qr-test" element={<Navigate to="/admin/qr-tools" replace />} />
          <Route path="/settings" element={<Navigate to="/admin/settings" replace />} />
          <Route path="/tables" element={<TablesEntryRedirect />} />
          <Route path="/kitchen" element={<Navigate to="/kot" replace />} />

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
