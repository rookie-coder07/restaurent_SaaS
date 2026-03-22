import { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/shared/ErrorBoundary';
import ProtectedRoute from './components/shared/ProtectedRoute';
import { useAuthStore } from './context/authStore';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import MenuManagement from './pages/MenuManagement';
import Orders from './pages/Orders';
import Kitchen from './pages/Kitchen';
import Analytics from './pages/Analytics';
import CustomerMenu from './pages/CustomerMenu';
import OrderStatus from './pages/OrderStatus';
import Tables from './pages/Tables';
import Staff from './pages/Staff';
import QRTest from './pages/QRTest';
import NotFound from './pages/NotFound';
import Settings from './pages/Settings';

function App() {
  const { isAuthenticated, hydrate } = useAuthStore();

  // Hydrate auth state on mount
  if (!isAuthenticated) {
    hydrate();
  }

  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/menu" element={<CustomerMenu />} />
          <Route path="/order-status" element={<OrderStatus />} />

          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/menu-management" element={<MenuManagement />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/kitchen" element={<Kitchen />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/tables" element={<Tables />} />
            <Route path="/staff" element={<Staff />} />
            <Route path="/qr-test" element={<QRTest />} />
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}

export default App;
