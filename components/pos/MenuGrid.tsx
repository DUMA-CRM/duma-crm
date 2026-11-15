import { AlertTriangle, Search, UtensilsCrossed } from '@/components/icons';
import { ProductCard } from '@/components/pos/ProductCard';
import { Bone } from '@/components/shared/Skeleton';
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
  /** Each category's key colour, from `categoryColours`. */
  colours?: Record<string, string>;
  /** Shown instead of the generic empty state (e.g. no favourites yet). */
  empty?: { title: string; description: string };
  currency?: string;
}

// Text keys ~136px: five across beside the ticket on a 10–11" landscape
// tablet (Toast's default grid is five wide), six on a 12.9", two or three on
// a phone. Photo keys ~152px fit four. An 8px gap is the floor against
// mis-taps. The page pads below for the floating ticket bar.
export const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2';
const COMPACT_GRID = 'grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2';

export function MenuGrid({
  items,
  counts,
  selectedId,
  onSelectItem,
  isLoading,
  isError,
  onRetry,
  query,
  onClearSearch,
  stock,
  tileStyle = 'compact',
  colours,
  empty,
  currency,
}: MenuGridProps) {
  if (isLoading) {
    return (
      <div className={tileStyle === 'compact' ? COMPACT_GRID : GRID} role="status" aria-busy="true" aria-label="Loading the menu">
        {Array.from({ length: 12 }).map((_, i) => (
          <ProductCardSkeleton key={i} index={i} photo={tileStyle !== 'compact'} />
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
      <PanelState
        icon={UtensilsCrossed}
        title={empty?.title ?? 'Nothing in this category'}
        description={empty?.description ?? 'Items appear here once they’re on the menu and available.'}
      />
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
          colour={colours?.[item.category]}
          isSelected={selectedId === item.id}
          onSelect={onSelectItem}
          currency={currency}
        />
      ))}
    </div>
  );
}

const NAME_W = ['w-3/4', 'w-1/2', 'w-2/3', 'w-4/5'];

/** A `ProductCard` without its words — same box, photo, name and price. */
function ProductCardSkeleton({ index, photo }: { index: number; photo: boolean }) {
  return (
    <div
      className={cn('flex flex-col overflow-hidden rounded-md border border-border bg-card', photo ? 'min-h-28' : 'min-h-20')}
      aria-hidden="true"
    >
      {photo && <Bone className="aspect-[16/10] w-full rounded-none" />}
      <span className="flex flex-1 flex-col justify-between gap-2 py-2.5 pr-2.5 pl-3.5">
        <Bone className={cn('h-4', NAME_W[index % NAME_W.length])} />
        <Bone className="h-3.5 w-12" />
      </span>
    </div>
  );
}

/** The categories-first layout: one big key per category, in its colour, opening into its items. */
export function CategoryGrid({
  tiles,
  colours,
  onOpen,
}: {
  tiles: Array<{ id: string; name: string; count: number; image: string }>;
  colours?: Record<string, string>;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(11rem,1fr))] gap-2">
      {tiles.map((tile) => (
        <button
          key={tile.id}
          type="button"
          onClick={() => onOpen(tile.id)}
          className="relative flex h-28 touch-manipulation select-none flex-col justify-end overflow-hidden rounded-md border border-border bg-card py-3 pr-3 pl-4 text-left transition-colors duration-75 active:bg-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {colours?.[tile.id] && (
            <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: colours[tile.id] }} />
          )}
          <span className="text-lg font-semibold leading-tight text-heading">{tile.name}</span>
          <span className="mt-0.5 text-sm tabular-nums text-muted-foreground">
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
      <span className="flex size-12 items-center justify-center rounded-md bg-band text-muted-foreground" aria-hidden="true">
        <Icon size={22} />
      </span>
      <p className="mt-4 text-base font-semibold text-heading">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {children}
    </div>
  );
}
