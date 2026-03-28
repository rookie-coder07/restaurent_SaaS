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
  cashReceived,
  onCashReceivedChange,
  changeDue,
  shortfallAmount,
  paymentNote,
  onPaymentNoteChange,
  activeOrder,
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
          <p className="mt-1">Payment status: {activeOrder.paymentStatus || 'unpaid'}</p>
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
