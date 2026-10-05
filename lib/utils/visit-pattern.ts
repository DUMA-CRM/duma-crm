/**
 * The arithmetic behind a guest's visit pattern: the heatmap's grid and the
 * few facts read off it. Dates are `YYYY-MM-DD` and handled in UTC throughout,
 * so a visit late in the evening never slides into the next day's square.
 */

export interface Visit {
  /** `YYYY-MM-DD`; anything after the tenth character is ignored. */
  date: string;
  spend: number;
}

export interface VisitCell {
  date: string;
  /** Total spent that day, when they came in. */
  spend?: number;
  future: boolean;
}

export interface VisitWeeks {
  /** Monday-first columns, oldest first. */
  weeks: VisitCell[][];
  /** The week index each month's label sits over. */
  monthLabels: { label: string; week: number }[];
}

export interface VisitSummary {
  /** Distinct days with a visit inside the window. */
  visitDays: number;
  spend: number;
  /** 0 = Monday. Only when one weekday clearly leads — at least two visits, and no tie. */
  busiestWeekday: number | null;
  /** Mean days between visits, rounded; null with fewer than two visit days. */
  averageGapDays: number | null;
}

const DAY = 86_400_000;

const parse = (date: string) => Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
/** 0 = Monday … 6 = Sunday. */
const weekday = (time: number) => (new Date(time).getUTCDay() + 6) % 7;

function windowStart(today: string, months: number): number {
  const start = new Date(parse(today));
  start.setUTCMonth(start.getUTCMonth() - months);
  return start.getTime();
}

/** Spend per day, summed — two orders on one day are one visit. */
function spendByDay(visits: Visit[]): Map<string, number> {
  const byDay = new Map<string, number>();
  for (const visit of visits) {
    const key = visit.date.slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + (Number.isFinite(visit.spend) ? visit.spend : 0));
  }
  return byDay;
}

export function buildVisitWeeks(visits: Visit[], today: string, months: number): VisitWeeks {
  const byDay = spendByDay(visits);
  const end = parse(today);
  const start = windowStart(today, months);
  let cursor = start - weekday(start) * DAY;

  const weeks: VisitCell[][] = [];
  const monthLabels: VisitWeeks['monthLabels'] = [];
  let lastMonth = -1;

  while (cursor <= end) {
    const week: VisitCell[] = [];
    for (let day = 0; day < 7; day++) {
      const date = iso(cursor);
      week.push({ date, spend: byDay.get(date), future: cursor > end });
      cursor += DAY;
    }
    const month = new Date(parse(week[0].date)).getUTCMonth();
    if (month !== lastMonth) {
      lastMonth = month;
      monthLabels.push({
        label: new Date(parse(week[0].date)).toLocaleDateString('en-GB', { month: 'short', timeZone: 'UTC' }),
        week: weeks.length,
      });
    }
    weeks.push(week);
  }

  return { weeks, monthLabels };
}

export function summariseVisits(visits: Visit[], today: string, months: number): VisitSummary {
  const start = windowStart(today, months);
  const end = parse(today);
  const days = [...spendByDay(visits)]
    .map(([date, spend]) => ({ time: parse(date), spend }))
    .filter(({ time }) => time >= start && time <= end)
    .sort((a, b) => a.time - b.time);

  const counts = Array.from({ length: 7 }, () => 0);
  for (const { time } of days) counts[weekday(time)] += 1;
  const most = Math.max(...counts);
  const leaders = counts.filter((count) => count === most).length;

  const gaps = days.slice(1).map(({ time }, index) => (time - days[index].time) / DAY);

  return {
    visitDays: days.length,
    spend: days.reduce((total, { spend }) => total + spend, 0),
    busiestWeekday: most >= 2 && leaders === 1 ? counts.indexOf(most) : null,
    averageGapDays: gaps.length > 0 ? Math.round(gaps.reduce((total, gap) => total + gap, 0) / gaps.length) : null,
  };
}
