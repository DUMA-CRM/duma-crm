import { scheduleCandidates } from './marketing-time.ts';

/** The parts of a destination draft that decide whether it can be scheduled. */
export interface ComposeTarget {
  format: string;
  /** The wall-clock time typed, `YYYY-MM-DDTHH:mm`, or empty. */
  local: string;
  /** The instant picked when that time happens twice (a DST fold). */
  choice: string;
  timeZone: string;
  mediaCount: number;
  options: Record<string, unknown>;
}

/**
 * What a destination still needs before it can be scheduled, in words, so the
 * composer can show it on the destination's tab instead of after a failed save.
 * Guidance only — the save itself still decides.
 */
export function destinationGaps(t: ComposeTarget, provider: string, connected: boolean): string[] {
  const gaps: string[] = [];
  if (!connected) gaps.push('Reconnect the account');
  if (!t.local) gaps.push('Choose a publish time');
  else {
    const candidates = scheduleCandidates(t.local, t.timeZone);
    if (!candidates.length) gaps.push('Pick a time that exists');
    else if (candidates.length > 1 && !candidates.includes(t.choice)) gaps.push('Choose which of the repeated times');
  }
  if (t.format !== 'text' && t.mediaCount === 0) gaps.push('Add media');
  if (provider === 'youtube') {
    if (!t.options.privacy) gaps.push('Choose who can see it');
    if (t.options.madeForKids === undefined) gaps.push('Say whether it’s made for kids');
  }
  if (provider === 'tiktok') {
    if (!t.options.privacy) gaps.push('Choose who can see it');
    if (t.options.consent !== true) gaps.push('Give TikTok’s consent');
  }
  return gaps;
}
