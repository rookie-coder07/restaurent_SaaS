const PORTAL_STORAGE_PREFIX = 'portal-auth';

const memoryStore = new Map();
const memoryStorage = {
  getItem: (k) => memoryStore.get(k) || null,
  setItem: (k, v) => {
    memoryStore.set(k, String(v));
  },
  removeItem: (k) => memoryStore.delete(k),
};

function getStorage() {
  // Try sessionStorage, fall back to localStorage, then in-memory map when blocked by tracking prevention
  try {
    const probeKey = '__portal_probe__';
    window.sessionStorage.setItem(probeKey, '1');
    window.sessionStorage.removeItem(probeKey);
    return window.sessionStorage;
  } catch {
    try {
      const probeKey = '__portal_probe__';
      window.localStorage.setItem(probeKey, '1');
      window.localStorage.removeItem(probeKey);
      return window.localStorage;
    } catch {
      return memoryStorage;
    }
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
    return true;
  }

  return Date.now() >= payload.exp * 1000;
}

function getPortalStorageKey(portal) {
  return `${PORTAL_STORAGE_PREFIX}:${portal}`;
}

export function savePortalSession(portal, session) {
  try {
    getStorage().setItem(getPortalStorageKey(portal), JSON.stringify(session));
  } catch {
    // If storage is blocked mid-flight, keep an in-memory backup
    memoryStorage.setItem(getPortalStorageKey(portal), JSON.stringify(session));
  }
}

export function readPortalSession(portal = 'admin') {
  try {
    const raw = getStorage().getItem(getPortalStorageKey(portal));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasPortalSession(portal = 'admin') {
  return Boolean(getValidPortalSession(portal));
}

export function clearPortalSession(portal = 'admin') {
  getStorage().removeItem(getPortalStorageKey(portal));
}

export function clearAllPortalSessions() {
  ['admin', 'pos', 'kot'].forEach(clearPortalSession);
}

export function getTokenPayload(token) {
  return decodeTokenPayload(token);
}

export function isTokenExpired(token) {
  return isExpiredTokenPayload(getTokenPayload(token));
}

export function getValidPortalSession(portal = 'admin') {
  const session = readPortalSession(portal);
  const tokenPayload = getTokenPayload(session?.accessToken);

  if (!session?.user) {
    return null;
  }

  const hasRefreshToken = Boolean(session?.refreshToken);
  const hasUsableAccessToken = Boolean(session?.accessToken && tokenPayload && !isExpiredTokenPayload(tokenPayload));

  if (!hasUsableAccessToken && !hasRefreshToken) {
    return null;
  }

  return {
    ...session,
    user: {
      ...session.user,
      restaurantId: session.user?.restaurantId || tokenPayload.restaurantId || null,
    },
  };
}
