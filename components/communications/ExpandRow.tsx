'use client';

import { useState } from 'react';

import { RowTile } from '@/components/cms/rows';
import { ChevronDown } from '@/components/icons';
import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

/**
 * One setting in the Schedule card's shape: icon tile and title, the current
 * value on the right as the button that opens its input underneath — the card
 * stays a column of quiet one-liners until something is being edited. Starts
 * open when empty, since an empty required field is the next thing to fill.
 */
export function ExpandRow({
  icon,
  title,
  value,
  htmlFor,
  warn = false,
  children,
}: {
  icon: IconComponent;
  title: string;
  /** Shown collapsed; '' reads as "Not set". */
  value: string;
  /** The input's id — focused when the row is opened. */
  htmlFor?: string;
  /** Tint the value: it needs a look (e.g. preview text too long). */
  warn?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => !value.trim());
  const toggle = () => {
    setOpen((current) => !current);
    // After the input has rendered.
    if (!open && htmlFor) requestAnimationFrame(() => document.getElementById(htmlFor)?.focus());
  };
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex shrink-0 items-center gap-3">
          <RowTile icon={icon} />
          {htmlFor && open ? (
            <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
              {title}
            </label>
          ) : (
            <p className="text-sm font-semibold text-foreground">{title}</p>
          )}
        </div>
        <button
          type="button"
          aria-expanded={open}
          aria-label={`${open ? 'Close' : 'Edit'} ${title.toLowerCase()}`}
          onClick={toggle}
          className={cn(
            '-mr-2 inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-band/60 focus-visible:outline-2 focus-visible:outline-ring',
            warn ? 'font-medium text-measured' : value.trim() ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          <span className="truncate">{value.trim() || 'Not set'}</span>
          <ChevronDown size={14} className={cn('shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </div>
      {open && <div className="mt-3 space-y-1.5">{children}</div>}
    </div>
  );
}
