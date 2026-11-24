import { formatDate as formatAppDate } from '@/lib/utils/date';

/** Hours with up to 2dp and no trailing zeros, e.g. "32.5h" / "8h". */
export const hours = (v: number | string | null | undefined) => `${+Number(v ?? 0).toFixed(2)}h`;


/** Display a date range like "01/07/2026 – 31/07/2026". */
export function formatRange(from: string, to: string) {
  if (!from || !to) return '';
  return `${formatAppDate(from)} – ${formatAppDate(to)}`;
}

/** A single-day display, e.g. "17/07/2026". */
export const formatDate = (iso?: string | null) => formatAppDate(iso);

/** Escape a value for a CSV cell. */
export const csvCell = (v: string | number) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** A line nobody can be paid from: hourly, worked hours, but no rate recorded. */
export const missingRate = (line: { payType: string; hourlyRate: number | null; rawHours: number }) =>
  line.payType === 'hourly' && line.rawHours > 0 && (line.hourlyRate == null || line.hourlyRate <= 0);
