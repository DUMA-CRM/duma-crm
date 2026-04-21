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
        'text-left rounded-2xl bg-card p-3 border-2 transition-all duration-200',
        'shadow-[0_1px_2px_0_rgb(30_27_22/0.04)]',
        isSelected ? 'border-primary shadow-md' : 'border-transparent hover:border-primary/30',
      )}
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-muted mb-2.5">
        <img src={item.image} alt={item.name} loading="lazy" className="w-full h-full object-cover" />
      </div>

      <p className="text-sm font-semibold text-foreground leading-snug">{item.name}</p>
      <p className="text-base font-bold text-primary tabular-nums mt-1">£{(item.price / 100).toFixed(2)}</p>
    </button>
  );
}
