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
    <section className="box-border rounded-[2rem] border border-[var(--border-color)] bg-[var(--bg-card)] p-2 shadow-[var(--shadow-card)] sm:p-3">
      {onSearchChange ? (
        <div className="mb-2 px-1 sm:mb-3">
          <input
            type="search"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search menu items..."
            className="min-h-[2.75rem] w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-3 text-sm font-medium text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)]"
          />
        </div>
      ) : null}

      <div className="mb-2 flex flex-wrap gap-2 px-1 sm:mb-3">
        {categories.map((category) => {
          const isActive = category.id === activeCategoryId;
          return (
            <button
              key={category.renderKey || category.id}
              type="button"
              onClick={() => onCategoryChange(category.id)}
              className={`min-h-[2.25rem] flex-shrink-0 rounded-xl px-3 py-1 text-xs font-semibold transition ${
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
        <div className="flex min-h-[12rem] items-center justify-center rounded-[1.2rem] border border-dashed border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4 text-center">
          <div>
            <p className="text-base font-semibold text-[var(--text-primary)]">No menu items found</p>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">Try another category or search term.</p>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-22rem)] overflow-y-auto overflow-x-hidden pr-1 sm:h-[calc(100vh-21rem)] xl:h-[calc(100vh-18rem)]">
          <div className="grid grid-cols-2 gap-2 px-1 sm:grid-cols-2 lg:grid-cols-3">
            {(categories.find((category) => category.id === activeCategoryId)?.items || []).map((item) => {
              const quantity = getItemQuantity(item.id);
              const isSelected = quantity > 0;

              return (
                <div
                  key={item.id}
                  className={`relative aspect-square flex w-full flex-col justify-between overflow-hidden rounded-[1rem] border-2 transition ${
                    isSelected
                      ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/20'
                      : 'border-[var(--border-color)] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(255,255,255,0.02))] hover:border-[var(--color-primary)] hover:bg-[var(--color-primary-soft)]'
                  } box-border p-2`}
                  role="article"
                >
                  <button type="button" onClick={() => onAddItem(item)} className="min-w-0 flex-1 text-left">
                    <div className="min-w-0 overflow-hidden text-sm">
                      <h3 className="line-clamp-2 text-xs font-semibold text-[var(--text-primary)]">
                        {item.name}
                      </h3>
                      <p className="mt-1 truncate text-xs font-semibold text-[var(--text-secondary)]">
                        {formatCurrency(item.price)}
                      </p>
                    </div>
                  </button>

                  <div className="mt-auto flex shrink-0 items-center justify-center gap-0.5 pt-1">
                    {quantity > 0 ? (
                      <div className="inline-flex shrink-0 items-center gap-0.5 rounded-lg bg-emerald-600/20 px-1 py-0.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDecreaseItem(item.id);
                          }}
                          className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-[var(--bg-card-muted)] text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
                          aria-label={`Decrease ${item.name}`}
                        >
                          −
                        </button>
                        <span className="w-4 flex-shrink-0 text-center text-xs font-bold text-emerald-400">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onIncreaseItem(item.id);
                          }}
                          className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white transition hover:bg-emerald-500"
                          aria-label={`Increase ${item.name}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onAddItem(item);
                        }}
                        className="inline-flex h-6 flex-shrink-0 items-center justify-center rounded-md bg-emerald-600 px-1.5 py-0.5 text-xs font-bold text-white transition hover:bg-emerald-500"
                        aria-label={`Add ${item.name}`}
                      >
                        +
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}

export default memo(MenuPanel);
