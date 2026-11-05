import { zonedParts } from './workspace-time.ts';

/** Return every instant for a local minute. DST gaps return none, folds two;
 * the composer must let the user explicitly choose the offset in a fold. */
export function scheduleCandidates(value: string, zone: string): string[] {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return [];
  const wall = Date.parse(value + ':00Z');
  if (!Number.isFinite(wall)) return [];
  const offsets = new Set<number>();
  for (let h = -36; h <= 36; h += 3) {
    const at = wall + h * 3600_000,
      p = zonedParts(at, zone);
    offsets.add(Date.parse(`${p.date}T${p.time}:00Z`) - at);
  }
  return [...offsets]
    .map((offset) => wall - offset)
    .filter((at) => {
      const p = zonedParts(at, zone);
      return `${p.date}T${p.time}` === value;
    })
    .sort((a, b) => a - b)
    .map((at) => new Date(at).toISOString());
}
export const moveDay = (day: string, count: number) =>
  new Date(Date.parse(day + 'T12:00:00Z') + count * 86400_000).toISOString().slice(0, 10);
export function calendarDays(anchor: string, view: 'month' | 'week' | 'agenda'): string[] {
  const first = view === 'month' ? anchor.slice(0, 7) + '-01' : anchor;
  const dow = new Date(first + 'T12:00:00Z').getUTCDay();
  const start = moveDay(first, -((dow + 6) % 7));
  return Array.from({ length: view === 'month' ? 42 : 7 }, (_, i) => moveDay(start, i));
}
