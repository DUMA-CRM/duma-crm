'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { SectionInfo } from '@/components/shared/rows';
import {
  AlignLeft,
  Boxes,
  Coins,
  Eye,
  EyeOff,
  ImageIcon,
  Layers,
  Link2,
  Receipt,
  Scale,
  SlidersHorizontal,
  Type,
} from '@/components/icons';
import { ItemImageField } from '@/components/menu/ItemImageField';
import { ChangeRow, SaveBar, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone } from '@/components/shared/Skeleton';
import { useCurrencySymbol } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { useCatalogWords } from '@/lib/hooks/useCatalogWords';
import { useVatContext } from '@/lib/hooks/useVatContext';
import {
  attachModifier,
  createMenuItem,
  detachModifier,
  getItemCatalog,
  getMenuCategories,
  getMenuItemModifierGroups,
  getMenuItemModifiers,
  getModifiers,
  setMenuItemModifierGroupRule,
  setModifierDefault,
  updateMenuItem,
} from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { RULE_OPTIONS, displayPrice, formatPriceChange, menuItemErrors, offeredSummary, ruleKey, ruleWords } from '@/lib/utils/menu-editor';
import { groupByCategory, isSizeModifier, modifierCategory, modifierLabel } from '@/lib/utils/modifiers';
import type { MenuItem } from '@/types/menu';

// ── Attached-modifiers editor (edit mode only) ────────────────────────────────

/**
 * One row per modifier group: what the item offers from it and the group's
 * rule. Change opens the group in place — tick what's offered, pick the till's
 * default. Each tick saves at once (its own API call), so the row closes with
 * Done rather than Cancel: there is nothing to put back.
 */
function ItemModifiersEditor({ menuItemId, tenantId }: { menuItemId: string; tenantId: string }) {
  const symbol = useCurrencySymbol();
  const qc = useQueryClient();
  const { data: attached = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-item-modifiers', menuItemId),
    queryFn: () => getMenuItemModifiers(menuItemId),
  });
  const allQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifiers', tenantId),
    queryFn: () => getModifiers(tenantId),
  });
  const all = allQuery.data ?? [];
  const { data: rules = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-item-modifier-groups', menuItemId),
    queryFn: () => getMenuItemModifierGroups(menuItemId),
  });

  const attachedIds = new Set(attached.map((m) => m.id));
  const defaultIds = new Set(attached.filter((m) => m.isDefault).map((m) => m.id));

  const toggle = useMutation({
    mutationFn: async ({ modifierId, on }: { modifierId: string; on: boolean }) => {
      if (on) await attachModifier(menuItemId, modifierId);
      else await detachModifier(menuItemId, modifierId);
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-item-modifiers', menuItemId) }),
        qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-item-modifier-groups', menuItemId) }),
      ]);
    },
    onError: (err) => toast('error', err.message || 'The modifier wasn’t updated. Try again.'),
  });

  // A default *moves* within a group whose rule caps the choices: the API
  // refuses a second default in a "choose one" group (400 "Too many defaults"),
  // so the old default(s) are cleared first — the way a radio button behaves.
  const toggleDefault = useMutation({
    mutationFn: async ({ modifierId, isDefault }: { modifierId: string; isDefault: boolean }) => {
      if (isDefault) {
        const target = all.find((m) => m.id === modifierId);
        const rule = target?.groupId ? rules.find((entry) => entry.id === target.groupId) : undefined;
        if (target?.groupId && rule?.maxSelections != null) {
          const others = attached.filter(
            (m) => m.isDefault && m.id !== modifierId && all.find((x) => x.id === m.id)?.groupId === target.groupId,
          );
          const excess = others.length + 1 - rule.maxSelections;
          for (const other of others.slice(0, Math.max(0, excess))) await setModifierDefault(menuItemId, other.id, false);
        }
      }
      await setModifierDefault(menuItemId, modifierId, isDefault);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-item-modifiers', menuItemId) }),
    onError: (err) => toast('error', err.message || 'The default wasn’t changed. Try again.'),
  });

  const updateRule = useMutation({
    mutationFn: ({ groupId, value }: { groupId: string; value: string }) => {
      const [minimum, maximum] = value.split(':');
      return setMenuItemModifierGroupRule(menuItemId, groupId, {
        minSelections: Number(minimum),
        maxSelections: maximum === 'many' ? null : Number(maximum),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-item-modifier-groups', menuItemId) }),
    onError: (err) => toast('error', err.message || 'The selection rule was not updated.'),
  });

  const groups = groupByCategory(all, (m) => modifierCategory(m));
  const [open, setOpen] = useState<string | null>(null);

  if (allQuery.isPending)
    return (
      <div role="status" aria-busy="true" aria-label="Loading modifiers" className="space-y-5">
        {[0, 1].map((index) => (
          <div key={index} className="flex items-center gap-3">
            <Bone className="size-10 shrink-0" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <Bone className="h-3 w-20" />
              <Bone className="h-4 w-40" />
            </div>
          </div>
        ))}
      </div>
    );
  if (allQuery.isError) return <ErrorState className="py-6" title="Couldn’t load the modifiers" onRetry={() => void allQuery.refetch()} />;
  if (all.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No modifiers exist yet.{' '}
        <Link href="/menu/modifiers" className="font-semibold text-primary hover:underline">
          Create one
        </Link>{' '}
        — sizes, milks, syrups — then attach it here.
      </p>
    );

  return (
    <div>
      {groups.map((group) => {
        const groupId = group.items.find((modifier) => modifier.groupId)?.groupId;
        const rule = rules.find((entry) => entry.id === groupId);
        const offered = group.items.filter((m) => attachedIds.has(m.id));
        const rulePhrase = rule && offered.length > 0 ? ruleWords(rule) : null;
        return (
          <ChangeRow
            key={group.category}
            icon={group.items.some(isSizeModifier) ? Scale : SlidersHorizontal}
            label={group.category}
            value={
              offered.length === 0 ? (
                <ValueMissing>Not offered</ValueMissing>
              ) : (
                <>
                  <span className="truncate">{offeredSummary(offered.map(modifierLabel))}</span>
                  {rulePhrase && <ValueAside>· {rulePhrase}</ValueAside>}
                </>
              )
            }
            verbs={['Change', 'Done']}
            open={open === group.category}
            onToggle={() => setOpen(open === group.category ? null : group.category)}
          >
            <div className="space-y-3">
              {groupId && rule && offered.length > 0 && (
                <Select
                  value={ruleKey(rule)}
                  onValueChange={(next) => updateRule.mutate({ groupId, value: next })}
                  options={RULE_OPTIONS.map((option) => ({ ...option }))}
                  ariaLabel={`${group.category} selection rule`}
                  className="w-full sm:w-64"
                />
              )}
              <ul className="-mx-2">
                {group.items.map((m) => {
                  const isAttached = attachedIds.has(m.id);
                  const isDefault = defaultIds.has(m.id);
                  const change = formatPriceChange(m.priceAdjust, symbol);
                  return (
                    <li key={m.id} className="flex items-center gap-2 rounded-md pr-1 transition-colors hover:bg-band/40">
                      {/* The label carries the padding, so the whole row — not just the text — toggles it. */}
                      <label className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-3 px-2 py-2">
                        <input
                          type="checkbox"
                          checked={isAttached}
                          disabled={toggle.isPending}
                          onChange={(e) => toggle.mutate({ modifierId: m.id, on: e.target.checked })}
                          className="size-4 shrink-0 rounded accent-primary"
                        />
                        <span
                          className={cn('min-w-0 flex-1 text-sm', isAttached ? 'font-semibold text-foreground' : 'text-muted-foreground')}
                        >
                          {modifierLabel(m)}
                        </span>
                        {change && <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{change}</span>}
                      </label>
                      {isAttached && (
                        <button
                          type="button"
                          disabled={toggleDefault.isPending}
                          onClick={() => toggleDefault.mutate({ modifierId: m.id, isDefault: !isDefault })}
                          aria-pressed={isDefault}
                          title="Pre-select this at the till"
                          className={cn(
                            'shrink-0 rounded-sm px-1.5 py-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                            isDefault ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-band hover:text-foreground',
                          )}
                        >
                          {isDefault ? 'Default' : 'Set default'}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </ChangeRow>
        );
      })}
    </div>
  );
}

// ── A product at a glance (retail) ──────────────────────────────────────────

function ProductSummary({
  catalog,
  loading,
  onOpenTab,
}: {
  catalog?: Awaited<ReturnType<typeof getItemCatalog>>;
  loading: boolean;
  onOpenTab?: (tab: 'sizes' | 'photos') => void;
}) {
  const variants = catalog?.variants ?? [];
  const onHand = variants.reduce((sum, variant) => sum + (variant.stock ?? []).reduce((total, row) => total + row.quantity, 0), 0);
  const tracked = variants.some((variant) => variant.stock);
  const soldOut = variants.filter((variant) => variant.stock && variant.stock.every((row) => row.quantity === 0)).length;
  const photos = catalog?.images.length ?? 0;
  const open = (tab: 'sizes' | 'photos', label: string) =>
    onOpenTab ? (
      <Button variant="outline" size="sm" onClick={() => onOpenTab(tab)} aria-label={`Open ${label}`}>
        Open
      </Button>
    ) : undefined;
  const pending = <Bone className="h-4 w-16" />;
  return (
    <RecordGroup card id="item-glance" title="At a glance">
      <ChangeRow
        icon={Layers}
        label="Sizes"
        value={loading ? pending : variants.length === 0 ? 'One size' : variants.length}
        trailing={open('sizes', 'sizes')}
      />
      <ChangeRow
        icon={Boxes}
        label="In stock"
        tone={soldOut > 0 ? 'warning' : undefined}
        value={
          loading ? (
            pending
          ) : tracked ? (
            <>
              <span className="tabular-nums">{onHand}</span>
              {soldOut > 0 && <ValueAside>· {soldOut} sold out</ValueAside>}
            </>
          ) : (
            <ValueMissing>Not tracked</ValueMissing>
          )
        }
        trailing={open('sizes', 'stock')}
      />
      <ChangeRow
        icon={ImageIcon}
        label="Photos"
        tone={!loading && photos === 0 ? 'warning' : undefined}
        value={loading ? pending : photos === 0 ? <ValueMissing>None yet</ValueMissing> : photos}
        trailing={open('photos', 'photos')}
      />
    </RecordGroup>
  );
}

// ── Create / edit form ──────────────────────────────────────────────────────

type Row = 'name' | 'category' | 'price' | 'vat' | 'description' | 'slug';

/**
 * A menu item (or product) in the editor layout: Details — and, on a menu,
 * Modifiers — in the main column as rows that open in place; the photo and a
 * product's sizes, stock and photo counts in the sidebar, first when stacked.
 * One draft, saved through the SaveBar.
 */
export function MenuItemForm({
  tenantId,
  item,
  onCreated,
  onSaved,
  formId,
  onPendingChange,
  onDirtyChange,
  onOpenTab,
}: {
  tenantId: string;
  item?: MenuItem;
  /** Jump to the product's Sizes & stock or Photos tab. */
  onOpenTab?: (tab: 'sizes' | 'photos') => void;
  /** Called with the new item so the pane can move to its own URL. */
  onCreated?: (created: MenuItem) => void;
  /** Called after an update to an existing item. */
  onSaved?: (saved: MenuItem) => void;
  /** The <form> gets this id, so a button outside it can still submit it. */
  formId?: string;
  /** Reports the mutation's pending state, for the pane's leave guard. */
  onPendingChange?: (pending: boolean) => void;
  /** Reports unsaved edits so the pane can flag them. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const symbol = useCurrencySymbol();
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const { ctx: vat } = useVatContext();
  const words = useCatalogWords();
  const { tools } = words;
  // A product's sizes, stock and photos, for its summary.
  const catalogQuery = useQuery({
    queryKey: moduleQueryKeys.catalog.key('item-catalog', tenantId, item?.id ?? ''),
    queryFn: () => getItemCatalog(item!.id, tenantId),
    enabled: Boolean(item && tools.retail),
  });
  const [name, setName] = useState(item?.name ?? '');
  const [categoryId, setCategoryId] = useState(item?.categoryId ?? '');
  const [price, setPrice] = useState(item?.price ?? '');
  // '' means "use the tenant default"; '0' is a real, different answer (zero-rated).
  const [vatRate, setVatRate] = useState(item?.vatRate ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  // Its address on a storefront. Blank on a new item: the API makes one from the name.
  const [slug, setSlug] = useState(item?.slug ?? '');
  const [submitted, setSubmitted] = useState(false);
  const { data: categories = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId),
    enabled: Boolean(tenantId),
  });
  const currentCategory = categories.find((entry) => entry.id === categoryId);

  // One row open at a time; a new item starts with its name open.
  const [open, setOpen] = useState<Row | null>(item ? null : 'name');
  const [before, setBefore] = useState({ name, categoryId, price, vatRate, description, slug });
  const openRow = (row: Row) => {
    setBefore({ name, categoryId, price, vatRate, description, slug });
    setOpen(row);
  };
  /** Change opens a row; Cancel closes it and puts its value back as it was when it opened. */
  const toggle = (row: Row) => {
    if (open !== row) return openRow(row);
    if (row === 'name') setName(before.name);
    if (row === 'category') setCategoryId(before.categoryId);
    if (row === 'price') setPrice(before.price);
    if (row === 'vat') setVatRate(before.vatRate);
    if (row === 'description') setDescription(before.description);
    if (row === 'slug') setSlug(before.slug);
    setOpen(null);
  };
  /** Enter in a row's field closes it, keeping what was typed. */
  const closeOnEnter = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      setOpen(null);
    }
  };

  const { mutate, isPending } = useMutation({
    mutationFn: () => {
      const payload = {
        name: name.trim(),
        categoryId,
        price: price.trim(),
        // null clears the override on the server; undefined would leave it be.
        vatRate: vatRate.trim() === '' ? null : vatRate.trim(),
        description: description.trim() || undefined,
        imageUrl: imageUrl.trim() || undefined,
        isAvailable,
        ...(slug.trim() && slug.trim() !== (item?.slug ?? '') ? { slug: slug.trim() } : {}),
      };
      return item ? updateMenuItem(item.id, payload) : createMenuItem({ tenantId, ...payload });
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-items') });
      if (!item && onCreated) {
        toast('success', words.created);
        onCreated(saved);
        return;
      }
      toast('success', words.saved);
      onSaved?.(saved);
    },
    onError: (err) => toast('error', err.message || 'The item wasn’t saved. Check the fields and try again.'),
  });

  useEffect(() => onPendingChange?.(isPending), [isPending, onPendingChange]);

  const dirty =
    name !== (item?.name ?? '') ||
    categoryId !== (item?.categoryId ?? '') ||
    price !== (item?.price ?? '') ||
    vatRate !== (item?.vatRate ?? '') ||
    description !== (item?.description ?? '') ||
    imageUrl !== (item?.imageUrl ?? '') ||
    slug !== (item?.slug ?? '') ||
    isAvailable !== (item?.isAvailable ?? true);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  const errors = menuItemErrors({ name, categoryId, price, imageUrl, slug }, words.groupPlaceholder);
  const valid = Object.keys(errors).length === 0;
  const show = (field: keyof typeof errors) => (submitted ? errors[field] : undefined);
  const tone = (field: keyof typeof errors) => (show(field) ? ('warning' as const) : undefined);

  const submit = () => {
    setSubmitted(true);
    if (valid) {
      setOpen(null);
      mutate();
      return;
    }
    // Open the first row that stops the save, so its message is in view.
    const first = (['name', 'category', 'price', 'slug'] as const).find((field) => errors[field]);
    if (first) openRow(first);
  };
  const discard = () => {
    setName(item?.name ?? '');
    setCategoryId(item?.categoryId ?? '');
    setPrice(item?.price ?? '');
    setVatRate(item?.vatRate ?? '');
    setDescription(item?.description ?? '');
    setImageUrl(item?.imageUrl ?? '');
    setIsAvailable(item?.isAvailable ?? true);
    setSlug(item?.slug ?? '');
    setSubmitted(false);
    setOpen(item ? null : 'name');
  };

  const shownPrice = displayPrice(price);
  const vatOptions = [
    { value: '', label: `Use default (${vat.defaultVatRate}%)` },
    { value: '20', label: 'Standard — 20%' },
    { value: '5', label: 'Reduced — 5%' },
    { value: '0', label: 'Zero-rated — 0%' },
  ];

  const details = (
    <RecordGroup
      card
      id="item-details"
      title="Details"
      footnote={tools.retail && !item ? 'Sizes, stock and photos come next, once it’s created.' : undefined}
    >
      <ChangeRow
        icon={Type}
        label="Name"
        tone={tone('name')}
        value={name.trim() ? <span className="truncate">{name.trim()}</span> : <ValueMissing>Not named</ValueMissing>}
        open={open === 'name'}
        onToggle={() => toggle('name')}
      >
        <Input
          aria-label="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={closeOnEnter}
          maxLength={255}
          placeholder={words.namePlaceholder}
          autoFocus
          error={show('name')}
        />
      </ChangeRow>
      <ChangeRow
        icon={Layers}
        label={words.group}
        tone={tone('category')}
        value={currentCategory ? <span className="truncate">{currentCategory.name}</span> : <ValueMissing>Not chosen</ValueMissing>}
        open={open === 'category'}
        onToggle={() => toggle('category')}
      >
        <div className="flex flex-col gap-1.5">
          <Select
            value={categoryId}
            onValueChange={setCategoryId}
            options={[
              ...(categoryId ? [] : [{ value: '', label: words.groupPlaceholder }]),
              ...categories
                .filter((entry) => entry.isActive || entry.id === item?.categoryId)
                .map((entry) => ({ value: entry.id, label: entry.name })),
            ]}
            ariaLabel={words.group}
            ariaInvalid={Boolean(show('category'))}
            className="w-full"
          />
          {show('category') && <p className="text-xs text-destructive">{show('category')}</p>}
        </div>
      </ChangeRow>
      <ChangeRow
        icon={Coins}
        label="Price"
        tone={tone('price')}
        value={
          shownPrice ? (
            <>
              <span className="tabular-nums">
                {symbol}
                {shownPrice}
              </span>
              {vat.vatRegistered && <ValueAside>· {vat.pricesIncludeTax ? 'including VAT' : 'before VAT'}</ValueAside>}
            </>
          ) : (
            <ValueMissing>Not set</ValueMissing>
          )
        }
        open={open === 'price'}
        onToggle={() => toggle('price')}
      >
        <Input
          aria-label="Price"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onKeyDown={closeOnEnter}
          inputMode="decimal"
          autoFocus
          placeholder={tools.retail && !tools.kitchen ? '25.00' : '3.20'}
          leftIcon={<span className="text-sm">{symbol}</span>}
          className="tabular-nums sm:max-w-48"
          hint={vat.vatRegistered ? (vat.pricesIncludeTax ? 'Including VAT' : 'Before VAT') : undefined}
          error={show('price')}
        />
      </ChangeRow>
      {/* Only meaningful for a VAT-registered tenant — otherwise no rate
          applies to anything and the row is pure noise. */}
      {vat.vatRegistered && (
        <ChangeRow
          icon={Receipt}
          label="VAT rate"
          value={vatOptions.find((option) => option.value === vatRate)?.label ?? `${vatRate}%`}
          open={open === 'vat'}
          onToggle={() => toggle('vat')}
        >
          <div className="flex flex-col gap-1.5">
            <Select
              value={vatRate}
              onValueChange={setVatRate}
              options={vatOptions}
              ariaLabel={`VAT rate for this ${words.item}`}
              className="w-full sm:w-64"
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              {tools.kitchen
                ? 'Hot food and drink are standard-rated; most cold takeaway food is zero-rated. This changes the margin shown, not the price.'
                : 'Most goods are standard-rated; children’s clothing and shoes are zero-rated. This changes the VAT recorded, not the price.'}
            </p>
          </div>
        </ChangeRow>
      )}
      <ChangeRow
        icon={AlignLeft}
        label="Description"
        value={description.trim() ? <span className="truncate font-normal">{description.trim()}</span> : <ValueMissing>None</ValueMissing>}
        open={open === 'description'}
        onToggle={() => toggle('description')}
      >
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={tools.retail && !tools.kitchen ? 4 : 3}
          placeholder={words.descriptionPlaceholder}
          aria-label="Description"
          autoFocus
          className="w-full resize-none rounded-md border border-input bg-control px-3 py-2 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:outline-2 focus:outline-ring/30 sm:text-sm"
        />
      </ChangeRow>
      {tools.retail && (
        <ChangeRow
          icon={Link2}
          label="Web address"
          tone={tone('slug')}
          value={
            slug.trim() ? (
              <span className="truncate font-mono text-[13px] font-medium">/{slug.trim()}</span>
            ) : (
              <ValueAside>Made from the name</ValueAside>
            )
          }
          open={open === 'slug'}
          onToggle={() => toggle('slug')}
        >
          <Input
            aria-label="Web address"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
            onKeyDown={closeOnEnter}
            maxLength={160}
            autoFocus
            placeholder={item ? 'Made from the name when you save' : 'Made from the name'}
            hint="Its address in your online shop, like /products/oversized-hoodie"
            error={errors.slug}
            className="font-mono"
          />
        </ChangeRow>
      )}
      {/* A switch among the Change rows: on or off is the whole edit. */}
      <ChangeRow
        icon={isAvailable ? Eye : EyeOff}
        label={words.available}
        value={
          isAvailable ? (
            tools.kitchen ? (
              'Shown at the till and online'
            ) : (
              'Shown to shoppers'
            )
          ) : (
            <ValueMissing>{tools.kitchen ? 'Hidden at the till and online' : 'Hidden from shoppers'}</ValueMissing>
          )
        }
        trailing={<Switch label={words.available} checked={isAvailable} onChange={setIsAvailable} />}
      />
    </RecordGroup>
  );

  const modifiers = tools.kitchen && (
    <RecordGroup card id="item-modifiers" title="Modifiers" footnote="What can be chosen with it, and what the till pre-selects.">
      {item ? (
        <ItemModifiersEditor menuItemId={item.id} tenantId={item.tenantId} />
      ) : (
        <p className="text-sm text-muted-foreground">Create the item first — sizes, milks and syrups can be attached straight after.</p>
      )}
    </RecordGroup>
  );

  const photo = tools.kitchen && (
    <RecordGroup card id="item-photo" title="Photo" actions={<SectionInfo label="Shown on the till tile, the QR menu and online." />}>
      <ItemImageField value={imageUrl} onChange={setImageUrl} itemName={name} itemId={item?.id} error={show('image')} layout="stacked" />
    </RecordGroup>
  );
  const glance = tools.retail && item && (
    <ProductSummary catalog={catalogQuery.data} loading={catalogQuery.isPending} onOpenTab={onOpenTab} />
  );
  const sidebar = photo || glance;

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
      >
        {sidebar ? (
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="flex min-w-0 flex-col gap-5">
              {details}
              {modifiers}
            </div>
            {/* Stacked (below lg) the sidebar comes first: the photo is what a menu item is recognised by. */}
            <div className="flex min-w-0 flex-col gap-5 max-lg:order-first">
              {photo}
              {glance}
            </div>
          </div>
        ) : (
          <div className="flex min-w-0 flex-col gap-5">
            {details}
            {modifiers}
          </div>
        )}
      </motion.div>

      <SaveBar
        dirty={dirty || !item}
        saving={isPending}
        saveLabel={item ? 'Save changes' : `Create ${words.item}`}
        message={item ? undefined : 'Not created yet'}
        onSave={submit}
        onDiscard={discard}
      />
    </form>
  );
}
