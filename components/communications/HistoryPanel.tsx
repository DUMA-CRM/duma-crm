'use client';

import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useMemo, useState } from 'react';

import { Clock, MailX, RefreshCw, Search, Send, X } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadMore } from '@/components/shared/LoadMore';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
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

/** The glyph and its tint per status — the same tinted square the audit log opens each row with. */
const GLYPH: Record<EmailDelivery['status'], { icon: typeof Send; className: string }> = {
  sent: { icon: Send, className: 'bg-momentum/8 text-momentum' },
  failed: { icon: MailX, className: 'bg-exception/8 text-exception' },
  queued: { icon: Clock, className: 'bg-band text-muted-foreground' },
  sending: { icon: Clock, className: 'bg-primary/8 text-primary' },
  cancelled: { icon: X, className: 'bg-measured/10 text-measured' },
};

/** Only what went differently — sent is the default and says nothing. */
const PILL: Partial<Record<EmailDelivery['status'], { label: string; className: string }>> = {
  failed: { label: 'Failed', className: 'bg-exception/8 text-exception' },
  queued: { label: 'Waiting', className: 'bg-band text-muted-foreground' },
  sending: { label: 'Sending', className: 'bg-primary/8 text-primary' },
  cancelled: { label: 'Cancelled', className: 'bg-measured/10 text-measured' },
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

  const failures = useMemo<NeedsAttentionItem[]>(
    () =>
      deliveries
        .filter((delivery) => delivery.status === 'failed')
        .map((delivery) => ({
          key: delivery.id,
          tone: 'exception',
          icon: MailX,
          title: `Email to ${delivery.toName || delivery.toEmail} failed`,
          detail: delivery.lastError ?? delivery.subject,
          fix: canSend ? { label: 'Try again', run: () => retry.mutate(delivery.id) } : { label: 'Open', run: () => onPreview(delivery) },
        })),
    [canSend, deliveries, onPreview, retry],
  );

  if (history.isPending)
    return (
      <div className="space-y-2" aria-label="Loading email history">
        <div className="h-4 w-24 animate-pulse rounded-sm bg-band" />
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="h-15 animate-pulse rounded-lg bg-band/60" />
        ))}
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
      <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
        <EmptyState
          icon={Send}
          title="No emails sent yet"
          description="Switch on an automation, or send one by hand from a customer record."
        />
      </div>
    );

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <NeedsAttention items={failures} summary={`${failures.length} ${failures.length === 1 ? 'email' : 'emails'} failed`} icon={MailX} />

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
        <motion.div variants={SECTION_RISE} className="overflow-hidden rounded-lg border border-rule/60 bg-card">
          <EmptyState icon={Search} title="Nothing matches" description="Try another search, or clear the filters." />
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
      {!history.hasNextPage && !filtered && (
        <p className="pb-2 text-center text-xs tabular-nums text-muted-foreground">
          That’s everything — {total.toLocaleString()} {total === 1 ? 'email' : 'emails'}
        </p>
      )}
    </motion.div>
  );
}

/** One email in the audit log's shape: tinted glyph, who and what, status pill, time. */
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
  const glyph = GLYPH[delivery.status];
  const pill = PILL[delivery.status];
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
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', glyph.className)} aria-hidden="true">
          <glyph.icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-foreground">
            <span className="font-semibold">{delivery.toName || delivery.toEmail}</span>
            <span className="text-muted-foreground"> — {delivery.subject}</span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {delivery.status === 'failed' && delivery.lastError ? <span className="text-exception">{delivery.lastError}</span> : detail}
          </span>
        </span>
        {pill && <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', pill.className)}>{pill.label}</span>}
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
