/* The six tones every status mark in the app is drawn in. One map, so a "warning"
   tile, dot and pill are the same warning wherever they appear. Order and audit
   screens used to carry their own copies (`PILL_TONE` twice), which drifted. */
export type Tone = 'primary' | 'success' | 'warning' | 'exception' | 'info' | 'muted';

/** A tinted icon tile or pill background with its ink. */
export const TONE_TINT: Record<Tone, string> = {
  primary: 'bg-primary/8 text-primary',
  success: 'bg-momentum/8 text-momentum',
  warning: 'bg-measured/10 text-measured',
  exception: 'bg-exception/8 text-exception',
  info: 'bg-reference/8 text-reference',
  muted: 'bg-band text-muted-foreground',
};

/** A solid dot or bar fill. */
export const TONE_FILL: Record<Tone, string> = {
  primary: 'bg-primary',
  success: 'bg-momentum',
  warning: 'bg-measured',
  exception: 'bg-exception',
  info: 'bg-reference',
  muted: 'bg-muted-foreground/50',
};

/** Ink alone, for an icon standing in for a word. */
export const TONE_INK: Record<Tone, string> = {
  primary: 'text-primary',
  success: 'text-momentum',
  warning: 'text-measured',
  exception: 'text-exception',
  info: 'text-reference',
  muted: 'text-muted-foreground',
};
