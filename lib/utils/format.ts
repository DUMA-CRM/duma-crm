import { formatDateTime as formatAppDateTime, formatDate } from './date';
import { relativeTime } from './relative-time';

// Central formatting helpers. Locale/currency live here so a future locale
// switch touches one file instead of every component.

const LOCALE = 'en-GB';

/** "3m ago" / "2h ago" / "5d ago" — see `relative-time.ts`, the one spelling. */
export const timeAgo = (iso: string): string => relativeTime(iso);

/** Whole-pound currency, e.g. "£1,204". */
export const fmtGbp = (n: number) => `£${n.toLocaleString(LOCALE, { maximumFractionDigits: 0 })}`;

/** Pounds and pence, e.g. "£4.20". */
export const fmtGbpExact = (n: number) => `£${n.toFixed(2)}`;

/** Consistent app date: "14/07/2026". */
export const fmtDateShort = (iso: string) => formatDate(iso);

/** Consistent app timestamp: "14/07/2026, 09:30". */
export const fmtDateTime = (iso: string) => formatAppDateTime(iso);
