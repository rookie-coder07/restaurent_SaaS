import Card from './Card';

export default function StatCard({ icon: Icon, label, value, subtitle, tone = 'primary' }) {
  const toneClassName = {
    primary: 'bg-[color:var(--color-primary-soft)] text-[var(--color-primary)]',
    success: 'bg-emerald-100 text-emerald-600',
    warning: 'bg-amber-100 text-amber-600',
    neutral: 'bg-slate-100 text-slate-600',
  }[tone];

  return (
    <Card className="overflow-hidden">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-3 break-words text-3xl font-bold text-[var(--color-text)]">{value}</p>
          {subtitle ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <div className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl ${toneClassName}`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
