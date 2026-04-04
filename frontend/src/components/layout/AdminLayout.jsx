import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../context/authStore';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const PAGE_META = {
  '/admin': {
    section: 'Admin',
    title: 'Restaurant Overview',
  },
  '/admin/notifications': {
    section: 'Notifications',
    title: 'Owner Notification Center',
  },
  '/admin/menu': {
    section: 'Menu',
    title: 'Menu Management',
  },
  '/admin/orders': {
    section: 'Orders',
    title: 'Order Management',
  },
  '/admin/inventory': {
    section: 'Inventory',
    title: 'Kitchen Stock Control',
  },
  '/admin/staff': {
    section: 'Staff Access',
    title: 'POS & KOT Staff Access',
  },
  '/admin/analytics': {
    section: 'Analytics',
    title: 'Revenue Analytics',
  },
  '/admin/tables': {
    section: 'Tables',
    title: 'Live Floor View',
  },
  '/admin/settings': {
    section: 'Settings',
    title: 'Workspace Settings',
  },
  '/admin/qr-tools': {
    section: 'QR Tools',
    title: 'QR Tools',
  },
  '/manager': {
    section: 'Manager',
    title: 'Operations Dashboard',
  },
  '/manager/orders': {
    section: 'Orders',
    title: 'Order Operations',
  },
  '/manager/tables': {
    section: 'Tables',
    title: 'Floor Control',
  },
  '/manager/kitchen': {
    section: 'Kitchen',
    title: 'KOT Operations',
  },
  '/manager/waiters': {
    section: 'Waiters',
    title: 'Waiter Control',
  },
  '/manager/inventory': {
    section: 'Inventory',
    title: 'Stock Visibility',
  },
  '/manager/bills': {
    section: 'Bills',
    title: 'Billing Control',
  },
};

export default function AdminLayout({ children }) {
  return <AdminLayoutInner>{children}</AdminLayoutInner>;
}

export function AdminLayoutInner({ children, portal = 'admin' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const userRole = useAuthStore((state) => state.user?.role);

  const pageMeta = useMemo(
    () =>
      PAGE_META[location.pathname] || {
        section: portal === 'kot' ? 'Kitchen' : userRole === 'manager' ? 'Manager' : 'Admin',
        title:
          portal === 'kot'
            ? 'Kitchen Operations'
            : userRole === 'manager'
              ? 'Restaurant Operations Center'
              : 'Restaurant Control Center',
      },
    [location.pathname, portal, userRole]
  );

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex h-screen min-h-0 flex-col lg:pl-72">
        <Navbar
          sectionLabel={pageMeta.section}
          pageTitle={pageMeta.title}
          onMenuClick={() => setSidebarOpen(true)}
          portal={portal}
        />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:p-6 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
