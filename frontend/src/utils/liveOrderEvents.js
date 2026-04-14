import { API_BASE_URL, getCurrentPortalAccessToken } from '../services/api';
import logger from './logger';
import { reportClientError } from './errorHandling';

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
    logger.debug('No access token available for stream connection');
    reportClientError(null, 'No authentication token: log in again');
    return () => {};
  }

  // GUARD: Validate token format (basic JWT check)
  if (typeof accessToken !== 'string' || !accessToken.includes('.')) {
    logger.error('Invalid token format for stream connection');
    reportClientError(null, 'Invalid authentication token');
    return () => {};
  }

  const streamUrl = new URL(`${API_BASE_URL}/orders/events/stream`);
  streamUrl.searchParams.set('accessToken', accessToken);
  
  // DEBUG: Log connection attempt (for troubleshooting 403)
  logger.info(`[Stream] Attempting connection to: ${API_BASE_URL}/orders/events/stream`);

  const eventName = options.eventName || 'order';
  let isClosed = false;
  let eventSource = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;

  const handleOrderEvent = (event) => {
    try {
      onEvent(JSON.parse(event.data || '{}'));
    } catch (error) {
      reportClientError(error, 'Error: failed to parse live order event');
      onEvent({});
    }
  };

  const openStream = () => {
    canOpenOrderEventStream(streamUrl.toString()).then((isSupported) => {
      if (isClosed || !isSupported) {
        return;
      }

      // DEBUG: Log successful connection start
      logger.info('[Stream] Opening EventSource connection');
      eventSource = new window.EventSource(streamUrl.toString());
      eventSource.addEventListener(eventName, handleOrderEvent);
      eventSource.addEventListener('open', () => {
        logger.info('[Stream] Connection established, readyState:', eventSource.readyState);
      });
      eventSource.addEventListener('error', (error) => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        // IMPROVED: Log error details for 403 debugging
        const statusCode = error?.status || 'unknown';
        const readyState = eventSource?.readyState;
        const url = streamUrl.toString();
        
        logger.error(`[Stream] Connection error:`, {
          status: statusCode,
          readyState,
          url: url.split('?')[0] + '?accessToken=[REDACTED]',
          hasToken: url.includes('accessToken='),
        });
        
        if (statusCode === 403) {
          console.error('[Stream] 403 Forbidden - Check:', {
            tokenPresent: !!accessToken,
            tokenFormat: accessToken ? `${accessToken.split('.')[0]}...[REDACTED]` : 'none',
            url: url.substring(0, 80) + '...',
          });
        }
        
        if (!isClosed && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delayMs = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
          logger.debug(`[Stream] Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts} after ${delayMs}ms`);
          setTimeout(openStream, delayMs);
        } else if (reconnectAttempts >= maxReconnectAttempts) {
          const errorMsg = statusCode === 403 
            ? 'Stream authentication failed (403) - check token'
            : 'Stream connection failed - max reconnect attempts reached';
          logger.error(`[Stream] ${errorMsg}`);
          reportClientError(null, errorMsg);
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

export function subscribeToTableEvents(onEvent, options = {}) {
  // Listen to table_updated events from order deletion
  if (typeof window === 'undefined' || typeof window.EventSource !== 'function' || typeof onEvent !== 'function') {
    return () => {};
  }

  const accessToken = getCurrentPortalAccessToken();
  if (!accessToken) {
    logger.debug('No access token available for table stream connection');
    return () => {};
  }

  if (typeof accessToken !== 'string' || !accessToken.includes('.')) {
    logger.error('Invalid token format for table stream connection');
    return () => {};
  }

  const streamUrl = new URL(`${API_BASE_URL}/orders/events/stream`);
  streamUrl.searchParams.set('accessToken', accessToken);
  
  logger.info(`[Table Stream] Listening for table updates`);

  const eventName = 'table_updated';
  let isClosed = false;
  let eventSource = null;
  let reconnectAttempts = 0;
  const maxReconnectAttempts = 3;

  const handleTableEvent = (event) => {
    try {
      const payload = JSON.parse(event.data || '{}');
      logger.debug(`[Table] Update received for table ${payload.tableId}:`, payload);
      onEvent(payload);
    } catch (error) {
      reportClientError(error, 'Error: failed to parse table update event');
      onEvent({});
    }
  };

  const openStream = () => {
    canOpenOrderEventStream(streamUrl.toString()).then((isSupported) => {
      if (isClosed || !isSupported) {
        return;
      }

      logger.info('[Table Stream] Opening connection for table updates');
      eventSource = new window.EventSource(streamUrl.toString());
      eventSource.addEventListener(eventName, handleTableEvent);
      
      eventSource.addEventListener('error', (error) => {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        
        if (!isClosed && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          const delayMs = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 10000);
          logger.debug(`[Table Stream] Reconnect attempt ${reconnectAttempts}/${maxReconnectAttempts}`);
          setTimeout(openStream, delayMs);
        }
      });
    });
  };

  openStream();

  return () => {
    isClosed = true;
    reconnectAttempts = maxReconnectAttempts;
    if (eventSource) {
      eventSource.removeEventListener(eventName, handleTableEvent);
      eventSource.close();
      eventSource = null;
    }
  };
}
