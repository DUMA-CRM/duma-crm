'use client';

import { Search } from '@/components/icons';
import { FilterChip } from '@/components/shared/FilterChip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/** One filter layout across Communications; selected filters get their own row. */
export function CommunicationsToolbar({
  search,
  onSearch,
  placeholder,
  filters,
  chips = [],
  onClear,
  count,
}: {
  search: string;
  onSearch: (value: string) => void;
  placeholder: string;
  filters?: React.ReactNode;
  chips?: { label: string; onRemove: () => void }[];
  onClear?: () => void;
  count?: React.ReactNode;
}) {
  const active = search.trim() || chips.length > 0;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <div className="col-span-2 min-w-0 sm:min-w-56 sm:flex-1">
          <Input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            aria-label={placeholder}
            placeholder={placeholder}
            leftIcon={<Search size={16} aria-hidden="true" />}
          />
        </div>
        {filters}
        {count && (
          <span className="col-span-2 text-xs tabular-nums text-muted-foreground sm:ml-auto" role="status">
            {count}
          </span>
        )}
      </div>
      {active && (
        <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
          {search.trim() && <FilterChip variant="tag" label={`Search: ${search.trim()}`} onRemove={() => onSearch('')} />}
          {chips.map((chip) => (
            <FilterChip key={chip.label} variant="tag" {...chip} />
          ))}
          {onClear && (
            <Button variant="ghost" size="sm" onClick={onClear}>
              Clear filters
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
