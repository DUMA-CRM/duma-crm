import { Bone, RowSkeleton } from '@/components/shared/Skeleton';

import { cn } from '@/lib/utils/cn';

/* The rest of the skeleton kit (see Skeleton.tsx) — shapes settings, people,
   payroll and scheduling repeat:

   - `TileSkeleton` — the stand-alone bordered row (a device, a module, a
     location, a team member): `rounded-lg border px-3.5 py-3`, an icon tile,
     a title and one meta line. Unlike `RowSkeleton` it is its own card, so a
     list of them sits in `space-y-2`, not inside one framed card.
   - `SectionSkeleton` — a `SettingsSection` with its title and a few fields.
   - `FramedRows` — `ListSkeleton`'s card without the status role, for a
     skeleton that composes several pieces under one `role="status"`.

   Every block is `aria-hidden`; the caller's container names what is loading. */

const TITLE_W = ['w-40', 'w-28', 'w-48', 'w-32', 'w-36', 'w-44'];
const META_W = ['w-56', 'w-40', 'w-48', 'w-64', 'w-36', 'w-52'];

/** A bordered tile row without its words. `className` restyles the box to match the loaded row. */
export function TileSkeleton({
  index = 0,
  tile = 'size-10',
  trailing,
  className,
}: {
  index?: number;
  /** The leading tile's size (and shape) — `size-9`, `size-10`, `size-12`; `null` for a row with no tile. */
  tile?: string | null;
  /** Classes for each trailing block (a switch, a badge, amounts); omit for none. */
  trailing?: string | string[];
  className?: string;
}) {
  const ends = trailing === undefined ? [] : Array.isArray(trailing) ? trailing : [trailing];
  return (
    <div
      className={cn('flex items-center gap-3 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-3', className)}
      aria-hidden="true"
    >
      {tile !== null && <Bone className={cn('shrink-0', tile)} />}
      <span className="min-w-0 flex-1 space-y-1.5">
        <Bone className={cn('h-3.5 max-w-full', TITLE_W[index % TITLE_W.length])} />
        <Bone className={cn('h-3 max-w-full', META_W[index % META_W.length])} />
      </span>
      {ends.map((end, at) => (
        <Bone key={at} className={cn('shrink-0', end)} />
      ))}
    </div>
  );
}

/** A list of bordered tile rows loading. `className` carries the loaded list's spacing or grid. */
export function TilesSkeleton({
  count = 3,
  label = 'Loading',
  className = 'space-y-2',
  tile,
  trailing,
  tileClassName,
}: {
  count?: number;
  label?: string;
  className?: string;
  tile?: string | null;
  trailing?: string | string[];
  tileClassName?: string;
}) {
  return (
    <div role="status" aria-busy="true" aria-label={label} className={className}>
      {Array.from({ length: count }, (_, index) => (
        <TileSkeleton key={index} index={index} tile={tile} trailing={trailing} className={tileClassName} />
      ))}
    </div>
  );
}

/** `ListSkeleton`'s framed rows with no role of their own, to compose under one status. */
export function FramedRows({
  rows = 3,
  avatar = false,
  trailing = true,
  className,
}: {
  rows?: number;
  avatar?: boolean;
  trailing?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('overflow-hidden rounded-lg border border-rule/60 bg-card', className)} aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <RowSkeleton key={index} index={index} avatar={avatar} trailing={trailing} />
      ))}
    </div>
  );
}

/** A `SettingsSection` loading: the title, its reason, and `fields` labelled inputs (or `children`). */
export function SectionSkeleton({ fields = 3, className, children }: { fields?: number; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn('rounded-lg border border-rule/60 bg-field', className)} aria-hidden="true">
      <div className="space-y-2 px-5 pt-5">
        <Bone className="h-4 w-36" />
        <Bone className="h-3 w-64 max-w-full" />
      </div>
      <div className="space-y-4 px-5 pb-5 pt-4">
        {children ??
          Array.from({ length: fields }, (_, index) => (
            <div key={index} className="space-y-1.5">
              <Bone className="h-2.5 w-20" />
              <Bone className="h-10 w-full" />
            </div>
          ))}
      </div>
    </div>
  );
}
