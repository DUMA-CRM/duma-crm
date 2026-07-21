import Image from 'next/image';

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
        'flex flex-col text-left rounded-2xl bg-card border-2 overflow-hidden transition-all duration-200',
        'shadow-[0_1px_2px_0_rgb(30_27_22/0.04)]',
        isSelected ? 'border-primary shadow-md' : 'border-primary/10 hover:border-primary/30',
      )}
    >
      {item.image ? (
        <Image width={300} height={300} src={item.image} alt={item.name} loading="lazy" className="object-cover bg-muted aspect-square w-full shrink-0" />
      ) : (
        <div className="bg-muted aspect-square w-full shrink-0 flex items-center justify-center text-4xl font-bold text-muted-foreground/30 select-none">
          {item.name[0]?.toUpperCase()}
        </div>
      )}

      <div className="px-3 pt-2.5 pb-3">
        <p className="text-sm font-semibold text-foreground leading-snug">{item.name}</p>
        <p className="text-base font-bold text-primary tabular-nums mt-1">£{(item.price / 100).toFixed(2)}</p>
      </div>
    </button>
  );
}
