export default function Input({ label, className = '', ...props }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-[var(--text-primary)]">{label}</span> : null}
      <input
        className={`w-full rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none backdrop-blur-md transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)] ${className}`}
        {...props}
      />
    </label>
  );
}
