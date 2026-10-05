'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PILL_TONE, TIMELINE_KIND_META } from '@/components/customers/timelineKinds';
import {
  AlertTriangle,
  Coins,
  ExternalLink,
  Gift,
  type IconComponent,
  Loader2,
  MailX,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
} from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getEmailDeliveries } from '@/lib/modules/communications/client';
import { type OrderStatus, getOrder } from '@/lib/modules/ordering/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { timelineRowText } from '@/lib/utils/customer-timeline';
import { formatDateTime } from '@/lib/utils/date';
import type { OrderLoyaltyMovement, TimelineEntry } from '@/types/customers';

/**
 * The detail behind one timeline row.
 *
 * The feed answers "what happened"; this answers "what exactly". Until now a
 * timeline row was a dead end unless it was an order — and even then it threw
 * you out to the Orders page, losing the guest you were reading about. The
 * drawer keeps the record underneath: you look at the email that bounced, close
 * it, and carry on down the list.
 *
 * Only orders and emails need a request. Points, consent and privacy entries
 * already carry everything they can say, so those open instantly rather than
 * showing a spinner to render four fields the caller already had.
 *
 * Laid out as the audit inspector is: the row's own tile and sentence as the
 * header, then titled sections of label/value rows on the porcelain field.
 */

/** Mirrors the Orders screen's own status vocabulary, in badge terms. */
const ORDER_STATUS_VARIANT: Record<OrderStatus, 'success' | 'warning' | 'destructive' | 'primary' | 'muted'> = {
  pending: 'muted',
  preparing: 'warning',
  ready: 'primary',
  done: 'success',
  cancelled: 'destructive',
  expired: 'warning',
};

type Money = (amount: string | number | null | undefined) => string;

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
        entry.kind === 'order' ? (
          <Button size="lg" variant="outline" onClick={() => router.push(`/orders?order=${entry.id}`)} className="w-full">
            <ExternalLink data-icon="inline-start" />
            Open in Orders
          </Button>
        ) : entry.kind === 'email' && entry.status === 'failed' && onRetryEmail ? (
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
      {entry.kind === 'order' ? (
        <OrderDetailBody orderId={entry.id} loyalty={entry.loyalty ?? []} points={entry.points ?? null} money={money} />
      ) : entry.kind === 'email' ? (
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

// ── Order ─────────────────────────────────────────────────────────────────

const CHANNEL: Record<string, string> = { pos: 'At the till', qr_code: 'QR code' };

function OrderDetailBody({
  orderId,
  loyalty,
  points,
  money,
}: {
  orderId: string;
  loyalty: OrderLoyaltyMovement[];
  points: TimelineEntry['points'];
  money: Money;
}) {
  const {
    data: order,
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: moduleQueryKeys.ordering.key('order', orderId), queryFn: () => getOrder(orderId) });

  if (isPending) return <Loading />;
  if (isError || !order) return <ErrorState title="This order couldn’t be loaded" onRetry={() => void refetch()} />;

  const discount = Number(order.discountAmount ?? 0);
  const refunded = (order.refunds ?? []).reduce((sum, refund) => sum + Number(refund.amount), 0);

  return (
    <div className="space-y-6">
      <section>
        <SectionTitle>The order</SectionTitle>
        <Panel>
          <Row label="Status">
            <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
              <span className="capitalize">{order.status}</span>
            </Badge>
            {order.refundStatus && order.refundStatus !== 'none' && (
              <Badge variant="destructive">{order.refundStatus === 'refunded' ? 'Refunded' : 'Part refunded'}</Badge>
            )}
          </Row>
          <Row label="Total">
            <span className="font-semibold tabular-nums">{money(order.totalAmount)}</span>
          </Row>
          {discount > 0 && (
            <Row label="Discount">
              <span className="tabular-nums">−{money(discount)}</span>
            </Row>
          )}
          {refunded > 0 && (
            <Row label="Refunded">
              <span className="tabular-nums text-exception">−{money(refunded)}</span>
            </Row>
          )}
          <Row label="Payment">{order.paymentMethod === 'cash' ? 'Cash' : 'Card'}</Row>
          <Row label="Taken">{CHANNEL[order.source] ?? 'Mobile'}</Row>
          <Row label="Reference">
            <span className="font-mono text-xs uppercase">#{order.id.slice(0, 8)}</span>
          </Row>
        </Panel>
      </section>

      <section>
        <SectionTitle>
          {order.items.length} {order.items.length === 1 ? 'item' : 'items'}
        </SectionTitle>
        <ul className="overflow-hidden rounded-lg border border-rule/60 bg-field">
          {order.items.map((item) => (
            <li key={item.id} className="border-b border-rule/45 px-3.5 py-3 last:border-b-0">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm text-foreground">
                  <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
                </p>
                <span data-figure className="shrink-0 text-sm tabular-nums text-foreground">
                  {money(item.subtotal)}
                </span>
              </div>
              {(item.modifiers?.length ?? 0) > 0 && (
                <p className="mt-0.5 text-xs text-muted-foreground">{item.modifiers!.map((modifier) => modifier.name).join(', ')}</p>
              )}
              {item.notes && <p className="mt-0.5 text-xs italic text-muted-foreground">{item.notes}</p>}
              {(item.allergens?.length ?? 0) > 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-exception">
                  <AlertTriangle size={12} aria-hidden="true" />
                  {item.allergens!.join(', ')}
                </p>
              )}
              {item.allergenCoverage === 'missing_recipe' && (
                <p className="mt-1 flex items-start gap-1.5 text-xs font-semibold text-warning" role="alert">
                  <AlertTriangle size={12} className="mt-px shrink-0" aria-hidden="true" />
                  Allergen check incomplete — no recipe was recorded for this sold item.
                </p>
              )}
              {item.refundStatus && item.refundStatus !== 'none' && (
                <p className="mt-1 text-xs text-exception">{item.refundStatus === 'refunded' ? 'Refunded' : 'Partly refunded'}</p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {(loyalty.length > 0 || points) && (
        <section>
          <SectionTitle>Rewards and points</SectionTitle>
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-field">
            {points && (
              <IconRow
                icon={Coins}
                tile="bg-stock/10 text-stock"
                title={`Points ${points.delta >= 0 ? 'earned' : 'reversed'}`}
                detail={`Balance after this order: ${points.balanceAfter.toLocaleString()}`}
                figure={`${points.delta >= 0 ? '+' : '−'}${Math.abs(points.delta).toLocaleString()} pts`}
                tone={points.delta >= 0 ? 'good' : 'bad'}
              />
            )}
            {loyalty.map((movement, index) => {
              const amount = Math.abs(movement.delta);
              return (
                <IconRow
                  key={`${movement.programId}-${movement.source}-${index}`}
                  icon={Gift}
                  tile="bg-stock/10 text-stock"
                  title={movement.programName}
                  detail={
                    movement.source === 'order_earn'
                      ? 'Earned with this order'
                      : movement.source === 'redemption'
                        ? 'Used on this order'
                        : 'Adjusted when this order changed'
                  }
                  figure={`${movement.delta > 0 ? '+' : '−'}${amount} ${amount === 1 ? movement.unitSingular : movement.unitPlural}`}
                  tone={movement.delta > 0 ? 'good' : 'bad'}
                />
              );
            })}
          </ul>
        </section>
      )}

      {(order.refunds?.length ?? 0) > 0 && (
        <section>
          <SectionTitle>Refunds</SectionTitle>
          <ul className="overflow-hidden rounded-lg border border-exception/30 bg-exception/5">
            {order.refunds!.map((refund) => (
              <li key={refund.id} className="border-b border-exception/20 px-3.5 py-3 last:border-b-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold capitalize text-exception">{refund.reason.replaceAll('_', ' ')}</span>
                  <span data-figure className="text-sm tabular-nums text-exception">
                    −{money(refund.amount)}
                  </span>
                </div>
                {refund.notes && <p className="mt-0.5 text-xs text-muted-foreground">{refund.notes}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(refund.createdAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {order.notes && (
        <section>
          <SectionTitle>Order notes</SectionTitle>
          <p className="rounded-lg border border-rule/60 bg-field px-3.5 py-3 text-sm text-foreground">{order.notes}</p>
        </section>
      )}
    </div>
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

  if (isPending) return <Loading />;
  if (isError) return <ErrorState title="This message couldn’t be loaded" onRetry={() => void refetch()} />;

  return (
    // A column with a definite height so the preview below can claim whatever
    // the facts above it do not use — reading the message is the point of
    // opening this row, and a fixed 384px window made you scroll a scroll.
    <div className="flex h-full min-h-0 flex-col gap-6">
      <section>
        <SectionTitle>The message</SectionTitle>
        <Panel>
          <Row label="Subject">
            <span className="font-semibold wrap-break-word">{entry.subject ?? delivery?.subject ?? '—'}</span>
          </Row>
          <Row label="To">
            <span className="break-all">{entry.toEmail ?? delivery?.toEmail ?? '—'}</span>
          </Row>
          <Row label="Status">
            <span className="capitalize">{entry.status}</span>
            {delivery && delivery.attemptCount > 1 && (
              <span className="text-xs text-muted-foreground">
                · {delivery.attemptCount} of {delivery.maxAttempts} attempts
              </span>
            )}
          </Row>
          {entry.trigger && (
            <Row label="Sent because">
              <span className="capitalize">{entry.trigger.replaceAll('_', ' ')}</span>
            </Row>
          )}
          {delivery?.template?.name && <Row label="Template">{delivery.template.name}</Row>}
          {delivery?.sentAt && <Row label="Sent at">{formatDateTime(delivery.sentAt)}</Row>}
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
          <Row label="Now">
            <span className="font-semibold">
              {entry.action === 'opted_in'
                ? 'Opted in to marketing'
                : entry.action === 'opted_out'
                  ? 'Opted out of marketing'
                  : 'Address suppressed'}
            </span>
          </Row>
          <Row label="Recorded by">
            <span className="capitalize">{(entry.source ?? '—').replaceAll('_', ' ')}</span>
          </Row>
          {entry.reason && (
            <Row label="Wording">
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
          <Row label="Status">
            <Badge variant={entry.status === 'completed' ? 'success' : entry.status === 'declined' ? 'muted' : 'warning'}>
              <span className="capitalize">{(entry.status ?? '').replaceAll('_', ' ')}</span>
            </Badge>
          </Row>
          <Row label="Received">{formatDateTime(entry.at)}</Row>
          {entry.dueAt && <Row label="Due">{formatDateTime(entry.dueAt)}</Row>}
        </Panel>
      </section>
      <p className="text-xs leading-relaxed text-muted-foreground">
        The full request — its wording, the checks performed and the outcome — lives on the Compliance tab of this record.
      </p>
    </div>
  );
}

// ── Pieces — the audit inspector's ────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h3 className="mb-2 text-sm font-semibold text-foreground">{children}</h3>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <dl className="overflow-hidden rounded-lg border border-rule/60 bg-field">{children}</dl>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0">
      <dt className="w-24 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 flex-1 flex-wrap items-baseline gap-1.5 text-sm text-foreground">{children}</dd>
    </div>
  );
}

function IconRow({
  icon: Icon,
  tile,
  title,
  detail,
  figure,
  tone,
}: {
  icon: IconComponent;
  tile: string;
  title: string;
  detail: string;
  figure: string;
  tone: 'good' | 'bad';
}) {
  return (
    <li className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0">
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', tile)}>
        <Icon size={16} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
      <span className={cn('shrink-0 text-sm font-semibold tabular-nums', tone === 'good' ? 'text-momentum' : 'text-exception')}>
        {figure}
      </span>
    </li>
  );
}

function Loading() {
  return (
    <div className="space-y-3" aria-label="Loading">
      <div className="h-4 w-24 animate-pulse rounded-sm bg-band" />
      <div className="h-40 animate-pulse rounded-lg bg-band/60" />
      <div className="h-24 animate-pulse rounded-lg bg-band/60" />
    </div>
  );
}
