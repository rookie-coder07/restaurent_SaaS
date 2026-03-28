export default function KOTLayout({ children }) {
  return (
    <div className="min-h-screen bg-[var(--bg-main)] text-[var(--text-primary)]">
      <main className="min-h-screen overflow-x-hidden">
        <div className="px-3 py-3 sm:px-4 sm:py-4 lg:px-5 lg:py-5">{children}</div>
      </main>
    </div>
  );
}
