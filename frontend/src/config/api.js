const DEFAULT_API_BASE_URL = 'https://restaurent-backend-448t.onrender.com/api/v1';

const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');
const isLocalhostUrl = (value = '') => /localhost|127\.0\.0\.1/i.test(String(value || ''));
const isLocalBrowserHost = () => {
  if (typeof window === 'undefined') {
    return false;
  }

  return /^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
};

const configuredApiUrl = trimTrailingSlash(import.meta.env.VITE_API_URL || '');
const allowExplicitLocalApi = import.meta.env.VITE_ALLOW_LOCAL_API === 'true';
const shouldOverrideLocalApi =
  configuredApiUrl &&
  isLocalhostUrl(configuredApiUrl) &&
  (!isLocalBrowserHost() || !allowExplicitLocalApi);

export const API_BASE_URL = shouldOverrideLocalApi
  ? DEFAULT_API_BASE_URL
  : trimTrailingSlash(configuredApiUrl || DEFAULT_API_BASE_URL);

export const API_ROOT_URL = API_BASE_URL.endsWith('/api/v1')
  ? API_BASE_URL.slice(0, -3)
  : API_BASE_URL;

export const RUNTIME_ENVIRONMENT = import.meta.env.PROD ? 'production' : 'development';
export const IS_LOCALHOST_API = /localhost|127\.0\.0\.1/i.test(API_BASE_URL);
export const HAS_LOCAL_API_OVERRIDE = shouldOverrideLocalApi;
export const ALLOW_EXPLICIT_LOCAL_API = allowExplicitLocalApi;
