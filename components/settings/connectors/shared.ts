/** Display helpers shared by the connector cards, wizards and manage pages. */

/** "3 days ago" / "just now" from an ISO timestamp. Returns '' if unparseable. */
export function relativeTime(iso?: string | null): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export const panelClass = 'rounded-2xl border border-border bg-card p-5';

export const eyebrowClass = 'text-[10px] font-bold uppercase tracking-widest text-muted-foreground';
