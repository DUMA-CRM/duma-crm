import Image from 'next/image';

import { cn } from '@/lib/utils/cn';
import { type StockLevel, formatPrice } from '@/lib/utils/pos';
import type { TileStyle } from '@/stores/posSettingsStore';
import type { MenuItem } from '@/types/pos';

/**
 * A menu key. Large, pressed-state feedback on touch (there is no hover on a
 * tablet), a two-line name so "Iced oat latte" never truncates to "Iced oa…",
 * the price always visible, and a count once it's on the ticket — the cashier
 * can see "2 lattes" without looking across at the order.
 *
 * Stock is a hint, not a lock: a low item gets a yellow edge and an out item a
 * red one, but both still sell — the count on the system is often behind the
 * shelf, and the cashier is looking at the shelf.
 */
export function ProductCard({
  item,
  count,
  isSelected,
  stock,
  tileStyle = 'photo',
  onSelect,
  currency,
}: {
  item: MenuItem;
  /** How many are on the ticket already. */
  count: number;
  isSelected: boolean;
  stock?: { level: StockLevel; ingredient: string };
  tileStyle?: TileStyle;
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
        'group relative flex touch-manipulation select-none flex-col overflow-hidden rounded-xl border bg-card text-left',
        photo ? 'min-h-28' : 'min-h-24',
        'transition-[transform,border-color,box-shadow] duration-100 active:scale-[0.97]',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        isSelected
          ? 'border-primary shadow-[inset_0_0_0_1px_var(--primary)]'
          : out
            ? 'border-exception shadow-[inset_0_0_0_1px_var(--exception)]'
            : stock
              ? 'border-warning shadow-[inset_0_0_0_1px_var(--warning)]'
              : 'border-rule/70',
      )}
    >
      {photo &&
        (item.image ? (
          // Inset from the edge so the tile's border reads the same all the way round —
          // full-bleed, the photo covered it and the top looked borderless.
          <span className="block shrink-0 p-1.5 pb-0">
            <Image
              width={320}
              height={200}
              src={item.image}
              alt=""
              loading="lazy"
              className={cn('aspect-[16/10] w-full rounded-lg bg-band object-cover', out && 'opacity-60 grayscale')}
            />
          </span>
        ) : (
          <span className="block shrink-0 p-1.5 pb-0">
            <span aria-hidden="true" className="flex aspect-[16/10] w-full items-center justify-center rounded-lg bg-band/55 text-2xl font-semibold text-muted-foreground/45">
              {item.name[0]?.toUpperCase()}
            </span>
          </span>
        ))}

      <span className={cn('flex flex-1 flex-col justify-between gap-1 px-3 pb-3', photo ? 'pt-2.5' : 'pt-3')}>
        <span className={cn('line-clamp-2 text-base font-semibold leading-snug', out ? 'text-muted-foreground' : 'text-foreground', !photo && count > 0 && 'pr-8')}>
          {item.name}
        </span>
        <span className="flex items-center justify-between gap-2">
          <span data-figure className="text-sm font-medium tabular-nums text-muted-foreground">
            {formatPrice(item.price, currency)}
          </span>
          {stock && (
            <span aria-hidden="true" className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', out ? 'bg-exception/12 text-exception' : 'bg-warning/15 text-warning')}>
              {out ? 'Out' : 'Low'}
            </span>
          )}
        </span>
      </span>

      {count > 0 && (
        <span
          aria-hidden="true"
          className={cn(
            'absolute right-1.5 top-1.5 flex h-8 min-w-8 items-center justify-center bg-primary px-1.5 text-sm font-semibold tabular-nums text-primary-foreground',
            // On a photo it's a corner tab: flush in the image's top-right corner, sharing its radius.
            photo ? 'rounded-bl-lg rounded-tr-lg' : 'rounded-lg',
          )}
        >
          {count}
        </span>
      )}
    </button>
  );
}
