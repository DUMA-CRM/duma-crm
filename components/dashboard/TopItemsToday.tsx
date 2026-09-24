'use client';

import Link from 'next/link';

import { ArrowRight, Coffee } from '@/components/icons';

import type { TopItemAnalytics } from '@/lib/modules/analytics/client';
import { formatMoney } from '@/lib/utils/dashboard';

/* What is actually selling today, ranked by quantity net of refunds. Lifted from
   the previous dashboard, which had this right — a ruled list with bar length as
   the second channel, not a pie chart. */

export function TopItemsToday({ rows, loading }: { rows: TopItemAnalytics[]; loading: boolean }) {
  const max = Math.max(...rows.map((row) => Number(row.totalQuantity ?? 0)), 1);

  return (
    <div className="rounded-lg border border-rule/65 bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold tracking-title text-foreground">Selling today</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Ranked by quantity, net of refunds</p>
        </div>
        <Link
          href="/menu"
          className="inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-band hover:text-foreground"
        >
          Menu
          <ArrowRight size={13} aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <div className="mt-5 space-y-3" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-9 animate-pulse rounded-sm bg-band" />
          ))}
        </div>
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
