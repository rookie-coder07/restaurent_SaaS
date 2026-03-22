export default function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={`rounded-[1.5rem] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${padded ? 'p-5 sm:p-6' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
