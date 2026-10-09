'use client';

import { useState } from 'react';

import { Loader2, Plus, TicketPercent, X } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { PromotionCheck } from '@/lib/modules/promotions/client';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/pos';
import { normaliseCode } from '@/lib/utils/promotions';

/**
 * The ticket's promo code, beside the loyalty card and the order note: a quiet
 * "Promo code" until one is typed, then a card that says what it takes off —
 * or, in the cashier's words, why it can't be used on this ticket yet. The
 * API decides both; the order applies it for real when it's charged.
 */
export function PromoCodeEntry({
  code,
  check,
  checking,
  failed,
  discountCents,
  offline,
  onApply,
  onRemove,
  currency,
}: {
  code: string | null;
  check: PromotionCheck | undefined;
  checking: boolean;
  /** The check itself didn't come back (not a "no" — no answer). */
  failed: boolean;
  discountCents: number;
  offline: boolean;
  onApply: (code: string) => void;
  onRemove: () => void;
  currency?: string | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');

  if (code) {
    const valid = check?.valid === true;
    const status = offline
      ? 'Needs a connection — it can’t be checked offline'
      : checking && !check
        ? 'Checking…'
        : failed
          ? 'Couldn’t check the code — it’s checked again at Charge'
          : valid
            ? discountCents > 0
              ? `Save ${formatPrice(discountCents, currency)}`
              : (check?.summary ?? 'Applied')
            : (check?.reason ?? 'Checking…');
    const problem = offline || failed || (check !== undefined && !valid);
    return (
      <div
        className={cn(
          'flex min-h-12 w-full items-center gap-3 rounded-md border px-3',
          problem ? 'border-exception/40 bg-exception/6' : valid ? 'border-primary bg-primary/5' : 'border-rule/60 bg-field',
        )}
        aria-live="polite"
      >
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            problem ? 'bg-exception/10 text-exception' : 'bg-primary/8 text-primary',
          )}
        >
          {checking && !check ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <TicketPercent size={16} aria-hidden="true" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">
            <span className="font-mono">{code}</span>
            {valid && check?.summary && <span className="font-normal text-muted-foreground"> · {check.summary}</span>}
          </span>
          <span className={cn('block truncate text-xs', problem ? 'text-exception' : 'text-muted-foreground')}>{status}</span>
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label={`Remove promo code ${code}`}
          className="size-10 shrink-0 text-muted-foreground"
        >
          <X size={16} />
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={offline}
        title={offline ? 'Promo codes need a connection' : undefined}
        className="flex h-10 items-center gap-2 text-sm font-medium text-muted-foreground disabled:opacity-50"
      >
        <Plus size={16} aria-hidden="true" /> Promo code
      </button>
    );
  }

  const ready = /^[A-Z0-9-]{3,50}$/.test(normaliseCode(typed));
  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        onApply(normaliseCode(typed));
        setTyped('');
        setOpen(false);
      }}
    >
      <TicketPercent size={16} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-4 text-muted-foreground" />
      <input
        autoFocus
        value={typed}
        maxLength={60}
        onChange={(event) => setTyped(normaliseCode(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            setOpen(false);
            setTyped('');
          }
        }}
        placeholder="Promo code"
        aria-label="Promo code"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="h-12 w-full rounded-lg border border-input bg-control pl-10 pr-24 font-mono text-base uppercase text-foreground outline-none placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured"
      />
      <Button type="submit" disabled={!ready} className="absolute right-1 top-1 h-10 px-4">
        Apply
      </Button>
    </form>
  );
}
