'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CustomerBulkBar } from '@/components/customers/CustomerBulkBar';
import { CustomerCards } from '@/components/customers/CustomerCards';
import { CustomerFilterBar } from '@/components/customers/CustomerFilterBar';
import { CreateCustomerDrawer } from '@/components/customers/CustomerForm';
import { CustomerList, CustomerListSkeleton } from '@/components/customers/CustomerList';
import { MergeCustomersModal } from '@/components/customers/MergeCustomersModal';
import { SegmentBar } from '@/components/customers/SegmentBar';
import { useCustomerFilters } from '@/components/customers/useCustomerFilters';
import { Combine, Gift, LayoutGrid, ListView, Mail, Plus, UserMinus, Users } from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NeedsAttention } from '@/components/shared/NeedsAttention';
import type { SegmentedOption } from '@/components/shared/SegmentedControl';
import { useWorkspaceCurrency } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCustomers, getDuplicateCandidates, hasActiveFilters } from '@/lib/modules/customers/client';
import { getSegment, getSegments } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { zonedParts } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { type ListView as ListViewMode, useUiSettingsStore } from '@/stores/uiSettingsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Customer, CustomerFilters } from '@/types/customers';

const VIEW_OPTIONS: SegmentedOption<ListViewMode>[] = [
  { value: 'table', label: 'List view', icon: ListView },
  { value: 'cards', label: 'Card view', icon: LayoutGrid },
];

const PAGE_SIZE = 20;

/** The four facts over the list — each one count, from a one-row request. */
const SUMMARY: { key: string; filters: (month: number) => CustomerFilters }[] = [
  { key: 'all', filters: () => ({}) },
  { key: 'emailable', filters: () => ({ marketing: 'opted_in' }) },
  { key: 'birthdays', filters: (month) => ({ birthdayMonth: month }) },
  { key: 'lapsed', filters: () => ({ lapsedDays: 60 }) },
];

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

  // This month at the business — the workspace zone, not the browser's.
  const [month] = useState(() => zonedParts().month);
  // Under 'customers', so creating, merging or editing refreshes these too.
  const summary = useQueries({
    queries: SUMMARY.map((item) => ({
      queryKey: moduleQueryKeys.customers.key('customers', tenantId, 'summary', item.key, month),
      queryFn: () => getCustomers({ ...item.filters(month), page: 1, limit: 1, tenantId: tenantId ?? undefined }),
      enabled: !!tenantId,
      staleTime: 60_000,
    })),
  });
  const count = (index: number) => (summary[index]?.data ? summary[index].data!.total.toLocaleString() : '—');

  const duplicates = useQuery({
    queryKey: moduleQueryKeys.customers.key('customers', tenantId, 'duplicates'),
    queryFn: () => getDuplicateCandidates(200),
    enabled: !!tenantId && canMerge,
    staleTime: 5 * 60_000,
  });
  const duplicateCount = duplicates.data?.data.length ?? 0;

  const currency = useWorkspaceCurrency();
  // Whole units: a list reads "£412", the record has the pennies.
  const money = useMemo(() => {
    const format = new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
      maximumFractionDigits: 0,
    });
    return (amount: string | number) => format.format(Number(amount) || 0);
  }, [currency]);

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

  const filtered = hasActiveFilters(filters);
  const emptyState = filtered ? (
    <EmptyState
      icon={Users}
      title="No customers found"
      description="Try adjusting your search or filters."
      kind="search"
      action={{ label: 'Clear filters', onClick: clearFilters }}
    />
  ) : (
    <EmptyState
      icon={Users}
      title="No customers yet"
      description="Everyone who orders, signs up for loyalty or is added by hand appears here."
      action={canCreate ? { label: 'New customer', icon: Plus, onClick: () => setShowCreate(true) } : undefined}
    />
  );

  // Paging only. The toolbar owns the total, so the two can never disagree.
  const footer =
    totalPages > 1 ? (
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-1">
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
            {hasCapability(capabilities, 'customers:points') && (
              <Button variant="outline" onClick={() => router.push('/customers/loyalty')} className="gap-1.5">
                <Gift size={15} aria-hidden="true" />
                <span className="hidden lg:inline">Loyalty rules</span>
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
        <div className="flex flex-1 flex-col gap-5">
          <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Fact surface="page" icon={Users} label="Customers" value={count(0)} hint="Everyone on your list" />
            <Fact surface="page" icon={Mail} label="Can be emailed" value={count(1)} hint="Opted in to marketing" />
            <Fact
              surface="page"
              icon={Gift}
              label="Birthdays this month"
              value={count(2)}
              hint={new Date(2000, month - 1, 1).toLocaleDateString('en-GB', { month: 'long' })}
            />
            <Fact
              surface="page"
              icon={UserMinus}
              label="Not seen in 60 days"
              value={count(3)}
              tone="warning"
              hint="Worth a win-back email"
            />
          </dl>

          {canMerge && (
            <NeedsAttention
              items={
                duplicateCount > 0
                  ? [
                      {
                        key: 'duplicates',
                        tone: 'measured',
                        icon: Combine,
                        title: `${duplicateCount}${duplicateCount === 200 ? '+' : ''} possible duplicate ${duplicateCount === 1 ? 'record' : 'records'}`,
                        detail: 'The same email, or the same first and last name. Merging keeps their points and history together.',
                        fix: { label: 'Review', href: '/customers/duplicates' },
                      },
                    ]
                  : []
              }
            />
          )}

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
            <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              <ErrorState
                title="Customers couldn’t be loaded"
                description="Your search and filters stay in place."
                onRetry={() => void refetch()}
              />
            </div>
          ) : isLoading ? (
            <CustomerListSkeleton />
          ) : customers.length === 0 ? (
            // No card: the empty list sits on the page and centres in the space under the filters.
            <div className="flex flex-1 flex-col justify-center">{emptyState}</div>
          ) : view === 'cards' ? (
            <CustomerCards
              customers={customers}
              emptyState={emptyState}
              footer={footer}
              money={money}
              selectable={canMerge}
              selectedIds={selectedIds}
              onToggle={toggleRow}
            />
          ) : (
            <CustomerList
              customers={customers}
              money={money}
              sort={filters.sort}
              direction={filters.direction}
              onSort={toggleSort}
              selectable={canMerge}
              selectedIds={selectedIds}
              onToggle={toggleRow}
              onToggleAll={toggleAllOnPage}
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
