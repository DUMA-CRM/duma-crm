'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { UtensilsCrossed } from '@/components/icons';
import { categoryTone } from '@/components/menu/shared';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { useVatContext } from '@/lib/hooks/useVatContext';
import {
  attachModifier,
  createMenuItem,
  detachModifier,
  getMenuCategories,
  getMenuItemModifierGroups,
  getMenuItemModifiers,
  getModifiers,
  setMenuItemModifierGroupRule,
  setModifierDefault,
  updateMenuItem,
} from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { groupByCategory, modifierCategory, modifierLabel } from '@/lib/utils/modifiers';
import { toast } from '@/stores/toastStore';
import type { MenuItem } from '@/types/menu';

const adjust = (raw?: string) => {
  const n = Number.parseFloat(raw ?? '0');
  return n ? `${n > 0 ? '+' : '−'}£${Math.abs(n).toFixed(2)}` : '';
};

// ── Attached-modifiers editor (edit mode only) ────────────────────────────────

function ItemModifiersEditor({ menuItemId, tenantId }: { menuItemId: string; tenantId: string }) {
  const qc = useQueryClient();
  const { data: attached = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-item-modifiers', menuItemId),
    queryFn: () => getMenuItemModifiers(menuItemId),
  });
  const { data: all = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('modifiers', tenantId),
    queryFn: () => getModifiers(tenantId),
  });
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

  if (all.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        No modifiers exist yet.{' '}
        <Link href="/menu/modifiers/new" className="font-semibold text-primary hover:underline">
          Create one
        </Link>{' '}
        — sizes, milks, syrups — then attach it here.
      </p>
    );

  return (
    <div className="space-y-4">
      {groups.map((group) => {
        const groupId = group.items.find((modifier) => modifier.groupId)?.groupId;
        const rule = rules.find((entry) => entry.id === groupId);
        const attachedHere = group.items.filter((m) => attachedIds.has(m.id)).length;
        return (
          <div key={group.category}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-label uppercase text-muted-foreground">
                {group.category}
                <span className="ml-2 normal-case tabular-nums">
                  {attachedHere}/{group.items.length} offered
                </span>
              </p>
              {groupId && rule && (
                <Select
                  value={`${rule.minSelections}:${rule.maxSelections ?? 'many'}`}
                  onValueChange={(next) => updateRule.mutate({ groupId, value: next })}
                  options={[
                    { value: '0:1', label: 'Optional · choose one' },
                    { value: '1:1', label: 'Required · choose one' },
                    { value: '0:many', label: 'Optional · choose many' },
                    { value: '1:many', label: 'Required · choose many' },
                  ]}
                  ariaLabel={`${group.category} selection rule`}
                  className="h-8 w-auto min-w-48 shrink-0 whitespace-nowrap text-xs"
                />
              )}
            </div>
            <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
              {group.items.map((m) => {
                const isAttached = attachedIds.has(m.id);
                return (
                  <li
                    key={m.id}
                    className={cn(
                      'flex items-center border-b border-rule/45 transition-colors last:border-b-0 hover:bg-band/40',
                      isAttached && 'bg-primary/4',
                    )}
                  >
                    {/* The label carries the padding, so the whole row — not just the text — toggles it. */}
                    <label className="flex min-w-0 flex-1 cursor-pointer select-none items-center gap-3 px-3.5 py-2.5">
                      <input
                        type="checkbox"
                        checked={isAttached}
                        disabled={toggle.isPending}
                        onChange={(e) => toggle.mutate({ modifierId: m.id, on: e.target.checked })}
                        className="size-4 shrink-0 rounded accent-primary"
                      />
                      <span className={cn('truncate text-sm', isAttached ? 'font-semibold text-foreground' : 'text-muted-foreground')}>
                        {modifierLabel(m)}
                      </span>
                      {adjust(m.priceAdjust) && (
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{adjust(m.priceAdjust)}</span>
                      )}
                    </label>
                    {isAttached && (
                      <button
                        type="button"
                        disabled={toggleDefault.isPending}
                        onClick={() => toggleDefault.mutate({ modifierId: m.id, isDefault: !defaultIds.has(m.id) })}
                        aria-pressed={defaultIds.has(m.id)}
                        title="Pre-select this at the till"
                        className={cn(
                          'mr-3.5 shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold transition-colors',
                          defaultIds.has(m.id)
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-band text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {defaultIds.has(m.id) ? 'Default' : 'Set default'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

// ── Create / edit form ──────────────────────────────────────────────────────

export function MenuItemForm({
  tenantId,
  item,
  onCreated,
  onSaved,
  formId,
  onPendingChange,
  onDirtyChange,
}: {
  tenantId: string;
  item?: MenuItem;
  /** Called with the new item so the pane can move to its own URL. */
  onCreated?: (created: MenuItem) => void;
  /** Called after an update to an existing item. */
  onSaved?: (saved: MenuItem) => void;
  /** The <form> gets this id so a Save button in the pane header can submit it. */
  formId?: string;
  /** Reports the mutation's pending state so the header Save button can reflect it. */
  onPendingChange?: (pending: boolean) => void;
  /** Reports unsaved edits so the pane can flag them. */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const qc = useQueryClient();
  const { ctx: vat } = useVatContext();
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
  const [imageBroken, setImageBroken] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { data: categories = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId),
    enabled: Boolean(tenantId),
  });
  const currentCategory = categories.find((entry) => entry.id === categoryId);

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
        toast('success', 'Item created — you can attach modifiers now.');
        onCreated(saved);
        return;
      }
      toast('success', 'Menu item updated.');
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

  const nameError = name.trim().length < 2 ? 'At least two characters.' : null;
  const categoryError = !categoryId ? 'Choose a section.' : null;
  const priceError = !/^\d+(\.\d{1,2})?$/.test(price.trim()) ? 'A price like 3.20.' : null;
  // The API takes any string; links and inline data images are what's actually used.
  const imageError =
    imageUrl.trim() && !/^(https?:\/\/\S+|data:image\/)/.test(imageUrl.trim()) ? 'A full web address, starting https://' : null;
  const slugError =
    slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug.trim())
      ? 'Lower-case letters, numbers and dashes, like oversized-hoodie.'
      : null;
  const valid = !nameError && !categoryError && !priceError && !imageError && !slugError;
  const show = (error: string | null) => (submitted ? (error ?? undefined) : undefined);
  const priceText = /^\d+(\.\d{1,2})?$/.test(price.trim()) ? `£${Number(price).toFixed(2)}` : '£—';

  return (
    <form
      id={formId}
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        setSubmitted(true);
        if (valid) mutate();
      }}
    >
      <SettingsTabBody
        aside={
          <SettingsSection title="Modifiers" description="Tick to offer, and set the default the till pre-selects.">
            {item ? (
              <ItemModifiersEditor menuItemId={item.id} tenantId={item.tenantId} />
            ) : (
              <p className="rounded-lg border border-dashed border-rule/70 px-4 py-3 text-sm text-muted-foreground">
                Create the item first — sizes, milks and syrups can be attached straight after.
              </p>
            )}
          </SettingsSection>
        }
      >
        {/* One card, the settings profile card's shape: the item as it reads at
            the till (image tile, name, section, price) over the fields that
            make it, with availability at the foot. */}
        <SettingsSection>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-linear-to-br from-primary/15 via-band to-band shadow-sm">
              {imageUrl.trim() && !imageBroken && !imageError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  onError={() => setImageBroken(true)}
                  className={cn('absolute inset-0 size-full object-cover', !isAvailable && 'opacity-60 grayscale')}
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-muted-foreground/50 select-none">
                  <UtensilsCrossed size={26} aria-hidden="true" />
                  <span className="text-micro font-semibold">{imageBroken ? 'Didn’t load' : 'No image'}</span>
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p
                    className={cn(
                      'truncate text-2xl font-semibold tracking-headline',
                      name.trim() ? 'text-foreground' : 'text-muted-foreground/60',
                    )}
                  >
                    {name.trim() || 'New item'}
                  </p>
                  <p className="shrink-0 text-xl font-semibold tabular-nums text-foreground">{priceText}</p>
                </div>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      'rounded-sm px-1.5 py-0.5 text-micro font-semibold uppercase tracking-micro',
                      categoryTone(currentCategory?.slug ?? '', currentCategory),
                    )}
                  >
                    {currentCategory?.name ?? 'No section'}
                  </span>
                </p>
              </div>
              <Input
                label="Image"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageBroken(false);
                }}
                placeholder="https://… (optional)"
                error={show(imageError)}
              />
            </div>
          </div>

          <div className="mt-6 border-t border-rule/45 pt-6">
            <div className="space-y-4">
              <Input
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
                placeholder="e.g. Flat white"
                autoFocus={!item}
                error={show(nameError)}
              />
              <Input
                label="Web address"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                maxLength={160}
                placeholder={item ? 'Made from the name when you save' : 'Made from the name'}
                hint="Its address in your online shop, like /products/oversized-hoodie"
                error={slugError ?? undefined}
                className="font-mono"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-label uppercase text-muted-foreground">Section</span>
                  <Select
                    value={categoryId}
                    onValueChange={setCategoryId}
                    options={[
                      ...(categoryId ? [] : [{ value: '', label: 'Choose a section' }]),
                      ...categories
                        .filter((entry) => entry.isActive || entry.id === item?.categoryId)
                        .map((entry) => ({ value: entry.id, label: entry.name })),
                    ]}
                    ariaLabel="Menu section"
                    ariaInvalid={submitted && !!categoryError}
                    className="w-full"
                  />
                  {submitted && categoryError && <p className="text-xs text-destructive">{categoryError}</p>}
                </div>
                <Input
                  label="Price"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  inputMode="decimal"
                  placeholder="3.20"
                  leftIcon={<span className="text-sm">£</span>}
                  className="tabular-nums"
                  error={show(priceError)}
                />
              </div>
              {/* Only meaningful for a VAT-registered tenant — otherwise no rate
                  applies to anything and the field is pure noise. */}
              {vat.vatRegistered && (
                <div className="flex flex-col gap-1.5">
                  <span className="text-label uppercase text-muted-foreground">VAT rate</span>
                  <Select
                    value={vatRate}
                    onValueChange={setVatRate}
                    options={[
                      { value: '', label: `Use default (${vat.defaultVatRate}%)` },
                      { value: '20', label: 'Standard — 20%' },
                      { value: '5', label: 'Reduced — 5%' },
                      { value: '0', label: 'Zero-rated — 0%' },
                    ]}
                    ariaLabel="VAT rate for this item"
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">
                    Hot food and drink are standard-rated; most cold takeaway food is zero-rated. This changes the margin shown, not the
                    price.
                  </p>
                </div>
              )}
              <div className="flex flex-col gap-1.5">
                <span className="text-label uppercase text-muted-foreground">Description</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  placeholder="Optional — shown to staff and online"
                  aria-label="Description"
                  className="w-full resize-none rounded-md border border-input bg-control px-3 py-2 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured sm:text-sm"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-rule/45 pt-5">
            <SettingRows>
              <SettingRow icon={UtensilsCrossed} title="On the menu">
                <Switch label="On the menu" checked={isAvailable} onChange={setIsAvailable} />
              </SettingRow>
            </SettingRows>
          </div>
        </SettingsSection>
      </SettingsTabBody>
    </form>
  );
}
