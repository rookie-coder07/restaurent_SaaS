/**
 * VirtualList Component - Efficient rendering of large lists
 * Only renders visible items by calculating viewport height
 */

import { memo, useCallback, useMemo, useRef } from 'react';
import { calculateVisibleRange } from '../../utils/virtualScroller';

const ITEM_HEIGHT = 240; // Height of each cart item in px

function VirtualListItem({ item, isVisible, onIncrease, onDecrease, onRemove, onEditDetails, formatCurrency }) {
  if (!isVisible) {
    return <div style={{ height: ITEM_HEIGHT }} />;
  }

  return (
    <div className="rounded-[1.6rem] border border-[var(--border-color)] bg-[var(--bg-card-muted)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-[var(--text-primary)]">{item.name}</p>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">{formatCurrency(item.price)} each</p>
          {item.itemNote ? (
            <p className="mt-2 text-sm font-medium text-amber-300">Note: {item.itemNote}</p>
          ) : null}
          {item.modifiers?.length ? (
            <p className="mt-1 text-sm font-medium text-sky-200">Modifiers: {item.modifiers.join(', ')}</p>
          ) : null}
        </div>

        <div className="flex flex-col gap-2">
          {onEditDetails ? (
            <button
              type="button"
              onClick={() => onEditDetails(item.id)}
              className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
            >
              Details
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-300 transition hover:bg-rose-500/20"
            aria-label={`Remove ${item.name}`}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onDecrease(item.id)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--bg-card)] text-[var(--text-primary)] transition hover:bg-[var(--color-primary-soft)]"
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="min-w-[3.5rem] rounded-2xl bg-[var(--bg-card)] px-4 py-3 text-center text-base font-bold text-[var(--text-primary)]">
            {item.qty}
          </div>
          <button
            type="button"
            onClick={() => onIncrease(item.id)}
            className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-primary)] text-white transition hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <p className="text-lg font-bold text-[var(--text-primary)]">
          {formatCurrency(item.price * item.qty)}
        </p>
      </div>
    </div>
  );
}

const MemoizedVirtualListItem = memo(VirtualListItem, (prevProps, nextProps) => {
  // Return false if props are different (need re-render)
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.qty === nextProps.item.qty &&
    prevProps.item.name === nextProps.item.name
  );
});

export default memo(function VirtualList({ items = [], containerHeight = 400, onIncrease, onDecrease, onRemove, onEditDetails, formatCurrency }) {
  const scrollRef = useRef(null);
  const [scrollTop, setScrollTop] = React.useState(0);

  const { startIndex, endIndex } = useMemo(() => {
    return calculateVisibleRange(containerHeight, ITEM_HEIGHT, scrollTop);
  }, [containerHeight, scrollTop]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  const totalHeight = items.length * ITEM_HEIGHT;
  const offsetY = startIndex * ITEM_HEIGHT;

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{
        height: containerHeight,
        overflow: 'auto',
        position: 'relative',
      }}
      className="rounded-lg"
    >
      {/* Spacer for scrolled content */}
      <div style={{ height: offsetY }} />

      {/* Visible items */}
      <div className="space-y-3">
        {items.slice(startIndex, endIndex).map((item, index) => (
          <MemoizedVirtualListItem
            key={item.id}
            item={item}
            isVisible={true}
            onIncrease={onIncrease}
            onDecrease={onDecrease}
            onRemove={onRemove}
            onEditDetails={onEditDetails}
            formatCurrency={formatCurrency}
          />
        ))}
      </div>

      {/* Spacer for content below viewport */}
      <div style={{ height: Math.max(0, totalHeight - offsetY - (endIndex - startIndex) * ITEM_HEIGHT) }} />
    </div>
  );
});
