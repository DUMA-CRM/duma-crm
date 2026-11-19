import Image from 'next/image';

import { STICKERS, type StickerId } from '@/lib/stickers';
import { cn } from '@/lib/utils/cn';

/**
 * A cat sticker at `size` px square. Decorative by default — the words beside
 * it carry the meaning — so it is hidden from screen readers unless `label`
 * says it is the content.
 */
export function Sticker({
  name,
  size = 96,
  label = false,
  priority = false,
  className,
}: {
  name: StickerId;
  size?: number;
  /** True when the sticker stands alone and should be announced. */
  label?: boolean;
  /** Above the fold on first paint: load it eagerly. */
  priority?: boolean;
  className?: string;
}) {
  const sticker = STICKERS[name];
  return (
    <Image
      src={sticker.src}
      alt={label ? sticker.alt : ''}
      aria-hidden={label ? undefined : true}
      width={size}
      height={size}
      priority={priority}
      draggable={false}
      className={cn('shrink-0 select-none', className)}
    />
  );
}
