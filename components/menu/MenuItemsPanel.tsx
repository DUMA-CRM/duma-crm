'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Loader2, Search, Trash2, UtensilsCrossed } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import {
  AvailabilityToggle,
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  FormActions,
  inputClass,
  labelClass,
  selectClass,
} from '@/components/menu/shared';
import { EditorShell } from '@/components/menu/EditorShell';
import { RecipeSummaryChips } from '@/components/menu/RecipeEditorPage';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  attachModifier,
  createMenuItem,
  deleteMenuItem,
  detachModifier,
  getMenuItemModifiers,
  getMenuItems,
  getModifiers,
  setModifierDefault,
  updateMenuItem,
} from '@/lib/api/menu.service';
import { cn } from '@/lib/utils/cn';
import { groupByCategory, parseModifierName } from '@/lib/utils/modifiers';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { MenuCategory, MenuItem } from '@/types/menu';

const money = (raw: string) => `£${Number.parseFloat(raw || '0').toFixed(2)}`;
const adjust = (raw?: string) => {
  const n = Number.parseFloat(raw ?? '0');
  return n ? `${n > 0 ? '+' : '−'}£${Math.abs(n).toFixed(2)}` : '';
};

// ── Attached-modifiers editor (edit mode only) ────────────────────────────────

function ItemModifiersEditor({ menuItemId }: { menuItemId: string }) {
  const qc = useQueryClient();
  const { data: attached = [] } = useQuery({
    queryKey: ['menu-item-modifiers', menuItemId],
    queryFn: () => getMenuItemModifiers(menuItemId),
  });
  const { data: all = [] } = useQuery({ queryKey: ['modifiers'], queryFn: getModifiers });

  const attachedIds = new Set(attached.map((m) => m.id));
  const defaultIds = new Set(attached.filter((m) => m.isDefault).map((m) => m.id));

  const toggle = useMutation({
    mutationFn: async ({ modifierId, on }: { modifierId: string; on: boolean }) => {
      if (on) await attachModifier(menuItemId, modifierId);
      else await detachModifier(menuItemId, modifierId);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-item-modifiers', menuItemId] }),
  });

  const toggleDefault = useMutation({
    mutationFn: ({ modifierId, isDefault }: { modifierId: string; isDefault: boolean }) =>
      setModifierDefault(menuItemId, modifierId, isDefault),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-item-modifiers', menuItemId] }),
  });

  const groups = groupByCategory(all, (m) => parseModifierName(m.name).category);

  return (
    <div>
      {all.length === 0 ? (
        <p className="text-xs text-muted-foreground">No modifiers exist yet. Create some in the Modifiers tab first.</p>
      ) : (
        <div className="flex flex-col gap-2 overflow-y-auto pr-1">
          {groups.map((group) => (
            <div key={group.category}>
              <p className="px-1 pb-0.5 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{group.category}</p>
              {group.items.map((m) => {
                const isAttached = attachedIds.has(m.id);
                return (
                  <div key={m.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-muted transition-colors">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isAttached}
                        disabled={toggle.isPending}
                        onChange={(e) => toggle.mutate({ modifierId: m.id, on: e.target.checked })}
                        className="w-4 h-4 rounded accent-primary"
                      />
                      <span className="text-sm text-foreground truncate">{parseModifierName(m.name).label}</span>
                      {adjust(m.priceAdjust) && <span className="text-xs text-muted-foreground tabular-nums">{adjust(m.priceAdjust)}</span>}
                    </label>
                    {isAttached && (
                      <label
                        className="flex items-center gap-1.5 cursor-pointer select-none text-[11px] font-medium text-muted-foreground shrink-0"
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

/** Identifies which item's recipe to open in the page-level Recipe & Cost editor. */
export interface RecipeTarget {
  menuItemId: string;
  itemName: string;
  price: string;
}

function MenuItemForm({
  tenantId,
  item,
  onClose,
  onCreated,
  onOpenRecipe,
  formId,
  hideActions,
  onPendingChange,
}: {
  tenantId: string;
  item?: MenuItem;
  onClose: () => void;
  /** Called with the new item instead of onClose — the editor switches straight
   *  to edit mode so modifiers can be attached without hunting for the row. */
  onCreated?: (created: MenuItem) => void;
  /** Opens the Recipe & Cost editor at the page level. */
  onOpenRecipe: (target: RecipeTarget) => void;
  /** When set, the <form> gets this id so a Save button in the page header can submit it. */
  formId?: string;
  /** Hide the built-in Cancel/Save row (the header owns Save in the page editor). */
  hideActions?: boolean;
  /** Reports the mutation's pending state so the header Save button can reflect it. */
  onPendingChange?: (pending: boolean) => void;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<MenuCategory>(item?.category ?? 'coffee');
  const [price, setPrice] = useState(item?.price ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  const [imageBroken, setImageBroken] = useState(false);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = { name, category, price, description: description || undefined, imageUrl: imageUrl || undefined, isAvailable };
      return item ? updateMenuItem(item.id, payload) : createMenuItem({ tenantId, ...payload });
    },
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      if (!item && onCreated) {
        toast('success', 'Item created — you can attach modifiers now.');
        onCreated(saved);
        return;
      }
      toast('success', item ? 'Menu item updated.' : 'Menu item created.');
      onClose();
    },
  });

  useEffect(() => onPendingChange?.(isPending), [isPending, onPendingChange]);

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
        <section className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm flex flex-col max-w-md">
          {/* Image hero — live preview doubles as the card banner; grows to fill the card height */}
          <div className="relative flex-1 min-h-52 bg-linear-to-br from-primary/15 via-surface-offset to-surface-offset">
            {imageUrl.trim() && !imageBroken ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={imageUrl} alt="" onError={() => setImageBroken(true)} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-muted-foreground/40 select-none">
                <UtensilsCrossed size={30} aria-hidden="true" />
                <span className="text-[11px] font-semibold">{imageBroken ? 'Image didn’t load' : 'No image yet'}</span>
              </div>
            )}
            <span
              className={cn(
                'absolute top-3 left-3 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide backdrop-blur-sm',
                CATEGORY_COLORS[category],
              )}
            >
              {CATEGORY_LABELS[category]}
            </span>
            <div className="absolute top-3 right-3">
              <AvailabilityToggle on={isAvailable} onToggle={() => setIsAvailable((v) => !v)} />
            </div>
          </div>

          <div className="p-4 space-y-4 shrink-0">
            <div className="flex items-center gap-2">
              <UtensilsCrossed size={13} className="text-primary" aria-hidden="true" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Item Details</p>
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
                <select value={category} onChange={(e) => setCategory(e.target.value as MenuCategory)} className={selectClass}>
                  {CATEGORY_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
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
              <p className="mt-1.5 text-[11px] text-muted-foreground">Paste a link — the preview above updates as you type.</p>
            </div>
          </div>
        </section>

        <section className="bg-surface-offset/40 border border-border rounded-xl p-4 flex-1 w-full">
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Modifiers</p>
          {item ? (
            <ItemModifiersEditor menuItemId={item.id} />
          ) : (
            <p className="text-xs text-muted-foreground">
              Modifiers (milk, size, syrups…) can be attached right after creating the item.
            </p>
          )}
        </section>
      </div>

      {/* Recipe / ingredients — drives usage recording, forecasts and COGS/margin */}
      {item && (
        <section className="bg-surface-offset/40 border border-border rounded-xl p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Recipe &amp; Cost</p>
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenRecipe({ menuItemId: item.id, itemName: name || item.name, price: price || item.price })}
              className="gap-1.5"
            >
              <ChefHat size={14} />
              Edit Recipe
            </Button>
          </div>
          <RecipeSummaryChips menuItemId={item.id} price={price || item.price} />
        </section>
      )}

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      {!hideActions && <FormActions onClose={onClose} isPending={isPending} isEdit={!!item} />}
    </form>
  );
}

// ── In-page editor ─────────────────────────────────────────────────────────────

const MENU_ITEM_FORM_ID = 'menu-item-editor-form';

/** Full-page menu item create/edit (keeps the app sidebar + header visible). */
export function MenuItemEditorPage({
  item,
  onClose,
  onEditItem,
  onOpenRecipe,
}: {
  item?: MenuItem;
  onClose: () => void;
  /** After creating, switch the editor to edit mode for the new item. */
  onEditItem: (item: MenuItem) => void;
  onOpenRecipe: (target: RecipeTarget) => void;
}) {
  const { tenantId } = useWorkspaceStore();
  const [pending, setPending] = useState(false);
  if (!tenantId) return null;

  return (
    <EditorShell
      eyebrow="Menu Item"
      title={item ? item.name : 'New Menu Item'}
      onClose={onClose}
      actions={
        <Button type="submit" form={MENU_ITEM_FORM_ID} disabled={pending} className="h-11 px-6 gap-2">
          {pending && <Loader2 size={15} className="animate-spin" />}
          {pending ? 'Saving…' : item ? 'Update' : 'Create'}
        </Button>
      }
    >
      <MenuItemForm
        tenantId={tenantId}
        item={item}
        onClose={onClose}
        onCreated={onEditItem}
        onOpenRecipe={onOpenRecipe}
        formId={MENU_ITEM_FORM_ID}
        hideActions
        onPendingChange={setPending}
      />
    </EditorShell>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function MenuItemsPanel({
  onEdit,
}: {
  onEdit: (item: MenuItem) => void;
}) {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | MenuCategory>('all');

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: getMenuItems,
    enabled: !!tenantId,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (categoryFilter === 'all' || i.category === categoryFilter) &&
        (!q || i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)),
    );
  }, [items, search, categoryFilter]);

  const removeMutation = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      setDeleteItem(null);
      toast('success', 'Menu item deleted.');
    },
    onError: (err) => toast('error', err.message || 'Failed to delete the menu item.'),
  });

  // One-tap availability from the table row.
  const availabilityMutation = useMutation({
    mutationFn: ({ id, isAvailable }: { id: string; isAvailable: boolean }) => updateMenuItem(id, { isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
    onError: (err) => toast('error', err.message || 'Failed to update availability.'),
  });

  return (
    <div className="flex flex-col h-full">
      {/* Search + category filter */}
      {tenantId && items.length > 0 && (
        <div className="flex items-center gap-2 mb-3 shrink-0">
          <div className="flex-1 max-w-xs">
            <Input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              leftIcon={<Search size={14} />}
              placeholder="Search items…"
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'all' | MenuCategory)}
            aria-label="Filter by category"
            className={cn(selectClass, 'w-auto')}
          >
            <option value="all">All categories</option>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted">
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Item
                </th>
                <th className="hidden md:table-cell px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Category
                </th>
                <th className="px-3 md:px-5 py-3.5 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Price
                </th>
                <th className="px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Status
                </th>
                <th className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 w-16" />
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className={cn('px-3 md:px-5 py-4', j === 1 && 'hidden md:table-cell')}>
                        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: `${45 + ((i * 13 + j * 17) % 40)}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : !tenantId ? (
                <tr>
                  <td colSpan={5} className="py-24">
                    <EmptyState icon={UtensilsCrossed} title="No workspace selected" description="Select a workspace to manage the menu." />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24">
                    <EmptyState icon={UtensilsCrossed} title="No menu items" description='Click "New Item" to add your first product.' />
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-24">
                    <EmptyState icon={Search} title="No matching items" description="Try a different search or category filter." />
                  </td>
                </tr>
              ) : (
                filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="group border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                    onClick={() => onEdit(item)}
                  >
                    <td className="px-3 md:px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {item.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0 bg-muted" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                            <UtensilsCrossed size={16} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-foreground">{item.name}</p>
                          {item.description && <p className="text-xs text-muted-foreground truncate max-w-md">{item.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="hidden md:table-cell px-5 py-3.5">
                      <span
                        className={cn(
                          'inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold uppercase tracking-wide',
                          CATEGORY_COLORS[item.category],
                        )}
                      >
                        {CATEGORY_LABELS[item.category]}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3.5 text-right tabular-nums font-semibold text-foreground">{money(item.price)}</td>
                    <td className="px-3 md:px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <AvailabilityToggle
                        on={item.isAvailable}
                        pending={availabilityMutation.isPending && availabilityMutation.variables?.id === item.id}
                        onToggle={() => availabilityMutation.mutate({ id: item.id, isAvailable: !item.isAvailable })}
                      />
                    </td>
                    <td className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                      {/* Always visible — hover-reveal buttons don't exist on touch screens */}
                      <button
                        onClick={() => setDeleteItem(item)}
                        className="w-9 h-9 inline-flex items-center justify-center rounded-md text-muted-foreground/60 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {items.length > 0 && (
          <div className="px-5 py-3 border-t border-border shrink-0">
            <p className="text-xs text-muted-foreground">
              {filtered.length !== items.length && `${filtered.length} of `}
              {items.length} {items.length === 1 ? 'item' : 'items'} · {items.filter((i) => i.isAvailable).length} available
            </p>
          </div>
        )}
      </div>

      {deleteItem && (
        <ConfirmModal
          title="Delete Menu Item"
          message={
            <>
              Delete <span className="font-semibold text-foreground">{deleteItem.name}</span>? This cannot be undone.
            </>
          }
          isPending={removeMutation.isPending}
          onConfirm={() => removeMutation.mutate(deleteItem.id)}
          onClose={() => setDeleteItem(null)}
        />
      )}
    </div>
  );
}
