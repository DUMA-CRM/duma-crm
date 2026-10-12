'use client';

import { RowTile } from '@/components/cms/rows';
import { ChevronDown, type IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

/**
 * A choice on one line — tile, name, what it's set to — that opens its control
 * underneath on a tap. Built like an `InfoRow`, so it sits in the same rhythm
 * as the facts around it.
 */
export function PickerRow({
  icon,
  title,
  value,
  muted = false,
  open,
  onToggle,
  children,
}: {
  icon: IconComponent;
  title: string;
  value: string;
  /** The value is a placeholder — nothing set yet. */
  muted?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <span className="flex shrink-0 items-center gap-3">
          <RowTile icon={icon} />
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
        </span>
        <span
          className={cn(
            'flex min-w-0 items-center gap-1.5 text-sm',
            muted ? 'font-normal text-muted-foreground/70' : 'font-semibold text-foreground',
          )}
        >
          <span className="truncate">{value}</span>
          <ChevronDown size={14} className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </span>
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
