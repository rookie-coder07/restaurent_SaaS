import { Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ThemeToggle from '../common/ThemeToggle';

export default function Navbar({ sectionLabel, pageTitle, onMenuClick }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex rounded-xl border border-gray-200 p-2 text-[#64748b] transition hover:bg-gray-50 lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#64748b]">{sectionLabel}</p>
            <h1 className="truncate text-2xl font-semibold text-[#0f172a]">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle className="border-gray-200 bg-white text-[#64748b] hover:bg-gray-50 hover:text-[#0f172a]" />

          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#2563eb] text-sm font-semibold text-white">
            {user?.name?.[0]?.toUpperCase() || 'R'}
          </div>
        </div>
      </div>
    </header>
  );
}
