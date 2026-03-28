import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const PAGE_META = {
  '/admin': {
    section: 'Admin',
    title: 'Restaurant Overview',
  },
  '/admin/menu': {
    section: 'Menu',
    title: 'Menu Management',
  },
  '/admin/orders': {
    section: 'Orders',
    title: 'Order Management',
  },
  '/admin/staff': {
    section: 'Staff Access',
    title: 'POS & KOT Staff Access',
  },
  '/admin/analytics': {
    section: 'Analytics',
    title: 'Revenue Analytics',
  },
  '/admin/settings': {
    section: 'Settings',
    title: 'Workspace Settings',
  },
  '/admin/qr-tools': {
    section: 'QR Tools',
    title: 'QR Tools',
  },
};

export default function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const pageMeta = useMemo(
    () =>
      PAGE_META[location.pathname] || {
        section: 'Admin',
        title: 'Restaurant Control Center',
      },
    [location.pathname]
  );

  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="min-h-screen lg:pl-72">
        <Navbar
          sectionLabel={pageMeta.section}
          pageTitle={pageMeta.title}
          onMenuClick={() => setSidebarOpen(true)}
        />

        <main className="overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 sm:py-6 lg:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
