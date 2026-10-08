'use client';

import { AlertTriangle, Boxes, Clock3, PackagePlus, Users } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { NeedsAttention, type NeedsAttentionTone } from '@/components/shared/NeedsAttention';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import type { InventoryForecast } from '@/lib/modules/inventory/client';
import type { RestockRequest } from '@/lib/modules/inventory/client';
import type { Order } from '@/lib/modules/ordering/client';
import type { AttendanceIssue, CoverGap } from '@/lib/utils/attendance';
import { type Lateness, ageState, durationLabel } from '@/lib/utils/kitchen-age';
import { formatInstant } from '@/lib/utils/workspace-time';

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
  /** Names the place the row's button opens. */
  fixLabel: string;
  tone: 'exception' | 'stock' | 'measured';
}

/** "1h 20m" / "45m" — short enough for a one-line exception row. */
function formatHours(minutes: number) {
  const whole = Math.floor(minutes);
  if (whole < 60) return `${whole}m`;
  return `${Math.floor(whole / 60)}h ${whole % 60}m`;
}

const clock = (iso: string) => formatInstant(iso, { hour: '2-digit', minute: '2-digit' });
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
  lateness,
  kitchenScreen,
}: {
  lateOrders: Order[];
  criticalStock: InventoryForecast[];
  urgentRestocks: RestockRequest[];
  coverGaps: CoverGap[];
  attendanceIssues: AttendanceIssue[];
  now: number;
  /** The workspace's lateness; off (null) means no order is late. */
  lateness: Lateness | null;
  /** The kitchen display is on: a late order opens there, else on the Orders page. */
  kitchenScreen: boolean;
}): ExceptionItem[] {
  return [
    ...(lateness ? lateOrders : []).map((order) => {
      const mins = Math.floor(ageState(order, now, lateness).mins);
      return {
        key: `late-${order.id}`,
        icon: Clock3,
        // Same wording the kitchen sees: the stage clock, not time since ordering.
        label: `Order #${order.id.slice(0, 6).toUpperCase()} is over ${durationLabel(lateness!.lateMins)}`,
        detail: `${mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`} ${STAGE_LABEL[order.status] ?? 'in this stage'}`,
        href: kitchenScreen ? '/kds' : '/orders',
        fixLabel: kitchenScreen ? 'Open KDS' : 'Open orders',
        tone: 'exception' as const,
      };
    }),
    ...attendanceIssues.map((issue) => ({
      key: `attendance-${issue.shift.id}`,
      icon: issue.reason === 'after-close' ? Clock3 : Users,
      label: issue.reason === 'after-close' ? `${issue.name} is still clocked in after close` : `${issue.name} is clocked in off-rota`,
      detail:
        issue.reason === 'after-close'
          ? `${formatHours(issue.minutes)} on the clock — check they meant to clock out`
          : `${formatHours(issue.minutes)} so far with no published shift covering now`,
      href: '/staff/shifts',
      fixLabel: 'Open shifts',
      tone: 'measured' as const,
    })),
    ...coverGaps.map((gap) => ({
      key: `cover-${gap.slot.id}`,
      icon: Users,
      label: gap.reason === 'unassigned' ? 'Shift running with nobody assigned' : `${gap.name} has not clocked in`,
      detail: `${slotWindow(gap.slot)}${gap.slot.role ? ` · ${gap.slot.role}` : ''} · ${formatHours(gap.minutesLate)} into the shift`,
      href: '/staff/rota',
      fixLabel: 'Open rota',
      tone: 'exception' as const,
    })),
    ...criticalStock.map((item) => ({
      key: `stock-${item.locationStockId}`,
      icon: Boxes,
      label: `${item.stockItemName} runs out soon`,
      detail: `${item.daysOfStockRemaining ?? 0} days of stock left`,
      href: '/inventory',
      fixLabel: 'Open stock',
      tone: 'stock' as const,
    })),
    ...urgentRestocks.map((request) => ({
      key: `restock-${request.id}`,
      icon: PackagePlus,
      label: `Urgent restock: ${request.stockItem?.name ?? 'stock item'}`,
      detail: `Quantity ${request.requestedQty} · awaiting review`,
      href: '/inventory?tab=demand',
      fixLabel: 'Review',
      tone: 'stock' as const,
    })),
  ];
}

/** The shared card has two warning strengths; stock is a shortage to act on, so it reads as measured. */
const TONE: Record<ExceptionItem['tone'], NeedsAttentionTone> = {
  exception: 'exception',
  measured: 'measured',
  stock: 'measured',
};

/**
 * The dashboard's wording around the shared "needs you" card — the same folded
 * card the staff overview, My HR and every workspace use, so a manager learns
 * one shape for "something needs you" across the product.
 *
 * The card has no loading or failed state of its own, so those are drawn here
 * in its frame: a failed read must never fall through to "nothing needs you".
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
  if (error)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3" role="alert">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-exception/8 text-exception">
          <AlertTriangle size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">The live checks couldn’t run</span>
          <span className="block text-xs text-muted-foreground">Today’s figures below are unaffected.</span>
        </span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );

  if (loading)
    return (
      <div
        className="flex items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3.5"
        role="status"
        aria-busy="true"
        aria-label="Checking what needs you"
      >
        <Bone className="size-10 shrink-0" />
        <span className="min-w-0 flex-1 space-y-1.5">
          <Bone className="h-3.5 w-32" />
          <Bone className="h-3 w-64 max-w-full" />
        </span>
      </div>
    );

  return (
    <NeedsAttention
      label="Needs you"
      items={items.map((item) => ({
        key: item.key,
        tone: TONE[item.tone],
        icon: item.icon,
        title: item.label,
        detail: item.detail,
        fix: { label: item.fixLabel, href: item.href },
      }))}
      // No all-clear banner: when nothing needs anyone the strip steps aside and the figures lead.
    />
  );
}
