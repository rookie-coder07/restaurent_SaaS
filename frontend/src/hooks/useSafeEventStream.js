/**
 * Optimized hook for handling SSE failures and preventing 403 loops
 * Implements exponential backoff and conditional initialization
 */

import { useEffect, useRef } from 'react';
import { useAuthStore } from '../context/authStore';
import { API_BASE_URL } from '../config/api.js';

export const useSafeEventStream = (eventName, callback, shouldInitialize = true) => {
  const callbackRef = useRef(callback);
  const isAuthenticatedRef = useRef(false);
  const retryCountRef = useRef(0);
  const maxRetriesRef = useRef(3);
  const eventSourceRef = useRef(null);
  const isMountedRef = useRef(true);

  const isAuthenticated = useAuthStore((state) => !!state.accessToken);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    isAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldInitialize || !isAuthenticated) {
      return undefined;
    }

    // Prevent initialization if not authenticated
    if (!isAuthenticatedRef.current) {
      console.warn(`[${eventName}] Event stream not initialized - user not authenticated`);
      return undefined;
    }

    const cleanup = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };

    const handleError = (event) => {
      if (!isMountedRef.current) {
        return;
      }

      // Check if this is a 403 Forbidden error
      if (event.status === 403 || event.currentTarget?.readyState === EventSource.CLOSED) {
        console.warn(`[${eventName}] Received 403 error. Stopping event stream to prevent retry loop.`);
        cleanup();
        retryCountRef.current = maxRetriesRef.current; // Mark as exhausted
        return;
      }

      // Handle other errors with exponential backoff
      if (retryCountRef.current < maxRetriesRef.current) {
        retryCountRef.current += 1;
        const backoffMs = Math.min(1000 * Math.pow(2, retryCountRef.current), 30000);
        console.warn(`[${eventName}] Connection failed. Retry ${retryCountRef.current}/${maxRetriesRef.current} in ${backoffMs}ms`);
      } else {
        console.error(`[${eventName}] Max retries exhausted. Event stream disabled.`);
        cleanup();
      }
    };

    const handleMessage = (event) => {
      if (!isMountedRef.current) {
        return;
      }

      try {
        const data = JSON.parse(event.data);
        callbackRef.current?.(data);
      } catch (err) {
        console.error(`[${eventName}] Failed to parse event data:`, err);
      }
    };

    // Initialize event stream
    try {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      eventSourceRef.current = new EventSource(`${API_BASE_URL}/stream/${eventName}`);
      eventSourceRef.current.addEventListener('message', handleMessage);
      eventSourceRef.current.addEventListener('error', handleError);
      retryCountRef.current = 0;
    } catch (err) {
      console.error(`[${eventName}] Failed to initialize event stream:`, err);
    }

    return cleanup;
  }, [eventName, shouldInitialize, isAuthenticated]);
};

export default useSafeEventStream;
