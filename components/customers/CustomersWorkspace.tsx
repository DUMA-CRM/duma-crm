'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CustomerBulkBar } from '@/components/customers/CustomerBulkBar';
import { CustomerCards } from '@/components/customers/CustomerCards';
import { CustomerFilterBar } from '@/components/customers/CustomerFilterBar';
import { CreateCustomerDrawer } from '@/components/customers/CustomerForm';
import { MergeCustomersModal } from '@/components/customers/MergeCustomersModal';
import { SegmentBar } from '@/components/customers/SegmentBar';
import { useCustomerFilters } from '@/components/customers/useCustomerFilters';
import { AlertTriangle, Combine, LayoutGrid, ListView, Plus, ShieldAlert, Users } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { InitialsAvatar } from '@/components/shared/InitialsAvatar';
import type { SegmentedOption } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

import { hasCapability } from '@/lib/auth/capabilities';
import { TIER_CONFIG } from '@/lib/constants/customers';
import { getCustomers } from '@/lib/modules/customers/client';
import { getSegment, getSegments } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { useAuthStore } from '@/stores/authStore';
import { type ListView as ListViewMode, useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Customer, CustomerSort } from '@/types/customers';

const VIEW_OPTIONS: SegmentedOption<ListViewMode>[] = [
  { value: 'table', label: 'Table view', icon: ListView },
  { value: 'cards', label: 'Card view', icon: LayoutGrid },
];

const PAGE_SIZE = 20;

const fmtDate = (iso?: string) => formatDate(iso);

/**
 * The customers list.
 *
 * Built for a manager at a desk: it opens on the tile grid, the table is one
 * click away and stays chosen once picked, columns sort, and the filters that
 * matter — who has lapsed, whose birthday it is, who can be emailed — are one
 * click rather than buried. Filter state lives in the URL so a view can be
 * shared or saved as a segment.
 *
 * Everything above the first row is one toolbar. It used to be three stacked
 * regions — a segment row, a four-tier filter card and a summary line — which
 * cost most of a screen and printed the same count in three places. The page now
 * states its total once, in the toolbar, and the table footer carries paging
 * alone.
 */
export function CustomersWorkspace() {
  const router = useRouter();
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);

  const { filters, page, appliedSegmentId, setFilters, setPage, clearFilters, applySegment, toggleSort } = useCustomerFilters();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergePair, setMergePair] = useState<{ a: Customer; b: Customer } | null>(null);

  // Cards are the default: the page opens on the tile grid, and a device that
  // has chosen the table keeps it (the stored preference wins over this).
  const view = useUiSettingsStore((state) => state.listViews.customers ?? 'cards');
  const setListView = useUiSettingsStore((state) => state.setListView);

  const canWriteSegments = hasCapability(capabilities, 'segments:write');
  const canMerge = hasCapability(capabilities, 'customers:merge');
  const canCreate = hasCapability(capabilities, 'customers:write');

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: moduleQueryKeys.customers.key('customers', tenantId, page, filters),
    queryFn: () => getCustomers({ ...filters, page, limit: PAGE_SIZE, tenantId: tenantId ?? undefined }),
    enabled: !!tenantId,
  });

  const { data: segmentsData } = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-segments'),
    queryFn: getSegments,
    enabled: !!tenantId,
  });
  const segments = useMemo(() => segmentsData?.data ?? [], [segmentsData]);

  // Only fetched when a segment is applied — this is what turns a headline count
  // into "and this many can actually be emailed".
  const { data: appliedSegment } = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-segment', appliedSegmentId),
    queryFn: () => getSegment(appliedSegmentId!),
    enabled: !!appliedSegmentId,
  });

  // Memoised because `?? []` would hand back a fresh array on every render,
  // which would defeat the selection memo below it.
  const customers = useMemo(() => data?.data ?? [], [data]);
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 1;

  // Selection is scoped to what is currently loaded: a tick means "this row",
  // and carrying ids across pages would let a merge act on a record the user can
  // no longer see.
  const selected = useMemo(() => customers.filter((customer) => selectedIds.has(customer.id)), [customers, selectedIds]);
  const allOnPageSelected = customers.length > 0 && customers.every((customer) => selectedIds.has(customer.id));

  const toggleRow = (id: string) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllOnPage = () =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (allOnPageSelected) for (const customer of customers) next.delete(customer.id);
      else for (const customer of customers) next.add(customer.id);
      return next;
    });

  const merge = useMutation({
    mutationFn: async ({ survivorId, loserId }: { survivorId: string; loserId: string }) => {
      const { mergeCustomers } = await import('@/lib/modules/customers/client');
      return mergeCustomers(survivorId, loserId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customers') });
      setMergePair(null);
      setSelectedIds(new Set());
    },
  });

  /** Sort indicator the DataTable understands, for a given column's sort key. */
  const sortFor = (key: CustomerSort) => (filters.sort === key ? (filters.direction ?? 'desc') : (false as const));

  const columns: DataTableColumn<Customer>[] = [
    ...(canMerge
      ? [
          {
            id: 'select',
            width: 'fit' as const,
            header: (
              <label className="flex items-center" title="Select all on this page">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={toggleAllOnPage}
                  aria-label="Select all customers on this page"
                  className="h-4 w-4 rounded accent-primary"
                />
              </label>
            ),
            cell: ({ row: customer }: { row: Customer }) => (
              <label
                className="flex items-center"
                // The row is a link to the record; a tick must not navigate.
                onClick={(event) => event.stopPropagation()}
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(customer.id)}
                  onChange={() => toggleRow(customer.id)}
                  aria-label={`Select ${customer.firstName} ${customer.lastName}`}
                  className="h-4 w-4 rounded accent-primary"
                />
              </label>
            ),
          },
        ]
      : []),
    {
      id: 'customer',
      header: 'Customer',
      minWidth: 220,
      sortDirection: sortFor('name'),
      onSort: () => toggleSort('name'),
      cell: ({ row: customer }) => (
        <div className="flex items-center gap-2.5">
          <InitialsAvatar firstName={customer.firstName} lastName={customer.lastName} email={customer.email} className="size-8 text-xs" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
              {customer.firstName} {customer.lastName}
              {/* Safety first, even in a list: a critical alert or an allergy is
                  the one thing a manager must not have to open a record to see. */}
              {customer.alerts?.some((alert) => alert.severity === 'critical') && (
                <ShieldAlert size={13} className="shrink-0 text-exception" aria-label="Has a critical alert" />
              )}
              {(customer.allergies?.length ?? 0) > 0 && (
                <AlertTriangle size={13} className="shrink-0 text-warning" aria-label={`Allergies: ${customer.allergies!.join(', ')}`} />
              )}
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
      sortDirection: sortFor('points'),
      onSort: () => toggleSort('points'),
      cell: ({ row: customer }) => customer.pointsBalance.toLocaleString(),
    },
    {
      id: 'spent',
      header: 'Spent',
      width: 'fit',
      align: 'right',
      visibility: 'sm',
      cellClassName: 'tabular-nums',
      sortDirection: sortFor('spend'),
      onSort: () => toggleSort('spend'),
      cell: ({ row: customer }) => `£${Number(customer.totalSpent).toFixed(0)}`,
    },
    {
      id: 'visits',
      header: 'Visits',
      width: 'fit',
      align: 'right',
      visibility: 'md',
      cellClassName: 'tabular-nums text-muted-foreground',
      sortDirection: sortFor('visits'),
      onSort: () => toggleSort('visits'),
      cell: ({ row: customer }) => customer.totalVisits,
    },
    {
      id: 'last',
      header: 'Last visit',
      width: 'fit',
      visibility: 'lg',
      wrap: 'nowrap',
      cellClassName: 'tabular-nums text-muted-foreground text-xs',
      sortDirection: sortFor('last_visit'),
      onSort: () => toggleSort('last_visit'),
      cell: ({ row: customer }) => (customer.lastVisitAt ? fmtDate(customer.lastVisitAt) : 'Never'),
    },
  ];

  const emptyState = <EmptyState icon={Users} title="No customers found" description="Try adjusting your search or filters." />;

  // Paging only. The toolbar owns the total, so the two can never disagree.
  const footer =
    totalPages > 1 ? (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs tabular-nums text-muted-foreground" aria-live="polite">
          Page {page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 1} onClick={() => setPage(page - 1)}>
            Previous
          </Button>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
            Next
          </Button>
        </div>
      </div>
    ) : undefined;

  return (
    <EditorShell
      title="Customers"
      icon={<Users size={20} aria-hidden="true" />}
      actions={
        tenantId ? (
          <>
            {canMerge && (
              <Button
                variant="outline"
                onClick={() => router.push('/customers/duplicates')}
                aria-label="Find duplicate customer records"
                className="gap-1.5"
              >
                <Combine size={15} aria-hidden="true" />
                <span className="hidden lg:inline">Find duplicates</span>
              </Button>
            )}
            {canCreate && (
              <Button className="gap-1.5" onClick={() => setShowCreate(true)} aria-label="New customer">
                <Plus size={15} aria-hidden="true" />
                <span className="hidden md:inline">New customer</span>
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      {!tenantId ? (
        <EmptyState icon={Users} title="No workspace selected" description="Choose a workspace to view its customers." />
      ) : (
        <div className="flex flex-col gap-4">
          <CustomerFilterBar
            filters={filters}
            onChange={setFilters}
            onClear={clearFilters}
            view={view}
            onViewChange={(next) => setListView('customers', next)}
            viewOptions={VIEW_OPTIONS}
            total={total}
            emailReachable={appliedSegmentId ? appliedSegment?.emailReachable : undefined}
            isLoading={isLoading}
            isFetching={isFetching}
            staleFilters={appliedSegmentId ? appliedSegment?.staleFilters : undefined}
            onDropSegment={() => applySegment(null)}
            segments={
              <SegmentBar
                filters={filters}
                appliedSegmentId={appliedSegmentId}
                segments={segments}
                onApply={applySegment}
                canWrite={canWriteSegments}
              />
            }
          />

          <CustomerBulkBar
            selected={selected}
            onClear={() => setSelectedIds(new Set())}
            onMerge={(a, b) => setMergePair({ a, b })}
            canMerge={canMerge}
          />

          {isError ? (
            <div className="flex min-h-72 flex-col items-center justify-center rounded-sm border border-exception/30 bg-card px-6 text-center">
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
              density="compact"
              stickyHeader
              minWidth={720}
              emptyState={emptyState}
              onRowClick={({ row }) => router.push(`/customers/${row.id}`)}
              rowAriaLabel={({ row }) => `Open ${row.firstName} ${row.lastName}`}
              rowClassName={({ row }) => cn(selectedIds.has(row.id) && 'bg-band/60')}
              footer={footer}
            />
          )}
        </div>
      )}

      {showCreate && tenantId && <CreateCustomerDrawer tenantId={tenantId} onClose={() => setShowCreate(false)} />}

      {mergePair && (
        <MergeCustomersModal
          a={mergePair.a}
          b={mergePair.b}
          isPending={merge.isPending}
          error={merge.error instanceof Error ? merge.error.message : null}
          onCancel={() => setMergePair(null)}
          onConfirm={(survivorId, loserId) => merge.mutate({ survivorId, loserId })}
        />
      )}
    </EditorShell>
  );
}
