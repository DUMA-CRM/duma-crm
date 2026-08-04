'use client';

import type { DailyOrderAnalytics } from '@/lib/api/analytics.service';
import { formatCompact } from '@/lib/utils/dashboard';
import { cn } from '@/lib/utils/cn';
import { REPORT_METRIC_MAP, type ReportMetricKey, dailyMetricValues, formatReportMetric, shortDateLabel } from '@/lib/utils/reporting';

import { ReportTrendChart } from './ReportChart';

function ComparisonBars({
  metric,
  currentValue,
  comparisonValue,
  currentLabel,
  comparisonLabel,
}: {
  metric: ReportMetricKey;
  currentValue: number;
  comparisonValue: number;
  currentLabel: string;
  comparisonLabel: string;
}) {
  const max = Math.max(currentValue, comparisonValue, 1);
  return (
    <div className="mt-5" role="img" aria-label={`${currentLabel} compared with ${comparisonLabel}`}>
      <div className="grid gap-4 divide-y divide-border/60 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
        {[
          { label: currentLabel, value: currentValue, colour: 'bg-chart-1', ink: 'text-chart-1' },
          { label: comparisonLabel, value: comparisonValue, colour: 'bg-chart-5', ink: 'text-chart-5' },
        ].map((bar) => (
          <div key={bar.label} className="py-2 first:pt-0 sm:px-4 sm:py-0 sm:first:pl-0 sm:last:pr-0">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{bar.label}</p>
                <p className={cn('mt-1 text-xl font-bold tabular-nums', bar.ink)}>{formatReportMetric(metric, bar.value)}</p>
              </div>
              <span className="text-xs tabular-nums text-muted-foreground">{((bar.value / max) * 100).toFixed(0)}%</span>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-offset">
              <div className={cn('h-full rounded-full', bar.colour)} style={{ width: `${Math.max(2, (bar.value / max) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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
  const currentValues = dailyMetricValues(metric, current);
  const comparisonValues = dailyMetricValues(metric, comparison);
  const hasSeries = currentValues.length > 0 || comparisonValues.length > 0;

  if (!hasSeries) {
    return (
      <ComparisonBars
        metric={metric}
        currentValue={currentValue}
        comparisonValue={comparisonValue}
        currentLabel={currentLabel}
        comparisonLabel={comparisonLabel}
      />
    );
  }

  const source = current.length ? current : comparison;
  const labels = source.map((row) => shortDateLabel(row.date));

  return (
    <ReportTrendChart
      className="mt-5"
      series={[
        { name: currentLabel, values: currentValues, tone: 'primary' },
        { name: comparisonLabel, values: comparisonValues, tone: 'comparison', dashed: true },
      ]}
      labels={labels}
      formatValue={(value) => formatReportMetric(metric, value)}
      formatAxis={(value) => {
        const unit = REPORT_METRIC_MAP[metric].unit;
        if (unit === 'money') return `£${formatCompact(value)}`;
        if (unit === 'money-precise') return formatReportMetric(metric, value);
        if (unit === 'percent') return `${value.toFixed(0)}%`;
        return formatCompact(value);
      }}
      ariaLabel={`${currentLabel} and ${comparisonLabel} ${metric} trend`}
      insight={
        metric === 'netRevenue'
          ? 'Daily values show recorded order value; headline revenue excludes cancellations.'
          : 'Periods are aligned by day position.'
      }
    />
  );
}
