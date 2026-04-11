const DEFAULT_UI_ERROR = 'Something went wrong. Please try again.';

const STATUS_MESSAGES = {
  400: 'Invalid request data',
  401: 'Unauthorized access',
  403: 'Access denied',
  404: 'Resource not found',
  408: 'Request timed out. Please try again.',
  429: 'Too many requests. Please try again later.',
  500: DEFAULT_UI_ERROR,
  503: 'Service is temporarily unavailable. Please try again soon.',
};

const TECHNICAL_PATTERN =
  /(sql|stack|supabase|postgres|database|jwt|tokenexpired|jsonwebtoken|column|constraint|relation|syntax error|cannot read|undefined|null|internal error)/i;

export const isDeveloperConsoleContext = () =>
  typeof window !== 'undefined' && window.location.pathname.startsWith('/developer');

export const getUserErrorMessage = (error, fallback = DEFAULT_UI_ERROR) => {
  const status = Number(error?.response?.status || error?.status || 0);
  const serverMessage = String(error?.response?.data?.message || error?.message || '').trim();

  if (isDeveloperConsoleContext() && serverMessage) {
    return serverMessage;
  }

  if (STATUS_MESSAGES[status]) {
    return STATUS_MESSAGES[status];
  }

  if (!serverMessage || TECHNICAL_PATTERN.test(serverMessage)) {
    return fallback;
  }

  return serverMessage;
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

export { DEFAULT_UI_ERROR, STATUS_MESSAGES };
