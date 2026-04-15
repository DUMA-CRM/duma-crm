import { ScrollArea } from '@/components/ui/scroll-area';
import { ProductCard } from './ProductCard';
import type { MenuItem } from '@/types/pos';
import { Info } from 'lucide-react';

interface MenuGridProps {
  items: MenuItem[];
  selectedId: string | null;
  onSelectItem: (item: MenuItem) => void;
}

export function MenuGrid({ items, selectedId, onSelectItem }: MenuGridProps) {
  return (
    <ScrollArea className="flex-1 -mr-4 min-h-0">
      {items.length === 0 ? (
        <div className="flex items-center justify-center px-4 py-20 text-center">
          <div className="flex flex-col gap-2 items-center">
            <Info size={64} className="text-muted-foreground mb-2" />
            <p className="text-xl font-semibold text-muted-foreground">No items found</p>
            <p className="text-muted-foreground/70 ">
              This category doesn't have any items yet. Try selecting a different category or check back later, probably we out of stock.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 pr-4 pb-4">
          {items.map((item) => (
            <ProductCard key={item.id} item={item} isSelected={selectedId === item.id} onSelect={onSelectItem} />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
