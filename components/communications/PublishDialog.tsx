'use client';

import { useQuery } from '@tanstack/react-query';

import { CheckCircle2, Clock, Loader2, Send, Tags, TriangleAlert, Zap } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import type { EmailWorkflowDefinition } from '@/lib/modules/communications/client';
import { getSegment } from '@/lib/modules/customers/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';

import { TRIGGER_HELP, TRIGGER_LABELS } from './shared';
import { orderedWorkflowNodes } from './workflowModel';

/**
 * What publishing will actually do, before it does it.
 *
 * Publishing used to be a button with no answer to the only question worth
 * asking — who is about to receive this. That silence is why people stop
 * touching a working automation: the risk is unbounded because it is unstated.
 *
 * Everything here is a real figure or an explicit rule. Where the volume genuinely
 * cannot be known — nobody can say how many orders will be placed next week — it
 * says the rule instead of inventing a projection.
 */
export function PublishDialog({
  name,
  definition,
  isRepublish,
  publishedVersion,
  emailReady,
  isPending,
  templateName,
  onConfirm,
  onClose,
}: {
  name: string;
  definition: EmailWorkflowDefinition;
  /** True when a live version already exists — the copy changes materially. */
  isRepublish: boolean;
  publishedVersion?: number;
  emailReady: boolean;
  isPending: boolean;
  templateName: (id: string) => string;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const trigger = definition.nodes.find((node) => node.type === 'trigger');
  const segmentId = trigger?.type === 'trigger' ? (trigger.config.segmentId ?? null) : null;

  // Only a segment trigger has a knowable audience up front. Everything else is
  // driven by events that have not happened yet.
  const { data: segment, isLoading: segmentLoading } = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-segment', segmentId),
    queryFn: () => getSegment(segmentId!),
    enabled: Boolean(segmentId),
  });

  const emails = orderedWorkflowNodes(definition).filter((node) => node.type === 'send_email');
  const waits = definition.nodes.filter((node) => node.type === 'delay');
  const event = trigger?.type === 'trigger' ? trigger.config.event : undefined;

  return (
    <Modal
      title={isRepublish ? 'Publish new version?' : 'Publish this automation?'}
      description={name}
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isPending} className="flex-1">
            {isPending ? 'Publishing…' : isRepublish ? `Publish v${(publishedVersion ?? 0) + 1}` : 'Publish and go live'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* ── When it fires ────────────────────────────────────────────── */}
        <Row icon={Zap} label="Fires when">
          <p className="text-sm font-semibold text-foreground">{event ? TRIGGER_LABELS[event] : 'No trigger'}</p>
          {event && <p className="mt-0.5 text-xs text-muted-foreground">{TRIGGER_HELP[event]}</p>}
        </Row>

        {/* ── Who gets it ──────────────────────────────────────────────── */}
        {segmentId ? (
          <Row icon={Tags} label="Audience">
            {segmentLoading ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                Counting the segment…
              </p>
            ) : segment ? (
              <>
                <p className="text-sm font-semibold text-foreground">{segment.segment.name}</p>
                <p className="mt-1 text-sm text-foreground">
                  <strong className="tabular-nums">{segment.total.toLocaleString()}</strong> customers match right now,{' '}
                  <strong className="tabular-nums">{segment.emailReachable.toLocaleString()}</strong> of them reachable by email.
                </p>
                {/* The single most important sentence in this dialog. */}
                <p className="mt-2 rounded-sm border border-momentum/30 bg-momentum/6 px-3 py-2 text-xs text-momentum">
                  <strong className="font-semibold">None of them will be emailed.</strong> Publishing records everyone already inside the
                  segment as seen, so only customers who start matching after now are sent to.
                </p>
              </>
            ) : (
              <p className="text-sm text-exception">That segment could not be loaded. Check it still exists before publishing.</p>
            )}
          </Row>
        ) : (
          <Row icon={Tags} label="Audience">
            <p className="text-sm text-foreground">
              Whoever the event happens to, provided they hold marketing consent and have an email address.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Volume depends on trading, so there is no honest number to show before it runs. The first sends will appear in this
              automation&rsquo;s run history.
            </p>
          </Row>
        )}

        {/* ── What they get ────────────────────────────────────────────── */}
        <Row icon={Send} label={`Sends ${emails.length} email${emails.length === 1 ? '' : 's'}`}>
          {emails.length === 0 ? (
            <p className="text-sm text-exception">This workflow sends nothing.</p>
          ) : (
            <ol className="space-y-1">
              {emails.map((node, index) => (
                <li key={node.id} className="flex items-baseline gap-2 text-sm text-foreground">
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{index + 1}.</span>
                  <span className="min-w-0 truncate">{node.type === 'send_email' ? templateName(node.config.templateId) : ''}</span>
                </li>
              ))}
            </ol>
          )}
          {waits.length > 0 && (
            <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock size={12} aria-hidden="true" />
              {waits.length} wait{waits.length === 1 ? '' : 's'} between steps
            </p>
          )}
        </Row>

        {/* ── What could still be wrong ────────────────────────────────── */}
        {!emailReady && (
          <p className="flex items-start gap-2 rounded-sm border border-warning/30 bg-warning/6 px-3 py-2.5 text-sm text-warning">
            <TriangleAlert size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Email sending is not verified, so this will queue messages that cannot leave the building. Publishing is still safe — nothing
              is lost — but nothing arrives until the connection is set up.
            </span>
          </p>
        )}

        {isRepublish && (
          <p className="flex items-start gap-2 rounded-sm border border-rule bg-band/55 px-3 py-2.5 text-xs text-muted-foreground">
            <CheckCircle2 size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>Runs already in flight finish on the version they started with. Only new runs use v{(publishedVersion ?? 0) + 1}.</span>
          </p>
        )}
      </div>
    </Modal>
  );
}

function Row({
  icon: Icon,
  label,
  children,
  className,
}: {
  icon: typeof Zap;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn('rounded-sm border border-rule bg-background p-3', className)}>
      <p className="flex items-center gap-1.5 text-micro font-semibold uppercase tracking-micro text-muted-foreground">
        <Icon size={12} aria-hidden="true" />
        {label}
      </p>
      <div className="mt-1.5">{children}</div>
    </section>
  );
}
