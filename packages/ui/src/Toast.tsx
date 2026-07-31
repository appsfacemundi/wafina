'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

interface ToastItem {
  id: number;
  message: string;
  tone: 'success' | 'error';
}

interface ToastContextValue {
  showToast: (message: string, tone?: 'success' | 'error') => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Institution App Polish module — a single global provider so every
 * successful action (accept donation, confirm collection, save settings,
 * etc.) can surface a consistent ✅ confirmation without each screen
 * reinventing its own banner. Auto-dismisses; doesn't block interaction.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, tone }]);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        style={{
          position: 'fixed',
          bottom: 'var(--space-6, 1.5rem)',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 1000,
          width: 'min(420px, calc(100vw - 32px))',
        }}
      >
        {toasts.map((t) => (
          <ToastBanner key={t.id} toast={t} onDone={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastBanner({ toast, onDone }: { toast: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDone, 3500);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      role="status"
      className={`banner ${toast.tone === 'success' ? 'banner-success' : 'banner-error'}`}
      style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.15)' }}
    >
      {toast.tone === 'success' ? '✅ ' : '⚠️ '}
      {toast.message}
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within a ToastProvider');
  return ctx;
}
