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
    console.debug('No access token available for stream connection');
    return () => {};
  }

  const streamUrl = new URL(`${API_BASE_URL}/v1/orders/events/stream`);
  streamUrl.searchParams.set('accessToken', accessToken);

  const eventName = options.eventName || 'order';
  let isClosed = false;
  let eventSource = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;

  const handleOrderEvent = (event) => {
    try {
      onEvent(JSON.parse(event.data || '{}'));
    } catch (error) {
      console.error('Error: failed to parse live order event', error);
      onEvent({});
    }
  };

  const openStream = () => {
    canOpenOrderEventStream(streamUrl.toString()).then((isSupported) => {
      if (isClosed || !isSupported) {
        return;
      }

      eventSource = new window.EventSource(streamUrl.toString());
      eventSource.addEventListener(eventName, handleOrderEvent);
      eventSource.addEventListener('error', (error) => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        if (!isClosed && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delayMs = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
          console.debug(`Stream reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} after ${delayMs}ms`);
          setTimeout(openStream, delayMs);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          console.error('Stream connection failed - max reconnect attempts reached. User may need to refresh page.');
        }
      });
    });
  };

  openStream();

  return () => {
    isClosed = true;
    reconnectAttempts = maxReconnectAttempts; // Prevent reconnection attempts
    if (eventSource) {
      eventSource.removeEventListener(eventName, handleOrderEvent);
      eventSource.close();
      eventSource = null;
    }
  };
}
