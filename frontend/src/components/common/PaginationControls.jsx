import Button from './Button';

export default function PaginationControls({
  currentPage,
  totalPages,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
}) {
  if (!totalPages || totalPages <= 1) {
    return null;
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] p-3 shadow-[var(--shadow-card)]">
      <Button variant="secondary" onClick={onPrevious} disabled={!canGoPrevious} className="min-w-[7rem]">
        Previous
      </Button>
      <p className="text-center text-sm font-semibold text-[var(--text-primary)]">
        Page {currentPage} of {totalPages}
      </p>
      <Button onClick={onNext} disabled={!canGoNext} className="min-w-[7rem]">
        Next
      </Button>
    </div>
  );
}
