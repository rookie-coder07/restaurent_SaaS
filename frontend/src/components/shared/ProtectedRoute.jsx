import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../context/authStore';
import { getLoginPathForPathname } from '../../utils/portalRouting';
import { hasPortalSession, readPortalSession } from '../../utils/authStorage';

export default function ProtectedRoute({ layout: LayoutComponent = null, allowedRoles = [], portal = 'admin' }) {
  const location = useLocation();
  const { isAuthenticated, user, activePortal, hydratePortal, logout } = useAuthStore();
  const storedSession = readPortalSession(portal);
  const hasStoredSession = hasPortalSession(portal);
  const hasSessionForPortal = activePortal === portal ? Boolean(isAuthenticated && hasStoredSession) : hasStoredSession;
  const effectiveUser = activePortal === portal ? user || storedSession?.user : storedSession?.user;
  const userRole = effectiveUser?.role;
  const isRoleInvalid = allowedRoles.length > 0 && Boolean(userRole) && !allowedRoles.includes(userRole);

  useEffect(() => {
    if (activePortal !== portal && hasStoredSession) {
      hydratePortal(portal);
    }
  }, [activePortal, hasStoredSession, hydratePortal, portal]);

  useEffect(() => {
    if (activePortal === portal && isRoleInvalid) {
      logout(portal);
    }
  }, [activePortal, isRoleInvalid, logout, portal]);

  useEffect(() => {
    if (activePortal === portal && isAuthenticated && !hasStoredSession) {
      logout(portal);
    }
  }, [activePortal, hasStoredSession, isAuthenticated, logout, portal]);

  if (!hasSessionForPortal) {
    return <Navigate to={getLoginPathForPathname(location.pathname)} replace />;
  }

  if (activePortal !== portal) {
    return null;
  }

  if (allowedRoles.length > 0) {
    if (!userRole) {
      return <Navigate to={getLoginPathForPathname(location.pathname)} replace />;
    }

    if (isRoleInvalid) {
      return <Navigate to={getLoginPathForPathname(location.pathname)} replace />;
    }
  }

  const content = <Outlet />;

  if (!LayoutComponent) {
    return content;
  }

  return <LayoutComponent>{content}</LayoutComponent>;
}
