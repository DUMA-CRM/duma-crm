import { ChevronLeft, ChevronRight, Users } from 'lucide-react';

import { CustomerRow } from '@/components/customers/CustomerRow';
import { SkeletonRow } from '@/components/customers/SkeletonRow';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { Customer } from '@/types/customers';

interface CustomerListProps {
  customers: Customer[];
  selectedId: string | null;
  onSelect: (c: Customer) => void;
  isLoading?: boolean;
  page: number;
  totalPages: number;
  total: number;
  onPage: (p: number) => void;
}

export function CustomerList({ customers, selectedId, onSelect, isLoading, page, totalPages, total, onPage }: CustomerListProps) {
  function renderContent() {
    if (isLoading) {
      return Array.from({ length: 8 }, (_, i) => `skeleton-row-${i}`).map((key) => <SkeletonRow key={key} />);
    }

    if (customers.length === 0) {
      return <EmptyState icon={Users} title="No customers found" description="Try adjusting your search or filter" />;
    }

    return customers.map((c) => <CustomerRow key={c.id} customer={c} isSelected={selectedId === c.id} onSelect={onSelect} />);
  }

  return (
    <div className="flex flex-col h-full min-h-0 pb-4">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2">{renderContent()}</div>
      </ScrollArea>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 border-t border-border shrink-0">
          <Button variant="outline" size="sm" onClick={() => onPage(1)} disabled={page === 1}>
            <ChevronLeft size={16} aria-hidden="true" />
            Prev
          </Button>
          <span className="text-sm text-muted-foreground">
            {total.toLocaleString()} customers · page {page}/{totalPages}
          </span>
          <Button variant="outline" size="sm" onClick={() => onPage(page + 1)} disabled={page === totalPages}>
            Next
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      )}
    </div>
  );
}
