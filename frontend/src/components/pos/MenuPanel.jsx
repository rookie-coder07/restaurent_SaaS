import { memo } from 'react';
import { Plus } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

function MenuPanel({
  categories,
  activeCategoryId,
  onCategoryChange,
  onAddItem,
  onIncreaseItem,
  onDecreaseItem,
  getItemQuantity,
  searchValue = '',
  onSearchChange = null,
  loading,
  error,
}) {
  if (loading) {
    return (
      <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-5 shadow-[var(--shadow-card)]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 9 }).map((_, index) => (
            <div
              key={index}
              className="h-32 animate-pulse rounded-[1.5rem] bg-[var(--bg-card-muted)]"
            />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-[2rem] border border-rose-500/20 bg-rose-500/5 p-5 text-sm text-rose-200">
        {error}
      </section>
    );
  }

  return (
    <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-4 shadow-[var(--shadow-card)] sm:p-5">
      {onSearchChange ? (
        <div className="mb-4">
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search menu items..."
            className="min-h-[3.5rem] w-full rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
          />
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2">
        {categories.map((category) => {
          const isActive = category.id === activeCategoryId;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className={`min-h-[3.25rem] rounded-2xl px-4 text-sm font-semibold transition ${
                isActive
                  ? 'bg-[var(--color-primary)] text-white shadow-lg'
                  : 'bg-[var(--bg-card-muted)] text-[var(--text-secondary)] hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)]'
              }`}
            >
              {category.name}
            </button>
          );
        })}
      </div>

      {(categories.find((category) => category.id === activeCategoryId)?.items || []).length === 0 ? (
        <div className="flex min-h-[14rem] items-center justify-center rounded-[1.6rem] border border-dashed border-[var(--border-color)] bg-[var(--bg-card-muted)] p-6 text-center">
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">No menu items found</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Try another category or search term.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {(categories.find((category) => category.id === activeCategoryId)?.items || []).map((item) => {
            const quantity = getItemQuantity(item.id);

            return (
              <div
                key={item.id}
                className="flex min-h-[8.5rem] flex-col justify-between rounded-[1.6rem] border border-[var(--border-color)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] p-4 transition hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]"
              >
                <button type="button" onClick={() => onAddItem(item)} className="text-left">
                  <p className="line-clamp-2 text-base font-semibold text-[var(--text-primary)]">{item.name}</p>
                  {item.description ? (
                    <p className="mt-2 line-clamp-2 text-xs text-[var(--text-secondary)]">{item.description}</p>
                  ) : null}
                </button>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <span className="text-lg font-bold text-[var(--text-primary)]">{formatCurrency(item.price)}</span>

                  {quantity > 0 ? (
                    <div className="flex items-center gap-2 rounded-2xl bg-[var(--bg-card)] p-1">
                      <button
                        type="button"
                        onClick={() => onDecreaseItem(item.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--bg-card-muted)] text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
                        aria-label={`Decrease ${item.name}`}
                      >
                        -
                      </button>
                      <span className="min-w-[2rem] text-center text-base font-bold text-[var(--text-primary)]">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onIncreaseItem(item.id)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white transition hover:opacity-95"
                        aria-label={`Increase ${item.name}`}
                      >
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onAddItem(item)}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white"
                      aria-label={`Add ${item.name}`}
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default memo(MenuPanel);
