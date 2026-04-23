'use client';

import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';

import { CreateCustomerForm } from '@/components/customers/CustomerForm';
import { CustomerList } from '@/components/customers/CustomerList';
import { CustomerPanel } from '@/components/customers/CustomerPanel';
import { CustomerSearch } from '@/components/customers/CustomerSearch';
import { PageLayout } from '@/components/layout/PageLayout';
import { Modal } from '@/components/shared/Modal';

import { getCustomers } from '@/lib/api/customers.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Customer, FilterOption } from '@/types/customers';

export default function CustomersPage() {
  const { tenantId } = useWorkspaceStore();
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState<FilterOption>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filter]);

  const { data, isLoading } = useQuery({
    queryKey: ['customers', page, debouncedSearch, filter, tenantId],
    queryFn: () =>
      getCustomers({
        page,
        limit: 20,
        search: debouncedSearch || undefined,
        tier: filter,
        tenantId: tenantId ?? undefined,
      }),
    enabled: !!tenantId,
  });

  const customers = data?.data ?? [];

  const handleSelect = useCallback((c: Customer) => {
    setSelected((prev) => (prev?.id === c.id ? null : c));
  }, []);

  const headerSlot = (
    <CustomerSearch
      query={search}
      filter={filter}
      onQuery={setSearch}
      onFilter={(f) => {
        setFilter(f);
        setPage(1);
      }}
      onClick={() => setShowCreate(true)}
      tenantId={tenantId}
    />
  );

  return (
    <>
      <PageLayout
        eyebrow="Customer Management"
        title="Customer 360"
        headerSlot={headerSlot}
        sidebar={<CustomerPanel customer={selected} onCustomerUpdate={setSelected} />}
      >
        <CustomerList
          customers={customers}
          selectedId={selected?.id ?? null}
          onSelect={handleSelect}
          isLoading={isLoading}
          page={page}
          totalPages={data?.pages ?? 1}
          total={data?.total ?? 0}
          onPage={setPage}
        />
      </PageLayout>

      {showCreate && tenantId && (
        <Modal title="New Customer" onClose={() => setShowCreate(false)}>
          <CreateCustomerForm tenantId={tenantId} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
    </>
  );
}
