import Card from './Card';

export default function StatCard({ icon: Icon, label, value, subtitle, iconTone = 'bg-blue-50 text-[#2563eb]' }) {
  return (
    <Card className="relative w-full overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-r from-[var(--color-primary-soft)] via-transparent to-cyan-400/10 opacity-80" />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-3 break-words text-xl font-semibold text-[var(--color-text)] sm:text-2xl">{value}</p>
          {subtitle ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl shadow-sm ${iconTone}`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
