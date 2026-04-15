import { ScrollArea } from '@/components/ui/scroll-area';
import { Users } from 'lucide-react';
import { CustomerRow } from './CustomerRow';
import type { Customer } from '@/types/customers';

interface CustomerListProps {
  customers: Customer[];
  selectedId: string | null;
  onSelect: (c: Customer) => void;
}

export function CustomerList({ customers, selectedId, onSelect }: CustomerListProps) {
  if (customers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center flex-1 py-20 text-center px-6">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Users size={20} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-muted-foreground">No customers found</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Try adjusting your search or filter</p>
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 overflow-hidden">
      <ScrollArea className="h-full">
        <div className="divide-y divide-border">
          {customers.map((c) => (
            <CustomerRow key={c.id} customer={c} isSelected={selectedId === c.id} onSelect={onSelect} />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
