'use client';

import { Tooltip } from '@/components/shared/Tooltip';

import { formatBytes } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { STORAGE_KINDS, type StorageKind, storageMeter } from '@/lib/utils/media-storage';

const KIND_META = new Map(STORAGE_KINDS.map((entry) => [entry.kind, entry]));

/**
 * Used space by file kind against a limit: a stacked bar, then a legend that
 * carries every value in text — the legend is the table view, so nothing is
 * read from colour alone. Without a limit the bar shows the mix of what is
 * stored and the headline says so.
 */
export function StorageMeter({
  byKind,
  quotaBytes,
  compact = false,
  showHeadline = true,
  className,
}: {
  byKind: Record<StorageKind, number>;
  quotaBytes: number | null;
  /** One line, for the Media tab header: the bar and the headline, no legend. */
  compact?: boolean;
  /** Off when the caller already states the figures (the header popover). */
  showHeadline?: boolean;
  className?: string;
}) {
  const meter = storageMeter(byKind, quotaBytes);
  const headline =
    meter.quotaBytes === null
      ? `${formatBytes(meter.usedBytes)} used · no limit set`
      : `${formatBytes(meter.usedBytes)} of ${formatBytes(meter.quotaBytes)} used`;
  const free = meter.freeBytes === null ? null : meter.state === 'full' ? 'Full' : `${formatBytes(meter.freeBytes)} free`;

  return (
    <div className={cn('space-y-2', className)}>
      {showHeadline && (
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span className="font-medium tabular-nums text-foreground">{headline}</span>
          {free && (
            <span
              className={cn(
                'tabular-nums',
                meter.state === 'full'
                  ? 'font-medium text-exception'
                  : meter.state === 'nearly'
                    ? 'font-medium text-measured'
                    : 'text-muted-foreground',
              )}
            >
              {free}
              {meter.state === 'nearly' && ' · nearly full'}
            </span>
          )}
        </div>
      )}

      <div
        role="meter"
        aria-label={`Storage: ${headline}${free ? `, ${free}` : ''}`}
        aria-valuemin={0}
        aria-valuemax={meter.quotaBytes ?? meter.usedBytes}
        aria-valuenow={meter.usedBytes}
        className={cn('flex w-full gap-0.5 overflow-hidden rounded-sm bg-band', compact ? 'h-2' : 'h-3')}
      >
        {meter.segments.map((segment) => {
          const meta = KIND_META.get(segment.kind)!;
          return (
            // A visible sliver even for a few KB, so a kind that exists never vanishes.
            <Tooltip
              key={segment.kind}
              side="top"
              label={`${meta.label}: ${formatBytes(segment.bytes)}`}
              className="h-full min-w-1 shrink-0"
              style={{ width: `${segment.percent}%` }}
            >
              <span className={cn('block h-full w-full', meta.colorClass)} />
            </Tooltip>
          );
        })}
      </div>

      {!compact && meter.segments.length > 0 && (
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {meter.segments.map((segment) => {
            const meta = KIND_META.get(segment.kind)!;
            return (
              <li key={segment.kind} className="inline-flex items-center gap-1.5">
                <span className={cn('size-2 rounded-xs', meta.colorClass)} aria-hidden="true" />
                {meta.label}
                <span className="tabular-nums text-foreground">{formatBytes(segment.bytes)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
