'use client';

import { RowTile } from '@/components/cms/rows';
import { ChevronDown, Info } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';

import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// The newer drawers' vocabulary — Media's file drawer first, then a customer's
// address: titled groups, each one white card of rows with an icon tile.
// ---------------------------------------------------------------------------

/** A titled group in a drawer — the heading above, its rows together in one white card, as the order drawer does it. */
export function DrawerSection({
  id,
  title,
  count,
  action,
  children,
}: {
  id: string;
  title: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-2 flex min-h-7 items-center justify-between gap-2">
        <h3 id={id} className="text-sm font-semibold text-foreground">
          {title}
          {count ? <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">{count}</span> : null}
        </h3>
        {action}
      </div>
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-control">{children}</div>
    </section>
  );
}

/**
 * One detail on one line — icon, name, what it is set to — that opens its
 * input underneath on a tap, as the Schedule card does on an entry.
 */
export function DetailRow({
  icon,
  title,
  value,
  muted,
  tone,
  info,
  open,
  onToggle,
  children,
}: {
  icon: IconComponent;
  title: string;
  value: string;
  muted?: boolean;
  tone?: 'warning';
  info?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-rule/45 last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        <RowTile icon={icon} tone={tone} />
        <span className="flex shrink-0 items-center gap-1 text-sm font-semibold text-foreground">
          {title}
          {info && (
            <Tooltip side="top" wrap label={info}>
              <span className="text-muted-foreground hover:text-foreground">
                <Info size={13} aria-label="About" />
              </span>
            </Tooltip>
          )}
        </span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-right text-sm',
            tone === 'warning' ? 'font-medium text-measured' : muted ? 'text-muted-foreground/70' : 'text-muted-foreground',
          )}
        >
          {value}
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>
      {open && <div className="bg-band/25 px-4 pb-3.5 pt-1">{children}</div>}
    </div>
  );
}

/**
 * One field on one line: tile and name on the left, the input filling the
 * rest — for a form typed straight through, where opening each row would be
 * a tap too many. Its error sits under the input.
 */
export function FieldLine({
  icon,
  title,
  htmlFor,
  error,
  children,
}: {
  icon: IconComponent;
  title: string;
  htmlFor: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 border-b border-rule/45 px-4 py-2.5 last:border-b-0">
      <RowTile icon={icon} tone={error ? 'danger' : 'default'} />
      <label htmlFor={htmlFor} className="w-24 shrink-0 pt-1.5 text-sm font-semibold text-foreground sm:w-28">
        {title}
      </label>
      <div className="min-w-0 flex-1">
        {children}
        {error && <p className="mt-1 text-xs text-exception">{error}</p>}
      </div>
    </div>
  );
}
