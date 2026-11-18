'use client';

import { Boxes, CheckCircle2, Clock3, PackagePlus, Users } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NeedsAttention, type NeedsAttentionTone } from '@/components/shared/NeedsAttention';
import { ListSkeleton } from '@/components/shared/Skeleton';

import type { InventoryForecast } from '@/lib/modules/inventory/client';
import type { RestockRequest } from '@/lib/modules/inventory/client';
import type { Order } from '@/lib/modules/ordering/client';
import type { AttendanceIssue, CoverGap } from '@/lib/utils/attendance';
import { cn } from '@/lib/utils/cn';
import { type Lateness, ageState, durationLabel } from '@/lib/utils/kitchen-age';
import { formatInstant } from '@/lib/utils/workspace-time';

/* The one live signal on a board that is otherwise a performance snapshot:
   late orders, cover gaps, attendance, stock running out, urgent restocks. */

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

// The staff overview's card for the states NeedsAttention doesn't draw.
const CARD = 'overflow-hidden rounded-lg border border-border bg-card shadow-sm';

// The shared strip has two urgencies; stock running out is a warning, not a failure.
const TONE: Record<ExceptionItem['tone'], NeedsAttentionTone> = {
  exception: 'exception',
  measured: 'measured',
  stock: 'measured',
};

/**
 * "Needs you" is the shared Needs attention strips with their fix buttons — the
 * same as the staff and CMS overviews — so a problem looks the same wherever it
 * is raised. On the board it is a strip above the widgets, there only while
 * something needs someone or the checks failed (a failure must never read as
 * "nothing needs you"). `preview` is edit mode, where it is drawn in every
 * state so it can be seen and removed; `fill` is the gallery's cell, where it
 * also takes the cell's height and scrolls past what fits.
 */
export function ExceptionStrip({
  items,
  loading,
  error,
  onRetry,
  preview = false,
  fill = false,
}: {
  items: ExceptionItem[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  preview?: boolean;
  fill?: boolean;
}) {
  const always = preview || fill;
  if (error)
    return (
      <div className={cn(CARD, fill && 'h-full')}>
        <ErrorState title="The live checks couldn’t run" description="Today’s figures are unaffected." onRetry={onRetry} />
      </div>
    );
  if (!always && (loading || items.length === 0)) return null;
  if (loading) return <ListSkeleton rows={3} label="Checking what needs you" />;
  if (items.length === 0)
    return (
      <div className={cn(CARD, fill && 'h-full')}>
        <EmptyState
          compact
          kind="done"
          icon={CheckCircle2}
          title="Nothing needs you"
          description="Shows above your dashboard when an order runs late, a shift goes uncovered or stock runs out."
        />
      </div>
    );
  return (
    <NeedsAttention
      label="Needs you"
      className={fill ? 'h-full overflow-y-auto' : undefined}
      items={items.map((item) => ({
        key: item.key,
        tone: TONE[item.tone],
        icon: item.icon,
        title: item.label,
        detail: item.detail,
        fix: { label: item.fixLabel, href: item.href },
      }))}
    />
  );
}
