import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PORTAL_LOGIN } from '../../utils/portalRouting';

export function AuthSessionRedirectListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleSessionExpired = (event) => {
      const portal = event.detail?.portal || 'admin';
      const redirectTo = event.detail?.redirectTo || PORTAL_LOGIN[portal] || PORTAL_LOGIN.admin;
      navigate(redirectTo, { replace: true });
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, [navigate]);

  return null;
}
