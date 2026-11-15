'use client';

import { useState } from 'react';

import { Loader2, TicketPercent, X } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { PromotionCheck } from '@/lib/modules/promotions/client';
import { cn } from '@/lib/utils/cn';
import { formatPrice } from '@/lib/utils/pos';
import { normaliseCode } from '@/lib/utils/promotions';

/**
 * The ticket's promo code: opened from the ticket's ⋯ menu as a field (which
 * closes again if left empty), then a card that says what it takes off — or,
 * in the cashier's words, why it can't be used on this ticket yet. The API
 * decides both; the order applies it for real when it's charged.
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
  editing = false,
  onEditingChange,
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
  /** The field is open (from the ticket's ⋯ menu). */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [typed, setTyped] = useState('');
  const close = () => {
    setTyped('');
    onEditingChange?.(false);
  };

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
          problem ? 'border-exception/40 bg-exception/6' : valid ? 'border-primary/40 bg-primary/5' : 'border-border bg-card',
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

  if (!editing) return null;

  const ready = /^[A-Z0-9-]{3,50}$/.test(normaliseCode(typed));
  return (
    <form
      className="relative"
      onSubmit={(event) => {
        event.preventDefault();
        if (!ready) return;
        onApply(normaliseCode(typed));
        close();
      }}
    >
      <TicketPercent
        size={16}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
      />
      <input
        autoFocus
        value={typed}
        maxLength={60}
        onChange={(event) => setTyped(normaliseCode(event.target.value))}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.stopPropagation();
            close();
          }
        }}
        // Left without typing anything: fold the field away again.
        onBlur={() => {
          if (!typed.trim()) close();
        }}
        placeholder="Promo code"
        aria-label="Promo code"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        className="h-11 w-full rounded-md border border-input bg-control pr-24 pl-9 font-mono text-base uppercase text-foreground outline-none placeholder:font-sans placeholder:normal-case placeholder:text-muted-foreground focus:border-ring focus:outline-2 focus:outline-ring/30"
      />
      <Button type="submit" disabled={!ready} className="absolute top-1 right-1 h-9 px-3.5">
        Apply
      </Button>
    </form>
  );
}
