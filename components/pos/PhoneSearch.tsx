import { useQuery } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { Check, Loader2, UserPlus } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { getCustomers } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { Customer } from '@/types/customers';

export function PhoneSearch({
  onSelect,
  onCreate,
  onClose,
}: {
  onSelect: (c: Customer) => void;
  onCreate: (phone: string) => void;
  onClose: () => void;
}) {
  const [phone, setPhone] = useState('+');
  const inputRef = useRef<HTMLInputElement>(null);

  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, '');
  const canSearch = digits.length >= 3; // start suggesting after a few digits
  const canCreate = digits.length >= 7; // enough to be a real number

  const { data, isFetching, isError } = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-phone-search', trimmed),
    queryFn: () => getCustomers({ search: trimmed, limit: 6 }),
    enabled: canSearch,
    staleTime: 10_000,
  });

  const results = data?.data ?? [];

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

      {/* Matching customers */}
      {results.length > 0 && (
        <div className="space-y-1.5 max-h-56 overflow-auto">
          {results.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c)}
              className="w-full flex items-center gap-2.5 px-3 py-2 bg-card border border-rule rounded-sm hover:border-foreground transition-colors text-left"
            >
              {/* Flat ink, not a gradient: this world has no gradients outside
                  the area fill under a trace. */}
              <div className="w-8 h-8 rounded-sm bg-primary flex items-center justify-center text-primary-foreground text-xs font-semibold shrink-0">
                {c.firstName[0]?.toUpperCase()}
                {c.lastName[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">
                  {c.firstName} {c.lastName}
                </p>
                <p className="text-xs text-muted-foreground truncate">{c.phone}</p>
              </div>
              <Check size={14} className="text-primary shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Create new — always available once the number looks real */}
      {canCreate && (
        <button
          onClick={() => onCreate(trimmed)}
          className="w-full flex items-center gap-2.5 px-3 py-2 border border-dashed border-rule rounded-sm text-left hover:border-primary/40 hover:bg-band hover:text-primary transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-band flex items-center justify-center text-primary shrink-0">
            <UserPlus size={15} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">{results.length > 0 ? 'Add a new customer' : 'No match found'}</p>
            <p className="text-xs text-muted-foreground truncate">Create one with {trimmed}</p>
          </div>
        </button>
      )}

      {canSearch && !canCreate && results.length === 0 && !isFetching && (
        <p className="text-xs text-muted-foreground text-center py-1">Keep typing to find or add a customer…</p>
      )}

      {isError && <p className="text-xs text-exception text-center py-1">Search failed. Please try again.</p>}

      <Button variant="outline" size="sm" onClick={onClose} className="w-full">
        Cancel
      </Button>
    </div>
  );
}
