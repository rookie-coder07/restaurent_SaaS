import { useCallback, useEffect, useState } from 'react';

export const usePolling = (apiFunction, interval = 5000, shouldPoll = true) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFunction();
      setData(response.data?.data || response.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
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
