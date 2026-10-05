import { AlertTriangle, Search, UtensilsCrossed } from '@/components/icons';
import { ProductCard } from '@/components/pos/ProductCard';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';
import type { StockLevel } from '@/lib/utils/pos';
import type { TileStyle } from '@/stores/posSettingsStore';
import type { MenuItem } from '@/types/pos';

interface MenuGridProps {
  items: MenuItem[];
  counts: Record<string, number>;
  selectedId: string | null;
  onSelectItem: (item: MenuItem) => void;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  /** The search in effect — the empty state then says what didn't match. */
  query?: string;
  onClearSearch?: () => void;
  stock?: Record<string, { level: StockLevel; ingredient: string }>;
  tileStyle?: TileStyle;
  /** Shown instead of the generic empty state (e.g. no favourites yet). */
  empty?: { title: string; description: string };
  currency?: string;
}

// Photo keys ~152px: four across beside the ticket on a 10–11" landscape
// tablet, five on a 12.9", two or three on a phone. Compact keys ~136px fit
// five. The page pads below for the floating ticket bar.
export const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-3';
const COMPACT_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5';

export function MenuGrid({
  items, counts, selectedId, onSelectItem, isLoading, isError, onRetry, query, onClearSearch, stock, tileStyle = 'photo', empty, currency,
}: MenuGridProps) {
  if (isLoading) {
    return (
      <div className={GRID} aria-busy="true" aria-label="Loading the menu">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="overflow-hidden rounded-xl border border-rule/50 bg-card">
            <div className="aspect-[16/10] animate-pulse bg-band/70" />
            <div className="space-y-2 p-3">
              <div className="h-3.5 w-3/4 animate-pulse rounded bg-band/70" />
              <div className="h-3 w-1/3 animate-pulse rounded bg-band/70" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <PanelState icon={AlertTriangle} title="The menu didn’t load" description="Check the connection, then try again.">
        {onRetry && (
          <Button size="touch" variant="outline" onClick={onRetry} className="mt-5">
            Try again
          </Button>
        )}
      </PanelState>
    );
  }

  if (items.length === 0) {
    return query ? (
      <PanelState icon={Search} title={`Nothing matches “${query}”`} description="Check the spelling, or search for part of the name.">
        {onClearSearch && (
          <Button size="touch" variant="outline" onClick={onClearSearch} className="mt-5">
            Clear search
          </Button>
        )}
      </PanelState>
    ) : (
      <PanelState icon={UtensilsCrossed} title={empty?.title ?? 'Nothing in this category'} description={empty?.description ?? 'Items appear here once they’re on the menu and available.'} />
    );
  }

  return (
    <div className={tileStyle === 'compact' ? COMPACT_GRID : GRID}>
      {items.map((item) => (
        <ProductCard
          key={item.id}
          item={item}
          count={counts[item.id] ?? 0}
          stock={stock?.[item.id]}
          tileStyle={tileStyle}
          isSelected={selectedId === item.id}
          onSelect={onSelectItem}
          currency={currency}
        />
      ))}
    </div>
  );
}

/** The categories-first layout: one big key per category, opening into its items. */
export function CategoryGrid({
  tiles,
  onOpen,
}: {
  tiles: Array<{ id: string; name: string; count: number; image: string; accent?: boolean }>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-3">
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          onClick={() => onOpen(tile.id)}
          className={cn(
            'relative flex h-36 touch-manipulation select-none flex-col justify-end overflow-hidden rounded-xl border p-4 text-left transition-transform duration-100 active:scale-[0.97]',
            tile.accent ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/70 bg-card text-foreground',
          )}
        >
          <span className="relative text-xl font-semibold leading-tight">{tile.name}</span>
          <span className={cn('relative mt-1 text-sm tabular-nums', tile.accent ? 'text-primary-foreground/80' : 'text-muted-foreground')}>
            {tile.count} item{tile.count === 1 ? '' : 's'}
          </span>
        </button>
      ))}
    </div>
  );
}

function PanelState({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Search;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-band text-muted-foreground" aria-hidden="true">
        <Icon size={24} />
      </span>
      <p className="mt-4 text-base font-semibold text-foreground">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
