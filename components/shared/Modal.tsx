'use client';

import { X } from '@/components/icons';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';

import { Button } from '../ui/button';

interface ModalProps {
  title: string;
  /** Sub-line under the title. Say what the dialog does, not that it is a dialog. */
  description?: string;
  onClose: () => void;
  /**
   * Pinned below the scrolling body — Cancel / confirm live here.
   *
   * Every dialog in the app used to draw its own button row inside `children`,
   * which meant three different footers for three equally-weighted tasks and,
   * worse, confirm buttons that scrolled out of sight on a long form. Same
   * contract as `Drawer`, so a task reads the same whichever chrome it lands in.
   */
  footer?: React.ReactNode;
  /** Extra controls right of the title, left of the close button. */
  actions?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  className?: string;
}

type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

const SIZES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-xl',
  xl: 'max-w-2xl',
};

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function Modal({ title, description, onClose, footer, actions, size = 'md', children, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Portal to <body> so `fixed` positioning is relative to the viewport, not a
  // transformed ancestor (e.g. the slide-in page sidebar). Mount-gate for SSR.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

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

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[90vh] w-full flex-col rounded-sm border border-rule bg-card shadow-xl outline-none',
          'duration-150 animate-in fade-in-0 zoom-in-95',
          SIZES[size],
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-rule px-6 pb-4 pt-5">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close dialog">
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && <div className="shrink-0 border-t border-rule bg-band/65 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
