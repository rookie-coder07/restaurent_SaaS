import { BadgePercent, BellRing, Loader, Receipt, RefreshCw, Wallet } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApi } from '../hooks/useApi';
import useAutoRefresh from '../hooks/useAutoRefresh';
import { orderAPI, restaurantAPI } from '../services/apiEndpoints';
import { useAuthStore } from '../context/authStore';
import { useManagerStore } from '../context/managerStore';
import { formatCurrency, formatDate, formatDisplayOrderNumber } from '../utils/formatters';
import { buildInvoiceData, calculateInvoiceSummary, getRestaurantBillingSettings } from '../utils/invoice';
import { isUnpaid } from '../utils/managerPortal';
import { playLoudBuzzer } from '../utils/alerts';
import { autoPrintBill } from '../utils/printerService';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Input from '../components/common/Input';
import Modal from '../components/common/Modal';
import Toast from '../components/common/Toast';

function getBillSummary(order) {
  const billing = order?.billing || order?.settlement?.billing || {};
  const settlement = order?.settlement || {};
  const grandTotal = Number(
    billing.grandTotal ??
    settlement.finalTotal ??
    order?.totalAmount ??
    order?.total ??
    0
  );
  const paidAmount = Number(
    billing.paidAmount ??
    settlement.amountReceived ??
    (String(order?.paymentStatus || '').toLowerCase() === 'paid' ? grandTotal : 0)
  );

  return {
    grandTotal,
    paidAmount,
    dueAmount: Math.max(0, Number((grandTotal - Math.min(grandTotal, paidAmount)).toFixed(2))),
    paymentMethod: String(billing.paymentMode || order?.paymentMethod || 'cash').toLowerCase(),
    paymentStatus: String(order?.paymentStatus || 'unpaid').toLowerCase(),
  };
}

export default function ManagerBills() {
  const navigate = useNavigate();
  const { data: ordersData = {}, loading, execute: reloadOrders, refetch: refetchOrders } = useApi(() =>
    orderAPI.getOrders({ limit: 150 })
  );
  const { data: restaurantProfile = {}, refetch: refetchProfile } = useApi(restaurantAPI.getProfile);
  const user = useAuthStore((state) => state.user);
  const approvedDiscounts = useManagerStore((state) => state.approvedDiscounts);
  const approveDiscount = useManagerStore((state) => state.approveDiscount);
  const [selectedBill, setSelectedBill] = useState(null);
  const [payingBill, setPayingBill] = useState(null);
  const [discountPercent, setDiscountPercent] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amountReceived, setAmountReceived] = useState('');
  const [loyaltyPhone, setLoyaltyPhone] = useState('');
  const [loyaltyProfile, setLoyaltyProfile] = useState(null);
  const [redeemPoints, setRedeemPoints] = useState('');
  const [isCheckingLoyalty, setIsCheckingLoyalty] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [managerAlertMessage, setManagerAlertMessage] = useState('');
  const [actioningBillId, setActioningBillId] = useState('');
  const hasPrimedAlertsRef = useRef(false);
  const previousUnpaidIdsRef = useRef(new Set());

  useAutoRefresh(() => Promise.allSettled([refetchOrders(), refetchProfile()]), 12000);

  const fetchFreshBill = async (bill) => {
    if (!bill?.id) {
      return bill;
    }

    const response = await orderAPI.getOrder(bill.id);
    return response.data?.data || bill;
  };

  const bills = useMemo(
    () => (ordersData?.items || []).filter((order) => order?.status !== 'cancelled'),
    [ordersData?.items]
  );
  const unpaidBills = useMemo(() => bills.filter(isUnpaid), [bills]);
  const pendingAmount = useMemo(
    () => unpaidBills.reduce((sum, order) => sum + getBillSummary(order).dueAmount, 0),
    [unpaidBills]
  );
  const orderedBills = useMemo(
    () =>
      [...bills].sort((left, right) => {
        const leftUnpaid = isUnpaid(left) ? 0 : 1;
        const rightUnpaid = isUnpaid(right) ? 0 : 1;
        if (leftUnpaid !== rightUnpaid) {
          return leftUnpaid - rightUnpaid;
        }

        return new Date(right?.createdAt || 0) - new Date(left?.createdAt || 0);
      }),
    [bills]
  );
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
  const activeBillSummary = getBillSummary(payingBill);
  const activeApproval = payingBill?.approvedDiscount || (payingBill?.id ? approvedDiscounts[payingBill.id] : null);
  const activeBilling = payingBill?.billing || payingBill?.settlement?.billing || {};
  const subtotalFromItems = useMemo(
    () =>
      Number(
        ((payingBill?.items || []).reduce(
          (sum, item) => sum + Number(item.quantity || item.qty || 0) * Number(item.unitPrice ?? item.price ?? 0),
          0
        )).toFixed(2)
      ),
    [payingBill]
  );
  const previewSubtotal = Number(activeBilling.subtotal || subtotalFromItems || 0);
  const previewOrderDiscountAmount = Math.max(
    0,
    Number(
      (
        activeBilling.orderDiscountAmount ??
        Math.max(0, previewSubtotal - Number(payingBill?.totalAmount || payingBill?.total || 0))
      ).toFixed(2)
    )
  );
  const numericServiceCharge = Math.max(0, Number(restaurantProfile?.defaultServiceCharge || 0));
  const restaurantBillingSettings = useMemo(
    () => getRestaurantBillingSettings(restaurantProfile),
    [restaurantProfile]
  );
  const previewSummaryBeforeLoyalty = useMemo(
    () =>
      calculateInvoiceSummary({
        subtotal: previewSubtotal,
        orderDiscountAmount: previewOrderDiscountAmount,
        managerDiscountPercent: activeApproval?.percent || 0,
        loyaltyRedeemedAmount: 0,
        packingCharge: Number(activeBilling.packingCharge || 0),
        serviceCharge: numericServiceCharge,
        deliveryCharge: Number(activeBilling.deliveryCharge || 0),
        cgstRate: restaurantBillingSettings.cgstRate,
        sgstRate: restaurantBillingSettings.sgstRate,
      }),
    [activeApproval?.percent, activeBilling.deliveryCharge, activeBilling.packingCharge, numericServiceCharge, previewOrderDiscountAmount, previewSubtotal, restaurantBillingSettings]
  );
  const numericAmountReceived = Number(amountReceived || 0);
  const loyaltyRedeemPreview = useMemo(() => {
    const requestedPoints = Math.max(0, Math.floor(Number(redeemPoints || 0)));
    const availablePoints = Math.max(0, Number(loyaltyProfile?.pointsBalance || 0));
    return Math.min(requestedPoints, availablePoints, Math.floor(previewSummaryBeforeLoyalty.grandTotal));
  }, [loyaltyProfile?.pointsBalance, previewSummaryBeforeLoyalty.grandTotal, redeemPoints]);
  const previewSummary = useMemo(
    () =>
      calculateInvoiceSummary({
        subtotal: previewSubtotal,
        orderDiscountAmount: previewOrderDiscountAmount,
        managerDiscountPercent: activeApproval?.percent || 0,
        loyaltyRedeemedAmount: loyaltyRedeemPreview,
        packingCharge: Number(activeBilling.packingCharge || 0),
        serviceCharge: numericServiceCharge,
        deliveryCharge: Number(activeBilling.deliveryCharge || 0),
        cgstRate: restaurantBillingSettings.cgstRate,
        sgstRate: restaurantBillingSettings.sgstRate,
      }),
    [activeApproval?.percent, activeBilling.deliveryCharge, activeBilling.packingCharge, loyaltyRedeemPreview, numericServiceCharge, previewOrderDiscountAmount, previewSubtotal, restaurantBillingSettings]
  );
  const billTotalWithServiceCharge = previewSummaryBeforeLoyalty.grandTotal;
  const payableAfterLoyalty = previewSummary.grandTotal;
  const paymentGap = Math.max(0, Number((payableAfterLoyalty - numericAmountReceived).toFixed(2)));
  const changeDue = Math.max(0, Number((numericAmountReceived - payableAfterLoyalty).toFixed(2)));

  useEffect(() => {
    const refreshManagerBills = () => {
      Promise.allSettled([refetchOrders(), refetchProfile()]).catch(() => {
        // Page-level error state already exists.
      });
    };

    const intervalId = window.setInterval(refreshManagerBills, 10000);
    return () => window.clearInterval(intervalId);
  }, [refetchOrders, refetchProfile]);

  useEffect(() => {
    const nextUnpaidIds = new Set(unpaidBills.map((bill) => bill.id).filter(Boolean));

    if (!hasPrimedAlertsRef.current) {
      previousUnpaidIdsRef.current = nextUnpaidIds;
      hasPrimedAlertsRef.current = true;
      return;
    }

    const freshBills = unpaidBills.filter((bill) => bill.id && !previousUnpaidIdsRef.current.has(bill.id));
    previousUnpaidIdsRef.current = nextUnpaidIds;

    if (freshBills.length > 0) {
      playLoudBuzzer('manager');
      setManagerAlertMessage(
        freshBills.length > 1
          ? `${freshBills.length} new bills need manager payment.`
          : `${formatDisplayOrderNumber(freshBills[0])} needs manager payment.`
      );
    }
  }, [unpaidBills]);

  useEffect(() => {
    if (!payingBill) {
      return;
    }

    const freshSummary = getBillSummary(payingBill);
    setAmountReceived(String(freshSummary.grandTotal));
    setLoyaltyPhone('');
    setLoyaltyProfile(null);
    setRedeemPoints('');
  }, [payingBill, paymentMethod]);

  const handleCheckLoyalty = async () => {
    const phoneToCheck = String(loyaltyPhone || '').trim();
    if (phoneToCheck.length < 10) {
      setError('Enter a valid customer phone number to check loyalty points.');
      return;
    }

    setIsCheckingLoyalty(true);
    setError('');

    try {
      const response = await orderAPI.getLoyaltyProfile(phoneToCheck);
      const profile = response.data?.data || null;
      setLoyaltyProfile(profile);
      setRedeemPoints('');
      setSuccess(
        profile?.customerPhone
          ? `Loyalty balance loaded for ${profile.customerPhone}.`
          : 'No loyalty history found for this number yet.'
      );
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load loyalty points.');
    } finally {
      setIsCheckingLoyalty(false);
    }
  };

  const submitApproval = () => {
    const percent = Number(discountPercent);
    if (!selectedBill) {
      return;
    }

    if (!percent || percent <= 0) {
      setError('Enter a valid discount percent.');
      return;
    }

    setError('');
    setActioningBillId(selectedBill.id);

    orderAPI.approveDiscount(selectedBill.id, {
      percent,
      note,
    })
      .then(async () => {
        approveDiscount({
          orderId: selectedBill.id,
          percent,
          note,
          approvedBy: user?.name || user?.email || 'Manager',
        });
        await reloadOrders();
        setSuccess(`Discount approved for ${formatDisplayOrderNumber(selectedBill)}.`);
        setSelectedBill(null);
        setDiscountPercent('');
        setNote('');
      })
      .catch((requestError) => {
        setError(requestError.response?.data?.message || 'Failed to approve discount.');
      })
      .finally(() => {
        setActioningBillId('');
      });
  };

  const markBillPaid = async () => {
    if (!payingBill?.id) {
      return;
    }

    const approval = payingBill?.approvedDiscount || approvedDiscounts[payingBill.id];
    setActioningBillId(payingBill.id);
    setError('');

    try {
      const freshBill = await fetchFreshBill(payingBill);
      const receivedAmount = Number(amountReceived || payableAfterLoyalty || 0);

      await orderAPI.settleOrder(payingBill.id, {
        paymentMethod,
        amountReceived: receivedAmount,
        discountPercent: approval?.percent || undefined,
        paymentNote: [approval?.note, note.trim()].filter(Boolean).join(' | '),
        loyaltyPhone: loyaltyPhone.trim(),
        redeemPoints: loyaltyRedeemPreview,
        serviceCharge: numericServiceCharge,
      });

      const refreshedOrder = await orderAPI.getOrder(payingBill.id);
      const settledBill = refreshedOrder.data?.data;
      const invoiceData = buildInvoiceData({
        order: settledBill,
        restaurant: restaurantProfile,
        cashierName: user?.name || user?.email || 'Manager',
      });
      let autoPrintError = '';

      try {
        const printResult = await autoPrintBill({
          order: settledBill,
          restaurant: restaurantProfile,
          invoice: invoiceData,
          cashierName: user?.name || user?.email || 'Manager',
        });
        if (printResult?.fallback && printResult?.error) {
          autoPrintError = 'Billing printer was unavailable, so browser print opened instead.';
        }
      } catch (printError) {
        autoPrintError = printError.message || 'Auto-print failed. Use Print Bill manually.';
      }

      setSuccess(
        approval?.percent
          ? `${formatDisplayOrderNumber(payingBill)} settled with ${approval.percent}% discount.`
          : `${formatDisplayOrderNumber(payingBill)} settled successfully.`
      );
      setPayingBill(null);
      setAmountReceived('');
      setLoyaltyPhone('');
      setLoyaltyProfile(null);
      setRedeemPoints('');
      setNote('');
      await reloadOrders();
      navigate(`/manager/bills/${settledBill?.id || payingBill.id}`, {
        state: {
          order: settledBill,
          restaurant: restaurantProfile,
          invoice: invoiceData,
          returnTo: '/manager/bills',
          cashierName: user?.name || user?.email || 'Manager',
          autoPrintError,
        },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to settle the bill.');
    } finally {
      setActioningBillId('');
    }
  };

  const openPayBill = async (bill) => {
    setActioningBillId(bill.id);
    setError('');

    try {
      const freshBill = await fetchFreshBill(bill);
      const summary = getBillSummary(freshBill);
      setPayingBill(freshBill);
      setPaymentMethod(summary.paymentMethod || 'cash');
      setAmountReceived(String(summary.grandTotal));
      setLoyaltyPhone('');
      setLoyaltyProfile(null);
      setRedeemPoints('');
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load the latest bill.');
    } finally {
      setActioningBillId('');
    }
  };

  const openPrintedBill = async (bill) => {
    setActioningBillId(bill.id);
    setError('');

    try {
      const freshBill = await fetchFreshBill(bill);
      navigate(`/manager/bills/${freshBill.id}`, {
        state: {
          order: freshBill,
          restaurant: restaurantProfile,
          invoice: buildInvoiceData({
            order: freshBill,
            restaurant: restaurantProfile,
            cashierName: freshBill.billing?.cashierName || user?.name || user?.email || 'Manager',
          }),
          returnTo: '/manager/bills',
          cashierName: freshBill.billing?.cashierName || user?.name || user?.email || 'Manager',
        },
      });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Failed to load the latest bill details.');
    } finally {
      setActioningBillId('');
    }
  };

  if (loading && bills.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader className="h-8 w-8 animate-spin text-[var(--color-primary)]" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {managerAlertMessage ? (
        <Toast type="warning" message={managerAlertMessage} onClose={() => setManagerAlertMessage('')} autoDismissMs={6500} />
      ) : null}
      {success ? <Toast type="success" message={success} onClose={() => setSuccess('')} /> : null}
      {error ? <Toast type="error" message={error} onClose={() => setError('')} /> : null}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">All bills</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{bills.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Need action</p>
          <p className="mt-2 text-3xl font-bold text-amber-400">{unpaidBills.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Pending amount</p>
          <p className="mt-2 text-3xl font-bold text-[var(--text-primary)]">{formatCurrency(pendingAmount)}</p>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.92fr,1.08fr]">
        <Card className="p-5">
          <p className="text-sm text-[var(--text-secondary)]">Live bill per table</p>
          <h2 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Table billing view</h2>
          <div className="mt-4 space-y-3">
            {billsByTable.map(([tableNumber, tableBills]) => {
              const tablePending = tableBills.reduce((sum, bill) => sum + getBillSummary(bill).dueAmount, 0);
              return (
                <div key={String(tableNumber)} className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-[var(--text-primary)]">Table {tableNumber}</p>
                    <p className="text-sm text-[var(--text-secondary)]">{tableBills.length} bill(s)</p>
                  </div>
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.18em] text-[var(--text-secondary)]">Pending</p>
                      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(tablePending)}</p>
                    </div>
                    <p className="text-sm text-[var(--text-secondary)]">
                      {tableBills.filter(isUnpaid).length} unpaid
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-card)] border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-3">
              <BellRing className="mt-0.5 h-5 w-5 text-[var(--color-primary)]" />
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Manager billing queue</p>
                <p className="text-sm text-[var(--text-secondary)]">Unpaid bills stay first. Paid bills stay ready for print.</p>
              </div>
            </div>
            <Button variant="secondary" onClick={() => Promise.allSettled([reloadOrders(), refetchProfile()])}>
              <RefreshCw className="h-4 w-4" />
              Refresh
            </Button>
          </div>

          {orderedBills.map((bill) => {
            const approval = bill?.approvedDiscount || approvedDiscounts[bill.id];
            const summary = getBillSummary(bill);
            const unpaid = isUnpaid(bill);

            return (
              <Card key={bill.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-3 rounded-[1.4rem] bg-[var(--bg-card-muted)] p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{formatDisplayOrderNumber(bill)}</p>
                      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${unpaid ? 'bg-amber-400/15 text-amber-300' : 'bg-emerald-500/15 text-emerald-300'}`}>
                        {unpaid ? 'Unpaid' : 'Settled'}
                      </span>
                    </div>
                    <p className="mt-2 text-base font-semibold text-[var(--text-primary)]">Table {bill.tableNumber || 'Walk-in'}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatDate(bill.createdAt)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:min-w-[17rem]">
                    <div className="rounded-2xl bg-[var(--bg-card)] px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">Bill Total</p>
                      <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(summary.grandTotal)}</p>
                    </div>
                    <div className="rounded-2xl bg-[var(--bg-card)] px-3 py-3">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                        {unpaid ? 'Due Now' : 'Paid Amount'}
                      </p>
                      <p className={`mt-1 text-lg font-bold ${unpaid ? 'text-amber-300' : 'text-emerald-300'}`}>
                        {formatCurrency(unpaid ? summary.dueAmount : summary.paidAmount)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid gap-3 lg:grid-cols-[1fr,auto]">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Payment</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {(summary.paymentMethod || 'cash').toUpperCase()} • {summary.paymentStatus}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Discount</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {approval ? `${approval.percent}% approved` : 'No discount approved'}
                      </p>
                      {approval?.approvedBy ? (
                        <p className="mt-1 text-xs text-[var(--text-secondary)]">By {approval.approvedBy}</p>
                      ) : null}
                    </div>
                    <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Status</p>
                      <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">
                        {unpaid ? 'Awaiting manager payment' : 'Ready to print'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setSelectedBill(bill)}>
                      <BadgePercent className="h-4 w-4" />
                      Approve Discount
                    </Button>
                    {unpaid ? (
                      <Button onClick={() => openPayBill(bill)} disabled={actioningBillId === bill.id}>
                        <Wallet className="h-4 w-4" />
                        {actioningBillId === bill.id ? 'Loading...' : 'Settle Bill'}
                      </Button>
                    ) : (
                      <Button variant="secondary" onClick={() => openPrintedBill(bill)} disabled={actioningBillId === bill.id}>
                        <Receipt className="h-4 w-4" />
                        {actioningBillId === bill.id ? 'Loading...' : 'Print Bill'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <Modal
        title={selectedBill ? `Approve discount for ${formatDisplayOrderNumber(selectedBill)}` : 'Approve discount'}
        isOpen={Boolean(selectedBill)}
        onClose={() => setSelectedBill(null)}
        maxWidth="max-w-lg"
      >
        <div className="space-y-4">
          <Input
            label="Discount percent"
            type="number"
            min="0"
            value={discountPercent}
            onChange={(event) => setDiscountPercent(event.target.value)}
          />
          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Manager note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="input min-h-[110px] resize-y"
              placeholder="Reason for discount approval."
            />
          </label>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" onClick={() => setSelectedBill(null)}>
              Cancel
            </Button>
            <Button className="w-full sm:flex-1" onClick={submitApproval} disabled={actioningBillId === selectedBill?.id}>
              {actioningBillId === selectedBill?.id ? 'Approving...' : 'Approve'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        title={payingBill ? `Settle ${formatDisplayOrderNumber(payingBill)}` : 'Settle bill'}
        isOpen={Boolean(payingBill)}
        onClose={() => setPayingBill(null)}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4">
          <div className="rounded-2xl bg-[var(--bg-card-muted)] p-4">
            <p className="text-sm text-[var(--text-secondary)]">Bill total</p>
            <p className="mt-2 text-2xl font-bold text-[var(--text-primary)]">{formatCurrency(billTotalWithServiceCharge)}</p>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Table {payingBill?.tableNumber || 'Walk-in'} • {formatDate(payingBill?.createdAt)}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-[var(--text-primary)]">Payment method</span>
              <select value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)} className="input">
                <option value="cash">Cash</option>
                <option value="upi">UPI</option>
              </select>
            </label>
            <Input
              label={paymentMethod === 'cash' ? 'Amount received' : 'Paid amount'}
              type="number"
              value={amountReceived}
              onChange={(event) => setAmountReceived(event.target.value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Bill Total</p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(billTotalWithServiceCharge)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">Paid Amount</p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">{formatCurrency(numericAmountReceived)}</p>
            </div>
            <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
                {paymentMethod === 'cash' ? 'Change Due' : 'Balance'}
              </p>
              <p className={`mt-1 text-lg font-bold ${paymentGap > 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                {formatCurrency(paymentMethod === 'cash' ? changeDue : paymentGap)}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[var(--text-primary)]">Loyalty</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">Check customer points and redeem them before settling.</p>
              </div>
              <div className="rounded-xl bg-[var(--bg-card-muted)] px-3 py-2 text-sm font-semibold text-[var(--text-primary)]">
                Payable {formatCurrency(payableAfterLoyalty)}
              </div>
            </div>

            {numericServiceCharge > 0 ? (
              <div className="mt-4 rounded-xl bg-[var(--bg-card-muted)] px-3 py-2 text-sm font-medium text-[var(--text-primary)]">
                Service charge from settings: {formatCurrency(numericServiceCharge)}
              </div>
            ) : null}

            <div className="mt-4 flex gap-2">
              <input
                type="tel"
                inputMode="numeric"
                value={loyaltyPhone}
                onChange={(event) => setLoyaltyPhone(event.target.value)}
                placeholder="Customer phone for points"
                className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
              />
              <button
                type="button"
                onClick={handleCheckLoyalty}
                disabled={isCheckingLoyalty || String(loyaltyPhone || '').trim().length < 10}
                className="min-h-[3.5rem] shrink-0 rounded-2xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCheckingLoyalty ? 'Checking...' : 'Check'}
              </button>
            </div>

            {loyaltyProfile?.customerPhone ? (
              <div className="mt-4 rounded-2xl bg-[var(--bg-card-muted)] p-4">
                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <p className="text-[var(--text-secondary)]">Points Balance</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{loyaltyProfile.pointsBalance}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)]">Visits</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{loyaltyProfile.visitCount}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)]">Earned</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{loyaltyProfile.totalEarnedPoints}</p>
                  </div>
                  <div>
                    <p className="text-[var(--text-secondary)]">Redeemed</p>
                    <p className="mt-1 font-bold text-[var(--text-primary)]">{loyaltyProfile.totalRedeemedPoints}</p>
                  </div>
                </div>

                <label className="mt-4 block space-y-2">
                  <span className="text-sm font-medium text-[var(--text-primary)]">Redeem Points</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={redeemPoints}
                    onChange={(event) => setRedeemPoints(event.target.value)}
                    placeholder="0"
                    className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--text-secondary)]">
                    <span>1 point = {formatCurrency(1)} discount</span>
                    <span>Redeeming now: {formatCurrency(loyaltyRedeemPreview)}</span>
                  </div>
                </label>
              </div>
            ) : null}
          </div>

          {paymentMethod === 'cash' && paymentGap > 0 ? (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm font-medium text-amber-200">
              Collect {formatCurrency(paymentGap)} more before settling this bill.
            </div>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-[var(--text-primary)]">Payment note</span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="input min-h-[110px] resize-y"
              placeholder="Optional payment note."
            />
          </label>

          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Button variant="secondary" className="w-full sm:flex-1" onClick={() => setPayingBill(null)}>
              Cancel
            </Button>
            <Button
              className="w-full sm:flex-1"
              onClick={markBillPaid}
              disabled={actioningBillId === payingBill?.id || (paymentMethod === 'cash' && paymentGap > 0)}
            >
              <Wallet className="h-4 w-4" />
              {actioningBillId === payingBill?.id ? 'Settling...' : 'Settle Bill'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
