import { memo } from 'react';

const ORDER_TYPES = [
  { id: 'dine-in', label: 'Dine-In' },
];

const DISCOUNT_TYPES = [
  { id: 'flat', label: 'Flat' },
  { id: 'percent', label: '%' },
];

function OrderControls({
  orderType,
  onOrderTypeChange,
  selectedTable,
  selectedTableId,
  onChangeTable,
  discountType,
  onDiscountTypeChange,
  discountValue,
  onDiscountValueChange,
  canManageBilling = true,
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Order Type</p>
        <div className="mt-3 grid grid-cols-1 gap-2">
          {ORDER_TYPES.map((option) => {
            const isActive = option.id === orderType;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => onOrderTypeChange(option.id)}
                className={`min-h-[3.5rem] rounded-2xl px-3 text-sm font-semibold transition ${
                  isActive
                    ? 'bg-[var(--color-primary)] text-white shadow-lg'
                    : 'bg-[var(--bg-card-muted)] text-[var(--text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)]'
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Selected Table</p>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-4">
          <div>
            <p className="text-sm text-[var(--text-secondary)]">Serving</p>
            <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
              {selectedTableId ? `Table ${selectedTable?.tableNumber || ''}` : 'No table selected'}
            </p>
          </div>

          <button
            type="button"
            onClick={onChangeTable}
            className="rounded-2xl bg-[var(--bg-card)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
          >
            Change
          </button>
        </div>
      </div>

      {canManageBilling ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Discount</p>
          <div className="mt-3 grid grid-cols-[118px,1fr] gap-2">
            <div className="grid grid-cols-2 gap-2">
              {DISCOUNT_TYPES.map((option) => {
                const isActive = option.id === discountType;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => onDiscountTypeChange(option.id)}
                    className={`min-h-[3.5rem] rounded-2xl text-sm font-semibold transition ${
                      isActive
                        ? 'bg-[var(--color-primary)] text-white shadow-lg'
                        : 'bg-[var(--bg-card-muted)] text-[var(--text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              value={discountValue}
              onChange={(event) => onDiscountValueChange(event.target.value)}
              placeholder="0.00"
              className="min-h-[3.5rem] rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-base font-semibold text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
            />
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 py-4 text-sm font-medium text-[var(--text-secondary)]">
          Billing will be handled by manager.
        </div>
      )}
    </section>
  );
}

export default memo(OrderControls);
