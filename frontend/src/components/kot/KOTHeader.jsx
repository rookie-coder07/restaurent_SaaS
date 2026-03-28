import { RefreshCw, ChefHat } from 'lucide-react';

export default function KOTHeader({
  totalCount,
  pendingCount,
  preparingCount,
  readyCount,
  lastUpdatedLabel,
  isRefreshing,
  onRefresh,
}) {
  return (
    <section className="rounded-[2rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
            <ChefHat className="h-4 w-4" />
            KOT Screen
          </div>
          <h1 className="mt-4 text-3xl font-black tracking-tight text-[var(--text-primary)] sm:text-4xl">Kitchen Order Tickets</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)] sm:text-base">
            Fast, readable, action-first KOT flow for pending, preparing, and ready orders.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-[1.5rem] border border-[var(--border-color)] bg-[var(--color-panel)] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Total</p>
            <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">{totalCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">Pending</p>
            <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">{pendingCount}</p>
          </div>
          <div className="rounded-[1.5rem] border border-sky-500/25 bg-sky-500/10 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">Preparing</p>
            <p className="mt-2 text-3xl font-black text-[var(--text-primary)]">{preparingCount}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-[1.5rem] border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-left transition hover:bg-emerald-500/15"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </div>
            <p className="mt-2 text-sm font-bold text-[var(--text-primary)]">{lastUpdatedLabel}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Ready: {readyCount}</p>
          </button>
        </div>
      </div>
    </section>
  );
}
