'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { EditorShell } from '@/components/shared/EditorShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { addPaymentConnection, getTradingSettings, saveTradingSettings } from '@/lib/api/operations.service';
import { type PaymentProvider, getPaymentMethods } from '@/lib/api/payments.service';
import { formatDate } from '@/lib/utils/date';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** ISO weekday order: 1 = Monday, matching the API and the rota. */
const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function TradingAndPaymentsSettings() {
  const router = useRouter(),
    qc = useQueryClient();
  const { tenantId, locationId } = useWorkspaceStore();
  const { data: settings } = useQuery({
    queryKey: ['trading', tenantId],
    queryFn: () => getTradingSettings(tenantId!),
    enabled: !!tenantId,
  });
  const { data: methods = [] } = useQuery({
    queryKey: ['payment-methods', locationId],
    queryFn: () => getPaymentMethods(locationId!),
    enabled: !!locationId,
  });
  const [currency, setCurrency] = useState('');
  const [vat, setVat] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [legalName, setLegalName] = useState('');
  const [tradingAddress, setTradingAddress] = useState('');
  const [receiptFooter, setReceiptFooter] = useState('');
  const [vatRegistered, setVatRegistered] = useState<boolean>();
  const [autoFinalise, setAutoFinalise] = useState<boolean>();
  const [payrollPeriod, setPayrollPeriod] = useState<'weekly' | 'monthly'>();
  const [payDay, setPayDay] = useState<string>();
  const [payWeekday, setPayWeekday] = useState<string>();
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
        payrollAutoFinalise: autoFinalise ?? settings!.payrollAutoFinalise,
        payrollPeriod: payrollPeriod ?? settings!.payrollPeriod,
        payrollPayDayOfMonth: Number(payDay ?? settings!.payrollPayDayOfMonth),
        payrollPayWeekday: Number(payWeekday ?? settings!.payrollPayWeekday),
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
          <h2 className="mb-4 font-semibold">Payment methods</h2>
          <div className="mb-4 space-y-1 text-sm">
            {methods.map((m) => (
              <p key={m.id}>
                {m.displayName} · {m.provider.replaceAll('_', ' ')}
              </p>
            ))}
          </div>
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

        {/* ── Payroll schedule ───────────────────────────────────────────── */}
        <section className="rounded-sm border border-rule bg-card p-5 shadow-sm">
          <h2 className="font-semibold">Payroll schedule</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Snapshot the period that has just ended, without anyone pressing anything.
          </p>

          <label className="mt-4 flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={autoFinalise ?? settings?.payrollAutoFinalise ?? false}
              onChange={(event) => setAutoFinalise(event.target.checked)}
            />
            <span>
              <span className="font-medium text-foreground">Finalise automatically on pay day</span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Off by default. A run is still only <strong>finalised</strong> — nobody sees a payslip until someone enters the tax and
                National Insurance and issues it, because DUMA does not calculate them.
              </span>
            </span>
          </label>

          <div className="mt-4 space-y-3">
            <Select
              value={payrollPeriod ?? settings?.payrollPeriod ?? 'monthly'}
              onValueChange={(value) => setPayrollPeriod(value as 'weekly' | 'monthly')}
              options={[
                { value: 'monthly', label: 'Monthly' },
                { value: 'weekly', label: 'Weekly' },
              ]}
              ariaLabel="Payroll cadence"
            />

            {(payrollPeriod ?? settings?.payrollPeriod ?? 'monthly') === 'monthly' ? (
              <Select
                value={String(payDay ?? settings?.payrollPayDayOfMonth ?? 1)}
                onValueChange={setPayDay}
                options={Array.from({ length: 31 }, (_, i) => ({ value: String(i + 1), label: `Day ${i + 1} of the month` }))}
                ariaLabel="Pay day of the month"
              />
            ) : (
              <Select
                value={String(payWeekday ?? settings?.payrollPayWeekday ?? 1)}
                onValueChange={setPayWeekday}
                options={WEEKDAYS.map((label, index) => ({ value: String(index + 1), label }))}
                ariaLabel="Pay weekday"
              />
            )}

            <p className="text-xs leading-relaxed text-muted-foreground">
              Pay day comes <strong>after</strong> the period closes, so every hour in the run has been worked: on day 20 monthly, the run
              covers the whole of the previous month. A day past the end of a short month runs on its last day instead of being skipped.
            </p>

            {settings?.payrollLastAutoPeriodEnd && (
              <p className="text-xs text-muted-foreground">
                Last automatic run covered the period ending {formatDate(settings.payrollLastAutoPeriodEnd)}.
              </p>
            )}
          </div>
        </section>
      </div>
    </EditorShell>
  );
}
