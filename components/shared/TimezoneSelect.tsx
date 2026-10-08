'use client';

import { Check, ChevronDown, Globe } from '@/components/icons';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/lib/utils/cn';
import { timeZoneCity, timeZoneOffsetLabel } from '@/lib/utils/workspace-time';

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
  /** Extra classes for the text input. It already looks like every other field. */
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
    // "buenos aires", "buenos_aires" and "gmt+5" all find what they mean.
    const q = query.trim().toLowerCase().replaceAll(' ', '_');
    if (!dirty || q === '') return zones;
    return zones.filter((z) => z.toLowerCase().includes(q) || describeZone(z).offset.toLowerCase().includes(q));
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

  const current = value ? describeZone(value) : null;

  return (
    <div ref={anchorRef} className="relative flex items-center">
      <Globe size={16} aria-hidden="true" className="pointer-events-none absolute left-3 text-muted-foreground" />
      <input
        id={id}
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-autocomplete="list"
        autoComplete="off"
        required={required}
        value={open ? query.replaceAll('_', ' ') : value.replaceAll('_', ' ')}
        placeholder={placeholder}
        onFocus={openList}
        onClick={() => !open && openList()}
        onChange={(e) => {
          setQuery(e.target.value.replaceAll(' ', '_'));
          setDirty(true);
          setActiveIndex(0);
          setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          // The shared field (components/ui/input.tsx), with room for the globe and the offset.
          'h-9 w-full rounded-md border border-input bg-control pl-9 pr-24 text-base text-foreground shadow-sm sm:text-sm',
          'placeholder:text-muted-foreground outline-none transition-[border-color,outline-color,box-shadow] duration-150',
          'focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured',
          inputClassName,
          'pl-9 pr-24',
        )}
      />
      <span className="pointer-events-none absolute right-8 text-xs tabular-nums text-muted-foreground">{!open && current?.offset}</span>
      <ChevronDown
        size={16}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cn('absolute right-2.5 cursor-pointer text-muted-foreground transition-transform duration-150', open && 'rotate-180')}
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
            className="z-[60] max-h-72 overflow-y-auto overscroll-contain rounded-md border border-rule bg-surface p-1 shadow-lg"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted-foreground">No timezone matches “{query.replaceAll('_', ' ')}”.</li>
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
                      'flex cursor-pointer items-center gap-3 rounded-sm px-2.5 py-2',
                      isActive ? 'bg-band' : '',
                      isSelected && 'bg-primary/8',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-sm text-foreground', isSelected && 'font-semibold')}>
                        {describeZone(tz).city}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{describeZone(tz).region}</span>
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{describeZone(tz).offset}</span>
                    <Check size={14} className={cn('shrink-0 text-primary', !isSelected && 'invisible')} aria-hidden="true" />
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

type ZoneDescription = { city: string; region: string; offset: string };
// Formatting an offset costs an Intl call, and the list holds ~400 zones.
const described = new Map<string, ZoneDescription>();

/** "America/Argentina/Buenos_Aires" → Buenos Aires · America / Argentina · GMT−3. */
function describeZone(zone: string): ZoneDescription {
  const cached = described.get(zone);
  if (cached) return cached;
  const region = zone.split('/').slice(0, -1).join(' / ').replaceAll('_', ' ');
  let offset = '';
  try {
    offset = timeZoneOffsetLabel(zone);
  } catch {
    // A zone the runtime lists but cannot format — show it without an offset.
  }
  const description = { city: timeZoneCity(zone), region: region || 'Universal', offset };
  described.set(zone, description);
  return description;
}
