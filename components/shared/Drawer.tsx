'use client';

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import { X } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

interface DrawerProps {
  title: string;
  /** Sub-line under the title. */
  description?: React.ReactNode;
  onClose: () => void;
  /** Pinned to the bottom, outside the scrolling body (e.g. Cancel / Save). */
  footer?: React.ReactNode;
  /** Extra controls right of the title (e.g. a delete button). */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /**
   * `false` for a panel that works *alongside* the page — the assistant. No
   * backdrop, no focus trap, the page stays usable, and it does not announce
   * itself as a drawer (other side panels make room for drawers, not for it).
   */
  modal?: boolean;
  /** Before the title — a mark or avatar. */
  leading?: React.ReactNode;
  /** Replaces the default "Close panel". */
  closeLabel?: string;
  /** Read out as it changes (a live status line) rather than once. */
  liveDescription?: boolean;
  panelRef?: React.RefObject<HTMLDivElement | null>;
  bodyRef?: React.RefObject<HTMLDivElement | null>;
  onBodyScroll?: React.UIEventHandler<HTMLDivElement>;
  /** Replaces the body's default padding. */
  bodyClassName?: string;
  /** Replaces the footer's default padding. */
  footerClassName?: string;
  /** Position and size of the panel, e.g. offset to sit beside an open drawer. */
  style?: React.CSSProperties;
}

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

/**
 * Right-hand slide-over for record detail/edit, next to the list it came from.
 * Same dialog contract as `Modal` (portal to <body>, focus trap, Escape closes,
 * focus restored on unmount) — it just docks to the edge and runs full height,
 * so a long form scrolls under a pinned header and footer.
 *
 * With `modal={false}` it is the same frame without the dialog contract: the
 * caller owns focus, keys and position.
 */
export function Drawer({
  title,
  description,
  onClose,
  footer,
  actions,
  children,
  className,
  modal = true,
  leading,
  closeLabel = 'Close panel',
  liveDescription = false,
  panelRef: externalPanelRef,
  bodyRef,
  onBodyScroll,
  bodyClassName,
  footerClassName,
  style,
}: DrawerProps) {
  const ownPanelRef = useRef<HTMLDivElement>(null);
  const panelRef = externalPanelRef ?? ownPanelRef;
  // Held in a ref so the focus effect runs once per opening. Callers pass
  // inline handlers; depending on one re-ran the effect on every parent render,
  // which bounced focus to the opener and back to the first control — out of
  // whatever field was being typed in.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  // Mount-gate for SSR; `fixed` must resolve against the viewport, not a
  // transformed ancestor.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  useEffect(() => {
    if (!modal) return;
    const opener = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;

    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel)?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
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
  }, [modal, panelRef]);

  useEffect(() => {
    if (!modal || !panelRef.current) return;
    window.dispatchEvent(new CustomEvent('duma:drawer-change'));
    return () => {
      window.dispatchEvent(new CustomEvent('duma:drawer-change'));
    };
  }, [modal, panelRef]);

  if (!mounted) return null;

  const panel = (
    <div
      ref={panelRef}
      data-duma-drawer={modal ? '' : undefined}
      role="dialog"
      aria-modal={modal ? 'true' : undefined}
      aria-label={title}
      tabIndex={-1}
      style={modal ? undefined : style}
      className={cn(
        'relative flex h-full w-full max-w-xl flex-col overflow-hidden bg-background shadow-2xl outline-none',
        'sm:rounded-xl sm:border sm:border-rule/60',
        'duration-300 ease-out animate-in slide-in-from-right-8 fade-in-0',
        !modal && 'pointer-events-auto',
        className,
      )}
    >
      {/* With a leading mark the row centres on one line — mark, title block and buttons share a
          middle. Without one, a long description wraps and the close button stays top-right. */}
      <header
        className={cn(
          'flex shrink-0 gap-3 border-b border-rule/50 bg-field px-5 sm:px-6',
          leading ? 'items-center py-4' : 'items-start pt-5 pb-4',
        )}
      >
        {leading && <div className="shrink-0">{leading}</div>}
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-base font-semibold tracking-title text-foreground">{title}</h2>
          {description && (
            <p
              className="mt-1 truncate text-sm leading-relaxed text-muted-foreground"
              role={liveDescription ? 'status' : undefined}
              aria-live={liveDescription ? 'polite' : undefined}
            >
              {description}
            </p>
          )}
        </div>
        <div className={cn('flex shrink-0 items-center gap-1.5', !leading && '-mt-1')}>
          {actions}
          <DrawerHeaderButton onClick={onClose} label={closeLabel}>
            <X size={15} aria-hidden="true" />
          </DrawerHeaderButton>
        </div>
      </header>

      <div ref={bodyRef} onScroll={onBodyScroll} className={cn('min-h-0 flex-1 overflow-y-auto', bodyClassName ?? 'px-5 py-5 sm:px-6')}>
        {children}
      </div>

      {footer && (
        <div data-drawer-footer className={cn('shrink-0 border-t border-rule/50 bg-field', footerClassName ?? 'px-5 py-4 sm:px-6')}>
          {footer}
        </div>
      )}
    </div>
  );

  return createPortal(
    // Floats inset from the edge on anything wider than a phone — the
    // settings page's porcelain panel, docked right — and runs edge to edge
    // on a phone, where every pixel of width counts.
    modal ? (
      <div className="fixed inset-0 z-50 flex justify-end sm:p-2">
        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] duration-200 animate-in fade-in-0" onClick={onClose} />
        {panel}
      </div>
    ) : (
      // Clicks pass through everywhere but the panel, so the page stays usable.
      <div className="pointer-events-none fixed inset-0 z-[70] flex justify-end sm:p-2">{panel}</div>
    ),
    document.body,
  );
}

/**
 * An icon button for a drawer's header, in the close button's own style — so
 * extra header actions line up with it instead of mixing two button families.
 */
export function DrawerHeaderButton({
  label,
  onClick,
  pressed,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  /** For a toggle (e.g. history open, wide mode). */
  pressed?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      className={cn(
        'flex size-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50',
        pressed
          ? 'border-primary/40 bg-primary/8 text-primary'
          : 'border-rule/60 bg-background text-muted-foreground hover:bg-band hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}
