export default function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={`glass-panel w-full rounded-[var(--radius-card)] text-[var(--text-primary)] transition-shadow duration-200 hover:shadow-[var(--shadow-floating)] ${padded ? 'p-4 sm:p-5' : 'p-0'} ${className}`}
    >
      {children}
    </div>
  );
}
