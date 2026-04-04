import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-300">
      <div className="flex min-h-screen">
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          setIsOpen={setSidebarOpen}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-x-hidden overflow-y-auto">
            <div className="w-full max-w-full px-4 py-4 sm:px-6 sm:py-6">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
