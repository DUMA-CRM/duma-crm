import { cn } from '@/lib/utils/cn';
import type { MenuItem } from '@/types/pos';

interface ProductCardProps {
  item: MenuItem;
  isSelected: boolean;
  onSelect: (item: MenuItem) => void;
}

export function ProductCard({ item, isSelected, onSelect }: ProductCardProps) {
  return (
    <button
      onClick={() => onSelect(item)}
      className={cn(
        'group text-left rounded-2xl overflow-hidden bg-white p-4',
        'hover:border hover:border-primary/40 transition-all duration-200',
        isSelected && 'border border-primary shadow-md',
      )}
    >
      <div className="aspect-[4/3] rounded-xl overflow-hidden">
        <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
      </div>

      <div className="p-4 flex flex-col gap-2">
        <p className="font-semibold text-foreground">{item.name}</p>
        <p className="text-xl font-bold text-foreground">₴{item.price}</p>
      </div>
    </button>
  );
}
