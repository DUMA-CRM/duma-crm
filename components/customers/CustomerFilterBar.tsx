'use client';

import { Popover } from 'radix-ui';
import { type ReactNode, useEffect, useState } from 'react';

import { Gift, Loader2, Search, SlidersHorizontal, X } from '@/components/icons';
import { FilterChip } from '@/components/shared/FilterChip';
import { useCurrencySymbol } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL_CLASS } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { TIER_FILTERS } from '@/lib/constants/customers';
import { cn } from '@/lib/utils/cn';
import { DIETARY_PREFERENCES, FSA_ALLERGENS } from '@/types/customers';
import type { Allergen, CustomerFilters, DietaryPreference } from '@/types/customers';

/**
 * The customer list's controls, in one row.
 *
 * Search, saved segments and one Filters button — Square's customer directory
 * has the same three. The everyday questions (can they be emailed, whose
 * birthday, who has lapsed) are the quick-view tabs above, so nothing else
 * needs to sit in the row. The filters that are actually *on* come back as
 * removable chips underneath. Hiding a control is safe; hiding a filter is not.
 */

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
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

/**
 * Allergy and dietary filters pick one, like every other select in the panel.
 * A saved segment or an old link can still carry several; the select then
 * names how many rather than pretending one was picked, and the chip removes them.
 */
const MANY = 'many';
const pickedOne = (values: string[] | undefined) => (!values?.length ? 'off' : values.length === 1 ? values[0]! : MANY);
const oneOf = (values: string[] | undefined, any: string, options: { value: string; label: string }[]) => [
  { value: 'off', label: any },
  ...((values?.length ?? 0) > 1 ? [{ value: MANY, label: `${values!.length} chosen` }] : []),
  ...options,
];

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>{label}</p>
      {children}
    </div>
  );
}

interface Props {
  filters: CustomerFilters;
  onChange: (next: CustomerFilters | ((current: CustomerFilters) => CustomerFilters)) => void;
  onClear: () => void;
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
  segments,
  total,
  emailReachable,
  isLoading,
  isFetching,
  staleFilters,
  onDropSegment,
}: Props) {
  const symbol = useCurrencySymbol();
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

  const set = <K extends keyof CustomerFilters>(key: K, value: CustomerFilters[K]) => onChange((current) => ({ ...current, [key]: value }));

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
      ? `${symbol}${filters.minTotalSpent}–${symbol}${filters.maxTotalSpent}`
      : filters.minTotalSpent !== undefined
        ? `over ${symbol}${filters.minTotalSpent}`
        : `under ${symbol}${filters.maxTotalSpent}`;

  const visitsLabel =
    filters.minTotalVisits !== undefined && filters.maxTotalVisits !== undefined
      ? `${filters.minTotalVisits}–${filters.maxTotalVisits}`
      : filters.minTotalVisits !== undefined
        ? `${filters.minTotalVisits} or more`
        : `${filters.maxTotalVisits} or fewer`;

  // What the popover holds and is on.
  const advancedCount = [
    filters.tier,
    lastVisit === 'off' ? undefined : lastVisit,
    filters.birthdayMonth,
    filters.marketing,
    filters.minTotalSpent ?? filters.maxTotalSpent,
    filters.minTotalVisits ?? filters.maxTotalVisits,
    filters.allergies?.length,
    filters.dietary?.length,
    filters.activeWithinDays,
  ].filter((value) => value !== undefined && value !== 0).length;

  const hasChips = Boolean(filters.search) || advancedCount > 0 || Boolean(staleFilters?.length);

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 basis-full sm:min-w-56 sm:basis-auto sm:flex-1">
          <Input
            leftIcon={<Search size={14} />}
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name, email or phone…"
            aria-label="Search customers by name, email or phone"
            className="border-rule"
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

        {segments}

        <Popover.Root open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <Popover.Trigger asChild>
            <Button variant="outline" className="w-[calc(50%-0.25rem)] sm:w-auto" aria-label="Open customer filters">
              <SlidersHorizontal data-icon="inline-start" />
              Filters
              {advancedCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-sm bg-heading px-1 text-micro font-semibold tabular-nums text-background">
                  {advancedCount}
                </span>
              )}
            </Button>
          </Popover.Trigger>
          <Popover.Portal>
            {/* The Orders page's filter panel: one plain select per row, on a card. */}
            <Popover.Content
              align="end"
              sideOffset={8}
              collisionPadding={16}
              className="z-90 w-[calc(100vw-2rem)] max-w-sm overflow-y-auto rounded-lg border border-border bg-card p-4 shadow-lg outline-none max-h-[var(--radix-popover-content-available-height)]"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <h2 className="text-sm font-semibold text-heading">Filters</h2>
                <Popover.Close asChild>
                  <Button variant="ghost" size="icon" aria-label="Close filters">
                    <X />
                  </Button>
                </Popover.Close>
              </div>

              <div className="space-y-4">
                <FilterField label="Tier">
                  <Select
                    value={filters.tier ?? 'all'}
                    onValueChange={(value) => set('tier', value === 'all' ? undefined : (value as CustomerFilters['tier']))}
                    options={TIER_FILTERS.map((tier) => ({ value: tier.value, label: tier.value === 'all' ? 'Any tier' : tier.label }))}
                    ariaLabel="Filter customers by loyalty tier"
                    className="w-full"
                  />
                </FilterField>

                <FilterField label="Last visit">
                  <Select
                    value={lastVisit}
                    onValueChange={setLastVisit}
                    options={LAST_VISIT_OPTIONS}
                    ariaLabel="Filter by how long since the last visit"
                    className="w-full"
                  />
                </FilterField>

                <FilterField label="Birthday">
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
                </FilterField>

                <FilterField label="Marketing">
                  <Select
                    value={filters.marketing ?? 'off'}
                    onValueChange={(value) => set('marketing', value === 'off' ? undefined : (value as CustomerFilters['marketing']))}
                    options={MARKETING_OPTIONS}
                    ariaLabel="Filter by marketing consent"
                    className="w-full"
                  />
                </FilterField>

                <FilterField label={`Lifetime spend (${symbol})`}>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={filters.minTotalSpent ?? ''}
                      onChange={(event) => set('minTotalSpent', event.target.value === '' ? undefined : Number(event.target.value))}
                      placeholder="Min"
                      aria-label="Minimum lifetime spend"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={filters.maxTotalSpent ?? ''}
                      onChange={(event) => set('maxTotalSpent', event.target.value === '' ? undefined : Number(event.target.value))}
                      placeholder="Max"
                      aria-label="Maximum lifetime spend"
                    />
                  </div>
                </FilterField>

                <FilterField label="Visits">
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      type="number"
                      min={0}
                      value={filters.minTotalVisits ?? ''}
                      onChange={(event) => set('minTotalVisits', event.target.value === '' ? undefined : Number(event.target.value))}
                      placeholder="Min"
                      aria-label="Minimum visits"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={filters.maxTotalVisits ?? ''}
                      onChange={(event) => set('maxTotalVisits', event.target.value === '' ? undefined : Number(event.target.value))}
                      placeholder="Max"
                      aria-label="Maximum visits"
                    />
                  </div>
                </FilterField>

                <FilterField label="Allergy">
                  <Select
                    value={pickedOne(filters.allergies)}
                    onValueChange={(value) => value !== MANY && set('allergies', value === 'off' ? undefined : [value as Allergen])}
                    options={oneOf(filters.allergies, 'Any allergy', ALLERGEN_OPTIONS)}
                    ariaLabel="Filter by allergy"
                    className="w-full"
                  />
                </FilterField>

                <FilterField label="Dietary">
                  <Select
                    value={pickedOne(filters.dietary)}
                    onValueChange={(value) => value !== MANY && set('dietary', value === 'off' ? undefined : [value as DietaryPreference])}
                    options={oneOf(filters.dietary, 'Any dietary need', DIETARY_OPTIONS)}
                    ariaLabel="Filter by dietary preference"
                    className="w-full"
                  />
                </FilterField>
              </div>
            </Popover.Content>
          </Popover.Portal>
        </Popover.Root>

        {/* How many customers the list holds right now — always shown, so the
            number sits beside the filters that produced it. */}
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
          {filters.search && <FilterChip variant="tag" label={`Search: ${filters.search}`} onRemove={() => setSearch('')} />}
          {filters.tier && (
            <FilterChip
              variant="tag"
              label={`Tier: ${optionLabel([...TIER_FILTERS], filters.tier)}`}
              onRemove={() => set('tier', undefined)}
            />
          )}
          {lastVisit !== 'off' && <FilterChip variant="tag" label={optionLabel(LAST_VISIT_OPTIONS, lastVisit)} onRemove={clearLastVisit} />}
          {filters.birthdayMonth !== undefined && (
            <FilterChip
              variant="tag"
              label={`Birthday in ${MONTHS[filters.birthdayMonth - 1]}`}
              onRemove={() => set('birthdayMonth', undefined)}
            />
          )}
          {filters.marketing && (
            <FilterChip
              variant="tag"
              label={optionLabel(MARKETING_OPTIONS, filters.marketing)}
              onRemove={() => set('marketing', undefined)}
            />
          )}
          {(filters.minTotalSpent !== undefined || filters.maxTotalSpent !== undefined) && (
            <FilterChip
              variant="tag"
              label={`Spend: ${spendLabel}`}
              onRemove={() => onChange((current) => ({ ...current, minTotalSpent: undefined, maxTotalSpent: undefined }))}
            />
          )}
          {(filters.minTotalVisits !== undefined || filters.maxTotalVisits !== undefined) && (
            <FilterChip
              variant="tag"
              label={`Visits: ${visitsLabel}`}
              onRemove={() => onChange((current) => ({ ...current, minTotalVisits: undefined, maxTotalVisits: undefined }))}
            />
          )}
          {Boolean(filters.allergies?.length) && (
            <FilterChip
              variant="tag"
              label={`Allergies: ${filters.allergies!.map(labelFor).join(', ')}`}
              onRemove={() => set('allergies', undefined)}
            />
          )}
          {Boolean(filters.dietary?.length) && (
            <FilterChip
              variant="tag"
              label={`Dietary: ${filters.dietary!.map(labelFor).join(', ')}`}
              onRemove={() => set('dietary', undefined)}
            />
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

          <button type="button" onClick={onClear} className="ml-1 h-7 px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            Clear all
          </button>
        </div>
      )}
    </div>
  );
}
