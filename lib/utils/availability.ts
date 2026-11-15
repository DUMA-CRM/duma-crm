// ---------------------------------------------------------------------------
// Weekly availability: the rules the API stores (`staff_availability`) and the
// one-row-per-weekday form people edit them in. A day is Available, Unavailable
// all day, or Unavailable between two times; it may also carry "prefer to
// work" and a short note.
//
// The API allows more than the form shows — several windows on one day, or a
// preferred window rather than a whole day. Whatever the form can't show is
// kept in `extra` and written back untouched, so opening and saving the form
// never quietly drops a rule someone else set.
//
// Weekdays are 0 = Monday … 6 = Sunday; minutes count from local midnight.
// ---------------------------------------------------------------------------
import type { AvailabilityRule } from '../api/rota.service';

export type DayMode = 'available' | 'unavailable_all_day' | 'unavailable_between';

export interface AvailabilityDay {
  weekday: number;
  mode: DayMode;
  /** `HH:MM`, used when `mode` is `unavailable_between`. */
  from: string;
  /** `HH:MM`; `00:00` means midnight at the end of the day. */
  to: string;
  preferred: boolean;
  note: string;
  /** Rules for this day the form can't show, written back as they were. */
  extra: AvailabilityRule[];
}

export const WEEKDAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const WEEKDAY_SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;
export const NOTE_MAX = 200;

const DEFAULT_FROM = '09:00';
const DEFAULT_TO = '17:00';
const DAY_MINUTES = 24 * 60;

export function minutesToClock(minutes: number): string {
  const m = ((minutes % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** `HH:MM` to minutes; `asEnd` reads `00:00` as the end of the day (1440). */
export function clockToMinutes(clock: string, asEnd = false): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(clock.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  const total = hours * 60 + minutes;
  return asEnd && total === 0 ? DAY_MINUTES : total;
}

export const emptyDay = (weekday: number): AvailabilityDay => ({
  weekday,
  mode: 'available',
  from: DEFAULT_FROM,
  to: DEFAULT_TO,
  preferred: false,
  note: '',
  extra: [],
});

const isAllDay = (rule: AvailabilityRule) => rule.startMinute == null || rule.endMinute == null;

/** Seven days, Monday first, from whatever rules the API holds. */
export function rulesToDays(rules: readonly AvailabilityRule[]): AvailabilityDay[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const day = emptyDay(weekday);
    const mine = rules.filter((rule) => rule.weekday === weekday);
    const unavailable = mine.filter((rule) => rule.kind === 'unavailable');
    const preferred = mine.filter((rule) => rule.kind === 'preferred');

    // All day wins over any window; a day with several windows shows the first.
    const allDay = unavailable.find(isAllDay);
    const windows = unavailable.filter((rule) => !isAllDay(rule)).sort((a, b) => (a.startMinute ?? 0) - (b.startMinute ?? 0));
    const shown = allDay ?? windows[0];
    if (allDay) day.mode = 'unavailable_all_day';
    else if (shown) {
      day.mode = 'unavailable_between';
      day.from = minutesToClock(shown.startMinute ?? 0);
      day.to = minutesToClock(shown.endMinute ?? DAY_MINUTES);
    }

    // A whole-day preference is the marker; a narrower one rides along in `extra`.
    const wholeDayPreference = preferred.find(isAllDay);
    day.preferred = Boolean(wholeDayPreference) && day.mode !== 'unavailable_all_day';

    day.note = shown?.note ?? wholeDayPreference?.note ?? '';
    day.extra = mine.filter((rule) => rule !== shown && !(day.preferred && rule === wholeDayPreference));
    return day;
  });
}

/** Why a day can't be saved, or null. */
export function dayProblem(day: AvailabilityDay): string | null {
  if (day.note.length > NOTE_MAX) return `Keep the note under ${NOTE_MAX} characters`;
  if (day.mode !== 'unavailable_between') return null;
  const from = clockToMinutes(day.from);
  const to = clockToMinutes(day.to, true);
  if (from == null || to == null) return 'Pick both times';
  if (to <= from) return 'The end must be after the start';
  return null;
}

/** The rules to PUT for these days. Throws when a day has a problem. */
export function daysToRules(days: readonly AvailabilityDay[]): AvailabilityRule[] {
  const rules: AvailabilityRule[] = [];
  for (const day of days) {
    const problem = dayProblem(day);
    if (problem) throw new Error(`${WEEKDAY_NAMES[day.weekday] ?? 'A day'}: ${problem}`);
    const note = day.note.trim() || null;
    let noteUsed = false;

    if (day.mode === 'unavailable_all_day') {
      rules.push({ weekday: day.weekday, startMinute: null, endMinute: null, kind: 'unavailable', note });
      noteUsed = true;
    } else if (day.mode === 'unavailable_between') {
      rules.push({
        weekday: day.weekday,
        startMinute: clockToMinutes(day.from),
        endMinute: clockToMinutes(day.to, true),
        kind: 'unavailable',
        note,
      });
      noteUsed = true;
    }
    if (day.preferred && day.mode !== 'unavailable_all_day')
      rules.push({ weekday: day.weekday, startMinute: null, endMinute: null, kind: 'preferred', note: noteUsed ? null : note });

    // An all-day "unavailable" makes every other rule on the day moot.
    if (day.mode !== 'unavailable_all_day') rules.push(...day.extra.filter((rule) => !isAllDay(rule)));
  }
  return rules;
}

/** One short line for the read-only row — "Not Tue · Wed until 14:00 · prefers Sat". */
export function availabilitySummary(days: readonly AvailabilityDay[]): string {
  const parts: string[] = [];
  const off = days.filter((day) => day.mode === 'unavailable_all_day').map((day) => WEEKDAY_SHORT[day.weekday]);
  if (off.length) parts.push(`Not ${off.join(', ')}`);
  for (const day of days)
    if (day.mode === 'unavailable_between') {
      const from = clockToMinutes(day.from) ?? 0;
      const to = clockToMinutes(day.to, true) ?? DAY_MINUTES;
      const name = WEEKDAY_SHORT[day.weekday];
      // Said as when they *can* work, which is what a manager is looking for.
      if (from === 0) parts.push(`${name} from ${day.to}`);
      else if (to === DAY_MINUTES) parts.push(`${name} until ${day.from}`);
      else parts.push(`${name} not ${day.from}–${day.to}`);
    }
  const preferred = days.filter((day) => day.preferred).map((day) => WEEKDAY_SHORT[day.weekday]);
  if (preferred.length) parts.push(`prefers ${preferred.join(', ')}`);
  return parts.length ? parts.join(' · ') : 'Available any day';
}
