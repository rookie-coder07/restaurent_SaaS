import { ShoppingCart } from 'lucide-react';

export default function FloatingCartButton({ itemCount, onClick }) {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-24 right-4 z-40 flex items-center gap-3 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:scale-[1.02] hover:bg-black md:bottom-6"
    >
      <span className="relative">
        <ShoppingCart className="h-5 w-5" />
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-400 px-1 text-[10px] font-bold text-gray-900">
          {itemCount}
        </span>
      </span>
      <span>{itemCount} {itemCount === 1 ? 'Item' : 'Items'}</span>
    </button>
  );
}
