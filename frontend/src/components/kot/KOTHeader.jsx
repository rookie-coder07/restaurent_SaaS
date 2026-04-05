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
    <section className="rounded-[1.5rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-4 shadow-[var(--shadow-card)] sm:rounded-[2rem] sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--color-primary-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--color-primary)]">
            <ChefHat className="h-4 w-4" />
            KOT Screen
          </div>
          <h1 className="mt-3 text-2xl font-black tracking-tight text-[var(--text-primary)] sm:mt-4 sm:text-4xl">Kitchen Order Tickets</h1>
          <p className="mt-2 hidden text-sm text-[var(--text-secondary)] sm:block sm:text-base">
            Fast, readable, action-first KOT flow for pending, preparing, and ready orders.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:gap-3 sm:grid-cols-4">
          <div className="rounded-[1.2rem] border border-[var(--border-color)] bg-[var(--color-panel)] px-3 py-3 sm:rounded-[1.5rem] sm:px-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--text-secondary)]">Total</p>
            <p className="mt-1 text-2xl font-black text-[var(--text-primary)] sm:mt-2 sm:text-3xl">{totalCount}</p>
          </div>
          <div className="rounded-[1.2rem] border border-amber-500/25 bg-amber-500/10 px-3 py-3 sm:rounded-[1.5rem] sm:px-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-amber-600 dark:text-amber-300">Pending</p>
            <p className="mt-1 text-2xl font-black text-[var(--text-primary)] sm:mt-2 sm:text-3xl">{pendingCount}</p>
          </div>
          <div className="rounded-[1.2rem] border border-sky-500/25 bg-sky-500/10 px-3 py-3 sm:rounded-[1.5rem] sm:px-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">Preparing</p>
            <p className="mt-1 text-2xl font-black text-[var(--text-primary)] sm:mt-2 sm:text-3xl">{preparingCount}</p>
          </div>
          <button
            type="button"
            onClick={onRefresh}
            className="rounded-[1.2rem] border border-emerald-500/25 bg-emerald-500/10 px-3 py-3 text-left transition hover:bg-emerald-500/15 sm:rounded-[1.5rem] sm:px-4"
          >
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </div>
            <p className="mt-1 text-sm font-bold text-[var(--text-primary)] sm:mt-2">{lastUpdatedLabel}</p>
            <p className="mt-1 text-xs text-[var(--text-secondary)]">Ready: {readyCount}</p>
          </button>
        </div>
      </div>
    </section>
  );
}
