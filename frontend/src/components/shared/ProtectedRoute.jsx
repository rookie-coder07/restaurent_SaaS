import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../context/authStore';
import { getLoginPathForPathname, resolvePortalHome } from '../../utils/portalRouting';
import { clearPortalSession, getValidPortalSession } from '../../utils/authStorage';

export default function ProtectedRoute({ layout: LayoutComponent = null, allowedRoles = [], portal = 'admin' }) {
  const location = useLocation();
  const { isAuthenticated, user, activePortal, hydratePortal, logout, isHydrated } = useAuthStore();
  const storedSession = getValidPortalSession(portal);
  const hasStoredSession = Boolean(storedSession);
  const loading = !isHydrated;
  const hasSessionForPortal =
    activePortal === portal
      ? Boolean(isAuthenticated && (user || storedSession?.user) && hasStoredSession)
      : hasStoredSession;
  const effectiveUser = activePortal === portal ? user || storedSession?.user : storedSession?.user;
  const userRole = effectiveUser?.role;
  const isRoleInvalid = allowedRoles.length > 0 && Boolean(userRole) && !allowedRoles.includes(userRole);

  // NEVER protect password reset routes
  const isResetPasswordRoute =
    location.pathname === '/reset-password' ||
    location.pathname === '/admin/reset-password' ||
    location.pathname === '/pos/reset-password';

  if (isResetPasswordRoute) {
    console.warn('[ProtectedRoute] Reset password route should not be wrapped in ProtectedRoute. Rendering content directly.');
    return <Outlet />;
  }

  useEffect(() => {
    if (loading) {
      return;
    }

    if (!storedSession && activePortal === portal && isAuthenticated) {
      clearPortalSession(portal);
      logout(portal);
      return;
    }

    if (activePortal !== portal && hasStoredSession) {
      hydratePortal(portal);
    }
  }, [activePortal, hasStoredSession, hydratePortal, isAuthenticated, loading, logout, portal, storedSession]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (activePortal === portal && isAuthenticated && !hasStoredSession) {
      logout(portal);
    }
  }, [activePortal, hasStoredSession, isAuthenticated, loading, logout, portal]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-main)] px-4 text-[var(--text-primary)]">
        <div className="rounded-2xl border border-[var(--border-color)] bg-[var(--bg-card)] px-5 py-4 text-sm font-medium text-[var(--text-secondary)] shadow-[var(--shadow-card)]">
          Restoring your session...
        </div>
      </div>
    );
  }

  if (!hasSessionForPortal) {
    return <Navigate to={getLoginPathForPathname(location.pathname)} replace />;
  }

  if (hasStoredSession && activePortal !== portal) {
    return null;
  }

  if (allowedRoles.length > 0) {
    if (!userRole) {
      return <Navigate to={getLoginPathForPathname(location.pathname)} replace />;
    }

    if (isRoleInvalid) {
      return <Navigate to={resolvePortalHome(portal, userRole)} replace />;
    }
  }

  const content = <Outlet />;

  if (!LayoutComponent) {
    return content;
  }

  return <LayoutComponent>{content}</LayoutComponent>;
}
