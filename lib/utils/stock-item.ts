// ---------------------------------------------------------------------------
// One stock item at one location: what needs someone, and how its expiry
// reads. Pure and tested; the item page's Overview renders it.
// ---------------------------------------------------------------------------
import { formatCalendarDate, workspaceDateKey } from './workspace-time.ts';

export type ItemAttentionSeverity = 'blocking' | 'attention' | 'info';
export type ItemAttentionTarget = 'restock' | 'threshold' | 'available' | 'containers';

export interface ItemAttention {
  id: string;
  severity: ItemAttentionSeverity;
  title: string;
  detail: string;
  /** The one action that deals with it; absent when nothing on the page can. */
  target?: ItemAttentionTarget;
}

export interface ItemAttentionInput {
  isAvailable: boolean;
  onHand: number;
  threshold: number;
  unit: string;
  daysLeft: number | null;
  earliestExpiry: string | null;
  cost: string | null | undefined;
  now: Date;
}

/** Whole days from the workspace's today to a calendar date (negative once past). */
export function daysUntil(date: string, now: Date): number {
  return Math.round((Date.parse(`${date.slice(0, 10)}T00:00:00Z`) - Date.parse(`${workspaceDateKey(now)}T00:00:00Z`)) / 86_400_000);
}

/** "Expired", "Today", "Tomorrow", "In 5 days" — then the date past a fortnight. */
export function expiryLabel(date: string | null, now: Date): string | null {
  if (!date) return null;
  const days = daysUntil(date, now);
  if (days < 0) return 'Expired';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days <= 14) return `In ${days} days`;
  return formatCalendarDate(date, { day: 'numeric', month: 'short', year: 'numeric' });
}

const daysText = (days: number) => {
  const n = Math.max(0, Math.round(days));
  return `${n} ${n === 1 ? 'day' : 'days'}`;
};

const qty = (n: number) => String(Math.round(n * 100) / 100);

/** Worst first. An item that is fine returns an empty list. */
export function itemAttention(input: ItemAttentionInput): ItemAttention[] {
  const items: ItemAttention[] = [];
  const { onHand, threshold, unit } = input;

  if (onHand <= 0) {
    items.push({
      id: 'out',
      severity: 'blocking',
      title: 'Out of stock',
      detail: 'Nothing on hand here — anything that uses it can’t be made.',
      target: 'restock',
    });
  } else if (threshold > 0 && onHand <= threshold) {
    items.push({
      id: 'low',
      severity: onHand <= threshold / 2 ? 'blocking' : 'attention',
      title: 'Below par',
      detail: `${qty(onHand)} ${unit} on hand, par ${qty(threshold)} ${unit}${input.daysLeft != null ? ` · about ${daysText(input.daysLeft)} left` : ''}.`,
      target: 'restock',
    });
  } else if (input.daysLeft != null && input.daysLeft <= 3) {
    items.push({
      id: 'running-out',
      severity: 'attention',
      title: `Runs out in about ${daysText(input.daysLeft)}`,
      detail: 'At the last 30 days’ usage, before it reaches par.',
      target: 'restock',
    });
  }

  if (input.earliestExpiry && onHand > 0) {
    const days = daysUntil(input.earliestExpiry, input.now);
    if (days < 0)
      items.push({
        id: 'expired',
        severity: 'blocking',
        title: 'A container has expired',
        detail: 'Use by date passed — log it as waste or check the date.',
        target: 'containers',
      });
    else if (days <= 2)
      items.push({
        id: 'expiring',
        severity: 'attention',
        title: `A container expires ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in 2 days'}`,
        detail: 'Use it first, or log it as waste once it’s gone over.',
        target: 'containers',
      });
  }

  if (!input.isAvailable)
    items.push({
      id: 'unavailable',
      severity: 'attention',
      title: 'Marked unavailable here',
      detail: 'Hidden from ordering at this location until it’s marked available.',
      target: 'available',
    });
  if (threshold <= 0)
    items.push({
      id: 'no-threshold',
      severity: 'info',
      title: 'No par level',
      detail: 'Without one it never shows as low or appears in the suggested order.',
      target: 'threshold',
    });
  if (input.cost == null || input.cost === '')
    items.push({
      id: 'no-cost',
      severity: 'info',
      title: 'No cost yet',
      detail: 'Set by the first delivery received with a price — until then stock value and margins leave it out.',
    });

  const rank: Record<ItemAttentionSeverity, number> = { blocking: 0, attention: 1, info: 2 };
  return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
}
