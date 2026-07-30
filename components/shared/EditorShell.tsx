'use client';

import { ArrowLeft } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Button } from '@/components/ui/button';

/**
 * In-page full-height editor/detail shell (keeps the app sidebar + header visible).
 * Negative margins cancel the <main> padding so it fills the content area
 * edge-to-edge, with a sticky header (back + title + actions) over a scrollable
 * body. Shared by every full-page view: menu items, modifiers, recipes, inventory,
 * staff records, reports and the email editors.
 *
 * Pass `dirty` for forms with unsaved work — Escape and the back button then ask
 * before discarding, and so does a browser reload.
 *
 * Omit `onClose` for top-level pages that aren't drilled into (e.g. My HR): the
 * back button and the Escape handler drop out, leaving the header/tabs/body shell.
 */
export function EditorShell({
  eyebrow,
  title,
  icon,
  leading,
  meta,
  onClose,
  actions,
  subheader,
  flush = false,
  dirty = false,
  discardMessage = 'Your changes have not been saved yet. Leaving now discards them.',
  children,
}: {
  eyebrow?: string;
  title: string;
  /** Small glyph shown in a tinted badge left of the title. */
  icon?: React.ReactNode;
  /** Rendered left of the title as-is (e.g. an avatar) — replaces `icon`. */
  leading?: React.ReactNode;
  /** Badges or status text shown under the title. */
  meta?: React.ReactNode;
  /** Omit on top-level pages — the back button and Escape-to-close are then off. */
  onClose?: () => void;
  actions?: React.ReactNode;
  /** Pinned below the header, above the scrolling body (e.g. section tabs). */
  subheader?: React.ReactNode;
  /** Give children the full body area with no padding or max width — they own their scrolling (e.g. split panes). */
  flush?: boolean;
  /** True while the page holds unsaved changes — enables the discard guard. */
  dirty?: boolean;
  discardMessage?: string;
  children: React.ReactNode;
}) {
  const [confirmingClose, setConfirmingClose] = useState(false);

  const attemptClose = useCallback(() => {
    if (!onClose) return;
    if (dirty) {
      setConfirmingClose(true);
      return;
    }
    onClose();
  }, [dirty, onClose]);

  // Escape goes back — unless a dialog is open, which owns Escape itself.
  useEffect(() => {
    if (!onClose) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || document.querySelector('[role="dialog"]')) return;
      attemptClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [attemptClose, onClose]);

  // Reloading or closing the tab mid-edit gets the browser's own warning.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  return (
    <div className="flex flex-col -m-4 md:-m-8 h-[calc(100vh-var(--header-height))] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 md:px-8 py-3.5 border-b border-border shrink-0 bg-card">
        <div className="flex items-center gap-3 min-w-0">
          {onClose && (
            <Button variant="ghost" size="icon" onClick={attemptClose} aria-label="Back" className="size-11 shrink-0">
              <ArrowLeft size={20} />
            </Button>
          )}
          {leading ??
            (icon && <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">{icon}</div>)}
          <div className="min-w-0">
            {eyebrow && <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{eyebrow}</p>}
            <h1 className="text-lg font-semibold text-foreground truncate">{title}</h1>
            {meta && <div className="mt-0.5 flex flex-wrap items-center gap-2">{meta}</div>}
          </div>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {subheader}

      {/* Body */}
      {flush ? (
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          <div className="max-w-8xl mx-auto p-4 md:p-8">{children}</div>
        </div>
      )}

      {confirmingClose && (
        <ConfirmModal
          title="Discard changes?"
          message={discardMessage}
          confirmLabel="Discard"
          pendingLabel="Discarding…"
          onConfirm={() => {
            setConfirmingClose(false);
            onClose?.();
          }}
          onClose={() => setConfirmingClose(false)}
        />
      )}
    </div>
  );
}
