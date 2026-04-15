import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../context/authStore';
import { getUserErrorMessage, showToast } from '../utils/errorHandling';
import { apiCache } from '../utils/apiCache';
import { responseCache } from '../utils/requestDedup';

export const useApi = (
  apiFunction,
  deps = [],
  { enableCache = true, cacheTTL = 5 * 60 * 1000, trackRestaurantContext = true } = {}
) => {
  const restaurantId = useAuthStore((state) => state.restaurantId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const apiFunctionRef = useRef(apiFunction);
  const activeRequestRef = useRef(0);
  const inFlightPromiseRef = useRef(null);
  const cacheKeyRef = useRef(null);

  useEffect(() => {
    apiFunctionRef.current = apiFunction;
  }, [apiFunction]);

  // Generate cache key from dependencies
  useEffect(() => {
    if (enableCache && deps.length > 0) {
      cacheKeyRef.current = `api:${JSON.stringify(deps)}`;
    }
  }, [enableCache, deps]);

  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(trackRestaurantContext ? Boolean(restaurantId) : true);
  }, [restaurantId, trackRestaurantContext]);

  const execute = useCallback(
    async (...args) => {
      const cacheKey = cacheKeyRef.current;

      // Check cache first if enabled
      if (enableCache && cacheKey) {
        const cachedData = apiCache.get(cacheKey);
        if (cachedData) {
          setData(cachedData);
          setError(null);
          setLoading(false);
          return cachedData;
        }
      }

      // Return in-flight promise if one exists
      if (inFlightPromiseRef.current) {
        return inFlightPromiseRef.current;
      }

      const requestId = activeRequestRef.current + 1;
      activeRequestRef.current = requestId;

      const requestPromise = (async () => {
        try {
          setLoading(true);
          setError(null);

          const response = await apiFunctionRef.current(...args);
          const result = response.data?.data || response;
          if (activeRequestRef.current === requestId) {
            setData(result);
            // Cache the result if enabled
            if (enableCache && cacheKey) {
              apiCache.set(cacheKey, result, cacheTTL);
            }
          }
          return result;
        } catch (err) {
          const errorMessage = getUserErrorMessage(err);
          if (activeRequestRef.current === requestId) {
            setError(errorMessage);
          }
          showToast(errorMessage);
          throw err;
        } finally {
          if (activeRequestRef.current === requestId) {
            setLoading(false);
          }
          if (inFlightPromiseRef.current === requestPromise) {
            inFlightPromiseRef.current = null;
          }
        }
      })();

      inFlightPromiseRef.current = requestPromise;

      try {
        return await requestPromise;
      } finally {
        if (inFlightPromiseRef.current === requestPromise) {
          inFlightPromiseRef.current = null;
        }
      }
    },
    [enableCache, cacheTTL]
  );

  useEffect(() => {
    if (apiFunctionRef.current) {
      execute().catch(() => {
        // Error state is already captured in the hook.
      });
    }
  }, [execute, ...(trackRestaurantContext ? [restaurantId] : []), ...deps]);

  const refetch = useCallback(async () => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;
    const cacheKey = cacheKeyRef.current;

    if (cacheKey) {
      apiCache.invalidate(cacheKey);
    }
    responseCache.clear();

    try {
      setLoading(true);
      setError(null);
      const response = await apiFunctionRef.current();
      const result = response.data?.data || response;
      if (activeRequestRef.current === requestId) {
        setData(result);
      }
      return result;
    } catch (err) {
      const errorMessage = getUserErrorMessage(err);
      if (activeRequestRef.current === requestId) {
        setError(errorMessage);
      }
      showToast(errorMessage);
      throw err;
    } finally {
      if (activeRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  return { data, loading, error, execute, refetch };
};
