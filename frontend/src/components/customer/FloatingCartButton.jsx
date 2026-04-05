import { ShoppingCart } from 'lucide-react';

export default function FloatingCartButton({ itemCount, onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-4 z-40 flex items-center gap-3 rounded-full border border-[var(--border-color)] bg-[var(--bg-panel)] px-4 py-3 text-sm font-semibold text-[var(--text-primary)] shadow-lg transition hover:scale-[1.02] hover:bg-[var(--bg-card)] sm:px-5 md:bottom-6"
    >
      <span className="relative">
        <ShoppingCart className="h-5 w-5" />
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--color-success)] px-1 text-[10px] font-bold text-white">
          {itemCount}
        </span>
      </span>
      <span className="whitespace-nowrap">{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</span>
    </button>
  );
}
