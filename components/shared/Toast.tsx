'use client';

import { useEffect } from 'react';

import { CheckCircle2, Info, X, XCircle } from '@/components/icons';

import { cn } from '@/lib/utils/cn';
import { useToastStore } from '@/stores/toastStore';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

/**
 * App-wide toast stack backed by the toast store. Mounted once in
 * QueryProvider — anywhere in the app can call `toast('success', '…')`.
 * (The store only imports the ToastMessage *type* from this file, so there
 * is no runtime import cycle.)
 */
export function GlobalToaster() {
  const toasts = useToastStore((s) => s.toasts);
  const dismiss = useToastStore((s) => s.dismiss);
  return <Toast toasts={toasts} onDismiss={dismiss} />;
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div
      aria-label="Notifications"
      className="fixed bottom-5 left-4 right-4 sm:left-auto sm:right-5 z-50 flex flex-col gap-2 items-end pointer-events-none"
    >
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    // Errors require a decision or recovery and must remain available until the
    // operator dismisses them. Routine confirmations can clear themselves.
    if (toast.type === 'error') return;
    const timer = setTimeout(() => onDismiss(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.type, onDismiss]);

  return (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
      aria-atomic="true"
      className={cn(
        'pointer-events-auto flex items-start gap-3 px-4 py-3 bg-card border rounded-sm shadow-lg w-full sm:w-auto sm:max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200',
        toast.type === 'success' && 'border-success/30',
        toast.type === 'error' && 'border-destructive/30',
        toast.type === 'info' && 'border-primary/30',
      )}
    >
      {toast.type === 'success' ? (
        <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
      ) : toast.type === 'info' ? (
        <Info size={16} className="text-primary shrink-0 mt-0.5" />
      ) : (
        <XCircle size={16} className="text-destructive shrink-0 mt-0.5" />
      )}
      <p className="min-w-0 flex-1 overflow-wrap-anywhere text-sm leading-6 text-foreground">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="-m-2 inline-flex size-9 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:size-8"
        aria-label={`Dismiss ${toast.type} notification`}
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}
