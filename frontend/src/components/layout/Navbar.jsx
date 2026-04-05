import { Menu } from 'lucide-react';

export default function Navbar({ pageTitle, onMenuClick }) {
  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border-color)] bg-[var(--bg-panel)] shadow-[var(--shadow-card)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onMenuClick}
            className="inline-flex min-h-[2.75rem] rounded-[var(--radius-control)] border border-[var(--border-color)] bg-[var(--bg-panel-muted)] px-3 py-2 text-[var(--text-secondary)] transition hover:bg-[var(--color-primary-soft)] hover:text-[var(--text-primary)] lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="min-w-0">
            <h1 className="break-words text-lg font-bold text-[var(--text-primary)] md:text-2xl">{pageTitle}</h1>
          </div>
        </div>
      </div>
    </header>
  );
}
