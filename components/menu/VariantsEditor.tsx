'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { ActionRow, ActionRows, InfoRow, InfoRows, RowTile, SectionInfo } from '@/components/cms/rows';
import { AlertTriangle, Boxes, ChevronDown, EyeOff, Layers, MapPin, Package, Palette, Plus, Tag, Trash2, X } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { useCurrencySymbol, useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { getLocationsByTenant } from '@/lib/api/workspace.service';
import {
  deleteCatalogOption,
  deleteCatalogOptionValue,
  deleteCatalogVariant,
  generateCatalogVariants,
  getItemCatalog,
  setCatalogVariantStock,
  updateCatalogVariant,
} from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type GridOption, OPTION_PRESETS, gridSize, missingCombinations, optionPlaceholder, variantNoun } from '@/lib/utils/catalog-import';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import type { CatalogOption, CatalogVariant } from '@/types/catalog';

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;

/** The product's catalogue — options, variants, photos — under one key, so every edit refreshes all three. */
export const catalogKey = (menuItemId: string, tenantId: string) => moduleQueryKeys.catalog.key('item-catalog', tenantId, menuItemId);

/** An option's tile: a size, a colour, or anything else. */
const optionIcon = (name: string): IconComponent =>
  /^colou?rs?$/i.test(name.trim()) ? Palette : /^sizes?$/i.test(name.trim()) ? Layers : Tag;

/**
 * A product's sizes: options in, the grid of variants out — each with its own
 * SKU, price and stock where it sells. Built for a shop that knows its sizes:
 * "S M L XL × Black White" is one line each, then one button. Every word
 * follows the options: a product sold by Colour talks about colours.
 */
export function VariantsEditor({
  menuItemId,
  productName,
  productPrice,
  tenantId,
}: {
  menuItemId: string;
  productName: string;
  productPrice: string;
  tenantId: string;
}) {
  const queryClient = useQueryClient();
  const catalogQuery = useQuery({ queryKey: catalogKey(menuItemId, tenantId), queryFn: () => getItemCatalog(menuItemId, tenantId) });
  const locationsQuery = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId),
  });
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const [chosenLocation, setLocationId] = useState('');
  // The first location until someone picks another.
  const locationId = chosenLocation || locations[0]?.id || '';
  const refresh = () => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('item-catalog', tenantId, menuItemId) });
  const symbol = useCurrencySymbol();
  const formatMoney = useFormatMoney();

  if (catalogQuery.isPending) return <LoadingState label="Loading sizes and stock" />;
  if (catalogQuery.isError) return <ErrorState title="Couldn’t load this product’s sizes" onRetry={() => void catalogQuery.refetch()} />;
  const catalog = catalogQuery.data;
  const noun = variantNoun(catalog.options);
  const variants = catalog.variants;
  const tracked = variants.filter((variant) => variant.stock);
  const onHand = tracked.reduce((sum, variant) => sum + (variant.stock?.find((row) => row.locationId === locationId)?.quantity ?? 0), 0);
  const soldOut = tracked.filter((variant) => (variant.stock?.find((row) => row.locationId === locationId)?.quantity ?? 0) === 0).length;
  const locationName = locations.find((location) => location.id === locationId)?.name;

  const notTracked = variants.length - tracked.length;

  return (
    <SettingsTabBody
      narrowAside
      aside={
        <>
          <OptionsCard
            key={catalog.options.map((option) => `${option.id}:${option.values.length}`).join(',')}
            menuItemId={menuItemId}
            productName={productName}
            tenantId={tenantId}
            initial={catalog.options.map((option) => ({ name: option.name, values: option.values.map((value) => value.label) }))}
            stored={catalog.options}
            variants={variants}
            existing={variants.map((variant) =>
              Object.fromEntries(variant.values.map((value) => [optionName(catalog, value.optionValue.optionId), value.optionValue.label])),
            )}
            onGenerated={refresh}
          />
          {variants.length > 0 && (
            <SettingsSection title="Stock">
              <InfoRows>
                {locations.length > 1 && (
                  <InfoRow icon={MapPin} title="Where">
                    <Select
                      ariaLabel="Stock at"
                      className="w-40"
                      value={locationId}
                      onValueChange={setLocationId}
                      options={locations.map((location) => ({ value: location.id, label: location.name }))}
                    />
                  </InfoRow>
                )}
                <InfoRow icon={Boxes} title="In stock">
                  <span className="text-sm font-semibold tabular-nums text-foreground">{tracked.length > 0 ? onHand : '—'}</span>
                </InfoRow>
                <InfoRow icon={AlertTriangle} title="Sold out">
                  <span className={cn('text-sm tabular-nums', soldOut > 0 ? 'font-semibold text-exception' : 'text-muted-foreground')}>
                    {soldOut > 0 ? `${soldOut} ${soldOut === 1 ? noun.one : noun.many}` : 'None'}
                  </span>
                </InfoRow>
                {notTracked > 0 && (
                  <InfoRow icon={EyeOff} title="Not tracked">
                    <Tooltip side="top" align="end" wrap label="Type a count in its In stock cell to start tracking it.">
                      <span className="text-sm tabular-nums text-muted-foreground">{notTracked}</span>
                    </Tooltip>
                  </InfoRow>
                )}
              </InfoRows>
            </SettingsSection>
          )}
        </>
      }
    >
      {/* One card, no section around it: the header is the card's own. */}
      <section aria-labelledby="variants-title" className="overflow-hidden rounded-lg border border-rule/60 bg-control">
        <header className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3.5">
          <h2 id="variants-title" className="text-base font-semibold tracking-title text-foreground">
            {noun.many.charAt(0).toUpperCase() + noun.many.slice(1)}
          </h2>
          {variants.length > 0 && (
            <span className="rounded-full bg-band px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
              {variants.length}
            </span>
          )}
          <span className="ml-auto flex items-center gap-3 text-sm">
            {tracked.length > 0 && (
              <span className="text-muted-foreground">
                <span className="font-semibold tabular-nums text-foreground">{onHand}</span> in stock
                {locationName && locations.length > 1 ? ` at ${locationName}` : ''}
              </span>
            )}
            {soldOut > 0 && (
              <span className="inline-flex items-center gap-1.5 font-medium text-exception">
                <span className="size-1.5 rounded-full bg-exception" aria-hidden="true" />
                {soldOut} sold out
              </span>
            )}
            <SectionInfo label="Each is sold and stocked on its own. A blank price uses the product’s; a “was” price shows it on sale." />
          </span>
        </header>

        {variants.length === 0 ? (
          <div className="flex flex-col items-center gap-3 border-t border-rule/50 px-6 py-12 text-center">
            <RowTile icon={Layers} />
            <div>
              <p className="text-sm font-semibold text-foreground">Sold as one item</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                Add an option on the right — a size, a colour — and each combination gets its own SKU, price and stock.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto border-t border-rule/50">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-rule/50 bg-band/30 text-left text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                    <th className="px-4 py-2">{noun.column}</th>
                    <th className="px-2 py-2">SKU</th>
                    <th className="w-28 px-2 py-2">Price</th>
                    <th className="w-28 px-2 py-2">Was</th>
                    <th className="w-28 px-2 py-2">In stock</th>
                    <th className="w-20 px-2 py-2 text-center">On sale</th>
                    <th className="w-12 px-2 py-2" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-rule/40">
                  {variants.map((variant) => (
                    <VariantRow
                      key={variant.id}
                      variant={variant}
                      noun={noun.one}
                      symbol={symbol}
                      productPrice={productPrice}
                      locationId={locationId}
                      tenantId={tenantId}
                      onChanged={refresh}
                    />
                  ))}
                </tbody>
              </table>
            </div>
            <footer className="border-t border-rule/50 px-4 py-2.5 text-xs text-muted-foreground">
              A blank price uses {productPrice ? formatMoney(Number(productPrice), 2) : 'the product’s'}. Click any cell to change it — it
              saves when you leave it.
            </footer>
          </>
        )}
      </section>
    </SettingsTabBody>
  );
}

const optionName = (catalog: { options: Array<{ id: string; name: string }> }, optionId: string) =>
  catalog.options.find((option) => option.id === optionId)?.name ?? '';

// ─── Options → grid ──────────────────────────────────────────────────────────

function OptionsCard({
  menuItemId,
  productName,
  tenantId,
  initial,
  stored,
  variants,
  existing,
  onGenerated,
}: {
  menuItemId: string;
  productName: string;
  tenantId: string;
  initial: GridOption[];
  /** The saved options with their ids, for deleting an option or one of its values. */
  stored: CatalogOption[];
  variants: CatalogVariant[];
  existing: Array<Record<string, string>>;
  onGenerated: () => void;
}) {
  /** How many variants use any of these option values — what a delete would take with it. */
  const usedBy = (valueIds: readonly string[]) =>
    variants.filter((variant) => variant.values.some((value) => valueIds.includes(value.optionValueId))).length;
  const [options, setOptions] = useState<GridOption[]>(initial);
  const [trackStock, setTrackStock] = useState(true);
  const total = gridSize(options);
  const missing = missingCombinations(options, existing);
  const noun = variantNoun(options);

  const generate = useMutation({
    mutationFn: () =>
      generateCatalogVariants(
        menuItemId,
        {
          options: options
            .filter((option) => option.name.trim() && option.values.length > 0)
            .map((option) => ({ name: option.name.trim(), values: option.values })),
          trackStock,
          skuPrefix: productName,
        },
        tenantId,
      ),
    onSuccess: (result) => {
      onGenerated();
      toast('success', `Added ${result.created} ${result.created === 1 ? noun.one : noun.many}.`);
    },
    onError: (error) => toast('error', error.message),
  });

  const update = (index: number, next: GridOption) => setOptions((current) => current.map((option, i) => (i === index ? next : option)));
  const usedNames = new Set(options.map((option) => option.name.trim().toLowerCase()));
  const presets = options.length < 3 ? OPTION_PRESETS.filter((preset) => !usedNames.has(preset.option.name.toLowerCase())) : [];

  return (
    <SettingsSection
      title="Options"
      actions={
        <SectionInfo label="What a shopper chooses — Size, Colour, Fit. Each combination becomes its own SKU, with its own price and stock." />
      }
    >
      <div className="space-y-5">
        {/* The options and "Add another" read as one list — no gap between them. */}
        <div className="space-y-1">
          {options.map((option, index) => (
            <OptionRow
              key={index}
              option={option}
              saved={initial[index]}
              stored={stored[index]}
              usedBy={usedBy}
              tenantId={tenantId}
              onDeleted={onGenerated}
              onChange={(next) => update(index, next)}
              onRemove={index >= initial.length ? () => setOptions((current) => current.filter((_, i) => i !== index)) : undefined}
            />
          ))}

          {options.length < 3 && (
            <div className="space-y-2">
              <ActionRows>
                <ActionRow
                  icon={Plus}
                  label={options.length === 0 ? 'Add an option' : 'Add another option'}
                  onClick={() => setOptions((current) => [...current, { name: '', values: [] }])}
                />
              </ActionRows>
              {presets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pl-11">
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => setOptions((current) => [...current, { ...preset.option, values: [...preset.option.values] }])}
                      className="rounded-md border border-rule/60 bg-control px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-rule hover:text-foreground"
                    >
                      {preset.option.name} · {preset.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {total > 0 && (
          // The result of the options above, and the one action that makes it.
          <div className="space-y-3 border-t border-rule/50 pt-4">
            <InfoRows>
              <InfoRow icon={Boxes} title="Makes">
                <span className="text-sm tabular-nums text-muted-foreground">
                  <span className="font-semibold text-foreground">{total}</span> {total === 1 ? noun.one : noun.many}
                  {missing < total && (
                    <>
                      {' · '}
                      <span className="font-semibold text-primary">{missing}</span> new
                    </>
                  )}
                </span>
              </InfoRow>
              <InfoRow icon={Package} title="Track stock">
                <Switch checked={trackStock} onChange={setTrackStock} label="Track stock for each" />
              </InfoRow>
            </InfoRows>
            <Button
              className="w-full gap-1.5"
              disabled={missing === 0 || total > 200 || generate.isPending}
              onClick={() => generate.mutate()}
            >
              <Plus size={14} aria-hidden="true" />
              {generate.isPending
                ? 'Adding…'
                : missing === 0
                  ? `All ${noun.many} added`
                  : `Add ${missing} ${missing === 1 ? noun.one : noun.many}`}
            </Button>
            {total > 200 && (
              <p className="text-xs text-exception">
                That’s {total} {noun.many} — the most is 200. Split it into separate products.
              </p>
            )}
          </div>
        )}
      </div>
    </SettingsSection>
  );
}

function OptionRow({
  option,
  saved,
  stored,
  usedBy,
  tenantId,
  onDeleted,
  onChange,
  onRemove,
}: {
  option: GridOption;
  /** The option as stored; its saved values are deleted through `stored`, not by editing the list. */
  saved?: GridOption;
  stored?: CatalogOption;
  usedBy: (valueIds: readonly string[]) => number;
  tenantId: string;
  onDeleted: () => void;
  onChange: (next: GridOption) => void;
  onRemove?: () => void;
}) {
  // A delete waiting for "yes": the whole option, or one saved value.
  const [confirming, setConfirming] = useState<null | { kind: 'option' } | { kind: 'value'; id: string; label: string }>(null);
  const remove = useMutation({
    mutationFn: (target: NonNullable<typeof confirming>) =>
      target.kind === 'option' ? deleteCatalogOption(stored!.id, tenantId) : deleteCatalogOptionValue(target.id, tenantId),
    onSuccess: (result, target) => {
      setConfirming(null);
      onDeleted();
      const what = target.kind === 'option' ? option.name : target.label;
      toast(
        'success',
        result.variantsRemoved > 0 ? `${what} removed, with ${result.variantsRemoved} of its variants.` : `${what} removed.`,
      );
    },
    onError: (error) => toast('error', error.message),
  });
  const valueId = (label: string) => stored?.values.find((value) => value.label.toLowerCase() === label.toLowerCase())?.id;
  const confirmCount = confirming
    ? confirming.kind === 'option'
      ? usedBy((stored?.values ?? []).map((value) => value.id))
      : usedBy([confirming.id])
    : 0;
  const [draft, setDraft] = useState('');
  // One line until it is opened, like the detail rows elsewhere; a brand-new option opens ready to type.
  const [open, setOpen] = useState(!saved);
  const savedValues = new Set((saved?.values ?? []).map((value) => value.toLowerCase()));
  const add = (raw: string) => {
    const incoming = raw
      .split(/[,\n]/)
      .map((value) => value.trim())
      .filter(Boolean);
    const have = new Set(option.values.map((value) => value.toLowerCase()));
    const fresh = incoming.filter((value) => !have.has(value.toLowerCase()) && have.add(value.toLowerCase()));
    if (fresh.length > 0) onChange({ ...option, values: [...option.values, ...fresh] });
    setDraft('');
  };
  const removable = (value: string) => !savedValues.has(value.toLowerCase());
  const added = option.values.filter(removable).length;
  const summary = option.values.length > 0 ? option.values.join(' · ') : 'No values yet';

  return (
    <div className={cn('-mx-2 rounded-lg transition-colors', open && 'bg-band/30')}>
      {/* The line: tile, name, its values in brief, a chevron. */}
      <div className="flex items-center gap-3 px-2 py-1.5">
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-ring"
        >
          <RowTile icon={optionIcon(option.name)} />
          {/* Name on the left, its values on the right — one line, like the detail rows. */}
          <span className="shrink-0 text-sm font-semibold text-foreground">{option.name.trim() || 'New option'}</span>
          <span
            className={cn(
              'min-w-0 flex-1 truncate text-right text-sm',
              option.values.length > 0 ? 'text-muted-foreground' : 'text-muted-foreground/70',
            )}
          >
            {summary}
          </span>
          {added > 0 && (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[0.6875rem] font-semibold text-primary">+{added}</span>
          )}
          <ChevronDown
            size={14}
            className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </button>
        {onRemove && (
          <Tooltip side="top" align="end" label="Remove option">
            <button
              type="button"
              aria-label="Remove option"
              onClick={onRemove}
              className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-band hover:text-foreground"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </Tooltip>
        )}
      </div>

      {open && (
        <div className="space-y-2 px-2 pb-3 pt-1 pl-13">
          {!saved && (
            <input
              aria-label="Option name"
              value={option.name}
              placeholder="Name it — Size, Colour, Fit…"
              autoFocus={!option.name}
              onChange={(event) => onChange({ ...option, name: event.target.value })}
              className="h-8 w-full rounded-md border border-rule bg-control px-2.5 text-sm font-semibold text-foreground placeholder:font-normal placeholder:text-muted-foreground/70 focus:border-measured focus:outline-none"
            />
          )}
          {/* Its values: stored ones fixed, new ones tinted and removable, then a field to add more. */}
          <div className="flex flex-wrap items-center gap-1.5">
            {option.values.map((value) => (
              <span
                key={value}
                className={cn(
                  'inline-flex h-7 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold',
                  removable(value) ? 'border-primary/35 bg-primary/8 text-foreground' : 'border-rule/60 bg-control text-foreground',
                )}
              >
                {value}
                {removable(value) ? (
                  <button
                    type="button"
                    aria-label={`Remove ${value}`}
                    className="-mr-1 flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                    onClick={() => onChange({ ...option, values: option.values.filter((existing) => existing !== value) })}
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                ) : (
                  valueId(value) && (
                    <button
                      type="button"
                      aria-label={`Delete ${value}`}
                      className="-mr-1 flex size-4 items-center justify-center rounded-sm text-muted-foreground hover:text-exception"
                      onClick={() => setConfirming({ kind: 'value', id: valueId(value)!, label: value })}
                    >
                      <X size={11} aria-hidden="true" />
                    </button>
                  )
                )}
              </span>
            ))}
            <input
              aria-label={`Add a ${option.name.trim().toLowerCase() || 'value'}`}
              autoFocus={Boolean(saved)}
              className="h-7 min-w-32 flex-1 rounded-md border border-dashed border-rule/80 bg-control px-2.5 text-xs text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-solid focus:border-measured"
              placeholder={optionPlaceholder(option.name, option.values.length > 0)}
              value={draft}
              onChange={(event) => {
                if (event.target.value.includes(',')) add(event.target.value);
                else setDraft(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  add(draft);
                } else if (event.key === 'Escape') {
                  setDraft('');
                  setOpen(false);
                } else if (event.key === 'Backspace' && !draft && option.values.length > 0 && removable(option.values.at(-1)!)) {
                  onChange({ ...option, values: option.values.slice(0, -1) });
                }
              }}
              onBlur={() => draft && add(draft)}
            />
          </div>
          {stored && (
            // Deleting the whole option is the last thing in it, apart from the editing above.
            <div className="flex items-center justify-between gap-3 border-t border-rule/50 pt-2.5">
              <p className="text-xs text-muted-foreground">Deleting a saved value also deletes the variants that use it.</p>
              <button
                type="button"
                onClick={() => setConfirming({ kind: 'option' })}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-exception transition-colors hover:bg-exception/8"
              >
                Delete {option.name}
              </button>
            </div>
          )}
        </div>
      )}
      {confirming && (
        <ConfirmModal
          title={confirming.kind === 'option' ? `Delete ${option.name}?` : `Delete ${confirming.label}?`}
          message={
            confirmCount > 0
              ? `This also deletes ${confirmCount} ${confirmCount === 1 ? 'variant' : 'variants'} made from it, with their stock counts. Past orders keep their lines.`
              : 'No variant uses it yet.'
          }
          confirmLabel="Delete"
          pendingLabel="Deleting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(confirming)}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

// ─── One variant ─────────────────────────────────────────────────────────────

function VariantRow({
  variant,
  noun,
  symbol,
  productPrice,
  locationId,
  tenantId,
  onChanged,
}: {
  variant: CatalogVariant;
  /** "size", "variant"… */
  noun: string;
  /** The workspace currency's sign. */
  symbol: string;
  productPrice: string;
  locationId: string;
  tenantId: string;
  onChanged: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const save = useMutation({
    mutationFn: (data: Parameters<typeof updateCatalogVariant>[1]) => updateCatalogVariant(variant.id, data, tenantId),
    onSuccess: onChanged,
    onError: (error) => toast('error', error.message),
  });
  const stock = useMutation({
    mutationFn: (quantity: number) => setCatalogVariantStock(variant.id, { locationId, quantity }, tenantId),
    onSuccess: onChanged,
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: () => deleteCatalogVariant(variant.id, tenantId),
    onSuccess: () => {
      setDeleting(false);
      onChanged();
      toast('success', `${variant.name} removed.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const onHand = variant.stock ? (variant.stock.find((row) => row.locationId === locationId)?.quantity ?? 0) : null;

  const low = onHand !== null && onHand > 0 && onHand <= 3;

  return (
    <tr className={cn('group transition-colors hover:bg-band/25', !variant.isActive && 'opacity-55')}>
      <td className="px-4 py-2">
        <span className="flex flex-wrap items-center gap-1">
          {variant.values.length > 0 ? (
            variant.values.map((value) => (
              <span
                key={value.optionValueId}
                className="rounded-md border border-rule/55 bg-background px-2 py-0.5 text-xs font-semibold text-foreground"
              >
                {value.optionValue.label}
              </span>
            ))
          ) : (
            <span className="text-sm font-semibold text-foreground">{variant.name}</span>
          )}
          {!variant.isActive && <span className="ml-1 text-xs text-muted-foreground">Hidden</span>}
        </span>
      </td>
      <td className="px-2 py-2">
        <CommitInput
          label={`${variant.name} SKU`}
          className="font-mono text-xs text-muted-foreground focus:text-foreground"
          value={variant.sku}
          onCommit={(sku) => sku && save.mutate({ sku })}
        />
      </td>
      <td className="px-2 py-2">
        <CommitInput
          label={`${variant.name} price`}
          value={variant.price ?? ''}
          placeholder={productPrice}
          inputMode="decimal"
          prefix={symbol}
          className="font-medium tabular-nums"
          validate={(value) => !value || MONEY.test(value)}
          onCommit={(price) => save.mutate({ price: price || null })}
        />
      </td>
      <td className="px-2 py-2">
        <CommitInput
          label={`${variant.name} was price`}
          value={variant.compareAtPrice ?? ''}
          placeholder="—"
          inputMode="decimal"
          prefix={symbol}
          className="tabular-nums text-muted-foreground line-through decoration-muted-foreground/50 focus:no-underline"
          validate={(value) => !value || MONEY.test(value)}
          onCommit={(compareAtPrice) => save.mutate({ compareAtPrice: compareAtPrice || null })}
        />
      </td>
      <td className="px-2 py-2">
        {locationId ? (
          <span className="flex items-center gap-1.5">
            {/* Stock as a status: a dot that says sold out, running low or fine, then the count. */}
            <span
              aria-hidden="true"
              className={cn(
                'size-2 shrink-0 rounded-full',
                onHand === null ? 'bg-rule' : onHand === 0 ? 'bg-exception' : low ? 'bg-measured' : 'bg-momentum',
              )}
            />
            <CommitInput
              label={`${variant.name} in stock`}
              value={onHand === null ? '' : String(onHand)}
              placeholder={onHand === null ? 'Track' : '0'}
              inputMode="numeric"
              className={cn(
                'tabular-nums',
                onHand === 0 ? 'font-semibold text-exception' : low ? 'font-semibold text-measured' : 'font-medium',
              )}
              validate={(value) => value === '' || /^\d{1,7}$/.test(value)}
              onCommit={(value) => value !== '' && stock.mutate(Number(value))}
            />
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Add a location</span>
        )}
      </td>
      <td className="px-2 py-2">
        <div className="flex justify-center">
          <Switch checked={variant.isActive} onChange={(isActive) => save.mutate({ isActive })} label={`${variant.name} on sale`} />
        </div>
      </td>
      <td className="px-2 py-2 text-right">
        <Tooltip side="top" align="end" label={`Remove ${noun}`}>
          <Button
            size="icon-sm"
            variant="ghost"
            className="text-muted-foreground hover:bg-exception/8 hover:text-exception"
            aria-label={`Remove ${variant.name}`}
            onClick={() => setDeleting(true)}
          >
            <Trash2 size={14} aria-hidden="true" />
          </Button>
        </Tooltip>
        {deleting && (
          <ConfirmModal
            title={`Remove ${variant.name}?`}
            message="Past orders keep it — their lines hold its name and SKU. To stop selling it for now, switch off On sale instead."
            confirmLabel="Remove"
            pendingLabel="Removing…"
            isPending={remove.isPending}
            onConfirm={() => remove.mutate()}
            onClose={() => setDeleting(false)}
          />
        )}
      </td>
    </tr>
  );
}

/** A cell that saves when you leave it (or press Enter), and only if it changed and is valid. */
export function CommitInput({
  label,
  value,
  onCommit,
  validate = () => true,
  placeholder,
  inputMode,
  prefix,
  className,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  validate?: (value: string) => boolean;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric';
  /** A currency sign inside the cell. */
  prefix?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  // A saved value from the server replaces the draft — set during render, not in an effect.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    setDraft(value);
  }
  const valid = validate(draft.trim());
  const commit = () => {
    const next = draft.trim();
    if (next === value) return;
    if (!validate(next)) {
      setDraft(value);
      return;
    }
    onCommit(next);
  };
  return (
    <span className="relative block">
      {prefix && (
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{prefix}</span>
      )}
      <input
        aria-label={label}
        aria-invalid={!valid || undefined}
        value={draft}
        placeholder={placeholder}
        inputMode={inputMode}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') (event.target as HTMLInputElement).blur();
          if (event.key === 'Escape') {
            setDraft(value);
            (event.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          'h-8 w-full rounded-sm border border-transparent bg-transparent px-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground/60 hover:border-rule/60 hover:bg-background focus:border-measured focus:bg-background focus:outline-none',
          prefix && 'pl-5',
          !valid && 'border-exception/60',
          className,
        )}
      />
    </span>
  );
}
