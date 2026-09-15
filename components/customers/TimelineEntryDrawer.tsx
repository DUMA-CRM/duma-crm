'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { AlertTriangle, ExternalLink, Loader2, MailX, RefreshCw, ShieldCheck } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getEmailDeliveries } from '@/lib/api/email.service';
import { type OrderStatus, getOrder } from '@/lib/api/orders.service';
import { formatDateTime } from '@/lib/utils/date';
import { fmtGbpExact } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
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
 * Only orders and emails need a request. Points, consent and privacy entries
 * already carry everything they can say, so those open instantly rather than
 * showing a spinner to render four fields the caller already had.
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

const KIND_TITLE: Record<TimelineEntry['kind'], string> = {
  order: 'Order',
  points: 'Points adjustment',
  email: 'Email',
  consent: 'Marketing consent',
  privacy: 'Privacy request',
};

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

  return (
    <Drawer
      title={KIND_TITLE[entry.kind]}
      description={formatDateTime(entry.at)}
      onClose={onClose}
      footer={
        entry.kind === 'order' ? (
          <Button size="lg" variant="outline" onClick={() => router.push(`/orders?order=${entry.id}`)} className="w-full">
            <ExternalLink data-icon="inline-start" />
            Open in Orders
          </Button>
        ) : entry.kind === 'email' && entry.status === 'failed' && onRetryEmail ? (
          <Button size="lg" onClick={() => onRetryEmail(entry.id)} disabled={retryPending} className="w-full">
            <RefreshCw data-icon="inline-start" />
            {retryPending ? 'Queueing…' : 'Try sending again'}
          </Button>
        ) : undefined
      }
    >
      {entry.kind === 'order' ? (
        <OrderDetailBody orderId={entry.id} />
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

function OrderDetailBody({ orderId }: { orderId: string }) {
  const { data: order, isLoading, isError, refetch } = useQuery({ queryKey: ['order', orderId], queryFn: () => getOrder(orderId) });

  if (isLoading) return <Loading label="Loading the order" />;
  if (isError || !order) return <LoadError what="order" onRetry={() => void refetch()} />;

  const discount = Number(order.discountAmount ?? 0);
  const refunded = (order.refunds ?? []).reduce((sum, refund) => sum + Number(refund.amount), 0);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={ORDER_STATUS_VARIANT[order.status]}>
          <span className="capitalize">{order.status}</span>
        </Badge>
        {order.refundStatus && order.refundStatus !== 'none' && (
          <Badge variant="destructive">{order.refundStatus === 'refunded' ? 'Refunded' : 'Part refunded'}</Badge>
        )}
        <span className="font-mono text-xs uppercase tracking-micro text-muted-foreground">#{order.id.slice(0, 8)}</span>
      </div>

      <Facts
        rows={[
          { label: 'Total', value: fmtGbpExact(Number(order.totalAmount)), figure: true },
          { label: 'Payment', value: order.paymentMethod === 'cash' ? 'Cash' : 'Card' },
          { label: 'Taken', value: order.source === 'pos' ? 'At the till' : order.source === 'qr_code' ? 'QR code' : 'Mobile' },
          ...(discount > 0 ? [{ label: 'Discount', value: `−${fmtGbpExact(discount)}`, figure: true }] : []),
          ...(refunded > 0 ? [{ label: 'Refunded', value: `−${fmtGbpExact(refunded)}`, figure: true, tone: 'exception' as const }] : []),
        ]}
      />

      <Block title={`Items (${order.items.length})`}>
        <ul className="divide-y divide-rule/50 overflow-hidden rounded-sm border border-rule">
          {order.items.map((item) => (
            <li key={item.id} className="bg-background px-3 py-2.5">
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 text-sm text-foreground">
                  <span className="font-semibold tabular-nums">{item.quantity}×</span> {item.name}
                </p>
                <span data-figure className="shrink-0 text-sm tabular-nums text-foreground">
                  {fmtGbpExact(Number(item.subtotal))}
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
                <p className="mt-1 text-xs text-exception">
                  {item.refundStatus === 'refunded' ? 'Refunded' : 'Partly refunded'}
                </p>
              )}
            </li>
          ))}
        </ul>
      </Block>

      {(order.refunds?.length ?? 0) > 0 && (
        <Block title="Refunds">
          <ul className="space-y-2">
            {order.refunds!.map((refund) => (
              <li key={refund.id} className="rounded-sm border border-exception/30 bg-exception/6 px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold capitalize text-exception">{refund.reason.replaceAll('_', ' ')}</span>
                  <span data-figure className="text-sm tabular-nums text-exception">
                    −{fmtGbpExact(Number(refund.amount))}
                  </span>
                </div>
                {refund.notes && <p className="mt-0.5 text-xs text-muted-foreground">{refund.notes}</p>}
                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(refund.createdAt)}</p>
              </li>
            ))}
          </ul>
        </Block>
      )}

      {order.notes && (
        <Block title="Order notes">
          <p className="rounded-sm border border-rule bg-background px-3 py-2.5 text-sm text-foreground">{order.notes}</p>
        </Block>
      )}
    </div>
  );
}

// ── Email ─────────────────────────────────────────────────────────────────

function EmailDetailBody({ entry, customerId, tenantId }: { entry: TimelineEntry; customerId: string; tenantId?: string }) {
  // There is no single-delivery endpoint, so the customer's deliveries are read
  // and matched by id. Cheap, and already cached by the communications screens.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['email-deliveries', tenantId, 1, customerId],
    queryFn: () => getEmailDeliveries(tenantId, 1, { customerId, limit: 100 }),
  });

  const delivery = data?.data.find((item) => item.id === entry.id);

  if (isLoading) return <Loading label="Loading the message" />;
  if (isError) return <LoadError what="message" onRetry={() => void refetch()} />;

  return (
    // A column with a definite height so the preview below can claim whatever
    // the facts above it do not use — reading the message is the point of
    // opening this row, and a fixed 384px window made you scroll a scroll.
    <div className="flex h-full min-h-0 flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            entry.status === 'sent' ? 'success' : entry.status === 'failed' ? 'destructive' : entry.status === 'cancelled' ? 'muted' : 'warning'
          }
        >
          {entry.status === 'failed' && <MailX aria-hidden="true" />}
          <span className="capitalize">{entry.status}</span>
        </Badge>
        {delivery && delivery.attemptCount > 1 && (
          <span className="text-xs text-muted-foreground">
            {delivery.attemptCount} of {delivery.maxAttempts} attempts
          </span>
        )}
      </div>

      <Facts
        rows={[
          { label: 'Subject', value: entry.subject ?? delivery?.subject ?? '—' },
          { label: 'To', value: entry.toEmail ?? delivery?.toEmail ?? '—' },
          ...(entry.trigger ? [{ label: 'Sent because', value: entry.trigger.replaceAll('_', ' ') }] : []),
          ...(delivery?.template?.name ? [{ label: 'Template', value: delivery.template.name }] : []),
          ...(delivery?.sentAt ? [{ label: 'Sent at', value: formatDateTime(delivery.sentAt) }] : []),
        ]}
      />

      {/* The failure reason is the whole reason this row was worth opening. */}
      {delivery?.lastError && (
        <div className="rounded-sm border border-exception/30 bg-exception/8 px-3 py-2.5">
          <p className="text-micro font-semibold uppercase tracking-micro text-exception">Why it failed</p>
          <p className="mt-1 break-words text-sm text-exception">{delivery.lastError}</p>
        </div>
      )}

      {delivery?.htmlBody ? (
        <Block title="What was sent" fill>
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={delivery.htmlBody}
            // Floors at 24rem so a long fact list shrinks the drawer's scroll
            // rather than squeezing the message down to a letterbox.
            className="min-h-96 w-full flex-1 rounded-sm border border-rule bg-white"
          />
        </Block>
      ) : (
        <p className="rounded-sm border border-dashed border-rule px-3 py-4 text-center text-sm text-muted-foreground">
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
    <div className="space-y-5">
      <div className="grid grid-cols-2 overflow-hidden rounded-sm border border-rule">
        <div className={cn('p-4', added ? 'bg-momentum/8' : 'bg-exception/8')}>
          <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Change</p>
          <p data-figure className={cn('mt-1 text-2xl font-semibold tabular-nums', added ? 'text-momentum' : 'text-exception')}>
            {added ? '+' : ''}
            {delta.toLocaleString()}
          </p>
        </div>
        <div className="border-l border-rule bg-band/40 p-4">
          <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Balance after</p>
          <p data-figure className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
            {entry.balanceAfter?.toLocaleString() ?? '—'}
          </p>
        </div>
      </div>

      <Block title="Reason">
        {entry.reason ? (
          <p className="rounded-sm border border-rule bg-background px-3 py-2.5 text-sm text-foreground">{entry.reason}</p>
        ) : (
          <p className="rounded-sm border border-dashed border-rule px-3 py-2.5 text-sm text-muted-foreground">
            No reason was recorded against this adjustment. Recording one makes the ledger answerable later.
          </p>
        )}
      </Block>

      <Facts rows={[{ label: 'When', value: formatDateTime(entry.at) }]} />
    </div>
  );
}

function ConsentDetailBody({ entry }: { entry: TimelineEntry }) {
  const headline =
    entry.action === 'opted_in'
      ? 'Opted in to marketing'
      : entry.action === 'opted_out'
        ? 'Opted out of marketing'
        : 'Address suppressed';

  return (
    <div className="space-y-5">
      <div
        className={cn(
          'flex items-start gap-2.5 rounded-sm border px-3 py-2.5',
          entry.action === 'opted_in' ? 'border-momentum/30 bg-momentum/6 text-momentum' : 'border-rule bg-band/55 text-foreground',
        )}
      >
        <ShieldCheck size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
        <p className="text-sm font-semibold">{headline}</p>
      </div>

      <Facts
        rows={[
          { label: 'How it was recorded', value: (entry.source ?? '—').replaceAll('_', ' ') },
          { label: 'When', value: formatDateTime(entry.at) },
        ]}
      />

      {entry.reason && (
        <Block title="Reason or customer wording">
          <p className="rounded-sm border border-rule bg-background px-3 py-2.5 text-sm text-foreground">{entry.reason}</p>
        </Block>
      )}

      <p className="text-xs text-muted-foreground">
        Consent history is kept permanently and cannot be edited — that is what makes it evidence. Record a correction as a new change on
        the Compliance tab.
      </p>
    </div>
  );
}

function PrivacyDetailBody({ entry }: { entry: TimelineEntry }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={entry.status === 'completed' ? 'success' : entry.status === 'declined' ? 'muted' : 'warning'}>
          <span className="capitalize">{(entry.status ?? '').replaceAll('_', ' ')}</span>
        </Badge>
        <span className="text-sm font-semibold capitalize text-foreground">{(entry.type ?? '').replaceAll('_', ' ')} request</span>
      </div>

      <Facts
        rows={[
          { label: 'Received', value: formatDateTime(entry.at) },
          ...(entry.dueAt ? [{ label: 'Due', value: formatDateTime(entry.dueAt) }] : []),
        ]}
      />

      <p className="text-xs text-muted-foreground">
        The full request — its wording, the checks performed and the outcome — lives on the Compliance tab of this record.
      </p>
    </div>
  );
}

// ── Shared bits ───────────────────────────────────────────────────────────

/** `fill` makes the block a flex column that grows into the space left over. */
function Block({ title, fill, children }: { title: string; fill?: boolean; children: React.ReactNode }) {
  return (
    <section className={cn(fill && 'flex min-h-0 flex-1 flex-col')}>
      <h3 className="mb-2 text-micro font-semibold uppercase tracking-micro text-muted-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Facts({ rows }: { rows: { label: string; value: string; figure?: boolean; tone?: 'exception' }[] }) {
  return (
    <dl className="divide-y divide-rule/50 overflow-hidden rounded-sm border border-rule">
      {rows.map((row) => (
        <div key={row.label} className="flex items-baseline justify-between gap-4 bg-background px-3 py-2.5">
          <dt className="shrink-0 text-xs text-muted-foreground">{row.label}</dt>
          <dd
            {...(row.figure ? { 'data-figure': true } : {})}
            className={cn(
              'min-w-0 break-words text-right text-sm font-medium',
              row.tone === 'exception' ? 'text-exception' : 'text-foreground',
              row.figure && 'tabular-nums',
            )}
          >
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 size={18} className="animate-spin" aria-hidden="true" />
      {label}…
    </div>
  );
}

function LoadError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div className="rounded-sm border border-exception/30 bg-card p-6 text-center">
      <p className="text-sm text-muted-foreground">This {what} could not be loaded.</p>
      <Button variant="outline" className="mt-3" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}
