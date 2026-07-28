'use client';

import { Check, ChevronDown, Plus } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';

const inputClass =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

/**
 * Free-text input with a suggestions dropdown: focusing shows every existing
 * category immediately; typing filters them; anything else creates a new one.
 * Used for menu modifier categories and email template categories.
 */
export function CategoryCombobox({
  value,
  onChange,
  categories,
  placeholder = 'Choose or type a category',
  allowEmpty = true,
  id,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  categories: string[];
  placeholder?: string;
  /** Offer a "No category" choice — off for fields that require a value. */
  allowEmpty?: boolean;
  id?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listboxId = `${id ?? 'category'}-listbox`;

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  const q = value.trim().toLowerCase();
  const filtered = q ? categories.filter((c) => c.toLowerCase().includes(q)) : categories;
  const isNew = q.length > 0 && !categories.some((c) => c.toLowerCase() === q);

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  return (
    <div ref={ref} className={cn('relative', className)}>
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          // Close just the dropdown on Escape without closing the page/modal.
          if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        className={inputClass + ' pr-9'}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
      />
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        tabIndex={-1}
        aria-label="Show categories"
        className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronDown size={14} className={cn('transition-transform duration-150', open && 'rotate-180')} aria-hidden="true" />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1.5 bg-surface border border-border rounded-xl shadow-lg py-1 z-50 max-h-48 overflow-y-auto"
        >
          {allowEmpty && (
            <button
              type="button"
              onClick={() => pick('')}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-surface-offset',
                !value ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              <span>No category</span>
              {!value && <Check size={14} className="text-primary shrink-0" aria-hidden="true" />}
            </button>
          )}

          {allowEmpty && filtered.length > 0 && <div className="my-1 h-px bg-divider mx-3" aria-hidden="true" />}

          {filtered.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => pick(c)}
              className={cn(
                'w-full flex items-center justify-between gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-surface-offset',
                c === value.trim() ? 'text-foreground font-medium' : 'text-muted-foreground',
              )}
            >
              <span className="truncate">{c}</span>
              {c === value.trim() && <Check size={14} className="text-primary shrink-0" aria-hidden="true" />}
            </button>
          ))}

          {isNew && (
            <button
              type="button"
              onClick={() => pick(value.trim())}
              className="w-full flex items-center gap-1.5 px-3 py-2 text-sm text-left text-primary font-medium transition-colors hover:bg-surface-offset"
            >
              <Plus size={13} className="shrink-0" aria-hidden="true" />
              <span className="truncate">Create “{value.trim()}”</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
