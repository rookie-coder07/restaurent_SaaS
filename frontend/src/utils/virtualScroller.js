/**
 * Virtual Scrolling utility for rendering large lists efficiently
 * Only renders visible items, dramatically improving performance
 */

export function calculateVisibleRange(containerHeight, itemHeight, scrollTop) {
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight));
  const endIndex = Math.ceil((scrollTop + containerHeight) / itemHeight);
  return { startIndex, endIndex };
}

export function getVirtualScrollStyle(rowHeight) {
  return {
    itemHeight: rowHeight,
    overscan: 3, // Render 3 extra items above/below for smooth scrolling
  };
}
