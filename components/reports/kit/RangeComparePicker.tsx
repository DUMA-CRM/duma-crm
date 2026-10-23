'use client';

import { useState } from 'react';

import { CalendarDays, ChevronDown } from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';

import { cn } from '@/lib/utils/cn';
import { COMPARE_LABEL, PRESETS, type RangePreset, comparisonDates, rangeDates } from '@/lib/utils/report-filters';
import {
  type RangeDraft,
  draftChanged,
  draftFilters,
  draftFromFilters,
  draftSummary,
  pickDays,
  pickPreset,
  setCompare,
} from '@/lib/utils/report-range-draft';

import type { ReportFilterState } from './useReportFilters';

/** The ranges people reach for; any other span is a drag on the calendar away. */
const QUICK = new Set<RangePreset>(['today', 'yesterday', 'last-7', 'last-30', 'this-month', 'last-month', 'last-90', 'this-year']);

/**
 * The period and what it's measured against, in one plain popover: a range
 * dropdown, one calendar, a Compare
 * switch, and Cancel / Apply on a row of their own — drawn to the owner's sketch (2026-10-23), after versions
 * with a preset rail, date fields and explanations read as too much for new
 * users. A draft until Apply, so the page doesn't refetch on every click;
 * Cancel or Escape leaves the report as it was.
 */
export function RangeComparePicker({
  state,
  compact,
  noComparison = false,
}: {
  state: ReportFilterState;
  compact: boolean;
  noComparison?: boolean;
}) {
  const { filters, range, label, setFilters } = state;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<RangeDraft>(() => draftFromFilters(filters));
  // Pinned while the popover is open, like the filters' own "now".
  const [now, setNow] = useState(() => new Date());
  const summary = draftSummary(draft, now);
  const lastDay = new Date(summary.range.to.getFullYear(), summary.range.to.getMonth(), summary.range.to.getDate() - 1);
  const comparing = !noComparison && draft.compare !== 'none';
  const current = noComparison ? null : comparisonDates(range, filters.compare);
  const changed = draftChanged(noComparison ? { ...draft, compare: filters.compare } : draft, filters, now);
  // Switching comparison on brings back the kind the report had (a last-year link stays last year), else the previous period.
  const compareKind = filters.compare === 'none' ? 'previous' : filters.compare;

  const apply = () => {
    const next = draftFilters(draft);
    setFilters(noComparison ? { ...next, compare: filters.compare } : next);
    setOpen(false);
  };

  // The quick ranges, plus the draft's own if it isn't one of them: custom days (named by their dates) or an older preset.
  const options = PRESETS.filter((preset) => QUICK.has(preset.value) || preset.value === draft.preset).map((preset) => ({
    value: preset.value as string,
    label: preset.label,
  }));
  if (draft.preset === 'custom') options.push({ value: 'custom', label: summary.dates });

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Each opening starts from what the report shows; closing without Apply discards the draft.
        if (next) {
          setDraft(draftFromFilters(filters));
          setNow(new Date());
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-9 min-w-0 shrink-0 justify-between gap-2 px-3"
          aria-label={`Dates: ${label}, ${rangeDates(range)}${current ? `, compared ${current}` : ''}. Change`}
          title={`${rangeDates(range)}${current ? ` ${current}` : ''}`}
        >
          <CalendarDays size={15} className="text-muted-foreground" aria-hidden="true" />
          <span className="font-semibold">{label}</span>
          {current && (
            <span className={cn('truncate font-normal tabular-nums text-muted-foreground', compact && 'hidden lg:inline')}>{current}</span>
          )}
          <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align={compact ? 'end' : 'start'}
        // Open without jumping focus into the range dropdown (it would show a focus ring nobody asked for); Tab reaches it.
        onOpenAutoFocus={(event) => event.preventDefault()}
        // As wide as the calendar (7 × 2.75rem + padding), never taller than the space there is: the body scrolls, the Apply row stays put.
        className="flex max-h-[var(--radix-popover-content-available-height)] w-[21.5rem] max-w-[calc(100vw-1.5rem)] flex-col p-0"
      >
        <div className="min-h-0 overflow-y-auto p-4">
          <Select
            value={draft.preset}
            onValueChange={(value) => {
              if (value !== 'custom') setDraft((current) => pickPreset(current, value as Exclude<RangePreset, 'custom'>));
            }}
            options={options}
            ariaLabel="Date range"
            icon={<CalendarDays size={15} />}
            className="w-full"
          />

          <Calendar
            mode="range"
            numberOfMonths={1}
            className="mt-3 [--cell-size:--spacing(11)]"
            defaultMonth={new Date(lastDay.getFullYear(), lastDay.getMonth(), 1)}
            selected={{ from: summary.range.from, to: lastDay }}
            onSelect={(picked, day) => {
              // A click after a whole range starts a new one, rather than stretching the old.
              if (draft.preset !== 'custom' || draft.from !== draft.to) setDraft((current) => pickDays(current, day));
              else if (picked?.from) setDraft((current) => pickDays(current, picked.from!, picked.to));
            }}
            disabled={{ after: now }}
            endMonth={now}
          />
        </div>

        {/* The footer is as wide as the calendar: the switch on its own row, the actions beneath. */}
        <div className="shrink-0 space-y-3 border-t border-rule/50 px-4 py-3">
          {!noComparison && (
            <div className="flex items-center gap-2.5 text-sm text-foreground">
              <Switch
                label={`Compare to ${COMPARE_LABEL[compareKind].toLowerCase()}`}
                checked={comparing}
                onChange={(on) => setDraft((current) => setCompare(current, on ? compareKind : 'none'))}
              />
              <span aria-hidden="true">Compare to {COMPARE_LABEL[compareKind].toLowerCase()}</span>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" disabled={!changed} onClick={apply}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
