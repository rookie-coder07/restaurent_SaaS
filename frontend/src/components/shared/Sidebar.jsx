import { Link, useLocation } from 'react-router-dom';
import {
  BarChart3,
  ChefHat,
  Menu,
  ShoppingCart,
  Settings,
  X,
  UtensilsCrossed,
  Zap,
  Users,
  TableProperties,
  QrCode,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const menuItems = [
  {
    icon: BarChart3,
    label: 'Dashboard',
    href: '/',
    roles: ['owner', 'manager'],
  },
  {
    icon: Menu,
    label: 'Menu Management',
    href: '/menu-management',
    roles: ['owner', 'manager'],
  },
  {
    icon: ShoppingCart,
    label: 'Orders',
    href: '/orders',
    roles: ['owner', 'manager'],
  },
  {
    icon: ChefHat,
    label: 'Kitchen',
    href: '/kitchen',
    roles: ['kitchen_staff', 'manager', 'owner'],
  },
  {
    icon: TableProperties,
    label: 'Tables',
    href: '/tables',
    roles: ['owner', 'manager'],
  },
  {
    icon: Users,
    label: 'Staff',
    href: '/staff',
    roles: ['owner', 'manager'],
  },
  {
    icon: Zap,
    label: 'Analytics',
    href: '/analytics',
    roles: ['owner', 'manager'],
  },
  {
    icon: QrCode,
    label: 'QR Test',
    href: '/qr-test',
    roles: ['owner', 'manager'],
  },
];

export default function Sidebar({ isOpen, setIsOpen }) {
  const location = useLocation();
  const { user } = useAuth();

  const filteredMenuItems = menuItems.filter((item) =>
    item.roles.includes(user?.role || 'owner')
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 fixed lg:relative w-64 h-screen bg-white border-r border-gray-200 transition-transform duration-300 z-40 flex flex-col`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="w-6 h-6 text-blue-600" />
            <h1 className="text-xl font-bold text-gray-900">RestroMaxx</h1>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-1 hover:bg-gray-100 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {filteredMenuItems.map((item) => {
            const isActive = location.pathname === item.href;
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-600 font-semibold'
                    : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <button className="w-full flex items-center gap-3 px-4 py-3 text-gray-700 hover:bg-gray-50 rounded-lg transition">
            <Settings className="w-5 h-5" />
            <span>Settings</span>
          </button>
        </div>
      </aside>
    </>
  );
}
