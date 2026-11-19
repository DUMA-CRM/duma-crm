'use client';

import Image from 'next/image';
import { useRef, useState } from 'react';

import { Check, Plus, Trash2, X } from '@/components/icons';
import { QuantityStepper } from '@/components/pos/QuantityStepper';
import { Bone } from '@/components/shared/Skeleton';
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
  /** A line already on the ticket: the screen opens on its choices and saves back to it. */
  editing?: { quantity: number; selectedIds: string[]; note: string };
  /** With `editing`, takes the line off the ticket. */
  onRemove?: () => void;
}

/**
 * Takes over the ticket panel while an item is being built — or rebuilt: with
 * `editing` it opens on a ticket line's own choices, quantity and note and
 * saves back to that line, the one editor for adding and changing (as Square
 * does). The groups follow the rules `POST /orders` enforces — a required size
 * must be chosen, "choose one" swaps — so the till can't build a drink the API
 * will refuse at payment. Mount with a `key` per item or line: state starts fresh.
 */
export function ItemCustomiser({ item, groups, onAdd, onCancel, currency, editing, onRemove }: ItemCustomiserProps) {
  const [selected, setSelected] = useState<string[] | null>(editing ? editing.selectedIds : null);
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [note, setNote] = useState(editing?.note ?? '');
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
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border pr-2 pl-4">
        {item.image && (
          <div className="size-9 shrink-0 overflow-hidden rounded-md bg-band">
            <Image unoptimized width={36} height={36} src={item.image} alt="" className="size-full object-cover" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base leading-tight font-semibold text-heading">{item.name}</p>
          <p data-figure className="text-xs tabular-nums text-muted-foreground">
            {editing ? 'Editing ticket line · ' : ''}
            {formatPrice(item.price, currency)}
          </p>
        </div>
        {/* Editing, leaving keeps what was typed — the old inline editor saved as you went, and a
            note lost to ✕ looked like a bug. A required choice left empty still can't be kept. */}
        {editing ? (
          <Button variant="ghost" onClick={missing.length > 0 ? onCancel : add} className="h-11 px-3 font-semibold text-primary">
            Done
          </Button>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            onClick={onCancel}
            aria-label={`Close ${item.name}`}
            className="size-11 text-muted-foreground"
          >
            <X size={20} />
          </Button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="space-y-6 p-4">
          {!groups ? (
            <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading options">
              {[0, 1].map((group) => (
                <div key={group}>
                  <div className="mb-2.5 flex items-baseline justify-between gap-3">
                    <Bone className={group === 0 ? 'h-4 w-24' : 'h-4 w-32'} />
                    <Bone className="h-3 w-20" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="flex min-h-14 flex-col justify-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2"
                        aria-hidden="true"
                      >
                        <Bone className={i % 2 === 0 ? 'h-3.5 w-20' : 'h-3.5 w-16'} />
                        {i % 3 === 0 && <Bone className="h-3 w-10" />}
                      </div>
                    ))}
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
                  className={cn('scroll-mt-4 rounded-md outline-offset-[6px]', nudged === group.id && 'outline-2 outline-exception')}
                >
                  <div className="mb-2.5 flex items-baseline justify-between gap-3">
                    <h3 id={`group-${group.id}`} className="text-base font-semibold text-heading">
                      {group.name}
                    </h3>
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
                            'flex min-h-14 touch-manipulation select-none items-center justify-between gap-2 rounded-md border px-3.5 py-2 text-left transition-colors duration-75 active:bg-band',
                            active ? 'border-primary bg-primary/8 shadow-[inset_0_0_0_1px_var(--primary)]' : 'border-border bg-card',
                          )}
                        >
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold leading-snug text-heading">{option.label}</span>
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
                              active ? 'border-primary bg-primary text-primary-foreground' : 'border-edge',
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
                  <span className="mb-2 block text-base font-semibold text-heading">Note for the kitchen</span>
                  <textarea
                    autoFocus={noteOpen && !note}
                    value={note}
                    maxLength={200}
                    rows={2}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="e.g. Extra hot, no foam"
                    className="w-full resize-none rounded-md border border-input bg-control px-3 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground focus:border-ring focus:outline-2 focus:outline-ring/30"
                  />
                </label>
              ) : (
                <Button
                  variant="outline"
                  size="touch"
                  onClick={() => setNoteOpen(true)}
                  className="w-full justify-start text-muted-foreground"
                >
                  <Plus aria-hidden="true" /> Add a note
                </Button>
              )}
            </section>
          )}
        </div>
      </div>

      <div className="shrink-0 space-y-3 border-t border-border p-4">
        <div className="flex items-center gap-3">
          <QuantityStepper value={quantity} onChange={setQuantity} />
          {editing && onRemove ? (
            <Button
              variant="ghost"
              onClick={onRemove}
              className="ml-auto h-11 gap-2 px-3 text-destructive hover:bg-destructive/8 hover:text-destructive"
            >
              <Trash2 size={17} aria-hidden="true" /> Remove
            </Button>
          ) : (
            <span className="text-sm text-muted-foreground">Quantity</span>
          )}
        </div>
        <Button
          onClick={add}
          disabled={!groups}
          className={cn('h-14 w-full justify-between px-5 text-lg', missing.length > 0 && 'opacity-60')}
        >
          <span>
            {missing.length > 0
              ? `Choose ${missing[0].name.toLowerCase()}`
              : editing
                ? 'Save changes'
                : quantity > 1
                  ? `Add ${quantity}`
                  : 'Add to ticket'}
          </span>
          <span data-figure className="tabular-nums">
            {formatPrice(unit * quantity, currency)}
          </span>
        </Button>
      </div>
    </div>
  );
}
