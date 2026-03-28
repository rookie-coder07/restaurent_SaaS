import { Menu } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import ThemeToggle from '../common/ThemeToggle';
import PortalLogoutButton from '../common/PortalLogoutButton';

export default function Navbar({ sectionLabel, pageTitle, onMenuClick }) {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-30 mb-4 border-b border-[var(--border-color)] bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] shadow-[var(--shadow-card)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-8 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-3 py-2 text-[var(--text-secondary)] transition hover:scale-[1.02] hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--text-secondary)]">{sectionLabel}</p>
            <h1 className="break-words text-lg font-bold text-[var(--text-primary)] md:text-2xl">{pageTitle}</h1>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Welcome back{user?.name ? `, ${user.name}` : ''}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-xs font-medium text-cyan-300 sm:inline-flex">
            Live workspace
          </div>

          <PortalLogoutButton portal="admin" />

          <ThemeToggle className="px-3 py-2 text-sm md:text-base" />

          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-sm font-semibold text-white shadow-lg md:h-10 md:w-10">
            {user?.name?.[0]?.toUpperCase() || 'R'}
          </div>
        </div>
      </div>
    </header>
  );
}
