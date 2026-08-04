'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CustomerCards } from '@/components/customers/CustomerCards';
import { CreateCustomerDrawer } from '@/components/customers/CustomerForm';
import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import { ChevronRight, LayoutGrid, ListView, Plus, Search, ShieldCheck, Users, X } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { SegmentedControl, type SegmentedOption } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { getCustomers } from '@/lib/api/customers.service';
import { TIER_CONFIG, TIER_FILTERS } from '@/lib/constants/customers';
import { formatDate } from '@/lib/utils/date';
import { type ListView as ListViewMode, useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Customer, FilterOption } from '@/types/customers';

type Tab = 'customers' | 'privacy';

const TAB_VALUES: Tab[] = ['customers', 'privacy'];

const TABS: SectionTab<Tab>[] = [
  { value: 'customers', label: 'Customers', icon: Users },
  { value: 'privacy', label: 'Privacy requests', icon: ShieldCheck },
];

const VIEW_OPTIONS: SegmentedOption<ListViewMode>[] = [
  { value: 'table', label: 'Table view', icon: ListView },
  { value: 'cards', label: 'Card view', icon: LayoutGrid },
];

// Deep link: /customers?q=<query> (from the header search) opens pre-filtered.
const initialQuery = () => (typeof window === 'undefined' ? '' : (new URLSearchParams(window.location.search).get('q') ?? ''));

const fmtDate = (iso?: string) => formatDate(iso);

export default function CustomersPage() {
  // useSearchParams needs a Suspense boundary above it.
  return (
    <Suspense fallback={null}>
      <CustomersView />
    </Suspense>
  );
}

/** The open tab lives in the query string (`?tab=privacy`), so links are shareable and back works. */
function CustomersView() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { tenantId } = useWorkspaceStore();
  const [showCreate, setShowCreate] = useState(false);

  const requestedTab = searchParams.get('tab');
  const tab: Tab = TAB_VALUES.includes(requestedTab as Tab) ? (requestedTab as Tab) : 'customers';

  const selectTab = (next: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === 'customers') params.delete('tab');
    else params.set('tab', next);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  return (
    <EditorShell
      eyebrow="Customer management"
      title="Customer 360"
      icon={<Users size={20} aria-hidden="true" />}
      actions={
        tab === 'customers' && tenantId ? (
          <Button className="h-10 gap-1.5" onClick={() => setShowCreate(true)}>
            <Plus size={15} aria-hidden="true" />
            <span className="hidden md:inline">New customer</span>
          </Button>
        ) : undefined
      }
      subheader={<SectionTabs tabs={TABS} value={tab} onChange={selectTab} ariaLabel="Customer sections" />}
    >
      {tab === 'customers' ? (
        <CustomersList />
      ) : !tenantId ? (
        <EmptyState icon={ShieldCheck} title="No workspace selected" description="Choose a workspace to review privacy requests." />
      ) : (
        <PrivacyRequestsPanel tenantId={tenantId} />
      )}

      {showCreate && tenantId && <CreateCustomerDrawer tenantId={tenantId} onClose={() => setShowCreate(false)} />}
    </EditorShell>
  );
}

/** The customers list, read either as a dense table or as a grid of cards — the
 *  choice is remembered per device. Both views share one query, search and pager. */
function CustomersList() {
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [filter, setFilter] = useState<FilterOption>('all');
  const [page, setPage] = useState(1);
  const view = useUiSettingsStore((state) => state.listViews.customers ?? 'table');
  const setListView = useUiSettingsStore((state) => state.setListView);

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

  const emptyState = !tenantId ? (
    <EmptyState icon={Users} title="No workspace selected" description="Choose a workspace to view its customers." />
  ) : (
    <EmptyState icon={Users} title="No customers found" description="Try adjusting your search or tier filter." />
  );

  const footer = (
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
  );

  return (
    <div className="space-y-4">
      {/* Search · tier · view — one row */}
      <div className="flex flex-wrap items-center gap-2">
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
        <SegmentedControl
          options={VIEW_OPTIONS}
          value={view}
          onChange={(next) => setListView('customers', next)}
          iconOnly
          ariaLabel="Customer list layout"
        />
      </div>

      {view === 'cards' ? (
        <CustomerCards customers={customers} isLoading={isLoading} emptyState={emptyState} footer={footer} fmtDate={fmtDate} />
      ) : (
        <DataTable
          aria-label="Customers"
          data={customers}
          columns={columns}
          getRowKey={(customer) => customer.id}
          isLoading={isLoading}
          stickyHeader
          minWidth={720}
          emptyState={emptyState}
          onRowClick={({ row }) => router.push(`/customers/${row.id}`)}
          rowAriaLabel={({ row }) => `Open ${row.firstName} ${row.lastName}`}
          footer={footer}
          footerClassName="p-0"
        />
      )}
    </div>
  );
}
