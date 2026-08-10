import { UtensilsCrossed } from '@/components/icons';

import { ProductCard } from '@/components/pos/ProductCard';
import { EmptyState } from '@/components/shared/EmptyState';
import { ScrollArea } from '@/components/ui/scroll-area';

import type { MenuItem } from '@/types/pos';

interface MenuGridProps {
  items: MenuItem[];
  selectedId: string | null;
  onSelectItem: (item: MenuItem) => void;
  isLoading?: boolean;
  currency?: string;
}

// auto-fill: as many ~128px+ cards as fit the container — 2-3 on a phone,
// ~5 on a tablet, and it self-adjusts around the 400px order panel on desktop.
// Extra bottom padding below lg clears the floating CartBar overlay.
const GRID = 'grid grid-cols-[repeat(auto-fill,minmax(9rem,1fr))] gap-3 pr-4 pb-24 lg:pb-4';

export function MenuGrid({ items, selectedId, onSelectItem, isLoading, currency }: MenuGridProps) {
  return (
    <ScrollArea className="flex-1 -mr-4 min-h-0">
      {isLoading ? (
        <div className={GRID}>
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-sm bg-muted animate-pulse aspect-3/4" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No items in this category" description="Choose another category to see its items." />
      ) : (
        <div className={GRID}>
          {items.map((item) => (
            <ProductCard key={item.id} item={item} isSelected={selectedId === item.id} onSelect={onSelectItem} currency={currency} />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
