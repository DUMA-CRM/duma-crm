'use client';

import Link from 'next/link';

import { AlertTriangle, ArrowRight, CheckCircle2, ChevronDown } from '@/components/icons';
import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

/* The "does anything need me" panel, shared by every surface that asks it.
   Started as the dashboard's exception strip and is now also the employee's
   "needs you" list on My HR.

   It stays collapsed by default and keeps the first few labels in the summary
   line, so a reader learns whether anything is wrong — and roughly what —
   without the panel pushing the rest of the page below the fold. The healthy
   state is stated just as explicitly, and just as quietly. */

export type AttentionTone = 'exception' | 'measured' | 'stock' | 'reference';

const TONE_TEXT: Record<AttentionTone, string> = {
  exception: 'text-exception',
  measured: 'text-measured',
  stock: 'text-stock',
  reference: 'text-reference',
};

export interface AttentionItem {
  key: string;
  icon?: IconComponent;
  label: string;
  detail?: string;
  tone: AttentionTone;
  /** Navigates. Use `onSelect` instead for a row that opens something in place. */
  href?: string;
  onSelect?: () => void;
  /** Names what the row does, e.g. "Add bank details". Shown before the arrow. */
  actionLabel?: string;
}

export function AttentionList({
  items,
  loading = false,
  error = false,
  onRetry,
  clearTitle = 'Nothing needs you',
  clearDescription,
  errorTitle = 'Live checks could not be loaded',
  errorDescription,
  defaultOpen = false,
  className,
}: {
  items: AttentionItem[];
  loading?: boolean;
  error?: boolean;
  onRetry?: () => void;
  clearTitle?: string;
  clearDescription?: string;
  errorTitle?: string;
  errorDescription?: string;
  defaultOpen?: boolean;
  className?: string;
}) {
  if (error) {
    return (
      <div className={cn('flex flex-wrap items-center gap-3 rounded-lg border border-rule/65 bg-card px-4 py-3 text-sm', className)} role="alert">
        <AlertTriangle size={16} className="shrink-0 text-exception" aria-hidden="true" />
        <span className="font-semibold text-foreground">{errorTitle}</span>
        {errorDescription && <span className="text-muted-foreground">{errorDescription}</span>}
        {onRetry && (
          <button onClick={onRetry} className="ml-auto rounded-sm border border-rule px-2.5 py-1 text-xs font-semibold hover:bg-band">
            Try again
          </button>
        )}
      </div>
    );
  }

  if (loading) return <div className={cn('h-12 animate-pulse rounded-lg bg-band', className)} aria-hidden="true" />;

  if (items.length === 0) {
    return (
      <div className={cn('flex items-center gap-3 rounded-lg border border-rule/65 bg-card px-4 py-3', className)}>
        <CheckCircle2 size={16} className="shrink-0 text-momentum" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">{clearTitle}</p>
        {clearDescription && <p className="hidden text-sm text-muted-foreground sm:block">{clearDescription}</p>}
      </div>
    );
  }

  return (
    <details open={defaultOpen} className={cn('group rounded-lg border border-exception/35 bg-card open:shadow-sm', className)}>
      <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-band/50">
        <AlertTriangle size={16} className="shrink-0 text-exception" aria-hidden="true" />
        <p className="text-sm font-semibold text-foreground">
          {items.length} {items.length === 1 ? 'thing needs' : 'things need'} you
        </p>
        {/* A preview, so the collapsed state still says what is wrong. */}
        <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
          {items
            .slice(0, 3)
            .map((item) => item.label)
            .join(' · ')}
          {items.length > 3 && ` · +${items.length - 3} more`}
        </p>
        <ChevronDown size={16} className="shrink-0 text-muted-foreground transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <ul className="divide-y divide-rule/45 border-t border-rule/45">
        {items.map((item) => (
          <li key={item.key}>
            <AttentionRow item={item} />
          </li>
        ))}
      </ul>
    </details>
  );
}

const ROW = 'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-band/50';

function AttentionRow({ item }: { item: AttentionItem }) {
  const Icon = item.icon;
  const body = (
    <>
      {Icon && <Icon size={15} className={cn('shrink-0', TONE_TEXT[item.tone])} aria-hidden="true" />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{item.label}</span>
        {item.detail && <span className="block truncate text-xs text-muted-foreground">{item.detail}</span>}
      </span>
      {item.actionLabel && <span className="hidden shrink-0 text-xs font-semibold text-muted-foreground sm:block">{item.actionLabel}</span>}
      <ArrowRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </>
  );

  if (item.href)
    return (
      <Link href={item.href} className={ROW}>
        {body}
      </Link>
    );

  if (item.onSelect)
    return (
      <button type="button" onClick={item.onSelect} className={ROW}>
        {body}
      </button>
    );

  return <div className={ROW}>{body}</div>;
}
