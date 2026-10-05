'use client';

import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { type Visit, buildVisitWeeks } from '@/lib/utils/visit-pattern';

interface VisitCalendarProps {
  visits: Visit[];
  /** `YYYY-MM-DD` — the last day drawn. */
  today: string;
  months?: number;
  /** Formats a day's spend in the workspace currency. */
  money: (amount: number) => string;
}

interface TooltipState {
  x: number;
  y: number;
  label: string;
}

/** Spend as a share of the cell: a busier day is a bigger, darker square. */
function level(spend: number | undefined): string {
  if (spend === undefined) return 'size-[38%] bg-rule/45';
  if (spend < 60) return 'size-[55%] bg-stock/40';
  if (spend < 120) return 'size-[70%] bg-stock/60';
  if (spend < 200) return 'size-[85%] bg-stock/80';
  return 'size-full bg-stock';
}

const DAY_LABELS = ['M', '', 'W', '', 'F', '', ''];

/**
 * A heatmap that fills its panel: one column per week, sized by the grid
 * rather than in fixed pixels, so it never leaves an empty band on a wide
 * screen. Below ~28rem it scrolls sideways instead of shrinking to specks.
 */
export function VisitCalendar({ visits, today, months = 6, money }: VisitCalendarProps) {
  const [tip, setTip] = useState<TooltipState | null>(null);
  const { weeks, monthLabels } = useMemo(() => buildVisitWeeks(visits, today, months), [visits, today, months]);
  const columns = { gridTemplateColumns: `1.25rem repeat(${weeks.length}, minmax(0, 1fr))` };

  function show(event: React.SyntheticEvent<HTMLElement>, date: string, spend?: number) {
    if (!spend) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setTip({ x: rect.left + rect.width / 2, y: rect.top, label: `${money(spend)} · ${formatDate(date)}` });
  }

  return (
    <>
      {/* Fixed, so it escapes the scroll container. */}
      {tip && (
        <div className="pointer-events-none fixed z-9999" style={{ left: tip.x, top: tip.y - 8, transform: 'translate(-50%, -100%)' }}>
          <div className="whitespace-nowrap rounded-md bg-foreground px-2.5 py-1 text-micro font-semibold text-background shadow-lg">
            {tip.label}
          </div>
        </div>
      )}

      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="min-w-[28rem]">
          <div className="mb-1.5 grid gap-1" style={columns} aria-hidden="true">
            <span />
            {weeks.map((week, index) => {
              const label = monthLabels.find((entry) => entry.week === index);
              return (
                <span key={week[0].date} className="overflow-visible whitespace-nowrap text-micro font-semibold text-muted-foreground">
                  {label?.label}
                </span>
              );
            })}
          </div>

          <div className="grid gap-1" style={{ ...columns, gridTemplateRows: 'repeat(7, auto)', gridAutoFlow: 'column' }}>
            {DAY_LABELS.map((day, index) => (
              <span key={index} aria-hidden="true" className="flex items-center text-micro font-semibold text-muted-foreground">
                {day}
              </span>
            ))}
            {weeks.flat().map((cell) =>
              cell.future ? (
                <span key={cell.date} aria-hidden="true" />
              ) : (
                <button
                  type="button"
                  key={cell.date}
                  aria-label={
                    cell.spend ? `Spent ${money(cell.spend)} on ${formatDate(cell.date)}` : `No visit on ${formatDate(cell.date)}`
                  }
                  onMouseEnter={(event) => show(event, cell.date, cell.spend)}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(event) => show(event, cell.date, cell.spend)}
                  onBlur={() => setTip(null)}
                  className="flex aspect-square cursor-default items-center justify-center rounded-[3px] outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                >
                  <span
                    className={cn('rounded-[3px] transition-transform duration-100', level(cell.spend), cell.spend && 'hover:scale-110')}
                  />
                </button>
              ),
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/** The spend key, for the panel header — it sits beside the title, not under the grid. */
export function VisitLegend() {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      <span className="text-micro text-muted-foreground">Less</span>
      {[undefined, 50, 100, 160, 220].map((spend) => (
        <span key={spend ?? 'none'} className="flex size-3.5 items-center justify-center">
          <span className={cn('rounded-[2px]', level(spend))} />
        </span>
      ))}
      <span className="text-micro text-muted-foreground">More</span>
    </div>
  );
}
