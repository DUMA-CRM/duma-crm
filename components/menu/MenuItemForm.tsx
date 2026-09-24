'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { ChefHat, UtensilsCrossed } from '@/components/icons';
import { RecipeSummaryChips } from '@/components/menu/RecipeEditorPage';
import { AvailabilityToggle, categoryTone, inputClass, labelClass, selectClass } from '@/components/menu/shared';
import { Button } from '@/components/ui/button';
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
  });

  const toggleDefault = useMutation({
    mutationFn: ({ modifierId, isDefault }: { modifierId: string; isDefault: boolean }) =>
      setModifierDefault(menuItemId, modifierId, isDefault),
    onSuccess: () => qc.invalidateQueries({ queryKey: moduleQueryKeys.catalog.key('menu-item-modifiers', menuItemId) }),
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

  return (
    <div>
      {all.length === 0 ? (
        <p className="text-xs text-muted-foreground">No modifiers exist yet. Create some in the Modifiers tab first.</p>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.category}>
              <div className="flex items-center justify-between gap-3 px-1 pb-1">
                <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">{group.category}</p>
                {(() => {
                  const groupId = group.items.find((modifier) => modifier.groupId)?.groupId;
                  const rule = rules.find((entry) => entry.id === groupId);
                  if (!groupId || !rule) return null;
                  const value = `${rule.minSelections}:${rule.maxSelections ?? 'many'}`;
                  return (
                    <Select
                      value={value}
                      onValueChange={(next) => updateRule.mutate({ groupId, value: next })}
                      options={[
                        { value: '0:1', label: 'Optional · choose one' },
                        { value: '1:1', label: 'Required · choose one' },
                        { value: '0:many', label: 'Optional · choose many' },
                        { value: '1:many', label: 'Required · choose many' },
                      ]}
                      ariaLabel={`${group.category} selection rule`}
                      className="h-8 w-48 text-xs"
                    />
                  );
                })()}
              </div>
              {group.items.map((m) => {
                const isAttached = attachedIds.has(m.id);
                return (
                  <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 rounded-sm hover:bg-muted transition-colors">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isAttached}
                        disabled={toggle.isPending}
                        onChange={(e) => toggle.mutate({ modifierId: m.id, on: e.target.checked })}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <span className="text-sm text-foreground truncate">{modifierLabel(m)}</span>
                      {adjust(m.priceAdjust) && <span className="text-xs text-muted-foreground tabular-nums">{adjust(m.priceAdjust)}</span>}
                    </label>
                    {isAttached && (
                      <label
                        className="flex items-center gap-1.5 cursor-pointer select-none text-label font-medium text-muted-foreground shrink-0"
                        title="Pre-select this as the default variant in the POS"
                      >
                        <input
                          type="checkbox"
                          checked={defaultIds.has(m.id)}
                          disabled={toggleDefault.isPending}
                          onChange={(e) => toggleDefault.mutate({ modifierId: m.id, isDefault: e.target.checked })}
                          className="w-3.5 h-3.5 rounded accent-primary"
                        />
                        Default
                      </label>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create / edit form ──────────────────────────────────────────────────────

export function MenuItemForm({
  tenantId,
  item,
  onCreated,
  onSaved,
  onOpenRecipe,
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
  /** Switches the detail pane to its Recipe tab. */
  onOpenRecipe: () => void;
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
  const [imageBroken, setImageBroken] = useState(false);
  const { data: categories = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId),
    enabled: Boolean(tenantId),
  });
  const currentCategory = categories.find((entry) => entry.id === categoryId);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = {
        name,
        categoryId,
        price,
        // null clears the override on the server; undefined would leave it be.
        vatRate: vatRate.trim() === '' ? null : vatRate.trim(),
        description: description || undefined,
        imageUrl: imageUrl || undefined,
        isAvailable,
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
  });

  useEffect(() => onPendingChange?.(isPending), [isPending, onPendingChange]);

  const dirty =
    name !== (item?.name ?? '') ||
    categoryId !== (item?.categoryId ?? '') ||
    price !== (item?.price ?? '') ||
    vatRate !== (item?.vatRate ?? '') ||
    description !== (item?.description ?? '') ||
    imageUrl !== (item?.imageUrl ?? '') ||
    isAvailable !== (item?.isAvailable ?? true);
  useEffect(() => onDirtyChange?.(dirty), [dirty, onDirtyChange]);

  return (
    <form
      id={formId}
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      {/* Two cards side by side: a narrower item-details card and a wider
          modifiers card — the modifier list is the denser of the two. */}
      <div className="flex gap-4 items-stretch">
        <section className="bg-card border border-rule rounded-sm overflow-hidden shadow-sm flex flex-col max-w-md">
          {/* Image hero — live preview doubles as the card banner; grows to fill the card height */}
          <div className="relative flex-1 min-h-52 bg-linear-to-br from-primary/15 via-surface-offset to-surface-offset">
            {imageUrl.trim() && !imageBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" onError={() => setImageBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/40 select-none">
                <UtensilsCrossed size={30} aria-hidden="true" />
                <span className="text-label font-semibold">{imageBroken ? 'Image didn’t load' : 'No image yet'}</span>
              </div>
            )}
            <span
              className={cn(
                'absolute top-3 left-3 px-2.5 py-1 rounded-sm text-micro font-semibold uppercase tracking-micro backdrop-blur-sm',
                categoryTone(currentCategory?.slug ?? '', currentCategory),
              )}
            >
              {currentCategory?.name ?? 'Choose category'}
            </span>
            <div className="absolute top-3 right-3">
              <AvailabilityToggle on={isAvailable} onToggle={() => setIsAvailable((v) => !v)} />
            </div>
          </div>

          <div className="p-4 space-y-4 shrink-0">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={13} className="text-primary" aria-hidden="true" />
              <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Item Details</p>
            </div>

            <div>
              <label className={labelClass}>Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                minLength={2}
                placeholder="Flat White"
                className={cn(inputClass, 'h-10 text-base font-medium')}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Category</label>
                <Select
                  value={categoryId}
                  onValueChange={setCategoryId}
                  options={categories
                    .filter((entry) => entry.isActive || entry.id === item?.categoryId)
                    .map((entry) => ({ value: entry.id, label: entry.name }))}
                  ariaLabel="Menu item category"
                  className={selectClass}
                />
              </div>
              <div>
                <label className={labelClass}>Price</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">£</span>
                  <input
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    required
                    inputMode="decimal"
                    pattern="^\d+(\.\d{1,2})?$"
                    placeholder="3.20"
                    className={cn(inputClass, 'pl-7 tabular-nums')}
                  />
                </div>
              </div>
            </div>

            {/* Only meaningful for a VAT-registered tenant — otherwise no rate
                applies to anything and the field is pure noise. */}
            {vat.vatRegistered && (
              <div>
                <label className={labelClass}>VAT rate</label>
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
                  className={selectClass}
                />
                <p className="mt-1.5 text-label text-muted-foreground">
                  Hot food and drink are standard-rated; most cold takeaway food is zero-rated. This changes the margin shown, not the
                  price.
                </p>
              </div>
            )}
            <div>
              <label className={labelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Optional — a short note shown to staff"
                className={inputClass + ' h-auto py-2 resize-none'}
              />
            </div>
            <div>
              <label className={labelClass}>Image URL</label>
              <input
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value);
                  setImageBroken(false);
                }}
                placeholder="https://…"
                className={inputClass}
              />
              <p className="mt-1.5 text-label text-muted-foreground">Paste a link — the preview above updates as you type.</p>
            </div>
          </div>
        </section>

        <section className="bg-band border border-rule rounded-sm p-4 flex-1 w-full">
          <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro mb-3">Modifiers</p>
          {item ? (
            <ItemModifiersEditor menuItemId={item.id} tenantId={item.tenantId} />
          ) : (
            <p className="text-xs text-muted-foreground">Modifiers (milk, size, syrups…) can be attached right after creating the item.</p>
          )}
        </section>
      </div>

      {/* Recipe / ingredients — drives usage recording, forecasts and COGS/margin */}
      {item && (
        <section className="bg-band border border-rule rounded-sm p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Recipe &amp; Cost</p>
            <Button type="button" size="sm" onClick={onOpenRecipe} className="gap-1.5">
              <ChefHat size={14} />
              Edit Recipe
            </Button>
          </div>
          <RecipeSummaryChips menuItemId={item.id} price={price || item.price} vatRate={vatRate.trim() === '' ? null : vatRate.trim()} />
        </section>
      )}

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
    </form>
  );
}
