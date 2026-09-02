'use client';

import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { TimelineEntryDrawer } from '@/components/customers/TimelineEntryDrawer';
import { Activity, ChevronRight, Coins, Loader2, Mail, MailX, ShieldCheck, ShoppingBag } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getCustomerTimeline } from '@/lib/api/customers.service';
import { retryEmailDelivery } from '@/lib/api/email.service';
import { formatDateTime } from '@/lib/utils/date';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { TimelineEntry, TimelineKind } from '@/types/customers';

/**
 * One chronological feed of everything that happened with a guest.
 *
 * This replaces four separate silos — an orders table, an emails table, and
 * consent and privacy history buried in other tabs. The question staff actually
 * ask is "what happened with this person", and answering it used to mean opening
 * three tabs and mentally interleaving them by date.
 *
 * Points movements appear here for the first time: before the loyalty ledger,
 * adjustments left no trace at all.
 *
 * The feed covers the *merged group* — a record folded into this one contributes
 * its history too, which is the whole point of merging rather than deleting.
 */

const KINDS: { value: TimelineKind; label: string }[] = [
  { value: 'order', label: 'Orders' },
  { value: 'points', label: 'Points' },
  { value: 'email', label: 'Emails' },
  { value: 'consent', label: 'Consent' },
  { value: 'privacy', label: 'Privacy' },
];

const KIND_META: Record<TimelineKind, { icon: IconComponent; tone: string }> = {
  order: { icon: ShoppingBag, tone: 'text-momentum' },
  points: { icon: Coins, tone: 'text-stock' },
  email: { icon: Mail, tone: 'text-reference' },
  consent: { icon: ShieldCheck, tone: 'text-measured' },
  privacy: { icon: ShieldCheck, tone: 'text-exception' },
};

/** Group entries under a human day heading so scanning follows the calendar. */
function dayLabel(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (isSameDay(date, today)) return 'Today';
  const yesterday = new Date(today.getTime() - 86_400_000);
  if (isSameDay(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

export function CustomerTimeline({ customerId }: { customerId: string }) {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const [kinds, setKinds] = useState<TimelineKind[]>([]);
  const [openEntry, setOpenEntry] = useState<TimelineEntry | null>(null);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ['customer-timeline', customerId, kinds],
    queryFn: () => getCustomerTimeline(customerId, { limit: 100, kinds }),
    // Changing a filter makes a new query key, which would otherwise blank the
    // feed to skeletons on every toggle. Holding the previous rows keeps the
    // place you were reading and turns the change into a quiet refresh.
    placeholderData: keepPreviousData,
  });

  // A failed email is the one timeline entry with something to *do*, so the
  // action lives on the entry rather than sending people to another screen.
  const retry = useMutation({
    mutationFn: (deliveryId: string) => retryEmailDelivery(deliveryId, tenantId ?? undefined),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['customer-timeline', customerId] });
      toast('success', 'Queued for another attempt.');
    },
    onError: (error) => toast('error', error.message || 'Could not retry that email.'),
  });

  const entries = data?.data ?? [];
  const mergedIn = (data?.group.length ?? 1) > 1;
  const showingAll = kinds.length === 0;

  const toggleKind = (kind: TimelineKind) =>
    setKinds((current) => (current.includes(kind) ? current.filter((value) => value !== kind) : [...current, kind]));

  return (
    <div className="space-y-3">
      {/* An explicit "All" rather than lighting every chip when nothing is
          chosen: that older treatment showed five selected-looking buttons that
          each reported themselves unpressed, so the control disagreed with
          itself for anyone using a screen reader. */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter activity by kind">
          <FilterButton on={showingAll} onClick={() => setKinds([])}>
            All activity
          </FilterButton>
          <span aria-hidden="true" className="mx-0.5 h-4 w-px bg-rule" />
          {KINDS.map(({ value, label }) => {
            const Icon = KIND_META[value].icon;
            return (
              <FilterButton key={value} on={kinds.includes(value)} onClick={() => toggleKind(value)}>
                {/* The glyph keeps its domain colour whether the chip is on or
                    off, so a chip and the rows it controls are visibly the same
                    thing. Selection stays in the app's one selected-filter
                    idiom rather than becoming five different highlights. */}
                <Icon size={13} className={cn('shrink-0', KIND_META[value].tone)} aria-hidden="true" />
                {label}
              </FilterButton>
            );
          })}
        </div>

        <span className="ml-auto flex items-center gap-1.5 pl-2 text-xs tabular-nums text-muted-foreground" aria-live="polite">
          {isFetching && !isLoading && <Loader2 size={12} className="animate-spin" aria-label="Updating the timeline" />}
          {isLoading ? 'Loading…' : `${entries.length.toLocaleString()} ${entries.length === 1 ? 'entry' : 'entries'}`}
        </span>
      </div>

      {mergedIn && (
        <p className="rounded-sm border border-rule bg-band/55 px-3 py-2 text-xs text-muted-foreground">
          Includes history from {data!.group.length - 1} record{data!.group.length - 1 === 1 ? '' : 's'} merged into this one.
        </p>
      )}

      {isError ? (
        <div className="rounded-sm border border-exception/30 bg-card p-6 text-center">
          <p className="text-sm text-muted-foreground">This timeline could not be loaded.</p>
          <Button variant="outline" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      ) : isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="h-14 animate-pulse rounded-sm border border-rule bg-band/40" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-sm border border-dashed border-rule">
          <EmptyState
            icon={Activity}
            title={showingAll ? 'Nothing here yet' : 'Nothing of that kind'}
            description={
              showingAll
                ? 'Orders, emails, points changes and consent decisions will appear here as they happen.'
                : 'Try showing more kinds of activity, or go back to all activity.'
            }
          />
        </div>
      ) : (
        <ol className="space-y-3">
          {groupByDay(entries).map(([day, dayEntries]) => (
            <li key={day}>
              <h3 className="mb-1.5 text-micro font-semibold uppercase tracking-micro text-muted-foreground">{day}</h3>
              <ul className="divide-y divide-rule/50 overflow-hidden rounded-sm border border-rule bg-card">
                {dayEntries.map((entry) => {
                  const meta = KIND_META[entry.kind];
                  const Icon = meta.icon;

                  return (
                    <li key={`${entry.kind}-${entry.id}`}>
                      {/* The whole row opens the detail. Every kind has more to
                          say than fits on one line, and a row that looks
                          clickable everywhere but only responds on the order
                          title is worse than one that never responds at all. */}
                      <button
                        type="button"
                        onClick={() => setOpenEntry(entry)}
                        aria-label={`Open details for this ${entry.kind} entry`}
                        className="flex w-full items-start gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-band focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30"
                      >
                        <span className={cn('mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-sm bg-band', meta.tone)}>
                          <Icon size={14} aria-hidden="true" />
                        </span>

                        <div className="min-w-0 flex-1">
                          <EntryBody entry={entry} />
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {entry.kind === 'email' && entry.status === 'failed' && (
                            <span className="inline-flex items-center gap-1 rounded-sm bg-exception/10 px-1.5 py-0.5 text-micro font-semibold uppercase tracking-micro text-exception">
                              <MailX size={11} aria-hidden="true" />
                              Failed
                            </span>
                          )}
                          <time
                            className="text-xs tabular-nums text-muted-foreground"
                            dateTime={entry.at}
                            title={formatDateTime(entry.at)}
                          >
                            {time(entry.at)}
                          </time>
                          <ChevronRight size={14} className="text-muted-foreground" aria-hidden="true" />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ol>
      )}

      {openEntry && (
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

function FilterButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold',
        'transition-[background-color,border-color,color,box-shadow] duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
        on
          ? // A primary-tinted fill behind a full-strength edge, with the short
            // magnetic lift. The old selected state was a neutral band fill
            // behind a 40%-opacity border — barely a step from the resting
            // chip, so a filtered feed did not look filtered.
            'border-primary bg-primary/12 text-primary shadow-sm'
          : 'border-rule bg-background text-muted-foreground hover:bg-band hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/** Preserve arrival order (newest first) while bucketing by day. */
function groupByDay(entries: TimelineEntry[]): [string, TimelineEntry[]][] {
  const buckets = new Map<string, TimelineEntry[]>();
  for (const entry of entries) {
    const key = dayLabel(entry.at);
    const existing = buckets.get(key);
    if (existing) existing.push(entry);
    else buckets.set(key, [entry]);
  }
  return [...buckets.entries()];
}

function EntryBody({ entry }: { entry: TimelineEntry }) {
  switch (entry.kind) {
    case 'order':
      return (
        <div>
          {/* A span, not a button: the row itself is the button, and nesting one
              inside another is invalid and unreachable by keyboard. */}
          <span className="text-sm font-semibold text-foreground">Order · £{Number(entry.total ?? 0).toFixed(2)}</span>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            <span className="capitalize">{entry.status}</span>
            {entry.source && <span>· {entry.source === 'pos' ? 'at the till' : entry.source === 'qr_code' ? 'QR code' : 'mobile'}</span>}
            {entry.refundStatus && entry.refundStatus !== 'none' && (
              <Badge variant="destructive" className="ml-1">
                {entry.refundStatus === 'full' ? 'Refunded' : 'Part refunded'}
              </Badge>
            )}
          </p>
        </div>
      );

    case 'points':
      return (
        <div>
          <p className="text-sm font-semibold text-foreground">
            <span className={entry.delta! > 0 ? 'text-momentum' : 'text-exception'}>
              {entry.delta! > 0 ? '+' : ''}
              {entry.delta!.toLocaleString()} points
            </span>
            <span className="ml-2 font-normal text-muted-foreground">balance {entry.balanceAfter?.toLocaleString()}</span>
          </p>
          {/* The field the old endpoint accepted and threw away. */}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.reason ? entry.reason : <span className="italic">No reason recorded</span>}
          </p>
        </div>
      );

    case 'email':
      return (
        <div>
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
            {entry.status === 'failed' && <MailX size={13} className="shrink-0 text-exception" aria-hidden="true" />}
            {entry.subject}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {entry.status === 'sent' ? 'Sent' : entry.status === 'failed' ? 'Not sent' : entry.status} · {entry.toEmail}
          </p>
        </div>
      );

    case 'consent':
      return (
        <div>
          <p className="text-sm font-semibold text-foreground">
            {entry.action === 'opted_in'
              ? 'Opted in to marketing'
              : entry.action === 'opted_out'
                ? 'Opted out of marketing'
                : 'Address suppressed'}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {(entry.source ?? '').replaceAll('_', ' ')}
            {entry.reason ? ` · ${entry.reason}` : ''}
          </p>
        </div>
      );

    case 'privacy':
      return (
        <div>
          <p className="text-sm font-semibold capitalize text-foreground">{(entry.type ?? '').replaceAll('_', ' ')} request</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            <span className="capitalize">{entry.status}</span>
            {entry.dueAt && ` · due ${formatDateTime(entry.dueAt)}`}
          </p>
        </div>
      );

    default:
      return null;
  }
}
