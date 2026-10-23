import {
  type CompareMode,
  type DateRange,
  type RangePreset,
  type ReportFilters,
  comparisonDates,
  rangeDates,
  resolveRange,
  toDateKey,
} from './report-filters.ts';

/**
 * The date-and-comparison picker's draft: what the reader is choosing in the
 * popover before Apply, so nothing on the page refetches while they click
 * about. Pure, so the rules — a preset clears custom days, picking days makes
 * the range custom, Apply only when something changes — are tested.
 */
export interface RangeDraft {
  preset: RangePreset;
  /** `YYYY-MM-DD`, custom ranges only. */
  from?: string;
  to?: string;
  compare: CompareMode;
}

export function draftFromFilters(filters: Pick<ReportFilters, 'preset' | 'from' | 'to' | 'compare'>): RangeDraft {
  return {
    preset: filters.preset,
    from: filters.from,
    to: filters.to,
    compare: filters.compare,
  };
}

export const pickPreset = (draft: RangeDraft, preset: Exclude<RangePreset, 'custom'>): RangeDraft => ({
  ...draft,
  preset,
  from: undefined,
  to: undefined,
});

/** Days from the calendar: always a custom range. While only the first is chosen, it's a single day. */
export function pickDays(draft: RangeDraft, from: Date, to?: Date): RangeDraft {
  const [first, last] = to && to < from ? [to, from] : [from, to ?? from];
  return { ...draft, preset: 'custom', from: toDateKey(first), to: toDateKey(last) };
}

export const setCompare = (draft: RangeDraft, compare: CompareMode): RangeDraft => ({ ...draft, compare });

export const draftRange = (draft: RangeDraft, now: Date): DateRange => resolveRange(draft, now);

/** What Apply will show: "17–18 Oct 2026" and "vs 15–16 Oct" (or null). */
export function draftSummary(draft: RangeDraft, now: Date) {
  const range = draftRange(draft, now);
  return { range, dates: rangeDates(range), comparison: comparisonDates(range, draft.compare) };
}

/** Whether Apply would change anything — the same days under another name count as the same. */
export function draftChanged(draft: RangeDraft, filters: Pick<ReportFilters, 'preset' | 'from' | 'to' | 'compare'>, now: Date) {
  if (draft.compare !== filters.compare) return true;
  if (draft.preset !== filters.preset) return true;
  if (draft.preset !== 'custom') return false;
  const a = draftRange(draft, now);
  const b = resolveRange(filters, now);
  return toDateKey(a.from) !== toDateKey(b.from) || toDateKey(a.to) !== toDateKey(b.to);
}

/** The filter change Apply makes. */
export const draftFilters = (draft: RangeDraft): Pick<ReportFilters, 'preset' | 'from' | 'to' | 'compare'> => ({
  preset: draft.preset,
  from: draft.preset === 'custom' ? draft.from : undefined,
  to: draft.preset === 'custom' ? draft.to : undefined,
  compare: draft.compare,
});
