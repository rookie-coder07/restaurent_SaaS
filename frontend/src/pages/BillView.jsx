import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, Printer } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';
import { orderAPI, restaurantAPI } from '../services/apiEndpoints';
import { buildInvoiceData } from '../utils/invoice';
import { formatCurrency, formatDisplayOrderNumber } from '../utils/formatters';

function resolveReturnPath(pathname = '', fallback = '') {
  if (fallback) {
    return fallback;
  }

  if (pathname.startsWith('/manager')) {
    return '/manager/bills';
  }

  return '/pos';
}

export default function BillView() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!location.state?.invoice);
  const [error, setError] = useState('');
  const [order, setOrder] = useState(location.state?.order || null);
  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null);
  const [invoiceOverride, setInvoiceOverride] = useState(location.state?.invoice || null);
  const [printing, setPrinting] = useState(false);

  const returnTo = useMemo(
    () => resolveReturnPath(location.pathname, location.state?.returnTo || ''),
    [location.pathname, location.state]
  );

  useEffect(() => {
    console.log('BillView order', order);
  }, [order]);

  useEffect(() => {
    if (invoiceOverride || !orderId) {
      setLoading(false);
      return;
    }

    let isActive = true;

    const loadBillData = async () => {
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

        setError(requestError.response?.data?.message || 'Failed to load bill data.');
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    };

    loadBillData();

    return () => {
      isActive = false;
    };
  }, [invoiceOverride, orderId]);

  const invoice = useMemo(
    () =>
      invoiceOverride ||
      buildInvoiceData({
        order,
        restaurant: restaurant || {},
        cashierName: order?.billing?.cashierName || location.state?.cashierName || '',
      }),
    [invoiceOverride, order, restaurant, location.state]
  );
  const qrCodeImage = useMemo(
    () =>
      restaurant?.paymentQrCodeUrl ||
      restaurant?.paymentQrCode ||
      order?.paymentQrCodeUrl ||
      order?.paymentQrCode ||
      '',
    [order, restaurant]
  );

  const handlePrint = () => {
    if (!invoice) {
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
          Loading bill...
        </div>
      </div>
    );
  }

  if (!invoice || !order) {
    return (
      <div className="space-y-6">
        {error ? <Toast type="error" message={error} /> : null}
        <Card>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">Billing</p>
          <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">No Bill Data</h1>
          <p className="mt-2 text-sm text-[var(--color-text-muted)]">
            The bill could not be rendered because the order data was missing or failed to load.
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

      <Card className="bill-print-toolbar">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Bill View</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">
              {formatDisplayOrderNumber(order)}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Review items, GST, total, and payment details before printing the final bill.
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
              {printing ? 'Printing...' : 'Print Bill'}
            </Button>
          </div>
        </div>
      </Card>

      <div id="bill-section" className="bill-print-section">
        <div className="bill-receipt mx-auto w-full max-w-[80mm] rounded-[18px] border border-black bg-white p-4 text-black shadow-[0_18px_40px_rgba(15,23,42,0.12)]">
          <div className="border-b border-dashed border-black pb-3 text-center">
            <h1 className="text-base font-bold uppercase tracking-[0.08em]">{invoice.restaurantName}</h1>
            {invoice.address ? <p className="mt-1 text-[11px] leading-4">{invoice.address}</p> : null}
            {(invoice.phone || invoice.gstin) ? (
              <p className="mt-1 text-[11px] leading-4">
                {invoice.phone ? `Ph: ${invoice.phone}` : ''}
                {invoice.phone && invoice.gstin ? ' | ' : ''}
                {invoice.gstin ? `GSTIN: ${invoice.gstin}` : ''}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-b border-dashed border-black py-3 text-[11px] leading-4">
            <span className="font-semibold">Invoice No</span>
            <span className="text-right">{invoice.invoiceNumber}</span>
            <span className="font-semibold">Date & Time</span>
            <span className="text-right">{new Date(invoice.invoiceDate).toLocaleString('en-IN')}</span>
            <span className="font-semibold">Order Type</span>
            <span className="text-right">{String(invoice.orderType || '').replace('-', ' ')}</span>
            <span className="font-semibold">Table</span>
            <span className="text-right">{invoice.tableNumber || 'Walk-in'}</span>
            <span className="font-semibold">Cashier</span>
            <span className="text-right">{invoice.cashierName || 'Cashier'}</span>
            {invoice.kotReference ? (
              <>
                <span className="font-semibold">KOT Ref</span>
                <span className="text-right">{invoice.kotReference}</span>
              </>
            ) : null}
          </div>

          <div className="py-3">
            <div className="grid grid-cols-[1fr_34px_54px_64px] gap-2 border-b border-black pb-2 text-[11px] font-bold uppercase tracking-[0.08em]">
              <span>Item</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Rate</span>
              <span className="text-right">Amount</span>
            </div>
            <div className="divide-y divide-dashed divide-black">
              {invoice.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="grid grid-cols-[1fr_34px_54px_64px] gap-2 py-2 text-[11px] leading-4">
                  <span className="pr-2">{item.name}</span>
                  <span className="text-right">{item.quantity}</span>
                  <span className="text-right">{formatCurrency(item.price)}</span>
                  <span className="text-right font-semibold">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1 border-t border-dashed border-black pt-3 text-[11px] leading-4">
            <div className="flex items-center justify-between"><span>Subtotal</span><span>{formatCurrency(invoice.summary.subtotal)}</span></div>
            <div className="flex items-center justify-between"><span>Discount</span><span>-{formatCurrency(invoice.summary.orderDiscountAmount + invoice.summary.managerDiscountAmount)}</span></div>
            <div className="flex items-center justify-between"><span>Taxable Amount</span><span>{formatCurrency(invoice.summary.taxableAmount)}</span></div>
            <div className="flex items-center justify-between"><span>CGST ({invoice.summary.cgstRate}%)</span><span>{formatCurrency(invoice.summary.cgstAmount)}</span></div>
            <div className="flex items-center justify-between"><span>SGST ({invoice.summary.sgstRate}%)</span><span>{formatCurrency(invoice.summary.sgstAmount)}</span></div>
            {invoice.summary.chargesTotal > 0 ? (
              <div className="flex items-center justify-between"><span>Charges</span><span>{formatCurrency(invoice.summary.chargesTotal)}</span></div>
            ) : null}
            <div className="flex items-center justify-between border-t border-black pt-2 font-bold uppercase tracking-[0.06em]"><span>Total</span><span>{formatCurrency(invoice.summary.payableBeforeRound)}</span></div>
            <div className="flex items-center justify-between"><span>Round Off</span><span>{formatCurrency(invoice.summary.roundOff)}</span></div>
            <div className="flex items-center justify-between border-t border-black pt-2 text-[14px] font-extrabold uppercase">
              <span>Final Amount</span>
              <span>{formatCurrency(invoice.summary.grandTotal)}</span>
            </div>
          </div>

          <div className="mt-3 border-t border-dashed border-black pt-3 text-[11px] leading-4">
            <div className="flex items-center justify-between"><span>Payment Mode</span><span>{String(invoice.paymentMode || 'cash').toUpperCase()}</span></div>
            <div className="mt-1 flex items-center justify-between"><span>Paid Amount</span><span>{formatCurrency(invoice.paidAmount)}</span></div>
          </div>

          {qrCodeImage ? (
            <div className="mt-4 border-t border-dashed border-black pt-3 text-center">
              <img src={qrCodeImage} alt="Payment QR" className="mx-auto h-28 w-28 object-contain" />
            </div>
          ) : null}

          <div className="mt-4 border-t border-dashed border-black pt-3 text-center text-[11px] leading-4">
            <p>Thank you for dining with us</p>
            <p className="mt-1">Visit Again</p>
          </div>
        </div>
      </div>
    </div>
  );
}
