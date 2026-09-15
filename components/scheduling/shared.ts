import type { ScheduledShift, ScheduledShiftStatus, VarianceRow } from '@/lib/api/scheduling.service';
import type { Shift } from '@/lib/api/shifts.service';
import type { StaffProfile } from '@/lib/api/staff.service';
import { formatDate } from '@/lib/utils/date';

// ── Form styles ───────────────────────────────────────────────────────────────

export const inp =
  'w-full h-9 bg-field border border-input rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
export const sel = inp + ' cursor-pointer';
export const lbl = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

// ── Status config ─────────────────────────────────────────────────────────────

export const STATUSES: ScheduledShiftStatus[] = ['draft', 'published', 'cancelled'];

export const STATUS_VARIANT: Record<ScheduledShiftStatus, 'muted' | 'success' | 'destructive'> = {
  draft: 'muted',
  published: 'success',
  cancelled: 'destructive',
};

/**
 * What actually happened on the day, in one label. `scheduled` is the resting
 * state for a shift whose start is still ahead of us — the variance feed only
 * reports a shift once its window has opened.
 */
export type WorkState = 'scheduled' | 'running' | 'completed' | 'no_show' | 'cancelled';

export const WORK_STATE: Record<WorkState, { label: string; variant: 'muted' | 'primary' | 'success' | 'destructive' }> = {
  scheduled: { label: 'Scheduled', variant: 'muted' },
  running: { label: 'Running', variant: 'primary' },
  completed: { label: 'Completed', variant: 'success' },
  no_show: { label: 'No show', variant: 'destructive' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
};

export type BillState = 'pending' | 'paid' | 'none';

// ── Date + duration helpers ───────────────────────────────────────────────────

export function mondayOf(d: Date): Date {
  const diff = (d.getDay() + 6) % 7;
  const monday = new Date(d);
  monday.setDate(d.getDate() - diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function toDateInput(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function toTimeInput(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
export const fmtDate = (iso: string) => formatDate(iso);
export const fmtDayHeading = (iso: string) => `${new Date(iso).toLocaleDateString('en-GB', { weekday: 'long' })}, ${formatDate(iso)}`;

/**
 * "4 – 10 Aug 2026", collapsing the parts both ends share; a single day is just
 * "4 Aug 2026". Takes YYYY-MM-DD, the form the date inputs speak.
 */
export function rangeLabel(from: string, to: string): string {
  const a = new Date(`${from}T00:00:00`);
  const b = new Date(`${to}T00:00:00`);
  if (Number.isNaN(+a) || Number.isNaN(+b)) return `${from} – ${to}`;
  if (from === to) return formatDate(a);
  return `${formatDate(a)} – ${formatDate(b)}`;
}

/** Whole days covered by an inclusive range — the step size for its arrows. */
export function rangeDays(from: string, to: string): number {
  const days = Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000) + 1;
  return Number.isFinite(days) && days > 0 ? days : 7;
}

/** "6 hrs. 30 min." — the reference reads duration in words, not as a clock. */
export function fmtDuration(mins: number): string {
  const total = Math.max(0, Math.round(mins));
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h === 0) return `${m} min.`;
  if (m === 0) return `${h} ${h === 1 ? 'hr' : 'hrs'}.`;
  return `${h} ${h === 1 ? 'hr' : 'hrs'}. ${m} min.`;
}

export const fmtHours = (mins: number) => {
  const h = mins / 60;
  return Number.isInteger(h) ? `${h}h` : `${h.toFixed(1)}h`;
};

export const shiftMinutes = (s: { startsAt: string; endsAt: string }) =>
  Math.max(0, (new Date(s.endsAt).getTime() - new Date(s.startsAt).getTime()) / 60000);

/** Combine a date + start/end times into ISO timestamps; an end at or before the start rolls to the next day (overnight shift). */
export function toShiftTimes(dateStr: string, startTime: string, endTime: string): { startsAt: string; endsAt: string } {
  const starts = new Date(`${dateStr}T${startTime}`);
  const ends = new Date(`${dateStr}T${endTime}`);
  if (ends <= starts) ends.setDate(ends.getDate() + 1);
  return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
}

// Mon-first weekday toggles (JS getDay(): 0 = Sunday).
export const WEEKDAYS = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
];

/**
 * Expand a shift into repeat occurrences. Week 0 is the week of the anchor
 * date; occurrences before the anchor date itself are skipped so repeating
 * "Mon + Fri" starting on a Wednesday doesn't backfill that week's Monday.
 */
export function buildOccurrences(dateStr: string, startTime: string, endTime: string, repeatDays: number[], weeks: number) {
  const anchor = new Date(`${dateStr}T00:00:00`);
  const monday = mondayOf(anchor);
  const out: { startsAt: string; endsAt: string }[] = [];
  for (let w = 0; w < weeks; w++) {
    for (const wd of repeatDays) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + ((wd + 6) % 7) + w * 7);
      if (day < anchor) continue;
      out.push(toShiftTimes(toDateInput(day), startTime, endTime));
    }
  }
  return out.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

// ── Rows ──────────────────────────────────────────────────────────────────────

/**
 * One row of the shift register: the planned shift, what was actually clocked,
 * and what it costs. Rows without a `shift` are unplanned attendance — someone
 * clocked in with no rota entry — so they can still be seen and rota'd.
 */
export interface ShiftRecord {
  id: string;
  /** Local day key (YYYY-MM-DD) the record belongs to. */
  dateKey: string;
  /** Sort/display anchor: the planned start, else the clock-in. */
  at: string;
  userId: string | null;
  staffName: string;
  staffEmail?: string;
  locationId: string;
  locationName?: string;
  role?: string;
  notes?: string;
  status: ScheduledShiftStatus | null;
  shift: ScheduledShift | null;
  /** Clock records for this member on this day, earliest first. */
  clocked: Shift[];
  plannedMinutes: number;
  /** Time actually on the clock. */
  workedMinutes: number;
  /** Worked less the unpaid break, capped at the planned window — what payroll pays for. */
  paidMinutes: number;
  unpaidBreakMinutes: number;
  /** Minutes late (positive) or early (negative) against the planned start. */
  startDeltaMinutes: number | null;
  state: WorkState;
  hourlyRate: number | null;
  estimatedCost: number | null;
  billState: BillState;
}

export function staffLabel(profile: StaffProfile | undefined, fallback?: string): string {
  return profile?.name ?? profile?.email ?? fallback ?? 'Unknown';
}

/** Local YYYY-MM-DD for an instant — rows group by the day the shift starts. */
export const dayKey = (iso: string) => toDateInput(new Date(iso));

export function workStateOf(shift: ScheduledShift | null, variance: VarianceRow | undefined, clocked: Shift[], now: number): WorkState {
  if (shift?.status === 'cancelled') return 'cancelled';
  if (clocked.some((c) => !c.clockedOut)) return 'running';
  if (clocked.length > 0) return 'completed';
  if (variance) {
    if (variance.status === 'worked') return 'completed';
    if (variance.status === 'in_progress') return 'running';
    // The API only calls a no-show once the window has closed.
    return 'no_show';
  }
  if (shift && new Date(shift.endsAt).getTime() < now) return 'no_show';
  return 'scheduled';
}
