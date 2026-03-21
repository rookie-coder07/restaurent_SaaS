const DEVELOPMENT_FRONTEND_URL = 'http://localhost:5173';

const normalizeUrl = (value) => {
  if (!value) {
    return '';
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  if (trimmedValue.startsWith('http://') || trimmedValue.startsWith('https://')) {
    return trimmedValue;
  }

  return `https://${trimmedValue}`;
};

export const getFrontendBaseUrl = () => {
  const configuredUrl = normalizeUrl(import.meta.env.VITE_FRONTEND_URL);
  const runtimeUrl =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  return configuredUrl || runtimeUrl || DEVELOPMENT_FRONTEND_URL;
};

export const buildQrMenuUrl = ({ tableNumber, tableId }) => {
  const baseUrl = getFrontendBaseUrl();
  const searchParams = new URLSearchParams();

  if (tableNumber !== undefined && tableNumber !== null && tableNumber !== '') {
    searchParams.set('table', String(tableNumber));
  }

  if (tableId) {
    searchParams.set('tableId', String(tableId));
  }

  const queryString = searchParams.toString();

  return `${baseUrl}/menu${queryString ? `?${queryString}` : ''}`;
};
