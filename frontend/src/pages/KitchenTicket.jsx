import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, Printer, Zap } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';
import { orderAPI, restaurantAPI } from '../services/apiEndpoints';
import { printKotReceipt } from '../utils/printerService';
import { printKotInstant } from '../utils/thermalPrinter';
import '../styles/thermal-print.css';

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

function resolveDisplayItems(ticket, order) {
  if (Array.isArray(ticket?.items) && ticket.items.length > 0) {
    return ticket.items;
  }

  if (Array.isArray(order?.items) && order.items.length > 0) {
    return order.items;
  }

  return [];
}

function resolvePaperWidthMm(location, restaurant) {
  const params = new URLSearchParams(location.search || '');
  const queryValue = Number(params.get('paper') || '');
  const stateValue = Number(location.state?.paperWidthMm || '');
  const restaurantValue = Number(
    restaurant?.receiptWidthMm ||
    restaurant?.billing?.receiptWidthMm ||
    restaurant?.printing?.receiptWidthMm ||
    ''
  );

  if (queryValue === 58 || queryValue === 80) {
    return queryValue;
  }

  if (stateValue === 58 || stateValue === 80) {
    return stateValue;
  }

  if (restaurantValue === 58 || restaurantValue === 80) {
    return restaurantValue;
  }

  return 80;
}

export default function KitchenTicket() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const initialTicketId = location.state?.ticket?.id || '';
  const [loading, setLoading] = useState(!location.state?.order);
  const [error, setError] = useState(location.state?.autoPrintError || '');
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
  const paperWidthMm = useMemo(
    () => resolvePaperWidthMm(location, restaurant),
    [location, restaurant]
  );
  const ticketItems = useMemo(() => resolveDisplayItems(ticket, order), [ticket, order]);

  const handlePrint = async () => {
    if (!ticket) {
      return;
    }

    try {
      setPrinting(true);
      const result = await printKotReceipt({
        ticket,
        order,
        restaurant,
        fallbackToBrowser: true,
      });
      if (result?.fallback && result?.error) {
        setError('Kitchen printer was unavailable, so browser print opened instead.');
      }
    } catch (printError) {
      setError(printError.message || 'Failed to print the KOT.');
    } finally {
      setPrinting(false);
    }
  };

  const handleInstantPrint = () => {
    if (!ticket) {
      return;
    }

    try {
      setPrinting(true);
      printKotInstant({
        ticket,
        order,
        restaurant,
      });
      // Instant print doesn't throw errors, fires directly
      setTimeout(() => setPrinting(false), 500);
    } catch (printError) {
      setError(printError.message || 'Failed to print the KOT.');
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

  if (!order || !ticket || ticketItems.length === 0) {
    return (
      <div className="space-y-6">
        {error ? <Toast type="error" message={error} /> : null}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Kitchen Ticket</p>
          <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">No Printable KOT Found</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            The kitchen ticket could not be rendered because the order items were missing from the takeaway order.
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
    <div className="thermal-print-page space-y-6" style={{ '--thermal-width': `${paperWidthMm}mm` }}>
      <style>{`@page { size: ${paperWidthMm}mm auto; margin: 0; }`}</style>
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
            <Button onClick={handleInstantPrint} disabled={printing} variant="primary">
              <Zap className="h-4 w-4" />
              {printing ? 'Printing...' : 'Instant Print'}
            </Button>
            <Button onClick={handlePrint} disabled={printing}>
              <Printer className="h-4 w-4" />
              {printing ? 'Printing...' : 'Print KOT'}
            </Button>
          </div>
        </div>
      </Card>

      <div id="kot-section" className="kot-print-section">
        <div className="thermal-print-root">
          <div className="kot-receipt thermal-receipt">
            <div className="thermal-center">
              <div className="thermal-title">{restaurant?.name || 'Restaurant'}</div>
              <div className="thermal-subtitle">KOT</div>
            </div>

            <div className="thermal-separator">--------------------------------</div>

            <div className="thermal-meta">
              <span>KOT Number</span>
              <span className="thermal-align-right">{ticket.sequence || '-'}</span>
              <span>Table Number</span>
              <span className="thermal-align-right">{ticket.tableNumber || (String(order.orderType || '').toLowerCase() === 'takeaway' ? 'Takeaway' : 'Walk-in')}</span>
              <span>Order Type</span>
              <span className="thermal-align-right">{String(order.orderType || '').replace('-', ' ') || 'Dine-in'}</span>
              <span>Time</span>
              <span className="thermal-align-right">{new Date(ticket.createdAt || order.createdAt || Date.now()).toLocaleString('en-IN')}</span>
            </div>

            <div className="thermal-separator">--------------------------------</div>

            <div className="thermal-kot-head">
              <span>Item</span>
              <span className="thermal-align-right">Qty</span>
            </div>

            <div className="thermal-separator">--------------------------------</div>

            <div className="thermal-items">
              {ticketItems.map((item, index) => (
                <div key={`${item.name}-${index}`} className="thermal-kot-row">
                  <span className="thermal-item-name thermal-strong">{item.name}</span>
                  <span className="thermal-align-right thermal-strong">{item.quantity || item.qty}</span>
                </div>
              ))}
            </div>

            <div className="thermal-separator">--------------------------------</div>
          </div>
        </div>
      </div>
    </div>
  );
}
