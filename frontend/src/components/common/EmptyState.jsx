export default function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-14 text-center shadow-[var(--shadow-card)]">
      {Icon ? (
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
          <Icon className="h-6 w-6" />
        </div>
      ) : null}
      <h3 className="mt-4 text-xl font-semibold text-[var(--color-text)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[var(--color-text-muted)]">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
