'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2, UtensilsCrossed } from 'lucide-react';
import { useState } from 'react';

import {
  CATEGORY_COLORS,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  FormActions,
  inputClass,
  labelClass,
  selectClass,
} from '@/components/menu/shared';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';

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
      <label className={labelClass}>Modifiers</label>
      {all.length === 0 ? (
        <p className="text-xs text-muted-foreground">No modifiers exist yet. Create some in the Modifiers tab first.</p>
      ) : (
        <div className="flex flex-col gap-2 mt-1 max-h-52 overflow-y-auto pr-1">
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

function MenuItemForm({ tenantId, item, onClose }: { tenantId: string; item?: MenuItem; onClose: () => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState(item?.name ?? '');
  const [category, setCategory] = useState<MenuCategory>(item?.category ?? 'coffee');
  const [price, setPrice] = useState(item?.price ?? '');
  const [description, setDescription] = useState(item?.description ?? '');
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? '');
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);

  const { mutate, isPending, error } = useMutation({
    mutationFn: () => {
      const payload = { name, category, price, description: description || undefined, imageUrl: imageUrl || undefined, isAvailable };
      return item ? updateMenuItem(item.id, payload) : createMenuItem({ tenantId, ...payload });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      onClose();
    },
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        mutate();
      }}
      className="space-y-4"
    >
      <div>
        <label className={labelClass}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Flat White"
          className={inputClass}
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
          <label className={labelClass}>Price (£)</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
            pattern="^\d+(\.\d{1,2})?$"
            placeholder="3.20"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Optional"
          className={inputClass + ' h-auto py-2 resize-none'}
        />
      </div>
      <div>
        <label className={labelClass}>Image URL</label>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className={inputClass} />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm text-foreground">Available</span>
      </label>

      {item && (
        <div className="border-t border-border pt-4">
          <ItemModifiersEditor menuItemId={item.id} />
        </div>
      )}

      {error && <p className="text-xs text-destructive">{(error as Error).message}</p>}
      <FormActions onClose={onClose} isPending={isPending} isEdit={!!item} />
    </form>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export function MenuItemsPanel({ createOpen, onCreateOpenChange }: { createOpen: boolean; onCreateOpenChange: (open: boolean) => void }) {
  const qc = useQueryClient();
  const { tenantId } = useWorkspaceStore();
  const [editItem, setEditItem] = useState<MenuItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<MenuItem | null>(null);
  const closeCreate = () => onCreateOpenChange(false);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: getMenuItems,
    enabled: !!tenantId,
  });

  const removeMutation = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      setDeleteItem(null);
      toast('success', 'Menu item deleted.');
    },
    onError: (err) => toast('error', err.message || 'Failed to delete the menu item.'),
  });

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 min-h-0 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
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
              ) : (
                items.map((item) => (
                  <tr
                    key={item.id}
                    className="group border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors cursor-pointer"
                    onClick={() => setEditItem(item)}
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
                          {item.description && <p className="text-xs text-muted-foreground truncate max-w-xs">{item.description}</p>}
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
                    <td className="px-3 md:px-5 py-3.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-bold uppercase tracking-wide',
                          item.isAvailable
                            ? 'bg-success/10 text-success border-success/30'
                            : 'bg-muted text-muted-foreground border-border',
                        )}
                      >
                        <span
                          className={cn('w-1.5 h-1.5 rounded-full shrink-0', item.isAvailable ? 'bg-success' : 'bg-muted-foreground')}
                        />
                        {item.isAvailable ? 'Available' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-3 md:px-5 py-3.5 pr-4 md:pr-6 text-right" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => setDeleteItem(item)}
                        className="w-7 h-7 inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors md:opacity-0 md:group-hover:opacity-100"
                        aria-label={`Delete ${item.name}`}
                      >
                        <Trash2 size={13} />
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
              {items.length} {items.length === 1 ? 'item' : 'items'} · {items.filter((i) => i.isAvailable).length} available
            </p>
          </div>
        )}
      </div>

      {createOpen && tenantId && (
        <Modal title="New Menu Item" onClose={closeCreate}>
          <MenuItemForm tenantId={tenantId} onClose={closeCreate} />
        </Modal>
      )}
      {editItem && tenantId && (
        <Modal title="Edit Menu Item" onClose={() => setEditItem(null)}>
          <MenuItemForm tenantId={tenantId} item={editItem} onClose={() => setEditItem(null)} />
        </Modal>
      )}
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
