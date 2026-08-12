'use client';

import { Popover } from 'radix-ui';
import { type ReactNode, useEffect, useState } from 'react';

import { Gift, Loader2, Search, SlidersHorizontal, X } from '@/components/icons';
import { FilterChip } from '@/components/shared/FilterChip';
import { SegmentedControl, type SegmentedOption } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select } from '@/components/ui/select';

import { TIER_FILTERS } from '@/lib/constants/customers';
import { DIETARY_PREFERENCES, FSA_ALLERGENS } from '@/types/customers';
import type { Allergen, CustomerFilters, DietaryPreference } from '@/types/customers';
import type { ListView as ListViewMode } from '@/stores/uiSettingsStore';

/**
 * The customer list's controls, in one row.
 *
 * This bar used to be a four-tier card — search, a quick-filter strip, an
 * expandable grid and a summary line — that pushed the first customer a screen
 * down the page. It now works the way the orders and audit-log toolbars do: the
 * three questions asked daily stay as controls, everything else lives behind
 * "More filters", and the filters that are actually *on* come back as removable
 * chips underneath. Hiding a control is safe; hiding a filter is not.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
] as const;

/** Presets rather than a free number field: nobody segments on "lapsed 47 days". */
const LAPSED_PRESETS = [30, 60, 90, 180, 365] as const;

/**
 * "Last visit" is one control covering two filter keys. `neverVisited` and
 * `lapsedDays` are mutually exclusive questions about the same fact, and asking
 * them as two separate widgets let a user select a contradiction.
 */
const NEVER = 'never';

const LAST_VISIT_OPTIONS = [
  { value: 'off', label: 'Any last visit' },
  ...LAPSED_PRESETS.map((days) => ({ value: String(days), label: `Not seen in ${days} days` })),
  { value: NEVER, label: 'Never visited' },
];

const MARKETING_OPTIONS = [
  { value: 'off', label: 'Any marketing' },
  { value: 'opted_in', label: 'Can be emailed' },
  { value: 'opted_out', label: 'Opted out' },
];

/** `gluten_free` → `Gluten free`. The API's slugs are not reading material. */
const labelFor = (slug: string) => {
  const words = slug.replaceAll('_', ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const ALLERGEN_OPTIONS = FSA_ALLERGENS.map((allergen) => ({ value: allergen, label: labelFor(allergen) }));
const DIETARY_OPTIONS = DIETARY_PREFERENCES.map((preference) => ({ value: preference, label: labelFor(preference) }));

const optionLabel = (options: { value: string; label: string }[], value: string) =>
  options.find((option) => option.value === value)?.label ?? value;

interface Props {
  filters: CustomerFilters;
  onChange: (next: CustomerFilters | ((current: CustomerFilters) => CustomerFilters)) => void;
  onClear: () => void;
  view: ListViewMode;
  onViewChange: (next: ListViewMode) => void;
  viewOptions: SegmentedOption<ListViewMode>[];
  /** The segment control, rendered inline so segments and filters share one row. */
  segments?: ReactNode;
  /** Total matching this query, from the server. */
  total: number;
  /** Reachable by email — only known while a segment is applied. */
  emailReachable?: number;
  isLoading?: boolean;
  isFetching?: boolean;
  /** Filter keys a saved segment carries that no longer mean anything. */
  staleFilters?: string[];
  onDropSegment?: () => void;
}

export function CustomerFilterBar({
  filters,
  onChange,
  onClear,
  view,
  onViewChange,
  viewOptions,
  segments,
  total,
  emailReachable,
  isLoading,
  isFetching,
  staleFilters,
  onDropSegment,
}: Props) {
  // The search box is local state debounced into the URL — writing every
  // keystroke straight to the query string would refetch on each letter.
  const [search, setSearch] = useState(filters.search ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(false);

  // Keep the box in step when filters change from elsewhere (applying a segment,
  // Clear, the browser Back button) without fighting the user's typing.
  useEffect(() => {
    setSearch(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    if ((filters.search ?? '') === search) return;
    const id = setTimeout(() => onChange((current) => ({ ...current, search: search || undefined })), 300);
    return () => clearTimeout(id);
    // `onChange` is stable via useCallback upstream; including filters.search
    // here would cancel the pending write as soon as it lands.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const set = <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) =>
    onChange((current) => ({ ...current, [key]: value }));

  const lastVisit = filters.neverVisited ? NEVER : filters.lapsedDays ? String(filters.lapsedDays) : 'off';

  const setLastVisit = (value: string) =>
    onChange((current) => ({
      ...current,
      neverVisited: value === NEVER ? true : undefined,
      lapsedDays: value === 'off' || value === NEVER ? undefined : Number(value),
    }));

  const clearLastVisit = () => onChange((current) => ({ ...current, neverVisited: undefined, lapsedDays: undefined }));

  const spendLabel =
    filters.minTotalSpent !== undefined && filters.maxTotalSpent !== undefined
      ? `£${filters.minTotalSpent}–£${filters.maxTotalSpent}`
      : filters.minTotalSpent !== undefined
        ? `over £${filters.minTotalSpent}`
        : `under £${filters.maxTotalSpent}`;

  const visitsLabel =
    filters.minTotalVisits !== undefined && filters.maxTotalVisits !== undefined
      ? `${filters.minTotalVisits}–${filters.maxTotalVisits}`
      : filters.minTotalVisits !== undefined
        ? `${filters.minTotalVisits} or more`
        : `${filters.maxTotalVisits} or fewer`;

  // Only what the popover hides is counted — a badge that also counted the
  // controls on show would read as unexplained.
  const advancedCount = [
    filters.birthdayMonth,
    filters.marketing,
    filters.minTotalSpent ?? filters.maxTotalSpent,
    filters.minTotalVisits ?? filters.maxTotalVisits,
    filters.allergies?.length,
    filters.dietary?.length,
    filters.activeWithinDays,
  ].filter((value) => value !== undefined && value !== 0).length;

  const hasChips =
    Boolean(filters.search) ||
    Boolean(filters.tier) ||
    lastVisit !== 'off' ||
    advancedCount > 0 ||
    Boolean(staleFilters?.length);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1 lg:max-w-xs">
          <Input
            leftIcon={<Search size={14} />}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or phone…"
            aria-label="Search customers by name, email or phone"
            className="bg-background border-rule"
            rightAction={
              search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear search"
                  className="flex size-6 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : undefined
            }
          />
        </div>

        <Select
          value={filters.tier ?? 'all'}
          onValueChange={(value) => set('tier', value === 'all' ? undefined : (value as CustomerFilters['tier']))}
          options={TIER_FILTERS.map((tier) => ({ value: tier.value, label: tier.value === 'all' ? 'All tiers' : tier.label }))}
          ariaLabel="Filter customers by loyalty tier"
          className="w-[calc(50%-0.25rem)] sm:w-32"
        />

        <Select
          value={lastVisit}
          onValueChange={setLastVisit}
          options={LAST_VISIT_OPTIONS}
          ariaLabel="Filter by how long since the last visit"
          className="w-[calc(50%-0.25rem)] sm:w-44"
        />

        {segments}

        <Popover.Root open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Popover.Trigger asChild>
            <Button variant="outline" className="w-[calc(50%-0.25rem)] sm:w-auto" aria-label="Open more customer filters">
              <SlidersHorizontal data-icon="inline-start" />
              More filters
              {advancedCount > 0 && (
                <span className="ml-0.5 flex size-5 items-center justify-center rounded-full bg-primary text-micro font-semibold text-primary-foreground">
                  {advancedCount}
                </span>
              )}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Content
              align="end"
              sideOffset={8}
              collisionPadding={16}
              className="z-90 w-[calc(100vw-2rem)] max-w-md overflow-y-auto rounded-sm border border-rule bg-surface p-4 shadow-xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95 max-h-[min(32rem,var(--radix-popover-content-available-height))]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-foreground">More filters</h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">Narrow by birthday, marketing consent, value or guest safety.</p>
                </div>
                <Popover.Close asChild>
                  <button
                    type="button"
                    aria-label="Close filters"
                    className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </Popover.Close>
              </div>

              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Birthday</label>
                    <Select
                      value={filters.birthdayMonth ? String(filters.birthdayMonth) : 'off'}
                      onValueChange={(value) => set('birthdayMonth', value === 'off' ? undefined : Number(value))}
                      options={[
                        { value: 'off', label: 'Any month' },
                        ...MONTHS.map((month, index) => ({ value: String(index + 1), label: month })),
                      ]}
                      ariaLabel="Filter by birthday month"
                      icon={<Gift />}
                      className="w-full"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Marketing</label>
                    <Select
                      value={filters.marketing ?? 'off'}
                      onValueChange={(value) => set('marketing', value === 'off' ? undefined : (value as CustomerFilters['marketing']))}
                      options={MARKETING_OPTIONS}
                      ariaLabel="Filter by marketing consent"
                      className="w-full"
                    />
                  </div>
                </div>

                <fieldset className="min-w-0">
                  <legend className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Lifetime spend (£)</legend>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={filters.minTotalSpent ?? ''}
                      onChange={(event) => set('minTotalSpent', event.target.value === '' ? undefined : Number(event.target.value))}
                      placeholder="Min"
                      aria-label="Minimum lifetime spend"
                      className="bg-background border-rule"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="number"
                      min={0}
                      value={filters.maxTotalSpent ?? ''}
                      onChange={(event) => set('maxTotalSpent', event.target.value === '' ? undefined : Number(event.target.value))}
                      placeholder="Max"
                      aria-label="Maximum lifetime spend"
                      className="bg-background border-rule"
                    />
                  </div>
                </fieldset>

                <fieldset className="min-w-0">
                  <legend className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Visits</legend>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={filters.minTotalVisits ?? ''}
                      onChange={(event) => set('minTotalVisits', event.target.value === '' ? undefined : Number(event.target.value))}
                      placeholder="Min"
                      aria-label="Minimum visits"
                      className="bg-background border-rule"
                    />
                    <span className="text-xs text-muted-foreground">to</span>
                    <Input
                      type="number"
                      min={0}
                      value={filters.maxTotalVisits ?? ''}
                      onChange={(event) => set('maxTotalVisits', event.target.value === '' ? undefined : Number(event.target.value))}
                      placeholder="Max"
                      aria-label="Maximum visits"
                      className="bg-background border-rule"
                    />
                  </div>
                </fieldset>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <label className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Allergies</label>
                    <MultiSelect
                      value={filters.allergies ?? []}
                      onChange={(next) => set('allergies', next.length > 0 ? (next as Allergen[]) : undefined)}
                      options={ALLERGEN_OPTIONS}
                      placeholder="Any allergy"
                      ariaLabel="Filter by allergy — matches any selected"
                      className="w-full"
                    />
                  </div>

                  <div className="min-w-0 space-y-1.5">
                    <label className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Dietary</label>
                    <MultiSelect
                      value={filters.dietary ?? []}
                      onChange={(next) => set('dietary', next.length > 0 ? (next as DietaryPreference[]) : undefined)}
                      options={DIETARY_OPTIONS}
                      placeholder="Any dietary need"
                      ariaLabel="Filter by dietary preference — matches any selected"
                      className="w-full"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Allergies and dietary needs match <strong className="font-semibold text-foreground">any</strong> of the options you
                  pick, not all of them.
                </p>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        <SegmentedControl options={viewOptions} value={view} onChange={onViewChange} iconOnly ariaLabel="Customer list layout" />

        {/* The one canonical count on this page. The table footer carries paging
            only, so a manager never has two numbers to reconcile. */}
        <span
          className="ml-auto flex min-w-28 items-center justify-end gap-1.5 text-xs tabular-nums text-muted-foreground"
          aria-live="polite"
        >
          {isFetching && !isLoading && <Loader2 size={12} className="animate-spin" aria-label="Updating customers" />}
          {isLoading ? 'Loading…' : `${total.toLocaleString()} customer${total === 1 ? '' : 's'}`}
          {emailReachable !== undefined && !isLoading && (
            <span className="hidden sm:inline">· {emailReachable.toLocaleString()} emailable</span>
          )}
        </span>
      </div>

      {hasChips && (
        <div className="flex flex-wrap items-center gap-1.5" aria-label="Active filters">
          {filters.search && <FilterChip label={`Search: ${filters.search}`} onRemove={() => setSearch('')} />}
          {filters.tier && (
            <FilterChip label={`Tier: ${optionLabel([...TIER_FILTERS], filters.tier)}`} onRemove={() => set('tier', undefined)} />
          )}
          {lastVisit !== 'off' && (
            <FilterChip label={optionLabel(LAST_VISIT_OPTIONS, lastVisit)} onRemove={clearLastVisit} />
          )}
          {filters.birthdayMonth !== undefined && (
            <FilterChip
              label={`Birthday in ${MONTHS[filters.birthdayMonth - 1]}`}
              onRemove={() => set('birthdayMonth', undefined)}
            />
          )}
          {filters.marketing && (
            <FilterChip label={optionLabel(MARKETING_OPTIONS, filters.marketing)} onRemove={() => set('marketing', undefined)} />
          )}
          {(filters.minTotalSpent !== undefined || filters.maxTotalSpent !== undefined) && (
            <FilterChip
              label={`Spend: ${spendLabel}`}
              onRemove={() => onChange((current) => ({ ...current, minTotalSpent: undefined, maxTotalSpent: undefined }))}
            />
          )}
          {(filters.minTotalVisits !== undefined || filters.maxTotalVisits !== undefined) && (
            <FilterChip
              label={`Visits: ${visitsLabel}`}
              onRemove={() => onChange((current) => ({ ...current, minTotalVisits: undefined, maxTotalVisits: undefined }))}
            />
          )}
          {Boolean(filters.allergies?.length) && (
            <FilterChip
              label={`Allergies: ${filters.allergies!.map(labelFor).join(', ')}`}
              onRemove={() => set('allergies', undefined)}
            />
          )}
          {Boolean(filters.dietary?.length) && (
            <FilterChip label={`Dietary: ${filters.dietary!.map(labelFor).join(', ')}`} onRemove={() => set('dietary', undefined)} />
          )}

          {/* A segment saved under an older filter vocabulary silently selecting
              the wrong people is worse than saying so. */}
          {staleFilters && staleFilters.length > 0 && (
            <span
              className="inline-flex h-7 items-center gap-1.5 rounded-full border border-warning/25 bg-warning/8 px-2.5 text-xs font-medium text-warning"
              title={`These filters no longer apply and were ignored: ${staleFilters.join(', ')}`}
            >
              {staleFilters.length} filter{staleFilters.length === 1 ? '' : 's'} out of date
              {onDropSegment && (
                <button
                  type="button"
                  onClick={onDropSegment}
                  aria-label="Stop using this segment"
                  className="flex size-5 items-center justify-center rounded-full hover:bg-warning/15"
                >
                  <X size={11} aria-hidden="true" />
                </button>
              )}
            </span>
          )}

          <button
            type="button"
            onClick={onClear}
            className="ml-1 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
