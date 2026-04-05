import { Minus, Plus, ShoppingCart, Trash2, X } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

export default function CartDrawer({
  isOpen,
  items,
  total,
  isPlacingOrder,
  onClose,
  onClearCart,
  onUpdateQuantity,
  onPlaceOrder,
}) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <button
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45"
      />

      <div className="absolute inset-x-0 bottom-0 max-h-[85vh] rounded-t-3xl border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-primary)] shadow-2xl md:inset-y-0 md:right-0 md:left-auto md:w-[28rem] md:max-h-none md:rounded-none md:rounded-l-3xl">
        <div className="flex items-center justify-between border-b border-[var(--border-color)] px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--text-secondary)]">Your Order</p>
            <h2 className="mt-1 text-xl font-bold text-[var(--text-primary)]">Cart</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex h-[calc(85vh-81px)] flex-col md:h-full">
          <div className="flex-1 overflow-y-auto px-5 py-4">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-center">
                <div className="rounded-full bg-[var(--bg-card-muted)] p-4">
                  <ShoppingCart className="h-8 w-8 text-[var(--text-secondary)]" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">Your cart is empty</h3>
                <p className="mt-2 max-w-xs text-sm text-[var(--text-secondary)]">
                  Add a few dishes from the menu and they will appear here instantly.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4">
                    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold text-[var(--text-primary)]">{item.name}</h3>
                        <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatCurrency(item.price)} each</p>
                      </div>
                      <p className="shrink-0 text-sm font-semibold text-[var(--text-primary)]">
                        {formatCurrency(item.price * item.quantity)}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex items-center rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)]">
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity - 1)}
                          className="rounded-full p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]"
                        >
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-10 text-center text-sm font-semibold text-[var(--text-primary)]">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          className="rounded-full p-2 text-[var(--text-secondary)] transition hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>

                      <button
                        onClick={() => onUpdateQuantity(item.id, 0)}
                        className="inline-flex items-center justify-center gap-2 text-sm font-medium text-[var(--color-danger)] transition hover:brightness-90 sm:justify-start"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--border-color)] bg-[var(--bg-panel)] px-5 py-4">
            <div className="mb-4 flex items-center justify-between text-sm text-[var(--text-secondary)]">
              <span>Total</span>
              <span className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(total)}</span>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={onClearCart}
                disabled={items.length === 0 || isPlacingOrder}
                className="flex-1 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--bg-card-muted)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear Cart
              </button>
              <button
                onClick={onPlaceOrder}
                disabled={items.length === 0 || isPlacingOrder}
                className="flex-1 rounded-xl bg-emerald-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-emerald-300"
              >
                {isPlacingOrder ? 'Placing...' : 'Place Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
