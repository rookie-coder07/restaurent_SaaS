import { useMemo, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { playLoudBuzzer } from '../../utils/alerts';
import { subscribeToOrderEvents } from '../../utils/liveOrderEvents';
import Toast from '../common/Toast';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useAuthStore } from '../../context/authStore';

const PAGE_META = {
  '/pos/tables': {
    section: 'POS Tables',
    title: 'Floor Operations',
  },
  '/pos/orders': {
    section: 'POS Orders',
    title: 'Unified Online Orders',
  },
  '/pos/settings': {
    section: 'POS Settings',
    title: 'Account Settings',
  },
};

export default function PosLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [staffAlertMessage, setStaffAlertMessage] = useState('');
  const location = useLocation();
  const userRole = useAuthStore((state) => state.user?.role);
  const knownStaffOrderIdsRef = useRef(new Set());

  const pageMeta = useMemo(
    () =>
      PAGE_META[location.pathname] || {
        section: 'POS Tables',
        title: 'Floor Operations',
      },
    [location.pathname]
  );

  // Setup buzzer notifications for staff when they receive orders
  useEffect(() => {
    if (userRole !== 'staff') {
      knownStaffOrderIdsRef.current = new Set();
      return undefined;
    }

    const cleanup = subscribeToOrderEvents((payload) => {
      const eventType = String(payload?.type || '');
      const orderId = String(payload?.orderId || '').trim();
      const eventTimestamp = payload?.updatedAt || payload?.createdAt || payload?.emittedAt || '';
      const eventAgeMs = eventTimestamp ? Date.now() - new Date(eventTimestamp).getTime() : 0;
      const isFreshEvent = !eventTimestamp || Number.isNaN(eventAgeMs) || eventAgeMs <= 20000;
      
      // Staff should be notified of new orders (both QR and manual)
      const shouldBuzzStaff =
        eventType === 'order.created' ||
        (eventType === 'order.status_updated' && String(payload?.status || '').trim().toLowerCase() === 'pending');

      if (!eventType.startsWith('order.') || !orderId) {
        return;
      }

      if (!knownStaffOrderIdsRef.current.has(orderId) && isFreshEvent) {
        knownStaffOrderIdsRef.current.add(orderId);

        if (shouldBuzzStaff) {
          playLoudBuzzer('waiter');
          setStaffAlertMessage(
            payload?.tableNumber
              ? `New order for table ${payload.tableNumber}`
              : 'New order received'
          );
        }
      }
    });

    return cleanup;
  }, [userRole]);

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg-main)] text-[var(--text-primary)]">
      {staffAlertMessage ? (
        <Toast
          type="warning"
          message={staffAlertMessage}
          onClose={() => setStaffAlertMessage('')}
          autoDismissMs={5200}
        />
      ) : null}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex h-screen min-h-0 flex-col lg:pl-72">
        <Navbar
          sectionLabel={pageMeta.section}
          pageTitle={pageMeta.title}
          onMenuClick={() => setSidebarOpen(true)}
          portal="pos"
        />

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <div className="mx-auto flex max-w-[1800px] flex-col gap-4 p-4 sm:p-6 lg:p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
