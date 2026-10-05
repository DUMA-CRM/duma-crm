/**
 * Shift records grouped under their day, with the day's totals — the rota
 * read the way a manager reads it: one day at a time, earliest shift first.
 */

export interface DayGroupable {
  dateKey: string;
  at: string;
  plannedMinutes: number;
  workedMinutes: number;
  estimatedCost: number | null;
}

export interface ShiftDay<T> {
  dateKey: string;
  records: T[];
  plannedMinutes: number;
  workedMinutes: number;
  cost: number;
}

/**
 * @param order 'asc' walks the range forwards (a week ahead); 'desc' puts the
 *   latest day first (looking back over what was worked).
 */
export function groupShiftsByDay<T extends DayGroupable>(records: readonly T[], order: 'asc' | 'desc' = 'asc'): ShiftDay<T>[] {
  const days = new Map<string, ShiftDay<T>>();
  for (const record of records) {
    const day = days.get(record.dateKey) ?? { dateKey: record.dateKey, records: [], plannedMinutes: 0, workedMinutes: 0, cost: 0 };
    day.records.push(record);
    day.plannedMinutes += record.plannedMinutes;
    day.workedMinutes += record.workedMinutes;
    day.cost += record.estimatedCost ?? 0;
    days.set(record.dateKey, day);
  }
  const sorted = [...days.values()].sort((a, b) => (order === 'asc' ? a.dateKey.localeCompare(b.dateKey) : b.dateKey.localeCompare(a.dateKey)));
  for (const day of sorted) day.records.sort((a, b) => a.at.localeCompare(b.at));
  return sorted;
}
