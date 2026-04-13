const DEFAULT_UI_ERROR = 'Something went wrong. Please try again.';

const STATUS_MESSAGES = {
  400: 'Please check your input and try again',
  401: 'Your session has expired. Please log in again',
  403: 'You do not have permission to perform this action',
  404: 'The resource you are looking for does not exist',
  408: 'Request took too long. Please try again',
  429: 'Too many requests. Please wait a moment before trying again',
  500: DEFAULT_UI_ERROR,
  503: 'Service is temporarily unavailable. Please try again soon',
};

// Network error messages
const NETWORK_MESSAGES = {
  NETWORK_ERROR: 'Check your internet connection and try again',
  TIMEOUT: 'Request took too long. Please try again',
  NO_RESPONSE: 'Server did not respond. Check your connection',
  CONNECTION_REFUSED: 'Cannot reach the server. Check your internet',
};

const TECHNICAL_PATTERN =
  /(sql|stack|supabase|postgres|database|jwt|tokenexpired|jsonwebtoken|column|constraint|relation|syntax error|cannot read|undefined|null|internal error)/i;

export const isDeveloperConsoleContext = () =>
  typeof window !== 'undefined' && window.location.pathname.startsWith('/developer');

// 🔧 NEW: Global error handler for all error types
export const handleError = (error) => {
  // Handle network errors
  if (!error.response && error.request) {
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      return NETWORK_MESSAGES.TIMEOUT;
    }
    if (error.code === 'ECONNREFUSED') {
      return NETWORK_MESSAGES.CONNECTION_REFUSED;
    }
    return NETWORK_MESSAGES.NO_RESPONSE;
  }
  
  // Handle no request made (network error)
  if (!error.response && !error.request) {
    if (error.message === 'Network Error') {
      return NETWORK_MESSAGES.NETWORK_ERROR;
    }
    return error.message || DEFAULT_UI_ERROR;
  }
  
  // Handle server response with error
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  return getUserErrorMessage(error);
};

export const getUserErrorMessage = (error, fallback = DEFAULT_UI_ERROR) => {
  const status = Number(error?.response?.status || error?.status || 0);
  const serverMessage = String(error?.response?.data?.message || error?.message || '').trim();
  
  if (isDeveloperConsoleContext() && serverMessage) {
    return serverMessage;
  }

  // If server provided a user-friendly message, use it
  if (serverMessage && !TECHNICAL_PATTERN.test(serverMessage)) {
    return serverMessage;
  }

  if (STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status];
  }
  
  return fallback;
};

export const showToast = (message, type = 'error') => {
  if (typeof window === 'undefined' || !message) {
    return;
  }

  window.dispatchEvent(
    new CustomEvent('app:toast', {
      detail: {
        type,
        message,
      },
    })
  );
};

export const reportClientError = (error, context = 'Client error') => {
  if (import.meta.env.DEV) {
    console.error(context, error);
  }
};

export { DEFAULT_UI_ERROR, STATUS_MESSAGES, NETWORK_MESSAGES, handleError };
