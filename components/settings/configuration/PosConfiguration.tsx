'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';

import { RowWarning } from '@/components/cms/rows';
import {
  ArrowDown,
  ArrowUp,
  Camera,
  Hash,
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
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { TillHardwareSummary } from '@/components/settings/connectors/TillHardwareConnector';
import { ChangeRow, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { ChoiceCards, NumberStepper } from '@/components/shared/FormParts';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { hasAnyCapability, hasCapability } from '@/lib/auth/capabilities';
import { useModuleEnabled } from '@/lib/hooks/useModuleEnabled';
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

import { ConfigurationBodySkeleton, ConfigurationFoot, PreviewFrame, useMounted } from './shared';

const LAYOUTS: { value: MenuLayout; label: string; icon: typeof Tags }[] = [
  { value: 'items', label: 'Items first', icon: LayoutGrid },
  { value: 'categories', label: 'Categories first', icon: Tags },
];

const TILE_STYLES: { value: TileStyle; label: string }[] = [
  { value: 'compact', label: 'Text keys' },
  { value: 'photo', label: 'Photo keys' },
];

const FAVOURITES: { value: FavouritesMode; label: string; icon?: typeof Star }[] = [
  { value: 'off', label: 'Off' },
  { value: 'pinned', label: 'Pinned items', icon: Star },
  { value: 'top', label: 'Best sellers', icon: TrendingUp },
];

const SCANNER_MODES: { value: ScannerMode; label: string; icon: typeof Camera }[] = [
  { value: 'camera', label: 'Camera', icon: Camera },
  { value: 'external', label: 'USB scanner', icon: ScanLine },
];

const labelOf = <T extends string>(options: readonly { value: T; label: string }[], value: T) =>
  options.find((option) => option.value === value)?.label ?? value;

type Row = 'menuLayout' | 'tileStyle' | 'favourites' | 'topCount' | 'pinned' | 'scanner';

/**
 * This till's sell screen. Laid out like Settings → Account: each setting a row
 * whose value is the content — a choice opens under its row and applies on the
 * pick, a switch sits at the row's edge — with the live sell screen in the rail.
 * Nothing to save: the store applies every change at once.
 */
export function PosConfiguration() {
  const mounted = useMounted();
  const settings = usePosSettingsStore();
  const { tenantId } = useWorkspaceStore();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canReadStock =
    hasAnyCapability(capabilities, 'stock.locations:read', 'inventory:read') && hasCapability(capabilities, 'recipes:read');
  const canReadSales = hasCapability(capabilities, 'analytics:read');
  const analyticsOn = useModuleEnabled('analytics');
  const set = (patch: Partial<PosLayout>) => settings.setLayout(patch);
  const pinned = (tenantId && settings.pinned[tenantId]) || [];
  const isDefault = (Object.keys(DEFAULT_POS_LAYOUT) as (keyof PosLayout)[]).every((key) => settings[key] === DEFAULT_POS_LAYOUT[key]);
  // One row open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<Row | null>(null);
  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  /** A choice applies on the pick and folds its row back up. */
  const pick = (patch: Partial<PosLayout>) => {
    set(patch);
    setOpen(null);
  };

  if (!mounted) return <ConfigurationBodySkeleton label="Loading till settings" />;

  const categoriesFirst = settings.menuLayout === 'categories';
  /** An on/off setting: its state as the value, the switch at the right edge. */
  const switchRow = (
    key: 'showSearch' | 'swipeToRemove' | 'stockHighlight',
    icon: typeof Search,
    label: string,
    on: string,
    switchLabel: string,
  ) => (
    <ChangeRow
      icon={icon}
      label={label}
      value={settings[key] ? on : <ValueMissing>Off</ValueMissing>}
      trailing={<Switch label={switchLabel} checked={settings[key]} onChange={(next) => set({ [key]: next })} />}
    />
  );

  return (
    <SettingsTabBody narrowAside stickyAside aside={<TillPreview layout={settings} pinnedCount={pinned.length} />}>
      {/* Two stacked columns, not paired rows: a short card never leaves a gap beside a tall one. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <SettingsSection title="Sell screen" footnote="Flagged items still sell — the stock count can lag behind the shelf.">
            <div>
              <ChangeRow
                icon={categoriesFirst ? Tags : LayoutGrid}
                label="Menu"
                value={labelOf(LAYOUTS, settings.menuLayout)}
                open={open === 'menuLayout'}
                onToggle={() => toggle('menuLayout')}
              >
                <ChoiceCards<MenuLayout>
                  appearance="settings"
                  value={settings.menuLayout}
                  onChange={(menuLayout) => pick({ menuLayout })}
                  options={LAYOUTS}
                />
              </ChangeRow>
              <ChangeRow
                icon={LayoutGrid}
                label="Item keys"
                value={labelOf(TILE_STYLES, settings.tileStyle)}
                open={open === 'tileStyle'}
                onToggle={() => toggle('tileStyle')}
              >
                <ChoiceCards<TileStyle>
                  appearance="settings"
                  value={settings.tileStyle}
                  onChange={(tileStyle) => pick({ tileStyle })}
                  options={TILE_STYLES}
                />
              </ChangeRow>
              {switchRow('showSearch', Search, 'Search bar', 'Shown', 'Show the search bar')}
              <ChangeRow
                icon={Tags}
                label="Category tabs"
                value={
                  categoriesFirst ? (
                    <ValueMissing>Not used with Categories first</ValueMissing>
                  ) : settings.showCategories ? (
                    'Shown'
                  ) : (
                    <ValueMissing>Off</ValueMissing>
                  )
                }
                trailing={
                  <Switch
                    label="Show category tabs"
                    checked={settings.showCategories && !categoriesFirst}
                    disabled={categoriesFirst}
                    onChange={(showCategories) => set({ showCategories })}
                  />
                }
              />
              {switchRow('stockHighlight', Package, 'Stock warnings', 'Low and out of stock', 'Highlight low and out-of-stock items')}
              {switchRow('swipeToRemove', Trash2, 'Swipe to remove', 'On', 'Swipe to remove ticket lines')}
            </div>
            {settings.stockHighlight && !canReadStock && (
              <RowWarning className="mt-4">
                Needs stock and recipe read access on this account — without it nothing is highlighted.
              </RowWarning>
            )}
          </SettingsSection>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <SettingsSection title="Favourites">
            <div>
              <ChangeRow
                icon={settings.favourites === 'top' ? TrendingUp : Star}
                label="Favourites tab"
                value={
                  settings.favourites === 'off' ? (
                    <ValueMissing>Off</ValueMissing>
                  ) : settings.favourites === 'top' ? (
                    <>
                      <span className="truncate">Best sellers</span>
                      <ValueAside>· here, last 30 days</ValueAside>
                    </>
                  ) : (
                    'Pinned items'
                  )
                }
                open={open === 'favourites'}
                onToggle={() => toggle('favourites')}
              >
                <ChoiceCards<FavouritesMode>
                  appearance="settings"
                  columns={3}
                  value={settings.favourites}
                  onChange={(favourites) => pick({ favourites })}
                  options={FAVOURITES}
                />
              </ChangeRow>
              {settings.favourites === 'top' && (
                <ChangeRow
                  icon={Hash}
                  label="Best sellers shown"
                  value={`${settings.topCount} items`}
                  open={open === 'topCount'}
                  onToggle={() => toggle('topCount')}
                  verbs={['Change', 'Done']}
                >
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
                </ChangeRow>
              )}
              {settings.favourites === 'pinned' && tenantId && (
                <ChangeRow
                  icon={Star}
                  label="Pinned items"
                  value={
                    pinned.length ? `${pinned.length} ${pinned.length === 1 ? 'item' : 'items'}` : <ValueMissing>None yet</ValueMissing>
                  }
                  open={open === 'pinned'}
                  onToggle={() => toggle('pinned')}
                  verbs={['Change', 'Done']}
                >
                  <PinnedPicker pinned={pinned} onChange={(ids) => settings.setPinned(tenantId, ids)} />
                </ChangeRow>
              )}
            </div>
            {settings.favourites === 'top' && (!analyticsOn || !canReadSales) && (
              <RowWarning className="mt-4">
                {!analyticsOn
                  ? 'Best sellers come from Analytics, which is switched off. Turn it on in Settings → Modules — until then the till shows no favourites tab.'
                  : 'Best sellers need sales reporting access (analytics:read). Without it the till shows no favourites tab.'}
              </RowWarning>
            )}
          </SettingsSection>

          <SettingsSection title="Hardware">
            <div>
              <TillHardwareSummary />
              <ChangeRow
                icon={settings.scannerMode === 'external' ? ScanLine : Camera}
                label="Loyalty scanner"
                value={labelOf(SCANNER_MODES, settings.scannerMode)}
                open={open === 'scanner'}
                onToggle={() => toggle('scanner')}
              >
                <ChoiceCards<ScannerMode>
                  appearance="settings"
                  value={settings.scannerMode}
                  onChange={(mode) => {
                    settings.setScannerMode(mode);
                    setOpen(null);
                  }}
                  options={SCANNER_MODES}
                />
              </ChangeRow>
            </div>
          </SettingsSection>
        </div>
      </div>

      <ConfigurationFoot storage="Saved on this device.">
        <Button variant="outline" onClick={settings.resetLayout} disabled={isDefault} className="gap-2">
          <RotateCcw size={15} aria-hidden="true" /> Reset layout to defaults
        </Button>
      </ConfigurationFoot>
    </SettingsTabBody>
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
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-label uppercase text-muted-foreground">Pinned · {pinnedItems.length}</p>
        {pinnedItems.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
            Nothing pinned yet. Star items below — they appear on the till in this order.
          </p>
        ) : (
          <ol className="divide-y divide-border rounded-lg border border-border bg-card">
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
            className="h-10 w-full rounded-md border border-input bg-control pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:outline-2 focus:outline-ring/30"
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
          <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-lg border border-border bg-card">
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

const PREVIEW_KEYS = ['var(--key-1)', 'var(--key-2)', 'var(--key-3)', 'var(--key-4)'];

/** A schematic of the sell screen, redrawn as the settings change. */
function TillPreview({ layout, pinnedCount }: { layout: PosLayout; pinnedCount: number }) {
  const favourites = layout.favourites !== 'off' && (layout.favourites === 'top' || pinnedCount > 0);
  const categoriesFirst = layout.menuLayout === 'categories';
  const compact = layout.tileStyle === 'compact';
  const tiles = compact ? 15 : 8;
  return (
    <PreviewFrame>
      <div aria-hidden="true" className="flex aspect-[4/3] overflow-hidden rounded-lg border border-border bg-background shadow-sm">
        <div className="flex min-w-0 flex-1 flex-col">
          {(layout.showSearch || (layout.showCategories && !categoriesFirst)) && (
            <div className="shrink-0 space-y-1 border-b border-border bg-card p-1.5">
              {layout.showSearch && <div className="h-3 rounded-sm border border-input bg-control" />}
              {layout.showCategories && !categoriesFirst && (
                <div className="flex gap-1">
                  {favourites && <div className="h-2.5 w-7 rounded-sm bg-band" />}
                  {PREVIEW_KEYS.slice(0, 4).map((colour, index) => (
                    <div
                      key={colour}
                      className={cn('flex h-2.5 w-8 items-center gap-0.5 rounded-sm px-0.5', !favourites && index === 0 && 'bg-band')}
                    >
                      <span className="size-1 rounded-[1px]" style={{ backgroundColor: colour }} />
                      <span className="h-0.5 flex-1 rounded bg-muted-foreground/40" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {categoriesFirst ? (
            <div className="grid flex-1 grid-cols-2 content-start gap-1 p-1.5">
              {['Coffee', 'Bakery', 'Cold', 'Food', 'Retail'].slice(0, 4).map((name, index) => (
                <div key={name} className="relative h-9 overflow-hidden rounded-sm border border-border bg-card">
                  <span className="absolute inset-y-0 left-0 w-0.5" style={{ backgroundColor: PREVIEW_KEYS[index] }} />
                </div>
              ))}
            </div>
          ) : (
            <div className={cn('grid flex-1 content-start gap-1 p-1.5', compact ? 'grid-cols-5' : 'grid-cols-4')}>
              {Array.from({ length: tiles }).map((_, index) => (
                <div key={index} className="relative overflow-hidden rounded-sm border border-border bg-card">
                  <span
                    className="absolute inset-y-0 left-0 z-10 w-0.5"
                    style={{ backgroundColor: PREVIEW_KEYS[Math.floor(index / 5) % PREVIEW_KEYS.length] }}
                  />
                  {!compact && <div className="aspect-[16/10] border-b border-border bg-band" />}
                  <div className={cn('space-y-0.5 py-1 pr-1 pl-1.5', compact && 'py-1.5')}>
                    <div className="h-1 w-3/4 rounded bg-foreground/40" />
                    <div className="flex items-center justify-between">
                      <div className="h-1 w-1/3 rounded bg-muted-foreground/40" />
                      {layout.stockHighlight && (index === 2 || index === 6) && (
                        <div className={cn('h-1 w-1.5 rounded', index === 2 ? 'bg-measured' : 'bg-exception')} />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="flex w-[30%] shrink-0 flex-col gap-1 border-l border-border bg-card p-1.5">
          <div className="h-1.5 w-1/2 rounded bg-foreground/50" />
          <div className="mt-1 h-1 w-full rounded bg-border" />
          <div className="h-1 w-5/6 rounded bg-border" />
          <div className="mt-auto flex gap-0.5">
            <div className="h-3.5 w-1/4 rounded-sm border border-edge" />
            <div className="h-3.5 flex-1 rounded-sm bg-primary" />
          </div>
        </div>
      </div>
    </PreviewFrame>
  );
}
