'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import {
  ArrowDown,
  ArrowUp,
  Camera,
  LayoutGrid,
  Package,
  RotateCcw,
  ScanLine,
  Search,
  Star,
  Tags,
  Trash2,
  TrendingUp,
  X,
} from '@/components/icons';
import { ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { NumberStepper } from '@/components/shared/FormParts';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { hasAnyCapability, hasCapability } from '@/lib/auth/capabilities';
import { getMenuCategories, getMenuItems } from '@/lib/modules/catalog/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatPrice, movePinned, togglePinned } from '@/lib/utils/pos';
import { useAuthStore } from '@/stores/authStore';
import {
  DEFAULT_POS_LAYOUT,
  type FavouritesMode,
  type MenuLayout,
  type PosLayout,
  type ScannerMode,
  type TileStyle,
  usePosSettingsStore,
} from '@/stores/posSettingsStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConfigurationBodySkeleton, ConfigurationHeader, useMounted } from './shared';

const LAYOUTS = [
  { value: 'items', label: 'Items first', detail: 'The menu opens on items, with category tabs above.', icon: LayoutGrid },
  { value: 'categories', label: 'Categories first', detail: 'Big category tiles; tap one to see its items.', icon: Tags },
] as const;

const TILE_STYLES = [
  { value: 'photo', label: 'Photo tiles', detail: 'Item photos, four across on a tablet.' },
  { value: 'compact', label: 'Compact tiles', detail: 'Name and price only — more on screen at once.' },
] as const;

const FAVOURITES = [
  { value: 'off', label: 'Off', detail: 'No favourites tab.' },
  { value: 'pinned', label: 'Pinned items', detail: 'The items you choose, in your order.', icon: Star },
  { value: 'top', label: 'Best sellers', detail: 'This location’s top sellers, last 30 days.', icon: TrendingUp },
] as const;

const SCANNER_MODES = [
  { value: 'camera', label: 'Camera', icon: Camera },
  { value: 'external', label: 'USB scanner', icon: ScanLine },
] as const;

export function PosConfiguration() {
  const mounted = useMounted();
  const settings = usePosSettingsStore();
  const { tenantId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canReadStock =
    hasAnyCapability(capabilities, 'stock.locations:read', 'inventory:read') && hasCapability(capabilities, 'recipes:read');
  const canReadSales = hasCapability(capabilities, 'analytics:read');
  const set = (patch: Partial<PosLayout>) => settings.setLayout(patch);
  const pinned = (tenantId && settings.pinned[tenantId]) || [];
  const isDefault = (Object.keys(DEFAULT_POS_LAYOUT) as (keyof PosLayout)[]).every((key) => settings[key] === DEFAULT_POS_LAYOUT[key]);

  // The header is static; only the device-stored settings wait for mount.
  if (!mounted)
    return (
      <div className="space-y-5">
        <ConfigurationHeader
          title="Till"
          description="How the sell screen looks on this till. Changes apply straight away — no save needed."
        />
        <ConfigurationBodySkeleton label="Loading till settings" />
      </div>
    );

  return (
    <div className="space-y-5">
      <ConfigurationHeader
        title="Till"
        description="How the sell screen looks on this till. Changes apply straight away — no save needed."
      />
      <SettingsTabBody stickyAside aside={<TillPreview layout={settings} pinnedCount={pinned.length} />}>
        <SettingsSection title="Menu layout" description="How the cashier finds an item.">
          <ChoiceGrid<MenuLayout>
            label="Menu layout"
            shortcuts={false}
            selected={[settings.menuLayout]}
            onChange={(menuLayout) => set({ menuLayout })}
            choices={LAYOUTS}
          />
        </SettingsSection>

        <SettingsSection title="On the sell screen">
          <SettingRows>
            <SettingRow icon={Search} title="Search bar" description="Find an item by name across every category.">
              <Switch label="Show the search bar" checked={settings.showSearch} onChange={(showSearch) => set({ showSearch })} />
            </SettingRow>
            <SettingRow
              icon={Tags}
              title="Category tabs"
              description={
                settings.menuLayout === 'categories'
                  ? 'Not used with Categories first — the tiles take their place.'
                  : 'A row of tabs above the items.'
              }
            >
              <Switch
                label="Show category tabs"
                checked={settings.showCategories && settings.menuLayout === 'items'}
                disabled={settings.menuLayout === 'categories'}
                onChange={(showCategories) => set({ showCategories })}
              />
            </SettingRow>
          </SettingRows>
          <p className="mb-2 mt-5 text-label uppercase text-muted-foreground">Item tiles</p>
          <ChoiceGrid<TileStyle>
            label="Item tiles"
            shortcuts={false}
            selected={[settings.tileStyle]}
            onChange={(tileStyle) => set({ tileStyle })}
            choices={TILE_STYLES}
          />
        </SettingsSection>

        <SettingsSection
          title="Favourites"
          description="A first tab (or tile) with the items sold most, so the busiest orders are one tap away."
          footnote={
            settings.favourites === 'top' && !canReadSales
              ? 'Best sellers need sales reporting access (analytics:read). Without it the till shows no favourites tab.'
              : undefined
          }
        >
          <ChoiceGrid<FavouritesMode>
            label="Favourites"
            shortcuts={false}
            columns={3}
            selected={[settings.favourites]}
            onChange={(favourites) => set({ favourites })}
            choices={FAVOURITES}
          />
          {settings.favourites === 'top' && (
            <div className="mt-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">How many</p>
                <p className="text-sm text-muted-foreground">Ranked by quantity sold here in the last 30 days.</p>
              </div>
              <div className="w-44">
                <NumberStepper
                  label="Best sellers shown"
                  value={settings.topCount}
                  onChange={(topCount) => set({ topCount })}
                  min={4}
                  max={16}
                  step={2}
                />
              </div>
            </div>
          )}
          {settings.favourites === 'pinned' && tenantId && (
            <PinnedPicker pinned={pinned} onChange={(ids) => settings.setPinned(tenantId, ids)} />
          )}
        </SettingsSection>

        <SettingsSection
          title="Stock"
          footnote="Read from each item’s recipe and this location’s stock counts. Items still sell when flagged — the count can lag behind the shelf."
        >
          <SettingRows>
            <SettingRow
              icon={Package}
              title="Highlight low and out-of-stock items"
              description={
                canReadStock
                  ? 'A yellow edge when an ingredient is low, red when one has run out.'
                  : 'Needs stock and recipe read access on this account — without it nothing is highlighted.'
              }
            >
              <Switch
                label="Highlight low and out-of-stock items"
                checked={settings.stockHighlight}
                onChange={(stockHighlight) => set({ stockHighlight })}
              />
            </SettingRow>
          </SettingRows>
        </SettingsSection>

        <SettingsSection title="Ticket">
          <SettingRows>
            <SettingRow
              icon={Trash2}
              title="Swipe to remove"
              description="Swipe a line left to show Remove, or all the way to remove it. Undo stays on screen for five seconds."
            >
              <Switch
                label="Swipe to remove ticket lines"
                checked={settings.swipeToRemove}
                onChange={(swipeToRemove) => set({ swipeToRemove })}
              />
            </SettingRow>
          </SettingRows>
        </SettingsSection>

        <SettingsSection title="Loyalty scanner" description="How this till reads a customer’s loyalty code.">
          <ChoiceGrid<ScannerMode>
            label="Loyalty scanner mode"
            shortcuts={false}
            selected={[settings.scannerMode]}
            onChange={settings.setScannerMode}
            choices={SCANNER_MODES}
          />
        </SettingsSection>

        <div className="flex justify-end">
          <Button variant="outline" onClick={settings.resetLayout} disabled={isDefault} className="gap-2">
            <RotateCcw size={15} aria-hidden="true" /> Reset layout to defaults
          </Button>
        </div>
      </SettingsTabBody>
    </div>
  );
}

// ── Pinned favourites ────────────────────────────────────────────────────────

function PinnedPicker({ pinned, onChange }: { pinned: string[]; onChange: (ids: string[]) => void }) {
  const { tenantId } = useWorkspaceStore();
  const [query, setQuery] = useState('');
  const items = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-items', tenantId),
    queryFn: () => getMenuItems(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: categories = [] } = useQuery({
    queryKey: moduleQueryKeys.catalog.key('menu-categories', tenantId),
    queryFn: () => getMenuCategories(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const categoryName = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);
  const available = (items.data ?? []).filter((item) => item.isAvailable);
  const byId = new Map(available.map((item) => [item.id, item]));
  const pinnedItems = pinned.map((id) => byId.get(id)).filter((item) => !!item);
  const q = query.trim().toLowerCase();
  const candidates = available.filter((item) => !pinned.includes(item.id) && (!q || item.name.toLowerCase().includes(q)));

  return (
    <div className="mt-5 space-y-4">
      <div>
        <p className="mb-2 text-label uppercase text-muted-foreground">Pinned · {pinnedItems.length}</p>
        {pinnedItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-rule px-4 py-5 text-center text-sm text-muted-foreground">
            Nothing pinned yet. Star items below — they appear on the till in this order.
          </p>
        ) : (
          <ol className="divide-y divide-rule/45 rounded-lg border border-rule/60 bg-card">
            {pinnedItems.map((item, index) => (
              <li key={item.id} className="flex items-center gap-3 py-1.5 pl-4 pr-1.5">
                <span className="w-5 text-sm tabular-nums text-muted-foreground">{index + 1}</span>
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{item.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(movePinned(pinned, item.id, -1))}
                  disabled={index === 0}
                  aria-label={`Move ${item.name} up`}
                  className="size-10"
                >
                  <ArrowUp size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(movePinned(pinned, item.id, 1))}
                  disabled={index === pinnedItems.length - 1}
                  aria-label={`Move ${item.name} down`}
                  className="size-10"
                >
                  <ArrowDown size={16} />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onChange(togglePinned(pinned, item.id))}
                  aria-label={`Unpin ${item.name}`}
                  className="size-10 text-muted-foreground"
                >
                  <X size={16} />
                </Button>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div>
        <div className="relative mb-2">
          <Search
            size={16}
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an item to pin"
            aria-label="Find an item to pin"
            className="h-10 w-full rounded-md border border-input bg-control pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured"
          />
        </div>
        {items.isLoading ? (
          <ListSkeleton rows={4} label="Loading the menu" />
        ) : items.isError ? (
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-lg border border-exception/35 bg-destructive/6 px-4 py-3 text-sm"
          >
            The menu didn’t load.
            <Button variant="outline" size="sm" onClick={() => void items.refetch()}>
              Try again
            </Button>
          </div>
        ) : candidates.length === 0 ? (
          <p className="px-1 py-3 text-sm text-muted-foreground">
            {q ? `Nothing matches “${query.trim()}”.` : 'Every item on sale is pinned.'}
          </p>
        ) : (
          <ul className="max-h-72 divide-y divide-rule/45 overflow-y-auto rounded-lg border border-rule/60 bg-card">
            {candidates.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => onChange(togglePinned(pinned, item.id))}
                  className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-band/40"
                >
                  <Star size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{item.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {categoryName.get(item.categoryId) ?? 'Uncategorised'}
                    </span>
                  </span>
                  <span data-figure className="text-sm tabular-nums text-muted-foreground">
                    {formatPrice(Math.round(Number(item.price) * 100))}
                  </span>
                  <span className="text-xs font-semibold text-primary">Pin</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Preview ──────────────────────────────────────────────────────────────────

/** A schematic of the sell screen, redrawn as the settings change. */
function TillPreview({ layout, pinnedCount }: { layout: PosLayout; pinnedCount: number }) {
  const favourites = layout.favourites !== 'off' && (layout.favourites === 'top' || pinnedCount > 0);
  const categoriesFirst = layout.menuLayout === 'categories';
  const compact = layout.tileStyle === 'compact';
  const tiles = compact ? 15 : 8;
  return (
    <SettingsSection title="Preview" description="The till on a landscape tablet.">
      <div aria-hidden="true" className="flex aspect-[4/3] overflow-hidden rounded-lg border border-rule/60 bg-background">
        <div className="flex min-w-0 flex-1 flex-col gap-1.5 p-2">
          {layout.showSearch && <div className="h-3.5 shrink-0 rounded-md border border-rule/70 bg-card" />}
          {layout.showCategories && !categoriesFirst && (
            <div className="flex shrink-0 gap-1">
              {favourites && <div className="h-3 w-8 rounded-full bg-warning/60" />}
              <div className="h-3 w-6 rounded-full bg-foreground" />
              <div className="h-3 w-9 rounded-full border border-rule/70 bg-card" />
              <div className="h-3 w-8 rounded-full border border-rule/70 bg-card" />
            </div>
          )}
          {categoriesFirst ? (
            <div className="grid flex-1 grid-cols-2 content-start gap-1.5">
              {favourites && <div className="h-10 rounded-md bg-primary" />}
              {['Coffee', 'Bakery', 'Cold', 'Food', 'Retail'].slice(0, favourites ? 3 : 4).map((name) => (
                <div key={name} className="h-10 rounded-md border border-rule/70 bg-card" />
              ))}
            </div>
          ) : (
            <div className={cn('grid flex-1 content-start gap-1', compact ? 'grid-cols-5' : 'grid-cols-4')}>
              {Array.from({ length: tiles }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'overflow-hidden rounded border bg-card',
                    layout.stockHighlight && index === 2
                      ? 'border-warning'
                      : layout.stockHighlight && index === 5
                        ? 'border-exception'
                        : 'border-rule/70',
                  )}
                >
                  {!compact && <div className="aspect-[16/10] bg-band" />}
                  <div className={cn('space-y-0.5 p-1', compact && 'py-1.5')}>
                    <div className="h-1 w-3/4 rounded bg-foreground/40" />
                    <div className="h-1 w-1/3 rounded bg-muted-foreground/40" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex w-[30%] shrink-0 flex-col gap-1 border-l border-rule/60 bg-card p-2">
          <div className="h-1.5 w-1/2 rounded bg-foreground/50" />
          <div className="mt-1 h-1 w-full rounded bg-rule/80" />
          <div className="h-1 w-5/6 rounded bg-rule/80" />
          <div className="mt-auto h-4 rounded bg-primary" />
        </div>
      </div>
      <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
        <li>
          {categoriesFirst
            ? 'Opens on category tiles.'
            : layout.showCategories
              ? 'Opens on items with category tabs.'
              : 'Opens on every item, no tabs.'}
        </li>
        {favourites && (
          <li>
            {layout.favourites === 'top'
              ? `Best sellers (${layout.topCount}) come first.`
              : `${pinnedCount} pinned item${pinnedCount === 1 ? '' : 's'} come first.`}
          </li>
        )}
        {!layout.showSearch && <li>No search bar.</li>}
        {layout.swipeToRemove && <li>Swipe a ticket line left to remove it.</li>}
      </ul>
    </SettingsSection>
  );
}
