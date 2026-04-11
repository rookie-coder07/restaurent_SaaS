const DEFAULT_API_BASE_URL = 'https://restaurent-backend-448t.onrender.com/api/v1';

const trimTrailingSlash = (value = '') => String(value || '').replace(/\/+$/, '');

export const API_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_API_URL || DEFAULT_API_BASE_URL
);

export const API_ROOT_URL = API_BASE_URL.endsWith('/api/v1')
  ? API_BASE_URL.slice(0, -3)
  : API_BASE_URL;

export const RUNTIME_ENVIRONMENT = import.meta.env.PROD ? 'production' : 'development';
export const IS_LOCALHOST_API = /localhost|127\.0\.0\.1/i.test(API_BASE_URL);
