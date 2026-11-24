'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { BrandTile } from '@/components/shared/rows';
import {
  Calculator,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  KeyRound,
  MapPin,
  Monitor,
  Pause,
  Plug,
  Plus,
  Receipt,
  Store,
  Trash2,
  Wallet,
} from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import {
  type PaymentMethod,
  type PaymentProvider,
  addPaymentConnection,
  deletePaymentConnection,
  getPaymentConnections,
  setPaymentConnectionActive,
} from '@/lib/modules/payments/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { Command, ConnectWizard, ProviderGrid, WizardInstruction, WizardRail, type WizardStep } from './ConnectWizard';
import { ConnectorManagePage, type ConnectorStatus } from './ConnectorManagePage';
import { type ConnectorBrand, PROVIDER_BRANDS, PROVIDER_COLOURS } from './brands';
import { CONNECTORS_BY_ID } from './registry';
import { panelClass } from './shared';

const DEFINITION = CONNECTORS_BY_ID['card-payments'];

/** SumUp isn't in Simple Icons, so its card has its colour with DUMA's own icon. */
const BRANDS: Partial<Record<Provider, ConnectorBrand | { background: string; icon: typeof Wallet }>> = {
  stripe_terminal: PROVIDER_BRANDS.stripe,
  stripe_online: PROVIDER_BRANDS.stripe,
  square: PROVIDER_BRANDS.square,
  sumup: { background: PROVIDER_COLOURS.sumup, icon: Wallet },
};

/** The events the online-checkout webhook must send. */
const STRIPE_EVENTS = [
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.expired',
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
];
/** A provider link inside the field it helps fill, as on Telegram's token. */
const LINK_IN_FIELD =
  'inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/8';

type Provider = Exclude<PaymentProvider, 'cash'>;

// Readers the till can charge first — what most people are here to set up —
// then card machines staff key amounts into, then online checkout.
const PROVIDERS: { value: Provider; label: string; icon: typeof CreditCard; hint: string; integrated: boolean; name: string }[] = [
  {
    value: 'stripe_terminal',
    label: 'Stripe Terminal',
    icon: CreditCard,
    hint: 'Sends the amount to the reader',
    integrated: true,
    name: 'Counter reader',
  },
  {
    value: 'sumup',
    label: 'SumUp',
    icon: Wallet,
    hint: 'Sends the amount to SumUp',
    integrated: true,
    name: 'SumUp reader',
  },
  {
    value: 'square',
    label: 'Square',
    icon: Store,
    hint: 'Sends the amount to Square',
    integrated: true,
    name: 'Square terminal',
  },
  {
    value: 'manual_terminal',
    label: 'Card machine',
    icon: Receipt,
    hint: 'Staff key the amount in',
    integrated: false,
    name: 'Card machine',
  },
  {
    value: 'custom',
    label: 'Another provider',
    icon: Plug,
    hint: 'Records a card payment',
    integrated: false,
    name: 'Card payments',
  },
  {
    value: 'stripe_online',
    label: 'Online checkout (Stripe)',
    icon: CreditCard,
    hint: 'Phone payments for QR orders',
    integrated: true,
    name: 'Online checkout',
  },
];

export const PROVIDER_LABELS: Record<PaymentProvider, string> = {
  stripe_online: 'Stripe online checkout',
  stripe_terminal: 'Stripe Terminal',
  sumup: 'SumUp',
  square: 'Square',
  manual_terminal: 'Manual terminal',
  custom: 'Another provider',
  cash: 'Cash',
};

/** Connected while any reader takes payments; paused when every reader is paused; otherwise not connected. */
export { paymentsConnectorState } from '@/lib/utils/connector-state';

/** Everything the wizard needs to add one reader, including the per-provider fields. */
function useAddPaymentConnection() {
  const { tenantId, locationId } = useWorkspaceStore();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState<Provider | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [secret, setSecret] = useState('');
  const [device, setDevice] = useState('');
  const [merchant, setMerchant] = useState('');
  const [affiliateAppId, setAffiliateAppId] = useState('');
  const [affiliateKey, setAffiliateKey] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  // Adding a reader is a POST, not an upsert — stepping back to the name and
  // pressing the button again must not create a second one.
  const [added, setAdded] = useState(false);

  const chosen = PROVIDERS.find((item) => item.value === provider) ?? null;
  // Picking a provider suggests a name, unless the owner has already typed their own.
  const chooseProvider = (next: Provider) => {
    const previous = PROVIDERS.find((item) => item.value === provider)?.name;
    if (!displayName.trim() || displayName === previous) setDisplayName(PROVIDERS.find((item) => item.value === next)!.name);
    setProvider(next);
  };
  const integrated = chosen?.integrated ?? false;

  const credentialsReady =
    !integrated ||
    (provider === 'stripe_online'
      ? Boolean(secret.trim() && webhookSecret.trim())
      : Boolean(secret.trim() && device.trim()) &&
        (provider !== 'sumup' || Boolean(merchant.trim() && affiliateAppId.trim() && affiliateKey.trim())));

  const add = useMutation({
    mutationFn: () =>
      addPaymentConnection({
        tenantId: tenantId!,
        locationId: provider === 'stripe_online' ? null : locationId,
        provider: provider!,
        displayName: displayName.trim(),
        secret: secret || undefined,
        configuration:
          provider === 'stripe_online'
            ? { webhookSecret }
            : provider === 'stripe_terminal'
              ? { readerId: device }
              : provider === 'sumup'
                ? { readerId: device, merchantCode: merchant, affiliateAppId, affiliateKey }
                : provider === 'square'
                  ? { deviceId: device }
                  : {},
      }),
    onSuccess: () => {
      // The till reads payment-methods (active only); management reads payment-connections. Both change.
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.payments.key('payment-methods') });
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.payments.key('payment-connections') });
      setAdded(true);
      toast('success', `${displayName.trim()} is ready to take payments.`);
    },
  });

  async function tryAdd(): Promise<boolean> {
    if (added) return true;
    if (!tenantId) {
      toast('error', 'Choose a workspace first.');
      return false;
    }
    try {
      await add.mutateAsync();
      return true;
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'The payment method wasn’t added. Review the details and try again.');
      return false;
    }
  }

  return {
    provider,
    setProvider: chooseProvider,
    chosen,
    integrated,
    fields: {
      displayName,
      setDisplayName,
      secret,
      setSecret,
      device,
      setDevice,
      merchant,
      setMerchant,
      affiliateAppId,
      setAffiliateAppId,
      affiliateKey,
      setAffiliateKey,
      webhookSecret,
      setWebhookSecret,
    },
    credentialsReady,
    nameReady: Boolean(displayName.trim()),
    tryAdd,
    locationId,
  };
}

export function PaymentsConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { provider, setProvider, chosen, integrated, fields, credentialsReady, nameReady, tryAdd } = useAddPaymentConnection();
  const { location } = useCurrentWorkspace();
  const {
    displayName,
    setDisplayName,
    secret,
    setSecret,
    device,
    setDevice,
    merchant,
    setMerchant,
    affiliateAppId,
    setAffiliateAppId,
    affiliateKey,
    setAffiliateKey,
    webhookSecret,
    setWebhookSecret,
  } = fields;

  const credentialsStep: WizardStep = {
    key: 'credentials',
    label: 'Connect',
    title: provider === 'stripe_online' ? 'Connect your Stripe account' : `Connect your ${chosen?.label} reader`,
    ready: credentialsReady,
    content: (
      <div className="space-y-6">
        <div className="space-y-3">
          <WizardInstruction icon={KeyRound}>
            {provider === 'sumup'
              ? 'Your merchant code is under Account → Profile. The affiliate app ID and key are in SumUp’s developer portal.'
              : provider === 'square'
                ? 'Find the Device ID under Devices → your Terminal, and the production access token in your app’s credentials.'
                : provider === 'stripe_online'
                  ? 'Copy your secret key, then add a webhook endpoint for /v1/qr-ordering/stripe/webhook and copy its signing secret.'
                  : 'Find the reader ID under Terminal → Readers, and your secret key under Developers → API keys.'}
          </WizardInstruction>
          {provider === 'sumup' && (
            <>
              <Input label="Merchant code" autoFocus value={merchant} onChange={(event) => setMerchant(event.target.value)} />
              <Input
                label="Affiliate app ID"
                value={affiliateAppId}
                onChange={(event) => setAffiliateAppId(event.target.value)}
                className="pr-32"
                rightAction={
                  <a href="https://developer.sumup.com/" target="_blank" rel="noreferrer" className={LINK_IN_FIELD}>
                    Open SumUp <ExternalLink size={12} aria-hidden="true" />
                  </a>
                }
              />
              <Input label="Affiliate key" type="password" value={affiliateKey} onChange={(event) => setAffiliateKey(event.target.value)} />
            </>
          )}
          {provider !== 'stripe_online' && (
            <Input
              label="Reader ID"
              autoFocus={provider !== 'sumup'}
              value={device}
              onChange={(event) => setDevice(event.target.value)}
              placeholder={provider === 'stripe_terminal' ? 'tmr_…' : undefined}
            />
          )}
          <Input
            label={provider === 'square' ? 'Access token' : 'Secret key'}
            autoFocus={provider === 'stripe_online'}
            type="password"
            value={secret}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={provider === 'stripe_terminal' || provider === 'stripe_online' ? 'sk_live_…' : undefined}
            className={provider === 'sumup' ? undefined : 'pr-32'}
            rightAction={
              provider === 'square' ? (
                <a href="https://developer.squareup.com/apps" target="_blank" rel="noreferrer" className={LINK_IN_FIELD}>
                  Open Square <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : provider === 'sumup' ? undefined : (
                <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noreferrer" className={LINK_IN_FIELD}>
                  Open Stripe <ExternalLink size={12} aria-hidden="true" />
                </a>
              )
            }
          />
          {provider === 'stripe_online' && (
            <Input
              label="Webhook signing secret"
              type="password"
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
              placeholder="whsec_…"
            />
          )}
        </div>
        {provider === 'stripe_online' && (
          <div className="flex flex-col gap-1.5">
            <FieldLabel as="span">Webhook events</FieldLabel>
            <p className="flex flex-wrap gap-1.5">
              {STRIPE_EVENTS.map((event) => (
                <Command key={event}>{event}</Command>
              ))}
            </p>
          </div>
        )}
      </div>
    ),
  };

  const steps: WizardStep[] = [
    {
      key: 'provider',
      label: 'Provider',
      title: 'How do you take card payments?',
      ready: provider !== null,
      content: (
        <ProviderGrid
          ariaLabel="Card payment provider"
          options={PROVIDERS.map(({ value, label, icon, hint }) => ({ value, label, icon, hint, brand: BRANDS[value] }))}
          value={provider}
          onChange={setProvider}
        />
      ),
    },
    // A card machine has nothing to connect to, so it goes straight to naming.
    // Until a provider is picked, count the longer path so the step count only ever shrinks.
    ...(provider === null || integrated ? [credentialsStep] : []),
    {
      key: 'name',
      label: 'Name',
      title: 'Name it for the till',
      ready: nameReady,
      continueLabel: 'Add reader',
      onContinue: tryAdd,
      content: (
        <div className="space-y-3">
          <Input
            label="Name"
            autoFocus
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={chosen?.name ?? 'Front counter reader'}
          />
          <dl className={`${panelClass} space-y-2 text-sm`}>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Type</dt>
              <dd className="font-medium text-foreground">{chosen?.label}</dd>
            </div>
            {integrated && provider !== 'stripe_online' && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Reader ID</dt>
                <dd className="truncate font-mono text-xs text-foreground">{device}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Used at</dt>
              <dd className="font-medium text-foreground">
                {provider === 'stripe_online' ? 'Every location' : (location?.name ?? 'This location')}
              </dd>
            </div>
          </dl>
        </div>
      ),
    },
    {
      key: 'done',
      label: 'Done',
      title: 'Ready to take payments',
      description: 'Take a small test payment and refund it to be sure.',
      continueLabel: 'Done',
      content: (
        <div className={`${panelClass} flex items-start gap-3`}>
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">{displayName.trim() || 'Your reader'} was added</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Currency, VAT and receipts are in{' '}
              <Link href="/settings/trading" className="font-medium text-primary hover:underline">
                Trading &amp; tax
              </Link>
              .
            </p>
          </div>
        </div>
      ),
    },
  ];

  return (
    <ConnectWizard
      eyebrow="Connect"
      title="Card payments"
      icon={<CreditCard size={20} aria-hidden="true" />}
      steps={steps}
      // The reader exists from the confirmation screen on — no going back to
      // the form that created it.
      lockedFrom={steps.length - 1}
      onClose={onClose}
      onFinish={onDone}
      rail={<WizardRail requirements={DEFINITION.requirements} />}
    />
  );
}

/** A reader as a list row: its provider's mark, name, state, and the switch and delete always in reach. */
function ReaderRow({
  name,
  provider,
  active,
  busy,
  onToggle,
  onDelete,
}: {
  name: string;
  provider: PaymentProvider;
  active: boolean;
  busy: boolean;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  const brand = provider === 'cash' ? undefined : BRANDS[provider];
  const leading =
    brand && 'path' in brand ? (
      <BrandTile brand={brand} className="size-9" />
    ) : brand ? (
      <span className="flex size-9 shrink-0 items-center justify-center rounded-md text-white" style={{ background: brand.background }}>
        <brand.icon size={16} aria-hidden="true" />
      </span>
    ) : undefined;
  return (
    <ListRow
      leading={leading}
      icon={CreditCard}
      tone={active ? 'success' : 'muted'}
      title={name}
      meta={PROVIDER_LABELS[provider]}
      muted={!active}
      trailing={<Badge variant={active ? 'success' : 'muted'}>{active ? 'Taking payments' : 'Paused'}</Badge>}
      control={
        <span className="flex items-center gap-1">
          <Switch label={`${active ? 'Pause' : 'Turn on'} ${name}`} checked={active} disabled={busy} onChange={onToggle} />
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-exception"
            aria-label={`Delete ${name}`}
            title="Delete"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </span>
      }
    />
  );
}

export function PaymentsConnectorPage({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  const capabilities = useAuthStore((state) => state.capabilities);
  const queryClient = useQueryClient();
  const locationId = useWorkspaceStore((state) => state.locationId);
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);
  // Management view: disabled readers included, or one could never be switched
  // back on. The till uses getPaymentMethods, which stays filtered to active.
  const readers = useQuery({
    queryKey: moduleQueryKeys.payments.key('payment-connections', locationId),
    queryFn: () => getPaymentConnections(locationId!),
    enabled: !!locationId && hasCapability(capabilities, 'payments.connections:read'),
    meta: { silentForbidden: true },
  });
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.payments.key('payment-connections') });
    void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.payments.key('payment-methods') });
  };
  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setPaymentConnectionActive(id, isActive),
    onSuccess: (_, { isActive }) => {
      refresh();
      toast('success', isActive ? 'Reader switched on.' : 'Reader paused — it’s no longer offered at the till.');
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The reader wasn’t updated.'),
  });
  const remove = useMutation({
    mutationFn: (id: string) => deletePaymentConnection(id),
    onSuccess: () => {
      refresh();
      setDeleting(null);
      toast('success', 'Reader deleted.');
    },
    // The API refuses once a reader has taken payments and says to pause it
    // instead; its wording is the useful one.
    onError: (error) => {
      setDeleting(null);
      toast('error', error instanceof Error ? error.message : 'The reader wasn’t deleted.');
    },
  });
  const methods = readers.data ?? [];
  const { location } = useCurrentWorkspace();
  const router = useRouter();
  const active = methods.filter((method) => method.isActive !== false).length;
  const paused = methods.length - active;
  const status: ConnectorStatus | undefined = !locationId
    ? undefined
    : readers.isError
      ? { tone: 'danger', text: 'Couldn’t load readers' }
      : active
        ? { tone: 'success', text: `${active} ${active === 1 ? 'reader' : 'readers'} taking payments` }
        : methods.length
          ? { tone: 'warning', text: 'Every reader is paused' }
          : { tone: 'muted', text: 'No readers yet' };

  return (
    <ConnectorManagePage
      definition={DEFINITION}
      status={status}
      health={{
        facts: [
          { icon: MapPin, title: 'Location', value: location?.name ?? 'None chosen', tone: locationId ? undefined : 'warning' },
          { icon: CreditCard, title: 'Active', value: readers.isPending ? '…' : String(active) },
          {
            icon: Pause,
            title: 'Paused',
            value: readers.isPending ? '…' : String(paused),
            tone: paused && !active ? 'warning' : undefined,
          },
        ],
      }}
      usedBy={[
        { icon: Monitor, label: 'Till', href: '/pos' },
        { icon: Calculator, label: 'Cash-up', href: '/cash-up' },
      ]}
      actions={[
        { icon: Plus, label: 'Add reader', onClick: onAdd, disabled: !locationId },
        { icon: Receipt, label: 'Receipts & tax', onClick: () => router.push('/settings/trading') },
      ]}
      onClose={onClose}
    >
      <RecordGroup
        id="card-readers"
        title={location ? `Readers at ${location.name}` : 'Readers'}
        actions={
          locationId && methods.length > 0 ? (
            <Button variant="outline" size="sm" onClick={onAdd}>
              <Plus aria-hidden="true" /> Add reader
            </Button>
          ) : undefined
        }
        footnote="Readers belong to one location. Switch location to see another’s."
      >
        {!locationId ? (
          <ListRowGroup>
            <ListRow icon={MapPin} tone="warning" title="Choose a location to see its card readers." />
          </ListRowGroup>
        ) : readers.isPending ? (
          <ListSkeleton rows={2} label="Loading readers" />
        ) : readers.isError ? (
          <ErrorState title="Couldn’t load readers" onRetry={() => void readers.refetch()} />
        ) : methods.length === 0 ? (
          <div className="rounded-lg border border-border bg-card shadow-sm">
            <EmptyState
              compact
              icon={CreditCard}
              title="No readers yet"
              description="Readers you add here are offered at the till."
              action={{ label: 'Add your first reader', onClick: onAdd }}
            />
          </div>
        ) : (
          <ListRowGroup>
            {methods.map((method) => {
              const isActive = method.isActive !== false;
              const busy = (toggle.isPending && toggle.variables?.id === method.id) || (remove.isPending && remove.variables === method.id);
              return (
                <ReaderRow
                  key={method.id}
                  name={method.displayName}
                  provider={method.provider}
                  active={isActive}
                  busy={busy}
                  onToggle={(next) => toggle.mutate({ id: method.id, isActive: next })}
                  onDelete={() => setDeleting(method)}
                />
              );
            })}
          </ListRowGroup>
        )}
      </RecordGroup>
      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.displayName}?`}
          message="It stops being offered at the till straight away. A reader that has already taken payments can’t be deleted — pause it instead, so its payment history stays tidy."
          confirmText={deleting.displayName}
          confirmLabel="Delete reader"
          pendingLabel="Deleting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </ConnectorManagePage>
  );
}
