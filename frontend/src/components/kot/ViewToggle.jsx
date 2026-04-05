const VIEWS = [
  { id: 'order', label: 'Order View' },
  { id: 'item', label: 'Item View' },
];

export default function ViewToggle({ activeView, onChange }) {
  return (
    <div className="inline-flex w-full rounded-[1.1rem] border border-[var(--border-color)] bg-[var(--color-surface)] p-1 shadow-[var(--shadow-card)] sm:w-auto sm:rounded-[1.25rem]">
      {VIEWS.map((view) => {
        const isActive = activeView === view.id;

        return (
          <button
            key={view.id}
            type="button"
            onClick={() => onChange(view.id)}
            className={`min-h-[3rem] flex-1 rounded-[0.9rem] px-4 text-sm font-bold transition sm:min-h-[3.25rem] sm:rounded-[1rem] sm:px-5 sm:text-base ${
              isActive
                ? 'bg-[linear-gradient(135deg,var(--color-primary),var(--color-accent))] text-white shadow-[var(--shadow-card)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-card-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {view.label}
          </button>
        );
      })}
    </div>
  );
}
