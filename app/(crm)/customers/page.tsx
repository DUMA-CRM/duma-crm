'use client';

import { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { CustomerSearch } from '@/components/customers/CustomerSearch';
import { CustomerList } from '@/components/customers/CustomerList';
import { CustomerPanel } from '@/components/customers/CustomerPanel';
import { PageLayout } from '@/components/layout/PageLayout';
import { Modal } from '@/components/shared/Modal';
import { getCustomers, createCustomer, type Customer } from '@/lib/api/customers.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { FilterOption } from '@/types/customers';

const LIMIT = 20;

const inp =
  'w-full h-10 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

function CreateCustomerForm({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => createCustomer({ tenantId, firstName, lastName, phone, email: email || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['customers'] });
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={lbl}>First name</label>
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className={inp} autoFocus />
        </div>
        <div>
          <label className={lbl}>Last name</label>
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required className={inp} />
        </div>
      </div>
      <div>
        <label className={lbl}>Phone</label>
        <input value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="+447911123456" className={inp} />
      </div>
      <div>
        <label className={lbl}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" className={inp} />
      </div>
      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 h-10 bg-primary hover:bg-primary-hover text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60"
        >
          {isPending ? 'Creating…' : 'Create customer'}
        </button>
      </div>
    </form>
  );
}

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
        limit: LIMIT,
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
    <div className="flex items-end gap-3">
      <div className="flex-1">
        <CustomerSearch
          query={search}
          filter={filter}
          onQuery={setSearch}
          onFilter={(f) => {
            setFilter(f);
            setPage(1);
          }}
          total={data?.total ?? 0}
        />
      </div>
      {tenantId && (
        <button
          onClick={() => setShowCreate(true)}
          className="h-10 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
        >
          <Plus size={15} aria-hidden="true" />
          New
        </button>
      )}
    </div>
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
