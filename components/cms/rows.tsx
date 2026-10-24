'use client';

import { useState } from 'react';

import { ChevronDown, ChevronRight, Info, Loader2, MoreHorizontal } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { cn } from '@/lib/utils/cn';

// ---------------------------------------------------------------------------
// The row vocabulary of the Content editors' side cards — Status, Schedule,
// Actions on an entry; Model, Actions on a model — so both pages read as one.
// Shaped after Settings' `SettingRow`: an outlined icon tile, a title, the
// value or control on the right.
// ---------------------------------------------------------------------------

/** The outlined icon tile every row leads with, tinted when the row means something. */
export function RowTile({ icon: Icon, tone = 'default' }: { icon: IconComponent; tone?: 'default' | 'warning' | 'success' | 'danger' }) {
  return (
    <span
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-md border',
        tone === 'warning'
          ? 'border-measured/40 bg-measured/8 text-measured'
          : tone === 'success'
            ? 'border-momentum/35 bg-momentum/8 text-momentum'
            : tone === 'danger'
              ? 'border-exception/35 bg-exception/6 text-exception'
              : 'border-rule/55 bg-background text-muted-foreground',
      )}
    >
      <Icon size={16} aria-hidden="true" />
    </span>
  );
}

/** A fact: tile and title on the left, its value (or a small control) on the right. */
export function InfoRow({
  icon,
  title,
  description,
  tone,
  children,
}: {
  icon: IconComponent;
  title: string;
  /** One line under the title saying what the thing is — for a list of things rather than a fact. */
  description?: string;
  /** Tint the tile when the row means something — a state, a warning. */
  tone?: React.ComponentProps<typeof RowTile>['tone'];
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <RowTile icon={icon} tone={tone} />
        {description ? (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
            <p className="truncate text-xs text-muted-foreground">{description}</p>
          </div>
        ) : (
          <p className="truncate text-sm font-semibold text-foreground">{title}</p>
        )}
      </div>
      <div className="flex min-w-0 shrink-0 items-center gap-1.5">{children}</div>
    </div>
  );
}

/** Stacked info rows with the side cards' rhythm — spacing, no hairlines. */
export function InfoRows({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3">{children}</div>;
}

/** One action: the whole row is the button; a chevron says it opens something. */
export function ActionRow({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: IconComponent;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring',
        danger ? 'hover:bg-exception/6' : 'hover:bg-band/50',
      )}
    >
      <RowTile icon={icon} tone={danger ? 'danger' : 'default'} />
      <span className={cn('min-w-0 flex-1 truncate text-sm font-semibold', danger ? 'text-exception' : 'text-foreground')}>{label}</span>
      <ChevronRight
        size={14}
        className={cn('shrink-0 transition-transform group-hover:translate-x-0.5', danger ? 'text-exception/60' : 'text-muted-foreground')}
        aria-hidden="true"
      />
    </button>
  );
}

/** The actions list: rows bleed slightly so hover reads as a row; `danger` rows sit below a hairline. */
export function ActionRows({ children, danger }: { children: React.ReactNode; danger?: React.ReactNode }) {
  return (
    <div className="-mx-2 flex flex-col gap-0.5">
      {children}
      {danger && <div className="mx-2 mt-2 border-t border-rule/50 pt-2 [&>button]:-mx-2 [&>button]:w-[calc(100%+1rem)]">{danger}</div>}
    </div>
  );
}

/** A section's explanation behind an ⓘ in its header, where a paragraph would crowd the aside. */
export function SectionInfo({ label }: { label: string }) {
  return (
    <Tooltip side="top" align="end" wrap label={label}>
      <button
        type="button"
        aria-label="About this section"
        className="flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
      >
        <Info size={15} aria-hidden="true" />
      </button>
    </Tooltip>
  );
}

/** A setting with its control underneath: the row header (tile, title, optional note on the right), then the input. */
export function FieldRow({
  icon,
  title,
  htmlFor,
  note,
  children,
}: {
  icon: IconComponent;
  title: string;
  /** The control's id, so the title is its label. */
  htmlFor?: string;
  note?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <RowTile icon={icon} />
          {htmlFor ? (
            <label htmlFor={htmlFor} className="truncate text-sm font-semibold text-foreground">
              {title}
            </label>
          ) : (
            <p className="truncate text-sm font-semibold text-foreground">{title}</p>
          )}
        </div>
        {note && <span className="shrink-0 text-xs text-muted-foreground">{note}</span>}
      </div>
      <div className="mt-2">{children}</div>
    </div>
  );
}

/**
 * A choice on one line — tile, name, what it's set to — that opens its control
 * underneath on a tap. Built like an `InfoRow`, so it sits in the same rhythm
 * as the facts around it.
 */
export function PickerRow({
  icon,
  title,
  description,
  value,
  muted = false,
  tone,
  open,
  onToggle,
  trailing,
  children,
}: {
  icon: IconComponent;
  title: string;
  /** Controls beside the row, outside its toggle — a switch, a ⋯ menu. */
  trailing?: React.ReactNode;
  /** The row needs attention while closed: `danger` for an error, `warning` for something required left empty. */
  tone?: 'warning' | 'danger';
  /** One line under the title — for a row that is one of a list of things (a language, a reader). */
  description?: string;
  value: string;
  /** The value is a placeholder — nothing set yet. */
  muted?: boolean;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const toggle = (
    <button
      type="button"
      aria-expanded={open}
      onClick={onToggle}
      className="flex w-full min-w-0 items-center justify-between gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {/* A two-line title may shrink (to leave the value room); a one-line one keeps its width. */}
      <span className={cn('flex items-center gap-3', description ? 'min-w-0 max-w-[70%]' : 'shrink-0')}>
        <RowTile icon={icon} tone={tone} />
        {description ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">{title}</span>
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
          </span>
        ) : (
          <span className="truncate text-sm font-semibold text-foreground">{title}</span>
        )}
      </span>
      <span
        className={cn(
          // Takes what the title leaves and clips: a long value ends in "…" before the chevron, never past the row.
          'flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-hidden text-sm',
          tone === 'danger'
            ? 'font-medium text-exception'
            : tone === 'warning'
              ? 'font-medium text-measured'
              : muted
                ? 'font-normal text-muted-foreground/70'
                : 'font-semibold text-foreground',
        )}
      >
        <span className="truncate">{value}</span>
        <ChevronDown
          size={14}
          className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </span>
    </button>
  );
  return (
    <div>
      {trailing ? (
        <div className="flex items-center gap-1.5">
          {toggle}
          <div className="flex shrink-0 items-center gap-1">{trailing}</div>
        </div>
      ) : (
        toggle
      )}
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}

export interface RowMenuItem {
  icon: IconComponent;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Destructive: drawn in red, after the rest. */
  danger?: boolean;
}

/**
 * A row's secondary actions behind a ⋯ button — so a list shows its rows, not
 * a fence of icon buttons. Picking an item closes the menu, then runs it.
 */
export function RowMenu({ label, items, pending = false }: { label: string; items: RowMenuItem[]; pending?: boolean }) {
  const [open, setOpen] = useState(false);
  const run = (item: RowMenuItem) => () => {
    setOpen(false);
    item.onClick();
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={label} disabled={pending} className="shrink-0 text-muted-foreground">
          {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <MoreHorizontal aria-hidden="true" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-2">
        <div className="flex flex-col gap-0.5">
          {[...items.filter((item) => !item.danger), ...items.filter((item) => item.danger)].map((item) => (
            <ActionRow
              key={item.label}
              icon={item.icon}
              label={item.label}
              danger={item.danger}
              disabled={item.disabled}
              onClick={run(item)}
            />
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
