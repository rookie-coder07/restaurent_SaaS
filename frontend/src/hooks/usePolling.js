import { useCallback, useEffect, useRef, useState } from 'react';

export const usePolling = (apiFunction, interval = 5000, shouldPoll = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const isMountedRef = useRef(true);
  const inFlightRef = useRef(false);
  const latestDataRef = useRef(null);

  useEffect(() => () => {
    isMountedRef.current = false;
  }, []);

  const fetchData = useCallback(async () => {
    if (inFlightRef.current) {
      return latestDataRef.current;
    }

    inFlightRef.current = true;
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      const response = await apiFunction();
      const nextData = response.data?.data || response.data;
      if (isMountedRef.current) {
        setData(nextData);
        setError(null);
      }
      latestDataRef.current = nextData;
      return nextData;
    } catch (err) {
      if (isMountedRef.current) {
        setError(err.response?.data?.message || err.message);
      }
      throw err;
    } finally {
      inFlightRef.current = false;
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [apiFunction]);

  useEffect(() => {
    if (!shouldPoll) return;

    fetchData();
    const intervalId = setInterval(fetchData, interval);

    return () => clearInterval(intervalId);
  }, [fetchData, interval, shouldPoll]);

  return { data, loading, error, refresh: fetchData };
};
