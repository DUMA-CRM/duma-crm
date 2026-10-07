import { Mascot } from '@/components/ai/Mascot';

import { cn } from '@/lib/utils/cn';

/* Loading, in two registers — the pair to `EmptyState` and `ErrorState`.

   1. A region whose SHAPE is known (a list, a row of tiles) gets a skeleton of
      that exact shape: `ListSkeleton` is a `ListRow` without its words,
      `FactSkeleton` a `Fact` tile. When the data lands nothing moves, it only
      fills in — a grey slab the height of a guess jumps the page.
   2. A region whose shape is NOT known yet (a drawer opening, a record page,
      a report computing) gets `LoadingState`: the mascot scanning, and one line
      saying what is being fetched. A wait is when anyone looks at the mascot
      long enough to see it; `scanning` keeps its body (UI-ADR-008).

   Every placeholder uses the one `.skeleton` shimmer from globals.css, never
   `animate-pulse` on a hand-picked grey. Placeholders are `aria-hidden`; the
   container says `aria-busy` and names what is loading, once. */

/** One placeholder block. Size it with `className` (h-/w-/size-), or `style` for a computed width. */
export function Bone({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <span className={cn('skeleton block rounded-md', className)} style={style} aria-hidden="true" />;
}

/** Varied, stable widths so a skeleton list reads as rows of text, not a barcode. */
const TITLE_W = ['w-40', 'w-28', 'w-48', 'w-32', 'w-36', 'w-44'];
const META_W = ['w-56', 'w-40', 'w-48', 'w-64', 'w-36', 'w-52'];

/** A `ListRow` without its words: tile (or avatar), title, one meta line, a trailing value. */
export function RowSkeleton({ index = 0, avatar = false, trailing = true }: { index?: number; avatar?: boolean; trailing?: boolean }) {
  return (
    <div className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0" aria-hidden="true">
      <Bone className={cn('size-9 shrink-0', avatar && 'rounded-md')} />
      <span className="min-w-0 flex-1 space-y-1.5">
        <Bone className={cn('h-3.5 max-w-full', TITLE_W[index % TITLE_W.length])} />
        <Bone className={cn('h-3 max-w-full', META_W[index % META_W.length])} />
      </span>
      {trailing && <Bone className="hidden h-4 w-16 shrink-0 sm:block" />}
    </div>
  );
}

/**
 * A list loading. `framed` draws the same card the loaded list sits in, so
 * swapping one for the other moves nothing; leave it off when the list itself
 * has no card.
 */
export function ListSkeleton({
  rows = 5,
  avatar = false,
  trailing = true,
  framed = true,
  surface = 'card',
  label = 'Loading',
  className,
}: {
  rows?: number;
  avatar?: boolean;
  trailing?: boolean;
  framed?: boolean;
  /** The frame's fill — match the loaded list: `card` (white) or `field` (the page tone). */
  surface?: 'card' | 'field';
  label?: string;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={label}
      className={cn(
        framed && 'overflow-hidden rounded-lg border border-rule/60',
        framed && (surface === 'field' ? 'bg-field' : 'bg-card'),
        className,
      )}
    >
      {Array.from({ length: rows }, (_, index) => (
        <RowSkeleton key={index} index={index} avatar={avatar} trailing={trailing} />
      ))}
    </div>
  );
}

/** A `Fact` tile loading — same box, same tile, same two lines. */
export function FactSkeleton({ surface = 'page' }: { surface?: 'panel' | 'page' | 'card' }) {
  return (
    <div
      className={cn(
        'flex items-stretch overflow-hidden rounded-lg border',
        surface === 'page' ? 'border-rule/60 bg-field' : surface === 'card' ? 'border-rule/60 bg-card' : 'border-rule/50 bg-background/60',
      )}
      aria-hidden="true"
    >
      <span className="w-12 shrink-0 border-r border-rule/40 bg-band/50" />
      <span className="min-w-0 flex-1 space-y-1.5 px-3.5 py-3">
        <Bone className="h-2.5 w-16" />
        <Bone className={cn('w-20', surface === 'page' ? 'h-5.5' : 'h-4')} />
      </span>
    </div>
  );
}

/** A row of `Fact` tiles loading, in the grid the loaded ones use. */
export function FactsSkeleton({
  count = 4,
  surface = 'page',
  label = 'Loading',
  className,
}: {
  count?: number;
  surface?: 'panel' | 'page' | 'card';
  label?: string;
  className?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={cn('grid grid-cols-2 gap-3 lg:grid-cols-4', className)}>
      {Array.from({ length: count }, (_, index) => (
        <FactSkeleton key={index} surface={surface} />
      ))}
    </div>
  );
}

/**
 * A wait whose shape isn't known yet: the mascot scanning, and what it's
 * fetching ("Loading the pay run"). Sits on the page like `EmptyState` — no
 * card of its own.
 */
export function LoadingState({ label = 'Loading', compact = false, className }: { label?: string; compact?: boolean; className?: string }) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-live="polite"
      className={cn('flex flex-col items-center justify-center px-6 text-center', compact ? 'py-8' : 'py-14', className)}
    >
      <Mascot size={compact ? 56 : 80} state="scanning" fps={24} />
      <p className={cn('text-sm text-muted-foreground', compact ? 'mt-2' : 'mt-3')}>{label}…</p>
    </div>
  );
}
