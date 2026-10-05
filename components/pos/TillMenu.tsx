'use client';

import { useMemo, useState } from 'react';

import { ArrowLeft, Search, Star, X } from '@/components/icons';
import { CategoryGrid, MenuGrid } from '@/components/pos/MenuGrid';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';
import { type StockLevel, categoryTiles, filterMenu } from '@/lib/utils/pos';
import type { PosLayout } from '@/stores/posSettingsStore';
import type { MenuItem } from '@/types/pos';

export interface TillMenuProps {
  items: MenuItem[];
  categories: Array<{ id: string; name: string }>;
  favourites: MenuItem[];
  favouritesLabel: string;
  layout: PosLayout;
  counts: Record<string, number>;
  stock: Record<string, { level: StockLevel; ingredient: string }>;
  selectedId: string | null;
  onSelectItem: (item: MenuItem) => void;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  currency: string;
  /** Status banners shown at the top of the scrolling area (offline, queued sales). */
  banner?: React.ReactNode;
  /** Pad the bottom for the floating ticket bar below lg. */
  padForCartBar?: boolean;
}

/**
 * The till's menu side — search, category tabs or tiles, favourites and the
 * item grid — laid out by the Configuration → Till settings. The till and the
 * settings preview both render this, so the preview can't drift from the till.
 */
export function TillMenu(props: TillMenuProps) {
  const {
    items, categories, favourites, favouritesLabel, layout, counts, stock, selectedId, onSelectItem, isLoading, isError, onRetry, currency,
    banner, padForCartBar = true,
  } = props;
  // Null until the cashier picks one: the till then opens on Favourites when there are any.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Categories-first: the category whose items are open, or null for the tiles.
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [searchText, setQuery] = useState('');
  const query = layout.showSearch ? searchText.trim() : '';

  const categoriesFirst = layout.menuLayout === 'categories';
  const showTabs = layout.showCategories && !categoriesFirst;
  const category = activeCategory ?? (favourites.length > 0 ? 'favourites' : 'all');
  const visible = useMemo(() => {
    if (query) return filterMenu(items, 'all', query);
    const scope = categoriesFirst ? openCategory : showTabs ? category : 'all';
    if (scope === 'favourites') return favourites;
    return filterMenu(items, scope ?? 'all', '');
  }, [categoriesFirst, category, favourites, items, openCategory, query, showTabs]);
  const tiles = useMemo(() => categoryTiles(items, categories), [categories, items]);

  const grid = (list: MenuItem[]) => (
    <MenuGrid
      items={list}
      counts={counts}
      selectedId={selectedId}
      onSelectItem={onSelectItem}
      isLoading={isLoading}
      isError={isError}
      onRetry={onRetry}
      query={query}
      onClearSearch={() => setQuery('')}
      stock={stock}
      tileStyle={layout.tileStyle}
      currency={currency}
    />
  );

  let body: React.ReactNode;
  if (query || isLoading || isError) {
    body = grid(visible);
  } else if (categoriesFirst && !openCategory) {
    body = (
      <CategoryGrid
        tiles={[...(favourites.length > 0 ? [{ id: 'favourites', name: favouritesLabel, count: favourites.length, image: '', accent: true }] : []), ...tiles]}
        onOpen={setOpenCategory}
      />
    );
  } else if (categoriesFirst) {
    const name = openCategory === 'favourites' ? favouritesLabel : categories.find((c) => c.id === openCategory)?.name;
    body = (
      <>
        <div className="mb-3 flex items-center gap-2">
          <Button variant="outline" onClick={() => setOpenCategory(null)} className="h-12 gap-2 px-4 text-base">
            <ArrowLeft size={18} aria-hidden="true" /> Categories
          </Button>
          <h2 className="ml-2 text-xl font-semibold text-foreground">{name}</h2>
        </div>
        {grid(visible)}
      </>
    );
  } else if (!showTabs && favourites.length > 0) {
    // No tabs to reach Favourites from, so they lead the page.
    body = (
      <>
        <SectionTitle icon={Star}>{favouritesLabel}</SectionTitle>
        {grid(favourites)}
        <SectionTitle>Everything</SectionTitle>
        {grid(visible)}
      </>
    );
  } else {
    body = grid(visible);
  }

  const hasTopBar = layout.showSearch || showTabs;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      {hasTopBar && (
        <div className="shrink-0 space-y-3 px-4 pb-3 pt-4 md:px-6">
          {layout.showSearch && (
            <div className="relative">
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchText}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the menu"
                aria-label="Search the menu"
                enterKeyHint="search"
                className="h-12 w-full rounded-xl border border-rule/70 bg-card pl-11 pr-12 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured [&::-webkit-search-cancel-button]:hidden"
              />
              {searchText && (
                <Button variant="ghost" size="icon" onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-0.5 top-1/2 size-11 -translate-y-1/2 text-muted-foreground">
                  <X size={18} />
                </Button>
              )}
            </div>
          )}
          {showTabs && (
            <div role="tablist" aria-label="Menu categories" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:-mx-6 md:px-6">
              {[...(favourites.length > 0 ? [{ id: 'favourites', name: favouritesLabel }] : []), { id: 'all', name: 'All' }, ...categories].map((tab) => {
                const active = !query && category === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => {
                      setActiveCategory(tab.id);
                      setQuery('');
                    }}
                    className={cn(
                      'flex h-12 min-w-20 shrink-0 touch-manipulation items-center justify-center gap-2 rounded-lg border px-5 text-base font-semibold transition-colors',
                      active ? 'border-foreground bg-foreground text-background' : 'border-rule/70 bg-card text-foreground',
                    )}
                  >
                    {tab.id === 'favourites' && <Star size={15} aria-hidden="true" className={active ? '' : 'text-warning'} />}
                    {tab.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:px-6', !hasTopBar && 'pt-4')}>
        {banner}
        <div className={padForCartBar ? 'pb-28 lg:pb-6' : 'pb-6'}>{body}</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon?: typeof Star; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-6 flex items-center gap-2 text-base font-semibold text-foreground first:mt-0">
      {Icon && <Icon size={16} aria-hidden="true" className="text-warning" />}
      {children}
    </h2>
  );
}
