import Card from './Card';

export default function StatCard({ icon: Icon, label, value, subtitle, iconTone = 'bg-blue-50 text-[#2563eb]' }) {
  return (
    <Card className="w-full">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-[var(--color-text-muted)]">{label}</p>
          <p className="mt-3 break-words text-xl font-semibold text-[var(--color-text)] sm:text-2xl">{value}</p>
          {subtitle ? <p className="mt-2 text-sm text-[var(--color-text-muted)]">{subtitle}</p> : null}
        </div>
        {Icon ? (
          <div className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>
            <Icon className="h-5 w-5" />
          </div>
        ) : null}
      </div>
    </Card>
  );
}
