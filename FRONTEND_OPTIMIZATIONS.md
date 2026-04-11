# FRONTEND PERFORMANCE OPTIMIZATIONS

## Overview

Frontend optimizations reduce unnecessary API calls and re-renders, complementing backend improvements.

---

## 1. DEBOUNCE API CALLS

### Problem
Multiple API calls triggered on every keystroke or scroll event.

### Solution

```javascript
// utils/debounce.js
export const debounce = (func, delay = 300) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func(...args), delay);
  };
};

// Usage in component
import { debounce } from '@/utils/debounce';

const handleSearch = debounce(async (searchTerm) => {
  const results = await api.searchMenuItems(searchTerm);
  setResults(results);
}, 500); // 500ms delay
```

### Expected Impact
- Reduces API calls by 80-90% during typing
- Prevents query spikes

---

## 2. LAZY LOAD DATA

### Problem
Loading entire datasets even when user only views first page.

### Solution - Intersection Observer

```javascript
// hooks/useInfiniteScroll.js
import { useEffect, useRef, useState } from 'react';

export const useInfiniteScroll = (callback, loading) => {
  const ref = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && !loading) {
          callback();
        }
      },
      { threshold: 0.1 }
    );

    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [callback, loading]);

  return ref;
};

// Usage in component
const [orders, setOrders] = useState([]);
const [loading, setLoading] = useState(false);
const [offset, setOffset] = useState(0);
const loaderRef = useInfiniteScroll(() => loadMore(), loading);

const loadMore = async () => {
  setLoading(true);
  const newOrders = await api.getOrders({ limit: 20, offset });
  setOrders([...orders, ...newOrders]);
  setOffset(offset + 20);
  setLoading(false);
};

return (
  <div>
    {orders.map(order => (
      <OrderItem key={order.id} order={order} />
    ))}
    <div ref={loaderRef}>Loading more...</div>
  </div>
);
```

### Expected Impact
- Reduces initial load time by 80%+
- Better UX with progressive loading

---

## 3. AVOID UNNECESSARY RE-RENDERS

### Problem
Re-rendering parent components causes child components to re-render unnecessarily.

### Solution - React.memo + useMemo

```javascript
// OrderItem.jsx
import { memo } from 'react';

const OrderItem = memo(({ order, onSelect }) => {
  return (
    <div onClick={() => onSelect(order.id)}>
      <h3>{order.id}</h3>
      <p>₹{order.totalAmount}</p>
    </div>
  );
}, (prevProps, nextProps) => {
  // Return true if props are equal (skip re-render)
  return prevProps.order.id === nextProps.order.id &&
         prevProps.order.status === nextProps.order.status;
});

export default OrderItem;

// Dashboard.jsx
import { useMemo, useCallback } from 'react';
import OrderItem from './OrderItem';

const Dashboard = () => {
  const [orders, setOrders] = useState([]);

  // Memoized callback prevents OrderItem re-render
  const handleSelectOrder = useCallback((orderId) => {
    console.log('Selected:', orderId);
  }, []);

  // Memoized list prevents re-render of all items
  const memoizedOrders = useMemo(
    () => orders.map(order => (
      <OrderItem
        key={order.id}
        order={order}
        onSelect={handleSelectOrder}
      />
    )),
    [orders, handleSelectOrder]
  );

  return <div>{memoizedOrders}</div>;
};
```

### Expected Impact
- Reduces re-renders by 50-70%
- Improves UI responsiveness

---

## 4. PAGINATION

### Problem
Loading 1000+ orders at once causes memory bloat and UI lag.

### Solution

```javascript
// OrderList.jsx
const [limit] = useState(20);
const [offset, setOffset] = useState(0);
const [orders, setOrders] = useState([]);
const [hasMore, setHasMore] = useState(true);

useEffect(() => {
  const fetchOrders = async () => {
    const response = await api.getOrders({
      limit,
      offset,
      status: filter
    });
    
    setOrders(response);
    setHasMore(response.length === limit);
  };
  
  fetchOrders();
}, [offset, filter, limit]);

const handleLoadMore = () => {
  setOffset(offset + limit);
};

return (
  <div>
    {orders.map(order => <OrderItem key={order.id} order={order} />)}
    {hasMore && (
      <button onClick={handleLoadMore}>Load More</button>
    )}
  </div>
);
```

### Expected Impact
- Initial load: 5-10ms (vs 500-1000ms)
- Memory usage: 10MB (vs 100MB+)

---

## 5. LOCAL CACHING

### Problem
Fetching same data multiple times in short intervals.

### Solution - React Query

```javascript
// Use React Query for automatic caching
import { useQuery } from '@tanstack/react-query';

const OrderList = () => {
  // Automatically caches for 5 minutes
  const { data: orders, isLoading } = useQuery({
    queryKey: ['orders', { status: 'pending' }],
    queryFn: () => api.getOrdersByStatus('pending'),
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 10, // 10 minutes
  });

  if (isLoading) return <div>Loading...</div>;
  return <OrderList orders={orders} />;
};

// If query is already fetched, data returned instantly from cache
```

### Expected Impact
- Eliminates duplicate API calls
- Instant data display on navigation

---

## 6. VIRTUAL SCROLLING

### Problem
Rendering 1000 DOM nodes causes browser lag.

### Solution - react-window

```javascript
import { FixedSizeList } from 'react-window';

const VirtualOrderList = ({ orders }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <OrderItem order={orders[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={orders.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
};
```

**Result**: Renders only ~10 visible items instead of 1000+

### Expected Impact
- 100-200ms to 10-20ms render time
- Smooth scrolling on 10,000+ items

---

## 7. IMAGE OPTIMIZATION

### Problem
Large uncompressed images slow down page load.

### Solution

```javascript
// Use Next Image component
import Image from 'next/image';

const MenuItemImage = ({ item }) => (
  <Image
    src={item.imageUrl}
    alt={item.name}
    width={200}
    height={200}
    quality={75} // Optimize quality
    loading="lazy" // Lazy load images
    placeholder="blur" // Show blur while loading
  />
);

// Or use modern image format
<picture>
  <source srcSet="image.webp" type="image/webp" />
  <img src="image.jpg" alt="Menu Item" />
</picture>
```

### Expected Impact
- 50-80% reduction in image size
- Faster page loads

---

## 8. CODE SPLITTING

### Problem
Loading entire app bundle (5MB+) upfront.

### Solution - Dynamic Imports

```javascript
import { lazy, Suspense } from 'react';

const KitchenDisplay = lazy(() => import('./KitchenDisplay'));
const Analytics = lazy(() => import('./Analytics'));

const App = () => (
  <Routes>
    <Route
      path="/kitchen"
      element={
        <Suspense fallback={<div>Loading...</div>}>
          <KitchenDisplay />
        </Suspense>
      }
    />
    <Route
      path="/analytics"
      element={
        <Suspense fallback={<div>Loading...</div>}>
          <Analytics />
        </Suspense>
      }
    />
  </Routes>
);
```

### Expected Impact
- Initial bundle: 500KB (vs 5MB)
- First Contentful Paint: 1-2s (vs 5-10s)

---

## 9. DEBOUNCE WINDOW RESIZE

### Problem
Window resize triggers expensive layout calculations.

### Solution

```javascript
export const useWindowResize = (callback, delay = 300) => {
  useEffect(() => {
    const debouncedCallback = debounce(callback, delay);
    window.addEventListener('resize', debouncedCallback);
    return () => window.removeEventListener('resize', debouncedCallback);
  }, [callback, delay]);
};

// Usage
const Dashboard = () => {
  const handleResize = useCallback(() => {
    setColumns(window.innerWidth > 1200 ? 3 : 2);
  }, []);

  useWindowResize(handleResize);
  // ...
};
```

### Expected Impact
- Prevents redundant calculations
- Smooth resizing experience

---

## 10. STATE MANAGEMENT OPTIMIZATION

### Problem
Unnecessary re-renders due to local state updates.

### Solution - Zustand

```javascript
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/react';

const useOrderStore = create(
  subscribeWithSelector((set) => ({
    orders: [],
    selectedOrderId: null,
    setOrders: (orders) => set({ orders }),
    selectOrder: (id) => set({ selectedOrderId: id }),
  }))
);

// Selector pattern - only re-render on relevant changes
const OrderList = () => {
  const orders = useOrderStore((state) => state.orders);
  // Only re-renders when orders change, not when selectedOrderId changes
};

const OrderDetail = () => {
  const selectedOrderId = useOrderStore((state) => state.selectedOrderId);
  // Only re-renders when selectedOrderId changes
};
```

### Expected Impact
- Eliminating 50%+ of unnecessary re-renders
- Better performance at scale

---

## PERFORMANCE CHECKLIST

- [ ] Debounce all search/filter inputs (500ms)
- [ ] Implement lazy loading with Intersection Observer
- [ ] Use React.memo on list items
- [ ] Implement pagination (limit: 20)
- [ ] Setup React Query for data caching
- [ ] Use virtual scrolling for 100+ items
- [ ] Optimize images (WebP format, lazy load)
- [ ] Implement code splitting for routes
- [ ] Debounce window resize events
- [ ] Use Zustand/Redux for state management

---

## EXPECTED RESULTS

| Metric | Before | After |
|--------|--------|-------|
| Initial Load | 5-10s | 1-2s |
| API Calls/Sec | 50-100 | 5-10 |
| Memory Usage | 200MB | 50MB |
| Re-renders/Sec | 30-50 | 5-10 |
| List Rendering | 500ms | 20ms |

---

## MONITORING

Use React DevTools Profiler:

1. Open React DevTools > Profiler tab
2. Record interactions
3. Identify slow components
4. Apply memoization/lazy loading

```javascript
// Example with profiling
import { Profiler } from 'react';

const onRenderCallback = (
  id, phase, actualDuration, baseDuration, startTime, commitTime
) => {
  console.log(`${id} (${phase}) took ${actualDuration}ms`);
};

<Profiler id="OrderList" onRender={onRenderCallback}>
  <OrderList />
</Profiler>
```

---

## RESOURCES

- [React Query Docs](https://tanstack.com/query/latest)
- [React Virtual Scroll](https://github.com/bvaughn/react-window)
- [Web Vitals Guide](https://web.dev/vitals/)
- [Code Splitting Patterns](https://nextjs.org/docs/advanced-features/dynamic-import)
