'use client';

import { MapPin } from '@/components/icons';
import { Select } from '@/components/ui/select';

import { cn } from '@/lib/utils/cn';

import { RangeComparePicker } from './RangeComparePicker';
import type { ReportFilterState } from './useReportFilters';

/**
 * The filter bar every report shares, as Toast and Shopify lay theirs out:
 * the dates first (presets beside a calendar for a custom range), then what to
 * compare against, then the site. One row; it wraps on a phone.
 */
export function ReportFilterBar({
  state,
  allLocationsOnly = false,
  noComparison = false,
  layout = 'bar',
}: {
  state: ReportFilterState;
  /** The report can't be scoped to one site — the picker says so instead of pretending. */
  allLocationsOnly?: boolean;
  noComparison?: boolean;
  /**
   * `header`: compact, for the page header beside Print and Export (from md up).
   * `bar`: a full-width row under the header — the phone layout, where three
   * pickers don't fit beside the title.
   */
  layout?: 'header' | 'bar';
}) {
  const { filters, setFilters, locations } = state;
  const compact = layout === 'header';

  return (
    <div className={cn('flex items-center gap-2', compact ? 'flex-nowrap' : 'flex-wrap')} role="group" aria-label="Report filters">
      {/* Dates and what they're measured against are one question, so they're one popover. */}
      <RangeComparePicker state={state} compact={compact} noComparison={noComparison} />

      {locations.length > 1 &&
        (allLocationsOnly ? (
          <span className="flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-dashed border-rule/70 px-3 text-xs text-muted-foreground">
            <MapPin size={13} aria-hidden="true" />
            Every location
          </span>
        ) : (
          <Select
            value={filters.locationId || 'all'}
            onValueChange={(locationId) => setFilters({ locationId: locationId === 'all' ? '' : locationId })}
            options={[
              { value: 'all', label: 'All locations' },
              ...locations.map((location) => ({ value: location.id, label: location.name })),
            ]}
            ariaLabel="Location"
            icon={<MapPin size={14} />}
            className={compact ? 'w-44' : 'w-52'}
          />
        ))}
    </div>
  );
}


