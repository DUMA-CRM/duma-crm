'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { ArrowRight, Calculator, CreditCard, Landmark, Plus, Receipt, Tags } from '@/components/icons';
import { ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar } from '@/components/settings/controls';
import { SectionSkeleton, TilesSkeleton } from '@/components/shared/TileSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import { type TradingSettings, getTradingSettings, getWorkspaceSetup, saveTradingSettings } from '@/lib/modules/organization/client';
import { getPaymentConnections } from '@/lib/modules/payments/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type ReceiptLine, linePence, receiptTotals } from '@/lib/utils/receipt-preview';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const CURRENCIES = [
  { value: 'GBP', label: 'GBP — Pound sterling (£)' },
  { value: 'EUR', label: 'EUR — Euro (€)' },
  { value: 'USD', label: 'USD — US dollar ($)' },
];

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

const same = (a: Form, b: Form) => (Object.keys(a) as (keyof Form)[]).every((key) => a[key] === b[key]);

/** Trading & tax: what every receipt says, and how prices are taxed. Card readers live under Connectors. */
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
    return (
      // The tab body's shape: the form sections, and the receipt preview beside them.
      <div
        role="status"
        aria-busy="true"
        aria-label="Loading trading settings"
        className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)]"
      >
        <div className="flex min-w-0 flex-col gap-5">
          <SectionSkeleton fields={4} />
          <SectionSkeleton fields={3} />
        </div>
        <div className="pt-1" aria-hidden="true">
          <Bone className="mx-auto mb-2 h-2.5 w-24" />
          <Bone className="mx-auto h-96 max-w-xs" />
        </div>
      </div>
    );
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
  const locationId = useWorkspaceStore((state) => state.locationId);
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
  const dirty = !same(form, saved);
  const rate = Number(form.defaultVatRate);
  // The rate only matters once VAT registered; a hidden bad value must not block saving.
  const rateValid = Number.isFinite(rate) && rate >= 0 && rate <= 100;
  const valid = /^[A-Z]{3}$/.test(form.currency) && (!form.vatRegistered || rateValid);
  const money = (value: number) => new Intl.NumberFormat(undefined, { style: 'currency', currency: form.currency }).format(value);
  const example = 3.6;
  const currencyOptions = CURRENCIES.some((option) => option.value === form.currency)
    ? CURRENCIES
    : [...CURRENCIES, { value: form.currency, label: form.currency }];

  const readers = useQuery({
    queryKey: moduleQueryKeys.payments.key('payment-connections', locationId),
    queryFn: () => getPaymentConnections(locationId!),
    enabled: Boolean(locationId),
  });

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

  return (
    <>
      <SettingsTabBody aside={<ReceiptPreview form={form} />} stickyAside>
        <SettingsSection title="On your receipts">
          <div className="grid gap-4">
            <Input
              label="Business name"
              value={form.legalName}
              onChange={(event) => set('legalName', event.target.value)}
              placeholder="North Street Coffee Ltd"
              hint={suggested('legalName') ? 'From your workspace name.' : undefined}
            />
            {showAddress && (
              <Input
                label="Address"
                value={form.tradingAddress}
                onChange={(event) => set('tradingAddress', event.target.value)}
                placeholder="12 North Street, London"
                hint={suggested('tradingAddress') ? 'From your location.' : onlineOnly ? 'Needed on VAT invoices.' : undefined}
              />
            )}
            <Input
              label="Thank-you line"
              value={form.receiptFooter}
              onChange={(event) => set('receiptFooter', event.target.value)}
              placeholder="Thank you — see you soon"
              maxLength={200}
            />
          </div>
        </SettingsSection>

        <SettingsSection title="Money and VAT">
          <div className="max-w-xs">
            <p className="mb-1.5 text-label uppercase text-muted-foreground">Currency</p>
            <Select
              value={form.currency}
              onValueChange={(value) => set('currency', value)}
              options={currencyOptions}
              ariaLabel="Currency"
            />
          </div>

          <p className="mt-6 mb-2 text-sm font-semibold text-foreground">Are you VAT registered?</p>
          <ChoiceGrid<'yes' | 'no'>
            label="VAT registered"
            shortcuts={false}
            selected={[form.vatRegistered ? 'yes' : 'no']}
            onChange={(value) => set('vatRegistered', value === 'yes')}
            choices={[
              { value: 'yes', label: 'Yes', detail: 'VAT shows on receipts and comes out of your margins.', icon: Landmark },
              { value: 'no', label: 'No', detail: 'No VAT is added or shown.', icon: Receipt },
            ]}
          />

          <AnimatePresence initial={false}>
            {form.vatRegistered && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="grid gap-4 pt-5 sm:grid-cols-2">
                  <Input
                    label="VAT number"
                    value={form.vatNumber}
                    onChange={(event) => set('vatNumber', event.target.value)}
                    placeholder="GB123456789"
                  />
                  <Input
                    label="VAT rate (%)"
                    type="number"
                    min={0}
                    max={100}
                    step={0.5}
                    value={form.defaultVatRate}
                    onChange={(event) => set('defaultVatRate', event.target.value)}
                    error={rateValid ? undefined : 'Enter a rate between 0 and 100.'}
                  />
                </div>

                <p className="mt-6 mb-2 text-sm font-semibold text-foreground">How are your menu prices shown?</p>
                <ChoiceGrid<'inc' | 'exc'>
                  label="Menu prices"
                  shortcuts={false}
                  selected={[form.pricesIncludeTax ? 'inc' : 'exc']}
                  onChange={(value) => set('pricesIncludeTax', value === 'inc')}
                  choices={[
                    {
                      value: 'inc',
                      label: 'VAT included',
                      detail: `${money(example)} on the menu — the customer pays ${money(example)}.`,
                      icon: Tags,
                    },
                    {
                      value: 'exc',
                      label: 'VAT added at the till',
                      detail: `${money(example)} on the menu — the customer pays ${money(example * (1 + (rateValid ? rate : 0) / 100))}.`,
                      icon: Calculator,
                    },
                  ]}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </SettingsSection>

        <SettingsSection
          title="Card readers"
          actions={
            <Button asChild variant="outline" size="sm">
              <Link href="/settings/connectors?connector=card-payments">
                Manage <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          }
        >
          {!locationId ? (
            <p className="text-sm text-muted-foreground">Choose a location to see its readers.</p>
          ) : readers.isPending ? (
            <TilesSkeleton count={1} label="Loading readers" tile="size-9" trailing="h-4 w-14" tileClassName="py-2.5" />
          ) : readers.isError ? (
            <p className="text-sm text-muted-foreground">Couldn’t load readers right now.</p>
          ) : (readers.data ?? []).length === 0 ? (
            <Link
              href="/settings/connectors?connector=card-payments&mode=connect"
              className="flex items-center gap-3 rounded-lg border border-dashed border-rule/60 px-3.5 py-3 text-sm text-muted-foreground transition-colors hover:border-rule hover:bg-band/45 hover:text-foreground"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-band">
                <Plus size={18} aria-hidden="true" />
              </span>
              No readers yet — add one to take card payments
            </Link>
          ) : (
            // A glance, not a manager: names and whether each can take money. Changes happen in Connectors.
            <ul className="space-y-2">
              {(readers.data ?? []).slice(0, 3).map((reader) => {
                const active = reader.isActive !== false;
                return (
                  <li key={reader.id} className="flex items-center gap-3 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-2.5">
                    <span
                      className={cn(
                        'flex size-9 shrink-0 items-center justify-center rounded-md',
                        active ? 'bg-primary/8 text-primary' : 'bg-band text-muted-foreground',
                      )}
                    >
                      <CreditCard size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{reader.displayName}</span>
                    <span className={cn('flex items-center gap-1.5 text-xs', active ? 'text-success' : 'text-muted-foreground')}>
                      <span className={cn('size-1.5 rounded-full', active ? 'bg-success' : 'bg-muted-foreground/60')} aria-hidden="true" />
                      {active ? 'Taking payments' : 'Paused'}
                    </span>
                  </li>
                );
              })}
              {(readers.data ?? []).length > 3 && (
                <li className="px-1 text-xs text-muted-foreground">and {(readers.data ?? []).length - 3} more</li>
              )}
            </ul>
          )}
        </SettingsSection>
      </SettingsTabBody>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        disabled={!valid}
        message={onlyPrefilled ? 'Filled in from your workspace — save to use it' : undefined}
        onSave={() => save.mutate()}
        onDiscard={() => setForm(saved)}
      />
    </>
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
