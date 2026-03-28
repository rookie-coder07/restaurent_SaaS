import { LogOut, Loader } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';

export default function PortalLogoutButton({ portal = 'admin', className = '', label = 'Log Out' }) {
  const { logout } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout(portal);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoggingOut}
      className={`inline-flex min-h-[3rem] items-center justify-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] backdrop-blur-md transition-all hover:scale-[1.02] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {isLoggingOut ? <Loader className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
      <span>{isLoggingOut ? 'Signing Out...' : label}</span>
    </button>
  );
}
