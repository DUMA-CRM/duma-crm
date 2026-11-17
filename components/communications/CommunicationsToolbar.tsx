'use client';

import { Search, X } from '@/components/icons';
import { Input } from '@/components/ui/input';

/**
 * One filter row across Communications, as Forms and Promotions draw theirs:
 * the search, then the inline `Select`s (`w-40`), then the count on the right.
 * With two or three filters the selects already show what's picked, so there
 * is no row of active-filter chips.
 */
export function CommunicationsToolbar({
  search,
  onSearch,
  placeholder,
  label,
  filters,
  count,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  /** The search field's accessible name; defaults to the placeholder. */
  label?: string;
  filters?: React.ReactNode;
  count?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="min-w-56 flex-1">
        <Input
          type="search"
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          aria-label={label ?? placeholder}
          placeholder={placeholder}
          leftIcon={<Search size={14} aria-hidden="true" />}
          rightAction={
            search ? (
              <button
                type="button"
                onClick={() => onSearch('')}
                aria-label="Clear search"
                className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X size={13} aria-hidden="true" />
              </button>
            ) : undefined
          }
        />
      </div>
      {filters}
      {count && (
        <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {count}
        </span>
      )}
    </div>
  );
}
