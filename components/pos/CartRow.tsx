'use client';

import { motion, useReducedMotion } from 'motion/react';

import { FileText, Minus, Plus, Trash2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { SwipeAction, SwipeActions, SwipeContent, SwipeItem } from '@/components/swipe-actions';

import { cn } from '@/lib/utils/cn';
import { cartItemTotal, formatPrice } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';

interface CartRowProps {
  cartItem: CartItem;
  expanded: boolean;
  /** Just added or changed — a brief highlight ties the tap on the grid to this line. */
  flash: boolean;
  onToggle: () => void;
  onQty: (delta: number) => void;
  onNote: (note: string) => void;
  onRemove: () => void;
  /** Swipe left to reveal Remove; a full swipe removes. Needs a `SwipeRoot` around the list. */
  swipe?: boolean;
  currency?: string;
  /** The row's own background while swiping — `control` (white) inside a white pane, like New order's. */
  surface?: 'card' | 'control';
  /** What the note is for: the kitchen at a till; a packer or courier for an order taken by hand. */
  notePlaceholder?: string;
}

/**
 * One ticket line. Collapsed it reads like a receipt — quantity, name, the
 * options underneath, the line price. Tap it to edit: a large stepper, a note
 * for the kitchen, and Remove (with Undo in the panel, so no confirm dialog).
 */
export function CartRow({
  cartItem,
  expanded,
  flash,
  onToggle,
  onQty,
  onNote,
  onRemove,
  swipe = false,
  currency,
  surface = 'card',
  notePlaceholder = 'Note for the kitchen',
}: CartRowProps) {
  const reduceMotion = useReducedMotion();
  const total = cartItemTotal(cartItem);
  const options = cartItem.selected.map((option) => option.label).join(' · ');

  const rowClass = cn('border-b border-rule/50 transition-colors duration-500 last:border-b-0', flash && 'bg-primary/6', expanded && 'bg-band/50');
  const body = (
    <>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="flex min-h-16 w-full touch-manipulation items-start gap-3 px-5 py-3 text-left"
        >
          <span data-figure className="mt-0.5 w-7 shrink-0 text-base font-semibold tabular-nums text-foreground">{cartItem.quantity}×</span>
          <span className="min-w-0 flex-1">
            <span className="block text-base font-medium leading-snug text-foreground">{cartItem.item.name}</span>
            {options && <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{options}</span>}
            {cartItem.note && (
              <span className="mt-1 flex items-center gap-1.5 text-sm italic text-muted-foreground">
                <FileText size={13} aria-hidden="true" className="shrink-0" />
                {cartItem.note}
              </span>
            )}
          </span>
          <span data-figure className="mt-0.5 shrink-0 text-base font-semibold tabular-nums text-foreground">{formatPrice(total, currency)}</span>
        </button>

        {expanded && (
          <div className="space-y-3 px-5 pb-4">
            <div className="flex items-center gap-2">
              <div className="flex items-center rounded-lg border border-rule/70 bg-card">
                <Button variant="ghost" size="icon" onClick={() => onQty(-1)} disabled={cartItem.quantity <= 1} aria-label="One fewer" className="size-12 rounded-r-none active:not-aria-[haspopup]:translate-y-0 active:bg-band">
                  <Minus size={18} />
                </Button>
                <span data-figure className="w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">{cartItem.quantity}</span>
                <Button variant="ghost" size="icon" onClick={() => onQty(1)} aria-label="One more" className="size-12 rounded-l-none active:not-aria-[haspopup]:translate-y-0 active:bg-band">
                  <Plus size={18} />
                </Button>
              </div>
              <Button variant="outline" onClick={onRemove} className="ml-auto h-12 gap-2 px-4 text-destructive hover:text-destructive">
                <Trash2 size={17} aria-hidden="true" /> Remove
              </Button>
            </div>
            <input
              value={cartItem.note ?? ''}
              onChange={(event) => onNote(event.target.value)}
              maxLength={200}
              placeholder={notePlaceholder}
              aria-label={`Note for ${cartItem.item.name}`}
              className="h-12 w-full rounded-lg border border-input bg-control px-3.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured"
            />
          </div>
        )}
    </>
  );

  if (swipe) {
    return (
      <SwipeItem
        disabled={expanded}
        render={
          <motion.li
            layout={reduceMotion ? false : 'position'}
            initial={reduceMotion ? false : { opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.32, 0.72, 0, 1] }}
            className="relative overflow-hidden border-b border-rule/50 last:border-b-0"
          />
        }
      >
        <SwipeActions side="right" fullSwipe>
          <SwipeAction onClick={onRemove} className="bg-destructive text-sm font-semibold text-white" aria-label={`Remove ${cartItem.item.name}`}>
            <Trash2 size={18} aria-hidden="true" />
            Remove
          </SwipeAction>
        </SwipeActions>
        <SwipeContent
          className={cn(surface === 'control' ? 'bg-control' : 'bg-card', 'transition-colors duration-500', flash && 'bg-primary/6', expanded && 'bg-band/50')}
        >
          {body}
        </SwipeContent>
      </SwipeItem>
    );
  }

  return (
    <motion.li
      layout={reduceMotion ? false : 'position'}
      initial={reduceMotion ? false : { opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 24 }}
      transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
      className={rowClass}
    >
      {body}
    </motion.li>
  );
}
