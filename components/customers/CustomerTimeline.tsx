'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';

import { TimelineEntryDrawer } from '@/components/customers/TimelineEntryDrawer';
import { PILL_TONE, TIMELINE_KINDS, TIMELINE_KIND_META } from '@/components/customers/timelineKinds';
import { Activity, ChevronRight, Loader2 } from '@/components/icons';
import { OrderDrawer } from '@/components/orders/OrderDrawer';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadMore } from '@/components/shared/LoadMore';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import { retryEmailDelivery } from '@/lib/modules/communications/client';
import { getCustomerTimeline } from '@/lib/modules/customers/client';
import { getStaff } from '@/lib/modules/identity/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { countTimelineKinds, groupTimelineByDay, timelineRowText } from '@/lib/utils/customer-timeline';
import { formatDateTime } from '@/lib/utils/date';
import { formatInstant } from '@/lib/utils/workspace-time';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { TimelineEntry, TimelineKind } from '@/types/customers';

/**
 * One chronological feed of everything that happened with a guest — orders,
 * points, emails, consent and privacy: a filter bar, then each day as a tinted
 * panel of white rows — a kind-coloured tile, a bold lead, a muted detail
 * line, a pill only when something went wrong, and the time. An order opens
 * the Orders page's full drawer; anything else opens its own detail.
 *
 * No panel around it: the rows are boxed already, and the tab names the page.
 * The feed covers the *merged group* — a record folded into this one
 * contributes its history too, which is the whole point of merging.
 */

type Filter = 'all' | TimelineKind;

const time = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });

/** The first page, and the API's own ceiling — it has no cursor, only a capped `limit`. */
const PAGE = 100;
const MAX = 200;

export function CustomerTimeline({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const router = useRouter();
  const { tenantId } = useWorkspaceStore();
  const money = useWorkspaceMoney();
  const [filter, setFilter] = useState<Filter>('all');
  const [limit, setLimit] = useState(PAGE);
  const [openEntry, setOpenEntry] = useState<TimelineEntry | null>(null);
  // Pinned per mount so "Today" cannot change under the reader mid-scroll.
  const [now] = useState(() => new Date());
  const kinds: TimelineKind[] = filter === 'all' ? [] : [filter];

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-timeline', customerId, kinds, limit),
    queryFn: () => getCustomerTimeline(customerId, { limit, kinds }),
    // A new filter is a new key; holding the previous rows keeps the reader's
    // place and turns the change into a quiet refresh instead of skeletons.
    placeholderData: keepPreviousData,
  });
  // The unfiltered feed, for the filter's counts. With "All" chosen it is the
  // query above, so React Query serves both from one request.
  const everything = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-timeline', customerId, [], limit),
    queryFn: () => getCustomerTimeline(customerId, { limit, kinds: [] }),
    placeholderData: keepPreviousData,
  });

  // A failed email is the one entry with something to *do*, so its retry
  // lives in the entry's drawer rather than on another screen.
  const retry = useMutation({
    mutationFn: (deliveryId: string) => retryEmailDelivery(deliveryId, tenantId ?? undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.customers.key('customer-timeline', customerId) });
      toast('success', 'Queued for another attempt.');
    },
    onError: (error) => toast('error', error.message || 'Could not retry that email.'),
  });

  // An order opens the Orders page's own drawer — everything about it, refunds and notes included —
  // with the guest's record still underneath. Staff and sites name who took it and where.
  const { data: staff = [] } = useQuery({
    queryKey: moduleQueryKeys.identity.key('staff', tenantId),
    queryFn: () => getStaff(tenantId ?? undefined),
    enabled: !!tenantId && openEntry?.kind === 'order',
  });
  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId && openEntry?.kind === 'order',
  });
  const staffName = useCallback(
    (userId: string | null | undefined) => {
      const member = userId ? staff.find((entry) => entry.userId === userId) : undefined;
      return member ? member.name || member.email || null : null;
    },
    [staff],
  );
  const locationName = useCallback((id: string) => locations.find((location) => location.id === id)?.name ?? null, [locations]);

  const entries = useMemo(() => data?.data ?? [], [data]);
  // Previous / next in the drawer walk this guest's orders, in the feed's order.
  const orderEntries = useMemo(() => entries.filter((entry) => entry.kind === 'order'), [entries]);
  const orderIndex = openEntry?.kind === 'order' ? orderEntries.findIndex((entry) => entry.id === openEntry.id) : -1;
  const days = useMemo(() => groupTimelineByDay(entries, now), [entries, now]);
  const counts = useMemo(() => (everything.data ? countTimelineKinds(everything.data.data) : null), [everything.data]);
  const mergedIn = (data?.group.length ?? 1) > 1;
  const full = entries.length >= limit;
  const withCount = (label: string, count?: number) => (count === undefined ? label : `${label} · ${count.toLocaleString()}`);

  return (
    <div className="space-y-5">
      <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-3">
        <SegmentedControl<Filter>
          ariaLabel="Show activity of one kind"
          value={filter}
          onChange={setFilter}
          options={[
            { value: 'all', label: withCount('All', everything.data?.data.length) },
            ...TIMELINE_KINDS.map(({ value, label }) => ({
              value,
              label: withCount(label, counts?.[value]),
              icon: TIMELINE_KIND_META[value].icon,
            })),
          ]}
        />
        {isFetching && !isLoading && (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
            <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            Updating
          </span>
        )}
      </motion.div>

      {mergedIn && (
        <motion.p variants={SECTION_RISE} className="rounded-lg border border-rule/60 bg-field px-3.5 py-2.5 text-xs text-muted-foreground">
          Includes history from {data!.group.length - 1} record{data!.group.length - 1 === 1 ? '' : 's'} merged into this one.
        </motion.p>
      )}

      <motion.div variants={SECTION_RISE}>
        {isError ? (
          <ErrorState title="This timeline couldn’t be loaded" onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div role="status" aria-busy="true" aria-label="Loading the timeline">
            <Bone className="mb-2 ml-1 h-4 w-24" />
            <div className="space-y-2 rounded-lg bg-band/50 p-2">
              {Array.from({ length: 6 }, (_, index) => (
                <Bone key={index} className="h-[3.75rem] rounded-md" />
              ))}
            </div>
          </div>
        ) : entries.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={filter === 'all' ? 'Nothing here yet' : 'Nothing of that kind'}
            description={
              filter === 'all'
                ? 'Orders, emails, points changes and consent decisions will appear here as they happen.'
                : 'Try another kind of activity, or go back to all of it.'
            }
            kind={filter === 'all' ? 'start' : 'search'}
            action={filter === 'all' ? undefined : { label: 'Show all activity', onClick: () => setFilter('all') }}
          />
        ) : (
          <div className="space-y-6">
            {days.map((day) => (
              <section key={day.key} aria-labelledby={`timeline-day-${day.key}`}>
                <h2 id={`timeline-day-${day.key}`} className="mb-2 flex items-center gap-2 px-1 text-sm font-semibold text-foreground">
                  {day.label}
                  <span className="rounded-full bg-band px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                    {day.entries.length}
                  </span>
                  {day.orders > 0 && (
                    <span className="ml-auto text-xs font-normal tabular-nums text-muted-foreground">
                      {day.orders} {day.orders === 1 ? 'order' : 'orders'} ·{' '}
                      <span className="font-semibold text-foreground">{money(day.spend)}</span>
                    </span>
                  )}
                </h2>
                {/* Each day a tinted panel of white rows — the newer cards' shape. */}
                <ul className="space-y-2 rounded-lg bg-band/50 p-2">
                  {day.entries.map((entry) => (
                    <EntryRow
                      key={`${entry.kind}-${entry.id}`}
                      entry={entry}
                      selected={openEntry?.id === entry.id && openEntry.kind === entry.kind}
                      money={money}
                      now={now.getTime()}
                      onOpen={() => setOpenEntry(entry)}
                    />
                  ))}
                </ul>
              </section>
            ))}

            {/* No cursor in the API, only a capped limit — so "more" raises it
                once, to the cap, and past that the order history is in Orders. */}
            {full && limit < MAX && <LoadMore hasMore loading={isFetching} onLoadMore={() => setLimit(MAX)} />}
            {full && limit >= MAX ? (
              <p className="flex flex-wrap items-center justify-center gap-2 pb-2 text-center text-xs text-muted-foreground">
                The latest {entries.length.toLocaleString()} entries — the most the timeline holds.
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  onClick={() => router.push(`/orders?customer=${customerId}`)}
                >
                  All their orders
                </Button>
              </p>
            ) : (
              !full && (
                <p className="pb-2 text-center text-xs tabular-nums text-muted-foreground">
                  That’s everything — {entries.length.toLocaleString()} {entries.length === 1 ? 'entry' : 'entries'}
                </p>
              )
            )}
          </div>
        )}
      </motion.div>

      {openEntry?.kind === 'order' && (
        <OrderDrawer
          key={openEntry.id}
          orderId={openEntry.id}
          staffName={staffName}
          locationName={locationName}
          onClose={() => setOpenEntry(null)}
          onPrev={orderIndex > 0 ? () => setOpenEntry(orderEntries[orderIndex - 1]) : undefined}
          onNext={orderIndex >= 0 && orderIndex < orderEntries.length - 1 ? () => setOpenEntry(orderEntries[orderIndex + 1]) : undefined}
        />
      )}
      {openEntry && openEntry.kind !== 'order' && (
        <TimelineEntryDrawer
          entry={openEntry}
          customerId={customerId}
          tenantId={tenantId ?? undefined}
          onRetryEmail={(deliveryId) => retry.mutate(deliveryId)}
          retryPending={retry.isPending}
          onClose={() => setOpenEntry(null)}
        />
      )}
    </div>
  );
}

/** One entry as an audit-log row. The whole row opens its detail. */
function EntryRow({
  entry,
  selected,
  money,
  now,
  onOpen,
}: {
  entry: TimelineEntry;
  selected: boolean;
  money: (amount: number) => string;
  now: number;
  onOpen: () => void;
}) {
  const meta = TIMELINE_KIND_META[entry.kind];
  const Icon = meta.icon;
  const row = timelineRowText(entry, money, now);

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'group flex w-full items-center gap-3 rounded-md bg-card px-3 py-2.5 text-left shadow-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          selected ? 'ring-2 ring-primary/30' : 'hover:bg-background',
        )}
      >
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', meta.tile)}>
          <Icon size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">
            <span className="font-semibold">{row.lead}</span> {row.phrase}
          </span>
          {row.detail && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{row.detail}</span>}
        </span>
        {row.pill && (
          <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', PILL_TONE[row.pill.tone])}>
            {row.pill.label}
          </span>
        )}
        <time
          className="shrink-0 rounded-md bg-band/70 px-1.5 py-0.5 text-xs font-medium tabular-nums text-muted-foreground"
          dateTime={entry.at}
          title={formatDateTime(entry.at)}
        >
          {time(entry.at)}
        </time>
        <ChevronRight
          size={14}
          className="shrink-0 text-muted-foreground/60 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}
