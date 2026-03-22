export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  fullWidth = false,
  type = 'button',
  ...props
}) {
  const baseClassName =
    'inline-flex items-center justify-center gap-2 rounded-2xl font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60';

  const variantClassName = {
    primary:
      'bg-[var(--color-primary)] text-white shadow-[0_12px_30px_rgba(79,70,229,0.18)] hover:brightness-95 active:translate-y-px',
    secondary:
      'border border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-muted)]',
    ghost:
      'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]',
    danger:
      'bg-[#dc2626] text-white shadow-[0_12px_30px_rgba(220,38,38,0.16)] hover:brightness-95',
  }[variant];

  const sizeClassName = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2.5 text-sm',
    lg: 'px-5 py-3 text-base',
  }[size];

  return (
    <button
      type={type}
      className={`${baseClassName} ${variantClassName} ${sizeClassName} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
