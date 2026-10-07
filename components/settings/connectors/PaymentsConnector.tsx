'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { ArrowRight, CheckCircle2, CreditCard, Plug, Plus, Receipt, Store, Trash2, Wallet } from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConnectWizard, ProviderGrid, WizardRail, type WizardStep } from './ConnectWizard';
import { CONNECTORS_BY_ID, type ConnectorState } from './registry';
import { panelClass } from './shared';

const DEFINITION = CONNECTORS_BY_ID['card-payments'];

type Provider = Exclude<PaymentProvider, 'cash'>;

// Readers the till can charge first — what most people are here to set up —
// then card machines staff key amounts into, then online checkout.
const PROVIDERS: { value: Provider; label: string; icon: typeof CreditCard; hint: string; integrated: boolean; name: string }[] = [
  {
    value: 'stripe_terminal',
    label: 'Stripe Terminal',
    icon: CreditCard,
    hint: 'The till sends the amount to the reader for you.',
    integrated: true,
    name: 'Counter reader',
  },
  {
    value: 'sumup',
    label: 'SumUp',
    icon: Wallet,
    hint: 'The till sends the amount to your SumUp reader.',
    integrated: true,
    name: 'SumUp reader',
  },
  {
    value: 'square',
    label: 'Square',
    icon: Store,
    hint: 'The till sends the amount to your Square Terminal.',
    integrated: true,
    name: 'Square terminal',
  },
  {
    value: 'manual_terminal',
    label: 'Card machine',
    icon: Receipt,
    hint: 'Any standalone machine. Staff type the amount on it, then tap “Paid” on the till.',
    integrated: false,
    name: 'Card machine',
  },
  {
    value: 'custom',
    label: 'Another provider',
    icon: Plug,
    hint: 'Anything else — the till just records that the customer paid by card.',
    integrated: false,
    name: 'Card payments',
  },
  {
    value: 'stripe_online',
    label: 'Online checkout (Stripe)',
    icon: CreditCard,
    hint: 'For QR ordering: customers pay on their phone. Set up once for the whole workspace.',
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
export function paymentsConnectorState(methods: PaymentMethod[] | undefined): ConnectorState {
  if (!methods || methods.length === 0) return 'disconnected';
  return methods.some((method) => method.isActive !== false) ? 'connected' : 'paused';
}

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
    title: provider === 'stripe_online' ? 'Connect your Stripe account' : `Connect your ${chosen?.label} reader`,
    description: 'Copy these from your provider’s dashboard. They’re encrypted before they’re saved.',
    ready: credentialsReady,
    content: (
      <div className="space-y-4">
        {provider === 'sumup' && (
          <>
            <Input
              label="Merchant code"
              autoFocus
              value={merchant}
              onChange={(event) => setMerchant(event.target.value)}
              hint="SumUp dashboard → Account → Profile."
            />
            <Input label="Affiliate app ID" value={affiliateAppId} onChange={(event) => setAffiliateAppId(event.target.value)} />
            <Input
              label="Affiliate key"
              type="password"
              value={affiliateKey}
              onChange={(event) => setAffiliateKey(event.target.value)}
              hint="Both come from the SumUp developer portal → Affiliate keys."
            />
          </>
        )}
        {provider !== 'stripe_online' && (
          <Input
            label="Reader ID"
            autoFocus={provider !== 'sumup'}
            value={device}
            onChange={(event) => setDevice(event.target.value)}
            placeholder={provider === 'stripe_terminal' ? 'tmr_…' : undefined}
            hint={
              provider === 'square'
                ? 'Square dashboard → Devices → your Terminal → Device ID.'
                : provider === 'stripe_terminal'
                  ? 'Stripe dashboard → Terminal → Readers → the reader’s ID.'
                  : 'Shown next to the reader in your provider’s dashboard.'
            }
          />
        )}
        <Input
          label={provider === 'square' ? 'Access token' : 'Secret key'}
          autoFocus={provider === 'stripe_online'}
          type="password"
          value={secret}
          onChange={(event) => setSecret(event.target.value)}
          placeholder={provider === 'stripe_terminal' || provider === 'stripe_online' ? 'sk_live_…' : undefined}
          hint={
            provider === 'square'
              ? 'Square Developer → your app → Credentials → Production access token.'
              : provider === 'sumup'
                ? 'Your SumUp API key.'
                : 'Stripe dashboard → Developers → API keys → Secret key.'
          }
        />
        {provider === 'stripe_online' && (
          <>
            <Input
              label="Webhook signing secret"
              type="password"
              value={webhookSecret}
              onChange={(event) => setWebhookSecret(event.target.value)}
              placeholder="whsec_…"
              hint="Stripe → Developers → Webhooks → add an endpoint for /v1/qr-ordering/stripe/webhook, then copy its signing secret."
            />
            <div className={panelClass}>
              <p className="text-xs text-muted-foreground">
                Send these events to it: checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired,
                payment_intent.succeeded and payment_intent.payment_failed.
              </p>
            </div>
          </>
        )}
      </div>
    ),
  };

  const steps: WizardStep[] = [
    {
      key: 'provider',
      title: 'How do you take card payments?',
      description: 'Pick the one on your counter. You can add more later.',
      ready: provider !== null,
      content: (
        <ProviderGrid
          ariaLabel="Card payment provider"
          options={PROVIDERS.map(({ value, label, icon, hint }) => ({ value, label, icon, hint }))}
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
      title: 'What should staff see at the till?',
      description: 'They pick this name when taking a card payment — match what’s written on the machine.',
      ready: nameReady,
      continueLabel: 'Add reader',
      onContinue: tryAdd,
      content: (
        <div className="space-y-4">
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
      title: 'Ready to take payments',
      description: 'It now shows up at checkout. To be sure, take a small test payment and refund it.',
      continueLabel: 'Done',
      content: (
        <div className={`${panelClass} flex items-start gap-3`}>
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">{displayName.trim() || 'Your reader'} was added</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Currency, VAT and what prints on the receipt live in{' '}
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
      rail={
        <WizardRail
          icon={CreditCard}
          name={DEFINITION.name}
          tagline={DEFINITION.tagline}
          requirements={DEFINITION.requirements}
          footnote={<>Readers are added per location. Use the location picker to set up another site.</>}
        />
      }
    />
  );
}

/**
 * A reader drawn as the card it takes: the chip, the provider where the card
 * network would be, the name across the middle. On, it is the brand's forest
 * green; paused, it greys out like a card left in the drawer.
 */
function ReaderCard({
  name,
  provider,
  active,
  busy,
  index,
  onToggle,
  onDelete,
}: {
  name: string;
  provider: string;
  active: boolean;
  busy: boolean;
  index: number;
  onToggle: (isActive: boolean) => void;
  onDelete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: reduceMotion ? 0 : index * 0.06, duration: 0.3 }}
      className={cn(
        'relative flex aspect-[1.586] flex-col justify-between overflow-hidden rounded-2xl p-5 shadow-md transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'border border-rule/60 bg-band text-muted-foreground shadow-none',
      )}
    >
      {/* Two faint rings, like the watermark on a real card. */}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -right-10 -top-12 size-44 rounded-full border-[18px]',
          active ? 'border-white/6' : 'border-black/[0.03]',
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute -bottom-16 -right-2 size-40 rounded-full border-[14px]',
          active ? 'border-white/5' : 'border-black/[0.03]',
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        {/* The chip. */}
        <span
          aria-hidden="true"
          className={cn(
            'grid h-8 w-11 grid-cols-3 gap-px overflow-hidden rounded-md border p-1',
            active ? 'border-white/30 bg-white/20' : 'border-rule/60 bg-field',
          )}
        >
          {Array.from({ length: 6 }, (_, cell) => (
            <span key={cell} className={cn('rounded-[2px]', active ? 'bg-white/25' : 'bg-band')} />
          ))}
        </span>
        <span
          className={cn('text-xs font-semibold uppercase tracking-wide', active ? 'text-primary-foreground/80' : 'text-muted-foreground')}
        >
          {provider}
        </span>
      </div>

      <p
        className={cn(
          'relative truncate text-xl font-semibold tracking-headline',
          active ? 'text-primary-foreground' : 'text-foreground/70',
        )}
      >
        {name}
      </p>

      <div className="relative flex items-center justify-between gap-3">
        <span
          className={cn('flex items-center gap-1.5 text-xs font-semibold', active ? 'text-primary-foreground/90' : 'text-muted-foreground')}
        >
          <span className={cn('size-1.5 rounded-full', active ? 'bg-white' : 'bg-muted-foreground/60')} aria-hidden="true" />
          {active ? 'Taking payments' : 'Paused'}
        </span>
        <span className="flex items-center gap-1">
          <Switch label={`${active ? 'Pause' : 'Turn on'} ${name}`} checked={active} disabled={busy} onChange={onToggle} onDark={active} />
          <Button
            variant="ghost"
            size="icon-sm"
            className={cn(
              active
                ? 'text-primary-foreground/80 hover:bg-white/15 hover:text-primary-foreground'
                : 'text-muted-foreground hover:text-exception',
            )}
            aria-label={`Delete ${name}`}
            title="Delete"
            disabled={busy}
            onClick={onDelete}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </span>
      </div>
    </motion.li>
  );
}

export function PaymentsConnectorPage({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  const queryClient = useQueryClient();
  const locationId = useWorkspaceStore((state) => state.locationId);
  const [deleting, setDeleting] = useState<PaymentMethod | null>(null);
  // Management view: disabled readers included, or one could never be switched
  // back on. The till uses getPaymentMethods, which stays filtered to active.
  const readers = useQuery({
    queryKey: moduleQueryKeys.payments.key('payment-connections', locationId),
    queryFn: () => getPaymentConnections(locationId!),
    enabled: !!locationId,
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

  return (
    <EditorShell
      eyebrow="Connector"
      title="Card payments"
      icon={<CreditCard size={20} aria-hidden="true" />}
      onClose={onClose}
      actions={
        <Button className="h-9 gap-1.5" disabled={!locationId} onClick={onAdd}>
          <Plus size={15} aria-hidden="true" />
          <span className="hidden md:inline">Add reader</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-5">
        {!locationId ? (
          <section>
            <h2 className="text-base font-semibold tracking-title text-foreground">Readers</h2>
            <div className="mt-4">
              <p className="text-sm text-muted-foreground">Choose a location to see its card readers.</p>
            </div>
          </section>
        ) : (
          // No card around the readers: they are cards already.
          <section>
            <h2 className="text-base font-semibold tracking-title text-foreground">
              {location ? `Readers at ${location.name}` : 'Readers'}
            </h2>
            <div className="mt-4">
              {readers.isPending ? (
                <div role="status" aria-busy="true" aria-label="Loading readers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {Array.from({ length: 2 }, (_, index) => (
                    <Bone key={index} className="aspect-[1.586] rounded-2xl" />
                  ))}
                </div>
              ) : readers.isError ? (
                <ErrorState title="Couldn’t load readers" onRetry={() => void readers.refetch()} />
              ) : (
                <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {methods.map((method, index) => {
                    const active = method.isActive !== false;
                    const busy =
                      (toggle.isPending && toggle.variables?.id === method.id) || (remove.isPending && remove.variables === method.id);
                    return (
                      <ReaderCard
                        key={method.id}
                        index={index}
                        name={method.displayName}
                        provider={PROVIDER_LABELS[method.provider]}
                        active={active}
                        busy={busy}
                        onToggle={(isActive) => toggle.mutate({ id: method.id, isActive })}
                        onDelete={() => setDeleting(method)}
                      />
                    );
                  })}
                  <li>
                    {/* The same card shape, dashed: where the next reader will go. */}
                    <button
                      type="button"
                      onClick={onAdd}
                      className="flex aspect-[1.586] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-rule/70 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-band">
                        <Plus size={20} aria-hidden="true" />
                      </span>
                      <span className="text-sm font-semibold">{methods.length === 0 ? 'Add your first reader' : 'Add reader'}</span>
                    </button>
                  </li>
                </ul>
              )}
            </div>
          </section>
        )}

        <Link
          href="/settings/trading"
          className="group flex items-center gap-3 self-start rounded-md px-1 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring"
        >
          Currency, VAT and what prints on receipts live in Trading &amp; tax
          <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
      {deleting && (
        <ConfirmModal
          title={`Delete ${deleting.displayName}?`}
          message="A reader that has already taken payments can’t be deleted — pause it instead so its payment history stays tidy."
          confirmLabel="Delete reader"
          pendingLabel="Deleting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleting.id)}
          onClose={() => setDeleting(null)}
        />
      )}
    </EditorShell>
  );
}
