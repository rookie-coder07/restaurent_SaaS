export default function Card({ children, className = '', padded = true }) {
  return (
    <div
      className={`w-full rounded-xl border border-white/10 bg-white/5 backdrop-blur-md shadow-sm transition-all duration-200 hover:scale-[1.02] ${padded ? 'p-4' : 'p-0'} ${className}`}
    >
      {children}
    </div>
  );
}
