'use client';

import { useState } from 'react';

import type { DailyOrderAnalytics } from '@/lib/api/analytics.service';
import { cn } from '@/lib/utils/cn';
import { type ReportMetricKey, dailyMetricValues, formatReportMetric, shortDateLabel } from '@/lib/utils/reporting';

const WIDTH = 720;
const HEIGHT = 180;
const TOP = 8;
const BOTTOM = 22;

function linePoints(values: number[], max: number, count: number) {
  return values
    .map((value, index) => {
      const x = count <= 1 ? WIDTH / 2 : (index / (count - 1)) * WIDTH;
      const y = TOP + (1 - value / max) * (HEIGHT - TOP - BOTTOM);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function ComparisonChart({
  metric,
  current,
  comparison,
  currentValue,
  comparisonValue,
  currentLabel,
  comparisonLabel,
}: {
  metric: ReportMetricKey;
  current: DailyOrderAnalytics[];
  comparison: DailyOrderAnalytics[];
  currentValue: number;
  comparisonValue: number;
  currentLabel: string;
  comparisonLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const currentValues = dailyMetricValues(metric, current);
  const comparisonValues = dailyMetricValues(metric, comparison);
  const hasSeries = currentValues.length > 0 || comparisonValues.length > 0;

  if (!hasSeries) {
    const max = Math.max(currentValue, comparisonValue, 1);
    return (
      <div
        className="mt-5 grid min-h-44 grid-cols-2 items-end gap-6 px-4"
        role="img"
        aria-label={`${currentLabel} compared with ${comparisonLabel}`}
      >
        {[
          { label: currentLabel, value: currentValue, className: 'bg-primary' },
          { label: comparisonLabel, value: comparisonValue, className: 'bg-info' },
        ].map((bar) => (
          <div key={bar.label} className="flex h-40 flex-col justify-end gap-2 text-center">
            <p className="text-sm font-bold tabular-nums text-foreground">{formatReportMetric(metric, bar.value)}</p>
            <div
              className={cn('mx-auto w-full max-w-24 rounded-t-lg', bar.className)}
              style={{ height: `${Math.max(3, (bar.value / max) * 112)}px` }}
            />
            <p className="truncate text-[11px] font-medium text-muted-foreground">{bar.label}</p>
          </div>
        ))}
      </div>
    );
  }

  const count = Math.max(currentValues.length, comparisonValues.length, 1);
  const max = Math.max(...currentValues, ...comparisonValues, 1);
  const currentPoints = linePoints(currentValues, max, count);
  const comparisonPoints = linePoints(comparisonValues, max, count);
  const index = active ?? Math.max(0, currentValues.length - 1);
  const currentRow = current[Math.min(index, Math.max(0, current.length - 1))];
  const comparisonRow = comparison[Math.min(index, Math.max(0, comparison.length - 1))];

  return (
    <div className="mt-5">
      <div className="mb-3 flex min-h-10 flex-wrap items-end justify-between gap-3" aria-live="polite">
        <div>
          <p className="text-[11px] text-muted-foreground">{currentRow ? shortDateLabel(currentRow.date) : currentLabel}</p>
          <p className="text-base font-bold tabular-nums text-foreground">
            {formatReportMetric(metric, currentValues[Math.min(index, Math.max(0, currentValues.length - 1))] ?? 0)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-muted-foreground">{comparisonRow ? shortDateLabel(comparisonRow.date) : comparisonLabel}</p>
          <p className="text-sm font-semibold tabular-nums text-info">
            {formatReportMetric(metric, comparisonValues[Math.min(index, Math.max(0, comparisonValues.length - 1))] ?? 0)}
          </p>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-44 w-full"
        role="img"
        aria-label={`${currentLabel} and ${comparisonLabel} trend`}
        onMouseLeave={() => setActive(null)}
        onMouseMove={(event) => {
          const rect = event.currentTarget.getBoundingClientRect();
          const position = (event.clientX - rect.left) / rect.width;
          setActive(Math.max(0, Math.min(count - 1, Math.round(position * (count - 1)))));
        }}
      >
        {[0.25, 0.5, 0.75, 1].map((position) => (
          <line
            key={position}
            x1="0"
            x2={WIDTH}
            y1={TOP + position * (HEIGHT - TOP - BOTTOM)}
            y2={TOP + position * (HEIGHT - TOP - BOTTOM)}
            className="stroke-border"
            strokeWidth="1"
          />
        ))}
        {comparisonPoints && (
          <polyline
            points={comparisonPoints}
            fill="none"
            className="stroke-info"
            strokeWidth="2"
            strokeDasharray="6 5"
            vectorEffect="non-scaling-stroke"
          />
        )}
        {currentPoints && (
          <polyline points={currentPoints} fill="none" className="stroke-primary" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
        )}
        {active !== null && (
          <line
            x1={count <= 1 ? WIDTH / 2 : (active / (count - 1)) * WIDTH}
            x2={count <= 1 ? WIDTH / 2 : (active / (count - 1)) * WIDTH}
            y1={TOP}
            y2={HEIGHT - BOTTOM}
            className="stroke-foreground/25"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 bg-primary" /> {currentLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-5 border-t-2 border-dashed border-info" /> {comparisonLabel}
        </span>
        <span className="ml-auto">
          {metric === 'netRevenue'
            ? 'Daily series is recorded order value; headline values exclude cancellations.'
            : 'Series are aligned by position within each period.'}
        </span>
      </div>
    </div>
  );
}
