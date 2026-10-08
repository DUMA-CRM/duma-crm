'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { RowTile, SectionInfo } from '@/components/cms/rows';
import { cmsKeys } from '@/components/cms/shared';
import { ChevronDown, Coins, Globe, Languages, Trash2 } from '@/components/icons';
import { CommitInput, catalogKey } from '@/components/menu/VariantsEditor';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { useWorkspaceCurrency } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import {
  deleteCatalogPrices,
  deleteCatalogTranslation,
  getItemCatalog,
  setCatalogPrices,
  setCatalogTranslation,
} from '@/lib/modules/catalog/client';
import { type CmsLocale, getCmsLocales } from '@/lib/modules/cms/client';
import { extraCurrencies, fromPrice, pricedIn, translationProgress } from '@/lib/utils/catalog-i18n';
import { variantNoun } from '@/lib/utils/catalog-import';
import { cn } from '@/lib/utils/cn';
import { CURRENCIES, currencySymbol, formatCurrency } from '@/lib/utils/currencies';
import { toast } from '@/stores/toastStore';
import type { ItemCatalog } from '@/types/catalog';

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;

/**
 * A product for shoppers elsewhere: its text in each of the workspace's
 * languages (Content → Locales), and its prices in other currencies. A
 * language can carry a currency, so a website asking for Ukrainian gets
 * Ukrainian text priced in hryvnia, and English stays in pounds.
 */
export function ProductLanguages({ menuItemId, tenantId }: { menuItemId: string; tenantId: string }) {
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({ queryKey: catalogKey(menuItemId, tenantId), queryFn: () => getItemCatalog(menuItemId, tenantId) });
  const localesQuery = useQuery({ queryKey: cmsKeys.locales(tenantId), queryFn: () => getCmsLocales(tenantId) });
  const base = useWorkspaceCurrency();
  // Currencies picked here but not yet priced — they live on the page until a price is saved.
  const [added, setAdded] = useState<string[]>([]);
  const refresh = () => queryClient.invalidateQueries({ queryKey: catalogKey(menuItemId, tenantId) });

  if (catalogQuery.isPending) return <LoadingState label="Loading languages and prices" />;
  if (catalogQuery.isError) return <ErrorState title="Couldn’t load this product" onRetry={() => void catalogQuery.refetch()} />;
  const catalog = catalogQuery.data;
  const locales = localesQuery.data ?? [];
  const currencies = extraCurrencies(locales, base, catalog.prices, added);

  return (
    <SettingsTabBody narrowAside aside={<ShopperCard catalog={catalog} locales={locales} base={base} />}>
      <LanguagesCard
        catalog={catalog}
        locales={locales}
        state={localesQuery.isPending ? 'loading' : localesQuery.isError ? 'error' : 'ready'}
        onRetry={() => void localesQuery.refetch()}
        menuItemId={menuItemId}
        tenantId={tenantId}
        onChanged={refresh}
      />
      <PricesCard
        catalog={catalog}
        base={base}
        currencies={currencies}
        menuItemId={menuItemId}
        tenantId={tenantId}
        onAdd={(code) => setAdded((list) => [...list, code])}
        onForget={(code) => setAdded((list) => list.filter((entry) => entry !== code))}
        onChanged={refresh}
      />
    </SettingsTabBody>
  );
}

/** The card shell the Sizes tab uses: a header that is the card's own, then the body. */
function Card({
  id,
  title,
  count,
  info,
  children,
  footer,
}: {
  id: string;
  title: string;
  count?: number;
  info: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-lg border border-rule/60 bg-control">
      <header className="flex items-center gap-3 px-4 py-3.5">
        <h2 id={id} className="text-base font-semibold tracking-title text-foreground">
          {title}
        </h2>
        {count !== undefined && count > 0 && (
          <span className="rounded-full bg-band px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">{count}</span>
        )}
        <span className="ml-auto">
          <SectionInfo label={info} />
        </span>
      </header>
      {children}
      {footer && <footer className="border-t border-rule/50 px-4 py-2.5 text-xs text-muted-foreground">{footer}</footer>}
    </section>
  );
}

function EmptyBody({ icon, title, children }: { icon: typeof Globe; title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 border-t border-rule/50 px-6 py-10 text-center">
      <RowTile icon={icon} />
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <div className="mt-1 max-w-sm text-sm text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

// ─── Languages ───────────────────────────────────────────────────────────────

function LanguagesCard({
  catalog,
  locales,
  state,
  onRetry,
  menuItemId,
  tenantId,
  onChanged,
}: {
  catalog: ItemCatalog;
  locales: CmsLocale[];
  state: 'loading' | 'error' | 'ready';
  onRetry: () => void;
  menuItemId: string;
  tenantId: string;
  onChanged: () => void;
}) {
  const others = locales.filter((locale) => !locale.isDefault).sort((a, b) => a.name.localeCompare(b.name));
  const defaultName = locales.find((locale) => locale.isDefault)?.name ?? 'your default language';
  return (
    <Card
      id="product-languages-title"
      title="Languages"
      count={others.length}
      info="The product’s name, description and option names in each language your website speaks. Anything left blank shows in the default language."
      footer={
        state === 'ready' && others.length > 0 ? (
          <>
            Languages are shared with your website content —{' '}
            <Link href="/content?tab=locales" className="font-medium text-foreground underline-offset-2 hover:underline">
              add or remove them in Content
            </Link>
            .
          </>
        ) : undefined
      }
    >
      {state === 'loading' ? (
        <div className="border-t border-rule/50">
          <LoadingState label="Loading languages" />
        </div>
      ) : state === 'error' ? (
        <div className="border-t border-rule/50 p-4">
          <ErrorState title="Couldn’t load your languages" onRetry={onRetry} />
        </div>
      ) : others.length === 0 ? (
        <EmptyBody icon={Languages} title={`Written in ${defaultName} only`}>
          Add a language in{' '}
          <Link href="/content?tab=locales" className="font-medium text-foreground underline-offset-2 hover:underline">
            Content → Locales
          </Link>{' '}
          and it appears here, ready to translate.
        </EmptyBody>
      ) : (
        <div className="space-y-1 border-t border-rule/50 px-4 py-3">
          {others.map((locale) => (
            <LanguageRow
              key={locale.code}
              locale={locale}
              catalog={catalog}
              menuItemId={menuItemId}
              tenantId={tenantId}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function LanguageRow({
  locale,
  catalog,
  menuItemId,
  tenantId,
  onChanged,
}: {
  locale: CmsLocale;
  catalog: ItemCatalog;
  menuItemId: string;
  tenantId: string;
  onChanged: () => void;
}) {
  const words = useCatalogWords();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const progress = translationProgress(catalog, locale.code);
  const saved = catalog.translations.item.find((row) => row.locale === locale.code);
  const label = (id: string) =>
    catalog.translations.options.find((row) => row.locale === locale.code && (row.optionId === id || row.optionValueId === id))?.label ??
    '';

  // The draft starts from what is saved, and starts again whenever that changes.
  const fresh = () => ({
    name: saved?.name ?? '',
    description: saved?.description ?? '',
    labels: Object.fromEntries(
      catalog.options.flatMap((option) => [option.id, ...option.values.map((value) => value.id)]).map((id) => [id, label(id)]),
    ),
  });
  const savedKey = JSON.stringify(fresh());
  const [draft, setDraft] = useState(fresh);
  const [seen, setSeen] = useState(savedKey);
  if (savedKey !== seen) {
    setSeen(savedKey);
    setDraft(fresh());
  }
  const dirty = JSON.stringify(draft) !== savedKey;

  const save = useMutation({
    mutationFn: () =>
      setCatalogTranslation(
        menuItemId,
        locale.code,
        {
          name: draft.name,
          description: draft.description,
          options: Object.fromEntries(catalog.options.map((option) => [option.id, draft.labels[option.id] ?? ''])),
          values: Object.fromEntries(
            catalog.options.flatMap((option) => option.values.map((value) => [value.id, draft.labels[value.id] ?? ''])),
          ),
        },
        tenantId,
      ),
    onSuccess: () => {
      onChanged();
      toast('success', `${locale.name} saved.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteCatalogTranslation(menuItemId, locale.code, tenantId),
    onSuccess: () => {
      setConfirming(false);
      onChanged();
      toast('success', `${locale.name} removed from this ${words.item}.`);
    },
    onError: (error) => {
      setConfirming(false);
      toast('error', error.message);
    },
  });

  const status =
    progress.done === 0 ? 'Not translated' : progress.done === progress.of ? 'Translated' : `${progress.done} of ${progress.of} done`;

  return (
    <div className={cn('-mx-2 rounded-lg transition-colors', open && 'bg-band/30')}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background font-mono text-xs font-semibold uppercase text-muted-foreground"
          aria-hidden="true"
        >
          {locale.code.split('-')[0]}
        </span>
        <span className="shrink-0 text-sm font-semibold text-foreground">{locale.name}</span>
        <span className="min-w-0 flex-1 truncate text-right text-sm text-muted-foreground">
          {saved?.name ? <span className="text-foreground">{saved.name}</span> : null}
          {saved?.name ? ' · ' : null}
          <span className={cn(progress.done === progress.of && 'text-momentum')}>{status}</span>
        </span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <form
          className="space-y-4 px-2 pb-3 pt-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (dirty) save.mutate();
          }}
        >
          <Input
            label="Name"
            lang={locale.code}
            placeholder={catalog.item.name}
            value={draft.name}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-label uppercase text-muted-foreground">Description</span>
            <textarea
              lang={locale.code}
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              rows={3}
              placeholder={catalog.item.description ?? words.descriptionPlaceholder}
              aria-label={`Description in ${locale.name}`}
              className="w-full resize-none rounded-md border border-input bg-control px-3 py-2 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured sm:text-sm"
            />
          </div>

          {catalog.options.length > 0 && (
            <div className="space-y-2">
              <span className="text-label uppercase text-muted-foreground">Options</span>
              {catalog.options.map((option) => (
                <div key={option.id} className="space-y-1.5 rounded-md border border-rule/50 bg-background/60 p-2.5">
                  <LabelField
                    original={option.name}
                    strong
                    locale={locale}
                    value={draft.labels[option.id] ?? ''}
                    onChange={(value) => setDraft({ ...draft, labels: { ...draft.labels, [option.id]: value } })}
                  />
                  {option.values.map((value) => (
                    <LabelField
                      key={value.id}
                      original={value.label}
                      locale={locale}
                      value={draft.labels[value.id] ?? ''}
                      onChange={(next) => setDraft({ ...draft, labels: { ...draft.labels, [value.id]: next } })}
                    />
                  ))}
                </div>
              ))}
              <p className="text-xs text-muted-foreground">Sizes like S, M and L usually stay as they are — leave them blank.</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={!dirty || save.isPending}>
              {save.isPending ? 'Saving…' : `Save ${locale.name}`}
            </Button>
            {dirty && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(fresh())}>
                Discard
              </Button>
            )}
            {progress.done > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="ml-auto text-muted-foreground hover:text-exception"
                onClick={() => setConfirming(true)}
              >
                <Trash2 aria-hidden="true" />
                Remove {locale.name}
              </Button>
            )}
          </div>
        </form>
      )}

      {confirming && (
        <ConfirmModal
          title={`Remove the ${locale.name} text?`}
          message={`Shoppers reading ${locale.name} will see this ${words.item} in the default language. The language itself stays.`}
          confirmLabel="Remove"
          pendingLabel="Removing…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

/** "Size → [ Розмір ]": the default text on the left, its translation on the right. */
function LabelField({
  original,
  strong,
  locale,
  value,
  onChange,
}: {
  original: string;
  strong?: boolean;
  locale: CmsLocale;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)] items-center gap-3">
      <span className={cn('truncate text-sm', strong ? 'font-semibold text-foreground' : 'pl-3 text-muted-foreground')}>{original}</span>
      <input
        lang={locale.code}
        value={value}
        placeholder={original}
        aria-label={`${original} in ${locale.name}`}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-full rounded-sm border border-rule/50 bg-control px-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-measured focus:outline-none"
      />
    </label>
  );
}

// ─── Prices ──────────────────────────────────────────────────────────────────

function PricesCard({
  catalog,
  base,
  currencies,
  menuItemId,
  tenantId,
  onAdd,
  onForget,
  onChanged,
}: {
  catalog: ItemCatalog;
  base: string;
  currencies: string[];
  menuItemId: string;
  tenantId: string;
  onAdd: (code: string) => void;
  onForget: (code: string) => void;
  onChanged: () => void;
}) {
  const words = useCatalogWords();
  const noun = variantNoun(catalog.options);
  const [removing, setRemoving] = useState<string | null>(null);
  const set = useMutation({
    mutationFn: ({ currency, variantId, price }: { currency: string; variantId: string | null; price: string | null }) =>
      setCatalogPrices(menuItemId, currency, variantId ? { variants: { [variantId]: { price } } } : { price }, tenantId),
    onSuccess: onChanged,
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: (currency: string) => deleteCatalogPrices(menuItemId, currency, tenantId),
    onSuccess: (_, currency) => {
      setRemoving(null);
      onForget(currency);
      onChanged();
      toast('success', `${currency} prices removed.`);
    },
    onError: (error) => {
      setRemoving(null);
      toast('error', error.message);
    },
  });
  const priceOf = (currency: string, variantId: string | null) =>
    catalog.prices.find((row) => row.currency === currency && row.variantId === variantId)?.price ?? '';
  const choices = CURRENCIES.filter((entry) => entry.code !== base && !currencies.includes(entry.code));
  const hasSizes = catalog.variants.length > 0;
  const rows: Array<{ id: string | null; name: string; basePrice: string | null }> = [
    { id: null, name: hasSizes ? `Every ${noun.one}` : words.Item, basePrice: catalog.item.price },
    ...catalog.variants.map((variant) => ({ id: variant.id, name: variant.name, basePrice: variant.price ?? catalog.item.price })),
  ];

  const addCurrency = (
    <Select
      ariaLabel="Add a currency"
      className="h-8 w-52 text-xs"
      value=""
      onValueChange={(code) => code && onAdd(code)}
      options={[
        { value: '', label: 'Add a currency…' },
        ...choices.map((entry) => ({ value: entry.code, label: `${entry.code} — ${entry.name}` })),
      ]}
    />
  );

  return (
    <Card
      id="product-prices-title"
      title="Prices in other currencies"
      count={currencies.length}
      info={`What this ${words.item} costs where you sell in another currency. Each is its own price, not a conversion — round it the way shoppers there expect.`}
      footer={
        currencies.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {hasSizes ? `A blank ${noun.one} uses the price in the first row. ` : ''}A currency sells only once
              {hasSizes ? ` every ${noun.one}` : ' it'} has a price.
            </span>
            {choices.length > 0 && addCurrency}
          </div>
        ) : undefined
      }
    >
      {currencies.length === 0 ? (
        <EmptyBody icon={Coins} title={`Sold in ${base} only`}>
          <p>Give a language its own currency in Content → Locales, or add one here.</p>
          <div className="mt-3 flex justify-center">{addCurrency}</div>
        </EmptyBody>
      ) : (
        <div className="overflow-x-auto border-t border-rule/50">
          <table className="w-full text-sm" style={{ minWidth: `${16 + currencies.length * 9}rem` }}>
            <thead>
              <tr className="border-b border-rule/50 bg-band/30 text-left text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                <th className="px-4 py-2">{hasSizes ? noun.column : words.Item}</th>
                <th className="w-28 px-2 py-2">{base}</th>
                {currencies.map((currency) => {
                  const { priced, of } = pricedIn(catalog, currency);
                  const hasPrices = catalog.prices.some((row) => row.currency === currency);
                  return (
                    <th key={currency} className="w-36 px-2 py-2">
                      <span className="flex items-center gap-1.5">
                        <span>{currency}</span>
                        <span className={cn('font-normal normal-case tracking-normal', priced === of ? 'text-momentum' : 'text-measured')}>
                          {priced === of ? 'ready' : `${priced}/${of}`}
                        </span>
                        <Tooltip side="top" align="end" label={`Remove ${currency}`}>
                          <button
                            type="button"
                            aria-label={`Remove ${currency} prices`}
                            onClick={() => (hasPrices ? setRemoving(currency) : onForget(currency))}
                            className="ml-auto flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-band hover:text-exception"
                          >
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        </Tooltip>
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule/40">
              {rows.map((row) => (
                <tr key={row.id ?? 'product'} className={cn(row.id === null && hasSizes && 'bg-band/15')}>
                  <td className={cn('px-4 py-1.5', row.id === null ? 'font-semibold text-foreground' : 'text-foreground')}>{row.name}</td>
                  <td className="px-2 py-1.5 tabular-nums text-muted-foreground">
                    {row.basePrice ? formatCurrency(row.basePrice, base) : '—'}
                  </td>
                  {currencies.map((currency) => (
                    <td key={currency} className="px-2 py-1">
                      <CommitInput
                        label={`${row.name} in ${currency}`}
                        value={priceOf(currency, row.id)}
                        prefix={currencySymbol(currency)}
                        inputMode="decimal"
                        placeholder={row.id ? priceOf(currency, null) || '—' : '—'}
                        validate={(value) => value === '' || MONEY.test(value)}
                        className="tabular-nums"
                        onCommit={(value) => set.mutate({ currency, variantId: row.id, price: value || null })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {removing && (
        <ConfirmModal
          title={`Remove the ${removing} prices?`}
          message={`This ${words.item} can’t be bought in ${removing} until it has prices again. Other products keep theirs.`}
          confirmLabel="Remove"
          pendingLabel="Removing…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </Card>
  );
}

// ─── What a shopper sees ─────────────────────────────────────────────────────

function ShopperCard({ catalog, locales, base }: { catalog: ItemCatalog; locales: CmsLocale[]; base: string }) {
  const sorted = [...locales].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || a.name.localeCompare(b.name));
  const basePrices =
    catalog.variants.length > 0
      ? catalog.variants.map((variant) => Number(variant.price ?? catalog.item.price))
      : [Number(catalog.item.price)];
  const baseFrom = Math.min(...basePrices);
  return (
    <SettingsSection
      title="What shoppers see"
      footnote={
        <>
          Your website asks with <span className="font-mono">?locale=</span> — see Settings → Developers.
        </>
      }
    >
      {sorted.length === 0 ? (
        <p className="text-sm text-muted-foreground">One language, priced in {base}.</p>
      ) : (
        <ul className="space-y-3">
          {sorted.map((locale) => {
            const currency = locale.currency && locale.currency !== base ? locale.currency : base;
            const abroad = currency !== base ? fromPrice(catalog, currency) : null;
            const name = locale.isDefault
              ? catalog.item.name
              : (catalog.translations.item.find((row) => row.locale === locale.code)?.name ?? null);
            const missingPrice = currency !== base && abroad === null;
            return (
              <li key={locale.code} className="flex items-center gap-3">
                <RowTile icon={Globe} tone={missingPrice ? 'warning' : 'default'} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{locale.name}</p>
                  <p className={cn('truncate text-xs', name ? 'text-muted-foreground' : 'text-muted-foreground/70')} lang={locale.code}>
                    {name ?? `${catalog.item.name} (not translated)`}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-foreground">
                    {catalog.variants.length > 0 ? 'from ' : ''}
                    {abroad !== null ? formatCurrency(abroad, currency) : formatCurrency(baseFrom, base)}
                  </p>
                  {missingPrice && <p className="text-xs text-measured">No {currency} price yet</p>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SettingsSection>
  );
}
