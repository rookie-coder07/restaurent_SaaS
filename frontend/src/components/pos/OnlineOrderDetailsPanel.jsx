import { memo } from 'react';

const SOURCE_OPTIONS = [
  { id: 'direct', label: 'Direct' },
  { id: 'phone', label: 'Phone' },
  { id: 'website', label: 'Website' },
  { id: 'swiggy', label: 'Swiggy' },
  { id: 'zomato', label: 'Zomato' },
];

const PAYMENT_STATE_OPTIONS = [
  { id: 'pending', label: 'Pending' },
  { id: 'paid', label: 'Paid' },
  { id: 'cash_on_delivery', label: 'COD' },
  { id: 'failed', label: 'Failed' },
  { id: 'refunded', label: 'Refunded' },
];

function OnlineOrderDetailsPanel({
  orderType,
  source,
  promisedAt,
  paymentState,
  customerName,
  customerPhone,
  customerAddress,
  channelOrderId,
  onSourceChange,
  onPromisedAtChange,
  onPaymentStateChange,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onCustomerAddressChange,
  onChannelOrderIdChange,
  disabled = false,
}) {
  if (!orderType || orderType === 'dine-in') {
    return null;
  }

  return (
    <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Online Order</p>
        <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Channel Intake</h2>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Enter the source manually for now. This is the same shape future Swiggy, Zomato, or website integrations can populate.
        </p>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">Order Source</span>
          <select
            value={source}
            onChange={(event) => onSourceChange(event.target.value)}
            disabled={disabled}
            className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {SOURCE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">Promised Time</span>
          <input
            type="datetime-local"
            value={promisedAt}
            onChange={(event) => onPromisedAtChange(event.target.value)}
            disabled={disabled}
            className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">Channel Payment State</span>
          <select
            value={paymentState}
            onChange={(event) => onPaymentStateChange(event.target.value)}
            disabled={disabled}
            className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {PAYMENT_STATE_OPTIONS.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">Channel Order ID</span>
          <input
            value={channelOrderId}
            onChange={(event) => onChannelOrderIdChange(event.target.value)}
            placeholder="Optional channel reference"
            disabled={disabled}
            className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">Customer Name</span>
          <input
            value={customerName}
            onChange={(event) => onCustomerNameChange(event.target.value)}
            placeholder="Name"
            disabled={disabled}
            className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">Customer Phone</span>
          <input
            value={customerPhone}
            onChange={(event) => onCustomerPhoneChange(event.target.value)}
            placeholder="Phone number"
            disabled={disabled}
            className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      <label className="mt-4 block space-y-2">
        <span className="text-sm font-medium text-[var(--text-primary)]">Customer Address / Pickup Note</span>
        <textarea
          value={customerAddress}
          onChange={(event) => onCustomerAddressChange(event.target.value)}
          placeholder={orderType === 'delivery' ? 'Delivery address and landmark' : 'Pickup note or customer instruction'}
          disabled={disabled}
          className="min-h-[110px] w-full resize-y rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        />
      </label>
    </section>
  );
}

export default memo(OnlineOrderDetailsPanel);
