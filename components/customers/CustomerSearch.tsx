import { Search } from 'lucide-react';
import { SegmentedControl } from '../shared/SegmentedControl';
import type { FilterOption } from '@/types/customers';

const TIER_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'vip', label: 'VIP' },
  { value: 'gold', label: 'Gold' },
  { value: 'silver', label: 'Silver' },
  { value: 'bronze', label: 'Bronze' },
] as const;

interface CustomerSearchProps {
  query: string;
  filter: FilterOption;
  onQuery: (q: string) => void;
  onFilter: (f: FilterOption) => void;
  total: number;
}

export function CustomerSearch({ query, filter, onQuery, onFilter, total }: CustomerSearchProps) {
  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search by name, email or phone…"
          className="w-full h-10 bg-background border border-border rounded-lg pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/15 focus:border-primary transition-colors"
        />
      </div>
      <div className="flex items-center justify-between">
        <SegmentedControl options={TIER_FILTERS} value={filter} onChange={onFilter} />
        <p className="text-xs text-muted-foreground tabular-nums shrink-0">
          {total.toLocaleString()} customer{total !== 1 ? 's' : ''}
        </p>
      </div>
    </div>
  );
}
