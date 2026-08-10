'use client';

import { Boxes, Clock3, PackagePlus, Users } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { AttentionList } from '@/components/shared/AttentionList';

import type { InventoryForecast } from '@/lib/api/inventory.service';
import type { Order } from '@/lib/api/orders.service';
import type { RestockRequest } from '@/lib/api/restock.service';
import { CRASH_MINS, ageState } from '@/lib/utils/kitchen-age';
import type { AttendanceIssue, CoverGap } from '@/lib/utils/attendance';

/* The one live signal on a page that is otherwise a performance snapshot.

   It stays a single dense row on purpose: a manager reading this mid-service
   should be able to tell in one glance whether anything needs them, without a
   sidebar of cards pushing the day's figures below the fold. */

interface ExceptionItem {
  key: string;
  icon: IconComponent;
  label: string;
  detail: string;
  href: string;
  tone: 'exception' | 'stock' | 'measured';
}

/** "1h 20m" / "45m" — short enough for a one-line exception row. */
function formatHours(minutes: number) {
  const whole = Math.floor(minutes);
  if (whole < 60) return `${whole}m`;
  return `${Math.floor(whole / 60)}h ${whole % 60}m`;
}

const clock = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const slotWindow = (slot: { startsAt: string; endsAt: string }) => `${clock(slot.startsAt)}–${clock(slot.endsAt)}`;

const STAGE_LABEL: Record<string, string> = {
  pending: 'waiting to be started',
  preparing: 'in preparation',
  ready: 'waiting to be collected',
};

export function buildExceptions({
  lateOrders,
  criticalStock,
  urgentRestocks,
  coverGaps,
  attendanceIssues,
  now,
}: {
  lateOrders: Order[];
  criticalStock: InventoryForecast[];
  urgentRestocks: RestockRequest[];
  coverGaps: CoverGap[];
  attendanceIssues: AttendanceIssue[];
  now: number;
}): ExceptionItem[] {
  return [
    ...lateOrders.map((order) => ({
      key: `late-${order.id}`,
      icon: Clock3,
      // Same wording the kitchen sees: the stage clock, not time since ordering.
      label: `Order #${order.id.slice(0, 6).toUpperCase()} is over ${CRASH_MINS} minutes`,
      detail: `${Math.floor(ageState(order, now).mins)} minutes ${STAGE_LABEL[order.status] ?? 'in this stage'}`,
      href: '/kds',
      tone: 'exception' as const,
    })),
    ...attendanceIssues.map((issue) => ({
      key: `attendance-${issue.shift.id}`,
      icon: issue.reason === 'after-close' ? Clock3 : Users,
      label:
        issue.reason === 'after-close'
          ? `${issue.name} is still clocked in after close`
          : `${issue.name} is clocked in off-rota`,
      detail:
        issue.reason === 'after-close'
          ? `${formatHours(issue.minutes)} on the clock — check they meant to clock out`
          : `${formatHours(issue.minutes)} so far with no published shift covering now`,
      href: '/staff/shifts',
      tone: 'measured' as const,
    })),
    ...coverGaps.map((gap) => ({
      key: `cover-${gap.slot.id}`,
      icon: Users,
      label:
        gap.reason === 'unassigned'
          ? 'Shift running with nobody assigned'
          : `${gap.name} has not clocked in`,
      detail: `${slotWindow(gap.slot)}${gap.slot.role ? ` · ${gap.slot.role}` : ''} · ${formatHours(gap.minutesLate)} into the shift`,
      href: '/staff/rota',
      tone: 'exception' as const,
    })),
    ...criticalStock.map((item) => ({
      key: `stock-${item.locationStockId}`,
      icon: Boxes,
      label: `${item.stockItemName} runs out soon`,
      detail: `${item.daysOfStockRemaining ?? 0} days of stock left`,
      href: '/inventory',
      tone: 'stock' as const,
    })),
    ...urgentRestocks.map((request) => ({
      key: `restock-${request.id}`,
      icon: PackagePlus,
      label: `Urgent restock: ${request.stockItem?.name ?? 'stock item'}`,
      detail: `Quantity ${request.requestedQty} · awaiting review`,
      href: '/inventory?tab=demand',
      tone: 'stock' as const,
    })),
  ];
}

/**
 * The dashboard's wording around the shared attention panel. The panel itself
 * lives in `shared/AttentionList` so this strip and the employee's "needs you"
 * list on My HR cannot drift apart.
 */
export function ExceptionStrip({
  items,
  loading,
  error,
  onRetry,
}: {
  items: ExceptionItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <AttentionList
      items={items}
      loading={loading}
      error={error}
      onRetry={onRetry}
      clearDescription="Orders, stock and shift cover all look clear."
      errorDescription="Today’s figures below are unaffected."
    />
  );
}
