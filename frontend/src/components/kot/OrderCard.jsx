import { memo } from 'react';
import { BellRing, Eye, Loader, Printer, RotateCcw } from 'lucide-react';
import { formatCompactTableLabel, formatShortDisplayOrderNumber } from '../../utils/formatters';

const STATUS_STYLES = {
  pending: {
    badge: 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30',
    border: 'border-amber-500/25',
    action: 'Start Preparing',
    actionClass: 'bg-amber-400 text-slate-950 hover:bg-amber-300',
    stripe: 'from-amber-400/25 to-transparent',
  },
  preparing: {
    badge: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30',
    border: 'border-sky-500/25',
    action: 'Mark Ready',
    actionClass: 'bg-sky-400 text-slate-950 hover:bg-sky-300',
    stripe: 'from-sky-400/25 to-transparent',
  },
  ready: {
    badge: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
    border: 'border-emerald-500/25',
    action: 'Mark Served',
    actionClass: 'bg-emerald-400 text-slate-950 hover:bg-emerald-300',
    stripe: 'from-emerald-400/25 to-transparent',
  },
};

const AGE_STYLES = {
  fresh: {
    chip: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
    card: '',
  },
  warning: {
    chip: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/30',
    card: 'ring-1 ring-amber-500/20',
  },
  critical: {
    chip: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30',
    card: 'ring-2 ring-rose-500/25',
  },
};

const ACTION_BADGES = {
  add: 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  update: 'bg-amber-500/12 text-amber-700 dark:text-amber-300 border-amber-500/20',
  remove: 'bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/20',
  refire: 'bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/20',
};

function OrderCard({
  ticket,
  elapsedLabel,
  onAdvanceStatus,
  onReprint,
  onRefire,
  onViewDetails,
  isUpdating,
  isPrinting = false,
  laneLabel,
  ageTone = 'fresh',
  isNewTicket = false,
}) {
  const style = STATUS_STYLES[ticket.status] || STATUS_STYLES.pending;
  const ageStyle = AGE_STYLES[ageTone] || AGE_STYLES.fresh;
  const compactTableLabel = ticket.tableNumber ? formatCompactTableLabel(ticket.tableNumber, '') : '';

  return (
    <article className={`overflow-hidden rounded-[1.9rem] border bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${style.border} ${ageStyle.card}`}>
      <div className={`h-2 bg-gradient-to-r ${style.stripe}`} />
      <div className="p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[var(--text-tertiary)]">{laneLabel}</p>
            {isNewTicket ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[var(--color-primary)]/25 bg-[var(--color-primary-soft)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--color-primary)]">
                <BellRing className="h-3.5 w-3.5" />
                New
              </span>
            ) : null}
            <span className="inline-flex rounded-full border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-2 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-[var(--text-secondary)]">
              {ticket.type || 'send'}
            </span>
          </div>
          <h2 className="mt-2 break-words text-lg font-black text-[var(--text-primary)] sm:text-2xl">{formatShortDisplayOrderNumber(ticket)}</h2>
          <p className="mt-1 text-base font-bold text-[var(--text-primary)] sm:mt-2 sm:text-lg">
            {ticket.tableNumber ? `Table ${ticket.tableNumber} ${compactTableLabel}` : 'Walk-in / No Table'}
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--text-secondary)]">{ticket.summary || 'Kitchen action'}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:block sm:text-right">
          <span className={`inline-flex rounded-full border px-3 py-1 text-sm font-bold ${style.badge}`}>
            {ticket.status}
          </span>
          <div className={`inline-flex rounded-full border px-3 py-1 text-sm font-semibold sm:mt-3 ${ageStyle.chip}`}>
            {elapsedLabel}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[1.25rem] border border-[var(--border-color)] bg-[var(--color-panel)] p-3 sm:mt-5 sm:rounded-[1.5rem] sm:p-4">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[var(--text-tertiary)]">Items</p>
        <div className="mt-3 space-y-2.5 sm:space-y-3">
          {(ticket.items || []).map((item, index) => (
            <div key={`${ticket.id}-${item.menuItemId || item.id || index}`} className="rounded-[1rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-3 sm:rounded-[1.25rem]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="break-words text-base font-bold text-[var(--text-primary)] sm:text-xl">{item.name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary)]">{item.station || 'Main Kitchen'}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-bold uppercase tracking-[0.12em] ${ACTION_BADGES[item.action] || ACTION_BADGES.add}`}>
                  {item.action || 'add'}
                </span>
              </div>

              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="inline-flex w-fit rounded-2xl bg-[var(--bg-card-muted)] px-3 py-2 text-xl font-black text-[var(--color-primary)] sm:text-2xl">
                  {item.quantity || item.qty}x
                </span>
                {item.modifiers?.length ? (
                  <span className="text-sm font-semibold text-[var(--text-secondary)] sm:text-right">{item.modifiers.join(', ')}</span>
                ) : null}
              </div>
              {item.note ? <p className="mt-2 text-sm font-medium text-[var(--text-secondary)]">Note: {item.note}</p> : null}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:mt-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            onClick={() => onViewDetails?.(ticket)}
            disabled={isUpdating || isPrinting}
            className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-[1.2rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-bold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Eye className="h-4 w-4" />
            Details
          </button>
          <button
            type="button"
            onClick={() => onReprint(ticket)}
            disabled={isUpdating || isPrinting}
            className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-[1.2rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-bold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPrinting ? <Loader className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
            {isPrinting ? 'Printing...' : 'Reprint'}
          </button>
          <button
            type="button"
            onClick={() => onRefire(ticket)}
            disabled={isUpdating || isPrinting}
            className="flex min-h-[3.25rem] w-full items-center justify-center gap-2 rounded-[1.2rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] px-4 text-sm font-bold text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            Re-Fire
          </button>
        </div>

        <button
          type="button"
          onClick={() => onAdvanceStatus(ticket)}
          disabled={isUpdating || isPrinting}
          className={`flex min-h-[3.5rem] w-full items-center justify-center gap-3 rounded-[1.2rem] px-4 text-base font-black transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[3.9rem] sm:rounded-[1.4rem] sm:text-lg ${style.actionClass}`}
        >
          {isUpdating ? <Loader className="h-5 w-5 animate-spin" /> : null}
          {isUpdating ? 'Updating...' : style.action}
        </button>
      </div>
      </div>
    </article>
  );
}

export default memo(OrderCard);
