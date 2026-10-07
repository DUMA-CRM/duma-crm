'use client';

import Link from 'next/link';

import { ChevronRight } from '@/components/icons';
import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

import { TONE_TINT, type Tone } from './tone';

/* The app's list row, lifted from the orders list — the best row it had:

     [tile]  Title  · extra                         [trailing]  [actions]  ›
             one quiet line of meta

   - `icon` + `tone` draws the tinted tile; `leading` replaces it (an Avatar).
   - `meta` is ONE muted line. If it wants two, one of them belongs elsewhere.
   - `actions` stay hidden until the row is hovered or focused — they are the
     second thing you do with a row, never the first — and never trigger the
     row's own click.
   - A row with `onClick` or `href` is one target with a chevron. */
export function ListRow({
  icon: Icon,
  tone = 'primary',
  iconLabel,
  leading,
  title,
  titleExtra,
  meta,
  trailing,
  actions,
  control,
  onClick,
  href,
  selected = false,
  muted = false,
  chevron,
  as: As = 'li',
  className,
}: {
  icon?: IconComponent;
  tone?: Tone;
  /** What the tile's glyph means, when it carries information (a channel, a status). */
  iconLabel?: string;
  leading?: React.ReactNode;
  title: React.ReactNode;
  titleExtra?: React.ReactNode;
  meta?: React.ReactNode;
  trailing?: React.ReactNode;
  actions?: React.ReactNode;
  /** An always-visible control of its own (a status menu) — rendered beside the
      row's target, never inside it, so it stays its own button. */
  control?: React.ReactNode;
  onClick?: () => void;
  href?: string;
  selected?: boolean;
  /** Finished, cancelled, archived: greyed, still readable. */
  muted?: boolean;
  chevron?: boolean;
  as?: 'li' | 'div';
  className?: string;
}) {
  const interactive = Boolean(onClick || href);
  const showChevron = chevron ?? interactive;

  const tile =
    leading ??
    (Icon ? (
      <span
        className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', TONE_TINT[muted ? 'muted' : tone])}
        title={iconLabel}
        role={iconLabel ? 'img' : undefined}
        aria-label={iconLabel}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
    ) : null);

  // The row's own target holds the tile, text and trailing value. Actions sit
  // BESIDE it, never inside: a button nested in a link or a role="button" is
  // invalid, and its click would still open the row.
  const content = (
    <>
      {tile}
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-center gap-2">
          <span className={cn('truncate text-sm font-semibold', muted ? 'text-muted-foreground' : 'text-foreground')}>{title}</span>
          {titleExtra}
        </span>
        {meta && <span className="mt-0.5 block truncate text-xs text-muted-foreground">{meta}</span>}
      </span>
      {trailing && <span className="flex shrink-0 items-center gap-2">{trailing}</span>}
      {/* With actions or a control beside it, the chevron would sit after them and outside
          the target; the hover actions already say there is more to do. */}
      {showChevron && !actions && !control && <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
    </>
  );

  const targetClass = cn(
    'flex min-w-0 flex-1 items-center gap-3 py-3 pl-3.5',
    actions ? 'pr-1' : 'pr-3.5',
    interactive && 'cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
  );

  const target = href ? (
    <Link href={href} className={targetClass} aria-current={selected || undefined}>
      {content}
    </Link>
  ) : onClick ? (
    <div
      role="button"
      tabIndex={0}
      aria-current={selected || undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      className={targetClass}
    >
      {content}
    </div>
  ) : (
    <div className={targetClass}>{content}</div>
  );

  return (
    <As
      className={cn(
        'group/row flex items-center border-b border-rule/45 transition-colors last:border-b-0',
        selected ? 'bg-band' : interactive ? 'hover:bg-band/40' : actions && 'hover:bg-band/25',
        className,
      )}
    >
      {target}
      {control && <span className="flex shrink-0 items-center pr-2">{control}</span>}
      {actions && (
        <span className="flex shrink-0 items-center gap-0.5 pr-2.5 opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 pointer-coarse:opacity-100">
          {actions}
        </span>
      )}
    </As>
  );
}
