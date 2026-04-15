'use client';

import { useState, useMemo } from 'react';
import { CustomerSearch } from '@/components/customers/CustomerSearch';
import { CustomerList } from '@/components/customers/CustomerList';
import { CustomerPanel } from '@/components/customers/CustomerPanel';
import { CUSTOMERS } from '@/lib/constants/customers';
import type { Customer, FilterOption } from '@/types/customers';

export default function CustomersPage() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [selected, setSelected] = useState<Customer | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return CUSTOMERS.filter((c) => {
      const matchesTier = filter === 'all' || c.tier === filter;
      const matchesQuery = !q || c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.phone.includes(q);
      return matchesTier && matchesQuery;
    });
  }, [query, filter]);

  return (
    <div className="flex -m-8 h-[calc(100vh-var(--header-height))]">
      {/* ── Left: List ──────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Header */}
        <div className="px-8 pt-8 pb-4 border-b border-border shrink-0">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-1">Customer Management</p>
          <h1 className="text-3xl font-semibold text-foreground mb-5">Customer 360</h1>

          <CustomerSearch
            query={query}
            filter={filter}
            onQuery={setQuery}
            onFilter={setFilter}
            totalShown={filtered.length}
            totalAll={CUSTOMERS.length}
          />
        </div>

        {/* List */}
        <CustomerList customers={filtered} selectedId={selected?.id ?? null} onSelect={setSelected} />
      </div>

      {/* ── Right: Profile ──────────────────────────────── */}
      <CustomerPanel customer={selected} />
    </div>
  );
}
