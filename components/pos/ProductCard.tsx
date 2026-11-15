import Image from 'next/image';

import { cn } from '@/lib/utils/cn';
import { type StockLevel, formatPrice } from '@/lib/utils/pos';
import type { TileStyle } from '@/stores/posSettingsStore';
import type { MenuItem } from '@/types/pos';

/**
 * A menu key, drawn the way a working till draws one: flat, its category's
 * colour as a bar down the left edge, the name in full (up to three lines, so
 * "Iced oat latte" never truncates to "Iced oa…") and the price under it.
 * Pressing darkens it — no scale, no shadow; there is no hover on a tablet.
 * A count in the corner once it's on the ticket, so the cashier sees
 * "2 lattes" without looking across at the order.
 *
 * Stock is a hint, not a lock: a low or out item says so beside its price but
 * still sells — the count on the system is often behind the shelf, and the
 * cashier is looking at the shelf.
 */
export function ProductCard({
  item,
  count,
  isSelected,
  stock,
  tileStyle = 'compact',
  colour,
  onSelect,
  currency,
}: {
  item: MenuItem;
  /** How many are on the ticket already. */
  count: number;
  isSelected: boolean;
  stock?: { level: StockLevel; ingredient: string };
  tileStyle?: TileStyle;
  /** The category's key colour (a CSS colour); none draws no bar. */
  colour?: string;
  onSelect: (item: MenuItem) => void;
  currency?: string;
}) {
  const photo = tileStyle === 'photo';
  const out = stock?.level === 'out';
  const stockLabel = stock ? `${stock.ingredient} is ${out ? 'out' : 'low'}` : '';

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={isSelected}
      aria-label={`${item.name}, ${formatPrice(item.price, currency)}${count ? `, ${count} on the ticket` : ''}${stockLabel ? `. ${stockLabel}` : ''}`}
      title={stockLabel || undefined}
      className={cn(
        'relative flex touch-manipulation select-none flex-col overflow-hidden rounded-md border bg-card text-left transition-colors duration-75',
        'active:bg-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        photo ? 'min-h-28' : 'min-h-20',
        isSelected ? 'border-primary shadow-[inset_0_0_0_1px_var(--primary)]' : 'border-border',
      )}
    >
      {colour && <span aria-hidden="true" className="absolute inset-y-0 left-0 z-10 w-1" style={{ backgroundColor: colour }} />}

      {photo && (
        <span className="block aspect-[16/10] w-full shrink-0 border-b border-border bg-band">
          {item.image && (
            <Image
              width={320}
              height={200}
              src={item.image}
              alt=""
              loading="lazy"
              className={cn('size-full object-cover', out && 'opacity-60 grayscale')}
            />
          )}
        </span>
      )}

      <span className="flex flex-1 flex-col justify-between gap-1.5 py-2.5 pr-2.5 pl-3.5">
        <span
          className={cn(
            'text-[15px] font-semibold leading-snug',
            photo ? 'line-clamp-2' : 'line-clamp-3',
            out ? 'text-muted-foreground' : 'text-heading',
            !photo && count > 0 && 'pr-7',
          )}
        >
          {item.name}
        </span>
        <span className="flex items-baseline justify-between gap-2">
          <span data-figure className="text-sm tabular-nums text-muted-foreground">
            {formatPrice(item.price, currency)}
          </span>
          {stock && (
            <span aria-hidden="true" className={cn('text-xs font-semibold', out ? 'text-exception' : 'text-measured')}>
              {out ? 'Out' : 'Low'}
            </span>
          )}
        </span>
      </span>

      {count > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-1.5 right-1.5 flex h-6 min-w-6 items-center justify-center rounded-sm bg-heading px-1.5 text-xs font-semibold tabular-nums text-background"
        >
          {count}
        </span>
      )}
    </button>
  );
}
