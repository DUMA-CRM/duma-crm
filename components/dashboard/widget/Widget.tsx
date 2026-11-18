'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

import { AlertTriangle, ArrowUpRight, ChevronRight } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { Bone } from '@/components/shared/Skeleton';
import { useWidgetCell } from '@/components/shared/widget-grid/cell';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

/* One frame for every dashboard widget, after Apple's widgets: a porcelain
 * card with the system's corner (set by the grid, about 13% of a small
 * widget), 16px margins, no border and the softest lift. A tinted name at the
 * top-left says what it is; one large figure carries it; the whole widget is
 * the way into the screen behind it, and rows inside may be their own links.
 * Loading, failed and empty all draw inside the same frame, so a widget never
 * leaves a hole in the board. */

export type Family = 'compact' | 'bar' | 'banner' | 'small' | 'medium' | 'large' | 'extraLarge';

/** The family a widget is drawn at, from its cell in half-rows; medium outside a grid. */
export function useFamily(): Family {
  const cell = useWidgetCell();
  if (!cell) return 'medium';
  if (cell.h <= 1) return cell.w >= 4 ? 'banner' : cell.w >= 2 ? 'bar' : 'compact';
  if (cell.w >= 4) return 'extraLarge';
  if (cell.w === 1) return 'small';
  return cell.h >= 4 ? 'large' : 'medium';
}

/** Half a square tall: the reading goes on one line. */
export const isSlim = (family: Family) => family === 'compact' || family === 'bar' || family === 'banner';

/**
 * How many rows of `rowPx` fit under the header once `reservedPx` (a figure,
 * a caption) is taken — so a list shows what its cell holds and folds the rest
 * into "and N more". Three outside a grid.
 */
export function useRows(rowPx: number, reservedPx = 0): number {
  const cell = useWidgetCell();
  if (!cell) return 3;
  // 32px of margins and the 24px header.
  return Math.max(1, Math.floor((cell.height - 56 - reservedPx) / rowPx));
}

/** The domain colours of the product, for the widget's name and glyph. */
export type WidgetTint = 'brand' | 'orders' | 'kitchen' | 'stock' | 'team' | 'money' | 'exception';

export const TINT_INK: Record<WidgetTint, string> = {
  brand: 'text-primary',
  orders: 'text-measured',
  kitchen: 'text-reference',
  stock: 'text-stock',
  team: 'text-success',
  money: 'text-primary',
  exception: 'text-exception',
};

export const TINT_FILL: Record<WidgetTint, string> = {
  brand: 'bg-primary',
  orders: 'bg-measured',
  kitchen: 'bg-reference',
  stock: 'bg-stock',
  team: 'bg-success',
  money: 'bg-primary',
  exception: 'bg-exception',
};

/** Each domain colour as a CSS variable, for the widget's wash and edge. */
const TINT_VAR: Record<WidgetTint, string> = {
  brand: 'var(--primary)',
  orders: 'var(--measured)',
  kitchen: 'var(--reference)',
  stock: 'var(--stock)',
  team: 'var(--momentum)',
  money: 'var(--primary)',
  exception: 'var(--exception)',
};

/** The header chip, as StatCard's: the accent filled, the glyph knocked out in `on-fill` so it reads in both themes. */
const TINT_CHIP: Record<WidgetTint, string> = {
  brand: 'bg-primary',
  orders: 'bg-measured',
  kitchen: 'bg-reference',
  stock: 'bg-stock',
  team: 'bg-momentum',
  money: 'bg-primary',
  exception: 'bg-exception',
};

export function Widget({
  title,
  icon: Icon,
  tint = 'brand',
  surface = 'wash',
  href,
  hrefLabel,
  accessory,
  loading = false,
  skeleton,
  error = false,
  onRetry,
  empty,
  className,
  children,
}: {
  title: string;
  icon: IconComponent;
  tint?: WidgetTint;
  /**
   * `wash`: the card carries a flat 7% of its domain colour, so a board reads by
   * colour before it is read — orders apricot, stock saffron, team green.
   * `plain`: the porcelain card alone.
   */
  surface?: 'wash' | 'plain';
  /** The screen behind the widget, opened from a link in its header. A widget without one is there to be read. */
  href?: string;
  hrefLabel?: string;
  /** A small control or status at the header's right. */
  accessory?: ReactNode;
  loading?: boolean;
  skeleton?: ReactNode;
  error?: boolean;
  onRetry?: () => void;
  /** Nothing to show: one calm line instead of the content. */
  empty?: { icon?: IconComponent; title: string; detail?: string };
  className?: string;
  children?: ReactNode;
}) {
  const EmptyIcon = empty?.icon ?? Icon;
  const slim = isSlim(useFamily());
  return (
    <article
      style={{ '--tint': TINT_VAR[tint] } as CSSProperties}
      className={cn(
        'group/widget relative flex h-full min-h-0 flex-col overflow-hidden rounded-lg text-foreground',
        slim ? 'px-3.5 py-3' : 'p-4',
        surface === 'wash'
          ? 'bg-[color-mix(in_oklab,var(--tint)_7%,var(--card))] dark:bg-[color-mix(in_oklab,var(--tint)_11%,var(--card))]'
          : 'bg-card',
        // A hairline in the widget's own colour, then the softest lift.
        'shadow-[0_0_0_1px_color-mix(in_oklab,var(--tint)_14%,transparent),0_1px_2px_rgb(0_0_0/0.04),0_10px_24px_-14px_rgb(0_0_0/0.18)]',
        'dark:shadow-[0_0_0_1px_color-mix(in_oklab,var(--tint)_20%,transparent),0_10px_24px_-14px_rgb(0_0_0/0.6)]',
        className,
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <header className={cn('flex shrink-0 items-center gap-2', slim ? 'min-h-5' : 'min-h-6')}>
          <span
            className={cn('grid shrink-0 place-items-center rounded-sm text-on-fill', slim ? 'size-5' : 'size-6', TINT_CHIP[tint])}
            aria-hidden="true"
          >
            <Icon size={slim ? 12 : 14} strokeWidth={2.2} />
          </span>
          <h2 className="min-w-0 truncate text-[13px] leading-4 font-semibold text-heading">{title}</h2>
          {(accessory || href) && (
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {accessory}
              {href && (
                // The way into the screen behind it, as every DUMA card has; the widget itself is for reading.
                <Button asChild variant="ghost" size="icon-xs" className="text-muted-foreground hover:text-heading">
                  <Link href={href} aria-label={hrefLabel ?? `Open ${title.toLowerCase()}`}>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </div>
          )}
        </header>
        <div className={cn('flex min-h-0 flex-1 flex-col', slim ? 'pt-1.5' : 'pt-2')}>
          {loading ? (
            slim ? (
              <div role="status" aria-busy="true" aria-label={`Loading ${title.toLowerCase()}`} className="mt-auto">
                <Bone className="h-6 w-24 rounded-md" />
              </div>
            ) : (
              (skeleton ?? <WidgetSkeleton label={`Loading ${title.toLowerCase()}`} />)
            )
          ) : error && slim ? (
            // Half a square holds the failure on one line, with its retry.
            <div className="mt-auto flex min-w-0 items-center gap-2" role="alert">
              <AlertTriangle size={15} className="shrink-0 text-exception" aria-hidden="true" />
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-heading">Couldn’t load</p>
              {onRetry && (
                <Button variant="outline" size="xs" onClick={onRetry}>
                  Retry
                </Button>
              )}
            </div>
          ) : empty && slim ? (
            <p className="mt-auto flex min-w-0 items-center gap-2 text-[13px] font-medium text-heading">
              <EmptyIcon size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="truncate">{empty.title}</span>
            </p>
          ) : error ? (
            <div className="mt-auto" role="alert">
              <AlertTriangle size={18} className="text-exception" aria-hidden="true" />
              <p className="mt-1.5 text-[13px] leading-snug font-medium text-heading">Couldn’t load {title.toLowerCase()}</p>
              {onRetry && (
                <Button variant="outline" size="sm" className="mt-2" onClick={onRetry}>
                  Try again
                </Button>
              )}
            </div>
          ) : empty ? (
            <div className="mt-auto">
              <EmptyIcon size={18} className="text-muted-foreground" aria-hidden="true" />
              <p className="mt-1.5 text-[13px] leading-snug font-medium text-heading">{empty.title}</p>
              {empty.detail && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">{empty.detail}</p>}
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </article>
  );
}

/** The figure a widget is about, sized to its family the way a home-screen widget's is. */
export function WidgetFigure({ value, size, className }: { value: ReactNode; size?: Family; className?: string }) {
  const family = useFamily();
  const scale = size ?? family;
  return (
    <p
      className={cn(
        'truncate leading-none font-semibold tracking-[-0.035em] text-heading tabular-nums',
        isSlim(scale) ? 'text-[24px]' : scale === 'small' ? 'text-[28px]' : scale === 'medium' ? 'text-[32px]' : 'text-[40px]',
        className,
      )}
    >
      {value}
    </p>
  );
}

/**
 * The reading of a half-height widget: the figure with its caption beside it
 * when there is width for both, and — on a bar or banner — the widget's
 * picture to the right, as a Stocks row carries its sparkline.
 */
export function WidgetSlim({
  value,
  caption,
  visual,
  leading,
}: {
  value: ReactNode;
  caption?: ReactNode;
  visual?: ReactNode;
  leading?: ReactNode;
}) {
  const family = useFamily();
  const cell = useWidgetCell();
  // Under ~100px a compact widget has room for the figure alone; its caption goes.
  const roomForCaption = family !== 'compact' || (cell?.height ?? 120) >= 100;
  return (
    <div className="mt-auto flex min-h-0 min-w-0 flex-1 items-end gap-3">
      {leading}
      <div className="min-w-0 flex-1">
        <WidgetFigure value={value} />
        {caption && roomForCaption && <WidgetCaption className="mt-1 flex items-center text-xs">{caption}</WidgetCaption>}
      </div>
      {visual && family !== 'compact' && (
        <div className={cn('flex h-full min-h-0 shrink-0 flex-col justify-end', family === 'banner' ? 'w-[58%]' : 'w-[44%]')}>{visual}</div>
      )}
    </div>
  );
}

/** The quiet line under a figure. */
export function WidgetCaption({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('truncate text-[13px] leading-[18px] text-muted-foreground', className)}>{children}</p>;
}

/** One row of a widget's list: a mark, what it is, its figure. Each is its own link, 32px tall. */
export function WidgetRow({
  href,
  mark,
  title,
  detail,
  value,
  valueClassName,
}: {
  href: string;
  mark?: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  value?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group/row -mx-2 flex min-h-8 items-center gap-2.5 rounded-md px-2 py-1 transition-colors hover:bg-card/80 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
      >
        {mark}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-[18px] text-heading">{title}</span>
          {detail && <span className="block truncate text-[11px] leading-4 text-muted-foreground">{detail}</span>}
        </span>
        {value !== undefined && (
          <span className={cn('shrink-0 text-[13px] font-semibold text-heading tabular-nums', valueClassName)}>{value}</span>
        )}
        <ChevronRight size={13} className="shrink-0 text-muted-foreground/70" aria-hidden="true" />
      </Link>
    </li>
  );
}

/** A dot in a domain colour, the list mark of a widget row. */
export function WidgetDot({ className, label }: { className: string; label?: string }) {
  return (
    <span
      className={cn('size-2 shrink-0 rounded-full', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}

/** A thin share bar, the kind Screen Time and Battery widgets draw. */
export function WidgetBar({ value, max, className, label }: { value: number; max: number; className: string; label?: string }) {
  return (
    <span className="block h-1.5 overflow-hidden rounded-full bg-band" role={label ? 'img' : undefined} aria-label={label}>
      <span
        className={cn('block h-full rounded-full', className)}
        style={{ width: `${Math.min(100, (value / Math.max(max, 1)) * 100)}%` }}
      />
    </span>
  );
}

/** The default placeholder: a figure and a caption where they will be. */
export function WidgetSkeleton({ label, rows = 0 }: { label: string; rows?: number }) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className="mt-auto space-y-2">
      {Array.from({ length: rows }, (_, index) => (
        <Bone key={index} className="h-4 w-full rounded-md" />
      ))}
      <Bone className="h-8 w-24 rounded-md" />
      <Bone className="h-3 w-32 max-w-full rounded-md" />
    </div>
  );
}
