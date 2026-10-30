'use client';

import { useEffect, useState } from 'react';

import { CopyGlyph } from '@/components/ui/action-button';

import { cn } from '@/lib/utils/cn';

/**
 * A light code block for the developer docs: a .mkt-card with a soft header
 * holding the label, the tabs (the docs' Segmented look, at header size) and
 * the app's own copy button — the icon pops out and a tick draws in. `tabs`
 * swaps between versions of the same snippet (cURL, JavaScript), each with an
 * optional `footer` line under the code (e.g. the scopes it needs). The text
 * is in the HTML, so it reads and selects without JavaScript too. `prose`
 * sets it in the text face and wraps it — for prompts, which are sentences.
 */
export function CodeBlock({
  code,
  label,
  tabs,
  children,
  prose = false,
  className,
}: {
  code?: string;
  label?: string;
  tabs?: { id: string; label: string; code: string; footer?: React.ReactNode }[];
  /** Pre-highlighted markup for `code` (e.g. coloured JSON); copying still uses `code`. */
  children?: React.ReactNode;
  prose?: boolean;
  className?: string;
}) {
  const [active, setActive] = useState(tabs?.[0]?.id);
  const [copyError, setCopyError] = useState(false);
  const current = tabs?.find((tab) => tab.id === active);
  const text = current?.code ?? code ?? '';

  return (
    <div className={cn('mkt-card overflow-hidden', className)}>
      <div className="flex min-h-10 items-center gap-2 border-b border-[var(--mkt-line)] bg-[color-mix(in_oklab,var(--ink)_4.5%,var(--mkt-card))] py-1 pr-1.5 pl-4">
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-[var(--mkt-ink-2)]">{label}</span>
        {tabs && tabs.length > 1 && (
          <div role="group" aria-label={`${label ?? 'Code'} versions`} className="flex shrink-0 items-center gap-0.5 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActive(tab.id)}
                aria-pressed={tab.id === active}
                className={cn(
                  'h-7 rounded-[6px] px-2.5 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
                  tab.id === active
                    ? 'bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] text-[var(--mkt-heading)]'
                    : 'text-[var(--mkt-ink-2)] hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] hover:text-[var(--mkt-heading)]',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
        {tabs && tabs.length > 1 && <span className="h-4 w-px shrink-0 bg-[var(--mkt-line)]" aria-hidden="true" />}
        <CopyIconButton text={text} label={prose ? 'prompt' : 'code'} onResult={(ok) => setCopyError(!ok)} />
      </div>
      <pre
        tabIndex={0}
        aria-label={label ?? 'Code example'}
        className={cn(
          'max-h-[32rem] overflow-auto px-4 py-3.5 text-foreground focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none focus-visible:ring-inset',
          prose
            ? 'font-sans text-[0.9375rem] leading-relaxed text-pretty whitespace-pre-wrap'
            : 'font-mono text-[12.5px] leading-[1.7]',
        )}
      >
        <code className={prose ? 'font-sans' : undefined}>{current ? current.code : (children ?? code)}</code>
      </pre>
      {current?.footer && (
        <div className="flex min-h-9 items-center border-t border-[var(--mkt-line)] bg-[color-mix(in_oklab,var(--ink)_4.5%,var(--mkt-card))] px-4 py-1.5 text-xs text-[var(--mkt-ink-2)]">
          {current.footer}
        </div>
      )}
      {copyError && (
        <p role="alert" className="border-t border-[var(--mkt-line)] px-4 py-2 text-xs text-destructive">
          Could not copy. Select the code and copy it manually.
        </p>
      )}
    </div>
  );
}

/**
 * The app's copy button at docs size: the icon pops out and a tick draws in
 * for a moment. `onResult` reports whether the clipboard took it.
 */
export function CopyIconButton({
  text,
  label,
  onResult,
  className,
}: {
  text: string;
  /** What is copied, for screen readers ("code", "URL"). */
  label: string;
  onResult?: (ok: boolean) => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          onResult?.(true);
        } catch {
          onResult?.(false);
        }
      }}
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-[6px] transition-colors focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none',
        copied ? 'text-success' : 'text-[var(--mkt-ink-3)] hover:bg-[color-mix(in_oklab,var(--ink)_6%,transparent)] hover:text-[var(--mkt-heading)]',
        className,
      )}
      aria-label={copied ? `Copied ${label}` : `Copy ${label}`}
    >
      <CopyGlyph copied={copied} className="size-3.5" />
      <span role="status" className="sr-only">
        {copied ? `${label} copied to clipboard` : ''}
      </span>
    </button>
  );
}
