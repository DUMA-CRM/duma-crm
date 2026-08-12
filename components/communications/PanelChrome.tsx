'use client';

import { Search } from '@/components/icons';
import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils/cn';

/**
 * Shared chrome for the Communications tab panels.
 *
 * There used to be a `PanelHeader` here too — a title, a count and a sentence of
 * explanation at the top of every tab. The title restated the tab you had just
 * clicked, and the description taught something once and then charged a row of
 * vertical space for it on every visit afterwards. What was worth keeping is
 * below: the filter row, the search box, and the count that only appears while a
 * filter is narrowing things.
 */

/** Filter row: controls from the left, search and result count pushed to the right. */
export function PanelToolbar({ children, trailing }: { children?: React.ReactNode; trailing?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      {trailing && <div className="ml-auto flex flex-wrap items-center justify-end gap-2">{trailing}</div>}
    </div>
  );
}

/** The search box every panel filters with — same size and affordances each time. */
export function PanelSearch({
  value,
  onChange,
  placeholder,
  label,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  className?: string;
}) {
  return (
    <div className={cn('w-full max-w-xs', className)}>
      <Input
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        leftIcon={<Search size={14} />}
        placeholder={placeholder}
        aria-label={label}
      />
    </div>
  );
}

/** "12 of 30" — muted, tabular, only worth showing while a filter is narrowing things. */
export function ResultCount({ shown, total, noun }: { shown: number; total: number; noun?: string }) {
  return (
    <span className="text-xs text-muted-foreground tabular-nums">
      {shown} of {total}
      {noun ? ` ${noun}` : ''}
    </span>
  );
}
