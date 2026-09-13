'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  addPaymentConnection,
  deletePaymentConnection,
  getPaymentConnections,
  getTradingSettings,
  setPaymentConnectionActive,
  saveTradingSettings,
} from '@/lib/api/operations.service';
import { Badge } from '@/components/ui/badge';

import { cn } from '@/lib/utils/cn';
import type { PaymentProvider } from '@/lib/api/payments.service';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function TradingAndPaymentsSettings() {
  const router = useRouter(),
    qc = useQueryClient();
  const { tenantId, locationId } = useWorkspaceStore();
  const { data: settings } = useQuery({
    queryKey: ['trading', tenantId],
    queryFn: () => getTradingSettings(tenantId!),
    enabled: !!tenantId,
  });
  // Management view: disabled readers included, or one could never be turned
  // back on. The till uses `getPaymentMethods`, which stays filtered to active.
  const { data: methods = [] } = useQuery({
    queryKey: ['payment-connections', locationId],
    queryFn: () => getPaymentConnections(locationId!),
    enabled: !!locationId,
  });

  const toggle = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setPaymentConnectionActive(id, isActive),
    onSuccess: (_, { isActive }) => {
      void qc.invalidateQueries({ queryKey: ['payment-connections'] });
      void qc.invalidateQueries({ queryKey: ['payment-methods'] });
      toast('success', isActive ? 'Reader enabled.' : 'Reader disabled — it will no longer be offered at the till.');
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The reader wasn’t updated. Try again.'),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deletePaymentConnection(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payment-connections'] });
      void qc.invalidateQueries({ queryKey: ['payment-methods'] });
      toast('success', 'Reader deleted.');
    },
    // The API refuses once a reader has taken payments, and says to disable it
    // instead. Its wording is the useful one, so it is shown rather than a
    // generic failure.
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The reader wasn’t deleted.'),
  });
  const [currency, setCurrency] = useState('');
  const [vat, setVat] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradingAddress, setTradingAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [vatRegistered, setVatRegistered] = useState<boolean>();
  const [pricesIncludeTax, setPricesIncludeTax] = useState<boolean>();
  const [provider, setProvider] = useState<Exclude<PaymentProvider, 'cash'>>('manual_terminal');
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [device, setDevice] = useState('');
  const [merchant, setMerchant] = useState('');
  const [affiliateAppId, setAffiliateAppId] = useState('');
  const [affiliateKey, setAffiliateKey] = useState('');
  const integrated = ['stripe_terminal', 'sumup', 'square'].includes(provider);
  const connectionValid =
    !!name.trim() &&
    (!integrated || (!!secret.trim() && !!device.trim())) &&
    (provider !== 'sumup' || (!!merchant.trim() && !!affiliateAppId.trim() && !!affiliateKey.trim()));
  const save = useMutation({
    mutationFn: () =>
      saveTradingSettings({
        ...settings!,
        currency: (currency || settings!.currency).toUpperCase(),
        defaultVatRate: Number(vat || settings!.defaultVatRate),
        vatNumber: vatNumber || settings!.vatNumber,
        legalName: legalName || settings!.legalName,
        tradingAddress: tradingAddress || settings!.tradingAddress,
        receiptFooter: receiptFooter || settings!.receiptFooter,
        vatRegistered: vatRegistered ?? settings!.vatRegistered,
        pricesIncludeTax: pricesIncludeTax ?? settings!.pricesIncludeTax,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['trading'] });
      toast('success', 'Trading settings saved.');
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'Trading settings weren’t saved. Review them and try again.'),
  });
  const add = useMutation({
    mutationFn: () =>
      addPaymentConnection({
        tenantId: tenantId!,
        locationId,
        provider,
        displayName: name,
        secret: secret || undefined,
        configuration:
          provider === 'stripe_terminal'
            ? { readerId: device }
            : provider === 'sumup'
              ? { readerId: device, merchantCode: merchant, affiliateAppId, affiliateKey }
              : provider === 'square'
                ? { deviceId: device }
                : {},
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['payment-methods'] });
      setName('');
      setSecret('');
      setDevice('');
      setMerchant('');
      setAffiliateAppId('');
      setAffiliateKey('');
      toast('success', 'Payment method added.');
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The payment method wasn’t added. Review the details and try again.'),
  });
  return (
    <EditorShell eyebrow="Settings" title="Trading & payments" onClose={() => router.push('/settings/connectors')}>
      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-sm border border-rule bg-card shadow-sm p-5">
          <h2 className="mb-4 font-semibold">Currency and VAT</h2>
          <div className="space-y-3">
            <Input
              label="ISO currency"
              placeholder={settings?.currency ?? 'GBP'}
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              maxLength={3}
            />
            <Input
              label="Default VAT rate (%)"
              type="number"
              placeholder={settings?.defaultVatRate ?? '20'}
              value={vat}
              onChange={(e) => setVat(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={vatRegistered ?? settings?.vatRegistered ?? false}
                onChange={(e) => setVatRegistered(e.target.checked)}
              />
              VAT registered
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={pricesIncludeTax ?? settings?.pricesIncludeTax ?? true}
                onChange={(e) => setPricesIncludeTax(e.target.checked)}
              />
              Menu prices include VAT
            </label>
            <Input
              label="VAT registration number"
              placeholder={settings?.vatNumber ?? 'Optional'}
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
            />
            <Input
              label="Legal business name"
              placeholder={settings?.legalName ?? 'Receipt heading'}
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
            />
            <Input
              label="Trading address"
              placeholder={settings?.tradingAddress ?? 'Receipt address'}
              value={tradingAddress}
              onChange={(e) => setTradingAddress(e.target.value)}
            />
            <Input
              label="Receipt footer"
              placeholder={settings?.receiptFooter ?? 'Thank you for visiting'}
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
            />
            <Button onClick={() => save.mutate()} disabled={!settings || (!!currency && currency.length !== 3) || save.isPending}>
              Save settings
            </Button>
          </div>
        </section>
        <section className="rounded-sm border border-rule bg-card shadow-sm p-5">
          <h2 className="font-semibold">Card readers</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            A location can have several. Disabling one stops it being offered at the till and keeps its payment history.
          </p>

          {methods.length === 0 ? (
            <p className="mb-4 rounded-sm border border-dashed border-rule p-4 text-sm text-muted-foreground">
              No readers at this location yet.
            </p>
          ) : (
            <ul className="mb-4 divide-y divide-rule overflow-hidden rounded-sm border border-rule">
              {methods.map((method) => {
                const active = method.isActive !== false;
                const busy = toggle.isPending || remove.isPending;
                return (
                  <li key={method.id} className={cn('flex flex-wrap items-center gap-3 px-3 py-2.5', !active && 'bg-band/40')}>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm font-medium', active ? 'text-foreground' : 'text-muted-foreground')}>
                        {method.displayName}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{method.provider.replaceAll('_', ' ')}</span>
                    </span>
                    {!active && <Badge variant="muted">Disabled</Badge>}
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      onClick={() => toggle.mutate({ id: method.id, isActive: !active })}
                    >
                      {active ? 'Disable' : 'Enable'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={busy}
                      className="text-destructive hover:text-destructive"
                      onClick={() => remove.mutate(method.id)}
                    >
                      Delete
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
          <div className="space-y-3">
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as typeof provider)}
              options={[
                { value: 'stripe_terminal', label: 'Stripe Terminal' },
                { value: 'sumup', label: 'SumUp' },
                { value: 'square', label: 'Square' },
                { value: 'manual_terminal', label: 'Manual terminal' },
                { value: 'custom', label: 'Another provider' },
              ]}
              ariaLabel="Provider"
            />
            <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} />
            {provider === 'sumup' && <Input label="Merchant code" value={merchant} onChange={(e) => setMerchant(e.target.value)} />}
            {provider === 'sumup' && (
              <Input label="Affiliate app ID" value={affiliateAppId} onChange={(e) => setAffiliateAppId(e.target.value)} />
            )}
            {provider === 'sumup' && (
              <Input label="Affiliate key" type="password" value={affiliateKey} onChange={(e) => setAffiliateKey(e.target.value)} />
            )}
            {integrated && <Input label="Reader / device ID" value={device} onChange={(e) => setDevice(e.target.value)} />}
            {integrated && <Input label="API credential" type="password" value={secret} onChange={(e) => setSecret(e.target.value)} />}
            <Button onClick={() => add.mutate()} disabled={!connectionValid || add.isPending}>
              Add payment method
            </Button>
          </div>
        </section>

      </div>
    </EditorShell>
  );
}
