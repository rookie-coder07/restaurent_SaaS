export const defaultSortOptions = [
  { label: 'Name (A -> Z)', value: 'nameAsc' },
  { label: 'Name (Z -> A)', value: 'nameDesc' },
  { label: 'Price (Low -> High)', value: 'priceLowHigh' },
  { label: 'Price (High -> Low)', value: 'priceHighLow' },
  { label: 'Recently Added', value: 'recent' },
];

export default function SortDropdown({ value, onChange, options = defaultSortOptions }) {
  return (
    <label className="block w-full md:w-56">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-[var(--text-secondary)]">
        Sort By
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-soft)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
