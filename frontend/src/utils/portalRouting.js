export function normalizePortalRole(role) {
  const normalizedRole = String(role || '').trim().toLowerCase();

  if (normalizedRole === 'admin') {
    return 'owner';
  }

  if (normalizedRole === 'super_admin') {
    return 'developer';
  }

  if (normalizedRole === 'waiter' || normalizedRole === 'cashier') {
    return 'staff';
  }

  if (normalizedRole === 'kitchen') {
    return 'kitchen_staff';
  }

  return normalizedRole;
}

export const PORTAL_ACCESS = {
  admin: ['owner', 'manager', 'developer'],
  pos: ['staff'],
  kot: ['kitchen_staff'],
};

export const PORTAL_HOME = {
  admin: '/admin',
  pos: '/pos',
  kot: '/kot',
};

export const PORTAL_LOGIN = {
  admin: '/admin/login',
  pos: '/pos/login',
  kot: '/kot/login',
};

export function getPortalKeyFromPathname(pathname = '') {
  if (pathname.startsWith('/kot') || pathname.startsWith('/kitchen')) {
    return 'kot';
  }

  if (pathname.startsWith('/pos')) {
    return 'pos';
  }

  return 'admin';
}

export function getDefaultPortalPath(role) {
  const normalizedRole = normalizePortalRole(role);

  if (normalizedRole === 'staff') {
    return PORTAL_HOME.pos;
  }

  if (normalizedRole === 'kitchen_staff') {
    return PORTAL_HOME.kot;
  }

  if (normalizedRole === 'manager') {
    return '/manager';
  }

  if (normalizedRole === 'developer') {
    return '/developer';
  }

  if (normalizedRole === 'owner') {
    return PORTAL_HOME.admin;
  }

  return PORTAL_LOGIN.admin;
}

export function getLoginPathForPathname(pathname = '') {
  if (pathname.startsWith('/kot') || pathname.startsWith('/kitchen')) {
    return '/staff/login';
  }

  if (pathname.startsWith('/manager')) {
    return PORTAL_LOGIN.admin;
  }

  if (pathname.startsWith('/developer')) {
    return '/developer/login';
  }

  if (pathname.startsWith('/pos')) {
    return PORTAL_LOGIN.pos;
  }

  return PORTAL_LOGIN.admin;
}

export function canAccessPortal(role, portal) {
  const normalizedRole = normalizePortalRole(role);

  if (!normalizedRole || !PORTAL_ACCESS[portal]) {
    return false;
  }

  return PORTAL_ACCESS[portal].includes(normalizedRole);
}

export function resolvePortalHome(portal, role) {
  const normalizedRole = normalizePortalRole(role);

  if (portal === 'admin' && normalizedRole === 'manager') {
    return '/manager';
  }

  if (portal === 'admin' && normalizedRole === 'developer') {
    return '/developer';
  }

  if (portal === 'admin' && normalizedRole === 'owner') {
    return PORTAL_HOME[portal];
  }

  if (canAccessPortal(normalizedRole, portal)) {
    return PORTAL_HOME[portal];
  }

  return getDefaultPortalPath(normalizedRole);
}
