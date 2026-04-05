import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, AlertTriangle, CheckCircle, Info, X } from 'lucide-react';

const TOAST_GAP = 88;
const listeners = new Set();
let activeToastIds = [];

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange() {
  listeners.forEach((listener) => listener(activeToastIds));
}

function registerToast(id) {
  if (!activeToastIds.includes(id)) {
    activeToastIds = [...activeToastIds, id];
    emitChange();
  }
}

function unregisterToast(id) {
  if (activeToastIds.includes(id)) {
    activeToastIds = activeToastIds.filter((value) => value !== id);
    emitChange();
  }
}

export default function Toast({ type = 'success', message, onClose = null, autoDismissMs }) {
  const toastIdRef = useRef(`toast-${Math.random().toString(36).slice(2, 10)}`);
  const [isVisible, setIsVisible] = useState(Boolean(message));
  const [orderedIds, setOrderedIds] = useState(activeToastIds);

  const config = useMemo(
    () =>
      ({
        success: {
          icon: CheckCircle,
          className:
            'border-emerald-300 bg-emerald-50 text-emerald-950 shadow-[0_20px_45px_rgba(16,185,129,0.18)]',
          iconClassName: 'text-emerald-700',
          dismissMs: 3200,
        },
        error: {
          icon: AlertCircle,
          className:
            'border-rose-400 bg-rose-50 text-rose-950 shadow-[0_22px_48px_rgba(244,63,94,0.22)]',
          iconClassName: 'text-rose-700',
          dismissMs: 5200,
        },
        warning: {
          icon: AlertTriangle,
          className:
            'border-amber-400 bg-amber-50 text-amber-950 shadow-[0_22px_48px_rgba(245,158,11,0.2)]',
          iconClassName: 'text-amber-700',
          dismissMs: 4600,
        },
        info: {
          icon: Info,
          className:
            'border-sky-400 bg-sky-50 text-sky-950 shadow-[0_22px_48px_rgba(14,165,233,0.2)]',
          iconClassName: 'text-sky-700',
          dismissMs: 4200,
        },
      })[type] || {
        icon: CheckCircle,
        className:
          'border-[var(--color-border-strong,var(--border-color))] bg-[var(--color-panel)] text-[var(--color-text,var(--text-primary))] shadow-[0_18px_40px_rgba(15,23,42,0.18)]',
        iconClassName: 'text-[var(--color-primary)]',
        dismissMs: 3600,
      },
    [type]
  );

  useEffect(() => subscribe(setOrderedIds), []);

  useEffect(() => {
    if (!message) {
      setIsVisible(false);
      unregisterToast(toastIdRef.current);
      return;
    }

    setIsVisible(true);
    registerToast(toastIdRef.current);

    return () => unregisterToast(toastIdRef.current);
  }, [message]);

  useEffect(() => {
    if (!message || !isVisible) {
      return undefined;
    }

    const dismissTimer = window.setTimeout(() => {
      setIsVisible(false);
      unregisterToast(toastIdRef.current);
      onClose?.();
    }, autoDismissMs ?? config.dismissMs);

    return () => window.clearTimeout(dismissTimer);
  }, [autoDismissMs, config.dismissMs, isVisible, message, onClose]);

  if (!message || !isVisible || typeof document === 'undefined') {
    return null;
  }

  const Icon = config.icon;
  const order = Math.max(0, orderedIds.indexOf(toastIdRef.current));

  return createPortal(
    <div
      className="pointer-events-none fixed left-3 right-3 z-[120] sm:left-auto sm:right-6 sm:w-[min(28rem,calc(100vw-3rem))]"
      style={{ top: `${16 + order * TOAST_GAP}px` }}
    >
      <div
        role={type === 'error' || type === 'warning' ? 'alert' : 'status'}
        aria-live={type === 'error' || type === 'warning' ? 'assertive' : 'polite'}
        className={`pointer-events-auto flex items-start gap-3 rounded-[1.1rem] border px-4 py-3.5 backdrop-blur-xl transition-all duration-200 sm:rounded-[1.35rem] sm:px-4.5 ${config.className}`}
      >
        <div className={`mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-white/75 ${config.iconClassName}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <p className="min-w-0 flex-1 break-words pr-1 text-[0.95rem] font-semibold leading-6 sm:text-sm">{message}</p>
        <button
          type="button"
          onClick={() => {
            setIsVisible(false);
            unregisterToast(toastIdRef.current);
            onClose?.();
          }}
          className="rounded-full p-1.5 text-current/80 transition hover:bg-black/5 hover:text-current focus:outline-none focus:ring-2 focus:ring-current/20"
          aria-label="Dismiss notification"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>,
    document.body
  );
}
