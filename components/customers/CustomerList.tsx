import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { CustomerRow } from './CustomerRow';
import { EmptyState } from '@/components/shared/EmptyState';
import type { Customer } from '@/lib/api/customers.service';

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

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border border-border bg-card animate-pulse">
      <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 bg-muted rounded w-2/3" />
        <div className="h-3 bg-muted rounded w-1/2" />
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <div className="h-4 w-12 bg-muted rounded-full" />
        <div className="h-3 w-16 bg-muted rounded" />
      </div>
    </div>
  );
}

export function CustomerList({ customers, selectedId, onSelect, isLoading, page, totalPages, total, onPage }: CustomerListProps) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-2 py-4">
          {isLoading ? (
            Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} />)
          ) : customers.length === 0 ? (
            <EmptyState icon={Users} title="No customers found" description="Try adjusting your search or filter" />
          ) : (
            customers.map((c) => <CustomerRow key={c.id} customer={c} isSelected={selectedId === c.id} onSelect={onSelect} />)
          )}
        </div>
      </ScrollArea>

      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-3 pb-1 border-t border-border shrink-0">
          <button
            onClick={() => onPage(page - 1)}
            disabled={page === 1}
            className="h-8 px-2.5 flex items-center gap-1 rounded-lg text-xs text-muted-foreground border border-border hover:bg-surface-offset transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={13} aria-hidden="true" />
            Prev
          </button>
          <span className="text-xs text-muted-foreground">
            {total.toLocaleString()} customers · page {page}/{totalPages}
          </span>
          <button
            onClick={() => onPage(page + 1)}
            disabled={page === totalPages}
            className="h-8 px-2.5 flex items-center gap-1 rounded-lg text-xs text-muted-foreground border border-border hover:bg-surface-offset transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight size={13} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
