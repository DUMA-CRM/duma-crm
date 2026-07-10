'use client';

import { useQuery } from '@tanstack/react-query';
import { BarChart3 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { type CoverageRow, type CoverageWeekdayRow, getCoverage, isWeekdayRow } from '@/lib/api/scheduling.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const inp =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';
const lbl = 'block text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1';

const DEFAULTS = { lookbackDays: 30, ordersPerStaff: 15, minStaff: 1 };
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

function HourBar({ row, maxOrders }: { row: CoverageRow; maxOrders: number }) {
  const pct = maxOrders > 0 ? (row.avgOrders / maxOrders) * 100 : 0;
  return (
    <div className="flex items-center gap-3 px-4 py-1.5">
      <span className="w-12 shrink-0 text-xs font-semibold text-muted-foreground tabular-nums">{hourLabel(row.hour)}</span>
      <div className="flex-1 h-5 bg-surface-offset rounded-md overflow-hidden">
        <div className="h-full bg-primary/70 rounded-md transition-[width] duration-300" style={{ width: `${Math.max(pct, row.avgOrders > 0 ? 3 : 0)}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-xs text-foreground tabular-nums">{row.avgOrders.toFixed(1)}</span>
      <span className="w-16 shrink-0 text-right text-xs font-semibold text-primary tabular-nums">{row.recommendedStaff} staff</span>
    </div>
  );
}

/** Demand-coverage insight — recommended staffing per hour, shown inside the rota. */
export function CoveragePanel() {
  const { locationId } = useWorkspaceStore();
  const [lookbackDays, setLookbackDays] = useState(DEFAULTS.lookbackDays);
  const [ordersPerStaff, setOrdersPerStaff] = useState(DEFAULTS.ordersPerStaff);
  const [minStaff, setMinStaff] = useState(DEFAULTS.minStaff);
  const [byWeekday, setByWeekday] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['coverage', locationId, lookbackDays, ordersPerStaff, minStaff, byWeekday],
    queryFn: () => getCoverage({ locationId: locationId!, lookbackDays, ordersPerStaff, minStaff, byWeekday }),
    enabled: !!locationId,
  });

  const coverage = useMemo(() => data?.coverage ?? [], [data]);
  const maxOrders = useMemo(() => coverage.reduce((m, r) => Math.max(m, r.avgOrders), 0), [coverage]);

  const grouped = useMemo(() => {
    if (!byWeekday) return null;
    const map = new Map<number, { name: string; rows: CoverageWeekdayRow[] }>();
    for (const r of coverage) {
      if (!isWeekdayRow(r)) continue;
      const g = map.get(r.weekday) ?? { name: r.weekdayName, rows: [] };
      g.rows.push(r);
      map.set(r.weekday, g);
    }
    return [...map.entries()].sort((a, b) => a[0] - b[0]).map(([, g]) => g);
  }, [coverage, byWeekday]);

  return (
    <div className="bg-card border border-border rounded-2xl shrink-0 overflow-hidden">
      {/* Controls */}
      <div className="p-3 flex flex-wrap items-end gap-3 border-b border-border">
        <div><label className={lbl}>Lookback days</label><input type="number" min={1} value={lookbackDays} onChange={(e) => setLookbackDays(Number(e.target.value))} className={inp + ' w-24'} /></div>
        <div><label className={lbl}>Orders / staff</label><input type="number" min={1} value={ordersPerStaff} onChange={(e) => setOrdersPerStaff(Number(e.target.value))} className={inp + ' w-24'} /></div>
        <div><label className={lbl}>Min staff</label><input type="number" min={0} value={minStaff} onChange={(e) => setMinStaff(Number(e.target.value))} className={inp + ' w-24'} /></div>
        <label className="flex items-center gap-2 cursor-pointer select-none h-9">
          <input type="checkbox" checked={byWeekday} onChange={(e) => setByWeekday(e.target.checked)} className="w-4 h-4 rounded accent-primary" />
          <span className="text-sm text-foreground">By weekday</span>
        </label>
      </div>

      {/* Bars */}
      {isLoading ? (
        <div className="p-4 space-y-2">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-5 bg-muted rounded animate-pulse" style={{ width: `${40 + ((i * 17) % 55)}%` }} />)}
        </div>
      ) : coverage.length === 0 ? (
        <div className="py-8 text-center">
          <BarChart3 size={24} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Not enough order history for this range.</p>
        </div>
      ) : (
        <div className="max-h-64 overflow-auto py-3">
          <div className="flex items-center gap-3 px-4 pb-2 border-b border-border">
            <span className="w-12 shrink-0 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Hour</span>
            <span className="flex-1 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Avg orders</span>
            <span className="w-14 shrink-0 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Orders</span>
            <span className="w-16 shrink-0 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Rec.</span>
          </div>
          {grouped ? (
            grouped.map((g) => (
              <div key={g.name} className="mt-1">
                <p className="px-4 pt-3 pb-1 text-xs font-bold text-primary uppercase tracking-widest">{g.name}</p>
                {g.rows.slice().sort((a, b) => a.hour - b.hour).map((r) => <HourBar key={`${g.name}-${r.hour}`} row={r} maxOrders={maxOrders} />)}
              </div>
            ))
          ) : (
            coverage.slice().sort((a, b) => a.hour - b.hour).map((r) => <HourBar key={r.hour} row={r} maxOrders={maxOrders} />)
          )}
        </div>
      )}
    </div>
  );
}
