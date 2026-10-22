'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { InfoRow, PickerRow } from '@/components/cms/rows';
import { Calculator, Coins, Hash, type IconComponent, Landmark, MapPin, StickyNote, Store, Tags } from '@/components/icons';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Bone } from '@/components/shared/Skeleton';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { type TradingSettings, getTradingSettings, getWorkspaceSetup, saveTradingSettings } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { CURRENCIES, currencyLabel, formatCurrency } from '@/lib/utils/currencies';
import { type ReceiptLine, linePence, receiptTotals } from '@/lib/utils/receipt-preview';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const CURRENCY_OPTIONS = CURRENCIES.map((entry) => ({ value: entry.code, label: currencyLabel(entry.code) }));

interface Form {
  legalName: string;
  tradingAddress: string;
  receiptFooter: string;
  currency: string;
  vatRegistered: boolean;
  vatNumber: string;
  defaultVatRate: string;
  pricesIncludeTax: boolean;
}

const formFrom = (settings: TradingSettings): Form => ({
  legalName: settings.legalName ?? '',
  tradingAddress: settings.tradingAddress ?? '',
  receiptFooter: settings.receiptFooter ?? '',
  currency: settings.currency,
  vatRegistered: settings.vatRegistered,
  vatNumber: settings.vatNumber ?? '',
  defaultVatRate: String(Number(settings.defaultVatRate)),
  pricesIncludeTax: settings.pricesIncludeTax,
});

type Row = Exclude<keyof Form, 'vatRegistered'>;

const same = (a: Form, b: Form) => (Object.keys(a) as (keyof Form)[]).every((key) => a[key] === b[key]);

/**
 * Trading & tax: what every receipt says, and how prices are taxed. Card readers live under Connectors.
 * Laid out like the other rules tabs: each detail a row that opens its field, the live receipt alongside.
 */
export function TradingAndPaymentsSettings() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const settings = useQuery({
    queryKey: moduleQueryKeys.organization.key('trading', tenantId),
    queryFn: () => getTradingSettings(tenantId!),
    enabled: Boolean(tenantId),
  });
  const workspace = useCurrentWorkspace();
  // The setup answers say whether the business trades in person; same key as the readiness checklist.
  const setup = useQuery({
    queryKey: ['workspace-setup', tenantId],
    queryFn: () => getWorkspaceSetup(tenantId!),
    enabled: Boolean(tenantId),
  });
  const channels = setup.data?.answers?.salesChannels;
  const onlineOnly = Array.isArray(channels) && channels.length > 0 && !channels.includes('counter');
  const site = workspace.location ?? workspace.locations?.find((row) => row.isActive);
  const suggestions = { legalName: workspace.tenant?.name ?? '', tradingAddress: onlineOnly ? '' : (site?.address ?? '') };

  if (!tenantId) return <p className="text-sm text-muted-foreground">Choose a workspace first.</p>;
  if (settings.isPending || workspace.isLoading || setup.isPending) {
    return <Bone className="h-96 w-full rounded-lg" />;
  }
  if (settings.isError) return <ErrorState title="Couldn’t load trading settings" onRetry={() => void settings.refetch()} />;
  // Keyed on the saved row, so a successful save re-seeds the form from what the server kept.
  return (
    <TradingForm
      key={JSON.stringify([formFrom(settings.data), suggestions])}
      settings={settings.data}
      suggestions={suggestions}
      onlineOnly={onlineOnly}
    />
  );
}

function TradingForm({
  settings,
  suggestions,
  onlineOnly,
}: {
  settings: TradingSettings;
  /** What DUMA already knows, used only where the saved field is empty. */
  suggestions: { legalName: string; tradingAddress: string };
  onlineOnly: boolean;
}) {
  const qc = useQueryClient();
  const saved = formFrom(settings);
  // Empty fields start from the workspace's own name and address, so an owner confirms rather than retypes.
  const [initial] = useState<Form>(() => ({
    ...saved,
    legalName: saved.legalName || suggestions.legalName,
    tradingAddress: saved.tradingAddress || suggestions.tradingAddress,
  }));
  const [form, setForm] = useState<Form>(initial);
  const suggested = (key: 'legalName' | 'tradingAddress') => !saved[key] && Boolean(initial[key]) && form[key] === initial[key];
  const onlyPrefilled = !same(initial, saved) && same(form, initial);
  // VAT invoices need an address, so an online-only business still gets the field once VAT registered.
  const showAddress = !onlineOnly || form.vatRegistered || Boolean(saved.tradingAddress);
  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((current) => ({ ...current, [key]: value }));
  // One row open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<Row | null>(null);
  const dirty = !same(form, saved);
  const rate = Number(form.defaultVatRate);
  // The rate only matters once VAT registered; a hidden bad value must not block saving.
  const rateValid = Number.isFinite(rate) && rate >= 0 && rate <= 100;
  const valid = /^[A-Z]{3}$/.test(form.currency) && (!form.vatRegistered || rateValid);
  const money = (value: number) => formatCurrency(value, form.currency);
  const example = 3.6;
  const currencyOptions = CURRENCY_OPTIONS.some((option) => option.value === form.currency)
    ? CURRENCY_OPTIONS
    : [...CURRENCY_OPTIONS, { value: form.currency, label: currencyLabel(form.currency) }];

  const save = useMutation({
    mutationFn: () =>
      saveTradingSettings({
        ...settings,
        currency: form.currency,
        defaultVatRate: rate,
        vatRegistered: form.vatRegistered,
        pricesIncludeTax: form.pricesIncludeTax,
        // Empty clears the field; the old form could only ever overwrite it.
        vatNumber: form.vatRegistered ? form.vatNumber.trim() || null : null,
        legalName: form.legalName.trim() || null,
        tradingAddress: form.tradingAddress.trim() || null,
        receiptFooter: form.receiptFooter.trim() || null,
      }),
    onSuccess: () => {
      // The till and every margin calculation read this same key.
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('trading') });
      toast('success', 'Trading settings saved.');
    },
    onError: (error) => toast('error', error.message || 'Trading settings weren’t saved.'),
  });

  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  /** A short text: what it says on the row, the field (and why it matters) underneath. */
  const textRow = (row: Row & ('legalName' | 'tradingAddress' | 'receiptFooter' | 'vatNumber'), icon: IconComponent, title: string, empty: string, placeholder: string, hint: string, maxLength?: number) => (
    <PickerRow icon={icon} title={title} value={form[row].trim() || empty} muted={!form[row].trim()} open={open === row} onToggle={() => toggle(row)}>
      <Input aria-label={title} value={form[row]} onChange={(event) => set(row, event.target.value)} placeholder={placeholder} maxLength={maxLength} autoFocus />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </PickerRow>
  );

  return (
    <SettingsTabBody narrowAside stickyAside aside={<ReceiptPreview form={form} />}>
      <SettingsSection title="On your receipts">
        <div className="space-y-3">
          {textRow(
            'legalName',
            Store,
            'Business name',
            'Not set',
            'North Street Coffee Ltd',
            suggested('legalName') ? 'From your workspace name.' : 'Printed at the top of every receipt.',
          )}
          {showAddress &&
            textRow(
              'tradingAddress',
              MapPin,
              'Address',
              'Not set',
              '12 North Street, London',
              suggested('tradingAddress') ? 'From your location.' : onlineOnly ? 'Needed on VAT invoices.' : 'Printed under your business name.',
            )}
          {textRow('receiptFooter', StickyNote, 'Thank-you line', 'None', 'Thank you — see you soon', 'Printed at the foot of every receipt.', 200)}
        </div>
      </SettingsSection>

      <SettingsSection title="Money and VAT">
        <div className="space-y-3">
          <PickerRow icon={Coins} title="Currency" value={currencyLabel(form.currency)} open={open === 'currency'} onToggle={() => toggle('currency')}>
            {/* Straight to the list; choosing or dismissing folds the row back up. */}
            <Select
              value={form.currency}
              onValueChange={(value) => set('currency', value)}
              options={currencyOptions}
              ariaLabel="Currency"
              className="w-full"
              defaultOpen
              onOpenChange={(next) => !next && setOpen(null)}
            />
          </PickerRow>
          <InfoRow icon={Landmark} title="VAT registered">
            <Switch checked={form.vatRegistered} onChange={(next) => set('vatRegistered', next)} label="VAT registered" />
          </InfoRow>
          {form.vatRegistered && (
            <>
              {textRow('vatNumber', Hash, 'VAT number', 'Not set', 'GB123456789', 'Printed on every receipt while you’re registered.')}
              <PickerRow
                icon={Calculator}
                title="VAT rate"
                value={rateValid ? `${rate}%` : 'Check the rate'}
                muted={!rateValid}
                open={open === 'defaultVatRate'}
                onToggle={() => toggle('defaultVatRate')}
              >
                <Input
                  aria-label="VAT rate (%)"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={form.defaultVatRate}
                  onChange={(event) => set('defaultVatRate', event.target.value)}
                  error={rateValid ? undefined : 'Enter a rate between 0 and 100.'}
                  autoFocus
                />
                <p className="mt-1.5 text-xs text-muted-foreground">Used for anything without its own rate, and taken out of your margins.</p>
              </PickerRow>
              <PickerRow
                icon={Tags}
                title="Menu prices"
                value={form.pricesIncludeTax ? 'VAT included' : 'VAT added at the till'}
                open={open === 'pricesIncludeTax'}
                onToggle={() => toggle('pricesIncludeTax')}
              >
                <ChoiceCards<'inc' | 'exc'>
                  appearance="settings"
                  value={form.pricesIncludeTax ? 'inc' : 'exc'}
                  onChange={(value) => set('pricesIncludeTax', value === 'inc')}
                  options={[
                    { value: 'inc', label: 'VAT included', icon: Tags },
                    { value: 'exc', label: 'VAT added at the till', icon: Calculator },
                  ]}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {money(example)} on the menu — the customer pays{' '}
                  {money(form.pricesIncludeTax ? example : example * (1 + (rateValid ? rate : 0) / 100))}.
                </p>
              </PickerRow>
            </>
          )}
        </div>
      </SettingsSection>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        disabled={!valid}
        message={!valid ? 'Enter a VAT rate between 0 and 100' : onlyPrefilled ? 'Filled in from your workspace — save to use it' : undefined}
        onSave={() => save.mutate()}
        onDiscard={() => {
          setForm(saved);
          setOpen(null);
        }}
      />
    </SettingsTabBody>
  );
}

const SAMPLE_ORDER: ReceiptLine[] = [
  { quantity: 2, name: 'Flat white', unitPence: 360 },
  { quantity: 1, name: 'Oat latte', unitPence: 390, extras: [{ name: 'Extra shot', pence: 60 }] },
  { quantity: 1, name: 'Almond croissant', unitPence: 380 },
  { quantity: 1, name: 'Banana bread', unitPence: 320 },
  { quantity: 1, name: 'Sparkling water', unitPence: 220 },
];

/** A live receipt, so the owner sees exactly what their customers will. */
function ReceiptPreview({ form }: { form: Form }) {
  const rate = Number(form.defaultVatRate) || 0;
  const totals = receiptTotals(SAMPLE_ORDER, {
    registered: form.vatRegistered,
    ratePercent: rate,
    pricesIncludeTax: form.pricesIncludeTax,
  });
  const itemCount = SAMPLE_ORDER.reduce((sum, line) => sum + line.quantity, 0);
  const money = (pence: number) =>
    new Intl.NumberFormat(undefined, { style: 'currency', currency: /^[A-Z]{3}$/.test(form.currency) ? form.currency : 'GBP' }).format(
      pence / 100,
    );
  const row = 'flex justify-between gap-3';
  const rule = <div className="my-3 border-t border-dashed border-neutral-300" />;

  return (
    // No card around it: the receipt paper is the thing, so it stands on its own.
    <motion.div variants={SECTION_RISE} className="pt-1">
      <p className="mb-2 text-center text-label uppercase text-muted-foreground">Your receipt</p>
      <div className="mx-auto max-w-xs rounded-md border border-rule/60 bg-white px-5 py-6 font-mono text-xs leading-5 text-neutral-800 shadow-md">
        <p className="text-center text-sm font-semibold">{form.legalName || 'Your business name'}</p>
        <p className="text-center text-neutral-500">{form.tradingAddress || 'Trading address'}</p>
        {form.vatRegistered && form.vatNumber && <p className="text-center text-neutral-500">VAT {form.vatNumber}</p>}
        {rule}
        <div className="text-neutral-500">
          <p className={row}>
            <span>25 Sep 2026</span>
            <span>09:41</span>
          </p>
          <p className={row}>
            <span>Order #1042</span>
            <span>Till 1</span>
          </p>
          <p>Served by Alex</p>
        </div>
        {rule}
        <ul className="space-y-1">
          {SAMPLE_ORDER.map((line) => (
            <li key={line.name}>
              <p className={row}>
                <span className="min-w-0">
                  {line.quantity} × {line.name}
                </span>
                <span className="shrink-0">{money(linePence(line))}</span>
              </p>
              {line.extras?.map((extra) => (
                <p key={extra.name} className="pl-4 text-neutral-500">
                  + {extra.name}
                </p>
              ))}
            </li>
          ))}
        </ul>
        {rule}
        <p className={cn(row, 'text-neutral-500')}>
          <span>Subtotal · {itemCount} items</span>
          <span>{money(totals.itemsPence)}</span>
        </p>
        {form.vatRegistered && (
          <p className={cn(row, 'text-neutral-500')}>
            <span>{form.pricesIncludeTax ? `Includes VAT ${rate}%` : `VAT ${rate}%`}</span>
            <span>{money(totals.vatPence)}</span>
          </p>
        )}
        <p className={cn(row, 'mt-1 text-sm font-semibold')}>
          <span>Total</span>
          <span>{money(totals.totalPence)}</span>
        </p>
        {rule}
        <p className={row}>
          <span>Card · Visa •••• 4242</span>
          <span>{money(totals.totalPence)}</span>
        </p>
        <p className="text-neutral-500">Contactless · Approved</p>
        {form.receiptFooter && <p className="mt-4 text-center text-neutral-500">{form.receiptFooter}</p>}
        <p className="mt-4 text-center text-neutral-400">Receipt 1042-0925</p>
      </div>
    </motion.div>
  );
}
