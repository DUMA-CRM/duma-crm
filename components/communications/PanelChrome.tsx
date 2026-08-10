'use client';

import { Search } from '@/components/icons';
import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils/cn';

/**
 * Shared chrome for the four Communications tab panels. Each tab opens with the
 * same three beats — what this is, how many there are, how to narrow it down —
 * so switching tabs never rearranges the furniture.
 */
export function PanelHeader({
  title,
  count,
  description,
  actions,
  className,
}: {
  title: string;
  /** Record count shown as a pill after the title. */
  count?: number;
  description?: React.ReactNode;
  /** Secondary controls for this tab — the primary action lives in the page header. */
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-start justify-between gap-x-4 gap-y-2', className)}>
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
          {title}
          {count !== undefined && (
            <span className="rounded-sm bg-muted px-1.5 py-0.5 text-label font-semibold tabular-nums text-muted-foreground">{count}</span>
          )}
        </h2>
        {description && <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

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
