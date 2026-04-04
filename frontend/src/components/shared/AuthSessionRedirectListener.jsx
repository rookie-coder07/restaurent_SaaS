import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function AuthSessionRedirectListener() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleSessionExpired = (event) => {
      const redirectTo = event.detail?.redirectTo || '/admin/login';
      navigate(redirectTo, { replace: true });
    };

    window.addEventListener('auth:session-expired', handleSessionExpired);

    return () => {
      window.removeEventListener('auth:session-expired', handleSessionExpired);
    };
  }, [navigate]);

  return null;
}
