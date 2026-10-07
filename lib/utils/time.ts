// ---------------------------------------------------------------------------
// Times of day, as the app stores them: a 24-hour `HH:MM` string. The shared
// TimePicker (components/ui/time-picker.tsx) spins wheels over these values;
// everything it needs to agree with the stored string is here, pure.
// ---------------------------------------------------------------------------

export type TimeFormat = '24h' | '12h';
export type Meridiem = 'AM' | 'PM';

const pad = (value: number) => String(value).padStart(2, '0');

/** `"09:41"` → `{ hour: 9, minute: 41 }`; anything else is null. Seconds are ignored. */
export function parseTime(value: string | null | undefined): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec((value ?? '').trim());
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute };
}

export const formatTime = (hour: number, minute: number) => `${pad(hour)}:${pad(minute)}`;

/** 24-hour hour → the 12-hour clock face: 0 → 12 AM, 13 → 1 PM. */
export function to12Hour(hour: number): { hour: number; meridiem: Meridiem } {
  return { hour: hour % 12 === 0 ? 12 : hour % 12, meridiem: hour < 12 ? 'AM' : 'PM' };
}

/** 12-hour clock face → 24-hour hour: 12 AM → 0, 12 PM → 12. */
export function from12Hour(hour: number, meridiem: Meridiem): number {
  const base = hour % 12;
  return meridiem === 'PM' ? base + 12 : base;
}

/** How the trigger shows a value: `09:41`, or `9:41 AM` on a 12-hour picker. */
export function displayTime(value: string | null | undefined, format: TimeFormat = '24h'): string {
  const parsed = parseTime(value);
  if (!parsed) return '';
  if (format === '24h') return formatTime(parsed.hour, parsed.minute);
  const { hour, meridiem } = to12Hour(parsed.hour);
  return `${hour}:${pad(parsed.minute)} ${meridiem}`;
}

/**
 * The minutes a wheel offers: every `step` minutes, plus the current minute if
 * it falls between steps — a stored 09:07 must still show as 09:07, not snap.
 */
export function minuteValues(step: number, current?: number): number[] {
  const safeStep = Number.isInteger(step) && step >= 1 && step <= 30 ? step : 1;
  const values = Array.from({ length: Math.ceil(60 / safeStep) }, (_, index) => index * safeStep);
  if (current !== undefined && current >= 0 && current <= 59 && !values.includes(current)) values.push(current);
  return values.sort((a, b) => a - b);
}

export const hourValues = (format: TimeFormat): number[] =>
  format === '24h' ? Array.from({ length: 24 }, (_, index) => index) : Array.from({ length: 12 }, (_, index) => index + 1);

export const twoDigits = pad;
