'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { Plug, PlugZap, Settings, Zap } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

import { getEmailConnection } from '@/lib/modules/communications/client';
import { getPaymentMethods } from '@/lib/modules/payments/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { type ConnectorAccount, type ConnectorAction, ConnectorCard } from './ConnectorCard';
import { emailConnectorState } from './EmailConnector';
import { PROVIDER_LABELS, paymentsConnectorState } from './PaymentsConnector';
import { CONNECTORS, type ConnectorDefinition, type ConnectorId, type ConnectorState } from './registry';
import { relativeTime } from './shared';

/**
 * The Connectors tab: every integration on one screen with its live status, the
 * account it is using, and one button. Statuses come from the same endpoints the
 * connectors themselves use, so a card never claims something is working when
 * the last check says otherwise.
 */
export function ConnectorsGrid() {
  const router = useRouter();
  const { tenantId, locationId } = useWorkspaceStore();

  const { data: emailConnection } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });
  const { data: paymentMethods } = useQuery({
    queryKey: moduleQueryKeys.payments.key('payment-methods', locationId),
    queryFn: () => getPaymentMethods(locationId!),
    enabled: !!locationId,
  });

  const open = (id: ConnectorId, mode?: 'connect') => router.push(`/settings/connectors?connector=${id}${mode ? `&mode=${mode}` : ''}`);

  const emailState = emailConnectorState(emailConnection);
  const paymentsState = paymentsConnectorState(paymentMethods);

  const cards = CONNECTORS.map((definition) => {
    if (definition.id === 'email') {
      const checked = relativeTime(emailConnection?.lastTestedAt);
      const accounts: ConnectorAccount[] = emailConnection
        ? [
            {
              label: emailConnection.fromEmail || emailConnection.username,
              meta: emailState === 'paused' ? 'Sending is paused' : checked ? `Checked ${checked}` : 'Not checked yet',
            },
          ]
        : [];
      const action: ConnectorAction = emailConnection
        ? emailState === 'attention'
          ? { label: 'Re-connect', icon: Zap, onClick: () => open('email', 'connect') }
          : { label: 'Manage', icon: Settings, onClick: () => open('email'), variant: 'outline' }
        : { label: 'Connect', icon: Plug, onClick: () => open('email', 'connect') };
      return {
        definition,
        state: emailState,
        accounts,
        action,
        alert:
          emailState === 'attention'
            ? {
                title: 'The last check failed',
                detail: emailConnection?.lastTestError ?? 'Re-enter the mailbox password to restore sending.',
              }
            : undefined,
      };
    }

    if (definition.id === 'card-payments') {
      const [first, ...rest] = paymentMethods ?? [];
      const accounts: ConnectorAccount[] = first ? [{ label: first.displayName, meta: PROVIDER_LABELS[first.provider] }] : [];
      const action: ConnectorAction = first
        ? { label: 'Manage', icon: Settings, onClick: () => open('card-payments'), variant: 'outline' }
        : { label: 'Connect', icon: Plug, onClick: () => open('card-payments', 'connect'), disabled: !locationId };
      return { definition, state: paymentsState, accounts, extraAccountCount: rest.length, action };
    }

    return { definition, state: 'unavailable' as ConnectorState, accounts: [] };
  });

  const connectedCount = cards.filter((card) => card.state === 'connected' || card.state === 'paused').length;
  const attentionCount = cards.filter((card) => card.state === 'attention').length;
  const available = cards.filter((card) => card.definition.available);
  const upcoming = cards.filter((card) => !card.definition.available);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-rule/65 bg-band/45 px-4 py-3 text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <PlugZap size={16} className="text-success" aria-hidden="true" />
          {connectedCount} connected
        </div>
        {attentionCount > 0 && <Badge variant="destructive">{attentionCount} needs attention</Badge>}
        <span className="text-muted-foreground">
          Connections apply to the current workspace and, for card readers, the active location.
        </span>
      </div>

      <div>
        <h3 className="mb-3 text-base font-semibold text-foreground">Available now</h3>
        <div className="space-y-3">
          {available.map((card) => (
            <ConnectorCard key={card.definition.id} {...card} />
          ))}
        </div>
      </div>

      <ComingSoonTile cards={upcoming} />
    </div>
  );
}

function ComingSoonTile({ cards }: { cards: { definition: ConnectorDefinition }[] }) {
  return (
    <section>
      <h3 className="mb-3 text-base font-semibold text-foreground">Planned connectors</h3>
      <div className="grid overflow-hidden rounded-lg border border-rule/65 bg-card sm:grid-cols-2">
        {cards.map(({ definition }, index) => {
          const Icon = definition.icon;
          return (
            <div
              key={definition.id}
              className={`flex items-center gap-3 px-4 py-3 ${index > 0 ? 'border-t border-rule/45 sm:border-t-0' : ''} ${index > 1 ? 'sm:border-t' : ''} ${index % 2 === 1 ? 'sm:border-l sm:border-rule/45' : ''}`}
            >
              <Icon size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{definition.name}</p>
                <p className="truncate text-xs text-muted-foreground">{definition.tags.slice(0, 2).join(' · ')}</p>
              </div>
              <Badge variant="muted" className="ml-auto shrink-0">
                Planned
              </Badge>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">These will appear here automatically when they are released.</p>
    </section>
  );
}
