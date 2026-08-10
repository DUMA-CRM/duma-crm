'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

import { CustomerCards } from '@/components/customers/CustomerCards';
import { CreateCustomerDrawer } from '@/components/customers/CustomerForm';
import { PrivacyRequestsPanel } from '@/components/customers/PrivacyRequestsPanel';
import { AlertTriangle, ChevronRight, LayoutGrid, ListView, Plus, Search, ShieldCheck, Users, X } from '@/components/icons';
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
      title="Customers"
      icon={<Users size={20} aria-hidden="true" />}
      actions={
        tab === 'customers' && tenantId ? (
          <Button className="h-9 gap-1.5" onClick={() => setShowCreate(true)}>
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
  const view = useUiSettingsStore((state) => state.listViews.customers ?? 'cards');
  const setListView = useUiSettingsStore((state) => state.setListView);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  const { data, isLoading, isError, refetch } = useQuery({
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
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule/65 bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground" aria-live="polite">
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
      <div className="rounded-lg border border-rule/65 bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="min-w-0 flex-1">
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
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onValueChange={(value) => {
                setFilter(value as FilterOption);
                setPage(1);
              }}
              options={TIER_FILTERS.map((tier) => ({ value: tier.value, label: tier.value === 'all' ? 'All tiers' : tier.label }))}
              ariaLabel="Filter customers by loyalty tier"
              className="h-10 min-w-36 flex-1 rounded-md lg:flex-none"
            />
            <SegmentedControl
              options={VIEW_OPTIONS}
              value={view}
              onChange={(next) => setListView('customers', next)}
              iconOnly
              size="lg"
              ariaLabel="Customer list layout"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-rule/45 pt-3">
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {isLoading ? 'Loading customers…' : `${customers.length.toLocaleString()} shown · ${(data?.total ?? 0).toLocaleString()} total`}
          </p>
          {(search || filter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setFilter('all');
                setPage(1);
              }}
              className="min-h-8 rounded-md px-2 text-xs font-semibold text-primary transition-colors hover:bg-measured/8 hover:text-primary-hover"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {isError ? (
        <div className="flex min-h-72 flex-col items-center justify-center rounded-lg border border-exception/30 bg-card px-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-md bg-exception/8 text-exception">
            <AlertTriangle size={22} aria-hidden="true" />
          </span>
          <h2 className="mt-4 text-base font-semibold text-foreground">Customers could not be loaded</h2>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Check your connection and try again. Your search and filters will stay in place.
          </p>
          <Button variant="outline" className="mt-4" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : view === 'cards' ? (
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
