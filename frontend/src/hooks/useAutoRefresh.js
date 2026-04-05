import { useEffect, useRef } from 'react';

export default function useAutoRefresh(callback, intervalMs = 12000, enabled = true) {
  const callbackRef = useRef(callback);
  const autoRefreshEnabled = false;

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!autoRefreshEnabled || !enabled || !intervalMs) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      Promise.resolve(callbackRef.current?.()).catch(() => {
        // Page-level error state is already handled by each caller.
      });
    }, intervalMs);

    return () => window.clearInterval(intervalId);
  }, [enabled, intervalMs]);
}
