import { KeyRound } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

/** The tile every row on the keys page opens with — the same shape as Settings → Devices. */
export function RowTile({
  icon: Icon,
  active,
  tone = 'primary',
}: {
  icon: typeof KeyRound;
  active: boolean;
  tone?: 'primary' | 'warning';
}) {
  return (
    <span
      className={cn(
        'flex size-10 shrink-0 items-center justify-center rounded-md',
        !active ? 'bg-band text-muted-foreground' : tone === 'warning' ? 'bg-measured/12 text-measured' : 'bg-primary/10 text-primary',
      )}
    >
      <Icon size={18} aria-hidden="true" />
    </span>
  );
}

export const rowClass = (muted: boolean, arrived = false) =>
  cn(
    'flex flex-wrap items-center gap-3 rounded-lg border px-3.5 py-3',
    muted ? 'border-rule/40 bg-background/30 opacity-70' : 'border-rule/50 bg-background/60',
    arrived && 'row-arrive',
  );

/** How long a create button shows its "done" tick before the secret takes over. */
export const DONE_BEAT_MS = 650;
