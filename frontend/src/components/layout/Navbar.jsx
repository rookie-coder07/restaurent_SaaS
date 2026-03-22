import { Bell, ChevronDown, Menu, MoonStar, SunMedium, Palette, LogOut } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import Button from '../common/Button';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);

  const quickToggleTheme = () => {
    setTheme(theme === 'dark' ? 'default' : 'dark');
  };

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--color-border)] bg-[var(--color-surface)]/90 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Operations</p>
            <p className="truncate text-sm font-medium text-[var(--color-text-muted)]">
              Manage tables, menu, kitchen, staff, and analytics in one workspace.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={quickToggleTheme}
            className="inline-flex rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)]"
            title="Toggle dark mode"
          >
            {theme === 'dark' ? <SunMedium className="h-5 w-5" /> : <MoonStar className="h-5 w-5" />}
          </button>

          <button
            type="button"
            className="hidden rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-2.5 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)] sm:inline-flex"
          >
            <Bell className="h-5 w-5" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setOpen((current) => !current)}
              className="inline-flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-3 py-2 transition hover:bg-[var(--color-surface-muted)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-sm font-bold text-white">
                {user?.name?.[0]?.toUpperCase() || 'R'}
              </div>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-semibold text-[var(--color-text)]">{user?.name || 'Restaurant Admin'}</p>
                <p className="text-xs text-[var(--color-text-muted)]">{user?.email || 'owner@restaurant.com'}</p>
              </div>
              <ChevronDown className="hidden h-4 w-4 text-[var(--color-text-muted)] sm:block" />
            </button>

            {open ? (
              <div className="absolute right-0 mt-3 w-64 rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-floating)]">
                <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <p className="text-sm font-semibold text-[var(--color-text)]">{user?.name || 'Restaurant Admin'}</p>
                  <p className="mt-1 text-xs text-[var(--color-text-muted)]">{user?.email || 'owner@restaurant.com'}</p>
                </div>

                <div className="mt-3 space-y-1">
                  <Link
                    to="/settings"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                  >
                    <Palette className="h-4 w-4" />
                    Settings
                  </Link>

                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium text-red-600 transition hover:bg-red-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
