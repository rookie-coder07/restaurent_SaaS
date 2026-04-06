import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Loader, Printer } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Toast from '../components/common/Toast';
import { orderAPI, restaurantAPI } from '../services/apiEndpoints';
import { buildInvoiceData } from '../utils/invoice';
import { formatCurrency, formatDisplayOrderNumber } from '../utils/formatters';
import { printBillReceipt } from '../utils/printerService';
import '../styles/thermal-print.css';

function resolveReturnPath(pathname = '', fallback = '') {
  if (fallback) {
    return fallback;
  }

  if (pathname.startsWith('/manager')) {
    return '/manager/bills';
  }

  return '/pos';
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

export default function BillView() {
  const { orderId = '' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(!location.state?.invoice);
  const [error, setError] = useState(location.state?.autoPrintError || '');
  const [order, setOrder] = useState(location.state?.order || null);
  const [restaurant, setRestaurant] = useState(location.state?.restaurant || null);
  const [invoiceOverride, setInvoiceOverride] = useState(location.state?.invoice || null);
  const [printing, setPrinting] = useState(false);

  const returnTo = useMemo(
    () => resolveReturnPath(location.pathname, location.state?.returnTo || ''),
    [location.pathname, location.state]
  );

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
  const paperWidthMm = useMemo(
    () => resolvePaperWidthMm(location, restaurant),
    [location, restaurant]
  );
  const totalDiscountAmount = useMemo(
    () => Number((invoice?.summary?.orderDiscountAmount || 0) + (invoice?.summary?.managerDiscountAmount || 0)),
    [invoice]
  );

  const handlePrint = async () => {
    if (!invoice) {
      return;
    }

    try {
      setPrinting(true);
      const result = await printBillReceipt({
        order,
        restaurant,
        invoice,
        cashierName: location.state?.cashierName || order?.billing?.cashierName || '',
        fallbackToBrowser: true,
      });
      if (result?.fallback && result?.error) {
        setError('Billing printer was unavailable, so browser print opened instead.');
      }
    } catch (printError) {
      setError(printError.message || 'Failed to print the bill.');
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
    <div className="compact-page thermal-print-page space-y-4" style={{ '--thermal-width': `${paperWidthMm}mm` }}>
      <style>{`@page { size: ${paperWidthMm}mm auto; margin: 0; }`}</style>
      {error ? <Toast type="error" message={error} /> : null}

      <Card className="bill-print-toolbar">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Bill View</p>
            <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">
              {formatDisplayOrderNumber(order)}
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted)]">
              Review items, CGST, SGST, total, and payment details before printing the final bill.
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

      <div id="bill-section" className="bill-print-section overflow-x-auto">
        <div className="thermal-print-root">
          <div className="bill-receipt thermal-receipt">
            <div className="thermal-center">
              <div className="thermal-title">{invoice.restaurantName}</div>
              {invoice.address ? <div className="thermal-muted">{invoice.address}</div> : null}
              {(invoice.phone || invoice.gstin) ? (
                <div className="thermal-muted">
                  {invoice.phone ? `Ph: ${invoice.phone}` : ''}
                  {invoice.phone && invoice.gstin ? ' | ' : ''}
                  {invoice.gstin ? `GSTIN: ${invoice.gstin}` : ''}
                </div>
              ) : null}
            </div>

            <div className="thermal-separator">--------------------------------</div>

            <div className="thermal-meta">
              <span>Bill No</span>
              <span className="thermal-align-right">{invoice.invoiceNumber}</span>
              <span>Date & Time</span>
              <span className="thermal-align-right">{new Date(invoice.invoiceDate).toLocaleString('en-IN')}</span>
              <span>Order Type</span>
              <span className="thermal-align-right">{String(invoice.orderType || '').replace('-', ' ')}</span>
              <span>Table</span>
              <span className="thermal-align-right">{invoice.tableNumber || 'Walk-in'}</span>
            </div>

            <div className="thermal-separator">--------------------------------</div>

            <div className="thermal-bill-head">
              <span>Item</span>
              <span className="thermal-align-right">Qty</span>
              <span className="thermal-align-right">Rate</span>
              <span className="thermal-align-right">Amt</span>
            </div>

            <div className="thermal-separator">--------------------------------</div>

            <div className="thermal-items">
              {invoice.items.map((item, index) => (
                <div key={`${item.name}-${index}`} className="thermal-bill-row">
                  <span className="thermal-item-name">{item.name}</span>
                  <span className="thermal-align-right">{item.quantity}</span>
                  <span className="thermal-align-right">{formatCurrency(item.price)}</span>
                  <span className="thermal-align-right thermal-strong">{formatCurrency(item.total)}</span>
                </div>
              ))}
            </div>

            <div className="thermal-separator">--------------------------------</div>

            <div className="thermal-summary">
              <div className="thermal-summary-row"><span>Subtotal</span><span>{formatCurrency(invoice.summary.subtotal)}</span></div>
              {totalDiscountAmount > 0 ? (
                <div className="thermal-summary-row"><span>Discount</span><span>-{formatCurrency(totalDiscountAmount)}</span></div>
              ) : null}
              <div className="thermal-summary-row"><span>Taxable</span><span>{formatCurrency(invoice.summary.taxableAmount)}</span></div>
              <div className="thermal-summary-row"><span>CGST ({invoice.summary.cgstRate}%)</span><span>{formatCurrency(invoice.summary.cgstAmount)}</span></div>
              <div className="thermal-summary-row"><span>SGST ({invoice.summary.sgstRate}%)</span><span>{formatCurrency(invoice.summary.sgstAmount)}</span></div>
              {invoice.summary.chargesTotal > 0 ? (
                <div className="thermal-summary-row"><span>Charges</span><span>{formatCurrency(invoice.summary.chargesTotal)}</span></div>
              ) : null}
              <div className="thermal-summary-row"><span>Total</span><span>{formatCurrency(invoice.summary.payableBeforeRound)}</span></div>
              <div className="thermal-summary-row"><span>Round Off</span><span>{formatCurrency(invoice.summary.roundOff)}</span></div>
              <div className="thermal-summary-row thermal-strong"><span>Final Amount</span><span>{formatCurrency(invoice.summary.grandTotal)}</span></div>
            </div>

            <div className="thermal-separator">--------------------------------</div>

            <div className="thermal-summary">
              <div className="thermal-summary-row"><span>Payment Mode</span><span>{String(invoice.paymentMode || 'cash').toUpperCase()}</span></div>
              <div className="thermal-summary-row"><span>Paid Amount</span><span>{formatCurrency(invoice.paidAmount)}</span></div>
            </div>

            {qrCodeImage ? (
              <>
                <div className="thermal-separator">--------------------------------</div>
                <div className="thermal-center">
                  <img src={qrCodeImage} alt="Payment QR" className="mx-auto h-28 w-28 object-contain" />
                </div>
              </>
            ) : null}

            <div className="thermal-separator">--------------------------------</div>

            <div className="thermal-center">
              <div>Thank you for dining with us</div>
              <div className="thermal-muted">Visit Again</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
