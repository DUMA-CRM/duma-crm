'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

import { Check, ChevronDown, Search } from '@/components/icons';
import { inputClass } from '@/components/menu/shared';

import type { StockItem } from '@/lib/modules/inventory/client';
import { cn } from '@/lib/utils/cn';

/**
 * Ingredient picker for the recipe editors.
 *
 * Replaces a plain <select> over every stock item, which is workable at twenty
 * ingredients and unusable at two hundred: no search, and no way to see that an
 * ingredient has no cost recorded until the margin silently comes out wrong.
 *
 * Already-used ingredients are filtered out by the caller, so the list only
 * offers what can actually be added.
 */
export function IngredientCombobox({
  value,
  onChange,
  options,
  disabledIds,
  className,
}: {
  value: string;
  onChange: (stockItemId: string) => void;
  options: StockItem[];
  /** Ingredients already on the recipe — shown but not selectable. */
  disabledIds?: Set<string>;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((o) => o.id === value);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // Focus the filter as soon as it opens — the whole point is typing straight away.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.name.toLowerCase().includes(q) || o.unit.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(inputClass, 'flex items-center justify-between gap-2 text-left')}
      >
        <span
          className={cn('truncate', selected ? 'text-foreground' : 'text-muted-foreground')}
          title={selected ? `${selected.name} (${selected.unit})` : undefined}
        >
          {selected ? `${selected.name} (${selected.unit})` : 'Select ingredient…'}
        </span>
        <ChevronDown size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>

      {open && (
        // At least as wide as the field and wider when a name needs it, so no ingredient is cut to "Oat m…".
        <div className="absolute left-0 z-30 mt-1 w-max min-w-full max-w-[min(28rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
          <div className="flex items-center gap-2 border-b border-border px-3">
            <Search size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search ingredients…"
              className="h-10 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </div>

          <ul role="listbox" className="max-h-64 overflow-auto p-1">
            {matches.length === 0 && <li className="px-3 py-2.5 text-xs text-muted-foreground">No ingredient matches “{query}”.</li>}
            {matches.map((option) => {
              const alreadyUsed = disabledIds?.has(option.id) && option.id !== value;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option.id === value}
                    disabled={alreadyUsed}
                    onClick={() => {
                      onChange(option.id);
                      setQuery('');
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left text-sm transition-colors',
                      alreadyUsed ? 'cursor-not-allowed text-muted-foreground/50' : 'hover:bg-band',
                    )}
                  >
                    <Check
                      size={14}
                      className={cn('mt-0.5 shrink-0', option.id === value ? 'text-primary' : 'text-transparent')}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 break-words text-foreground">{option.name}</span>
                    <span className="mt-0.5 shrink-0 text-label text-muted-foreground">{option.unit}</span>
                    {/* Surfaced here because a missing cost is what makes a
                        margin quietly wrong further down the screen. */}
                    {option.costPerUnit == null && <span className="mt-0.5 shrink-0 text-label text-measured">no cost</span>}
                    {alreadyUsed && <span className="mt-0.5 shrink-0 text-label">added</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
