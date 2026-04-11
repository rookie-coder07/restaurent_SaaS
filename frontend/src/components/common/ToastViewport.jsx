import { useEffect, useState } from 'react';
import Toast from './Toast';

export default function ToastViewport() {
  const [toast, setToast] = useState({ type: 'error', message: '' });

  useEffect(() => {
    const handleToast = (event) => {
      const nextToast = event?.detail;
      if (!nextToast?.message) {
        return;
      }

      setToast({
        type: nextToast.type || 'error',
        message: nextToast.message,
      });
    };

    window.addEventListener('app:toast', handleToast);
    return () => window.removeEventListener('app:toast', handleToast);
  }, []);

  return toast.message ? (
    <Toast
      type={toast.type}
      message={toast.message}
      onClose={() => setToast({ type: 'error', message: '' })}
    />
  ) : null;
}
