'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Plus, Search, Users, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { CreateCustomerForm } from '@/components/customers/CustomerForm';
import { PageLayout } from '@/components/layout/PageLayout';
import { EmptyState } from '@/components/shared/EmptyState';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { getCustomers } from '@/lib/api/customers.service';
import { TIER_CONFIG, TIER_FILTERS } from '@/lib/constants/customers';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Customer, FilterOption } from '@/types/customers';

// Deep link: /customers?q=<query> (from the header search) opens pre-filtered.
const initialQuery = () => (typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('q') ?? ''));

const fmtDate = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

export default function CustomersPage() {
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [page, setPage] = useState(1);
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

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
  const totalPages = data?.pages ?? 1;

  const columns: DataTableColumn<Customer>[] = [
    {
      id: 'customer',
      header: 'Customer',
      minWidth: 220,
      cell: ({ row: customer }) => (
        <div className="flex items-center gap-3">
          <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} email={customer.email} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {customer.firstName} {customer.lastName}
            </p>
            <p className="truncate text-xs text-muted-foreground">{customer.email ?? customer.phone}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'tier',
      header: 'Tier',
      width: 'fit',
      cell: ({ row: customer }) => <Badge variant={TIER_CONFIG[customer.tier].variant}>{TIER_CONFIG[customer.tier].label}</Badge>,
    },
    {
      id: 'points',
      header: 'Points',
      width: 'fit',
      align: 'right',
      cellClassName: 'tabular-nums font-semibold',
      cell: ({ row: customer }) => customer.pointsBalance.toLocaleString(),
    },
    {
      id: 'spent',
      header: 'Spent',
      width: 'fit',
      align: 'right',
      visibility: 'sm',
      cellClassName: 'tabular-nums',
      cell: ({ row: customer }) => `£${Number(customer.totalSpent).toFixed(0)}`,
    },
    {
      id: 'visits',
      header: 'Visits',
      width: 'fit',
      align: 'right',
      visibility: 'md',
      cellClassName: 'tabular-nums text-muted-foreground',
      cell: ({ row: customer }) => customer.totalVisits,
    },
    {
      id: 'last',
      header: 'Last visit',
      width: 'fit',
      visibility: 'lg',
      wrap: 'nowrap',
      cellClassName: 'tabular-nums text-muted-foreground text-xs',
      cell: ({ row: customer }) => fmtDate(customer.lastVisitAt),
    },
    {
      id: 'open',
      width: 'fit',
      align: 'right',
      cell: () => <ChevronRight size={15} className="text-muted-foreground" aria-hidden="true" />,
    },
  ];

  return (
    <PageLayout eyebrow="Customer Management" title="Customer 360" fullHeight headerBorder={false}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Search · tier · new — one row */}
        <div className="mb-4 flex shrink-0 flex-wrap items-center gap-2">
          <div className="min-w-60 flex-1">
            <Input
              leftIcon={<Search size={16} />}
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name, email or phone…"
              rightAction={
                search ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setPage(1);
                    }}
                    aria-label="Clear search"
                    className="text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X size={14} />
                  </button>
                ) : undefined
              }
            />
          </div>
          <Select
            value={filter}
            onValueChange={(value) => {
              setFilter(value as FilterOption);
              setPage(1);
            }}
            options={TIER_FILTERS.map((tier) => ({ value: tier.value, label: tier.label }))}
            ariaLabel="Filter customers by tier"
            className="w-36"
          />
          {tenantId && (
            <Button onClick={() => setShowCreate(true)} className="gap-1.5">
              <Plus size={16} aria-hidden="true" />
              New
            </Button>
          )}
        </div>

        {/* Table */}
        <DataTable
          aria-label="Customers"
          data={customers}
          columns={columns}
          getRowKey={(customer) => customer.id}
          isLoading={isLoading}
          stickyHeader
          minWidth={720}
          containerClassName="min-h-0 flex-1"
          emptyState={<EmptyState icon={Users} title="No customers found" description="Try adjusting your search or tier filter." />}
          onRowClick={({ row }) => router.push(`/customers/${row.id}`)}
          rowAriaLabel={({ row }) => `Open ${row.firstName} ${row.lastName}`}
          footer={
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
              <p className="text-xs text-muted-foreground">
                {(data?.total ?? 0).toLocaleString()} customers
                {totalPages > 1 && ` · page ${page} of ${totalPages}`}
              </p>
              {totalPages > 1 && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </div>
          }
          footerClassName="p-0"
        />
      </div>

      {showCreate && tenantId && (
        <Modal title="New Customer" onClose={() => setShowCreate(false)}>
          <CreateCustomerForm tenantId={tenantId} onClose={() => setShowCreate(false)} />
        </Modal>
      )}
    </PageLayout>
  );
}
