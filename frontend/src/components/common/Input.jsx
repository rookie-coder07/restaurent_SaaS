export default function Input({ label, className = '', ...props }) {
  return (
    <label className="block space-y-2">
      {label ? <span className="text-sm font-medium text-[var(--color-text)]">{label}</span> : null}
      <input
        className={`w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-[var(--color-text)] outline-none backdrop-blur-md transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)] ${className}`}
        {...props}
      />
    </label>
  );
}
