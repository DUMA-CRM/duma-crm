'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { X } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

import { Button } from '../ui/button';

interface DrawerProps {
  title: string;
  /** Sub-line under the title. */
  description?: string;
  onClose: () => void;
  /** Pinned to the bottom, outside the scrolling body (e.g. Cancel / Save). */
  footer?: React.ReactNode;
  /** Extra controls right of the title (e.g. a delete button). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Right-hand slide-over for record detail/edit, next to the list it came from.
 * Same dialog contract as `Modal` (portal to <body>, focus trap, Escape closes,
 * focus restored on unmount) — it just docks to the edge and runs full height,
 * so a long form scrolls under a pinned header and footer.
 */
export function Drawer({ title, description, onClose, footer, actions, children, className }: DrawerProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  // Mount-gate for SSR; `fixed` must resolve against the viewport, not a
  // transformed ancestor.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
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
      opener?.focus?.();
    };
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/35" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={cn(
          'relative flex h-full w-full max-w-xl flex-col border-l border-rule/65 bg-card shadow-2xl outline-none',
          'duration-200 animate-in slide-in-from-right',
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-rule/55 bg-background px-5 pb-4 pt-5 sm:px-6">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {actions}
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close panel">
              <X size={16} aria-hidden="true" />
            </Button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">{children}</div>

        {footer && <div className="shrink-0 border-t border-rule/55 bg-band/65 px-5 py-4 sm:px-6">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
