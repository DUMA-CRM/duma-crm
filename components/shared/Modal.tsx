'use client';

import { X } from 'lucide-react';
import { useEffect, useRef } from 'react';

import { cn } from '@/lib/utils/cn';

import { Button } from '../ui/button';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({ title, onClose, children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    // Move focus into the dialog (first field, else the panel itself).
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      // Trap Tab inside the dialog.
      if (e.key === 'Tab' && panel) {
        const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
        if (focusables.length === 0) return;
        const firstEl = focusables[0];
        const lastEl = focusables[focusables.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === firstEl || active === panel)) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && active === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      // Restore focus to whatever opened the dialog.
      opener?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative bg-card border border-border rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[90vh] outline-none',
          className,
        )}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
            <X size={16} aria-hidden="true" />
          </Button>
        </div>
        <div className="px-6 py-5 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
