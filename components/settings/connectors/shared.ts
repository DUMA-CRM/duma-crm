/** Display helpers shared by the connector cards, wizards and manage pages. */

/** "3 days ago" / "just now" from an ISO timestamp. Returns '' if unparseable. */
export { relativeTime } from '@/lib/utils/relative-time';

export const panelClass = 'rounded-2xl border border-border bg-card p-5';

export const eyebrowClass = 'text-micro uppercase text-muted-foreground';
