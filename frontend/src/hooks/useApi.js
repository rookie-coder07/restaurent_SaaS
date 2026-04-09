import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../context/authStore';

export const useApi = (apiFunction, deps = []) => {
  const restaurantId = useAuthStore((state) => state.restaurantId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const apiFunctionRef = useRef(apiFunction);
  const activeRequestRef = useRef(0);
  const inFlightPromiseRef = useRef(null);

  useEffect(() => {
    apiFunctionRef.current = apiFunction;
  }, [apiFunction]);

  useEffect(() => {
    setData(null);
    setError(null);
    setLoading(Boolean(restaurantId));
  }, [restaurantId]);

  const execute = useCallback(
    async (...args) => {
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
          }
          return result;
        } catch (err) {
          let errorMessage = err.response?.data?.message || err.message;
          // Convert technical errors to user-friendly messages
          if (err.code === 'ECONNABORTED' || errorMessage?.includes('timeout')) {
            errorMessage = 'The server is taking too long to respond. Please try again.';
          } else if (err.message === 'Network Error' || !err.response) {
            errorMessage = 'Connection problem. Please check your internet and try again.';
          } else if (err.response?.status === 500) {
            errorMessage = 'Something went wrong. Please try again in a moment.';
          } else if (err.response?.status === 503) {
            errorMessage = 'The service is temporarily unavailable. Please try again soon.';
          }
          if (activeRequestRef.current === requestId) {
            setError(errorMessage);
          }
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
    []
  );

  useEffect(() => {
    if (apiFunctionRef.current) {
      execute().catch(() => {
        // Error state is already captured in the hook.
      });
    }
  }, [execute, restaurantId, ...deps]);

  const refetch = useCallback(async () => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

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
      let errorMessage = err.response?.data?.message || err.message;
      // Convert technical errors to user-friendly messages
      if (err.code === 'ECONNABORTED' || errorMessage?.includes('timeout')) {
        errorMessage = 'The server is taking too long to respond. Please try again.';
      } else if (err.message === 'Network Error' || !err.response) {
        errorMessage = 'Connection problem. Please check your internet and try again.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Something went wrong. Please try again in a moment.';
      } else if (err.response?.status === 503) {
        errorMessage = 'The service is temporarily unavailable. Please try again soon.';
      }
      if (activeRequestRef.current === requestId) {
        setError(errorMessage);
      }
      throw err;
    } finally {
      if (activeRequestRef.current === requestId) {
        setLoading(false);
      }
    }
  }, []);

  return { data, loading, error, execute, refetch };
};
