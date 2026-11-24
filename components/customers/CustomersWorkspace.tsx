'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CustomerBulkBar } from '@/components/customers/CustomerBulkBar';
import { CustomerFilterBar } from '@/components/customers/CustomerFilterBar';
import { CreateCustomerDrawer } from '@/components/customers/CustomerForm';
import { CustomerList, CustomerListSkeleton } from '@/components/customers/CustomerList';
import { MergeCustomersModal } from '@/components/customers/MergeCustomersModal';
import { SegmentBar } from '@/components/customers/SegmentBar';
import { useCustomerFilters } from '@/components/customers/useCustomerFilters';
import { Award, Combine, Plus, Users } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NeedsAttention } from '@/components/shared/NeedsAttention';
import { type SectionTab, SectionTabs } from '@/components/shared/SectionTabs';
import { useWorkspaceCurrency } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { getCustomers, getDuplicateCandidates, hasActiveFilters } from '@/lib/modules/customers/client';
import { getSegment, getSegments } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { QUICK_VIEW_KEYS, type QuickViewKey, activeQuickView, quickViewFilters } from '@/lib/utils/customer-views';
import { zonedParts } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Customer } from '@/types/customers';

const PAGE_SIZE = 20;

/**
 * The customers list.
 *
 * One list, as Square's directory and Shopify's customers page have it — a
 * card view was a second way to see the same twenty rows. The questions asked
 * daily — who can be emailed, whose birthday it is, who has lapsed — are the
 * tabs under the header, each with its count, so a count is also the click that
 * shows those people. Below: search, segments and one Filters button, then the
 * list. Filter state lives in the URL so a view can be shared or saved as a
 * segment.
 */
export function CustomersWorkspace() {
  const router = useRouter();
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);

  const { filters, page, appliedSegmentId, setFilters, setPage, clearFilters, applySegment, applyView, toggleSort } = useCustomerFilters();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mergePair, setMergePair] = useState<{ a: Customer; b: Customer } | null>(null);

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
    queries: QUICK_VIEW_KEYS.map((key) => ({
      queryKey: moduleQueryKeys.customers.key('customers', tenantId, 'summary', key, month),
      queryFn: () => getCustomers({ ...quickViewFilters(key, month), page: 1, limit: 1, tenantId: tenantId ?? undefined }),
      enabled: !!tenantId,
      staleTime: 60_000,
    })),
  });
  const monthName = new Date(2000, month - 1, 1).toLocaleDateString('en-GB', { month: 'long' });
  const VIEW_LABEL: Record<QuickViewKey, string> = {
    all: 'All',
    emailable: 'Can be emailed',
    birthdays: `Birthdays in ${monthName}`,
    lapsed: 'Not seen in 60 days',
  };
  // A segment, or filters that match no tab, light none of them.
  const quickView = appliedSegmentId ? null : activeQuickView(filters, month);
  const viewTabs: SectionTab<QuickViewKey | 'custom'>[] = QUICK_VIEW_KEYS.map((key, index) => ({
    value: key,
    label: VIEW_LABEL[key],
    count: summary[index]?.data?.total,
  }));

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
          <div className="flex items-center gap-1.5 md:gap-2">
            {canMerge && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push('/customers/duplicates')}
                aria-label="Find duplicate customer records"
                className="gap-1.5"
              >
                <Combine size={15} aria-hidden="true" />
                <span className="hidden lg:inline">Find duplicates</span>
              </Button>
            )}
            {hasCapability(capabilities, 'customers:points') && (
              <Button
                variant="outline"
                size="sm"
                aria-label="Loyalty"
                onClick={() => router.push('/promotions/loyalty')}
                className="gap-1.5"
              >
                <Award size={15} aria-hidden="true" />
                <span className="hidden lg:inline">Loyalty</span>
              </Button>
            )}
            {canCreate && (
              <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)} aria-label="New customer">
                <Plus size={15} aria-hidden="true" />
                <span className="hidden sm:inline">New customer</span>
              </Button>
            )}
          </div>
        ) : undefined
      }
      subheader={
        tenantId ? (
          <SectionTabs
            tabs={viewTabs}
            value={quickView ?? 'custom'}
            onChange={(key) => key !== 'custom' && applyView(quickViewFilters(key, month))}
            ariaLabel="Customer views"
          />
        ) : undefined
      }
    >
      {!tenantId ? (
        <EmptyState icon={Users} title="No workspace selected" description="Choose a workspace to view its customers." />
      ) : (
        <div className="flex flex-1 flex-col gap-5">
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
            <div className="overflow-hidden rounded-lg border border-border bg-card">
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
