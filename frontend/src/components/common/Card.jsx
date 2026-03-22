export default function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={`glass-panel w-full rounded-xl text-[var(--text-primary)] transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.015] ${padded ? 'p-4' : 'p-0'} ${className}`}
    >
      {children}
    </div>
  );
}
