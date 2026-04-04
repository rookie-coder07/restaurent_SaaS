import { X } from 'lucide-react';

export default function Modal({ title, children, isOpen, onClose, maxWidth = 'max-w-2xl' }) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/50 p-3 sm:items-center sm:justify-center sm:p-4">
      <button type="button" aria-label="Close modal" onClick={onClose} className="absolute inset-0" />

      <div className={`relative max-h-[90vh] w-full ${maxWidth} overflow-y-auto rounded-[1.75rem] border border-[var(--color-border)] bg-[var(--color-panel)] shadow-2xl`}>
        <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-[var(--color-border)] bg-[var(--color-panel)] px-4 py-4 sm:px-5">
          <h2 className="min-w-0 break-words text-lg font-bold text-[var(--color-text)] sm:text-xl">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-[var(--color-text-muted)] transition hover:bg-[var(--color-panel-muted)] hover:text-[var(--color-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 sm:p-5 lg:p-6">{children}</div>
      </div>
    </div>
  );
}
