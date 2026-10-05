'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

import { Check, Minus, Plus, X } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';
import { type OptionGroupRule, defaultSelection, formatPrice, missingGroups, ruleHint, toggleInGroup } from '@/lib/utils/pos';
import type { MenuItem, MenuOption } from '@/types/pos';

interface ItemCustomiserProps {
  item: MenuItem;
  /** Null while the item's options are loading. */
  groups: OptionGroupRule[] | null;
  onAdd: (selected: MenuOption[], quantity: number, note: string) => void;
  onCancel: () => void;
  currency?: string;
}

/**
 * Takes over the ticket panel while an item is being built. The groups follow
 * the rules `POST /orders` enforces — a required size must be chosen, "choose
 * one" swaps — so the till can't build a drink the API will refuse at payment.
 * Mount with `key={item.id}`: selection, quantity and note start fresh per item.
 */
export function ItemCustomiser({ item, groups, onAdd, onCancel, currency }: ItemCustomiserProps) {
  const [selected, setSelected] = useState<string[] | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [noteOpen, setNoteOpen] = useState(false);
  const [nudged, setNudged] = useState<string | null>(null);
  const groupRefs = useRef(new Map<string, HTMLElement>());

  // Defaults arrive with the groups; until the cashier taps something, they are the selection.
  const picks = selected ?? (groups ? defaultSelection(groups) : []);
  const options = groups?.flatMap((group) => group.options) ?? [];
  const chosen = options.filter((option) => picks.includes(option.id));
  const unit = item.price + chosen.reduce((sum, option) => sum + option.price, 0);
  const missing = groups ? missingGroups(groups, picks) : [];

  const add = () => {
    if (!groups) return;
    if (missing.length > 0) {
      // Point at what's missing instead of silently refusing.
      const first = missing[0];
      groupRefs.current.get(first.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setNudged(first.id);
      window.setTimeout(() => setNudged(null), 900);
      return;
    }
    onAdd(chosen, quantity, note.trim());
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-3 border-b border-rule/60 px-5 py-4">
        <div className="size-14 shrink-0 overflow-hidden rounded-lg bg-band">
          {item.image ? (
            <Image width={56} height={56} src={item.image} alt="" className="size-full object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-full items-center justify-center text-xl font-semibold text-muted-foreground/70">
              {item.name[0]?.toUpperCase()}
            </span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-lg font-semibold text-foreground">{item.name}</p>
          <p data-figure className="text-sm tabular-nums text-muted-foreground">{formatPrice(item.price, currency)}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label={`Close ${item.name}`} className="size-12 text-muted-foreground">
          <X size={22} />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-6 p-5">
          {!groups ? (
            <div className="space-y-6" aria-busy="true" aria-label="Loading options">
              {[0, 1].map((group) => (
                <div key={group} className="space-y-2.5">
                  <div className="h-4 w-24 animate-pulse rounded bg-band/70" />
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-band/70" />)}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            groups.map((group) => {
              const count = group.options.filter((option) => picks.includes(option.id)).length;
              const required = group.minSelections > 0;
              const done = count >= group.minSelections;
              return (
                <section
                  key={group.id}
                  ref={(node) => {
                    if (node) groupRefs.current.set(group.id, node);
                    else groupRefs.current.delete(group.id);
                  }}
                  aria-labelledby={`group-${group.id}`}
                  className={cn('scroll-mt-4 rounded-xl outline-offset-[6px]', nudged === group.id && 'outline-2 outline-exception')}
                >
                  <div className="mb-2.5 flex items-baseline justify-between gap-3">
                    <h3 id={`group-${group.id}`} className="text-base font-semibold text-foreground">{group.name}</h3>
                    <span
                      className={cn(
                        'flex items-center gap-1 text-xs font-medium',
                        required && !done ? 'text-exception' : required ? 'text-success' : 'text-muted-foreground',
                      )}
                    >
                      {required && done && <Check size={13} aria-hidden="true" />}
                      {required && !done ? 'Required · ' : ''}
                      {ruleHint(group)}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {group.options.map((option) => {
                      const active = picks.includes(option.id);
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setSelected(toggleInGroup(picks, option.id, group))}
                          className={cn(
                            'flex min-h-14 touch-manipulation select-none items-center justify-between gap-2 rounded-lg border px-3.5 py-2 text-left transition-[transform,background-color,border-color] duration-100 active:scale-[0.97]',
                            active ? 'border-primary bg-primary/8 shadow-[inset_0_0_0_1px_var(--primary)]' : 'border-rule/70 bg-card',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-snug text-foreground">{option.label}</span>
                            {option.price !== 0 && (
                              <span data-figure className="block text-xs tabular-nums text-muted-foreground">
                                {option.price > 0 ? '+' : '−'}
                                {formatPrice(Math.abs(option.price), currency)}
                              </span>
                            )}
                          </span>
                          <span
                            aria-hidden="true"
                            className={cn(
                              'flex size-5 shrink-0 items-center justify-center border transition-colors',
                              group.maxSelections === 1 ? 'rounded-full' : 'rounded-[5px]',
                              active ? 'border-primary bg-primary text-primary-foreground' : 'border-rule',
                            )}
                          >
                            {active && <Check size={12} strokeWidth={3} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}

          {groups && (
            <section aria-label="Note">
              {noteOpen || note ? (
                <label className="block">
                  <span className="mb-2 block text-base font-semibold text-foreground">Note for the kitchen</span>
                  <textarea
                    autoFocus={noteOpen && !note}
                    value={note}
                    maxLength={200}
                    rows={2}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. Extra hot, no foam"
                    className="w-full resize-none rounded-lg border border-input bg-field px-3.5 py-3 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured"
                  />
                </label>
              ) : (
                <Button variant="outline" size="touch" onClick={() => setNoteOpen(true)} className="w-full justify-start text-muted-foreground">
                  <Plus aria-hidden="true" /> Add a note
                </Button>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-3 border-t border-rule/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-muted-foreground">Quantity</span>
          <div className="flex items-center rounded-lg border border-rule/70 bg-card">
            <Button variant="ghost" size="icon" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1} aria-label="One fewer" className="size-12 rounded-r-none active:not-aria-[haspopup]:translate-y-0 active:bg-band">
              <Minus size={18} />
            </Button>
            <span data-figure className="w-10 text-center text-lg font-semibold tabular-nums" aria-live="polite">{quantity}</span>
            <Button variant="ghost" size="icon" onClick={() => setQuantity((q) => Math.min(99, q + 1))} aria-label="One more" className="size-12 rounded-l-none active:not-aria-[haspopup]:translate-y-0 active:bg-band">
              <Plus size={18} />
            </Button>
          </div>
        </div>
        <Button onClick={add} disabled={!groups} className={cn('h-16 w-full justify-between px-5 text-lg', missing.length > 0 && 'opacity-60')}>
          <span>{missing.length > 0 ? `Choose ${missing[0].name.toLowerCase()}` : quantity > 1 ? `Add ${quantity}` : 'Add to ticket'}</span>
          <span data-figure className="tabular-nums">{formatPrice(unit * quantity, currency)}</span>
        </Button>
      </div>
    </div>
  );
}
