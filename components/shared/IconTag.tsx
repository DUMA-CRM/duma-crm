import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

import { Tooltip } from './Tooltip';
import { TONE_INK, TONE_TINT, type Tone } from './tone';

/* An icon standing in for a word — "Card", "Verified", "Paid". The word is
   never lost: it is the tooltip on hover, and the accessible name.
   Only for a word a column header or its neighbours already frame; a primary
   action keeps its text (see UI-ADR-019).

   Not a tab stop: it usually sits inside a clickable row, where a stop per icon
   would make the row a slalom. The accessible name carries the word. */
export function IconTag({
  icon: Icon,
  label,
  tone = 'muted',
  tile = false,
  size = 14,
  className,
}: {
  icon: IconComponent;
  label: string;
  tone?: Tone;
  /** In a tinted square, for when it sits alone rather than inside a line of text. */
  tile?: boolean;
  size?: number;
  className?: string;
}) {
  return (
    <Tooltip label={label} side="top" className={className}>
      <span
        role="img"
        aria-label={label}
        className={cn('inline-flex shrink-0 items-center justify-center rounded-sm', tile ? cn('size-6', TONE_TINT[tone]) : TONE_INK[tone])}
      >
        <Icon size={size} aria-hidden="true" />
      </span>
    </Tooltip>
  );
}
