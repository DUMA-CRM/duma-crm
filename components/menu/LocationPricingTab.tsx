'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Save } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';

import {
  addLocationMenuItem,
  addLocationModifier,
  getAllModifiers,
  getLocationMenuItems,
  getLocationModifiers,
  getMenuItems,
  getModifierGroups,
  removeLocationMenuItem,
  removeLocationModifier,
  updateLocationMenuItem,
  updateLocationModifier,
} from '@/lib/api/menu.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { LocationMenuItem, LocationModifier, MenuItem, Modifier, ModifierGroup } from '@/types/menu';

import { CATEGORY_LABELS, MODIFIER_TYPE_LABELS } from './shared';

// ── Shared row shell ──────────────────────────────────────────────────────────

function PriceRow({
  name,
  sub,
  basePriceLabel,
  enabled,
  price,
  onEnabledChange,
  onPriceChange,
  onSave,
  isSaving,
  isDirty,
}: {
  name: string;
  sub: string;
  basePriceLabel: string;
  enabled: boolean;
  price: string;
  onEnabledChange: (v: boolean) => void;
  onPriceChange: (v: string) => void;
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors',
        enabled ? 'bg-card border-border' : 'bg-muted/30 border-border/50',
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', enabled ? 'text-foreground' : 'text-muted-foreground')}>{name}</p>
        <p className="text-xs text-muted-foreground">
          {sub} · base {basePriceLabel}
        </p>
      </div>
      {/* Toggle */}
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" className="sr-only peer" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
        <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
      </label>
      {/* Price override */}
      <div className="relative w-28 shrink-0">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">£</span>
        <input
          type="text"
          value={price}
          onChange={(e) => onPriceChange(e.target.value)}
          disabled={!enabled}
          pattern="^-?\d+(\.\d{1,2})?$"
          className="w-full h-9 bg-background border border-border rounded-lg pl-6 pr-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
        />
      </div>
      {/* Save */}
      <button
        disabled={!isDirty || isSaving}
        onClick={onSave}
        className={cn(
          'h-9 w-9 flex items-center justify-center rounded-lg transition-colors shrink-0',
          isDirty ? 'bg-primary hover:bg-primary-hover text-white' : 'bg-muted text-muted-foreground cursor-default',
        )}
        aria-label="Save"
      >
        <Save size={14} aria-hidden="true" />
      </button>
    </div>
  );
}

// ── Menu items section ────────────────────────────────────────────────────────

function MenuItemsSection({ locationId, menuItems }: { locationId: string; menuItems: MenuItem[] }) {
  const qc = useQueryClient();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['location-menu-items', locationId],
    queryFn: () => getLocationMenuItems(locationId),
  });

  const linkMap = Object.fromEntries(links.map((l) => [l.menuItemId, l]));

  const addMutation = useMutation({
    mutationFn: ({ menuItemId, priceOverride }: { menuItemId: string; priceOverride?: string }) =>
      addLocationMenuItem(locationId, menuItemId, priceOverride),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-menu-items', locationId] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateLocationMenuItem>[1] }) => updateLocationMenuItem(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-menu-items', locationId] }),
  });
  const removeMutation = useMutation({
    mutationFn: removeLocationMenuItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-menu-items', locationId] }),
  });

  const isSaving = addMutation.isPending || updateMutation.isPending || removeMutation.isPending;

  if (isLoading)
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );

  return (
    <div className="flex flex-col gap-2">
      {menuItems.map((item) => {
        const link = linkMap[item.id];
        return (
          <MenuItemRow
            key={item.id}
            item={item}
            link={link}
            isSaving={isSaving}
            onSave={({ enabled, priceOverride }) => {
              if (!link && enabled) {
                addMutation.mutate({ menuItemId: item.id, priceOverride: priceOverride || undefined });
              } else if (link && !enabled) {
                removeMutation.mutate(link.id);
              } else if (link) {
                updateMutation.mutate({ id: link.id, data: { isAvailable: enabled, priceOverride: priceOverride || undefined } });
              }
            }}
          />
        );
      })}
    </div>
  );
}

function MenuItemRow({
  item,
  link,
  isSaving,
  onSave,
}: {
  item: MenuItem;
  link?: LocationMenuItem;
  isSaving: boolean;
  onSave: (args: { enabled: boolean; priceOverride: string }) => void;
}) {
  const [enabled, setEnabled] = useState(link ? link.isAvailable : false);
  const [price, setPrice] = useState(link?.priceOverride ?? '');
  const isDirty = enabled !== (link ? link.isAvailable : false) || price !== (link?.priceOverride ?? '');

  return (
    <PriceRow
      name={item.name}
      sub={CATEGORY_LABELS[item.category]}
      basePriceLabel={`£${item.basePrice}`}
      enabled={enabled}
      price={price}
      onEnabledChange={setEnabled}
      onPriceChange={setPrice}
      onSave={() => onSave({ enabled, priceOverride: price })}
      isSaving={isSaving}
      isDirty={isDirty}
    />
  );
}

// ── Modifiers section ─────────────────────────────────────────────────────────

function ModifiersSection({ locationId, modifiers, groups }: { locationId: string; modifiers: Modifier[]; groups: ModifierGroup[] }) {
  const qc = useQueryClient();

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['location-modifiers', locationId],
    queryFn: () => getLocationModifiers(locationId),
  });

  const linkMap = Object.fromEntries(links.map((l) => [l.modifierId, l]));
  const groupById = Object.fromEntries(groups.map((g) => [g.id, g]));

  const addMutation = useMutation({
    mutationFn: ({ modifierId, priceOverride }: { modifierId: string; priceOverride?: string }) =>
      addLocationModifier(locationId, modifierId, priceOverride),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-modifiers', locationId] }),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof updateLocationModifier>[1] }) => updateLocationModifier(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-modifiers', locationId] }),
  });
  const removeMutation = useMutation({
    mutationFn: removeLocationModifier,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['location-modifiers', locationId] }),
  });

  const isSaving = addMutation.isPending || updateMutation.isPending || removeMutation.isPending;

  if (isLoading)
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
        ))}
      </div>
    );

  if (modifiers.length === 0)
    return <p className="text-sm text-muted-foreground py-4">No modifiers found. Create them in the Modifiers tab.</p>;

  return (
    <div className="flex flex-col gap-2">
      {modifiers.map((mod) => {
        const link = linkMap[mod.id];
        const groupName = groupById[mod.groupId]?.name;
        return (
          <ModifierRow
            key={mod.id}
            modifier={mod}
            groupName={groupName}
            link={link}
            isSaving={isSaving}
            onSave={({ enabled, priceOverride }) => {
              if (!link && enabled) {
                addMutation.mutate({ modifierId: mod.id, priceOverride: priceOverride || undefined });
              } else if (link && !enabled) {
                removeMutation.mutate(link.id);
              } else if (link) {
                updateMutation.mutate({ id: link.id, data: { isAvailable: enabled, priceOverride: priceOverride || undefined } });
              }
            }}
          />
        );
      })}
    </div>
  );
}

function ModifierRow({
  modifier,
  groupName,
  link,
  isSaving,
  onSave,
}: {
  modifier: Modifier;
  groupName?: string;
  link?: LocationModifier;
  isSaving: boolean;
  onSave: (args: { enabled: boolean; priceOverride: string }) => void;
}) {
  const [enabled, setEnabled] = useState(link ? link.isAvailable : false);
  const [price, setPrice] = useState(link?.priceOverride ?? '');
  const isDirty = enabled !== (link ? link.isAvailable : false) || price !== (link?.priceOverride ?? '');

  const sub = [groupName, MODIFIER_TYPE_LABELS[modifier.type]].filter(Boolean).join(' · ');
  const basePriceLabel = modifier.priceAdjust ? `${Number(modifier.priceAdjust) >= 0 ? '+' : ''}£${modifier.priceAdjust}` : '£0.00';

  return (
    <PriceRow
      name={modifier.name}
      sub={sub}
      basePriceLabel={basePriceLabel}
      enabled={enabled}
      price={price}
      onEnabledChange={setEnabled}
      onPriceChange={setPrice}
      onSave={() => onSave({ enabled, priceOverride: price })}
      isSaving={isSaving}
      isDirty={isDirty}
    />
  );
}

// ── Tab ───────────────────────────────────────────────────────────────────────

export function LocationPricingTab() {
  const { tenantId, locationId, setLocationId } = useWorkspaceStore();

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: menuItems = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['menu-items'],
    queryFn: getMenuItems,
    enabled: !!tenantId,
  });

  const { data: modifiers = [], isLoading: modifiersLoading } = useQuery({
    queryKey: ['modifiers-all'],
    queryFn: getAllModifiers,
    enabled: !!tenantId,
  });

  const { data: groups = [] } = useQuery({
    queryKey: ['modifier-groups'],
    queryFn: getModifierGroups,
    enabled: !!tenantId,
  });

  if (!tenantId) {
    return <EmptyState icon={MapPin} title="No workspace selected" description="Select a workspace in Workspaces first." />;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Location picker */}
      <div className="flex items-center gap-3 mb-6">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest shrink-0">Location</p>
        <select
          value={locationId ?? ''}
          onChange={(e) => setLocationId(e.target.value || null)}
          className="h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150 cursor-pointer min-w-48"
        >
          <option value="">Select a location…</option>
          {locations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name}
            </option>
          ))}
        </select>
        {locationId && (
          <p className="text-xs text-muted-foreground">Toggle items on/off and set price overrides. Each row saves individually.</p>
        )}
      </div>

      {!locationId ? (
        <EmptyState
          icon={MapPin}
          title="No location selected"
          description="Pick a location above to manage its menu and modifier prices."
        />
      ) : (
        <div className="flex-1 overflow-y-auto space-y-8 pb-4">
          {/* Menu items */}
          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Menu Items</p>
            {itemsLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : menuItems.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">No menu items found. Create them in the Items tab.</p>
            ) : (
              <MenuItemsSection locationId={locationId} menuItems={menuItems} />
            )}
          </section>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Modifiers */}
          <section>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-3">Modifiers</p>
            {modifiersLoading ? (
              <div className="flex flex-col gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-14 bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            ) : (
              <ModifiersSection locationId={locationId} modifiers={modifiers} groups={groups} />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
