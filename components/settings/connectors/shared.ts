/** Display helpers shared by the connector cards, wizards and manage pages. */

/** "3 days ago" / "just now" from an ISO timestamp. Returns '' if unparseable. */
export { relativeTime } from '@/lib/utils/relative-time';

/** The one card in connector flows: the requirement tiles, step rows and panels all share it. */
export const panelClass = 'rounded-lg border border-rule/50 bg-field p-4';

export const eyebrowClass = 'text-micro uppercase text-muted-foreground';
