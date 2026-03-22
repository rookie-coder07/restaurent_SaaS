export default function ResponsiveGrid({ children, className = '' }) {
  return <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 ${className}`}>{children}</div>;
}
