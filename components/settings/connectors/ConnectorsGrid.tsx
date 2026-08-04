'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  AlertCircle,
  Banknote,
  Calculator,
  CircleDashed,
  LayoutGrid,
  Mail,
  Plug,
  PlugZap,
  Printer,
  Settings,
  Zap,
} from '@/components/icons';

import { getEmailConnection } from '@/lib/api/email.service';
import { getPaymentMethods } from '@/lib/api/payments.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { type ConnectorAccount, type ConnectorAction, ConnectorCard } from './ConnectorCard';
import { emailConnectorState } from './EmailConnector';
import { PROVIDER_LABELS, paymentsConnectorState } from './PaymentsConnector';
import { CONNECTORS, type ConnectorFilter, type ConnectorId, type ConnectorState } from './registry';
import { relativeTime } from './shared';

const FILTERS: { value: ConnectorFilter; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'all', label: 'All connectors', icon: LayoutGrid },
  { value: 'connected', label: 'Connected', icon: PlugZap },
  { value: 'attention', label: 'Needs attention', icon: AlertCircle },
  { value: 'disconnected', label: 'Not connected', icon: CircleDashed },
];

/** Which chip a card answers to. Coming-soon connectors only ever show under "All". */
function matchesFilter(state: ConnectorState, filter: ConnectorFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'connected') return state === 'connected' || state === 'paused';
  if (filter === 'attention') return state === 'attention';
  return state === 'disconnected';
}

/**
 * The Connectors tab: every integration on one screen with its live status, the
 * account it is using, and one button. Statuses come from the same endpoints the
 * connectors themselves use, so a card never claims something is working when
 * the last check says otherwise.
 */
export function ConnectorsGrid() {
  const router = useRouter();
  const { tenantId, locationId } = useWorkspaceStore();
  const [filter, setFilter] = useState<ConnectorFilter>('all');

  const { data: emailConnection } = useQuery({
    queryKey: ['email-connection', tenantId],
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });
  const { data: paymentMethods } = useQuery({
    queryKey: ['payment-methods', locationId],
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
  const counts: Record<ConnectorFilter, number> = {
    all: cards.length,
    connected: connectedCount,
    attention: cards.filter((card) => card.state === 'attention').length,
    disconnected: cards.filter((card) => card.state === 'disconnected').length,
  };
  const visible = cards.filter((card) => matchesFilter(card.state, filter));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Connectors</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {connectedCount} of {cards.length} connected — email, card readers and the exports that follow.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filter connectors">
        {FILTERS.map(({ value, label, icon: Icon }) => {
          const active = filter === value;
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(value)}
              className={cn(
                'flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors',
                active
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-surface-offset hover:text-foreground',
              )}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
              <span className="tabular-nums opacity-70">({counts[value]})</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((card) => (
          <ConnectorCard key={card.definition.id} {...card} />
        ))}
        {filter === 'all' && <ComingSoonTile />}
      </div>

      {visible.length === 0 && (
        <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nothing here right now.
        </p>
      )}
    </div>
  );
}

/** Closes the grid off with what is coming, rather than a ragged last row. */
function ComingSoonTile() {
  return (
    <article className="relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40 p-8 text-center">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-primary/10 via-warning/5 to-transparent"
      />
      <div className="relative">
        <div className="flex items-center justify-center gap-2">
          {[Mail, Banknote, Calculator, Printer].map((Icon, index) => (
            <div
              key={index}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-card text-muted-foreground"
            >
              <Icon size={16} aria-hidden="true" />
            </div>
          ))}
        </div>
        <p className="mt-5 text-base font-semibold text-foreground">More connectors are on the way</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Payroll, accounting and printing will appear here as they are released — nothing to do until then.
        </p>
      </div>
    </article>
  );
}
