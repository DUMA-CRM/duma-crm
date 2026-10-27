'use client';

import { Info } from '@/components/icons';
import { Tooltip } from '@/components/shared/Tooltip';

import type { PlatformMetric } from '@/lib/api/platform.service';
import { cn } from '@/lib/utils/cn';
import { formatCount, freshness, metricText } from '@/lib/utils/platform-metrics';

/**
 * One DUMA Admin figure: the number, what it counts, and when it was measured.
 * An estimate is marked; an unavailable source shows its reason in place of a
 * number, so "we could not tell" never reads as "nobody".
 */
export function MetricTile({
  label,
  metric,
  format = (value: number) => formatCount(value),
  note,
  unitLabel,
  className,
}: {
  label: string;
  metric: PlatformMetric<number>;
  format?: (value: number) => string;
  /** Replaces the metric's unit when the formatted value already carries it (bytes → "22 MB"). */
  unitLabel?: string;
  note?: React.ReactNode;
  className?: string;
}) {
  const text = metricText(metric, format);
  return (
    <div className={cn('rounded-lg border border-rule/60 bg-card px-4 py-3.5', className)}>
      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {label}
        <Tooltip label={metric.definition}>
          <span tabIndex={0} aria-label={`${label}: ${metric.definition}`} className="inline-flex cursor-help text-muted-foreground/70">
            <Info size={12} aria-hidden="true" />
          </span>
        </Tooltip>
      </p>
      {text === null ? (
        <>
          <p className="mt-1.5 text-sm font-semibold text-foreground">Unavailable</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{metric.status === 'unavailable' ? metric.reason : null}</p>
        </>
      ) : (
        <>
          <p className="mt-1 text-2xl font-semibold tabular-nums tracking-title text-foreground">{text}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {metric.status === 'ok' && (unitLabel ?? metric.unit)}
            {metric.status === 'ok' && metric.window ? ` · ${metric.window}` : ''}
            {' · measured '}
            {freshness(metric.collectedAt)}
            {metric.status === 'ok' && metric.estimate ? ' · estimate' : ''}
          </p>
        </>
      )}
      {note && <div className="mt-2 text-xs text-muted-foreground">{note}</div>}
    </div>
  );
}
