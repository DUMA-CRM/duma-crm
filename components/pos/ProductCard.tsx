import Image from 'next/image';

import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/pos';
import type { MenuItem } from '@/types/pos';

/* A menu tile is a key on the panel, not a card that floats. Selection is ink —
   position and action are achromatic in this world — so a selected tile never
   competes with a reading elsewhere on the screen. */
export function ProductCard({
  item,
  isSelected,
  onSelect,
  currency,
}: {
  item: MenuItem;
  isSelected: boolean;
  onSelect: (item: MenuItem) => void;
  currency?: string;
}) {
  return (
    <button
      onClick={() => onSelect(item)}
      aria-pressed={isSelected}
      className={cn(
        'relative flex flex-col overflow-hidden rounded-sm border bg-card text-left transition-colors duration-100',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        // The doubled edge is drawn by an overlay rather than an inset shadow:
        // an inset shadow paints under the tile's own image, so the ring used to
        // survive only in the label strip below it.
        isSelected
          ? 'border-foreground after:pointer-events-none after:absolute after:inset-0 after:rounded-sm after:border after:border-foreground'
          : 'border-rule hover:border-foreground',
      )}
    >
      {item.image ? (
        <Image
          width={300}
          height={300}
          src={item.image}
          alt=""
          loading="lazy"
          className="aspect-square w-full shrink-0 bg-band object-cover"
        />
      ) : (
        <div className="flex aspect-square w-full shrink-0 select-none items-center justify-center bg-band text-4xl font-semibold text-muted-foreground">
          {item.name[0]?.toUpperCase()}
        </div>
      )}

      <div className="border-t border-rule px-3 pt-2 pb-2.5">
        <p className="text-sm font-medium leading-snug text-foreground">{item.name}</p>
        <p data-figure className="mt-1 text-base font-semibold text-foreground">
          {formatPrice(item.price, currency)}
        </p>
      </div>
    </button>
  );
}
