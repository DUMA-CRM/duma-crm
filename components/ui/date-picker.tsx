'use client';

import { useId, useRef, useState } from 'react';

import { Calendar as CalendarIcon, X } from '@/components/icons';

import { cn } from '@/lib/utils/cn';
import { dateToIso, formatIsoForInput, isoToDate, maskDateInput, parseDisplayDate } from '@/lib/utils/date';

import { Button } from './button';
import { Calendar } from './calendar';
import { Popover, PopoverAnchor, PopoverContent } from './popover';

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

const DATE_MASK = '__/__/____';
const DATE_POSITIONS = [0, 1, 3, 4, 6, 7, 8, 9];
/** How far the month/year dropdowns reach when no min/max narrows them — a date of birth needs the first. */
const EARLIEST = new Date(1920, 0, 1);
const latest = () => new Date(new Date().getFullYear() + 10, 11, 31);

/**
 * A date field: type it as DD/MM/YYYY, or pick it from the shared `Calendar`.
 * `<Input type="date">` renders this, so every date in the app arrives here.
 *
 * The value is an ISO `YYYY-MM-DD` string in and out. Typing keeps the mask
 * and caret behaviour it always had; the panel is the shadcn calendar in a
 * radix popover (2026-10-04), which brought keyboard navigation of the grid
 * and month/year dropdowns, and replaced the hand-placed portal and its own
 * outside-click and scroll handling.
 */
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
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const selected = isoToDate(value);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [month, setMonth] = useState(() => selected ?? new Date());
  const [inputError, setInputError] = useState('');

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

  const minDate = isoToDate(min);
  const maxDate = isoToDate(max);

  /** Opens on the chosen month, or today's. */
  const openPanel = () => {
    setMonth(selected ?? new Date());
    setOpen(true);
  };

  /** Alt+↓ moves focus into the grid, onto the chosen day or today. */
  const focusGrid = () => {
    requestAnimationFrame(() => {
      const panel = panelRef.current;
      const target =
        panel?.querySelector<HTMLButtonElement>('[data-selected-single="true"]') ??
        panel?.querySelector<HTMLButtonElement>('[data-today="true"]') ??
        panel?.querySelector<HTMLButtonElement>('[data-day]:not([disabled])');
      target?.focus();
    });
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
      <Popover open={open && !disabled} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div className="relative flex items-center">
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
                openPanel();
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
                  if (!open) openPanel();
                  focusGrid();
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
                // The `Input` field exactly: same height, hairline, fill and the amber focus marker.
                'h-9 w-full rounded-md border border-input bg-field pl-3 pr-16 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground sm:text-sm',
                'tabular-nums transition-[border-color,outline-color] duration-150 focus:border-measured focus:outline-2 focus:outline-offset-0 focus:outline-measured',
                (error || inputError) && 'border-exception focus:border-exception focus:outline-exception',
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
                className="absolute right-9 rounded-sm p-1 text-muted-foreground hover:bg-band hover:text-foreground"
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
                if (open) setOpen(false);
                else {
                  openPanel();
                  focusGrid();
                }
              }}
              aria-expanded={open}
              aria-haspopup="dialog"
              className="absolute right-1.5 rounded-sm p-1.5 text-muted-foreground hover:bg-band hover:text-foreground disabled:opacity-50"
              aria-label="Open calendar"
            >
              <CalendarIcon size={15} />
            </button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          ref={panelRef}
          aria-label="Choose date"
          className="w-auto"
          // Typing stays in the field; the grid is reached by Alt+↓ or the button.
          onOpenAutoFocus={(event) => event.preventDefault()}
          // A click back into the field is not "outside".
          onInteractOutside={(event) => {
            if (rootRef.current?.contains(event.target as Node)) event.preventDefault();
          }}
        >
          <Calendar
            mode="single"
            selected={selected ?? undefined}
            onSelect={(date) => date && choose(date)}
            month={month}
            onMonthChange={setMonth}
            startMonth={minDate ?? EARLIEST}
            endMonth={maxDate ?? latest()}
            disabled={[...(minDate ? [{ before: minDate }] : []), ...(maxDate ? [{ after: maxDate }] : [])]}
          />
          <div className="mt-3 flex items-center justify-between border-t border-rule/50 pt-3">
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
              disabled={required || !value}
            >
              Clear
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => choose(new Date())}>
              Today
            </Button>
          </div>
        </PopoverContent>
      </Popover>
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
    </div>
  );
}
