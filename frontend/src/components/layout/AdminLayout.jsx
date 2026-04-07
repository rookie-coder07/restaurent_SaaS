import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../context/authStore';
import Toast from '../common/Toast';
import { playLoudBuzzer } from '../../utils/alerts';
import { subscribeToOrderEvents } from '../../utils/liveOrderEvents';
import Navbar from './Navbar';
import Sidebar from './Sidebar';

const PAGE_META = {
  '/admin': {
    section: 'Admin',
    title: 'Restaurant Overview',
  },
  '/admin/notifications': {
    section: 'Notifications',
    title: 'Owner Notification Center',
  },
  '/admin/menu': {
    section: 'Menu',
    title: 'Menu Management',
  },
  '/admin/orders': {
    section: 'Orders',
    title: 'Order Management',
  },
  '/admin/inventory': {
    section: 'Inventory',
    title: 'Kitchen Stock Control',
  },
  '/admin/staff': {
    section: 'Staff Access',
    title: 'POS & KOT Staff Access',
  },
  '/admin/analytics': {
    section: 'Analytics',
    title: 'Revenue Analytics',
  },
  '/admin/tables': {
    section: 'Tables',
    title: 'Live Floor View',
  },
  '/admin/settings': {
    section: 'Settings',
    title: 'Workspace Settings',
  },
  '/manager': {
    section: 'Manager',
    title: 'Operations Dashboard',
  },
  '/manager/orders': {
    section: 'Orders',
    title: 'Order History & Settlement',
  },
  '/manager/takeaway-orders': {
    section: 'Takeaway',
    title: 'Takeaway Order Desk',
  },
  '/manager/tables': {
    section: 'Tables',
    title: 'Table Control',
  },
  '/manager/kitchen': {
    section: 'Kitchen',
    title: 'KOT Operations',
  },
  '/manager/waiters': {
    section: 'Waiters',
    title: 'Waiter Control',
  },
  '/manager/inventory': {
    section: 'Inventory',
    title: 'Stock Visibility',
  },
  '/manager/bills': {
    section: 'Bills',
    title: 'Billing Control',
  },
  '/manager/settings': {
    section: 'Settings',
    title: 'Workspace Settings',
  },
  '/developer': {
    section: 'Developer',
    title: 'Platform Overview',
  },
  '/developer/restaurants': {
    section: 'Restaurants',
    title: 'Restaurant Control',
  },
  '/developer/users': {
    section: 'Users',
    title: 'User Control',
  },
  '/developer/system': {
    section: 'System',
    title: 'System Controls',
  },
  '/developer/audit': {
    section: 'Audit',
    title: 'Audit Trail',
  },
};

export default function AdminLayout({ children }) {
  return <AdminLayoutInner>{children}</AdminLayoutInner>;
}

export function AdminLayoutInner({ children, portal = 'admin' }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [managerAlertMessage, setManagerAlertMessage] = useState('');
  const location = useLocation();
  const userRole = useAuthStore((state) => state.user?.role);
  const knownManagerOrderIdsRef = useRef(new Set());

  const pageMeta = useMemo(
    () =>
      PAGE_META[location.pathname] || {
        section: portal === 'kot' ? 'Kitchen' : userRole === 'manager' ? 'Manager' : 'Admin',
        title:
          portal === 'kot'
            ? 'Kitchen Operations'
            : userRole === 'developer'
              ? 'Developer Console'
            : userRole === 'manager'
              ? 'Restaurant Operations Center'
              : 'Restaurant Control Center',
      },
    [location.pathname, portal, userRole]
  );

  useEffect(() => {
    if (userRole !== 'manager') {
      knownManagerOrderIdsRef.current = new Set();
      return undefined;
    }

    if (location.pathname.startsWith('/manager/kitchen')) {
      return undefined;
    }

    const cleanup = subscribeToOrderEvents((payload) => {
      const eventType = String(payload?.type || '');
      const orderId = String(payload?.orderId || '').trim();
      const eventTimestamp = payload?.updatedAt || payload?.createdAt || payload?.emittedAt || '';
      const eventAgeMs = eventTimestamp ? Date.now() - new Date(eventTimestamp).getTime() : 0;
      const isFreshEvent = !eventTimestamp || Number.isNaN(eventAgeMs) || eventAgeMs <= 20000;
      const shouldBuzzManager =
        eventType === 'order.created' ||
        eventType === 'order.sent_to_kitchen' ||
        (eventType === 'order.status_updated' && String(payload?.status || '').trim().toLowerCase() === 'pending');

      if (!eventType.startsWith('order.') || !orderId) {
        return;
      }

      if (!knownManagerOrderIdsRef.current.has(orderId) && isFreshEvent) {
        knownManagerOrderIdsRef.current.add(orderId);

        if (shouldBuzzManager) {
          playLoudBuzzer('manager');
          setManagerAlertMessage(
            payload?.tableNumber
              ? `New order received for table ${payload.tableNumber}.`
              : 'New order received.'
          );
        }
      }
    });

    return cleanup;
  }, [location.pathname, userRole]);

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)]">
      {managerAlertMessage ? (
        <Toast
          type="warning"
          message={managerAlertMessage}
          onClose={() => setManagerAlertMessage('')}
          autoDismissMs={5200}
        />
      ) : null}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex h-screen min-h-0 flex-col lg:pl-72">
        <Navbar
          sectionLabel={pageMeta.section}
          pageTitle={pageMeta.title}
          onMenuClick={() => setSidebarOpen(true)}
          portal={portal}
        />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 p-4 sm:p-5 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
