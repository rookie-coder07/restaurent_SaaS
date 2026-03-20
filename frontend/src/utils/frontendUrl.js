const PRODUCTION_FRONTEND_URL = 'https://restaurentsaas-seven.vercel.app';
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

const isPreviewOrLocalUrl = (url, stableHostname) => {
  if (!url) {
    return false;
  }

  try {
    const { hostname } = new URL(url);

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname.endsWith('.vercel.app') && hostname !== stableHostname
    );
  } catch {
    return false;
  }
};

export const getFrontendBaseUrl = () => {
  const configuredUrl = normalizeUrl(import.meta.env.VITE_FRONTEND_URL);
  const runtimeUrl =
    typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
  const stableFrontendUrl = configuredUrl || PRODUCTION_FRONTEND_URL;
  const stableHostname = new URL(stableFrontendUrl).hostname;

  if (import.meta.env.PROD) {
    if (runtimeUrl && !isPreviewOrLocalUrl(runtimeUrl, stableHostname)) {
      return runtimeUrl;
    }

    if (configuredUrl && !isPreviewOrLocalUrl(configuredUrl, stableHostname)) {
      return configuredUrl;
    }

    return stableFrontendUrl;
  }

  return configuredUrl || runtimeUrl || DEVELOPMENT_FRONTEND_URL;
};
