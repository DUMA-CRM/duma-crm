import type { ScheduledShift } from '@/lib/modules/workforce/client';
import type { Shift } from '@/lib/modules/workforce/client';

const localDay = (iso: string) => {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

/** Assign each actual work period to one rota shift, or leave it unplanned. */
export function reconcileClockEntries(planned: ScheduledShift[], actual: Shift[]) {
  const plannedIds = new Set(planned.map((shift) => shift.id));
  const byShiftId = new Map<string, Shift[]>();
  const unlinked: Shift[] = [];

  for (const entry of actual) {
    if (entry.scheduledShiftId && plannedIds.has(entry.scheduledShiftId)) {
      byShiftId.set(entry.scheduledShiftId, [...(byShiftId.get(entry.scheduledShiftId) ?? []), entry]);
    } else {
      unlinked.push(entry);
    }
  }

  const unplanned: Shift[] = [];
  for (const entry of unlinked) {
    const closest = planned
      .filter(
        (shift) =>
          shift.userId === entry.userId && shift.locationId === entry.locationId && localDay(shift.startsAt) === localDay(entry.clockedIn),
      )
      .sort(
        (a, b) =>
          Math.abs(new Date(a.startsAt).getTime() - new Date(entry.clockedIn).getTime()) -
          Math.abs(new Date(b.startsAt).getTime() - new Date(entry.clockedIn).getTime()),
      )[0];
    if (closest) byShiftId.set(closest.id, [...(byShiftId.get(closest.id) ?? []), entry]);
    else unplanned.push(entry);
  }

  for (const entries of byShiftId.values()) entries.sort((a, b) => a.clockedIn.localeCompare(b.clockedIn));
  unplanned.sort((a, b) => a.clockedIn.localeCompare(b.clockedIn));
  return { byShiftId, unplanned };
}
