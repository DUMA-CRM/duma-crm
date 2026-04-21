import { ScrollArea } from '@/components/ui/scroll-area';
import { ProductCard } from './ProductCard';
import { EmptyState } from '@/components/shared/EmptyState';
import type { MenuItem } from '@/types/pos';
import { UtensilsCrossed } from 'lucide-react';

interface MenuGridProps {
  items: MenuItem[];
  selectedId: string | null;
  onSelectItem: (item: MenuItem) => void;
  isLoading?: boolean;
}

export function MenuGrid({ items, selectedId, onSelectItem, isLoading }: MenuGridProps) {
  return (
    <ScrollArea className="flex-1 -mr-4 min-h-0">
      {isLoading ? (
        <div className="grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-4 pr-4 pb-4">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="rounded-2xl bg-muted animate-pulse aspect-3/4" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={UtensilsCrossed} title="No items found" description="Try selecting a different category" />
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
