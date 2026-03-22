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
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

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

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user } = useAuth();

  const filteredMenuItems = menuItems.filter((item) => item.roles.includes(user?.role || 'owner'));

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
        className={`fixed inset-y-0 left-0 z-50 w-72 border-r border-gray-200 bg-white transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between border-b border-gray-200 px-5 py-5">
            <Link to="/" className="flex items-center gap-3" onClick={onClose}>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#2563eb] text-white">
                <UtensilsCrossed className="h-5 w-5" />
              </div>
              <div>
                <p className="text-base font-semibold text-[#0f172a]">Restaurant SaaS</p>
                <p className="text-xs text-[#64748b]">Operations Dashboard</p>
              </div>
            </Link>

            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-[#64748b] transition hover:bg-gray-50 lg:hidden"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="px-4 py-5">
            <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#64748b]">Workspace</p>
              <p className="mt-2 text-sm font-semibold text-[#0f172a]">{user?.restaurantName || 'Main branch'}</p>
              <p className="mt-1 text-xs text-[#64748b]">Role: {user?.role || 'owner'}</p>
            </div>
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-6">
            {filteredMenuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;

              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ${
                    isActive
                      ? 'bg-blue-50 text-[#2563eb]'
                      : 'text-[#64748b] hover:bg-gray-50 hover:text-[#0f172a]'
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
