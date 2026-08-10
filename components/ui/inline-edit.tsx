'use client';

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { Check, ChevronDown, Pencil, Search } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

import { DatePicker } from './date-picker';

/**
 * Read-as-text, edit-in-place controls.
 *
 * The agent's approval cards are read far more often than they are corrected,
 * so a value stays plain text with a quiet affordance and only becomes a
 * control once it is clicked. Nothing here opens a dialog or a form: the row
 * the operator is reading is the row they edit.
 */

const TRIGGER =
  'group/inline inline-flex max-w-full items-center gap-1 rounded-sm px-1.5 py-0.5 text-left transition-colors ' +
  'hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ' +
  'disabled:pointer-events-none disabled:opacity-60';

const EDITOR =
  'w-full rounded-sm border border-measured bg-field px-1.5 py-0.5 text-sm text-foreground outline-none ' +
  'focus:outline-2 focus:outline-offset-0 focus:outline-measured';

const AFFORDANCE = 'shrink-0 text-muted-foreground opacity-45 transition-opacity group-hover/inline:opacity-100';

export interface InlineOption {
  value: string;
  label: string;
  hint?: string;
}

const SEARCH_THRESHOLD = 7;

/** Close on an outside pointer press — one listener per open control. */
function useDismiss(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open, close]);
  return ref;
}

export function InlineChoice({
  value,
  options,
  onChange,
  ariaLabel,
  placeholder = 'Choose…',
  align = 'end',
  disabled,
  className,
  tone = 'default',
}: {
  value: string;
  options: InlineOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  align?: 'start' | 'end';
  disabled?: boolean;
  className?: string;
  tone?: 'default' | 'muted';
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const listboxId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const containerRef = useDismiss(open, () => setOpen(false));

  const selected = options.find((option) => option.value === value);
  const searchable = options.length > SEARCH_THRESHOLD;
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en-GB');
    if (!needle) return options;
    return options.filter((option) => `${option.label} ${option.hint ?? ''}`.toLocaleLowerCase('en-GB').includes(needle));
  }, [options, query]);

  const openList = () => {
    setQuery('');
    setActive(
      Math.max(
        0,
        options.findIndex((option) => option.value === value),
      ),
    );
    setOpen(true);
  };

  useEffect(() => {
    if (open && searchable) searchRef.current?.focus();
  }, [open, searchable]);

  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const commit = (next: string) => {
    onChange(next);
    setOpen(false);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape' && open) {
      // Swallow it: the agent panel also listens for Escape.
      event.stopPropagation();
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openList();
      return;
    }
    if (!open) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActive((current) => {
        const next = event.key === 'ArrowDown' ? current + 1 : current - 1;
        return Math.min(Math.max(next, 0), Math.max(filtered.length - 1, 0));
      });
    } else if (event.key === 'Enter' && filtered[active]) {
      event.preventDefault();
      commit(filtered[active].value);
    }
  };

  return (
    <div ref={containerRef} className={cn('relative inline-block max-w-full', className)} onKeyDown={onKeyDown}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        className={cn(TRIGGER, 'text-sm', open && 'bg-band')}
      >
        <span
          className={cn(
            'truncate',
            selected ? (tone === 'muted' ? 'text-muted-foreground' : 'font-medium text-foreground') : 'text-muted-foreground',
          )}
        >
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={12} className={cn(AFFORDANCE, open && 'rotate-180 opacity-100')} aria-hidden="true" />
      </button>

      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-1 w-[min(19rem,75vw)] overflow-hidden rounded-sm border border-rule bg-surface shadow-lg',
            align === 'end' ? 'right-0' : 'left-0',
          )}
        >
          {searchable && (
            <div className="flex items-center gap-2 border-b border-divider px-2.5 py-2">
              <Search size={13} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                placeholder="Search…"
                aria-label={`Search ${ariaLabel}`}
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}
          <div ref={listRef} id={listboxId} role="listbox" aria-label={ariaLabel} className="max-h-56 overflow-y-auto p-1">
            {filtered.length === 0 && <p className="px-2.5 py-3 text-xs text-muted-foreground">Nothing matches “{query.trim()}”.</p>}
            {filtered.map((option, index) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value || `empty-${index}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  data-active={index === active}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => commit(option.value)}
                  className={cn(
                    'flex w-full items-start gap-2 rounded-sm px-2.5 py-2 text-left transition-colors',
                    index === active && 'bg-band',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className={cn('block truncate text-sm', isSelected ? 'font-semibold text-foreground' : 'text-foreground')}>
                      {option.label}
                    </span>
                    {option.hint && <span className="mt-0.5 block truncate text-label leading-4 text-muted-foreground">{option.hint}</span>}
                  </span>
                  {isSelected && <Check size={13} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function InlineNumber({
  value,
  onChange,
  ariaLabel,
  prefix,
  suffix,
  min,
  max,
  step = 1,
  decimals = 2,
  disabled,
  className,
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number;
  /** Maximum decimals shown at rest; trailing zeroes are dropped unless prefixed money. */
  decimals?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const display = prefix === '£' ? value.toFixed(2) : trimNumber(value, decimals);

  const start = () => {
    if (disabled) return;
    setDraft(prefix === '£' ? value.toFixed(2) : trimNumber(value, decimals));
    setEditing(true);
  };

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  const commit = () => {
    const parsed = Number(draft.replace(/[^\d.-]/g, ''));
    setEditing(false);
    if (!Number.isFinite(parsed)) return;
    const clamped = Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min ?? -Number.MAX_SAFE_INTEGER, parsed));
    if (clamped !== value) onChange(Number(clamped.toFixed(prefix === '£' ? 2 : 3)));
  };

  if (editing) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <input
          ref={inputRef}
          value={draft}
          inputMode="decimal"
          aria-label={ariaLabel}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              commit();
            } else if (event.key === 'Escape') {
              event.stopPropagation();
              event.preventDefault();
              setEditing(false);
            } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
              event.preventDefault();
              const current = Number(draft.replace(/[^\d.-]/g, '')) || 0;
              const next = current + (event.key === 'ArrowUp' ? step : -step);
              setDraft(
                String(Number(Math.min(max ?? Number.MAX_SAFE_INTEGER, Math.max(min ?? -Number.MAX_SAFE_INTEGER, next)).toFixed(3))),
              );
            }
          }}
          className={cn(EDITOR, 'text-right font-mono tabular-nums')}
          style={{ width: `${Math.max(4, draft.length + 2)}ch` }}
        />
        {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      </span>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={start} aria-label={ariaLabel} className={cn(TRIGGER, className)}>
      <span className="font-mono text-sm tabular-nums text-foreground">
        {prefix}
        {display}
      </span>
      {suffix && <span className="text-xs text-muted-foreground">{suffix}</span>}
      <Pencil size={11} className={AFFORDANCE} aria-hidden="true" />
    </button>
  );
}

export function InlineText({
  value,
  onChange,
  ariaLabel,
  placeholder = 'Add…',
  multiline,
  maxLength = 300,
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  multiline?: boolean;
  maxLength?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const next = draft.trim().slice(0, maxLength);
    if (next !== value) onChange(next);
  };

  if (editing) {
    const shared = {
      ref,
      value: draft,
      maxLength,
      'aria-label': ariaLabel,
      placeholder,
      onBlur: commit,
      onChange: (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(event.target.value),
      onKeyDown: (event: React.KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.stopPropagation();
          event.preventDefault();
          setDraft(value);
          setEditing(false);
        } else if (event.key === 'Enter' && !multiline) {
          event.preventDefault();
          commit();
        }
      },
      className: cn(EDITOR, multiline && 'min-h-16 resize-y'),
    };
    return multiline ? <textarea {...shared} rows={2} /> : <input {...shared} />;
  }

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        setDraft(value);
        setEditing(true);
      }}
      aria-label={ariaLabel}
      className={cn(TRIGGER, 'w-full', className)}
    >
      <span className={cn('min-w-0 flex-1 truncate text-sm', value ? 'text-foreground' : 'text-muted-foreground')}>
        {value || placeholder}
      </span>
      <Pencil size={11} className={AFFORDANCE} aria-hidden="true" />
    </button>
  );
}

export function InlineDate({
  value,
  onChange,
  ariaLabel,
  placeholder = 'Pick a date',
  disabled,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <span className={cn('inline-block w-40', className)} onKeyDown={(event) => event.key === 'Escape' && event.stopPropagation()}>
        <DatePicker
          value={value}
          onValueChange={(next) => {
            onChange(next);
            if (next) setEditing(false);
          }}
          aria-label={ariaLabel}
          autoFocus
          className="[&_input]:h-8 [&_input]:text-sm"
        />
      </span>
    );
  }

  return (
    <button type="button" disabled={disabled} onClick={() => setEditing(true)} aria-label={ariaLabel} className={cn(TRIGGER, className)}>
      <span className={cn('font-mono text-sm tabular-nums', value ? 'text-foreground' : 'text-muted-foreground')}>
        {value ? formatDay(value) : placeholder}
      </span>
      <Pencil size={11} className={AFFORDANCE} aria-hidden="true" />
    </button>
  );
}

function trimNumber(value: number, decimals: number) {
  return Number(value.toFixed(decimals)).toString();
}

function formatDay(iso: string) {
  const parsed = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return iso;
  return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(parsed);
}
