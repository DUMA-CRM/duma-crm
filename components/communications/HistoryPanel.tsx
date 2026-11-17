'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { MailX, RefreshCw, Search, Send } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { LoadMore } from '@/components/shared/LoadMore';
import { NeedsAttention } from '@/components/shared/NeedsAttention';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, type SelectOption } from '@/components/ui/select';

import { dayHeading, localDayKey } from '@/lib/audit/groups';
import { timeOfDay } from '@/lib/audit/narrative';
import { type EmailDelivery, getEmailDeliveries, retryEmailDelivery } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { type DeliveryBucket, type HistoryWindow, deliveriesByDay, deliveryTime, filterDeliveries } from '@/lib/utils/communications';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { CommunicationsToolbar } from './CommunicationsToolbar';
import { BOOKING_EMAIL_LABELS } from './shared';
import { useEmailAccess } from './useEmailAccess';

const STATUS_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Any status' },
  { value: 'sent', label: 'Sent' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const WINDOW_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'Any time' },
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

/** The recipient's corner dot per status — the person and their email's state in one mark. */
export const DELIVERY_STATUS: Record<EmailDelivery['status'], { tone: Tone; label: string }> = {
  sent: { tone: 'success', label: 'Sent' },
  failed: { tone: 'exception', label: 'Failed' },
  queued: { tone: 'muted', label: 'Waiting' },
  sending: { tone: 'primary', label: 'Sending' },
  cancelled: { tone: 'warning', label: 'Cancelled' },
};

/**
 * Every email that went out, as the audit log reads: failures counted at the
 * top with a way to them, the search with the Status, Template and When
 * selects and the count, then a titled list per day, newest first, loading
 * older pages as you reach the end.
 *
 * Filtering happens here, over what's loaded — the API pages by date and
 * doesn't filter by status or template.
 */
export function HistoryPanel({
  onPreview,
  initialStatus = 'all',
}: {
  onPreview: (delivery: EmailDelivery) => void;
  /** The Overview's "failed" links open straight onto failures. */
  initialStatus?: DeliveryBucket;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const { canSend } = useEmailAccess();
  const reduceMotion = useReducedMotion();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DeliveryBucket>(initialStatus);
  const [template, setTemplate] = useState('all');
  const [when, setWhen] = useState<HistoryWindow>('all');
  // Pinned on mount so the day headings and the time window don't slide under a render.
  const [now] = useState(() => Date.now());

  const history = useInfiniteQuery({
    // Under 'email-deliveries', so every mutation that invalidates deliveries reaches it.
    queryKey: moduleQueryKeys.communications.key('email-deliveries', tenantId, 'history'),
    queryFn: ({ pageParam }) => getEmailDeliveries(tenantId ?? undefined, pageParam),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: !!tenantId,
    refetchInterval: 15_000,
  });
  const retry = useMutation({
    mutationFn: (id: string) => retryEmailDelivery(id, tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-deliveries') });
      toast('success', 'Queued for another attempt.');
    },
    onError: (error) => toast('error', error.message),
  });

  // A live log shifts between pages, so a row can arrive twice — keep the first.
  const deliveries = useMemo(() => {
    const seen = new Set<string>();
    return (history.data?.pages ?? []).flatMap((page) => page.data).filter((item) => !seen.has(item.id) && seen.add(item.id));
  }, [history.data]);
  const total = history.data?.pages[0]?.total ?? 0;

  // Choices come from what's loaded, so a filter never offers a value that returns nothing.
  const templateOptions = useMemo<SelectOption[]>(() => {
    const names = new Map<string, string>();
    for (const delivery of deliveries) if (delivery.template) names.set(delivery.template.id, delivery.template.name);
    return [
      { value: 'all', label: 'Any template' },
      ...[...names].sort((a, b) => a[1].localeCompare(b[1])).map(([value, label]) => ({ value, label })),
    ];
  }, [deliveries]);

  const visible = useMemo(
    () => filterDeliveries(deliveries, { search, status, template, window: when, now }),
    [deliveries, search, status, template, when, now],
  );
  const days = useMemo(() => deliveriesByDay(visible, localDayKey), [visible]);
  const filtered = status !== 'all' || template !== 'all' || when !== 'all' || Boolean(search.trim());
  const clearFilters = () => {
    setSearch('');
    setStatus('all');
    setTemplate('all');
    setWhen('all');
  };

  const failedCount = useMemo(() => deliveries.filter((delivery) => delivery.status === 'failed').length, [deliveries]);

  if (history.isPending)
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Bone className="h-9 min-w-56 flex-1" />
          <Bone className="h-9 w-40" />
          <Bone className="h-9 w-40" />
          <Bone className="h-9 w-40" />
        </div>
        <ListSkeleton rows={8} avatar label="Loading email history" />
      </div>
    );

  if (history.isError && deliveries.length === 0)
    return <ErrorState className="flex-1" title="Email history couldn’t be loaded" onRetry={() => void history.refetch()} />;

  if (deliveries.length === 0)
    return (
      <EmptyState
        icon={Send}
        title="No emails sent yet"
        className="flex-1"
        description="Emails appear here once they’re sent — switch on an automation, or send one by hand from a customer record."
      />
    );

  return (
    <motion.div
      className="flex flex-1 flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      {/* A count and a way to them — each failed row below carries its own fix. */}
      {status !== 'failed' && (
        <NeedsAttention
          items={
            failedCount > 0
              ? [
                  {
                    key: 'failed',
                    tone: 'exception',
                    icon: MailX,
                    title: `${failedCount} ${failedCount === 1 ? 'email' : 'emails'} failed`,
                    fix: { label: 'Show failed', run: () => setStatus('failed') },
                  },
                ]
              : []
          }
        />
      )}

      <motion.div variants={SECTION_RISE}>
        <CommunicationsToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Recipient or subject…"
          label="Find an email by recipient or subject"
          count={filtered ? `${visible.length} of ${deliveries.length} loaded` : `${deliveries.length} of ${total.toLocaleString()} emails`}
          filters={
            <>
              <Select
                value={status}
                onValueChange={(value) => setStatus(value as DeliveryBucket)}
                options={STATUS_OPTIONS}
                ariaLabel="Status"
                className="w-40"
              />
              <Select
                value={template}
                onValueChange={setTemplate}
                options={templateOptions}
                ariaLabel="Template"
                className="w-40"
                disabled={templateOptions.length === 1}
              />
              <Select
                value={when}
                onValueChange={(value) => setWhen(value as HistoryWindow)}
                options={WINDOW_OPTIONS}
                ariaLabel="When"
                className="w-40"
              />
            </>
          }
        />
      </motion.div>

      {days.length === 0 ? (
        <motion.div variants={SECTION_RISE} className="flex flex-1 flex-col">
          <EmptyState
            className="flex-1"
            icon={Search}
            kind="search"
            title="No email matches"
            description="Try a different search or filter."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        </motion.div>
      ) : (
        days.map((day) => (
          <RecordGroup key={day.day} id={`history-day-${day.day}`} title={dayHeading(day.day, now)}>
            <ListRowGroup aria-label={dayHeading(day.day, now)}>
              {day.items.map((delivery) => (
                <DeliveryRow
                  key={delivery.id}
                  delivery={delivery}
                  canRetry={canSend}
                  retrying={retry.isPending && retry.variables === delivery.id}
                  onRetry={() => retry.mutate(delivery.id)}
                  onOpen={() => onPreview(delivery)}
                />
              ))}
            </ListRowGroup>
          </RecordGroup>
        ))
      )}

      <LoadMore
        hasMore={Boolean(history.hasNextPage)}
        loading={history.isFetchingNextPage}
        onLoadMore={() => void history.fetchNextPage()}
      />
      {!history.hasNextPage && !filtered && <p className="pb-2 text-center text-xs text-muted-foreground">All loaded emails shown</p>}
    </motion.div>
  );
}

/** One email: the recipient with their email's state as a dot, who and what, the template or the error, time — and Try again on a failure. */
function DeliveryRow({
  delivery,
  canRetry,
  retrying,
  onRetry,
  onOpen,
}: {
  delivery: EmailDelivery;
  canRetry: boolean;
  retrying: boolean;
  onRetry: () => void;
  onOpen: () => void;
}) {
  const state = DELIVERY_STATUS[delivery.status];
  const failed = delivery.status === 'failed';
  const detail = [
    delivery.template?.name ?? BOOKING_EMAIL_LABELS[delivery.trigger] ?? delivery.trigger.replaceAll('_', ' '),
    delivery.toName && delivery.toEmail,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <ListRow
      // Initials only: no Gravatar lookup for every address in the send log.
      leading={<Avatar name={delivery.toName || delivery.toEmail} status={state.tone} statusLabel={state.label} />}
      title={
        <>
          {delivery.toName || delivery.toEmail}
          <span className="font-normal text-muted-foreground"> — {delivery.subject}</span>
        </>
      }
      titleExtra={
        failed ? (
          <Badge variant="destructive" className="shrink-0">
            Failed
          </Badge>
        ) : undefined
      }
      meta={failed && delivery.lastError ? <span className="text-exception">{delivery.lastError}</span> : detail}
      trailing={
        <>
          {delivery.attemptCount > 1 && (
            <span className="hidden text-micro tabular-nums text-muted-foreground sm:inline">
              attempt {delivery.attemptCount}/{delivery.maxAttempts}
            </span>
          )}
          <span className="hidden w-12 text-right text-xs tabular-nums text-muted-foreground sm:block">
            {timeOfDay(deliveryTime(delivery)).slice(0, 5)}
          </span>
        </>
      }
      targetLabel={`Open email to ${delivery.toEmail}: ${delivery.subject}`}
      onClick={onOpen}
      chevron={false}
      control={
        failed && canRetry ? (
          <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry} className="gap-1.5">
            <RefreshCw className={cn(retrying && 'animate-spin')} /> Try again
          </Button>
        ) : undefined
      }
    />
  );
}
