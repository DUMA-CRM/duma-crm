'use client';

import { useMemo, useState } from 'react';

import { ArrowLeft, LayoutGrid, RotateCcw, Search, Star, X } from '@/components/icons';
import { KeyArranger } from '@/components/pos/KeyArranger';
import { CategoryGrid, MenuGrid } from '@/components/pos/MenuGrid';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';
import { type StockLevel, categoryColours, categoryTiles, filterMenu } from '@/lib/utils/pos';
import type { KeyEntry } from '@/lib/utils/till-keys';
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
  /** Each page's arranged keys, by page ('favourites', 'all' or a category id); absent, the menu's order. */
  keyLayouts?: Record<string, KeyEntry[]>;
  /** Arranging the keys: each page's grid becomes its `KeyArranger`, and nothing sells. */
  arranging?: boolean;
  /** Save a page's keys, or null to put it back in menu order. */
  onKeyLayout?: (page: string, keys: KeyEntry[] | null) => void;
  onDoneArranging?: () => void;
}

/**
 * The till's menu side — search, category tabs or tiles, favourites and the
 * item grid — laid out by the Configuration → Till settings. The till and the
 * settings preview both render this, so the preview can't drift from the till.
 */
export function TillMenu(props: TillMenuProps) {
  const {
    items, categories, favourites, favouritesLabel, layout, counts, stock, selectedId, onSelectItem, isLoading, isError, onRetry, currency,
    banner, padForCartBar = true, keyLayouts, arranging = false, onKeyLayout, onDoneArranging,
  } = props;
  // Null until the cashier picks one: the till then opens on Favourites when there are any.
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  // Categories-first: the category whose items are open, or null for the tiles.
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [searchText, setQuery] = useState('');
  // Arranging lays out pages, not search results, so a search waits until it's done.
  const query = layout.showSearch && !arranging ? searchText.trim() : '';

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
  const colours = useMemo(() => categoryColours(categories), [categories]);

  const pageName = (page: string) =>
    page === 'favourites' ? favouritesLabel : page === 'all' ? 'All' : (categories.find((c) => c.id === page)?.name ?? 'This page');
  // The pages on screen, for the arranging bar: what Reset puts back.
  const shownPages: string[] = [];

  const grid = (list: MenuItem[], page: string) => {
    shownPages.push(page);
    if (arranging && onKeyLayout && !query && !isLoading && !isError && list.length > 0) {
      return (
        <KeyArranger
          items={list}
          keys={keyLayouts?.[page]}
          onChange={(keys) => onKeyLayout(page, keys)}
          tileStyle={layout.tileStyle}
          colours={colours}
          stock={stock}
          currency={currency}
        />
      );
    }
    return (
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
      colours={colours}
      currency={currency}
      keys={query ? undefined : keyLayouts?.[page]}
    />
    );
  };

  let body: React.ReactNode;
  if (query || isLoading || isError) {
    body = grid(visible, 'search');
  } else if (categoriesFirst && !openCategory) {
    body = (
      <CategoryGrid
        tiles={[...(favourites.length > 0 ? [{ id: 'favourites', name: favouritesLabel, count: favourites.length, image: '' }] : []), ...tiles]}
        colours={colours}
        onOpen={setOpenCategory}
      />
    );
  } else if (categoriesFirst) {
    const name = openCategory === 'favourites' ? favouritesLabel : categories.find((c) => c.id === openCategory)?.name;
    body = (
      <>
        <div className="mb-3 flex items-center gap-3">
          <Button variant="outline" onClick={() => setOpenCategory(null)} className="h-11 gap-2 px-3.5">
            <ArrowLeft size={18} aria-hidden="true" /> Categories
          </Button>
          <h2 className="text-lg font-semibold text-heading">{name}</h2>
        </div>
        {grid(visible, openCategory!)}
      </>
    );
  } else if (!showTabs && favourites.length > 0) {
    // No tabs to reach Favourites from, so they lead the page.
    body = (
      <>
        <SectionTitle icon={Star}>{favouritesLabel}</SectionTitle>
        {grid(favourites, 'favourites')}
        <SectionTitle>Everything</SectionTitle>
        {grid(visible, 'all')}
      </>
    );
  } else {
    body = grid(visible, showTabs ? category : 'all');
  }

  const arrangeable = shownPages.filter((page) => page !== 'search');
  const arrangedHere = arrangeable.some((page) => keyLayouts?.[page]?.length);
  const arrangeBar = arranging && (
    // Arranging, said plainly above the keys: which page, how, and the way out.
    <div className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border bg-card/95 px-4 py-2.5 backdrop-blur-sm md:-mx-6 md:px-6">
      <LayoutGrid size={18} aria-hidden="true" className="shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-sm text-foreground">
        {arrangeable.length > 0 ? (
          <>
            <span className="font-semibold">Arranging {arrangeable.map(pageName).join(' and ')}.</span>{' '}
            <span className="text-muted-foreground">Hold a key and drag it; the corner button makes it bigger.</span>
          </>
        ) : (
          <span className="text-muted-foreground">Open a category to arrange its keys.</span>
        )}
      </p>
      {arrangedHere && (
        <Button variant="ghost" className="h-11" onClick={() => arrangeable.forEach((page) => onKeyLayout?.(page, null))}>
          <RotateCcw size={16} aria-hidden="true" /> Menu order
        </Button>
      )}
      <Button className="h-11 px-5" onClick={onDoneArranging}>
        Done
      </Button>
    </div>
  );

  const hasTopBar = (layout.showSearch && !arranging) || showTabs;
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      {hasTopBar && (
        <div className="shrink-0 border-b border-border bg-card px-4 md:px-6">
          {layout.showSearch && !arranging && (
            <div className={cn('relative', showTabs ? 'pt-2.5' : 'py-2.5')}>
              <Search size={18} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchText}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the menu"
                aria-label="Search the menu"
                enterKeyHint="search"
                className="h-11 w-full rounded-md border border-input bg-control pr-12 pl-10 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:outline-2 focus:outline-ring/30 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchText && (
                <Button variant="ghost" size="icon" onClick={() => setQuery('')} aria-label="Clear search" className="absolute top-1/2 right-0 size-11 -translate-y-1/2 text-muted-foreground">
                  <X size={18} />
                </Button>
              )}
            </div>
          )}
          {showTabs && (
            // 56px with the bar's border, the ticket header's height, so the two rules meet in one line.
            <div role="tablist" aria-label="Menu categories" className="-mx-4 flex h-[calc(3.5rem-1px)] items-center gap-1 overflow-x-auto px-4 [scrollbar-width:none] md:-mx-6 md:px-6">
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
                      'flex h-9 shrink-0 touch-manipulation items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors duration-75',
                      'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                      active ? 'bg-band text-heading' : 'text-muted-foreground active:bg-band/60',
                    )}
                  >
                    {tab.id === 'favourites' ? (
                      <Star size={13} aria-hidden="true" />
                    ) : (
                      colours[tab.id] && <span aria-hidden="true" className="size-2 shrink-0 rounded-[2px]" style={{ backgroundColor: colours[tab.id] }} />
                    )}
                    {tab.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
      <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 md:px-6', arranging ? 'pt-0' : 'pt-4')}>
        {arrangeBar}
        {banner}
        <div className={padForCartBar ? 'pb-28 lg:pb-6' : 'pb-6'}>{body}</div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon?: typeof Star; children: React.ReactNode }) {
  return (
    <h2 className="mb-3 mt-6 flex items-center gap-2 text-base font-semibold text-heading first:mt-0">
      {Icon && <Icon size={15} aria-hidden="true" className="text-muted-foreground" />}
      {children}
    </h2>
  );
}
