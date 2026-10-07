'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { Boxes, Layers, Plus, Trash2, X } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { getLocationsByTenant } from '@/lib/api/workspace.service';
import {
  deleteCatalogVariant,
  generateCatalogVariants,
  getItemCatalog,
  setCatalogVariantStock,
  updateCatalogVariant,
} from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type GridOption, OPTION_PRESETS, gridSize, missingCombinations } from '@/lib/utils/catalog-import';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import type { CatalogVariant } from '@/types/catalog';

const MONEY = /^\d{1,8}(\.\d{1,2})?$/;

/** The product's catalogue — options, variants, photos — under one key, so every edit refreshes all three. */
export const catalogKey = (menuItemId: string, tenantId: string) => moduleQueryKeys.catalog.key('item-catalog', tenantId, menuItemId);

/**
 * A product's sizes: options in, the grid of variants out — each with its own
 * SKU, price and stock where it sells. Built for a shop that knows its sizes:
 * "S M L XL × Black White" is one line each, then one button.
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

  if (catalogQuery.isPending) return <LoadingState label="Loading sizes" />;
  if (catalogQuery.isError) return <ErrorState title="Couldn’t load this product’s sizes" onRetry={() => void catalogQuery.refetch()} />;
  const catalog = catalogQuery.data;

  return (
    <div className="space-y-6">
      <OptionsCard
        key={catalog.options.map((option) => `${option.id}:${option.values.length}`).join(',')}
        menuItemId={menuItemId}
        productName={productName}
        tenantId={tenantId}
        initial={catalog.options.map((option) => ({ name: option.name, values: option.values.map((value) => value.label) }))}
        existing={catalog.variants.map((variant) =>
          Object.fromEntries(variant.values.map((value) => [optionName(catalog, value.optionValue.optionId), value.optionValue.label])),
        )}
        onGenerated={refresh}
      />
      <SettingsSection
        title="Sizes"
        description={
          catalog.variants.length > 0 ? 'Each is sold and stocked on its own. Leave a price blank to use the product’s.' : undefined
        }
        actions={
          locations.length > 1 && catalog.variants.length > 0 ? (
            <Select
              ariaLabel="Stock at"
              className="w-48"
              value={locationId}
              onValueChange={setLocationId}
              options={locations.map((location) => ({ value: location.id, label: `Stock at ${location.name}` }))}
            />
          ) : undefined
        }
      >
        {catalog.variants.length === 0 ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-rule/70 px-4 py-5 text-sm text-muted-foreground">
            <Layers size={18} className="shrink-0" aria-hidden="true" />
            Sold as one item. Add options above — a size, a colour — to sell it in sizes, each with its own stock.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-rule/60 bg-control">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="border-b border-rule/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Size</th>
                  <th className="px-2 py-2 font-semibold">SKU</th>
                  <th className="w-28 px-2 py-2 font-semibold">Price</th>
                  <th className="w-28 px-2 py-2 font-semibold">Was</th>
                  <th className="w-24 px-2 py-2 font-semibold">{locations.length > 0 ? 'In stock' : 'Stock'}</th>
                  <th className="w-24 px-2 py-2 text-center font-semibold">On sale</th>
                  <th className="w-10 px-2 py-2" aria-label="Actions" />
                </tr>
              </thead>
              <tbody className="divide-y divide-rule/40">
                {catalog.variants.map((variant) => (
                  <VariantRow
                    key={variant.id}
                    variant={variant}
                    productPrice={productPrice}
                    locationId={locationId}
                    tenantId={tenantId}
                    onChanged={refresh}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SettingsSection>
    </div>
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
  existing,
  onGenerated,
}: {
  menuItemId: string;
  productName: string;
  tenantId: string;
  initial: GridOption[];
  existing: Array<Record<string, string>>;
  onGenerated: () => void;
}) {
  const [options, setOptions] = useState<GridOption[]>(initial);
  const [trackStock, setTrackStock] = useState(true);
  const total = gridSize(options);
  const missing = missingCombinations(options, existing);

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
      toast('success', result.created === 1 ? 'Added 1 size.' : `Added ${result.created} sizes.`);
    },
    onError: (error) => toast('error', error.message),
  });

  const update = (index: number, next: GridOption) => setOptions((current) => current.map((option, i) => (i === index ? next : option)));
  const usedNames = new Set(options.map((option) => option.name.trim().toLowerCase()));

  return (
    <SettingsSection title="Options" description="What a shopper chooses. Each combination becomes a size you can price and stock.">
      <div className="space-y-3">
        {options.map((option, index) => (
          <OptionRow
            key={index}
            option={option}
            locked={index < initial.length}
            onChange={(next) => update(index, next)}
            onRemove={index >= initial.length ? () => setOptions((current) => current.filter((_, i) => i !== index)) : undefined}
          />
        ))}
        <div className="flex flex-wrap items-center gap-1.5">
          {options.length < 3 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 bg-control"
              onClick={() => setOptions((current) => [...current, { name: '', values: [] }])}
            >
              <Plus size={13} aria-hidden="true" /> Add option
            </Button>
          )}
          {options.length < 3 &&
            OPTION_PRESETS.filter((preset) => !usedNames.has(preset.option.name.toLowerCase())).map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => setOptions((current) => [...current, { ...preset.option, values: [...preset.option.values] }])}
                className="rounded-md border border-rule/60 bg-control px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-rule hover:text-foreground"
              >
                {preset.option.name}: {preset.label}
              </button>
            ))}
        </div>
        {total > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rule/60 bg-control px-3.5 py-2.5">
            <p className="min-w-0 flex-1 text-sm text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">{total}</span> {total === 1 ? 'size' : 'sizes'}
              {missing < total && (
                <>
                  {' · '}
                  <span className="tabular-nums">{missing}</span> new
                </>
              )}
            </p>
            <Switch checked={trackStock} onChange={setTrackStock} label="Track stock" />
            <span className="text-xs text-muted-foreground">Track stock</span>
            <Button
              size="sm"
              className="gap-1.5"
              disabled={missing === 0 || total > 200 || generate.isPending}
              onClick={() => generate.mutate()}
            >
              <Boxes size={14} aria-hidden="true" />
              {generate.isPending ? 'Adding…' : missing === 0 ? 'All added' : `Add ${missing} ${missing === 1 ? 'size' : 'sizes'}`}
            </Button>
          </div>
        )}
        {total > 200 && <p className="text-xs text-exception">That’s {total} sizes — the most is 200. Split it into separate products.</p>}
      </div>
    </SettingsSection>
  );
}

function OptionRow({
  option,
  locked,
  onChange,
  onRemove,
}: {
  option: GridOption;
  locked: boolean;
  onChange: (next: GridOption) => void;
  onRemove?: () => void;
}) {
  const [draft, setDraft] = useState('');
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
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-lg border border-rule/60 bg-control p-2.5">
      <div className="w-36 shrink-0">
        <Input
          aria-label="Option name"
          value={option.name}
          disabled={locked}
          placeholder="Size"
          onChange={(event) => onChange({ ...option, name: event.target.value })}
        />
      </div>
      <div className="flex min-h-9 min-w-0 flex-1 flex-wrap items-center gap-1.5 rounded-sm border border-rule bg-background px-2 py-1">
        {option.values.map((value) => (
          <span key={value} className="inline-flex items-center gap-1 rounded-md bg-band px-2 py-0.5 text-xs font-medium text-foreground">
            {value}
            {!locked && (
              <button
                type="button"
                aria-label={`Remove ${value}`}
                className="text-muted-foreground hover:text-foreground"
                onClick={() => onChange({ ...option, values: option.values.filter((existing) => existing !== value) })}
              >
                <X size={11} aria-hidden="true" />
              </button>
            )}
          </span>
        ))}
        <input
          aria-label={`Add a ${option.name || 'value'}`}
          className="min-w-24 flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground/70"
          placeholder={option.values.length === 0 ? 'S, M, L — Enter to add' : 'Add…'}
          value={draft}
          onChange={(event) => {
            if (event.target.value.includes(',')) add(event.target.value);
            else setDraft(event.target.value);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add(draft);
            } else if (event.key === 'Backspace' && !draft && option.values.length > 0 && !locked) {
              onChange({ ...option, values: option.values.slice(0, -1) });
            }
          }}
          onBlur={() => draft && add(draft)}
        />
      </div>
      {onRemove ? (
        <Tooltip side="top" align="end" label="Remove option">
          <Button size="icon-sm" variant="ghost" aria-label="Remove option" onClick={onRemove}>
            <X size={14} aria-hidden="true" />
          </Button>
        </Tooltip>
      ) : (
        <span className="w-8" aria-hidden="true" />
      )}
    </div>
  );
}

// ─── One size ────────────────────────────────────────────────────────────────

function VariantRow({
  variant,
  productPrice,
  locationId,
  tenantId,
  onChanged,
}: {
  variant: CatalogVariant;
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

  return (
    <tr className={cn(!variant.isActive && 'text-muted-foreground')}>
      <td className="px-3 py-1.5 font-medium text-foreground">{variant.name}</td>
      <td className="px-2 py-1.5">
        <CommitInput
          label={`${variant.name} SKU`}
          className="font-mono text-xs"
          value={variant.sku}
          onCommit={(sku) => sku && save.mutate({ sku })}
        />
      </td>
      <td className="px-2 py-1.5">
        <CommitInput
          label={`${variant.name} price`}
          value={variant.price ?? ''}
          placeholder={productPrice}
          inputMode="decimal"
          validate={(value) => !value || MONEY.test(value)}
          onCommit={(price) => save.mutate({ price: price || null })}
        />
      </td>
      <td className="px-2 py-1.5">
        <CommitInput
          label={`${variant.name} was price`}
          value={variant.compareAtPrice ?? ''}
          placeholder="—"
          inputMode="decimal"
          validate={(value) => !value || MONEY.test(value)}
          onCommit={(compareAtPrice) => save.mutate({ compareAtPrice: compareAtPrice || null })}
        />
      </td>
      <td className="px-2 py-1.5">
        {locationId ? (
          <CommitInput
            label={`${variant.name} in stock`}
            value={onHand === null ? '' : String(onHand)}
            placeholder={onHand === null ? 'Track' : '0'}
            inputMode="numeric"
            className={cn('tabular-nums', onHand === 0 && 'text-exception')}
            validate={(value) => value === '' || /^\d{1,7}$/.test(value)}
            onCommit={(value) => value !== '' && stock.mutate(Number(value))}
          />
        ) : (
          <span className="text-xs text-muted-foreground">Add a location</span>
        )}
      </td>
      <td className="px-2 py-1.5">
        <div className="flex justify-center">
          <Switch checked={variant.isActive} onChange={(isActive) => save.mutate({ isActive })} label={`${variant.name} on sale`} />
        </div>
      </td>
      <td className="px-2 py-1.5">
        <Tooltip side="top" align="end" label="Remove size">
          <Button size="icon-sm" variant="ghost" aria-label={`Remove ${variant.name}`} onClick={() => setDeleting(true)}>
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
function CommitInput({
  label,
  value,
  onCommit,
  validate = () => true,
  placeholder,
  inputMode,
  className,
}: {
  label: string;
  value: string;
  onCommit: (value: string) => void;
  validate?: (value: string) => boolean;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric';
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
        'h-8 w-full rounded-sm border border-transparent bg-transparent px-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground/60 hover:border-rule/60 focus:border-rule focus:bg-background focus:outline-none',
        !valid && 'border-exception/60',
        className,
      )}
    />
  );
}
