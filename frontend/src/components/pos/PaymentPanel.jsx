import { memo } from 'react';
import { formatCurrency } from '../../utils/formatters';

const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash', helper: 'Enter cash received and the system will calculate change.' },
  { id: 'upi', label: 'UPI', helper: 'Confirm payment from your existing QR or UPI app before settling.' },
];

function PaymentPanel({
  paymentMethod,
  onPaymentMethodChange,
  totalAmount,
  orderType,
  cashReceived,
  onCashReceivedChange,
  changeDue,
  shortfallAmount,
  paymentNote,
  onPaymentNoteChange,
  packingCharge,
  onPackingChargeChange,
  deliveryCharge,
  onDeliveryChargeChange,
  invoicePreview,
  activeOrder,
  loyaltyPhone,
  onLoyaltyPhoneChange,
  loyaltyProfile,
  redeemPoints,
  onRedeemPointsChange,
  onCheckLoyalty,
  checkingLoyalty = false,
  disabled = false,
}) {
  const numericTotal = Number(totalAmount || 0);
  const hasCashReceived = String(cashReceived || '').trim() !== '';

  return (
    <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Payment</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Settlement Mode</h2>
        </div>
        <div className="rounded-2xl bg-[var(--bg-card-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">
          {formatCurrency(numericTotal)}
        </div>
      </div>

      {activeOrder ? (
        <div className="mt-4 rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          <p className="font-semibold text-[var(--text-primary)]">Open bill status: {activeOrder.status}</p>
          <p className="mt-1">Payment status: {activeOrder.paymentStatus || 'pending'}</p>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-2">
        {PAYMENT_METHODS.map((option) => {
          const isActive = option.id === paymentMethod;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => onPaymentMethodChange(option.id)}
              className={`rounded-2xl border px-4 py-4 text-left transition ${
                isActive
                  ? 'border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--text-primary)]'
                  : 'border-[var(--border-color)] bg-[var(--bg-card-muted)] text-[var(--text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)]'
              } disabled:cursor-not-allowed disabled:opacity-60`}
            >
              <p className="text-sm font-bold uppercase tracking-[0.14em]">{option.label}</p>
              <p className="mt-2 text-xs leading-5">{option.helper}</p>
            </button>
          );
        })}
      </div>

      {paymentMethod === 'cash' ? (
        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-[var(--text-primary)]">Cash received</p>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onCashReceivedChange(numericTotal > 0 ? String(numericTotal.toFixed(2)) : '')}
              className="rounded-full bg-[var(--bg-card-muted)] px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Use Exact
            </button>
          </div>

          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            value={cashReceived}
            onChange={(event) => onCashReceivedChange(event.target.value)}
            placeholder="0.00"
            disabled={disabled}
            className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-base font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />

          <div className="rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm">
            {!hasCashReceived ? (
              <p className="text-[var(--text-secondary)]">Enter the amount received to calculate the change.</p>
            ) : shortfallAmount > 0 ? (
              <p className="font-semibold text-rose-300">Still need {formatCurrency(shortfallAmount)} more to settle this bill.</p>
            ) : changeDue > 0 ? (
              <p className="font-semibold text-emerald-300">Return change: {formatCurrency(changeDue)}</p>
            ) : (
              <p className="font-semibold text-emerald-300">Exact cash received. No change due.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-4 text-sm leading-6 text-[var(--text-secondary)]">
          Confirm the customer has completed the UPI transfer, then settle the bill here. This works cleanly with your
          existing static QR flow and keeps reporting accurate in the POS.
        </div>
      )}

      {invoicePreview ? (
        <div className="mt-5 rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
          <p className="text-sm font-semibold text-[var(--text-primary)]">Invoice Summary</p>
          <div className="mt-3 space-y-2 text-sm text-[var(--text-secondary)]">
            <div className="flex items-center justify-between"><span>Taxable Amount</span><span>{formatCurrency(invoicePreview.taxableAmount)}</span></div>
            <div className="flex items-center justify-between"><span>CGST ({invoicePreview.cgstRate}%)</span><span>{formatCurrency(invoicePreview.cgstAmount)}</span></div>
            <div className="flex items-center justify-between"><span>SGST ({invoicePreview.sgstRate}%)</span><span>{formatCurrency(invoicePreview.sgstAmount)}</span></div>
            {invoicePreview.chargesTotal > 0 ? (
              <div className="flex items-center justify-between"><span>Extra Charges</span><span>{formatCurrency(invoicePreview.chargesTotal)}</span></div>
            ) : null}
            {invoicePreview.loyaltyRedeemedAmount > 0 ? (
              <div className="flex items-center justify-between"><span>Loyalty</span><span>-{formatCurrency(invoicePreview.loyaltyRedeemedAmount)}</span></div>
            ) : null}
            <div className="flex items-center justify-between font-semibold text-[var(--text-primary)]"><span>Round Off</span><span>{formatCurrency(invoicePreview.roundOff)}</span></div>
          </div>
        </div>
      ) : null}

      <label className="mt-5 block space-y-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">Loyalty Phone</span>
        <div className="flex gap-2">
          <input
            type="tel"
            inputMode="numeric"
            value={loyaltyPhone}
            onChange={(event) => onLoyaltyPhoneChange(event.target.value)}
            placeholder="Customer phone for points"
            disabled={disabled}
            className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
          <button
            type="button"
            onClick={onCheckLoyalty}
            disabled={disabled || checkingLoyalty || String(loyaltyPhone || '').trim().length < 10}
            className="min-h-[3.5rem] shrink-0 rounded-2xl bg-[var(--color-primary)] px-4 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {checkingLoyalty ? 'Checking...' : 'Check'}
          </button>
        </div>
      </label>

      {loyaltyProfile?.customerPhone ? (
        <div className="mt-4 rounded-[1.4rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
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
              onChange={(event) => onRedeemPointsChange(event.target.value)}
              placeholder="0"
              disabled={disabled}
              className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="text-xs text-[var(--text-secondary)]">
              1 point = {formatCurrency(1)} discount. Earn 1 point for every {formatCurrency(100)} spent.
            </p>
          </label>
        </div>
      ) : null}

      <label className="mt-5 block space-y-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">Payment Note</span>
        <textarea
          value={paymentNote}
          onChange={(event) => onPaymentNoteChange(event.target.value)}
          placeholder={paymentMethod === 'cash' ? 'Optional note like customer gave a larger note.' : 'Optional note like UPI confirmed by waiter.'}
          disabled={disabled}
          className="min-h-[96px] w-full resize-y rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
    </section>
  );
}

export default memo(PaymentPanel);
