'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { FileText, MailX, Send, Zap } from '@/components/icons';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';

import { type EmailDelivery, getEmailAutomations, getEmailDeliveries, getEmailTemplates } from '@/lib/api/email.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * The front door.
 *
 * Communications used to open onto a list of templates, which answers a question
 * nobody arrives with. People arrive asking "is this working", and that answer
 * was spread across three tabs holding a third of it each.
 *
 * Four figures, nothing else. Whether email can leave the building is stated
 * once in the masthead, because it is true of the whole feature rather than of
 * any tab; the live automations are the Automations tab, not a second copy of
 * it here. Each tile is a fact about the last seven days or about right now —
 * never a projection — and the three that can be acted on open the tab that
 * acts on them.
 */
export function OverviewPanel({
  onOpenAutomations,
  onOpenTemplates,
  onOpenFailures,
}: {
  onOpenAutomations: () => void;
  onOpenTemplates: () => void;
  /** Opens the History tab, where the failures are. */
  onOpenFailures: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);

  const { data: automations = [] } = useQuery({
    queryKey: ['email-automations', tenantId],
    queryFn: () => getEmailAutomations(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: deliveries } = useQuery({
    queryKey: ['email-deliveries', tenantId, 1],
    queryFn: () => getEmailDeliveries(tenantId ?? undefined, 1),
    enabled: !!tenantId,
    refetchInterval: 60_000,
  });

  // Pinned on mount: the seven-day window must not slide underneath a render.
  const [now] = useState(() => Date.now());
  const week = useMemo(() => summariseWeek(deliveries?.data ?? [], now), [deliveries?.data, now]);

  const live = automations.filter((automation) => automation.isEnabled);
  const drafts = automations.length - live.length;
  const activeTemplates = templates.filter((template) => template.isActive);

  return (
    <StatCardGrid columns={4}>
      <StatCard
        label="Sent"
        qualifier="7 days"
        value={week.sent.toLocaleString()}
        icon={Send}
        accent="success"
        size="sm"
        caption={week.total === 0 ? 'Nothing sent yet' : `of ${week.total.toLocaleString()} queued`}
      />
      <StatCard
        label="Failed"
        qualifier="7 days"
        value={week.failed.toLocaleString()}
        icon={MailX}
        accent={week.failed > 0 ? 'danger' : 'neutral'}
        size="sm"
        caption={week.failed > 0 ? 'Needs a retry' : 'Nothing failing'}
        onSelect={week.failed > 0 ? onOpenFailures : undefined}
      />
      <StatCard
        label="Automations live"
        value={live.length.toLocaleString()}
        icon={Zap}
        accent="info"
        size="sm"
        caption={drafts > 0 ? `${drafts} draft${drafts === 1 ? '' : 's'} not published` : 'No unpublished drafts'}
        onSelect={onOpenAutomations}
      />
      <StatCard
        label="Templates ready"
        value={activeTemplates.length.toLocaleString()}
        icon={FileText}
        accent="warning"
        size="sm"
        caption={templates.length > activeTemplates.length ? `${templates.length - activeTemplates.length} archived` : 'All in use'}
        onSelect={onOpenTemplates}
      />
    </StatCardGrid>
  );
}

/** Sent / failed / queued across the newest page of deliveries, last 7 days. */
function summariseWeek(deliveries: EmailDelivery[], now: number) {
  const cutoff = now - 7 * 24 * 60 * 60 * 1_000;
  const recent = deliveries.filter((delivery) => Date.parse(delivery.createdAt) >= cutoff);
  return {
    total: recent.length,
    sent: recent.filter((delivery) => delivery.status === 'sent').length,
    failed: recent.filter((delivery) => delivery.status === 'failed').length,
  };
}
