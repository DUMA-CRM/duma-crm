import type { DayState } from './trading-day.ts';

/* The day told the way a person would tell it: a greeting, one line on how
   it's going, the small wins worth a smile, and the mascot's face to match.
   Every sentence here is a claim about the shop's takings, so each one is
   only made when the figures behind it can carry it — a "best Tuesday" needs
   Tuesdays to beat, a streak needs a target. */

export function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** "Tuesday" → "Tuesdays". Weekday names all take an s. */
const plural = (weekday: string, count: number) => (count === 1 ? weekday : `${weekday}s`);

/** What a comparison waits for while there is too little history: "Compares after 2 more Tuesdays". */
export function comparisonWait(sampleCount: number, needed: number, weekday: string): string {
  const more = Math.max(1, needed - sampleCount);
  return `Compares after ${more} more ${plural(weekday, more)}`;
}

/** A day's takings, oldest or newest first; `date` is YYYY-MM-DD. */
export interface DayTakings {
  date: string;
  revenue: number;
}

const DAY_MS = 86_400_000;
const dayIndex = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / DAY_MS);
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const weekdayOf = (date: string) => WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()];

/** Fewer days than this to beat and "best" means nothing. */
export const MIN_DAYS_TO_BEAT = 3;
/** "Best day" looks back this far — far enough to mean something, near enough to be about now. */
const BEST_DAY_SPAN = 28;
const SPAN_WORDS: Record<number, string> = { 2: 'two', 3: 'three', 4: 'four', 5: 'five', 6: 'six', 7: 'seven', 8: 'eight' };

export interface DayWin {
  id: 'best-day' | 'best-weekday' | 'target-streak';
  emoji: string;
  text: string;
}

/**
 * The day's small wins, strongest first and at most two. Closed days leave
 * no row, so they neither count towards a streak nor break one.
 */
export function dayWins({
  today,
  state,
  takenToday,
  history,
  target,
  weekday,
}: {
  /** Today's local date, YYYY-MM-DD. */
  today: string;
  state: DayState;
  takenToday: number;
  /** Earlier days' takings; today's row, if present, is ignored. */
  history: DayTakings[];
  target: number | null;
  /** Today's weekday, written out: "Tuesday". */
  weekday: string;
}): DayWin[] {
  const todayIndex = dayIndex(today);
  const traded = history.filter((day) => day.revenue > 0 && dayIndex(day.date) < todayIndex).sort((a, b) => b.date.localeCompare(a.date));
  const underway = state !== 'before-open' && state !== 'closed-today' && takenToday > 0;
  const wins: DayWin[] = [];

  const recent = traded.filter((day) => todayIndex - dayIndex(day.date) <= BEST_DAY_SPAN);
  const bestDay = underway && recent.length >= MIN_DAYS_TO_BEAT && takenToday > Math.max(...recent.map((day) => day.revenue));
  if (bestDay) wins.push({ id: 'best-day', emoji: '🏆', text: 'Best day in four weeks' });

  const sameDay = traded.filter((day) => weekdayOf(day.date) === weekdayOf(today));
  if (!bestDay && underway && sameDay.length >= MIN_DAYS_TO_BEAT && takenToday > Math.max(...sameDay.map((day) => day.revenue))) {
    const weeks = Math.round((todayIndex - dayIndex(sameDay[sameDay.length - 1]!.date)) / 7);
    wins.push({ id: 'best-weekday', emoji: '⭐', text: `Best ${weekday} in ${SPAN_WORDS[weeks] ?? weeks} weeks` });
  }

  if (target && target > 0) {
    let run = 0;
    for (const day of traded) {
      if (day.revenue < target) break;
      run += 1;
    }
    const hitToday = takenToday >= target;
    // A run is still alive until today closes short of the target.
    const broken = !hitToday && state === 'after-close' && takenToday > 0;
    const days = run + (hitToday ? 1 : 0);
    if (!broken && days >= 2) {
      wins.push({
        id: 'target-streak',
        emoji: '🔥',
        text: hitToday ? `${days} days in a row over target` : `${days} days in a row over target, keep it going`,
      });
    }
  }

  return wins.slice(0, 2);
}

/** Above or below a typical day by this share, the day earns a word: busy or quiet. */
const BUSY = 1.15;
const QUIET = 0.7;

export interface DaySummaryInput {
  firstName: string | null;
  state: DayState;
  /** Local minutes since midnight. */
  nowMinutes: number;
  weekday: string;
  opensAt: string | null;
  takenToday: number;
  orders: number;
  /** Today minus a typical day by now; null when there is no honest typical. */
  paceDelta: number | null;
  /** A typical whole day; null without enough history. */
  typicalDay: number | null;
  target: number | null;
  topItem: string | null;
  yesterday: number | null;
  money: (amount: number) => string;
}

/** "Good evening, Marian" over "A quiet £28 day from 3 orders. Cappuccino sold best." */
export function daySummary(input: DaySummaryInput): { greeting: string; line: string } {
  const { state, takenToday, orders, weekday, money, target, topItem } = input;
  const hello = `${greeting(Math.floor(input.nowMinutes / 60))}${input.firstName ? `, ${input.firstName}` : ''}`;
  const orderWord = orders === 1 ? '1 order' : `${orders} orders`;
  const hitTarget = target !== null && target > 0 && takenToday >= target;

  const sentences: string[] = [];
  if (state === 'closed-today') {
    sentences.push(input.yesterday ? `Closed today. Yesterday took ${money(input.yesterday)}.` : 'Closed today. Enjoy the quiet.');
  } else if (state === 'before-open') {
    sentences.push(input.opensAt ? `Doors open at ${input.opensAt}.` : 'Not open yet.');
    if (target) sentences.push(`Today’s aim is ${money(target)}.`);
    else if (input.typicalDay) sentences.push(`A typical ${weekday} takes ${money(input.typicalDay)}.`);
  } else if (orders === 0) {
    sentences.push(state === 'after-close' ? 'No orders today.' : 'No orders yet today.');
  } else if (state === 'after-close') {
    const share = input.typicalDay ? takenToday / input.typicalDay : null;
    const mood = share === null ? '' : share >= BUSY ? 'busy ' : share < QUIET ? 'quiet ' : '';
    sentences.push(`A ${mood}${money(takenToday)} day from ${orderWord}.`);
    if (hitTarget) sentences.push('Target hit 🎉');
    if (topItem) sentences.push(`${topItem} sold best.`);
  } else {
    let pace = '.';
    if (hitTarget) pace = ', and the target’s already hit 🎉';
    else if (input.paceDelta !== null && Math.round(input.paceDelta) !== 0)
      pace = `, ${money(Math.abs(input.paceDelta))} ${input.paceDelta > 0 ? 'ahead of' : 'behind'} a typical ${weekday}.`;
    sentences.push(`${money(takenToday)} from ${orderWord} so far${pace}`);
    if (topItem) sentences.push(`${topItem} is leading.`);
  }
  return { greeting: hello, line: sentences.join(' ') };
}

export type DayMood = 'sleepy' | 'ready' | 'proud' | 'curious' | 'steady';

/** The mascot's face for the day: proud on a win, curious when it's slow, asleep after close — never sad about sales. */
export function dayMood({
  state,
  takenToday,
  target,
  paceDelta,
  typicalByNow,
  wins,
}: {
  state: DayState;
  takenToday: number;
  target: number | null;
  paceDelta: number | null;
  typicalByNow: number | null;
  wins: DayWin[];
}): DayMood {
  if (state === 'closed-today') return 'sleepy';
  if ((target && takenToday >= target) || wins.some((win) => win.id !== 'target-streak')) return 'proud';
  if (state === 'after-close') return 'sleepy';
  if (state === 'before-open') return 'ready';
  if (paceDelta !== null && typicalByNow && typicalByNow > 0) {
    if (paceDelta / typicalByNow >= 0.1) return 'proud';
    if (paceDelta / typicalByNow <= -0.15) return 'curious';
  }
  return 'steady';
}
