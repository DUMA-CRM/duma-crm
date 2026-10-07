import { cn } from '@/lib/utils/cn';

import { GravatarImage } from './GravatarImage';
import { TONE_FILL, type Tone } from './tone';

const DIM = {
  xs: { box: 'size-6 text-[10px]', px: 48 },
  sm: { box: 'size-8 text-xs', px: 64 },
  md: { box: 'size-9 text-xs', px: 72 },
  lg: { box: 'size-12 text-sm', px: 96 },
} as const;

export type AvatarSize = keyof typeof DIM;

export function initialsOf(name?: string | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : parts[0].slice(0, 2);
}

/* One person picture for the whole app: their Gravatar when they have one,
   else flat initials on the primary tint. `status` pins a small dot to the
   corner — an email that failed, someone on shift — so a row can show the
   person and their state in one mark instead of a generic glyph.

   Flat, like every other icon tile; the old `InitialsAvatar` gradient is the
   odd one out and is being retired. */
export function Avatar({
  name,
  email,
  size = 'md',
  status,
  statusLabel,
  className,
}: {
  name?: string | null;
  email?: string | null;
  size?: AvatarSize;
  status?: Tone;
  statusLabel?: string;
  className?: string;
}) {
  const { box, px } = DIM[size];
  const fallback = (
    <span
      className={cn(
        box,
        'flex shrink-0 items-center justify-center rounded-md bg-primary/10 font-semibold text-primary uppercase select-none',
      )}
    >
      {initialsOf(name)}
    </span>
  );
  const face = email ? (
    <GravatarImage
      email={email}
      px={px}
      className={cn(box, 'shrink-0 rounded-md object-cover select-none')}
      alt={name ?? ''}
      fallback={fallback}
    />
  ) : (
    fallback
  );

  if (!status) return <span className={cn('inline-flex shrink-0', className)}>{face}</span>;
  return (
    <span className={cn('relative inline-flex shrink-0', className)}>
      {face}
      <span
        className={cn('absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-card', TONE_FILL[status])}
        title={statusLabel}
        aria-hidden="true"
      />
      {statusLabel && <span className="sr-only">{statusLabel}</span>}
    </span>
  );
}
