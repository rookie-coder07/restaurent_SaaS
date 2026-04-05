import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuthStore } from '../context/authStore';

export const useApi = (apiFunction, deps = []) => {
  const restaurantId = useAuthStore((state) => state.restaurantId);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const apiFunctionRef = useRef(apiFunction);

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
      try {
        setLoading(true);
        setError(null);

        const response = await apiFunctionRef.current(...args);
        const result = response.data?.data || response;
        setData(result);
        return result;
      } catch (err) {
        const errorMessage = err.response?.data?.message || err.message;
        setError(errorMessage);
        throw err;
      } finally {
        setLoading(false);
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
    try {
      setLoading(true);
      setError(null);
      const response = await apiFunctionRef.current();
      const result = response.data?.data || response;
      setData(result);
      return result;
    } catch (err) {
      const errorMessage = err.response?.data?.message || err.message;
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { data, loading, error, execute, refetch };
};
