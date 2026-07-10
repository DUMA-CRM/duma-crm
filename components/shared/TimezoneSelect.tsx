'use client';

import { Check, ChevronDown } from 'lucide-react';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';

// Used only if the runtime lacks Intl.supportedValuesOf (very old browsers).
const FALLBACK_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Madrid',
  'Europe/Rome',
  'Europe/Kyiv',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function allTimezones(): string[] {
  try {
    const fn = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf;
    if (typeof fn === 'function') {
      const list = fn('timeZone');
      if (Array.isArray(list) && list.length > 0) return list;
    }
  } catch {
    /* fall through to fallback */
  }
  return FALLBACK_TIMEZONES;
}

interface TimezoneSelectProps {
  value: string;
  onChange: (tz: string) => void;
  id?: string;
  required?: boolean;
  placeholder?: string;
  /** Applied to the text input so it matches the surrounding form. */
  inputClassName?: string;
}

type Coords = { top: number; left: number; width: number };

// Searchable timezone combobox: type to filter, or scroll the list and click.
// The option list is rendered in a portal with fixed positioning so it floats
// over the page — it neither grows the surrounding form nor gets clipped by a
// scrollable modal body.
export function TimezoneSelect({ value, onChange, id, required, placeholder = 'Search timezone…', inputClassName }: TimezoneSelectProps) {
  const zones = useMemo(() => allTimezones(), []);
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const [dirty, setDirty] = useState(false); // true once the user edits the text
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<Coords | null>(null);

  const anchorRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!dirty || q === '') return zones;
    return zones.filter((z) => z.toLowerCase().includes(q));
  }, [zones, query, dirty]);

  // Anchor the floating list to the input's current on-screen position.
  const reposition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 6, left: r.left, width: r.width });
  }, []);

  // Close on outside pointer — checking the portal list too, since it lives
  // outside this component's DOM subtree.
  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || listRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  // While open, keep the list glued to the input as the page/modal scrolls.
  useEffect(() => {
    if (!open) return;
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  // Keep the highlighted option scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  function openList() {
    reposition();
    setQuery(value);
    setDirty(false);
    setActiveIndex(Math.max(0, zones.indexOf(value)));
    setOpen(true);
  }

  function commit(tz: string) {
    onChange(tz);
    setQuery(tz);
    setDirty(false);
    setOpen(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      e.preventDefault();
      openList();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) commit(opt);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(value);
    }
  }

  return (
    <div ref={anchorRef} className="relative">
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        required={required}
        value={open ? query : value}
        placeholder={placeholder}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(e) => {
          setQuery(e.target.value);
          setDirty(true);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={cn(inputClassName, 'pr-9')}
      />
      <ChevronDown
        size={16}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn('absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground cursor-pointer transition-transform duration-150', open && 'rotate-180')}
        aria-hidden="true"
      />

      {open &&
        coords &&
        typeof document !== 'undefined' &&
        createPortal(
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            style={{ position: 'fixed', top: coords.top, left: coords.left, width: coords.width }}
            className="z-[60] max-h-56 overflow-y-auto rounded-xl border border-border bg-surface shadow-lg py-1"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted-foreground">No matching timezone.</li>
            ) : (
              filtered.map((tz, i) => {
                const isSelected = tz === value;
                const isActive = i === activeIndex;
                return (
                  <li
                    key={tz}
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => commit(tz)}
                    className={cn(
                      'flex items-center justify-between gap-2 px-3 py-1.5 text-sm cursor-pointer',
                      isActive ? 'bg-surface-offset text-foreground' : 'text-muted-foreground',
                      isSelected && 'font-medium text-foreground',
                    )}
                  >
                    <span className="truncate">{tz.replace(/_/g, ' ')}</span>
                    {isSelected && <Check size={14} className="text-primary shrink-0" aria-hidden="true" />}
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )}
    </div>
  );
}
