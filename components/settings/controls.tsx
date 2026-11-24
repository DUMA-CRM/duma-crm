'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { type IconComponent, Pencil } from '@/components/icons';
import { RowTile } from '@/components/shared/rows';
import { ActionButton } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';
import { SAVE_SETTLE_MS, type SaveWatch, watchSave } from '@/lib/utils/motion-feedback';

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
        {Icon && <RowTile icon={Icon} className={titleOnly ? undefined : 'mt-0.5'} />}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description && <p className="mt-0.5 max-w-[60ch] text-sm leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2 self-center">{children}</div>
    </div>
  );
}

export function SettingRows({ children, dividers = true }: { children: React.ReactNode; dividers?: boolean }) {
  return <div className={cn(dividers && 'divide-y divide-border')}>{children}</div>;
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
  // A save that lands holds the bar for a "Saved" beat before it leaves. It is
  // read from the props (lib/utils/motion-feedback.ts), so no caller has to
  // report success.
  const [justSaved, setJustSaved] = useState(false);
  const [watch, setWatch] = useState<SaveWatch>({ saving, dirty, awaiting: false });
  if (watch.saving !== saving || watch.dirty !== dirty) {
    const next = watchSave(watch, { saving, dirty });
    setWatch(next.watch);
    if (next.saved) setJustSaved(true);
  }
  useEffect(() => {
    if (!watch.awaiting) return;
    const timer = setTimeout(() => setWatch((current) => ({ ...current, awaiting: false })), SAVE_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [watch.awaiting]);
  useEffect(() => {
    if (!justSaved) return;
    const timer = setTimeout(() => setJustSaved(false), reduceMotion ? 700 : 1100);
    return () => clearTimeout(timer);
  }, [justSaved, reduceMotion]);
  const settled = justSaved && !dirty;

  const shown = dirty || settled;

  return (
    <>
      {/* The bar floats over the page, so leave room for it at the foot: the last row stays reachable. */}
      {shown && <div aria-hidden="true" className="h-16" />}
      <AnimatePresence>
        {shown && (
          // The Orders page's bulk bar: a compact card floating centred at the foot of the screen.
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="pointer-events-none fixed inset-x-0 bottom-5 z-40 flex justify-center px-4"
            role="region"
            aria-label={settled ? 'Changes saved' : 'Unsaved changes'}
          >
            <div
              className={cn(
                'pointer-events-auto flex flex-wrap items-center gap-2 rounded-lg border bg-card py-2 pr-2 pl-4 shadow-lg transition-colors duration-300',
                settled ? 'border-success/50' : 'border-border',
              )}
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={settled ? 'saved' : 'dirty'}
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: reduceMotion ? 0 : -6 }}
                  transition={{ duration: 0.2 }}
                  className="pr-1 text-sm font-semibold text-heading"
                >
                  {settled ? 'All changes saved' : message}
                </motion.span>
              </AnimatePresence>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setWatch((current) => ({ ...current, awaiting: false }));
                  onDiscard();
                }}
                disabled={saving || settled}
              >
                Discard
              </Button>
              {extra}
              <ActionButton type="button" className="min-w-28" onClick={onSave} pending={saving} done={settled} disabled={disabled}>
                {saveLabel}
              </ActionButton>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
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
  action,
  selected = false,
  tone = 'default',
  surface = 'panel',
  aside,
  children,
  className: tileClassName,
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
  /**
   * With `onSelect`: a visible verb on the tile's right ("Change"), so a tile
   * that edits something reads as a control, not just another figure.
   */
  action?: string;
  /** The tile is the current choice, when a set of tiles acts as a switch. */
  selected?: boolean;
  tone?: 'default' | 'warning' | 'danger';
  /** 'panel' (default) for tiles inside a settings card; 'page' for tiles straight on the page background; 'card' for white tiles, e.g. on a drawer. */
  surface?: 'panel' | 'page' | 'card';
  /** A small picture at the row's right, beside the figure — a sparkline on a wide tile. */
  aside?: React.ReactNode;
  /** What a taller tile shows under the figure's row — the day as a chart, the figures behind it. */
  children?: React.ReactNode;
  className?: string;
}) {
  // Like a marketing feature card: the icon on a small soft tile inside the
  // padding, then a sentence-case label over the value.
  const body = (
    <>
      {/* A fixed-width tile as tall as the text beside it, inside the card's padding; the icon stays one size. */}
      <span
        className={cn(
          'flex min-h-10 w-10 shrink-0 items-center justify-center self-stretch rounded-md',
          tone === 'danger'
            ? 'bg-exception/10 text-exception'
            : tone === 'warning'
              ? 'bg-measured/12 text-measured'
              : 'bg-primary/8 text-primary',
        )}
      >
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 self-center">
        <dt className="text-sm text-muted-foreground">{label}</dt>
        <dd
          className={cn(
            'mt-0.5 truncate font-semibold tabular-nums',
            // Straight on the page the tiles are the page's figures: the number leads.
            surface === 'page' ? 'text-lg leading-snug tracking-title' : 'text-sm',
            tone === 'danger' ? 'text-exception' : 'text-foreground',
          )}
        >
          {value}
        </dd>
        {hint && <dd className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</dd>}
      </div>
      {action && onSelect && (
        <span
          className={cn(
            'inline-flex shrink-0 items-center gap-1 self-center rounded-md border border-edge bg-background px-2 py-1 text-xs font-semibold text-foreground',
            'transition-colors group-hover:border-primary/40 group-hover:bg-primary/8 group-hover:text-primary',
          )}
        >
          <Pencil size={12} aria-hidden="true" />
          {action}
        </span>
      )}
    </>
  );
  const content = children ? (
    <>
      <div className="flex items-center gap-3">
        {body}
        {aside}
      </div>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </>
  ) : (
    <>
      {body}
      {aside}
    </>
  );
  const className = cn(
    children ? 'flex flex-col gap-3' : 'flex items-center gap-3',
    'rounded-lg border px-3.5 py-3',
    selected
      ? 'border-primary bg-primary/5'
      : surface === 'page'
        ? 'border-border bg-card shadow-sm'
        : surface === 'card'
          ? 'border-border bg-card shadow-sm'
          : 'border-border bg-band/35',
    tileClassName,
  );
  const interactive = cn(
    className,
    'text-left transition-colors hover:border-edge hover:bg-band/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  );
  if (href)
    return (
      <Link href={href} className={interactive}>
        {content}
      </Link>
    );
  if (onSelect)
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected || undefined}
        className={cn(interactive, 'group', action && 'cursor-pointer')}
      >
        {content}
      </button>
    );
  return <div className={className}>{content}</div>;
}

/**
 * Icon tile, label and value, with a Change button that opens its form in place —
 * Settings → Account's sign-in rows. Callers keep one open at a time.
 *
 * Without `onToggle` it is the same row with no button: a value that cannot be
 * changed here (a date of birth, a tax code) sitting in a list of ones that can.
 */
export function ChangeRow({
  icon: Icon,
  label,
  value,
  open = false,
  onToggle,
  trailing,
  verbs = ['Change', 'Cancel'],
  tone,
  touch = false,
  children,
}: {
  icon: IconComponent;
  label: string;
  value: React.ReactNode;
  /** The row needs attention while closed: `danger` for a problem a save found, `warning` for something required left empty. */
  tone?: 'warning' | 'danger';
  open?: boolean;
  onToggle?: () => void;
  /** A one-tap action on the value itself (Copy, Call), left of Change. */
  trailing?: React.ReactNode;
  /** The button's words, closed and open — ['Show', 'Hide'] for a row that opens read-only detail. */
  verbs?: readonly [string, string];
  /** On a touch screen, a 44px Change button — for rows used standing up (the host stand's booking drawer). */
  touch?: boolean;
  children?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md',
            tone === 'danger'
              ? 'bg-exception/10 text-exception'
              : tone === 'warning'
                ? 'bg-measured/12 text-measured'
                : 'bg-primary/8 text-primary',
          )}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-label uppercase text-muted-foreground">{label}</p>
          <div className="mt-0.5 flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">{value}</div>
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
        {onToggle && (
          <Button
            // Not a submit: rows sit inside forms (the booking drawer), and opening one must not save it.
            type="button"
            variant={open ? 'ghost' : 'outline'}
            size="sm"
            className={cn(touch && 'pointer-coarse:h-11 pointer-coarse:px-4 pointer-coarse:text-sm')}
            onClick={onToggle}
            aria-expanded={open}
          >
            {open ? verbs[1] : verbs[0]}
          </Button>
        )}
      </div>
      <AnimatePresence initial={false}>
        {open && onToggle && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            // The clip that animates the height bleeds 4px past the row, so a focus ring isn't cut off.
            className="-mx-1 -mb-1 overflow-hidden px-1 pb-1"
          >
            <div className="pt-4 sm:pl-13">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** A `ChangeRow` value it has not got — quiet, so the "needs you" list is the one place that shouts. */
export function ValueMissing({ children }: { children: React.ReactNode }) {
  return <span className="font-normal text-muted-foreground">{children}</span>;
}

/** The quiet half of a `ChangeRow` value — "· 2 years" after a start date. */
export function ValueAside({ children }: { children: React.ReactNode }) {
  return <span className="truncate font-normal text-muted-foreground">{children}</span>;
}
