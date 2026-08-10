'use client';

import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';

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
  if (isFuture || spend === undefined) return 'size-2 bg-rule/45 rounded-sm';
  if (spend < 60) return 'size-2.5 bg-stock/40 rounded-sm';
  if (spend < 120) return 'size-3 bg-stock/60 rounded-sm';
  if (spend < 200) return 'size-3.5 bg-stock/80 rounded-sm';
  return 'size-4 bg-stock rounded-sm';
}

// ── Monday-first ─────────────────────────────────────────────
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SHOW_LABEL = new Set([0, 2, 4]); // Mon, Wed, Fri

export function VisitCalendar({ visits, months = 6 }: VisitCalendarProps) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const [today] = useState(() => new Date());

  const { weeks, monthLabels } = useMemo(() => {
    const visitMap = new Map<string, number>();
    visits.forEach((v) => {
      const key = v.date.slice(0, 10);
      visitMap.set(key, (visitMap.get(key) ?? 0) + v.spend);
    });

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
  }, [visits, months, today]);

  // ── Fixed-position tooltip handlers ────────────────────────
  function handleEnter(e: React.SyntheticEvent<HTMLElement>, cell: { date: Date; spend?: number }) {
    if (!cell.spend) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setTip({
      x: rect.left + rect.width / 2,
      y: rect.top,
      label: `£${cell.spend.toFixed(0)} · ${formatDate(cell.date)}`,
    });
  }

  return (
    <>
      {/* ── Fixed tooltip — escapes overflow-x-auto ─────────── */}
      {tip && (
        <div className="fixed z-[9999] pointer-events-none" style={{ left: tip.x, top: tip.y - 10, transform: 'translate(-50%, -100%)' }}>
          <div className="bg-foreground text-background text-micro font-semibold px-2.5 py-1 rounded-sm whitespace-nowrap shadow-lg">
            {tip.label}
          </div>
          <div className="w-2 h-2 bg-foreground rotate-45 mx-auto -mt-1" />
        </div>
      )}

      <div>
        <p className="mb-4 text-xs font-semibold text-foreground">Six-month activity</p>

        <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div style={{ minWidth: 'max-content' }}>
            {/* ── Month labels ─────────────────────────────────
                gap-1.5 MUST match the week-columns gap below    */}
            <div className="flex gap-1.5 mb-2 ml-7">
              {weeks.map((week, i) => {
                const m = monthLabels.find((m) => m.col === i);
                return (
                  <div key={week[0].date.toISOString().slice(0, 10)} className="w-5 shrink-0">
                    {m && <span className="text-micro font-semibold text-muted-foreground whitespace-nowrap">{m.label}</span>}
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
                    {SHOW_LABEL.has(i) ? <span className="text-micro font-semibold text-muted-foreground">{day[0]}</span> : null}
                  </div>
                ))}
              </div>

              {/* Week columns */}
              {weeks.map((week) => (
                <div key={week[0].date.toISOString().slice(0, 10)} className="flex flex-col gap-1">
                  {week.map((cell) => {
                    const isFuture = cell.date > today;
                    return (
                      <button
                        type="button"
                        key={cell.date.toISOString().slice(0, 10)}
                        className="flex size-5 cursor-default items-center justify-center rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                        aria-label={
                          cell.spend
                            ? `Spent £${cell.spend.toFixed(0)} on ${formatDate(cell.date)}`
                            : `No visit on ${formatDate(cell.date)}`
                        }
                        onMouseEnter={(e) => handleEnter(e, cell)}
                        onMouseLeave={() => setTip(null)}
                        onFocus={(e) => handleEnter(e, cell)}
                        onBlur={() => setTip(null)}
                      >
                        <div
                          className={cn(
                            'transition-transform duration-100',
                            getDot(cell.spend, isFuture),
                            tip && cell.spend && 'hover:scale-125',
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-2 mt-3">
          <span className="text-micro text-muted-foreground">Less</span>
          {[undefined, 50, 100, 160, 220].map((spend) => (
            <div key={spend ?? 'none'} className="w-4 h-4 flex items-center justify-center">
              <div className={cn(getDot(spend, false))} />
            </div>
          ))}
          <span className="text-micro text-muted-foreground">More</span>
        </div>
      </div>
    </>
  );
}
