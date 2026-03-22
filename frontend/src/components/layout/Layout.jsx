import { useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-[var(--color-bg)] text-[var(--color-text)] transition-colors duration-300">
      <div className="flex min-h-screen">
        <Sidebar
          isOpen={sidebarOpen}
          isCollapsed={sidebarCollapsed}
          setIsOpen={setSidebarOpen}
          onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <Navbar onMenuClick={() => setSidebarOpen(true)} />
          <main className="flex-1 overflow-auto">
            <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
