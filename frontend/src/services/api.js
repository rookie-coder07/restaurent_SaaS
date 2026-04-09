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

const refreshRequests = new Map();

async function refreshPortalAccessToken(portal, existingSession) {
  if (!portal || !existingSession?.refreshToken) {
    throw new Error('No refresh token available.');
  }

  const refreshKey = `${portal}:${existingSession.refreshToken}`;
  if (refreshRequests.has(refreshKey)) {
    return refreshRequests.get(refreshKey);
  }

  const refreshPromise = axios
    .post(
      `${API_BASE_URL}/v1/auth/refresh-token`,
      { refreshToken: existingSession.refreshToken },
      {
        withCredentials: false,
      }
    )
    .then((response) => {
      const { accessToken } = response.data.data;
      const refreshedPayload = decodeTokenPayload(accessToken);
      const refreshedRole = normalizePortalRole(refreshedPayload?.role);

      if (!refreshedPayload?.restaurantId || (refreshedRole && !canAccessPortal(refreshedRole, portal))) {
        rejectMismatchedPortalSession(portal);
        throw new Error('Portal session does not match the refreshed account role.');
      }

      const nextSession = {
        ...existingSession,
        user: {
          ...existingSession.user,
          role: refreshedRole || existingSession.user?.role,
          restaurantId: existingSession.user?.restaurantId || refreshedPayload.restaurantId || null,
        },
        accessToken,
      };

      savePortalSession(portal, nextSession);
      return nextSession;
    })
    .finally(() => {
      refreshRequests.delete(refreshKey);
    });

  refreshRequests.set(refreshKey, refreshPromise);
  return refreshPromise;
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
  // Supabase free tier can be slow; allow generous time before failing requests.
  timeout: 45000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Bootstrap defaults from stored tokens so the very first request is authorized
(() => {
  const bootstrapToken =
    localStorage.getItem('accessToken') ||
    sessionStorage.getItem('accessToken');
  const bootstrapRestaurantId =
    localStorage.getItem('restaurantId') ||
    sessionStorage.getItem('restaurantId');

  if (bootstrapToken && bootstrapRestaurantId) {
    api.defaults.headers.common.Authorization = `Bearer ${bootstrapToken}`;
    api.defaults.headers.common['X-Restaurant-Id'] = String(bootstrapRestaurantId);
  }
})();

export { API_BASE_URL };

export function getCurrentPortalAccessToken() {
  const portal = getPortalKeyFromPathname(window.location.pathname);
  return readPortalSession(portal)?.accessToken || '';
}

export function getCurrentRestaurantId() {
  const portal = getPortalKeyFromPathname(window.location.pathname);
  const session = readPortalSession(portal);
  const tokenPayload = decodeTokenPayload(session?.accessToken);
  return (
    session?.user?.restaurantId ||
    tokenPayload?.restaurantId ||
    localStorage.getItem('restaurantId') ||
    sessionStorage.getItem('restaurantId') ||
    ''
  );
}

api.interceptors.request.use(
  (config) => {
  return (async () => {
    const portal = getPortalKeyFromPathname(window.location.pathname);
    let session = readPortalSession(portal);
    let token = session?.accessToken;
    let tokenPayload = decodeTokenPayload(token);

   // Broader fallback: try any portal session or localStorage (POS)
   if (!token) {
     const portals = ['pos', 'admin', 'kot'];
     for (const p of portals) {
       const altSession = readPortalSession(p);
       if (altSession?.accessToken) {
         session = altSession;
         token = altSession.accessToken;
         tokenPayload = decodeTokenPayload(token);
         break;
       }
     }
   }

   if (!token) {
      const fallbackToken = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
      const fallbackRestaurantId = localStorage.getItem('restaurantId') || sessionStorage.getItem('restaurantId');
      if (fallbackToken && fallbackRestaurantId) {
        token = fallbackToken;
        tokenPayload = decodeTokenPayload(fallbackToken) || { restaurantId: fallbackRestaurantId };
      }
    }

    if (token && tokenPayload && isExpiredTokenPayload(tokenPayload) && session?.refreshToken) {
      session = await refreshPortalAccessToken(portal, session);
      token = session?.accessToken;
      tokenPayload = decodeTokenPayload(token);
      }

      if (token) {
        const tokenRole = normalizePortalRole(tokenPayload?.role);

        if (!tokenPayload?.restaurantId || !tokenRole) {
          // fallback to stored restaurantId if present
          const storedRestaurantId = localStorage.getItem('restaurantId') || sessionStorage.getItem('restaurantId');
          if (storedRestaurantId) {
            tokenPayload = { ...tokenPayload, restaurantId: storedRestaurantId };
          } else {
            rejectMismatchedPortalSession(portal);
            throw new Error('Your session has expired. Please sign in again.');
          }
        }

        if (tokenRole && !canAccessPortal(tokenRole, portal)) {
          rejectMismatchedPortalSession(portal);
          throw new Error('Portal session does not match the current account role.');
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
    })();
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
        if (existingSession?.refreshToken) {
          const refreshedSession = await refreshPortalAccessToken(portal, existingSession);
          originalRequest.headers.Authorization = `Bearer ${refreshedSession.accessToken}`;
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
