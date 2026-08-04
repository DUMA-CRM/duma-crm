import { formatDateTime as formatAppDateTime, formatDate } from './date';

// Central formatting helpers. Locale/currency live here so a future locale
// switch touches one file instead of every component.

const LOCALE = 'en-GB';

/** "3m ago" / "2h ago" / "5d ago" relative timestamp. */
export function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/** Whole-pound currency, e.g. "£1,204". */
export const fmtGbp = (n: number) => `£${n.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;

/** Pounds and pence, e.g. "£4.20". */
export const fmtGbpExact = (n: number) => `£${n.toFixed(2)}`;

/** Consistent app date: "14/07/2026". */
export const fmtDateShort = (iso: string) => formatDate(iso);

/** Consistent app timestamp: "14/07/2026, 09:30". */
export const fmtDateTime = (iso: string) => formatAppDateTime(iso);
