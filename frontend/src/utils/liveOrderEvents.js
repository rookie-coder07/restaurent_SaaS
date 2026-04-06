import { API_BASE_URL, getCurrentPortalAccessToken } from '../services/api';

export function subscribeToOrderEvents(onEvent) {
  if (typeof window === 'undefined' || typeof window.EventSource !== 'function' || typeof onEvent !== 'function') {
    return () => {};
  }

  const accessToken = getCurrentPortalAccessToken();
  if (!accessToken) {
    return () => {};
  }

  const streamUrl = new URL(`${API_BASE_URL}/v1/orders/events/stream`);
  streamUrl.searchParams.set('accessToken', accessToken);

  const eventSource = new window.EventSource(streamUrl.toString());
  const handleOrderEvent = (event) => {
    try {
      onEvent(JSON.parse(event.data || '{}'));
    } catch {
      onEvent({});
    }
  };

  eventSource.addEventListener('order', handleOrderEvent);
  eventSource.addEventListener('error', () => {});

  return () => {
    eventSource.removeEventListener('order', handleOrderEvent);
    eventSource.close();
  };
}
