'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { type IconComponent, Loader2, Minus, Plus } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

/** An on/off control. A spring on the knob, so a flip reads as a physical switch. */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
  onDark = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
  /** For use on a solid brand surface, where a primary-green "on" would vanish. */
  onDark?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'inline-flex h-6 w-10 shrink-0 items-center rounded-full border p-0.5 transition-colors duration-200',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45',
        onDark
          ? checked
            ? 'justify-end border-white/50 bg-white/30'
            : 'justify-start border-white/30 bg-black/10'
          : checked
            ? 'justify-end border-primary bg-primary'
            : 'justify-start border-rule bg-band',
      )}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 34 }} className="size-4 rounded-full bg-white shadow-sm" />
    </button>
  );
}

/**
 * One labelled setting with its control on the right. Rows stack inside a
 * section with hairlines between them.
 */
export function SettingRow({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon?: IconComponent;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  // A title on its own is one line, so it centres against the control; a
  // description makes the text block tall, so it hangs from the top instead.
  const titleOnly = !description;
  return (
    <div className={cn('flex justify-between gap-4 py-4 first:pt-0 last:pb-0', titleOnly ? 'items-center' : 'items-start')}>
      <div className={cn('flex min-w-0 gap-3', titleOnly && 'items-center')}>
        {Icon && (
          <span
            className={cn(
              'flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground',
              !titleOnly && 'mt-0.5',
            )}
          >
            <Icon size={16} aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description && <p className="mt-0.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">{children}</div>
    </div>
  );
}

export function SettingRows({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-rule/40">{children}</div>;
}

/**
 * Sticky bar that rises from the bottom while a form holds unsaved changes —
 * the save action is always in reach however long the page is, and a clean
 * form shows no buttons at all.
 */
export function SaveBar({
  dirty,
  saving,
  onSave,
  onDiscard,
  saveLabel = 'Save changes',
  message = 'You have unsaved changes',
  disabled,
  extra,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
  message?: string;
  disabled?: boolean;
  /** Extra action beside save, e.g. Publish. */
  extra?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <AnimatePresence>
      {dirty && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="sticky bottom-4 z-20 mt-6 flex flex-wrap items-center gap-3 rounded-lg border border-rule/70 bg-card/95 px-4 py-3 shadow-lg backdrop-blur-sm"
          role="region"
          aria-label="Unsaved changes"
        >
          <span className="mr-auto flex items-center gap-2 text-sm font-medium text-foreground">
            <span className="size-2 rounded-full bg-stock" aria-hidden="true" />
            {message}
          </span>
          <Button type="button" variant="ghost" size="lg" className="h-11 px-4" onClick={onDiscard} disabled={saving}>
            Discard
          </Button>
          {extra}
          <Button type="button" size="lg" className="h-11 min-w-32 px-5" onClick={onSave} disabled={saving || disabled}>
            {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
            {saving ? 'Saving…' : saveLabel}
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** A label/value read-out line, for facts rather than controls. */
export function ReadOut({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-4 py-2.5">
      <dt className="w-36 shrink-0 text-label uppercase text-muted-foreground">{label}</dt>
      <dd className="min-w-0 flex-1 truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}

/** One fact as an icon tile — scanned at a glance rather than read as a table. Use inside a <dl>. */
export function Fact({
  icon: Icon,
  label,
  value,
  hint,
  href,
  onSelect,
  selected = false,
  tone = 'default',
  surface = 'panel',
}: {
  icon: IconComponent;
  label: string;
  value: React.ReactNode;
  /** One quiet line under the value — the context that makes the number mean something. */
  hint?: React.ReactNode;
  /** Makes the whole tile a way into the detail behind it. */
  href?: string;
  /** Like `href`, for a tile that opens something in place (another tab, a drawer). */
  onSelect?: () => void;
  /** The tile is the current choice, when a set of tiles acts as a switch. */
  selected?: boolean;
  tone?: 'default' | 'warning' | 'danger';
  /** 'panel' (default) for tiles inside a settings card; 'page' for tiles straight on the page background; 'card' for white tiles, e.g. on a drawer. */
  surface?: 'panel' | 'page' | 'card';
}) {
  const body = (
    <>
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-md',
          tone === 'danger'
            ? 'bg-exception/8 text-exception'
            : tone === 'warning'
              ? 'bg-measured/10 text-measured'
              : 'bg-primary/8 text-primary',
        )}
      >
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <dt className="text-label uppercase text-muted-foreground">{label}</dt>
        <dd className={cn('mt-0.5 truncate text-sm font-semibold', tone === 'danger' ? 'text-exception' : 'text-foreground')}>{value}</dd>
        {hint && <dd className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</dd>}
      </div>
    </>
  );
  const className = cn(
    'flex items-center gap-3 rounded-lg border px-3.5 py-3',
    selected
      ? 'border-primary bg-primary/5'
      : surface === 'page'
        ? 'border-rule/60 bg-field'
        : surface === 'card'
          ? 'border-rule/60 bg-card'
          : 'border-rule/50 bg-background/60',
  );
  const interactive = cn(
    className,
    'text-left transition-colors hover:border-rule hover:bg-band/45 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  );
  if (href)
    return (
      <Link href={href} className={interactive}>
        {body}
      </Link>
    );
  if (onSelect)
    return (
      <button type="button" onClick={onSelect} aria-pressed={selected || undefined} className={interactive}>
        {body}
      </button>
    );
  return <div className={className}>{body}</div>;
}

/**
 * A switchable option as a tile — the Modules-tab look: solid with a light green
 * icon while on, dashed and grey while off. Use in a 2-column grid.
 */
export function ToggleCard({
  icon: Icon,
  title,
  description,
  checked,
  onChange,
  disabled,
  tone = 'default',
}: {
  icon: IconComponent;
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  /** `warning` for a switch whose "on" is a hold (pause), so it reads as a caution rather than a feature. */
  tone?: 'default' | 'warning';
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors',
        checked
          ? tone === 'warning'
            ? 'border-stock/40 bg-warning-highlight'
            : 'border-rule/50 bg-background/60'
          : 'border-dashed border-rule/60 bg-transparent',
        disabled && 'opacity-55',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-md transition-colors',
          checked ? (tone === 'warning' ? 'bg-stock/10 text-stock' : 'bg-primary/8 text-primary') : 'bg-band text-muted-foreground',
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-semibold', checked ? 'text-foreground' : 'text-muted-foreground')}>{title}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>}
      </span>
      <Switch label={title} checked={checked} onChange={onChange} disabled={disabled} />
    </div>
  );
}

/**
 * A number setting as a tile: what it is on the left, a − value + stepper on
 * the right, all one width. The field can still be typed into; it settles into range on blur,
 * so clearing it to retype never fights you.
 */
export function StepperCard({
  icon: Icon,
  title,
  description,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
}: {
  icon: IconComponent;
  title: string;
  description?: React.ReactNode;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
}) {
  const [text, setText] = useState<string | null>(null);
  const clamp = (next: number) => Math.min(max, Math.max(min, Math.round(next)));
  const current = Number.isFinite(value) ? value : min;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{description}</span>}
      </span>
      {/* Fixed width, so a row of steppers lines up whatever the unit. */}
      <div className="flex w-36 shrink-0 items-center rounded-md border border-rule/60 bg-field focus-within:border-ring">
        <button
          type="button"
          aria-label={`Less — ${title}`}
          disabled={current <= min}
          onClick={() => onChange(clamp(current - step))}
          className="flex size-9 items-center justify-center rounded-l-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <Minus size={15} aria-hidden="true" />
        </button>
        <label className="flex h-9 flex-1 items-center justify-center gap-1 border-x border-rule/60 px-2">
          <input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={step}
            aria-label={title}
            value={text ?? String(current)}
            onChange={(event) => {
              setText(event.target.value);
              const next = Number(event.target.value);
              if (event.target.value !== '' && Number.isFinite(next) && next >= min && next <= max) onChange(Math.round(next));
            }}
            onBlur={() => {
              if (text !== null) onChange(clamp(Number(text) || min));
              setText(null);
            }}
            style={{ width: `${Math.max(2, String(text ?? current).length) + 0.5}ch` }}
            className="h-9 bg-transparent text-center text-base font-semibold tabular-nums text-foreground outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </label>
        <button
          type="button"
          aria-label={`More — ${title}`}
          disabled={current >= max}
          onClick={() => onChange(clamp(current + step))}
          className="flex size-9 items-center justify-center rounded-r-md text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-40"
        >
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
