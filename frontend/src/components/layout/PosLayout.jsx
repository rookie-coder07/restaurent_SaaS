import { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const PAGE_META = {
  '/pos': {
    section: 'POS',
    title: 'Billing & Floor Operations',
  },
  '/pos/orders': {
    section: 'POS Orders',
    title: 'Unified Online Orders',
  },
  '/pos/tables': {
    section: 'POS Tables',
    title: 'Live Floor View',
  },
};

export default function PosLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  const pageMeta = useMemo(
    () =>
      PAGE_META[location.pathname] || {
        section: 'POS',
        title: 'Billing & Floor Operations',
      },
    [location.pathname]
  );

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)]">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex h-screen min-h-0 flex-col lg:pl-72">
        <Navbar
          sectionLabel={pageMeta.section}
          pageTitle={pageMeta.title}
          onMenuClick={() => setSidebarOpen(true)}
          portal="pos"
        />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-4 p-4 sm:p-6 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
