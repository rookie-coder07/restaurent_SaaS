const PORTAL_STORAGE_PREFIX = 'portal-auth';

function getPortalStorageKey(portal) {
  return `${PORTAL_STORAGE_PREFIX}:${portal}`;
}

export function savePortalSession(portal, session) {
  localStorage.setItem(getPortalStorageKey(portal), JSON.stringify(session));
}

export function readPortalSession(portal = 'admin') {
  try {
    const raw = localStorage.getItem(getPortalStorageKey(portal));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function hasPortalSession(portal = 'admin') {
  const session = readPortalSession(portal);
  return Boolean(session?.accessToken && session?.user);
}

export function clearPortalSession(portal = 'admin') {
  localStorage.removeItem(getPortalStorageKey(portal));
}

export function clearAllPortalSessions() {
  ['admin', 'pos', 'kot'].forEach(clearPortalSession);
}
