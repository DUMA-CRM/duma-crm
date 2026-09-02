'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { CheckCircle2, CreditCard, Loader2, Plug, Receipt, Store, Wallet } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { addPaymentConnection } from '@/lib/api/operations.service';
import { type PaymentMethod, type PaymentProvider, getPaymentMethods } from '@/lib/api/payments.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConnectWizard, ProviderGrid, WizardRail, type WizardStep } from './ConnectWizard';
import { CONNECTORS_BY_ID, type ConnectorState } from './registry';
import { eyebrowClass, panelClass } from './shared';

const DEFINITION = CONNECTORS_BY_ID['card-payments'];

type Provider = Exclude<PaymentProvider, 'cash'>;

const PROVIDERS: { value: Provider; label: string; icon: typeof CreditCard; hint: string; integrated: boolean }[] = [
  {
    value: 'stripe_online',
    label: 'Stripe online checkout',
    icon: CreditCard,
    hint: 'Customers pay on Stripe’s hosted checkout after scanning your QR code. Connect once for the whole workspace.',
    integrated: true,
  },
  {
    value: 'stripe_terminal',
    label: 'Stripe Terminal',
    icon: CreditCard,
    hint: 'The POS charges the reader directly. You’ll need the reader ID and a Stripe secret key.',
    integrated: true,
  },
  {
    value: 'sumup',
    label: 'SumUp',
    icon: Wallet,
    hint: 'Needs your merchant code plus the affiliate app ID and key from the SumUp developer portal.',
    integrated: true,
  },
  {
    value: 'square',
    label: 'Square',
    icon: Store,
    hint: 'The POS charges the Square Terminal directly. You’ll need the device ID and an access token.',
    integrated: true,
  },
  {
    value: 'manual_terminal',
    label: 'Manual terminal',
    icon: Receipt,
    hint: 'A standalone card machine. Staff key the amount in and confirm on the POS — nothing to authenticate.',
    integrated: false,
  },
  {
    value: 'custom',
    label: 'Another provider',
    icon: Plug,
    hint: 'Records the payment against the order without talking to the reader.',
    integrated: false,
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

export function paymentsConnectorState(methods: PaymentMethod[] | undefined): ConnectorState {
  return methods && methods.length > 0 ? 'connected' : 'disconnected';
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
      void queryClient.invalidateQueries({ queryKey: ['payment-methods'] });
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
    setProvider,
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
  const { provider, setProvider, chosen, integrated, fields, credentialsReady, nameReady, tryAdd, locationId } = useAddPaymentConnection();
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

  const steps: WizardStep[] = [
    {
      key: 'provider',
      title: 'Which card reader?',
      description: 'The first three let the POS charge the reader itself. The others just record what a standalone machine took.',
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
    {
      key: 'credentials',
      title: integrated ? `Connect your ${chosen?.label} reader` : 'Nothing to connect',
      description: integrated
        ? 'These come from your provider’s dashboard. The credential is encrypted before it is stored.'
        : 'A manual terminal has no API to talk to — staff take the payment on the machine and confirm it on the POS.',
      ready: credentialsReady,
      content: integrated ? (
        <div className="space-y-4">
          {provider === 'sumup' && (
            <>
              <Input label="Merchant code" value={merchant} onChange={(event) => setMerchant(event.target.value)} />
              <Input label="Affiliate app ID" value={affiliateAppId} onChange={(event) => setAffiliateAppId(event.target.value)} />
              <Input label="Affiliate key" type="password" value={affiliateKey} onChange={(event) => setAffiliateKey(event.target.value)} />
            </>
          )}
          {provider !== 'stripe_online' && <Input
            label="Reader / device ID"
            value={device}
            onChange={(event) => setDevice(event.target.value)}
            hint="Shown next to the reader in your provider’s dashboard."
          />}
          <Input label={provider === 'stripe_online' ? 'Stripe secret key' : 'API credential'} type="password" value={secret} onChange={(event) => setSecret(event.target.value)} />
          {provider === 'stripe_online' && <>
            <Input label="Webhook signing secret" type="password" value={webhookSecret} onChange={(event) => setWebhookSecret(event.target.value)} hint="Create a Stripe webhook for /v1/qr-ordering/stripe/webhook and paste its whsec_ secret here." />
            <div className={panelClass}><p className="text-xs text-muted-foreground">Listen for checkout.session.completed, checkout.session.async_payment_succeeded, checkout.session.expired, payment_intent.succeeded and payment_intent.payment_failed.</p></div>
          </>}
        </div>
      ) : (
        <div className={panelClass}>
          <p className="text-sm text-muted-foreground">
            Payments taken this way still appear on the order and in the cash-up, so the day still reconciles — they just aren’t started by
            the POS.
          </p>
        </div>
      ),
    },
    {
      key: 'name',
      title: 'Name it for the till',
      description: 'Staff pick this name at checkout, so make it match what is written on the machine.',
      ready: nameReady,
      continueLabel: 'Add payment method',
      onContinue: tryAdd,
      content: (
        <div className="space-y-4">
          <Input
            label="Display name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Front counter reader"
          />
          <dl className={`${panelClass} space-y-2 text-sm`}>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Provider</dt>
              <dd className="font-medium text-foreground">{chosen?.label}</dd>
            </div>
            {integrated && provider !== 'stripe_online' && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Reader</dt>
                <dd className="truncate font-medium text-foreground">{device}</dd>
              </div>
            )}
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Location</dt>
              <dd className="font-medium text-foreground">{provider === 'stripe_online' ? 'Whole workspace' : locationId ? 'This location' : 'All locations'}</dd>
            </div>
          </dl>
        </div>
      ),
    },
    {
      key: 'done',
      title: 'Ready to take payments',
      description: 'The reader now appears at checkout. Take a £0.01 payment and refund it if you want to be certain.',
      continueLabel: 'Finish setup',
      content: (
        <div className={`${panelClass} flex items-start gap-3`}>
          <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-foreground">{displayName.trim() || 'Your reader'} was added</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Currency, VAT and what prints on the receipt live in{' '}
              <Link href="/settings/trading" className="font-medium text-primary hover:underline">
                Trading &amp; payments
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
      lockedFrom={3}
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

export function PaymentsConnectorPage({ onClose, onAdd }: { onClose: () => void; onAdd: () => void }) {
  const locationId = useWorkspaceStore((state) => state.locationId);
  const { data: methods = [], isLoading } = useQuery({
    queryKey: ['payment-methods', locationId],
    queryFn: () => getPaymentMethods(locationId!),
    enabled: !!locationId,
  });

  return (
    <EditorShell
      eyebrow="Connector"
      title="Card payments"
      icon={<CreditCard size={20} aria-hidden="true" />}
      onClose={onClose}
      actions={
        <Button className="h-9 gap-1.5" disabled={!locationId} onClick={onAdd}>
          <Plug size={15} aria-hidden="true" />
          <span className="hidden md:inline">Add reader</span>
        </Button>
      }
    >
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_0.8fr]">
        <section className={panelClass}>
          <p className={eyebrowClass}>Readers at this location</p>
          {!locationId ? (
            <p className="mt-4 text-sm text-muted-foreground">Use the location picker to see this site&apos;s card readers.</p>
          ) : isLoading ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Loading readers…
            </p>
          ) : methods.length === 0 ? (
            <div className="mt-2">
              <EmptyState
                icon={CreditCard}
                title="No card readers yet"
                description="Add one and it appears as a payment option at checkout."
              />
            </div>
          ) : (
            <ul className="mt-3 space-y-2">
              {methods.map((method) => (
                <li key={method.id} className="flex items-center gap-3 rounded-sm border border-rule bg-band px-3 py-2.5">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-muted text-muted-foreground">
                    <CreditCard size={15} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{method.displayName}</p>
                    <p className="text-xs text-muted-foreground">{PROVIDER_LABELS[method.provider]}</p>
                  </div>
                  <Badge variant="success" className="shrink-0">
                    Active
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={panelClass}>
          <p className={eyebrowClass}>Related settings</p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Currency, VAT rates and what prints on a receipt are shared by every payment method.
          </p>
          <Button variant="outline" asChild className="mt-4">
            <Link href="/settings/trading">Open trading &amp; payments</Link>
          </Button>
        </section>
      </div>
    </EditorShell>
  );
}
