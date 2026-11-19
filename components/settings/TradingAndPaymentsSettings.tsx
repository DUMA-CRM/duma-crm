'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { Calculator, Coins, Hash, type IconComponent, Landmark, MapPin, StickyNote, Store, Tags } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ChangeRow, SaveBar, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone } from '@/components/shared/Skeleton';
import { SectionSkeleton } from '@/components/shared/TileSkeleton';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { type TradingSettings, getTradingSettings, getWorkspaceSetup, saveTradingSettings } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { CURRENCIES, currencyLabel, formatCurrency } from '@/lib/utils/currencies';
import { type ReceiptLine, linePence, receiptTotals } from '@/lib/utils/receipt-preview';
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
 * Laid out like Settings → Account: each detail a row whose Change opens its field, one draft saved through
 * the bar, the live receipt alongside.
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
  if (settings.isPending || workspace.isLoading || setup.isPending) return <TradingSkeleton />;
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
        // Deleting cancelled orders is set on the Orders page (Edit orders); it goes back as it came.
      }),
    onSuccess: () => {
      // The till and every margin calculation read this same key.
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('trading') });
      toast('success', 'Trading settings saved.');
    },
    onError: (error) => toast('error', error.message || 'Trading settings weren’t saved.'),
  });

  // One row open at a time. Cancel puts the field back as it was when the row opened; the draft is still saved through the bar.
  const [before, setBefore] = useState<Form | null>(null);
  const toggle = (row: Row) => {
    if (open === row) {
      if (before) set(row, before[row]);
      setOpen(null);
      return;
    }
    setBefore(form);
    setOpen(row);
  };
  /** The row's value: what it says now, or a quiet "not set"; a prefilled one says where it came from. */
  const shown = (row: 'legalName' | 'tradingAddress' | 'receiptFooter' | 'vatNumber', empty: string) =>
    form[row].trim() ? (
      <>
        <span className="truncate">{form[row].trim()}</span>
        {row === 'legalName' && suggested('legalName') && <ValueAside>· from your workspace</ValueAside>}
        {row === 'tradingAddress' && suggested('tradingAddress') && <ValueAside>· from your location</ValueAside>}
      </>
    ) : (
      <ValueMissing>{empty}</ValueMissing>
    );
  /** A short text: its value on the row, the field underneath. */
  const textRow = (
    row: 'legalName' | 'tradingAddress' | 'receiptFooter' | 'vatNumber',
    icon: IconComponent,
    label: string,
    empty: string,
    placeholder: string,
    hint?: string,
    maxLength?: number,
  ) => (
    <ChangeRow icon={icon} label={label} value={shown(row, empty)} open={open === row} onToggle={() => toggle(row)}>
      <Input
        aria-label={label}
        value={form[row]}
        onChange={(event) => set(row, event.target.value)}
        placeholder={placeholder}
        maxLength={maxLength}
        hint={hint}
        autoFocus
      />
    </ChangeRow>
  );

  return (
    <SettingsTabBody narrowAside stickyAside aside={<ReceiptPreview form={form} />}>
      {/* Side by side on a wide screen: two short sections of equal weight, the receipt beside them. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <RecordGroup card id="trading-receipts" title="Receipts">
          <div>
            {textRow('legalName', Store, 'Business name', 'Not set', 'North Street Coffee Ltd')}
            {showAddress &&
              textRow(
                'tradingAddress',
                MapPin,
                'Address',
                'Not set',
                '12 North Street, London',
                onlineOnly ? 'Needed on VAT invoices.' : undefined,
              )}
            {textRow('receiptFooter', StickyNote, 'Thank-you line', 'None', 'Thank you — see you soon', undefined, 200)}
          </div>
        </RecordGroup>

        <RecordGroup card id="trading-money-and-vat" title="Money and VAT">
          <div>
            <ChangeRow
              icon={Coins}
              label="Currency"
              value={<span className="truncate">{currencyLabel(form.currency)}</span>}
              open={open === 'currency'}
              onToggle={() => toggle('currency')}
            >
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
            </ChangeRow>
            <ChangeRow
              icon={Landmark}
              label="VAT"
              value={form.vatRegistered ? 'Registered' : <ValueMissing>Not registered</ValueMissing>}
              trailing={<Switch checked={form.vatRegistered} onChange={(next) => set('vatRegistered', next)} label="VAT registered" />}
            />
            {form.vatRegistered && (
              <>
                {textRow('vatNumber', Hash, 'VAT number', 'Not set', 'GB123456789')}
                <ChangeRow
                  icon={Calculator}
                  label="VAT rate"
                  value={rateValid ? `${rate}%` : <ValueMissing>Check the rate</ValueMissing>}
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
                    hint="Used for anything without its own rate, and taken out of your margins."
                    autoFocus
                  />
                </ChangeRow>
                <ChangeRow
                  icon={Tags}
                  label="Menu prices"
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
                </ChangeRow>
              </>
            )}
          </div>
        </RecordGroup>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        disabled={!valid}
        message={
          !valid ? 'Enter a VAT rate between 0 and 100' : onlyPrefilled ? 'Filled in from your workspace — save to use it' : undefined
        }
        onSave={() => save.mutate()}
        onDiscard={() => {
          setForm(saved);
          setOpen(null);
        }}
      />
    </SettingsTabBody>
  );
}

/** The two sections of rows and the receipt beside them, without their words. */
function TradingSkeleton() {
  const rows = (count: number) =>
    Array.from({ length: count }, (_, index) => (
      <div key={index} className="flex items-center gap-3">
        <Bone className="size-10 shrink-0" />
        <span className="min-w-0 flex-1 space-y-1.5">
          <Bone className="h-2.5 w-20" />
          <Bone className="h-3.5 w-44 max-w-full" />
        </span>
        <Bone className="h-8 w-20 shrink-0" />
      </div>
    ));
  return (
    <div role="status" aria-label="Loading trading settings">
      <SettingsTabBody narrowAside aside={<Bone className="mx-auto mt-7 h-[34rem] w-full max-w-xs rounded-md" />}>
        <SectionSkeleton>{rows(3)}</SectionSkeleton>
        <SectionSkeleton>{rows(2)}</SectionSkeleton>
      </SettingsTabBody>
    </div>
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
      <div className="mx-auto max-w-xs rounded-md border border-border bg-white px-5 py-6 font-mono text-xs leading-5 text-neutral-800 shadow-md">
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
