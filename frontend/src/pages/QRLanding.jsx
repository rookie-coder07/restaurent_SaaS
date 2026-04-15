import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

/**
 * QR Landing Page
 *
 * Keeps the QR handoff isolated from POS/Admin sessions:
 * 1. Clears only app auth/session keys
 * 2. Normalizes QR params from the incoming URL
 * 3. Redirects the user to the public menu in the same tab
 */
export default function QRLanding() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isPreparing, setIsPreparing] = useState(true);

  const tableNumber = useMemo(
    () => decodeURIComponent(String(searchParams.get('table') || '').replace(/\+/g, ' ')).trim(),
    [searchParams]
  );
  const tableId = useMemo(
    () => decodeURIComponent(String(searchParams.get('tableId') || '')).trim(),
    [searchParams]
  );

  const menuPath = useMemo(() => {
    const params = new URLSearchParams();

    if (tableNumber) {
      params.set('table', tableNumber);
    }

    if (tableId) {
      params.set('tableId', tableId);
    }

    params.set('source', 'qr');
    return `/menu?${params.toString()}`;
  }, [tableId, tableNumber]);

  useEffect(() => {
    const storageKeysToClear = [
      'authStorage',
      'auth-store',
      'managerStore',
      'manager-ops-store',
      'token',
      'accessToken',
      'restaurantId',
    ];

    storageKeysToClear.forEach((key) => {
      localStorage.removeItem(key);
      sessionStorage.removeItem(key);
    });

    setIsPreparing(false);
  }, []);

  useEffect(() => {
    if (isPreparing) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      navigate(menuPath, { replace: true });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [isPreparing, menuPath, navigate]);

  const handleContinue = () => {
    navigate(menuPath, { replace: true });
  };

  if (isPreparing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--bg-main)] to-[var(--bg-card)]">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-[var(--bg-card)] p-4">
            <ExternalLink className="h-12 w-12 animate-pulse text-[var(--text-primary)]" />
          </div>
          <p className="text-[var(--text-secondary)]">Preparing your table menu...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[var(--bg-main)] to-[var(--bg-card)] px-4">
      <div className="w-full max-w-md rounded-3xl border border-[var(--border-color)] bg-[var(--bg-card)] p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mb-4 inline-block rounded-full bg-[var(--bg-input)] p-4">
            <ExternalLink className="h-12 w-12 text-[var(--text-primary)]" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Welcome!</h1>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            {tableNumber ? `Table ${tableNumber}` : 'Ready to order?'}
          </p>
        </div>

        <div className="mb-8 rounded-lg bg-[var(--bg-input)] p-4">
          <p className="text-center text-sm text-[var(--text-secondary)]">
            Redirecting you to the public QR menu with a clean customer session.
          </p>
        </div>

        <button
          onClick={handleContinue}
          className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4 font-semibold text-white transition-all duration-200 hover:shadow-lg active:scale-95"
        >
          Continue To Menu
        </button>

        <p className="mt-6 text-center text-xs text-[var(--text-secondary)]">
          If redirect does not happen, tap the button above.
        </p>
      </div>
    </div>
  );
}
