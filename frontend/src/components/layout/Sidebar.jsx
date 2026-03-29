import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  ClipboardList,
  MenuSquare,
  Sparkles,
  Users,
  QrCode,
  TableProperties,
  Palette,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const adminMenuItems = [
  { icon: BarChart3, label: 'Dashboard', href: '/admin', roles: ['owner'] },
  { icon: MenuSquare, label: 'Menu', href: '/admin/menu', roles: ['owner'] },
  { icon: ClipboardList, label: 'Orders', href: '/admin/orders', roles: ['owner'] },
  { icon: TableProperties, label: 'Tables', href: '/admin/tables', roles: ['owner'] },
  { icon: Users, label: 'Staff Access', href: '/admin/staff', roles: ['owner'] },
  { icon: Sparkles, label: 'Analytics', href: '/admin/analytics', roles: ['owner'] },
  { icon: QrCode, label: 'QR Tools', href: '/admin/qr-tools', roles: ['owner'] },
  { icon: Palette, label: 'Settings', href: '/admin/settings', roles: ['owner'] },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user } = useAuth();

  const activeRole = user?.role || 'owner';
  const filteredMenuItems = adminMenuItems.filter((item) => item.roles.includes(activeRole));
  const isActivePath = (href) => location.pathname === href || location.pathname.startsWith(`${href}/`);

  return (
    <>
      {isOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          onClick={onClose}
        />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-[var(--border-color)] bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-[var(--shadow-floating)] backdrop-blur-xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-5">
            <Link to="/admin" className="flex items-center gap-3" onClick={onClose}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white shadow-lg">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)]">Restaurant SaaS</p>
                <p className="text-xs text-[var(--text-secondary)]">Admin Portal</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-[var(--text-secondary)] transition hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)] lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 py-5">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[linear-gradient(135deg,var(--color-primary-soft),rgba(255,255,255,0.03))] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">Admin Workspace</p>
              <p className="mt-2 text-sm font-semibold text-[var(--text-primary)]">{user?.restaurantName || 'Main branch'}</p>
              <p className="mt-1 text-xs text-[var(--text-secondary)]">Role: {user?.role || 'owner'}</p>
            </div>
          </div>

          <div className="px-4 pb-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">Admin</p>
          </div>

          <nav className="space-y-1 overflow-y-auto px-3">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[linear-gradient(135deg,var(--color-primary-soft),rgba(6,182,212,0.12))] text-[var(--color-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
