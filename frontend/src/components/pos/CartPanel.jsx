import { memo } from 'react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

function CartPanel({
  items,
  subtotal,
  discountAmount,
  finalTotal,
  invoicePreview,
  onIncrease,
  onDecrease,
  onRemove,
  onSubmit,
  onSendToKitchen,
  onSettle,
  onCancel,
  onEditDetails,
  isSubmitting,
  isSendingToKitchen = false,
  isSettling = false,
  isCancelling = false,
  error,
  success,
  submitLabel = 'PAY & CREATE ORDER',
  sendToKitchenLabel = 'SEND TO KITCHEN',
  settleLabel = 'SETTLE BILL',
  cancelLabel = 'CANCEL BILL',
  isSubmitDisabled = false,
  isSendToKitchenDisabled = false,
  isSettleDisabled = false,
  isCancelDisabled = false,
  billingMessage = '',
  kitchenMessage = '',
}) {
  return (
    <section className="flex h-full flex-col rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Cart</p>
          <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Current Bill</h2>
        </div>
        <div className="rounded-2xl bg-[var(--bg-card-muted)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]">
          {items.length} items
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <div className="flex h-full min-h-[16rem] items-center justify-center rounded-[1.6rem] border border-dashed border-[var(--border-color)] bg-[var(--bg-card-muted)] p-6 text-center">
            <div>
              <p className="text-base font-semibold text-[var(--text-primary)]">No items yet</p>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">Tap menu items on the left to start billing.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[var(--text-primary)]">{item.name}</p>
                    <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatCurrency(item.price)} each</p>
                    {item.itemNote ? (
                      <p className="mt-2 text-sm font-medium text-amber-300">Note: {item.itemNote}</p>
                    ) : null}
                    {item.modifiers?.length ? (
                      <p className="mt-1 text-sm font-medium text-sky-200">Modifiers: {item.modifiers.join(', ')}</p>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2">
                    {onEditDetails ? (
                      <button
                        type="button"
                        onClick={() => onEditDetails(item.id)}
                        className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
                      >
                        Details
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => onRemove(item.id)}
                      className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onDecrease(item.id)}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-card)] text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <div className="min-w-[3.5rem] rounded-2xl bg-[var(--bg-card)] px-4 py-3 text-center text-base font-bold text-[var(--text-primary)]">
                      {item.qty}
                    </div>
                    <button
                      type="button"
                      onClick={() => onIncrease(item.id)}
                      className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white transition hover:opacity-95"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>

                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {formatCurrency(item.price * item.qty)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 border-t border-[var(--border-color)] pt-4">
        {error ? (
          <p className="mb-3 rounded-2xl bg-rose-500/10 px-4 py-3 text-sm font-medium text-rose-200">{error}</p>
        ) : null}
        {success ? (
          <p className="mb-3 rounded-2xl bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200">{success}</p>
        ) : null}

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span>Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-[var(--text-secondary)]">
            <span>Discount</span>
            <span>-{formatCurrency(discountAmount)}</span>
          </div>
          <div className="flex items-center justify-between text-lg font-bold text-[var(--text-primary)]">
            <span>Item Total</span>
            <span>{formatCurrency(finalTotal)}</span>
          </div>
          {invoicePreview ? (
            <>
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>CGST</span>
                <span>{formatCurrency(invoicePreview.cgstAmount)}</span>
              </div>
              <div className="flex items-center justify-between text-[var(--text-secondary)]">
                <span>SGST</span>
                <span>{formatCurrency(invoicePreview.sgstAmount)}</span>
              </div>
              {invoicePreview.chargesTotal > 0 ? (
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span>Extra Charges</span>
                  <span>{formatCurrency(invoicePreview.chargesTotal)}</span>
                </div>
              ) : null}
              {invoicePreview.loyaltyRedeemedAmount > 0 ? (
                <div className="flex items-center justify-between text-[var(--text-secondary)]">
                  <span>Loyalty</span>
                  <span>-{formatCurrency(invoicePreview.loyaltyRedeemedAmount)}</span>
                </div>
              ) : null}
              <div className="flex items-center justify-between text-lg font-bold text-[var(--text-primary)]">
                <span>Final Amount</span>
                <span>{formatCurrency(invoicePreview.grandTotal)}</span>
              </div>
            </>
          ) : null}
        </div>

        <div className="mt-4 space-y-3">
          {billingMessage ? (
            <div className="rounded-[1.3rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-3 text-sm font-medium text-[var(--text-secondary)]">
              {billingMessage}
            </div>
          ) : null}
          {kitchenMessage ? (
            <div className="rounded-[1.3rem] border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-200">
              {kitchenMessage}
            </div>
          ) : null}
          <div className={`grid gap-3 ${onSettle ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
            <button
              type="button"
              onClick={onSubmit}
              disabled={items.length === 0 || isSubmitting || isSendingToKitchen || isSettling || isCancelling || isSubmitDisabled}
              className="min-h-[4rem] w-full rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-base font-bold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : submitLabel}
            </button>

            {onSendToKitchen ? (
              <button
                type="button"
                onClick={onSendToKitchen}
                disabled={items.length === 0 || isSubmitting || isSendingToKitchen || isSettling || isCancelling || isSendToKitchenDisabled}
                className="min-h-[4rem] w-full rounded-[1.6rem] bg-amber-400 px-4 text-base font-bold text-slate-950 shadow-lg transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSendingToKitchen ? 'Sending...' : sendToKitchenLabel}
              </button>
            ) : null}

            {onSettle ? (
              <button
                type="button"
                onClick={onSettle}
                disabled={items.length === 0 || isSubmitting || isSendingToKitchen || isSettling || isCancelling || isSettleDisabled}
                className="min-h-[4rem] w-full rounded-[1.6rem] bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] px-4 text-base font-bold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSettling ? 'Settling...' : settleLabel}
              </button>
            ) : null}
          </div>

          {onCancel ? (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting || isSettling || isCancelling || isCancelDisabled}
              className="min-h-[3.5rem] w-full rounded-[1.3rem] border border-rose-500/30 bg-rose-500/10 px-4 text-sm font-bold uppercase tracking-[0.12em] text-rose-300 transition hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCancelling ? 'Cancelling...' : cancelLabel}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default memo(CartPanel);
