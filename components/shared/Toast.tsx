'use client';

import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';

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
      role="status"
      aria-live="polite"
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
    const timer = setTimeout(() => onDismiss(toast.id), toast.type === 'error' ? 6000 : 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.type, onDismiss]);

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-3 px-4 py-3 bg-card border rounded-xl shadow-lg w-full sm:w-auto sm:max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200',
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
      <p className="text-xs font-medium text-foreground flex-1 leading-relaxed">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
        aria-label="Dismiss"
      >
        <X size={13} />
      </button>
    </div>
  );
}
