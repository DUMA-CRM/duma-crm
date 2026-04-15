import { Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { TIER_FILTERS } from '@/lib/constants/customers';
import type { FilterOption } from '@/types/customers';
import { SegmentedControl } from '../shared/SegmentedControl';

interface CustomerSearchProps {
  query: string;
  filter: FilterOption;
  onQuery: (q: string) => void;
  onFilter: (f: FilterOption) => void;
  totalShown: number;
  totalAll: number;
}

export function CustomerSearch({ query, filter, onQuery, onFilter, totalShown, totalAll }: CustomerSearchProps) {
  return (
    <div className="flex flex-col gap-3 mb-4">
      {/* Search input */}
      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search by name, email or phone…"
          className="w-full h-10 bg-background border border-border rounded-lg pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-primary transition-colors"
        />
      </div>

      {/* Filter pills + count */}
      <div className="flex items-center justify-between">
        <SegmentedControl options={TIER_FILTERS} value={filter} onChange={onFilter} />
        <p className="text-xs text-muted-foreground shrink-0">
          {totalShown} of {totalAll}
        </p>
      </div>
    </div>
  );
}
