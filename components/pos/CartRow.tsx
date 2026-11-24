'use client';

import { motion, useReducedMotion } from 'motion/react';

import { FileText, Trash2 } from '@/components/icons';
import { QuantityStepper } from '@/components/pos/QuantityStepper';
import { Button } from '@/components/ui/button';

import { SwipeAction, SwipeActions, SwipeContent, SwipeItem } from '@/components/ui/swipe-actions';

import { cn } from '@/lib/utils/cn';
import { cartItemTotal, formatPrice } from '@/lib/utils/pos';
import type { CartItem } from '@/types/pos';

interface CartRowProps {
  cartItem: CartItem;
  expanded?: boolean;
  /** Just added or changed — a brief highlight ties the tap on the grid to this line. */
  flash: boolean;
  /** Opens the line in a full editor instead of expanding it here (the till). */
  onOpen?: () => void;
  onToggle?: () => void;
  onQty?: (delta: number) => void;
  onNote?: (note: string) => void;
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
  expanded: expandedProp = false,
  flash,
  onOpen,
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
  const expanded = !onOpen && expandedProp;
  const total = cartItemTotal(cartItem);
  const options = cartItem.selected.map((option) => option.label).join(' · ');

  const rowClass = cn('border-b border-border transition-colors duration-500 last:border-b-0', flash && 'bg-primary/6', expanded && EDITING);
  const body = (
    <>
        <button
          type="button"
          onClick={onOpen ?? onToggle}
          aria-expanded={onOpen ? undefined : expanded}
          aria-haspopup={onOpen ? 'dialog' : undefined}
          className="flex min-h-12 w-full touch-manipulation items-start gap-3 px-4 py-2.5 text-left"
        >
          <span data-figure className="w-6 shrink-0 text-[15px] font-semibold leading-snug tabular-nums text-heading">{cartItem.quantity}</span>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-medium leading-snug text-heading">{cartItem.item.name}</span>
            {options && <span className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">{options}</span>}
            {cartItem.note && (
              <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                <FileText size={12} aria-hidden="true" className="shrink-0" />
                {cartItem.note}
              </span>
            )}
          </span>
          <span data-figure className="shrink-0 text-[15px] font-semibold leading-snug tabular-nums text-heading">{formatPrice(total, currency)}</span>
        </button>

        {expanded && (
          <div className="space-y-2.5 pr-4 pb-3.5 pl-13">
            <div className="flex items-center gap-2">
              <QuantityStepper value={cartItem.quantity} onChange={(next) => onQty?.(next - cartItem.quantity)} />
              <Button variant="ghost" onClick={onRemove} className="ml-auto h-11 gap-2 px-3 text-destructive hover:bg-destructive/8 hover:text-destructive">
                <Trash2 size={17} aria-hidden="true" /> Remove
              </Button>
            </div>
            <div className="relative">
              <FileText size={15} aria-hidden="true" className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={cartItem.note ?? ''}
                onChange={(event) => onNote?.(event.target.value)}
                maxLength={200}
                placeholder={notePlaceholder}
                aria-label={`Note for ${cartItem.item.name}`}
                className="h-11 w-full rounded-md border border-input bg-card pr-3 pl-9 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:outline-2 focus:outline-ring/30"
              />
            </div>
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
            className="relative overflow-hidden border-b border-border last:border-b-0"
          />
        }
      >
        <SwipeActions side="right" fullSwipe>
          <SwipeAction onClick={onRemove} className="bg-destructive text-sm font-semibold text-on-fill" aria-label={`Remove ${cartItem.item.name}`}>
            <Trash2 size={18} aria-hidden="true" />
            Remove
          </SwipeAction>
        </SwipeActions>
        <SwipeContent
          className={cn(surface === 'control' ? 'bg-control' : 'bg-card', 'transition-colors duration-500', flash && 'bg-primary/6', expanded && EDITING)}
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

/** The line being edited: a brand bar down its left edge on a light wash. */
const EDITING = 'bg-band/40 shadow-[inset_3px_0_0_var(--primary)]';
