'use client';

import { useState } from 'react';
import type { DateRange as PickerRange } from 'react-day-picker';

import { CalendarDays, Check, ChevronDown, MapPin } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';

import { cn } from '@/lib/utils/cn';
import { COMPARE_LABEL, type CompareMode, PRESETS, rangeDates, toDateKey } from '@/lib/utils/report-filters';

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
      <DateRangePicker state={state} compact={compact} />

      {!noComparison && (
        <Select
          value={filters.compare}
          onValueChange={(compare) => setFilters({ compare: compare as CompareMode })}
          options={(['previous', 'year', 'none'] as const).map((value) => ({
            value,
            // Short in the header, where width is scarce; the menu still says what each means.
            label: compact ? COMPARE_SHORT[value] : `vs ${COMPARE_LABEL[value].toLowerCase()}`,
          }))}
          ariaLabel="Compare with"
          className={compact ? 'w-40' : 'w-56'}
        />
      )}

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

const COMPARE_SHORT: Record<CompareMode, string> = { previous: 'vs previous', year: 'vs last year', none: 'No comparison' };

function DateRangePicker({ state, compact }: { state: ReportFilterState; compact: boolean }) {
  const { filters, range, label, setFilters } = state;
  const [open, setOpen] = useState(false);
  // The calendar's own selection while picking a custom range; applied on the second click.
  const [draft, setDraft] = useState<PickerRange | undefined>(undefined);
  const lastDay = new Date(range.to.getFullYear(), range.to.getMonth(), range.to.getDate() - 1);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setDraft({ from: range.from, to: lastDay });
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('h-9 shrink-0 justify-between gap-2', compact ? 'min-w-40' : 'min-w-44')}
          aria-label={`Dates: ${label}, ${rangeDates(range)}`}
          title={rangeDates(range)}
        >
          <span className="flex items-center gap-2">
            <CalendarDays size={15} className="text-muted-foreground" aria-hidden="true" />
            {label}
          </span>
          <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={compact ? 'end' : 'start'} className="w-auto p-0">
        <div className="flex flex-col sm:flex-row">
          <ul
            className="flex gap-1 overflow-x-auto border-b border-rule/50 p-2 sm:w-40 sm:flex-col sm:border-r sm:border-b-0"
            aria-label="Quick ranges"
          >
            {PRESETS.map((preset) => {
              const on = filters.preset === preset.value;
              return (
                <li key={preset.value} className="shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setFilters({ preset: preset.value, from: undefined, to: undefined });
                      setOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors',
                      'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring',
                      on ? 'bg-primary/8 font-semibold text-primary' : 'text-foreground hover:bg-band',
                    )}
                  >
                    {preset.label}
                    {on && <Check size={14} aria-hidden="true" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="p-3">
            <p className="mb-2 px-1 text-label uppercase text-muted-foreground">Custom range</p>
            <Calendar
              mode="range"
              numberOfMonths={1}
              defaultMonth={draft?.from ?? range.from}
              selected={draft}
              onSelect={(next) => setDraft(next)}
              disabled={{ after: new Date() }}
              endMonth={new Date()}
            />
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-rule/50 pt-3">
              <span className="text-xs tabular-nums text-muted-foreground">
                {draft?.from && draft.to
                  ? rangeDates({ from: draft.from, to: new Date(draft.to.getFullYear(), draft.to.getMonth(), draft.to.getDate() + 1) })
                  : 'Pick a first and last day'}
              </span>
              <Button
                size="sm"
                disabled={!draft?.from || !draft?.to}
                onClick={() => {
                  if (!draft?.from || !draft.to) return;
                  setFilters({ preset: 'custom', from: toDateKey(draft.from), to: toDateKey(draft.to) });
                  setOpen(false);
                }}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
