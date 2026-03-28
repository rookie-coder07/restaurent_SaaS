export const PORTAL_ACCESS = {
  admin: ['owner'],
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
  if (pathname.startsWith('/pos')) {
    return 'pos';
  }

  if (pathname.startsWith('/kot')) {
    return 'kot';
  }

  return 'admin';
}

export function getDefaultPortalPath(role) {
  if (role === 'kitchen_staff') {
    return PORTAL_HOME.kot;
  }

  if (role === 'staff') {
    return PORTAL_HOME.pos;
  }

  if (role === 'owner') {
    return PORTAL_HOME.admin;
  }

  return PORTAL_LOGIN.admin;
}

export function getLoginPathForPathname(pathname = '') {
  if (pathname.startsWith('/pos')) {
    return PORTAL_LOGIN.pos;
  }

  if (pathname.startsWith('/kot')) {
    return PORTAL_LOGIN.kot;
  }

  return PORTAL_LOGIN.admin;
}

export function canAccessPortal(role, portal) {
  if (!role || !PORTAL_ACCESS[portal]) {
    return false;
  }

  return PORTAL_ACCESS[portal].includes(role);
}

export function resolvePortalHome(portal, role) {
  if (canAccessPortal(role, portal)) {
    return PORTAL_HOME[portal];
  }

  return getDefaultPortalPath(role);
}
