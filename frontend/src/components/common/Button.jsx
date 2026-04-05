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
    'inline-flex min-h-[2.875rem] items-center justify-center gap-2 rounded-[var(--radius-control)] font-semibold transition-[background-color,color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60';

  const variantClassName = {
    primary:
      'bg-[var(--color-primary)] text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)] hover:brightness-95',
    secondary:
      'border border-[var(--border-color)] bg-[var(--bg-panel)] text-[var(--text-primary)] backdrop-blur-md hover:bg-[var(--bg-card-muted)]',
    ghost:
      'text-[var(--text-secondary)] hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]',
    danger:
      'bg-[#dc2626] text-white shadow-[0_10px_24px_rgba(220,38,38,0.18)] hover:brightness-95',
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
