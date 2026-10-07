// ---------------------------------------------------------------------------
// Durations and bounded numbers for the wheel pickers (components/ui/*-picker).
// Pure, so the rule every wheel keeps — never hide a stored value — is tested.
// ---------------------------------------------------------------------------

/**
 * `min..max` every `step`, plus `current` when it falls between steps or
 * outside the range: a stored 7 on a 5-minute wheel must still show as 7.
 */
export function rangeValues(min: number, max: number, step = 1, current?: number): number[] {
  const safeStep = step > 0 && Number.isFinite(step) ? step : 1;
  const values: number[] = [];
  for (let value = min; value <= max && values.length < 1000; value += safeStep) values.push(Math.round(value * 1000) / 1000);
  if (current !== undefined && Number.isFinite(current) && !values.includes(current)) values.push(current);
  return values.sort((a, b) => a - b);
}

/** 90 → `{ hours: 1, minutes: 30 }`. */
export const splitDuration = (totalMinutes: number) => {
  const safe = Math.max(0, Math.round(totalMinutes || 0));
  return { hours: Math.floor(safe / 60), minutes: safe % 60 };
};

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/** 0 → "0 min", 45 → "45 min", 60 → "1 h", 90 → "1 h 30 min". */
export function formatDuration(totalMinutes: number): string {
  const { hours, minutes } = splitDuration(totalMinutes);
  if (hours === 0) return `${minutes} min`;
  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

/** The hour wheel for a duration bounded by `min`/`max` minutes. */
export const durationHours = (min: number, max: number) => rangeValues(Math.floor(min / 60), Math.floor(max / 60));

/**
 * The minute wheel for one hour of a bounded duration: only minutes that keep
 * the total inside `min..max`, plus the stored minute so it is never hidden.
 */
export function durationMinutes(hour: number, step: number, min: number, max: number, current?: number): number[] {
  const values = rangeValues(0, 59, step).filter((minute) => {
    const total = hour * 60 + minute;
    return total >= min && total <= max;
  });
  if (current !== undefined && !values.includes(current)) values.push(current);
  if (values.length === 0) values.push(0);
  return values.sort((a, b) => a - b);
}

/** Total minutes from wheel positions, kept inside the bounds. */
export const joinDuration = (hours: number, minutes: number, min: number, max: number) => clamp(hours * 60 + minutes, min, max);

export type DelayUnit = 'minutes' | 'hours' | 'days';

/** What each Wait unit's wheel offers. The API accepts 1–3650 of any unit. */
export const DELAY_RANGES: Record<DelayUnit, { max: number; singular: string; plural: string }> = {
  minutes: { max: 120, singular: 'minute', plural: 'minutes' },
  hours: { max: 72, singular: 'hour', plural: 'hours' },
  days: { max: 365, singular: 'day', plural: 'days' },
};

export const delayAmounts = (unit: DelayUnit, current?: number) => rangeValues(1, DELAY_RANGES[unit].max, 1, current);

export const formatDelay = (amount: number, unit: DelayUnit) => `${amount} ${amount === 1 ? DELAY_RANGES[unit].singular : DELAY_RANGES[unit].plural}`;
