import { API_BASE_URL, getCurrentPortalAccessToken } from '../services/api';

async function canOpenOrderEventStream(streamUrl) {
  if (typeof window === 'undefined' || typeof window.fetch !== 'function') {
    return false;
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? window.setTimeout(() => controller.abort(), 2500) : null;

  try {
    const response = await window.fetch(streamUrl, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
      },
      signal: controller?.signal,
    });

    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    return response.ok && contentType.includes('text/event-stream');
  } catch {
    return false;
  } finally {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
  }
}

export function subscribeToOrderEvents(onEvent, options = {}) {
  if (typeof window === 'undefined' || typeof window.EventSource !== 'function' || typeof onEvent !== 'function') {
    return () => {};
  }

  const accessToken = getCurrentPortalAccessToken();
  if (!accessToken) {
    return () => {};
  }

  const streamUrl = new URL(`${API_BASE_URL}/v1/orders/events/stream`);
  streamUrl.searchParams.set('accessToken', accessToken);

  const eventName = options.eventName || 'order';
  let isClosed = false;
  let eventSource = null;

  const handleOrderEvent = (event) => {
    try {
      onEvent(JSON.parse(event.data || '{}'));
    } catch (error) {
      console.error('Error: failed to parse live order event', error);
      onEvent({});
    }
  };

  canOpenOrderEventStream(streamUrl.toString()).then((isSupported) => {
    if (isClosed || !isSupported) {
      return;
    }

    eventSource = new window.EventSource(streamUrl.toString());
    eventSource.addEventListener(eventName, handleOrderEvent);
    eventSource.addEventListener('error', () => {
      if (eventSource) {
        eventSource.close();
      }
    });
  });

  return () => {
    isClosed = true;
    if (eventSource) {
      eventSource.removeEventListener(eventName, handleOrderEvent);
      eventSource.close();
    }
  };
}
