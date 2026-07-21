// Shared constants and small helpers for the payroll components.

export const inputClass =
  'h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

export const labelClass = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

export const thClass = 'px-3 md:px-5 py-3 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest';

/** Pounds and pence, e.g. "£4.20". Accepts numbers or numeric strings. */
export const money = (v: number | string | null | undefined) => `£${Number(v ?? 0).toFixed(2)}`;

/** Hours with up to 2dp and no trailing zeros, e.g. "32.5h" / "8h". */
export const hours = (v: number | string | null | undefined) => `${+Number(v ?? 0).toFixed(2)}h`;

/** Local YYYY-MM-DD (avoids UTC drift from toISOString). */
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Full month range from a `<input type="month">` value ("YYYY-MM"). */
export function monthRange(month: string) {
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return { from: '', to: '' };
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/** Seven-day range starting at a week-start date ("YYYY-MM-DD"). */
export function weekRange(start: string) {
  if (!start) return { from: '', to: '' };
  const d = new Date(`${start}T00:00:00`);
  d.setDate(d.getDate() + 6);
  return { from: start, to: iso(d) };
}

export const currentMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

/** Monday of the current week. */
export const currentWeekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
};

/** Display a date range like "1 Jul – 31 Jul 2026". */
export function formatRange(from: string, to: string) {
  if (!from || !to) return '';
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };
  const f = new Date(`${from}T00:00:00`).toLocaleDateString('en-GB', opts);
  const t = new Date(`${to}T00:00:00`).toLocaleDateString('en-GB', opts);
  return `${f} – ${t}`;
}

/** A single-day display, e.g. "17 Jul 2026". */
export const formatDate = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

/** Escape a value for a CSV cell. */
export const csvCell = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
