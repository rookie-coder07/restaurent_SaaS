import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, Printer } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';
import { orderAPI, restaurantAPI } from '../services/apiEndpoints';

function resolveReturnPath(pathname = '', fallback = '') {
  if (fallback) {
    return fallback;
  }

  if (pathname.startsWith('/manager')) {
    return '/manager/kitchen';
  }

  return '/pos';
}

function getTicketFromOrder(order, ticketId = '') {
  const tickets = Array.isArray(order?.kitchenTickets) ? order.kitchenTickets : [];
  if (!tickets.length) {
    return null;
  }

  if (ticketId) {
    return tickets.find((ticket) => String(ticket.id) === String(ticketId)) || null;
  }

  return [...tickets].sort((left, right) => Number(right.sequence || 0) - Number(left.sequence || 0))[0];
}

export default function KitchenTicket() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialTicketId = location.state?.ticket?.id || '';
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(location.state?.order || null);
  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null);
  const [printing, setPrinting] = useState(false);

  const returnTo = useMemo(
    () => resolveReturnPath(location.pathname, location.state?.returnTo || ''),
    [location.pathname, location.state]
  );

  useEffect(() => {
    if (!orderId || order) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const loadTicketData = async () => {
      setLoading(true);
      setError('');

      try {
        const [orderResponse, restaurantResponse] = await Promise.all([
          orderAPI.getOrder(orderId),
          restaurantAPI.getProfile(),
        ]);

        if (!isActive) {
          return;
        }

        setOrder(orderResponse.data?.data || null);
        setRestaurant(restaurantResponse.data?.data || null);
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        setError(requestError.response?.data?.message || 'Failed to load kitchen ticket.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadTicketData();

    return () => {
      isActive = false;
    };
  }, [order, orderId]);

  const ticket = useMemo(
    () => location.state?.ticket || getTicketFromOrder(order, initialTicketId),
    [initialTicketId, location.state, order]
  );

  const handlePrint = () => {
    if (!ticket) {
      return;
    }

    try {
      setPrinting(true);
      window.print();
    } finally {
      setPrinting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="inline-flex items-center gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-4 text-sm font-semibold text-[var(--text-primary)]">
          <Loader className="h-4 w-4 animate-spin" />
          Loading KOT...
        </div>
      </div>
    );
  }

  if (!order || !ticket) {
    return (
      <div className="space-y-6">
        {error ? <Toast type="error" message={error} /> : null}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Kitchen Ticket</p>
          <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">No Order Found</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            The kitchen ticket could not be rendered because the order or ticket data was missing.
          </p>
          <div className="mt-5">
            <Button onClick={() => navigate(returnTo)}>
              <ArrowLeft className="h-4 w-4" />
              Go Back
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error ? <Toast type="error" message={error} /> : null}

      <Card className="kot-print-toolbar">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Kitchen Ticket</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">KOT #{ticket.sequence || ''}</h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Review the kitchen ticket and print it without opening a new tab.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to={returnTo}>
              <Button variant="secondary">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
            <Button onClick={handlePrint} disabled={printing}>
              <Printer className="h-4 w-4" />
              {printing ? 'Printing...' : 'Print KOT'}
            </Button>
          </div>
        </div>
      </Card>

      <div id="kot-section" className="kot-print-section">
        <div className="kot-receipt mx-auto w-full max-w-[80mm] rounded-[18px] border border-black bg-white p-4 text-center text-black shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <div className="border-b border-dashed border-black pb-3">
            <h1 className="text-base font-extrabold uppercase tracking-[0.12em]">{restaurant?.name || 'Restaurant'}</h1>
            <p className="mt-2 text-[20px] font-black uppercase tracking-[0.16em]">KOT</p>
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-dashed border-black py-3 text-left text-[11px] leading-4">
            <span className="font-bold">KOT Number</span>
            <span className="text-right font-bold">{ticket.sequence || '-'}</span>
            <span className="font-bold">Table Number</span>
            <span className="text-right font-bold">{ticket.tableNumber || 'Walk-in'}</span>
            <span className="font-bold">Order Type</span>
            <span className="text-right font-bold">{String(order.orderType || '').replace('-', ' ') || 'Dine-in'}</span>
            <span className="font-bold">Time</span>
            <span className="text-right font-bold">{new Date(ticket.createdAt || order.createdAt || Date.now()).toLocaleString('en-IN')}</span>
          </div>

          <div className="grid grid-cols-[1fr_54px] gap-2 border-b border-black py-2 text-[11px] font-extrabold uppercase tracking-[0.08em]">
            <span className="text-left">Item</span>
            <span className="text-right">Qty</span>
          </div>

          <div className="divide-y divide-dashed divide-black text-left">
            {(ticket.items || []).map((item, index) => (
              <div key={`${item.name}-${index}`} className="grid grid-cols-[1fr_54px] gap-2 py-3">
                <span className="text-[16px] font-extrabold leading-5">{item.name}</span>
                <span className="text-right text-[16px] font-extrabold leading-5">{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
