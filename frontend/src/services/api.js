import axios from 'axios';
import { clearPortalSession, readPortalSession, savePortalSession } from '../utils/authStorage';
import { PORTAL_LOGIN, canAccessPortal, getPortalKeyFromPathname, normalizePortalRole } from '../utils/portalRouting';

const PRODUCTION_API_BASE_URL = 'https://restaurent-backend-448t.onrender.com/api';
const DEVELOPMENT_API_BASE_URL = 'http://localhost:3000/api';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.NEXT_PUBLIC_API_URL ||
  (import.meta.env.PROD ? PRODUCTION_API_BASE_URL : DEVELOPMENT_API_BASE_URL);

const isDevelopmentHost =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const shouldDebugApi = import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === 'true';

function decodeTokenPayload(token) {
  try {
    const tokenParts = String(token || '').split('.');
    if (tokenParts.length < 2) {
      return null;
    }

    const normalizedPayload = tokenParts[1].replace(/-/g, '+').replace(/_/g, '/');
    const paddedPayload = normalizedPayload.padEnd(
      normalizedPayload.length + ((4 - (normalizedPayload.length % 4)) % 4),
      '='
    );

    return JSON.parse(window.atob(paddedPayload));
  } catch {
    return null;
  }
}

function isExpiredTokenPayload(payload) {
  if (!payload?.exp) {
    return false;
  }

  return Date.now() >= payload.exp * 1000;
}

function rejectMismatchedPortalSession(portal) {
  clearPortalSession(portal);
  window.dispatchEvent(new CustomEvent('auth:session-expired', {
    detail: {
      portal,
      redirectTo: PORTAL_LOGIN[portal] || PORTAL_LOGIN.admin,
    },
  }));
}

if (shouldDebugApi) {
  console.log('='.repeat(60));
  console.log('Frontend API Configuration');
  console.log('='.repeat(60));
  console.log('Environment:', import.meta.env.MODE);
  console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL || '(not set)');
  console.log('NEXT_PUBLIC_API_URL:', import.meta.env.NEXT_PUBLIC_API_URL || '(not set)');
  console.log('Actual API Base URL:', API_BASE_URL);
  console.log('='.repeat(60));
}

if (!isDevelopmentHost && API_BASE_URL.includes('localhost')) {
  console.error('Production is using a localhost API URL. Check API environment variables.');
}

const api = axios.create({
  baseURL: API_BASE_URL,
  // Portal auth is driven by bearer tokens from local storage.
  // Keeping cookies off normal API calls prevents one stale cross-portal cookie
  // from overriding the active POS/KOT/Admin session.
  withCredentials: false,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export { API_BASE_URL };

export function getCurrentPortalAccessToken() {
  const portal = getPortalKeyFromPathname(window.location.pathname);
  return readPortalSession(portal)?.accessToken || '';
}

api.interceptors.request.use(
  (config) => {
    const portal = getPortalKeyFromPathname(window.location.pathname);
    const session = readPortalSession(portal);
    const token = session?.accessToken;

    if (token) {
      const tokenPayload = decodeTokenPayload(token);
      const tokenRole = normalizePortalRole(tokenPayload?.role);

      if (!tokenPayload?.restaurantId || !tokenRole || isExpiredTokenPayload(tokenPayload)) {
        rejectMismatchedPortalSession(portal);
        return Promise.reject(new Error('Your session has expired. Please sign in again.'));
      }

      if (tokenRole && !canAccessPortal(tokenRole, portal)) {
        rejectMismatchedPortalSession(portal);
        return Promise.reject(new Error('Portal session does not match the current account role.'));
      }

      config.headers.Authorization = `Bearer ${token}`;
      config.headers['X-Restaurant-Id'] = String(tokenPayload.restaurantId);

      if (config.params && typeof config.params === 'object' && !Array.isArray(config.params)) {
        config.params = {
          ...config.params,
          restaurantId: config.params.restaurantId || String(tokenPayload.restaurantId),
        };
      }
    }

    if (shouldDebugApi) {
      console.log(`API Request: ${config.method?.toUpperCase()} ${API_BASE_URL}${config.url}`);
    }

    return config;
  },
  (error) => {
    if (shouldDebugApi) {
      console.error('Request interceptor error:', error);
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (shouldDebugApi) {
      console.log(`API Response: ${response.status} ${API_BASE_URL}${response.config.url}`);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    if (shouldDebugApi) {
      if (error.response) {
        console.error('API Error Response:', {
          status: error.response.status,
          statusText: error.response.statusText,
          url: `${API_BASE_URL}${error.config?.url || ''}`,
          data: error.response.data,
        });
      } else if (error.request) {
        console.error('API Error - No Response:', {
          url: `${API_BASE_URL}${error.config?.url || ''}`,
          message: error.message,
          code: error.code,
        });
      } else {
        console.error('API Error:', error.message);
      }
    }

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const portal = getPortalKeyFromPathname(window.location.pathname);
        const existingSession = readPortalSession(portal);
        const refreshToken = existingSession?.refreshToken;
        if (refreshToken) {
          const response = await axios.post(
            `${API_BASE_URL}/v1/auth/refresh-token`,
            { refreshToken },
            {
              // Refresh is driven by the token stored for the current portal.
              // Leaving cookies off prevents another portal's stale cookie from
              // replacing the active POS/KOT/Admin session.
              withCredentials: false,
            }
          );

          const { accessToken } = response.data.data;
          const refreshedRole = decodeTokenPayload(accessToken)?.role;

          if (refreshedRole && !canAccessPortal(refreshedRole, portal)) {
            rejectMismatchedPortalSession(portal);
            return Promise.reject(new Error('Portal session does not match the refreshed account role.'));
          }

          savePortalSession(portal, {
            ...existingSession,
            user: refreshedRole
              ? {
                  ...existingSession.user,
                  role: normalizePortalRole(refreshedRole),
                }
              : existingSession.user,
            accessToken,
          });

          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        const portal = getPortalKeyFromPathname(window.location.pathname);
        rejectMismatchedPortalSession(portal);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
