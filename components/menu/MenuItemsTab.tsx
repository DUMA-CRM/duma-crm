'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageOff, MapPin, Pencil, Plus, UtensilsCrossed } from 'lucide-react';
import { useMemo, useState } from 'react';

import { StockLinker } from '@/components/inventory/StockLinker';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';

import {
  addLocationMenuItem,
  createMenuItem,
  deleteMenuItem,
  getLocationMenuItems,
  getMenuItemModifierGroups,
  getMenuItems,
  getModifierGroups,
  removeLocationMenuItem,
  updateLocationMenuItem,
  updateMenuItem,
} from '@/lib/api/menu.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { LocationMenuItem, MenuItem, MenuItemPayload } from '@/types/menu';

import { ModifierGroupLinker } from './ModifierGroupLinker';
import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_OPTIONS, FormActions, inputClass, selectClass } from './shared';

// ── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus-visible:outline-none disabled:opacity-40',
        checked ? 'bg-success' : 'bg-muted',
      )}
    >
      <span
        className={cn(
          'pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-4.5' : 'translate-x-0.75',
        )}
      />
    </button>
  );
}

// ── Item card ─────────────────────────────────────────────────────────────────

function MenuItemCard({
  item,
  locLink,
  locationId,
  groupNames,
  onEdit,
  onToggleBase,
  onToggleLoc,
  isToggling,
}: {
  item: MenuItem;
  locLink: LocationMenuItem | undefined;
  locationId: string | null;
  groupNames: string[];
  onEdit: () => void;
  onToggleBase: () => void;
  onToggleLoc: () => void;
  isToggling: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  const inLocationMode = !!locationId;
  const effectivePrice = locLink?.priceOverride ?? item.basePrice;
  const hasOverride = !!locLink?.priceOverride;
  const isAvailable = inLocationMode ? (locLink?.isAvailable ?? false) : item.isAvailable;
  const locationStatus = inLocationMode ? (locLink ? (locLink.isAvailable ? 'Enabled' : 'Disabled') : 'Not added') : null;

  return (
    <div
      className={cn(
        'group relative bg-card border rounded-xl overflow-hidden flex flex-col transition-colors',
        inLocationMode && !locLink ? 'border-border opacity-60' : 'border-border hover:border-primary/30',
      )}
    >
      {/* Image */}
      <div className="relative aspect-video bg-muted shrink-0 overflow-hidden">
        {item.imageUrl && !imgError ? (
          <img src={item.imageUrl} alt={item.name} onError={() => setImgError(true)} className="w-full h-full object-cover" />
        ) : (
          <div
            className={cn(
              'w-full h-full flex items-center justify-center',
              CATEGORY_COLORS[item.category] ?? 'bg-muted text-muted-foreground',
            )}
          >
            {imgError ? (
              <ImageOff size={20} className="opacity-40" aria-hidden="true" />
            ) : (
              <span className="text-2xl font-bold opacity-30 select-none">{item.name[0]?.toUpperCase()}</span>
            )}
          </div>
        )}

        {/* Edit button overlay */}
        <button
          onClick={onEdit}
          className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center rounded-lg bg-black/40 text-white opacity-0 group-hover:opacity-100 hover:bg-black/60 transition-all"
          aria-label={`Edit ${item.name}`}
        >
          <Pencil size={12} aria-hidden="true" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-2 px-3 pt-2.5 pb-3 flex-1">
        {/* Name + description */}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
          {item.description && <p className="text-xs text-muted-foreground truncate mt-0.5">{item.description}</p>}
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className={cn('text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full', CATEGORY_COLORS[item.category])}
          >
            {CATEGORY_LABELS[item.category]}
          </span>
          {inLocationMode && (
            <span
              className={cn(
                'text-[10px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full',
                locLink
                  ? locLink.isAvailable
                    ? 'bg-success/10 text-success'
                    : 'bg-muted text-muted-foreground'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {locationStatus}
            </span>
          )}
        </div>

        {/* Modifier group chips */}
        {groupNames.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {groupNames.map((name) => (
              <span key={name} className="text-[10px] px-1.5 py-0.5 rounded bg-surface-offset text-muted-foreground font-medium">
                {name}
              </span>
            ))}
          </div>
        )}

        {/* Price + toggle */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base font-bold text-foreground">£{effectivePrice}</span>
            {hasOverride && <span className="text-xs text-muted-foreground line-through">£{item.basePrice}</span>}
          </div>
          <Toggle checked={isAvailable} onChange={inLocationMode ? onToggleLoc : onToggleBase} disabled={isToggling} />
        </div>
      </div>
    </div>
  );
}

// ── Base item form ────────────────────────────────────────────────────────────

function MenuItemForm({
  initial,
  tenantId,
  onSubmit,
  onClose,
  onDelete,
  isPending,
}: {
  initial?: MenuItem;
  tenantId: string;
  onSubmit: (data: MenuItemPayload) => void;
  onClose: () => void;
  onDelete?: () => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [category, setCategory] = useState<MenuItemPayload['category']>(initial?.category ?? 'coffee');
  const [basePrice, setBasePrice] = useState(initial?.basePrice ?? '');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [isAvailable, setIsAvailable] = useState(initial?.isAvailable ?? true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({
          tenantId,
          name,
          description: description || undefined,
          category,
          basePrice,
          imageUrl: imageUrl || undefined,
          isAvailable,
        });
      }}
      className="space-y-4"
    >
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          placeholder="Flat White"
          className={inputClass}
        />
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as MenuItemPayload['category'])} className={selectClass}>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Base Price (£)</label>
          <input
            value={basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            required
            pattern="^\d+(\.\d{1,2})?$"
            placeholder="3.50"
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">Image URL</label>
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" type="url" className={inputClass} />
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
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="w-full h-9 border border-destructive/30 text-destructive text-sm font-medium rounded-xl hover:bg-destructive/10 transition-colors"
        >
          Delete item
        </button>
      )}
      <FormActions onClose={onClose} isPending={isPending} isEdit={!!initial} />
    </form>
  );
}

// ── Location pricing form ─────────────────────────────────────────────────────

function LocationMenuItemForm({
  item,
  link,
  onClose,
  onSave,
  onRemove,
  isPending,
}: {
  item: MenuItem;
  link: LocationMenuItem | undefined;
  onClose: () => void;
  onSave: (priceOverride: string | undefined, isAvailable: boolean) => void;
  onRemove: (() => void) | undefined;
  isPending: boolean;
}) {
  const [priceOverride, setPriceOverride] = useState(link?.priceOverride ?? '');
  const [isAvailable, setIsAvailable] = useState(link?.isAvailable ?? true);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(priceOverride.trim() || undefined, isAvailable);
      }}
      className="space-y-4"
    >
      <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-lg">
        <span className="text-sm text-muted-foreground">Base price</span>
        <span className="text-sm font-semibold text-foreground">£{item.basePrice}</span>
      </div>
      <div>
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5">
          Location Price Override (£)
        </label>
        <input
          value={priceOverride}
          onChange={(e) => setPriceOverride(e.target.value)}
          pattern="^\d+(\.\d{1,2})?$"
          placeholder={`Leave empty to use base (£${item.basePrice})`}
          className={inputClass}
        />
      </div>
      <label className="flex items-center gap-2.5 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={isAvailable}
          onChange={(e) => setIsAvailable(e.target.checked)}
          className="w-4 h-4 rounded accent-primary"
        />
        <span className="text-sm text-foreground">Available at this location</span>
      </label>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="w-full h-9 border border-destructive/30 text-destructive text-sm font-medium rounded-xl hover:bg-destructive/10 transition-colors"
        >
          Remove from location
        </button>
      )}
      <FormActions onClose={onClose} isPending={isPending} isEdit={!!link} />
    </form>
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

type ModalState = { mode: 'create' } | { mode: 'edit'; item: MenuItem };

export function MenuItemsTab() {
  const qc = useQueryClient();
  const { tenantId, locationId } = useWorkspaceStore();
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [modal, setModal] = useState<ModalState | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: getMenuItems,
    enabled: !!tenantId,
  });

  const { data: allGroups = [] } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: getModifierGroups,
    enabled: !!tenantId,
  });

  const { data: locationLinks = [] } = useQuery({
    queryKey: ['location-menu-items', locationId],
    queryFn: () => getLocationMenuItems(locationId!),
    enabled: !!locationId,
  });

  // Per-item modifier group links
  const itemGroupQueries = useQueries({
    queries: items.map((item) => ({
      queryKey: ['menu-item-modifier-groups', item.id],
      queryFn: () => getMenuItemModifierGroups(item.id),
      enabled: !!tenantId,
    })),
  });

  const groupById = useMemo(() => Object.fromEntries(allGroups.map((g) => [g.id, g])), [allGroups]);

  const itemGroupNames = useMemo(() => {
    return Object.fromEntries(
      items.map((item, i) => [
        item.id,
        (itemGroupQueries[i]?.data ?? []).map((l) => groupById[l.modifierGroupId]?.name).filter((n): n is string => !!n),
      ]),
    );
  }, [items, itemGroupQueries, groupById]);

  // Base item mutations
  const createMutation = useMutation({
    mutationFn: createMenuItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      setModal(null);
    },
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateMenuItem>[1] }) => updateMenuItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }),
  });
  const deleteMutation = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-items'] });
      setModal(null);
    },
  });

  // Location item mutations
  const addLocMutation = useMutation({
    mutationFn: ({ menuItemId, priceOverride }: { menuItemId: string; priceOverride?: string }) =>
      addLocationMenuItem(locationId!, menuItemId, priceOverride),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-menu-items', locationId] }),
  });
  const updateLocMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateLocationMenuItem>[1] }) => updateLocationMenuItem(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-menu-items', locationId] });
      setModal(null);
    },
  });
  const removeLocMutation = useMutation({
    mutationFn: removeLocationMenuItem,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['location-menu-items', locationId] });
      setModal(null);
    },
  });

  const linkByItemId = useMemo(() => Object.fromEntries(locationLinks.map((l) => [l.menuItemId, l])), [locationLinks]);

  const isToggling = updateMutation.isPending || addLocMutation.isPending || updateLocMutation.isPending;
  const isPending =
    createMutation.isPending ||
    updateMutation.isPending ||
    deleteMutation.isPending ||
    addLocMutation.isPending ||
    updateLocMutation.isPending ||
    removeLocMutation.isPending;

  const filtered = categoryFilter === 'all' ? items : items.filter((i) => i.category === categoryFilter);

  function handleToggleBase(item: MenuItem) {
    updateMutation.mutate({ id: item.id, data: { isAvailable: !item.isAvailable } });
  }

  function handleToggleLoc(item: MenuItem) {
    const link = linkByItemId[item.id];
    if (link) {
      updateLocMutation.mutate({ id: link.id, data: { isAvailable: !link.isAvailable } });
    } else {
      addLocMutation.mutate({ menuItemId: item.id });
    }
  }

  function handleLocSave(item: MenuItem, priceOverride: string | undefined, isAvailable: boolean) {
    const existing = linkByItemId[item.id];
    if (existing) {
      updateLocMutation.mutate({ id: existing.id, data: { priceOverride, isAvailable } });
    } else {
      addLocMutation.mutate({ menuItemId: item.id, priceOverride });
    }
  }

  if (!tenantId) {
    return (
      <EmptyState icon={UtensilsCrossed} title="No workspace selected" description="Select a workspace in Workspaces to manage its menu." />
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        {locationId ? (
          <div className="flex items-center gap-1.5 text-xs text-primary font-medium">
            <MapPin size={13} aria-hidden="true" />
            <span>Location pricing mode</span>
          </div>
        ) : (
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="ml-auto h-9 px-3 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-lg flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Plus size={15} aria-hidden="true" />
            New item
          </button>
        )}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-3/4 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={UtensilsCrossed} title="No items" description="Create your first menu item." />
        ) : (
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-3 pb-4">
            {filtered.map((item) => (
              <MenuItemCard
                key={item.id}
                item={item}
                locLink={locationId ? linkByItemId[item.id] : undefined}
                locationId={locationId}
                groupNames={itemGroupNames[item.id] ?? []}
                onEdit={() => setModal({ mode: 'edit', item })}
                onToggleBase={() => handleToggleBase(item)}
                onToggleLoc={() => handleToggleLoc(item)}
                isToggling={isToggling}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {modal?.mode === 'create' && tenantId && (
        <Modal title="New Menu Item" onClose={() => setModal(null)}>
          <MenuItemForm
            tenantId={tenantId}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSubmit={(data) => createMutation.mutate(data)}
          />
        </Modal>
      )}

      {modal?.mode === 'edit' && tenantId && !locationId && (
        <Modal title="Edit Menu Item" onClose={() => setModal(null)} className="max-w-lg">
          <MenuItemForm
            initial={modal.item}
            tenantId={tenantId}
            onClose={() => setModal(null)}
            isPending={isPending}
            onDelete={() => deleteMutation.mutate(modal.item.id)}
            onSubmit={({ tenantId: _, ...data }) => updateMutation.mutate({ id: modal.item.id, data })}
          />
          <ModifierGroupLinker menuItemId={modal.item.id} />
          <StockLinker type="menu-item" entityId={modal.item.id} />
        </Modal>
      )}

      {modal?.mode === 'edit' && locationId && (
        <Modal title={modal.item.name} onClose={() => setModal(null)}>
          <LocationMenuItemForm
            item={modal.item}
            link={linkByItemId[modal.item.id]}
            onClose={() => setModal(null)}
            isPending={isPending}
            onSave={(price, avail) => handleLocSave(modal.item, price, avail)}
            onRemove={linkByItemId[modal.item.id] ? () => removeLocMutation.mutate(linkByItemId[modal.item.id].id) : undefined}
          />
        </Modal>
      )}
    </div>
  );
}
