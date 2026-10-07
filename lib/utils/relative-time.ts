// One way to say "how long ago" (or "how long until") across the app. There
// used to be six helpers with six spellings — "3 h ago", "3h ago",
// "3 hours ago", "3 hrs ago" — so two lists side by side read differently.

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * "just now" · "12m ago" · "3h ago" · "2d ago" · "5mo ago" · "2y ago",
 * and the same forwards: "in 12m" · "in 3h" · "in 2d".
 * Returns '' for an unparseable timestamp so a caller can fall back.
 */
export function relativeTime(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return '';
  const delta = now - then;
  const span = Math.abs(delta);
  if (span < MINUTE) return 'just now';

  const amount =
    span < HOUR
      ? `${Math.round(span / MINUTE)}m`
      : span < DAY
        ? `${Math.round(span / HOUR)}h`
        : span < 30 * DAY
          ? `${Math.round(span / DAY)}d`
          : span < 365 * DAY
            ? `${Math.round(span / (30 * DAY))}mo`
            : `${Math.round(span / (365 * DAY))}y`;

  return delta >= 0 ? `${amount} ago` : `in ${amount}`;
}
