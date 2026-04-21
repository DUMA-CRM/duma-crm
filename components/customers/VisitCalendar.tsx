'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
interface Visit {
  date: string;
  spend: number;
}

interface VisitCalendarProps {
  visits: Visit[];
  months?: number;
}

interface TooltipState {
  x: number;
  y: number;
  label: string;
}

function getDot(spend: number | undefined, isFuture: boolean) {
  if (isFuture || spend === undefined) return 'w-[7px] h-[7px] bg-border rounded-full';
  if (spend < 60) return 'w-[9px]  h-[9px]  bg-amber-300 dark:bg-amber-600 rounded-full shadow-sm';
  if (spend < 120) return 'w-[12px] h-[12px] bg-amber-400 dark:bg-amber-500 rounded-full shadow-sm';
  if (spend < 200) return 'w-[15px] h-[15px] bg-amber-500 dark:bg-amber-400 rounded-full shadow-md';
  return 'w-[18px] h-[18px] bg-amber-600 dark:bg-amber-300 rounded-full shadow-md';
}

// ── Monday-first ─────────────────────────────────────────────
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHOW_LABEL = new Set([0, 2, 4]); // Mon, Wed, Fri

export function VisitCalendar({ visits, months = 6 }: VisitCalendarProps) {
  const [tip, setTip] = useState<TooltipState | null>(null);

  const { weeks, monthLabels } = useMemo(() => {
    const visitMap = new Map<string, number>();
    visits.forEach((v) => {
      const key = v.date.slice(0, 10);
      visitMap.set(key, (visitMap.get(key) ?? 0) + v.spend);
    });

    const today = new Date();
    const start = new Date(today);
    start.setMonth(start.getMonth() - months);

    // ── Snap to Monday ──────────────────────────────────────
    const dow = start.getDay(); // 0 = Sun
    start.setDate(start.getDate() - (dow === 0 ? 6 : dow - 1));

    const weeks: { date: Date; spend?: number }[][] = [];
    const monthLabels: { label: string; col: number }[] = [];
    const cursor = new Date(start);
    let lastMonth = -1;

    while (cursor <= today) {
      const week: { date: Date; spend?: number }[] = [];

      for (let d = 0; d < 7; d++) {
        const key = cursor.toISOString().slice(0, 10);
        week.push({ date: new Date(cursor), spend: visitMap.get(key) });
        cursor.setDate(cursor.getDate() + 1);
      }

      // Month label at first week of each new month
      const mon = week[0].date.getMonth();
      if (mon !== lastMonth) {
        lastMonth = mon;
        monthLabels.push({
          label: week[0].date.toLocaleDateString('en-US', { month: 'short' }),
          col: weeks.length,
        });
      }

      weeks.push(week);
    }

    return { weeks, monthLabels };
  }, [visits, months]);

  const today = new Date();

  // ── Fixed-position tooltip handlers ────────────────────────
  function handleEnter(e: React.MouseEvent, cell: { date: Date; spend?: number }) {
    if (!cell.spend) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      label: `₴${cell.spend.toFixed(0)} · ${cell.date.toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })}`,
    });
  }

  return (
    <>
      {/* ── Fixed tooltip — escapes overflow-x-auto ─────────── */}
      {tip && (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: tip.x, top: tip.y - 10, transform: 'translate(-50%, -100%)' }}>
          <div className="bg-foreground text-background text-[10px] font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap shadow-lg">
            {tip.label}
          </div>
          <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
        </div>
      )}

      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Activity</p>

        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div style={{ minWidth: 'max-content' }}>
            {/* ── Month labels ─────────────────────────────────
                gap-1.5 MUST match the week-columns gap below    */}
            <div className="flex gap-1.5 mb-2 ml-7">
              {weeks.map((week, i) => {
                const m = monthLabels.find((m) => m.col === i);
                return (
                  <div key={week[0].date.toISOString().slice(0, 10)} className="w-5 shrink-0">
                    {m && <span className="text-[10px] font-semibold text-muted-foreground/80 whitespace-nowrap">{m.label}</span>}
                  </div>
                );
              })}
            </div>

            {/* ── Grid ─────────────────────────────────────── */}
            <div className="flex gap-1.5">
              {/* Day labels */}
              <div className="flex flex-col gap-1 mr-1">
                {DAY_LABELS.map((day, i) => (
                  <div key={day} className="h-5 w-5 flex items-center justify-end">
                    {SHOW_LABEL.has(i) ? <span className="text-[9px] font-semibold text-muted-foreground/60">{day[0]}</span> : null}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              {weeks.map((week) => (
                <div key={week[0].date.toISOString().slice(0, 10)} className="flex flex-col gap-1">
                  {week.map((cell) => {
                    const isFuture = cell.date > today;
                    return (
                      <div
                        key={cell.date.toISOString().slice(0, 10)}
                        className="w-5 h-5 flex items-center justify-center cursor-default"
                        onMouseEnter={(e) => handleEnter(e, cell)}
                        onMouseLeave={() => setTip(null)}
                      >
                        <div
                          className={cn(
                            'transition-transform duration-100',
                            getDot(cell.spend, isFuture),
                            tip && cell.spend && 'hover:scale-125',
                          )}
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-[10px] text-muted-foreground">Less</span>
          {[undefined, 50, 100, 160, 220].map((spend) => (
            <div key={spend ?? 'none'} className="w-4 h-4 flex items-center justify-center">
              <div className={cn(getDot(spend, false))} />
            </div>
          ))}
          <span className="text-[10px] text-muted-foreground">More</span>
        </div>
      </div>
    </>
  );
}
