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

/** "14 Jul" style short date. */
export const fmtDateShort = (iso: string) => new Date(iso).toLocaleDateString(LOCALE, { day: 'numeric', month: 'short' });

/** "14 Jul 2026, 09:30" style timestamp. */
export const fmtDateTime = (iso: string) =>
  new Date(iso).toLocaleString(LOCALE, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
