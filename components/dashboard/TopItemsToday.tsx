'use client';

import Link from 'next/link';

import { ArrowUpRight, Coffee } from '@/components/icons';
import { Bone } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { useFormatMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';

import type { TopItemAnalytics } from '@/lib/modules/analytics/client';

/* What is actually selling today, ranked by quantity net of refunds. Lifted from
   the previous dashboard, which had this right — a ruled list with bar length as
   the second channel, not a pie chart. */

export function TopItemsToday({ rows, loading }: { rows: TopItemAnalytics[]; loading: boolean }) {
  const formatMoney = useFormatMoney();
  const max = Math.max(...rows.map((row) => Number(row.totalQuantity ?? 0)), 1);

  return (
    <div className="rounded-lg border border-rule/65 bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-title text-foreground">Selling today</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Ranked by quantity, net of refunds</p>
        </div>
        <Tooltip label="Menu" side="top" className="shrink-0">
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
            <Link href="/menu" aria-label="Open the menu">
              <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          </Button>
        </Tooltip>
      </div>

      {loading ? (
        <ul className="mt-5 space-y-3.5" role="status" aria-busy="true" aria-label="Loading what’s selling today">
          {['w-36', 'w-28', 'w-40', 'w-24', 'w-32'].map((width) => (
            <li key={width} aria-hidden="true">
              <div className="mb-1.5 flex items-center gap-3">
                <span className="w-3" />
                <span className="min-w-0 flex-1">
                  <Bone className={`h-3.5 ${width} max-w-full`} />
                </span>
                <Bone className="h-3 w-5 shrink-0" />
                <Bone className="h-3 w-12 shrink-0" />
              </div>
              <Bone className="ml-6 h-1.5 rounded-full" />
            </li>
          ))}
        </ul>
      ) : rows.length === 0 ? (
        <div className="mt-5 flex h-32 flex-col items-center justify-center gap-2 text-center">
          <Coffee size={20} className="text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Nothing sold yet today.</p>
        </div>
      ) : (
        <ul className="mt-5 space-y-3.5">
          {rows.map((row, index) => {
            const quantity = Number(row.totalQuantity ?? 0);
            return (
              <li key={`${row.menuItemId}-${row.name}`}>
                <div className="mb-1.5 flex items-baseline gap-3">
                  <span className="w-3 text-xs font-semibold text-muted-foreground">{index + 1}</span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{row.name}</p>
                  <p data-figure className="shrink-0 text-xs font-semibold text-foreground">
                    {quantity}
                  </p>
                  <p data-figure className="w-16 shrink-0 text-right text-xs text-muted-foreground">
                    {formatMoney(Number(row.totalRevenue ?? 0))}
                  </p>
                </div>
                <div className="ml-6 h-1.5 overflow-hidden rounded-full bg-band">
                  <div className="h-full rounded-full bg-measured/70" style={{ width: `${(quantity / max) * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
