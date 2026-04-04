import { BadgePercent, CreditCard, Loader, Receipt, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import { orderAPI, restaurantAPI } from '../services/apiEndpoints';
import { useAuthStore } from '../context/authStore';
import { useManagerStore } from '../context/managerStore';
import { formatCurrency, formatDate, formatDisplayOrderNumber } from '../utils/formatters';
import { buildInvoiceData } from '../utils/invoice';
import { DISCOUNT_LIMIT_PERCENT, isUnpaid } from '../utils/managerPortal';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';

export default function ManagerBills() {
  const navigate = useNavigate();
  const { data: ordersData = {}, loading, execute: reloadOrders } = useApi(() => orderAPI.getOrders({ limit: 150 }));
  const { data: restaurantProfile = {} } = useApi(restaurantAPI.getProfile);
  const user = useAuthStore((state) => state.user);
  const approvedDiscounts = useManagerStore((state) => state.approvedDiscounts);
  const approveDiscount = useManagerStore((state) => state.approveDiscount);
  const [selectedBill, setSelectedBill] = useState(null);
  const [payingBill, setPayingBill] = useState(null);
  const [discountPercent, setDiscountPercent] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [actioningBillId, setActioningBillId] = useState('');

  const bills = ordersData?.items || [];
  const unpaidBills = useMemo(() => bills.filter(isUnpaid), [bills]);
  const billsByTable = useMemo(() => {
    const grouped = new Map();
    bills.forEach((bill) => {
      const key = bill.tableNumber || 'Walk-in';
      const existing = grouped.get(key) || [];
      existing.push(bill);
      grouped.set(key, existing);
    });
    return Array.from(grouped.entries());
  }, [bills]);

  const submitApproval = () => {
    const percent = Number(discountPercent);
    if (!selectedBill) {
      return;
    }

    if (!percent || percent > DISCOUNT_LIMIT_PERCENT) {
      setError(`Manager discounts are limited to ${DISCOUNT_LIMIT_PERCENT}%.`);
      return;
    }

    approveDiscount({
      orderId: selectedBill.id,
      percent,
      note,
      approvedBy: user?.name || user?.email || 'Manager',
    });
    setSuccess(`Discount approved for ${formatDisplayOrderNumber(selectedBill)}.`);
    setSelectedBill(null);
    setDiscountPercent('');
    setNote('');
    setError('');
  };

  const markBillPaid = async () => {
    if (!payingBill?.id) {
      return;
    }

    const approval = approvedDiscounts[payingBill.id];
    setActioningBillId(payingBill.id);
    setError('');

    try {
      await orderAPI.settleOrder(payingBill.id, {
        paymentMethod,
        amountReceived: paymentMethod === 'cash' ? Number(amountReceived || payingBill.totalAmount || 0) : undefined,
        discountPercent: approval?.percent || undefined,
        paymentNote: [approval?.note, note.trim()].filter(Boolean).join(' | '),
      });
      const refreshedOrder = await orderAPI.getOrder(payingBill.id);
      const settledBill = refreshedOrder.data?.data;
      const invoiceData = buildInvoiceData({
        order: settledBill,
        restaurant: restaurantProfile,
        cashierName: user?.name || user?.email || 'Manager',
      });
      setSuccess(
        approval?.percent
          ? `${formatDisplayOrderNumber(payingBill)} marked paid with ${approval.percent}% discount.`
          : `${formatDisplayOrderNumber(payingBill)} marked paid.`
      );
      setPayingBill(null);
      setAmountReceived('');
      setNote('');
      await reloadOrders();
      navigate(`/manager/bills/${settledBill?.id || payingBill.id}`, {
        state: {
          order: settledBill,
          restaurant: restaurantProfile,
          invoice: invoiceData,
          returnTo: '/manager/bills',
          cashierName: user?.name || user?.email || 'Manager',
        },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to mark bill paid.');
    } finally {
      setActioningBillId('');
    }
  };

  if (loading && bills.length === 0) {
    return <div className="flex h-full items-center justify-center"><Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" /></div>;
  }

  return (
    <div className="space-y-6">
      {success ? <Toast type="success" message={success} /> : null}
      {error ? <Toast type="error" message={error} /> : null}

      <Card>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[var(--color-text-subtle)]">Billing Control</p>
        <h1 className="mt-3 text-3xl font-bold text-[var(--color-text)]">Track live bills, unpaid tables, and manager-approved discounts</h1>
        <p className="mt-2 text-sm text-[var(--color-text-muted)]">Managers can view every bill, watch table totals, approve limited discounts, and close bills by marking them paid.</p>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">All bills</p><p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{bills.length}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Unpaid bills</p><p className="mt-2 text-3xl font-bold text-amber-400">{unpaidBills.length}</p></Card>
        <Card className="p-5"><p className="text-sm text-[var(--text-secondary)]">Pending amount</p><p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{formatCurrency(unpaidBills.reduce((sum, order) => sum + Number(order.totalAmount || order.total || 0), 0))}</p></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr,1.1fr]">
        <Card>
          <p className="text-sm text-[var(--text-secondary)]">Live bill per table</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Table billing view</h2>
          <div className="mt-4 space-y-3">
            {billsByTable.map(([tableNumber, tableBills]) => (
              <div key={String(tableNumber)} className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-[var(--text-primary)]">Table {tableNumber}</p>
                  <p className="text-sm text-[var(--text-secondary)]">{tableBills.length} bill(s)</p>
                </div>
                <p className="mt-2 text-lg font-bold text-[var(--text-primary)]">
                  {formatCurrency(tableBills.reduce((sum, bill) => sum + Number(bill.totalAmount || bill.total || 0), 0))}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          {bills.map((bill) => {
            const approval = approvedDiscounts[bill.id];

            return (
              <Card key={bill.id} className="p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--color-text-subtle)]">{formatDisplayOrderNumber(bill)}</p>
                    <h2 className="mt-2 text-xl font-bold text-[var(--color-text)]">Table {bill.tableNumber || 'Walk-in'}</h2>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">{formatDate(bill.createdAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-[var(--color-text)]">{formatCurrency(bill.totalAmount || bill.total || 0)}</p>
                    <p className={`mt-1 text-sm font-semibold ${isUnpaid(bill) ? 'text-amber-400' : 'text-emerald-400'}`}>{bill.paymentStatus || 'unpaid'}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl bg-[var(--color-surface-muted)] p-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--color-text)]">Discount approval</p>
                    <p className="mt-1 text-sm text-[var(--color-text-muted)]">
                      {approval ? `${approval.percent}% approved by ${approval.approvedBy}` : 'No manager discount approved yet.'}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-[var(--color-panel)] px-3 py-2 text-sm font-semibold text-[var(--color-text)]">
                      <CreditCard className="h-4 w-4" />
                      {isUnpaid(bill) ? 'Unpaid' : 'Settled'}
                    </div>
                    <Button onClick={() => setSelectedBill(bill)}>
                      <BadgePercent className="h-4 w-4" />
                      Approve Discount
                    </Button>
                    {isUnpaid(bill) ? (
                      <Button onClick={() => { setPayingBill(bill); setPaymentMethod('cash'); setAmountReceived(String(bill.totalAmount || bill.total || 0)); }}>
                        <Receipt className="h-4 w-4" />
                        Mark Paid
                      </Button>
                    ) : (
                      <Button
                        variant="secondary"
                        onClick={() =>
                          navigate(`/manager/bills/${bill.id}`, {
                            state: {
                              order: bill,
                              restaurant: restaurantProfile,
                              invoice: buildInvoiceData({
                                order: bill,
                                restaurant: restaurantProfile,
                                cashierName: bill.billing?.cashierName || user?.name || user?.email || 'Manager',
                              }),
                              returnTo: '/manager/bills',
                              cashierName: bill.billing?.cashierName || user?.name || user?.email || 'Manager',
                            },
                          })
                        }
                      >
                        <Receipt className="h-4 w-4" />
                        Print Bill
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Modal title={selectedBill ? `Approve discount for ${formatDisplayOrderNumber(selectedBill)}` : 'Approve discount'} isOpen={Boolean(selectedBill)} onClose={() => setSelectedBill(null)} maxWidth="max-w-lg">
        <div className="space-y-4">
          <Input label={`Discount percent (max ${DISCOUNT_LIMIT_PERCENT})`} type="number" min="0" max={DISCOUNT_LIMIT_PERCENT} value={discountPercent} onChange={(event) => setDiscountPercent(event.target.value)} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Manager note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="input min-h-[110px] resize-y" placeholder="Reason for discount approval." />
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" onClick={() => setSelectedBill(null)}>Cancel</Button>
            <Button className="w-full sm:flex-1" onClick={submitApproval}>Approve</Button>
          </div>
        </div>
      </Modal>

      <Modal title={payingBill ? `Close ${formatDisplayOrderNumber(payingBill)}` : 'Close bill'} isOpen={Boolean(payingBill)} onClose={() => setPayingBill(null)} maxWidth="max-w-lg">
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--color-surface-muted)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Bill total</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(payingBill?.totalAmount || payingBill?.total || 0)}</p>
          </div>
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Payment method</span>
            <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="input">
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
            </select>
          </label>
          <Input label="Amount received" type="number" value={amountReceived} onChange={(event) => setAmountReceived(event.target.value)} />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Payment note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} className="input min-h-[110px] resize-y" placeholder="Optional bill close note." />
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" onClick={() => setPayingBill(null)}>Cancel</Button>
            <Button className="w-full sm:flex-1" onClick={markBillPaid} disabled={actioningBillId === payingBill?.id}>
              <Wallet className="h-4 w-4" />
              {actioningBillId === payingBill?.id ? 'Closing...' : 'Close Bill / Mark Paid'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
