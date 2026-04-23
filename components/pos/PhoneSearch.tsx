import { useQuery } from '@tanstack/react-query';
import { Check, Loader2 } from 'lucide-react';
import { useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { getCustomers } from '@/lib/api/customers.service';
import { Customer } from '@/types/customers';

export function PhoneSearch({ onSelect, onClose }: { onSelect: (c: Customer) => void; onClose: () => void }) {
  const [phone, setPhone] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = phone.trim();

  const { data, isFetching, isError } = useQuery({
    queryKey: ['customer-phone-search', trimmed],
    queryFn: () => getCustomers({ phoneNumber: trimmed, limit: 1 }),
    enabled: trimmed.length >= 7,
    staleTime: 10_000,
  });

  const found = data?.data[0] ?? null;
  const notFound = !isFetching && trimmed.length >= 7 && data?.data.length === 0;

  return (
    <div className="mt-2 space-y-2">
      <Input
        ref={inputRef}
        autoFocus
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        placeholder="+447911123456"
        rightIcon={isFetching && <Loader2 size={13} className="text-muted-foreground animate-spin" />}
      />

      {found && (
        <button
          onClick={() => onSelect(found)}
          className="w-full flex items-center gap-2.5 px-3 py-2 bg-primary/5 border border-primary/30 rounded-lg hover:bg-primary/10 transition-colors text-left"
        >
          <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary to-primary-hover flex items-center justify-center text-white text-xs font-bold shrink-0">
            {found.firstName[0]?.toUpperCase()}
            {found.lastName[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">
              {found.firstName} {found.lastName}
            </p>
            <p className="text-xs text-muted-foreground truncate">{found.phone}</p>
          </div>
          <Check size={14} className="text-primary shrink-0" />
        </button>
      )}

      {notFound && <p className="text-xs text-muted-foreground text-center py-1">No customer found for that number.</p>}

      {isError && <p className="text-xs text-destructive text-center py-1">Search failed. Please try again.</p>}

      <Button variant="outline" size="sm" onClick={onClose} className="w-full">
        Cancel
      </Button>
    </div>
  );
}
