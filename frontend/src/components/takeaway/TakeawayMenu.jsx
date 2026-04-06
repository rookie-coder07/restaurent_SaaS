import { useTakeawayCart } from '../../store/takeawayCartStore';

export default function TakeawayMenu() {
  const { categories, activeCategoryId, setActiveCategory, items, addItem } = useTakeawayCart();
  const visibleItems = items.filter(
    (item) => activeCategoryId === 'all' || item.categoryId === activeCategoryId
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`px-4 py-2 rounded-2xl text-sm font-semibold ${
              activeCategoryId === cat.id
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-800'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visibleItems.map((item) => (
          <button
            key={item.id}
            onClick={() => addItem(item)}
            className="h-28 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm hover:border-slate-400"
          >
            <p className="text-base font-semibold">{item.name}</p>
            {item.description ? (
              <p className="mt-1 text-xs text-slate-500 line-clamp-2">{item.description}</p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">Touch to add</p>
            )}
            <p className="mt-3 text-lg font-bold">₹{Number(item.price || 0).toFixed(2)}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
