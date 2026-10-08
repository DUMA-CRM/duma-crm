'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RowTile } from '@/components/cms/rows';
import { PILL_TONE, TIMELINE_KIND_META } from '@/components/customers/timelineKinds';
import {
  Activity,
  CalendarDays,
  Clock,
  Coins,
  FileText,
  type IconComponent,
  Loader2,
  Mail,
  MailX,
  RefreshCw,
  Send,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Type,
  User,
  Zap,
} from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getEmailDeliveries } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { timelineRowText } from '@/lib/utils/customer-timeline';
import { formatDateTime } from '@/lib/utils/date';
import type { TimelineEntry } from '@/types/customers';

/**
 * The detail behind one timeline row.
 *
 * The feed answers "what happened"; this answers "what exactly". Until now a
 * timeline row was a dead end unless it was an order — and even then it threw
 * you out to the Orders page, losing the guest you were reading about. The
 * drawer keeps the record underneath: you look at the email that bounced, close
 * it, and carry on down the list.
 *
 * An order is not opened here — the timeline gives it the Orders page's own
 * drawer, which already holds everything about one. Only emails need a request. Points, consent and privacy entries
 * already carry everything they can say, so those open instantly rather than
 * showing a spinner to render four fields the caller already had.
 *
 * Laid out as the newer drawers are (Media's file drawer): the row's own tile
 * and sentence as the header, then titled white cards of rows, each with an
 * icon tile, its name, and its value on the right.
 */

interface Props {
  entry: TimelineEntry;
  customerId: string;
  tenantId?: string;
  /** Retry a failed delivery. Provided by the timeline, which owns the mutation. */
  onRetryEmail?: (deliveryId: string) => void;
  retryPending?: boolean;
  onClose: () => void;
}

export function TimelineEntryDrawer({ entry, customerId, tenantId, onRetryEmail, retryPending, onClose }: Props) {
  const router = useRouter();
  const money = useWorkspaceMoney();
  // Pinned per open; only "overdue" reads it.
  const [now] = useState(() => Date.now());
  const meta = TIMELINE_KIND_META[entry.kind];
  const Icon = meta.icon;
  const row = timelineRowText(entry, money, now);
  // Consent and privacy are owned by the Compliance tab, which can change them.
  const toCompliance = () => {
    onClose();
    router.push(`/customers/${customerId}?tab=compliance`);
  };

  return (
    <Drawer
      title={`${row.lead} ${row.phrase}`}
      description={
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {row.pill && (
            <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', PILL_TONE[row.pill.tone])}>{row.pill.label}</span>
          )}
          {formatDateTime(entry.at)}
        </span>
      }
      leading={
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', meta.tile)}>
          <Icon size={18} aria-hidden="true" />
        </span>
      }
      onClose={onClose}
      footer={
        entry.kind === 'email' && entry.status === 'failed' && onRetryEmail ? (
          <Button size="lg" onClick={() => onRetryEmail(entry.id)} disabled={retryPending} className="w-full">
            {retryPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw data-icon="inline-start" />}
            {retryPending ? 'Queueing…' : 'Try sending again'}
          </Button>
        ) : entry.kind === 'consent' || entry.kind === 'privacy' ? (
          <Button size="lg" variant="outline" onClick={toCompliance} className="w-full">
            <ShieldCheck data-icon="inline-start" />
            Open the Compliance tab
          </Button>
        ) : undefined
      }
    >
      {entry.kind === 'email' ? (
        <EmailDetailBody entry={entry} customerId={customerId} tenantId={tenantId} />
      ) : entry.kind === 'points' ? (
        <PointsDetailBody entry={entry} />
      ) : entry.kind === 'consent' ? (
        <ConsentDetailBody entry={entry} />
      ) : (
        <PrivacyDetailBody entry={entry} />
      )}
    </Drawer>
  );
}

// ── Email ─────────────────────────────────────────────────────────────────

function EmailDetailBody({ entry, customerId, tenantId }: { entry: TimelineEntry; customerId: string; tenantId?: string }) {
  // There is no single-delivery endpoint, so the customer's deliveries are read
  // and matched by id. Cheap, and already cached by the communications screens.
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-deliveries', tenantId, 1, customerId),
    queryFn: () => getEmailDeliveries(tenantId, 1, { customerId, limit: 100 }),
  });

  const delivery = data?.data.find((item) => item.id === entry.id);

  if (isPending) return <LoadingState label="Loading the message" />;
  if (isError) return <ErrorState title="This message couldn’t be loaded" onRetry={() => void refetch()} />;

  return (
    // A column with a definite height so the preview below can claim whatever
    // the facts above it do not use — reading the message is the point of
    // opening this row, and a fixed 384px window made you scroll a scroll.
    <div className="flex h-full min-h-0 flex-col gap-6">
      <section>
        <SectionTitle>The message</SectionTitle>
        <Panel>
          <Row icon={Type} label="Subject">
            <span className="font-semibold wrap-break-word">{entry.subject ?? delivery?.subject ?? '—'}</span>
          </Row>
          <Row icon={Mail} label="To">
            <span className="break-all">{entry.toEmail ?? delivery?.toEmail ?? '—'}</span>
          </Row>
          <Row icon={Activity} label="Status">
            <span className="capitalize">{entry.status}</span>
            {delivery && delivery.attemptCount > 1 && (
              <span className="text-xs text-muted-foreground">
                · {delivery.attemptCount} of {delivery.maxAttempts} attempts
              </span>
            )}
          </Row>
          {entry.trigger && (
            <Row icon={Zap} label="Sent because">
              <span className="capitalize">{entry.trigger.replaceAll('_', ' ')}</span>
            </Row>
          )}
          {delivery?.template?.name && (
            <Row icon={FileText} label="Template">
              {delivery.template.name}
            </Row>
          )}
          {delivery?.sentAt && (
            <Row icon={Send} label="Sent at">
              {formatDateTime(delivery.sentAt)}
            </Row>
          )}
        </Panel>
      </section>

      {/* The failure reason is the whole reason this row was worth opening. */}
      {delivery?.lastError && (
        <div className="flex items-start gap-3 rounded-lg border border-exception/30 bg-exception/5 px-3.5 py-3" role="alert">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-exception/10 text-exception">
            <MailX size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-exception">Why it failed</p>
            <p className="mt-0.5 wrap-break-word text-sm text-foreground">{delivery.lastError}</p>
          </div>
        </div>
      )}

      {delivery?.htmlBody ? (
        <section className="flex min-h-0 flex-1 flex-col">
          <SectionTitle>What was sent</SectionTitle>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={delivery.htmlBody}
            // Floors at 24rem so a long fact list shrinks the drawer's scroll
            // rather than squeezing the message down to a letterbox.
            className="min-h-96 w-full flex-1 rounded-lg border border-rule/60 bg-white"
          />
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-4 text-center text-sm text-muted-foreground">
          The body of this message is no longer held — it was redacted, or it has aged out of the delivery log.
        </p>
      )}
    </div>
  );
}

// ── Points, consent, privacy — no fetch needed ────────────────────────────

function PointsDetailBody({ entry }: { entry: TimelineEntry }) {
  const delta = entry.delta ?? 0;
  const added = delta > 0;

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-3">
        <Fact
          surface="card"
          icon={added ? TrendingUp : TrendingDown}
          tone={added ? 'default' : 'danger'}
          label="Change"
          value={`${added ? '+' : '−'}${Math.abs(delta).toLocaleString()} pts`}
        />
        <Fact surface="card" icon={Coins} label="Balance after" value={entry.balanceAfter?.toLocaleString() ?? '—'} />
      </dl>

      <section>
        <SectionTitle>Reason</SectionTitle>
        {entry.reason ? (
          <p className="rounded-lg border border-rule/60 bg-field px-3.5 py-3 text-sm text-foreground">{entry.reason}</p>
        ) : (
          <p className="rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground">
            No reason was recorded against this adjustment. Recording one makes the ledger answerable later.
          </p>
        )}
      </section>
    </div>
  );
}

function ConsentDetailBody({ entry }: { entry: TimelineEntry }) {
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>The change</SectionTitle>
        <Panel>
          <Row icon={ShieldCheck} label="Now">
            <span className="font-semibold">
              {entry.action === 'opted_in'
                ? 'Opted in to marketing'
                : entry.action === 'opted_out'
                  ? 'Opted out of marketing'
                  : 'Address suppressed'}
            </span>
          </Row>
          <Row icon={User} label="Recorded by">
            <span className="capitalize">{(entry.source ?? '—').replaceAll('_', ' ')}</span>
          </Row>
          {entry.reason && (
            <Row icon={FileText} label="Wording">
              <span className="wrap-break-word">{entry.reason}</span>
            </Row>
          )}
        </Panel>
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Consent history is kept permanently and cannot be edited — that is what makes it evidence. Record a correction as a new change on
        the Compliance tab.
      </p>
    </div>
  );
}

function PrivacyDetailBody({ entry }: { entry: TimelineEntry }) {
  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>The request</SectionTitle>
        <Panel>
          <Row icon={Activity} label="Status">
            <Badge variant={entry.status === 'completed' ? 'success' : entry.status === 'declined' ? 'muted' : 'warning'}>
              <span className="capitalize">{(entry.status ?? '').replaceAll('_', ' ')}</span>
            </Badge>
          </Row>
          <Row icon={CalendarDays} label="Received">
            {formatDateTime(entry.at)}
          </Row>
          {entry.dueAt && (
            <Row icon={Clock} label="Due">
              {formatDateTime(entry.dueAt)}
            </Row>
          )}
        </Panel>
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        The full request — its wording, the checks performed and the outcome — lives on the Compliance tab of this record.
      </p>
    </div>
  );
}

// ── Pieces — the newer drawers' ───────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 flex min-h-7 items-center text-sm font-semibold text-foreground">{children}</h3>;
}

/** One white card of rows, as Media's file drawer groups its details. */
function Panel({ children }: { children: React.ReactNode }) {
  return <dl className="overflow-hidden rounded-lg border border-rule/60 bg-control">{children}</dl>;
}

/** Tile and name on the left, the value on the right — wrapping, since a subject or an address can be long. */
function Row({ icon, label, children }: { icon: IconComponent; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 border-b border-rule/45 px-4 py-2.5 last:border-b-0">
      <RowTile icon={icon} />
      <dt className="w-24 shrink-0 text-sm font-semibold text-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5 text-right text-sm text-muted-foreground">
        {children}
      </dd>
    </div>
  );
}
