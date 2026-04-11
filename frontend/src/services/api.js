import axios from 'axios';
import { API_BASE_URL, API_ROOT_URL, IS_LOCALHOST_API, RUNTIME_ENVIRONMENT } from '../config/api.js';
import { clearPortalSession, readPortalSession, savePortalSession } from '../utils/authStorage';
import { PORTAL_LOGIN, canAccessPortal, getPortalKeyFromPathname, normalizePortalRole } from '../utils/portalRouting';
import logger from '../utils/logger';
import { getUserErrorMessage, isDeveloperConsoleContext, showToast } from '../utils/errorHandling';

const isDevelopmentHost =
  window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
const shouldDebugApi = import.meta.env.DEV && import.meta.env.VITE_DEBUG_API === 'true';
const RETRYABLE_ERROR_CODES = new Set(['ECONNABORTED', 'ERR_NETWORK']);
const RETRYABLE_AUTH_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh-token'];

const wait = (ms) => new Promise((resolve) => {
  window.setTimeout(resolve, ms);
});

function persistPrimaryToken(token, restaurantId = '') {
  if (!token) {
    return;
  }

  localStorage.setItem('token', token);
  localStorage.setItem('accessToken', token);

  if (restaurantId) {
    localStorage.setItem('restaurantId', String(restaurantId));
  }
}

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
      const { accessToken, refreshToken: rotatedRefreshToken } = response.data.data;
      const refreshedPayload = decodeTokenPayload(accessToken);
      const refreshedRole = normalizePortalRole(refreshedPayload?.role);
      const nextRefreshToken = rotatedRefreshToken || existingSession.refreshToken;

      const isDeveloper = refreshedRole === 'developer';

      if ((!refreshedPayload?.restaurantId && !isDeveloper) || (refreshedRole && !canAccessPortal(refreshedRole, portal))) {
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
        refreshToken: nextRefreshToken,
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

console.info(`✔ Environment: ${RUNTIME_ENVIRONMENT}`);
console.info(`✔ API base: ${API_BASE_URL}`);
console.info(`✔ No localhost usage: ${String(!IS_LOCALHOST_API)}`);

if (!isDevelopmentHost && IS_LOCALHOST_API) {
  logger.error('Production is using localhost API URL');
}

const api = axios.create({
  baseURL: API_ROOT_URL,
  // Portal auth is driven by bearer tokens from local storage.
  // Keeping cookies off normal API calls prevents one stale cross-portal cookie
  // from overriding the active POS/KOT/Admin session.
  withCredentials: false,
  // Supabase free tier can be slow; allow generous time before failing requests.
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Bootstrap defaults from stored tokens so the very first request is authorized
(() => {
  const bootstrapToken =
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    sessionStorage.getItem('accessToken');
  const bootstrapRestaurantId =
    localStorage.getItem('restaurantId') ||
    sessionStorage.getItem('restaurantId');

  if (bootstrapToken) {
    api.defaults.headers.common.Authorization = `Bearer ${bootstrapToken}`;
  }

  if (bootstrapRestaurantId) {
    api.defaults.headers.common['X-Restaurant-Id'] = String(bootstrapRestaurantId);
  }
})();

export { API_BASE_URL };

export function getCurrentPortalAccessToken() {
  const portal = getPortalKeyFromPathname(window.location.pathname);
  return (
    readPortalSession(portal)?.accessToken ||
    localStorage.getItem('token') ||
    localStorage.getItem('accessToken') ||
    sessionStorage.getItem('accessToken') ||
    ''
  );
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
  async (config) => {
    // Skip auth headers for public endpoints
    const publicEndpoints = ['/v1/auth/login', '/v1/auth/register', '/v1/auth/staff/register', '/v1/auth/forgot-password', '/v1/auth/reset-password', '/v1/auth/verify-otp'];
    const url = config.url || '';
    const isPublicEndpoint = publicEndpoints.some(endpoint => url.includes(endpoint));
    
    if (isPublicEndpoint) {
      if (shouldDebugApi) {
        logger.debug(`⏭️  Skipping auth headers for public endpoint: ${url}`);
      }
      return config;
    }

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
      const fallbackToken =
        localStorage.getItem('token') ||
        localStorage.getItem('accessToken') ||
        sessionStorage.getItem('accessToken');
      const fallbackRestaurantId = localStorage.getItem('restaurantId') || sessionStorage.getItem('restaurantId');
      if (fallbackToken && fallbackRestaurantId) {
        token = fallbackToken;
        tokenPayload = decodeTokenPayload(fallbackToken) || { restaurantId: fallbackRestaurantId };
      } else if (fallbackToken) {
        token = fallbackToken;
        tokenPayload = decodeTokenPayload(fallbackToken) || {};
      }
    }

    if (token && tokenPayload && isExpiredTokenPayload(tokenPayload) && session?.refreshToken) {
      session = await refreshPortalAccessToken(portal, session);
      token = session?.accessToken;
      tokenPayload = decodeTokenPayload(token);
    }

    if (token) {
      const tokenRole = normalizePortalRole(tokenPayload?.role);

      const isDeveloper = tokenRole === 'developer';

      if ((!tokenPayload?.restaurantId && !isDeveloper) || !tokenRole) {
        // fallback to stored restaurantId if present
        const storedRestaurantId = localStorage.getItem('restaurantId') || sessionStorage.getItem('restaurantId');
        if (storedRestaurantId) {
          tokenPayload = { ...tokenPayload, restaurantId: storedRestaurantId };
        } else if (isDeveloper) {
          tokenPayload = { ...tokenPayload, restaurantId: null };
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
      api.defaults.headers.common.Authorization = `Bearer ${token}`;
      if (tokenPayload.restaurantId) {
        config.headers['X-Restaurant-Id'] = String(tokenPayload.restaurantId);
        api.defaults.headers.common['X-Restaurant-Id'] = String(tokenPayload.restaurantId);
      }

      if (tokenPayload.restaurantId && config.params && typeof config.params === 'object' && !Array.isArray(config.params)) {
        config.params = {
          ...config.params,
          restaurantId: config.params.restaurantId || String(tokenPayload.restaurantId),
        };
      }
    }

    if (shouldDebugApi) {
      logger.debug(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }

    return config;
  },
  (error) => {
    if (shouldDebugApi) {
      logger.debug(`Request interceptor error: ${error.message}`);
    }
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => {
    if (!isDeveloperConsoleContext() && response?.status >= 400 && response?.data?.message) {
      response.data.message = getUserErrorMessage({ response });
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    if (!originalRequest) {
      return Promise.reject(error);
    }

    try {
      const portal = getPortalKeyFromPathname(window.location.pathname);
      const existingSession = readPortalSession(portal);
      
      if (error.response?.status === 401 && existingSession?.refreshToken) {
        const refreshedSession = await refreshPortalAccessToken(portal, existingSession);
        originalRequest.headers.Authorization = `Bearer ${refreshedSession.accessToken}`;
        persistPrimaryToken(
          refreshedSession.accessToken,
          refreshedSession.user?.restaurantId || decodeTokenPayload(refreshedSession.accessToken)?.restaurantId || ''
        );
        return api(originalRequest);
      }
    } catch (refreshError) {
      const portal = getPortalKeyFromPathname(window.location.pathname);
      rejectMismatchedPortalSession(portal);
      return Promise.reject(refreshError);
    }

    const requestUrl = String(originalRequest?.url || '');
    const requestMethod = String(originalRequest?.method || 'get').toLowerCase();
    const canRetryAuthRequest = RETRYABLE_AUTH_ENDPOINTS.some((endpoint) => requestUrl.includes(endpoint));
    const canRetryRequest =
      !originalRequest._retryAfterWake &&
      !error.response &&
      RETRYABLE_ERROR_CODES.has(error.code) &&
      (requestMethod === 'get' || canRetryAuthRequest);

    if (canRetryRequest) {
      originalRequest._retryAfterWake = true;
      await wait(1500);
      return api(originalRequest);
    }

    const safeMessage = getUserErrorMessage(error);

    if (!isDeveloperConsoleContext()) {
      if (error.response?.data && typeof error.response.data === 'object') {
        error.response.data.message = safeMessage;
      }

      if ((originalRequest?.method || 'get').toLowerCase() !== 'get' && originalRequest?.showErrorToast !== false) {
        showToast(safeMessage);
      }
    }

    return Promise.reject(error);
  }
);

api.interceptors.response.use((response) => {
  const requestUrl = response.config?.url || '';
  const responseData = response.data?.data || {};

  if (requestUrl.includes('/v1/auth/login') || requestUrl.includes('/v1/auth/register') || requestUrl.includes('/v1/auth/refresh-token')) {
    const token = responseData.accessToken || responseData.token;
    const payload = decodeTokenPayload(token);
    const restaurantId =
      responseData.user?.restaurantId ||
      responseData.restaurant?.id ||
      responseData.restaurantId ||
      payload?.restaurantId ||
      '';

    if (token) {
      persistPrimaryToken(token, restaurantId);
    }
  }

  return response;
}, (error) => Promise.reject(error));

export default api;
