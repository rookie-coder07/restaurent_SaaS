export default function Input({ label, className = '', ...props }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-[var(--color-text)]">{label}</span> : null}
      <input
        className={`w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)] ${className}`}
        {...props}
      />
    </label>
  );
}
