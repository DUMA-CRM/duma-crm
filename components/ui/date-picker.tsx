'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { Calendar, ChevronLeft, ChevronRight, X } from '@/components/icons';

import { cn } from '@/lib/utils';
import { dateToIso, formatIsoForInput, isoToDate, maskDateInput, parseDisplayDate } from '@/lib/utils/date';

import { Button } from './button';

export interface DatePickerProps {
  value?: string;
  onValueChange: (value: string) => void;
  id?: string;
  name?: string;
  label?: string;
  hint?: string;
  error?: string;
  placeholder?: string;
  min?: string;
  max?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  autoFocus?: boolean;
  'aria-label'?: string;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DATE_MASK = '__/__/____';
const DATE_POSITIONS = [0, 1, 3, 4, 6, 7, 8, 9];
const MONTHS = Array.from({ length: 12 }, (_, month) =>
  new Intl.DateTimeFormat('en-GB', { month: 'long' }).format(new Date(2026, month, 1)),
);
const fullLabel = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
type CalendarView = 'days' | 'months' | 'years';

export function DatePicker({
  value = '',
  onValueChange,
  id,
  name,
  label,
  hint,
  error,
  placeholder = DATE_MASK,
  min,
  max,
  required,
  disabled,
  className,
  autoFocus,
  'aria-label': ariaLabel,
}: DatePickerProps) {
  const generatedId = useId();
  const inputId = id ?? `date-${generatedId}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = isoToDate(value);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [view, setView] = useState(() => selected ?? new Date());
  const [calendarView, setCalendarView] = useState<CalendarView>('days');
  const [inputError, setInputError] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const moveCaret = (start: number, end = start) => {
    requestAnimationFrame(() => inputRef.current?.setSelectionRange(start, end));
  };

  const clearSelection = (masked: string, start: number, end: number) => {
    const chars = masked.split('');
    DATE_POSITIONS.forEach((position) => {
      if (position >= start && position < end) chars[position] = '_';
    });
    return chars;
  };

  useEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(320, window.innerWidth - 32);
      const left = Math.max(16, Math.min(rect.left, window.innerWidth - width - 16));
      const below = window.innerHeight - rect.bottom >= 390;
      setPosition({ top: below ? rect.bottom + 8 : Math.max(16, rect.top - 390), left });
    };
    place();
    const close = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', close);
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      document.removeEventListener('pointerdown', close);
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open]);

  const days = useMemo(() => {
    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const cursor = new Date(first);
    cursor.setDate(first.getDate() - ((first.getDay() + 6) % 7));
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(cursor);
      date.setDate(cursor.getDate() + index);
      return date;
    });
  }, [view]);

  const yearPageStart = Math.floor(view.getFullYear() / 12) * 12;
  const years = Array.from({ length: 12 }, (_, index) => yearPageStart + index);

  const monthUnavailable = (year: number, month: number) => {
    const first = dateToIso(new Date(year, month, 1));
    const last = dateToIso(new Date(year, month + 1, 0));
    return Boolean((min && last < min) || (max && first > max));
  };

  const yearUnavailable = (year: number) => {
    const first = `${year}-01-01`;
    const last = `${year}-12-31`;
    return Boolean((min && last < min) || (max && first > max));
  };

  const navigateCalendar = (direction: -1 | 1) => {
    if (calendarView === 'days') setView(new Date(view.getFullYear(), view.getMonth() + direction, 1));
    if (calendarView === 'months') setView(new Date(view.getFullYear() + direction, view.getMonth(), 1));
    if (calendarView === 'years') setView(new Date(view.getFullYear() + direction * 12, view.getMonth(), 1));
  };

  const commitDraft = () => {
    const digits = draft.replace(/\D/g, '');
    if (!digits) {
      if (!required) {
        onValueChange('');
        setInputError('');
      }
      return;
    }
    if (digits.length < DATE_POSITIONS.length) {
      setInputError('Enter a complete date in DD/MM/YYYY format.');
      return;
    }
    const parsed = parseDisplayDate(maskDateInput(digits));
    if (!parsed || (min && parsed < min) || (max && parsed > max)) {
      setInputError(min || max ? 'Choose a date within the available range.' : 'Use DD/MM/YYYY, for example 02/08/2026.');
      return;
    }
    onValueChange(parsed);
    setDraft(formatIsoForInput(parsed));
    setEditing(false);
    setInputError('');
  };

  const choose = (date: Date) => {
    const next = dateToIso(date);
    if ((min && next < min) || (max && next > max)) return;
    onValueChange(next);
    setDraft(formatIsoForInput(next));
    setEditing(false);
    setInputError('');
    setOpen(false);
  };

  const describedBy = error || inputError ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div ref={rootRef} className="relative flex w-full flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="block text-label uppercase text-muted-foreground">
          {label}
          {required && (
            <span className="ml-1 text-destructive" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      <div ref={anchorRef} className="relative flex items-center">
        <input
          ref={inputRef}
          id={inputId}
          value={editing ? draft : formatIsoForInput(value)}
          onChange={(event) => {
            setEditing(true);
            setDraft(maskDateInput(event.target.value));
            setInputError('');
          }}
          onBlur={(event) => {
            if (!panelRef.current?.contains(event.relatedTarget as Node)) {
              commitDraft();
              setEditing(false);
            }
          }}
          onFocus={() => {
            const masked = maskDateInput(formatIsoForInput(value));
            setDraft(masked);
            setEditing(true);
            setView(selected ?? new Date());
            setCalendarView('days');
            setOpen(true);
            if (value) moveCaret(0, DATE_MASK.length);
            else moveCaret(0);
          }}
          onKeyDown={(event) => {
            const start = event.currentTarget.selectionStart ?? 0;
            const end = event.currentTarget.selectionEnd ?? start;
            if (/^\d$/.test(event.key) && !event.metaKey && !event.ctrlKey && !event.altKey) {
              event.preventDefault();
              const chars = clearSelection(draft || DATE_MASK, start, end);
              const target = DATE_POSITIONS.find((position) => position >= start);
              if (target === undefined) return;
              chars[target] = event.key;
              setDraft(chars.join(''));
              setEditing(true);
              setInputError('');
              const next = DATE_POSITIONS.find((position) => position > target) ?? DATE_MASK.length;
              moveCaret(next);
              return;
            }
            if (event.key === 'Backspace' || event.key === 'Delete') {
              event.preventDefault();
              const chars = clearSelection(draft || DATE_MASK, start, end);
              let target: number | undefined;
              if (start === end) {
                target =
                  event.key === 'Backspace'
                    ? [...DATE_POSITIONS].reverse().find((position) => position < start)
                    : DATE_POSITIONS.find((position) => position >= start);
                if (target !== undefined) chars[target] = '_';
              }
              setDraft(chars.join(''));
              setEditing(true);
              setInputError('');
              moveCaret(target ?? start);
              return;
            }
            if (event.key === '/') {
              event.preventDefault();
              const next = DATE_POSITIONS.find((position) => position > start);
              moveCaret(next ?? DATE_MASK.length);
              return;
            }
            if (event.key === 'Enter') {
              event.preventDefault();
              commitDraft();
              setEditing(false);
              setOpen(false);
            }
            if (event.key === 'Escape') {
              setDraft(maskDateInput(formatIsoForInput(value)));
              setEditing(false);
              setInputError('');
              setOpen(false);
            }
            if (event.key === 'ArrowDown' && event.altKey) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          onPaste={(event) => {
            const pastedDigits = event.clipboardData.getData('text').replace(/\D/g, '');
            if (!pastedDigits) return;
            event.preventDefault();
            const start = event.currentTarget.selectionStart ?? 0;
            const end = event.currentTarget.selectionEnd ?? start;
            const chars = clearSelection(draft || DATE_MASK, start, end);
            const targets = DATE_POSITIONS.filter((position) => position >= start);
            if (!targets.length) return;
            pastedDigits
              .slice(0, targets.length)
              .split('')
              .forEach((digit, index) => {
                chars[targets[index]] = digit;
              });
            setDraft(chars.join(''));
            setEditing(true);
            setInputError('');
            const lastTarget = targets[Math.min(pastedDigits.length, targets.length) - 1];
            const next = DATE_POSITIONS.find((position) => position > lastTarget) ?? DATE_MASK.length;
            moveCaret(next);
          }}
          placeholder={placeholder}
          maxLength={DATE_MASK.length}
          required={required}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode="numeric"
          autoComplete="off"
          aria-label={ariaLabel}
          aria-invalid={Boolean(error || inputError)}
          aria-describedby={describedBy}
          aria-haspopup="dialog"
          className={cn(
            'h-9 w-full rounded-sm border border-input bg-field pl-3 pr-16 text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm',
            'transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15',
            (error || inputError) && 'border-destructive/60 focus:border-destructive focus:ring-destructive/15',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        />
        {value && !disabled && (
          <button
            type="button"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onValueChange('');
              setDraft('');
              setEditing(false);
              setInputError('');
            }}
            className="absolute right-9 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Clear date"
          >
            <X size={13} />
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            if (!open) {
              setView(selected ?? new Date());
              setCalendarView('days');
            }
            setOpen((current) => !current);
          }}
          aria-expanded={open}
          aria-haspopup="dialog"
          className="absolute right-1.5 rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
          aria-label="Open calendar"
        >
          <Calendar size={15} />
        </button>
      </div>
      {name && <input type="hidden" name={name} value={value} />}

      {error || inputError ? (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
          {error || inputError}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}

      {open &&
        !disabled &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose date"
            style={position}
            className="fixed z-[100] w-[min(20rem,calc(100vw-2rem))] rounded-sm border border-rule bg-card p-3 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2 pb-3">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => navigateCalendar(-1)}
                aria-label={calendarView === 'days' ? 'Previous month' : calendarView === 'months' ? 'Previous year' : 'Previous 12 years'}
              >
                <ChevronLeft />
              </Button>
              <div className="flex min-w-0 items-center justify-center gap-1 text-sm font-semibold" aria-live="polite">
                {calendarView === 'days' && (
                  <button
                    type="button"
                    onClick={() => setCalendarView('months')}
                    className="rounded-sm px-2 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label={`Choose month, currently ${MONTHS[view.getMonth()]}`}
                  >
                    {MONTHS[view.getMonth()]}
                  </button>
                )}
                {calendarView !== 'years' ? (
                  <button
                    type="button"
                    onClick={() => setCalendarView('years')}
                    className="rounded-sm px-2 py-1 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    aria-label={`Choose year, currently ${view.getFullYear()}`}
                  >
                    {view.getFullYear()}
                  </button>
                ) : (
                  <span className="px-2 py-1">
                    {yearPageStart}–{yearPageStart + 11}
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => navigateCalendar(1)}
                aria-label={calendarView === 'days' ? 'Next month' : calendarView === 'months' ? 'Next year' : 'Next 12 years'}
              >
                <ChevronRight />
              </Button>
            </div>
            {calendarView === 'days' && (
              <div className="grid grid-cols-7 gap-1" role="grid">
                {WEEKDAYS.map((day) => (
                  <div key={day} role="columnheader" className="py-1 text-center text-micro uppercase text-muted-foreground">
                    {day}
                  </div>
                ))}
                {days.map((date) => {
                  const iso = dateToIso(date);
                  const outside = date.getMonth() !== view.getMonth();
                  const active = iso === value;
                  const today = iso === dateToIso(new Date());
                  const unavailable = Boolean((min && iso < min) || (max && iso > max));
                  return (
                    <button
                      key={iso}
                      type="button"
                      role="gridcell"
                      disabled={unavailable}
                      aria-selected={active}
                      aria-label={fullLabel.format(date)}
                      onClick={() => choose(date)}
                      className={cn(
                        'relative flex size-9 items-center justify-center rounded-sm text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                        outside && 'text-muted-foreground/45',
                        today && !active && 'font-bold text-primary',
                        active && 'bg-primary font-bold text-primary-foreground hover:bg-primary/90',
                        unavailable && 'cursor-not-allowed opacity-25',
                      )}
                    >
                      {date.getDate()}
                      {today && !active && <span className="absolute bottom-1 size-1 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>
            )}
            {calendarView === 'months' && (
              <div className="grid grid-cols-3 gap-2 py-2" role="grid" aria-label={`Choose a month in ${view.getFullYear()}`}>
                {MONTHS.map((month, index) => {
                  const active = selected?.getFullYear() === view.getFullYear() && selected.getMonth() === index;
                  const unavailable = monthUnavailable(view.getFullYear(), index);
                  return (
                    <button
                      key={month}
                      type="button"
                      role="gridcell"
                      disabled={unavailable}
                      aria-selected={active}
                      onClick={() => {
                        setView(new Date(view.getFullYear(), index, 1));
                        setCalendarView('days');
                      }}
                      className={cn(
                        'h-12 rounded-sm text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                        active && 'bg-primary font-bold text-primary-foreground hover:bg-primary/90',
                        unavailable && 'cursor-not-allowed opacity-25',
                      )}
                    >
                      {month.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            )}
            {calendarView === 'years' && (
              <div className="grid grid-cols-3 gap-2 py-2" role="grid" aria-label="Choose a year">
                {years.map((year) => {
                  const active = year === selected?.getFullYear();
                  const unavailable = yearUnavailable(year);
                  return (
                    <button
                      key={year}
                      type="button"
                      role="gridcell"
                      disabled={unavailable}
                      aria-selected={active}
                      onClick={() => {
                        setView(new Date(year, view.getMonth(), 1));
                        setCalendarView('months');
                      }}
                      className={cn(
                        'h-12 rounded-sm text-sm font-medium tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                        active && 'bg-primary font-bold text-primary-foreground hover:bg-primary/90',
                        unavailable && 'cursor-not-allowed opacity-25',
                      )}
                    >
                      {year}
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-rule pt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  onValueChange('');
                  setDraft('');
                  setEditing(false);
                  setInputError('');
                  setOpen(false);
                }}
                disabled={required}
              >
                Clear
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => choose(new Date())}>
                Today
              </Button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
