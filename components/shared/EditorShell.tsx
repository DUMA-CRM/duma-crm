'use client';

import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { ArrowLeft } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Button } from '@/components/ui/button';

import { usePageHeaderStore } from '@/stores/pageHeaderStore';

/**
 * In-page full-height editor/detail shell (keeps the app sidebar + header visible).
 * Negative margins cancel the <main> padding so it fills the content area
 * edge-to-edge, with tabs pinned over a scrollable body. Shared by every
 * full-page view: menu items, modifiers, recipes, inventory, staff records,
 * reports and the email editors.
 *
 * The masthead — back, title, meta, actions — is portalled into the app's top
 * bar rather than drawn again below it: one bar, one row of chrome, and the
 * body starts ~64px higher. If the bar isn't there the same row renders inline
 * instead, so nothing is ever stranded.
 * One shell at a time — pages swap an editor in place of the list rather than
 * nesting shells, and two mounted at once would both claim the bar.
 *
 * Pass `dirty` for forms with unsaved work — Escape and the back button then ask
 * before discarding, and so does a browser reload.
 *
 * Omit `onClose` for top-level pages that aren't drilled into (e.g. My HR): the
 * back button and the Escape handler drop out, leaving the tabs/body shell.
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

  // The app's top bar hosts the masthead when it's on screen; otherwise this
  // shell draws it inline.
  const inBar = usePageHeaderStore((s) => s.barVisible);
  const slot = usePageHeaderStore((s) => s.slot);

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

  // Sized for the 56px bar: a single row, everything vertically centred.
  const masthead = (
    <>
      {onClose && (
        <Button variant="ghost" size="icon" onClick={attemptClose} aria-label="Back" className="size-9 shrink-0">
          <ArrowLeft size={19} />
        </Button>
      )}
      {leading ?? (icon && <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/80 text-white">{icon}</div>)}

      <div className="flex min-w-0 items-center gap-2.5">
        <h1
          aria-label={eyebrow ? `${eyebrow}: ${title}` : undefined}
          className="truncate text-base font-semibold tracking-title text-foreground"
        >
          {title}
        </h1>
        {/* Supporting detail, not the identity of the page — first thing to go
            when the row gets tight. */}
        {meta && <div className="hidden min-w-0 items-center gap-2 md:flex">{meta}</div>}
      </div>

      <div className="flex-1" />

      {actions && <div className="flex shrink-0 items-center gap-1.5 md:gap-2">{actions}</div>}

      {/* Separates page actions from the app tools that follow in the bar. */}
      {inBar && <div className="ml-0.5 hidden h-6 w-px shrink-0 bg-divider sm:block" aria-hidden="true" />}
    </>
  );

  return (
    // --header-height is already 0 wherever the bar is hidden, so one calc
    // covers both the portalled and the inline case.
    <div className="flex flex-col -m-4 md:-m-8 h-[calc(100dvh-var(--header-height))] bg-background">
      {inBar ? (
        // Null for the first frame only, until the bar registers its slot.
        slot && createPortal(masthead, slot)
      ) : (
        // Same surface as the bar it stands in for.
        <div className="flex shrink-0 items-center gap-2 border-b border-divider bg-card px-3 py-2 md:px-6">{masthead}</div>
      )}

      {subheader}

      {/* Body */}
      {flush ? (
        <div className="flex-1 min-h-0 flex flex-col">{children}</div>
      ) : (
        <div className="flex-1 min-h-0 overflow-auto">
          {/* x tracks the header (px-3 md:px-6); y keeps its own looser rhythm. */}
          <div className="max-w-8xl mx-auto px-3 py-4 md:px-6 md:py-6 lg:py-8">{children}</div>
        </div>
      )}

      {confirmingClose && (
        <ConfirmModal
          title="Discard changes?"
          message={discardMessage}
          confirmLabel="Discard changes"
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
