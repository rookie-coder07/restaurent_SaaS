import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

/**
 * QR Landing Page
 * 
 * Prevents session conflicts when QR codes are scanned:
 * 1. Clears existing session/localStorage on mount
 * 2. Extracts table info from URL params
 * 3. Provides button to open menu in new tab (clean session)
 */
export default function QRLanding() {
  const [searchParams] = useSearchParams();
  const [isClearing, setIsClearing] = useState(true);

  const tableNumber = searchParams.get('table');
  const tableId = searchParams.get('tableId');

  useEffect(() => {
    // Clear existing session to prevent role conflicts
    localStorage.removeItem('authStorage');
    localStorage.removeItem('managerStore');
    sessionStorage.clear();

    // Also clear any auth-related cookies
    const cookies = document.cookie.split(';');
    cookies.forEach((cookie) => {
      const eqPos = cookie.indexOf('=');
      const name = eqPos > -1 ? cookie.substring(0, eqPos).trim() : cookie.trim();
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
    });

    // Done clearing
    setIsClearing(false);
  }, []);

  const handleOpenMenu = () => {
    // Build menu URL with table info
    const menuUrl = new URL(`${window.location.origin}/menu`);

    if (tableNumber) {
      menuUrl.searchParams.set('table', tableNumber);
    }
    if (tableId) {
      menuUrl.searchParams.set('tableId', tableId);
    }

    // Open in new tab with clean session
    window.open(menuUrl.toString(), '_blank', 'noopener,noreferrer');
  };

  if (isClearing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--bg-main)] to-[var(--bg-card)]">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-[var(--bg-card)] p-4">
            <ExternalLink className="h-12 w-12 animate-pulse text-[var(--text-primary)]" />
          </div>
          <p className="text-[var(--text-secondary)]">Preparing menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--bg-main)] to-[var(--bg-card)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 shadow-lg">
        {/* Header */}
        <div className="mb-6 text-center">
          <div className="mb-4 inline-block rounded-full bg-[var(--bg-input)] p-4">
            <ExternalLink className="h-12 w-12 text-[var(--text-primary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Welcome!</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {tableNumber ? `Table ${tableNumber}` : 'Ready to order?'}
          </p>
        </div>

        {/* Description */}
        <div className="mb-8 rounded-lg bg-[var(--bg-input)] p-4">
          <p className="text-center text-sm text-[var(--text-secondary)]">
            Tap the button below to view our menu and place your order
          </p>
        </div>

        {/* Action Button */}
        <button
          onClick={handleOpenMenu}
          className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 font-semibold text-white transition-all duration-200 hover:shadow-lg active:scale-95"
        >
          View Menu & Order
        </button>

        {/* Footer Info */}
        <p className="mt-6 text-center text-xs text-[var(--text-secondary)]">
          📱 Menu opens in a new tab
        </p>
      </div>
    </div>
  );
}
