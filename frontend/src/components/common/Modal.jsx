import { X } from 'lucide-react';

export default function Modal({ title, children, isOpen, onClose, maxWidth = 'max-w-2xl' }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-950/72 backdrop-blur-[2px] p-3 sm:items-center sm:justify-center sm:p-4">
      <button type="button" aria-label="Close modal" onClick={onClose} className="absolute inset-0" />

      <div
        className={`relative max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-[1.4rem] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-[0_28px_80px_rgba(15,23,42,0.36)]`}
      >
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-panel)]/98 px-4 py-4 backdrop-blur sm:px-5">
          <h2 className="min-w-0 break-words text-lg font-bold text-[var(--color-text)] sm:text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-transparent p-2 text-[var(--color-text-muted)] transition hover:border-[var(--color-border)] hover:bg-[var(--color-panel-muted)] hover:text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/25"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-5">{children}</div>
      </div>
    </div>
  );
}
