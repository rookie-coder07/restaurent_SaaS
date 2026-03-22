import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  ChefHat,
  MenuSquare,
  ShoppingCart,
  Sparkles,
  Users,
  TableProperties,
  QrCode,
  Palette,
  UtensilsCrossed,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import Button from '../common/Button';

const menuItems = [
  { icon: BarChart3, label: 'Dashboard', href: '/', roles: ['owner', 'manager'] },
  { icon: MenuSquare, label: 'Menu', href: '/menu-management', roles: ['owner', 'manager'] },
  { icon: ShoppingCart, label: 'Orders', href: '/orders', roles: ['owner', 'manager'] },
  { icon: ChefHat, label: 'Kitchen', href: '/kitchen', roles: ['kitchen_staff', 'manager', 'owner'] },
  { icon: TableProperties, label: 'Tables', href: '/tables', roles: ['owner', 'manager'] },
  { icon: Users, label: 'Staff', href: '/staff', roles: ['owner', 'manager'] },
  { icon: Sparkles, label: 'Analytics', href: '/analytics', roles: ['owner', 'manager'] },
  { icon: QrCode, label: 'QR Lab', href: '/qr-test', roles: ['owner', 'manager'] },
  { icon: Palette, label: 'Settings', href: '/settings', roles: ['owner', 'manager', 'kitchen_staff'] },
];

export default function Sidebar({ isOpen, isCollapsed, setIsOpen, onToggleCollapse }) {
  const location = useLocation();
  const { user } = useAuth();

  const filteredMenuItems = menuItems.filter((item) => item.roles.includes(user?.role || 'owner'));

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur transition-all duration-300 lg:relative lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isCollapsed ? 'w-[92px]' : 'w-[280px]'}`}
      >
        <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white shadow-[0_16px_30px_rgba(37,99,235,0.22)]">
              <UtensilsCrossed className="h-5 w-5" />
            </div>
            {!isCollapsed ? (
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-[var(--color-text)]">Restro SaaS</p>
                <p className="truncate text-xs text-[var(--color-text-muted)]">Restaurant operations</p>
              </div>
            ) : null}
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-2xl p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)] lg:inline-flex"
            >
              {isCollapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-2xl p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-surface-muted)] lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-4 py-5">
          {!isCollapsed ? (
            <div className="rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface-muted)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Workspace</p>
              <p className="mt-2 text-sm font-semibold text-[var(--color-text)]">{user?.restaurantName || 'Main branch'}</p>
              <p className="mt-1 text-xs text-[var(--color-text-muted)]">Role: {user?.role || 'owner'}</p>
            </div>
          ) : null}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-5">
          {filteredMenuItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                  isActive
                    ? 'bg-[var(--color-primary-soft)] text-[var(--color-primary)]'
                    : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]'
                } ${isCollapsed ? 'justify-center' : ''}`}
              >
                <Icon className="h-5 w-5 flex-shrink-0" />
                {!isCollapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--color-border)] p-4">
          {!isCollapsed ? (
            <div className="rounded-[1.5rem] bg-[var(--color-primary)] p-4 text-white shadow-[0_18px_45px_rgba(37,99,235,0.2)]">
              <p className="text-sm font-semibold">Need a fresh look?</p>
              <p className="mt-1 text-xs text-white/80">Switch dashboard theme from settings.</p>
              <Link to="/settings" onClick={() => setIsOpen(false)}>
                <Button variant="secondary" size="sm" className="mt-4 w-full !border-white/20 !bg-white/15 !text-white hover:!bg-white/20">
                  Open Settings
                </Button>
              </Link>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}
