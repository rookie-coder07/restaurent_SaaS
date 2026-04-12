import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  BellRing,
  ClipboardList,
  PackageSearch,
  MenuSquare,
  Sparkles,
  Users,
  TableProperties,
  Palette,
  UtensilsCrossed,
  X,
  ChefHat,
  Receipt,
  Gift,
  LayoutGrid,
  ListOrdered,
  KeyRound,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import PortalLogoutButton from '../common/PortalLogoutButton';

const ownerMenuItems = [
  { icon: BarChart3, label: 'Dashboard', href: '/admin', roles: ['owner'] },
  { icon: BellRing, label: 'Notifications', href: '/admin/notifications', roles: ['owner'] },
  { icon: MenuSquare, label: 'Menu', href: '/admin/menu', roles: ['owner'] },
  { icon: ClipboardList, label: 'Orders', href: '/admin/orders', roles: ['owner'] },
  { icon: PackageSearch, label: 'Inventory', href: '/admin/inventory', roles: ['owner'] },
  { icon: TableProperties, label: 'Tables', href: '/admin/tables', roles: ['owner'] },
  { icon: Users, label: 'Staff Access', href: '/admin/staff', roles: ['owner'] },
  { icon: Gift, label: 'Loyalty', href: '/admin/loyalty', roles: ['owner'] },
  { icon: Sparkles, label: 'Analytics', href: '/admin/analytics', roles: ['owner'] },
  { icon: BarChart3, label: 'Staff Activity', href: '/admin/staff-activity', roles: ['owner'] },
  { icon: Palette, label: 'Settings', href: '/admin/settings', roles: ['owner'] },
  { icon: KeyRound, label: 'Change Password', href: '/admin/change-password', roles: ['owner'] },
];

const managerMenuItems = [
  { icon: BarChart3, label: 'Dashboard', href: '/manager', roles: ['manager'] },
  { icon: TableProperties, label: 'Tables', href: '/manager/tables', roles: ['manager'] },
  { icon: ClipboardList, label: 'Orders', href: '/manager/orders', roles: ['manager'] },
  { icon: ListOrdered, label: 'Takeaway Orders', href: '/manager/takeaway-orders', roles: ['manager'] },
  { icon: ChefHat, label: 'Kitchen', href: '/manager/kitchen', roles: ['manager'] },
  { icon: Users, label: 'Waiters', href: '/manager/waiters', roles: ['manager'] },
  { icon: PackageSearch, label: 'Inventory', href: '/manager/inventory', roles: ['manager'] },
  { icon: Receipt, label: 'Bills', href: '/manager/bills', roles: ['manager'] },
  { icon: BarChart3, label: 'Staff Activity', href: '/manager/staff-activity', roles: ['manager'] },
  { icon: Palette, label: 'Settings', href: '/manager/settings', roles: ['manager'] },
  { icon: KeyRound, label: 'Change Password', href: '/manager/change-password', roles: ['manager'] },
];

const developerMenuItems = [
  { icon: BarChart3, label: 'Overview', href: '/developer', roles: ['developer'] },
  { icon: TableProperties, label: 'Restaurants', href: '/developer/restaurants', roles: ['developer'] },
  { icon: Sparkles, label: 'Create Restaurant', href: '/developer/create-restaurant', roles: ['developer'] },
  { icon: Users, label: 'Users', href: '/developer/users', roles: ['developer'] },
  { icon: Palette, label: 'System', href: '/developer/system', roles: ['developer'] },
  { icon: ClipboardList, label: 'Audit Logs', href: '/developer/audit', roles: ['developer'] },
  { icon: KeyRound, label: 'Change Password', href: '/developer/change-password', roles: ['developer'] },
];

const posMenuItems = [
  { icon: LayoutGrid, label: 'Tables', href: '/pos/tables', roles: ['staff'] },
  { icon: ListOrdered, label: 'Orders', href: '/pos/orders', roles: ['staff'] },
  { icon: Palette, label: 'Settings', href: '/pos/settings', roles: ['staff'] },
  { icon: KeyRound, label: 'Change Password', href: '/pos/change-password', roles: ['staff'] },
];

const kotMenuItems = [
  { icon: ChefHat, label: 'Kitchen', href: '/kot', roles: ['kitchen_staff'] },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user } = useAuth();
  const restaurantName =
    user?.restaurantName ||
    user?.restaurant?.name ||
    user?.name ||
    'Restaurant';

  const activeRole = user?.role || 'owner';
  const isPosPortal = location.pathname.startsWith('/pos');
  const isKotPortal = location.pathname.startsWith('/kot') || location.pathname.startsWith('/kitchen');
  const isManagerPortal = location.pathname.startsWith('/manager');
  const isDeveloperPortal = location.pathname.startsWith('/developer');
  const workspaceItems = isKotPortal ? kotMenuItems : isPosPortal ? posMenuItems : isDeveloperPortal ? developerMenuItems : isManagerPortal ? managerMenuItems : ownerMenuItems;
  const filteredMenuItems = workspaceItems.filter((item) => item.roles.includes(activeRole));
  const isActivePath = (href) => location.pathname === href || location.pathname.startsWith(`${href}/`);
  const homePath = isKotPortal ? '/kot' : isPosPortal ? '/pos/tables' : isDeveloperPortal ? '/developer' : isManagerPortal ? '/manager' : '/admin';
  const portal = isKotPortal ? 'kot' : isPosPortal ? 'pos' : 'admin';
  const workspaceLabel = isKotPortal ? 'KOT Portal' : isPosPortal ? 'POS Portal' : isDeveloperPortal ? 'Developer Console' : isManagerPortal ? 'Manager Portal' : 'Admin Portal';
  const navLabel = isKotPortal ? 'Kitchen' : isPosPortal ? 'POS Navigation' : isDeveloperPortal ? 'Platform' : isManagerPortal ? 'Operations' : 'Admin';

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
        className={`fixed inset-y-0 left-0 z-50 h-screen w-72 overflow-hidden border-r border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-floating)] backdrop-blur-xl transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
            <Link to={homePath} className="flex items-center gap-3" onClick={onClose}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-accent)] text-white shadow-lg">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-[var(--text-primary)]">{restaurantName}</p>
                <p className="text-xs text-[var(--text-secondary)]">{workspaceLabel}</p>
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

          <div className="px-4 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">{navLabel}</p>
          </div>

          <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-5">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = isActivePath(item.href);

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-[var(--radius-control)] px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-[linear-gradient(135deg,var(--color-primary-soft),rgba(14,165,233,0.14))] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-[var(--border-color)] px-4 py-4">
            <PortalLogoutButton
              portal={portal}
              label="Log Out"
              className="w-full justify-center rounded-[var(--radius-control)] bg-[var(--bg-card-muted)]"
            />
          </div>
        </div>
      </aside>
    </>
  );
}
