import { Plus, Search } from 'lucide-react';

import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { TIER_FILTERS } from '@/lib/constants/customers';
import type { FilterOption } from '@/types/customers';

interface CustomerSearchProps {
  query: string;
  filter: FilterOption;
  onQuery: (q: string) => void;
  onFilter: (f: FilterOption) => void;
  onClick: () => void;
  tenantId: string | null;
}

export function CustomerSearch({ query, filter, onQuery, onFilter, onClick, tenantId }: CustomerSearchProps) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <Input
        leftIcon={<Search size={16} />}
        type="search"
        value={query}
        onChange={(e) => onQuery(e.target.value)}
        placeholder="Search by name, email or phone…"
      />
      <div className="flex items-center gap-2 justify-between">
        <SegmentedControl options={TIER_FILTERS} value={filter} onChange={onFilter} />
        {tenantId && (
          <Button onClick={onClick}>
            <Plus size={16} aria-hidden="true" />
            New
          </Button>
        )}
      </div>
    </div>
  );
}
