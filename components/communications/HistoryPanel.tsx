'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

import { MailX, RefreshCw, Search, Send, X } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Avatar } from '@/components/shared/Avatar';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadMore } from '@/components/shared/LoadMore';
import { Pill } from '@/components/shared/Pill';
import { Bone, RowSkeleton } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, type SelectOption } from '@/components/ui/select';

import { dayHeading, localDayKey } from '@/lib/audit/groups';
import { timeOfDay } from '@/lib/audit/narrative';
import { type EmailDelivery, getEmailDeliveries, retryEmailDelivery } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type DeliveryBucket, type HistoryWindow, deliveriesByDay, deliveryTime, filterDeliveries } from '@/lib/utils/communications';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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
 * Every email that went out, as the audit log reads: a find-and-filter row,
 * failures folded at the top with their fix, then a list per day, newest
 * first, loading older pages as you reach the end.
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
      <div className="space-y-5" role="status" aria-busy="true" aria-label="Loading email history">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Bone className="h-9 min-w-56 flex-1 lg:max-w-sm" />
          <Bone className="h-9 w-40" />
          <Bone className="h-9 w-44" />
          <Bone className="h-9 w-40" />
          <Bone className="ml-auto h-3 w-24" />
        </div>
        <div>
          <Bone className="mb-2 ml-1 h-4 w-24" />
          <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {Array.from({ length: 8 }, (_, index) => (
              <RowSkeleton key={index} index={index} avatar />
            ))}
          </div>
        </div>
      </div>
    );

  if (history.isError && deliveries.length === 0)
    return (
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <ErrorState title="Email history couldn’t be loaded" onRetry={() => void history.refetch()} />
      </div>
    );

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
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      {/* A count and a way to them — each failed row below carries its own fix. */}
      {failedCount > 0 && status !== 'failed' && (
        <motion.section
          variants={SECTION_RISE}
          aria-label="Needs attention"
          className="flex items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-exception/8 text-exception">
            <MailX size={18} aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            {failedCount} {failedCount === 1 ? 'email' : 'emails'} failed
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setStatus('failed')}>
            Show failed
          </Button>
        </motion.section>
      )}

      <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1 lg:max-w-sm">
          <Input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search email history"
            placeholder="Search recipient or subject…"
            leftIcon={<Search size={14} />}
            rightAction={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : undefined
            }
          />
        </div>
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
          className="w-44"
          disabled={templateOptions.length === 1}
        />
        <Select
          value={when}
          onValueChange={(value) => setWhen(value as HistoryWindow)}
          options={WINDOW_OPTIONS}
          ariaLabel="When"
          className="w-40"
        />
        {filtered && (
          <button type="button" onClick={clearFilters} className="h-8 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            Clear
          </button>
        )}
        <span className="ml-auto text-xs text-muted-foreground tabular-nums">
          {filtered ? `${visible.length} of ${deliveries.length} loaded` : `${deliveries.length} of ${total.toLocaleString()} emails`}
        </span>
      </motion.div>

      {days.length === 0 ? (
        <motion.div variants={SECTION_RISE}>
          <EmptyState
            icon={Search}
            kind="search"
            title="Nothing matches"
            description="Try another search or filter."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        </motion.div>
      ) : (
        <div className="space-y-6">
          {days.map((day) => (
            <motion.section key={day.day} variants={SECTION_RISE} aria-labelledby={`history-day-${day.day}`}>
              <h2 id={`history-day-${day.day}`} className="mb-2 px-1 text-sm font-semibold text-foreground">
                {dayHeading(day.day, now)}
              </h2>
              <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
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
              </ul>
            </motion.section>
          ))}
        </div>
      )}

      <LoadMore
        hasMore={Boolean(history.hasNextPage)}
        loading={history.isFetchingNextPage}
        onLoadMore={() => void history.fetchNextPage()}
      />
      {!history.hasNextPage && !filtered && <p className="pb-2 text-center text-xs text-muted-foreground">That’s everything</p>}
    </motion.div>
  );
}

/** One email in the audit log's shape: the recipient with their email's state as a dot, who and what, time. */
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
  const detail = [delivery.template?.name ?? delivery.trigger.replaceAll('_', ' '), delivery.toName && delivery.toEmail]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className="group flex items-center gap-3 border-b border-rule/45 pr-3.5 transition-colors last:border-b-0 hover:bg-band/40">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open email to ${delivery.toEmail}: ${delivery.subject}`}
        className="flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5 text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {/* Initials only: no Gravatar lookup for every address in the send log. */}
        <Avatar name={delivery.toName || delivery.toEmail} status={state.tone} statusLabel={state.label} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">
            <span className="font-semibold">{delivery.toName || delivery.toEmail}</span>
            <span className="text-muted-foreground"> — {delivery.subject}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {delivery.status === 'failed' && delivery.lastError ? <span className="text-exception">{delivery.lastError}</span> : detail}
          </span>
        </span>
        {delivery.status === 'failed' && <Pill tone="exception">Failed</Pill>}
        {delivery.attemptCount > 1 && (
          <span className="hidden shrink-0 text-micro tabular-nums text-muted-foreground sm:inline">
            attempt {delivery.attemptCount}/{delivery.maxAttempts}
          </span>
        )}
        <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
          {timeOfDay(deliveryTime(delivery)).slice(0, 5)}
        </span>
      </button>
      {delivery.status === 'failed' && canRetry && (
        <Button variant="outline" size="sm" disabled={retrying} onClick={onRetry} className="shrink-0 gap-1.5">
          <RefreshCw className={cn(retrying && 'animate-spin')} /> Try again
        </Button>
      )}
    </li>
  );
}
