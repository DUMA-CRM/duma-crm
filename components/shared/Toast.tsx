'use client';

import { CheckCircle2, X, XCircle } from 'lucide-react';
import { useEffect } from 'react';

import { cn } from '@/lib/utils/cn';

export interface ToastMessage {
  id: number;
  type: 'success' | 'error';
  message: string;
}

interface ToastProps {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}

export function Toast({ toasts, onDismiss }: ToastProps) {
  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
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
        'pointer-events-auto flex items-start gap-3 px-4 py-3 bg-card border rounded-xl shadow-lg max-w-sm animate-in fade-in slide-in-from-bottom-2 duration-200',
        toast.type === 'success' ? 'border-success/30' : 'border-destructive/30',
      )}
    >
      {toast.type === 'success' ? (
        <CheckCircle2 size={16} className="text-success shrink-0 mt-0.5" />
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
