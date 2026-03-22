import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const PAGE_META = {
  '/': {
    section: 'Dashboard',
    title: 'Restaurant Overview',
  },
  '/menu-management': {
    section: 'Menu',
    title: 'Menu Management',
  },
  '/orders': {
    section: 'Orders',
    title: 'Order Management',
  },
  '/kitchen': {
    section: 'Kitchen',
    title: 'Kitchen Dashboard',
  },
  '/tables': {
    section: 'Tables',
    title: 'Table Management',
  },
  '/staff': {
    section: 'Staff',
    title: 'Staff Management',
  },
  '/analytics': {
    section: 'Analytics',
    title: 'Revenue Analytics',
  },
  '/qr-test': {
    section: 'QR',
    title: 'QR Testing',
  },
  '/settings': {
    section: 'Settings',
    title: 'Workspace Settings',
  },
};

export default function MainLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const pageMeta = useMemo(
    () =>
      PAGE_META[location.pathname] || {
        section: 'Workspace',
        title: 'Restaurant SaaS',
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
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
