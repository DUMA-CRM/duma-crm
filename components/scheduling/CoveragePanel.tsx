'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { NumberWheelPicker } from '@/components/ui/number-wheel-picker';
import { AlertTriangle, CheckCircle2, SlidersHorizontal, TrendingUp } from '@/components/icons';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type ScheduledShift, getCoverage, isWeekdayRow } from '@/lib/modules/workforce/client';
import { cn } from '@/lib/utils/cn';
import { coverageForDay } from '@/lib/utils/coverage-check';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const DEFAULTS = { lookbackDays: 30, ordersPerStaff: 15, minStaff: 1 };
const hourLabel = (hour: number) => `${String(hour).padStart(2, '0')}:00`;
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'short' });
const WEEKDAY_LONG = new Intl.DateTimeFormat('en-GB', { weekday: 'long' });

const parseDay = (key: string) => {
  const [year, month, date] = key.split('-').map(Number);
  return new Date(year, month - 1, date);
};

/**
 * Cover vs demand, for one day of the rota: how many people are planned each
 * hour against how many the recent order history says the hour needs. The
 * demand comes from `GET /scheduled-shifts/coverage`; the headcount from the
 * rota rows already on this page (`lib/utils/coverage-check.ts` joins them).
 */
export function CoveragePanel({ shifts, days, todayKey }: { shifts: ScheduledShift[]; days: string[]; todayKey: string }) {
  const { locationId } = useWorkspaceStore();
  const reduceMotion = useReducedMotion();
  const [picked, setPicked] = useState<string | null>(null);
  const [tuning, setTuning] = useState(false);
  const [lookbackDays, setLookbackDays] = useState(DEFAULTS.lookbackDays);
  const [ordersPerStaff, setOrdersPerStaff] = useState(DEFAULTS.ordersPerStaff);
  const [minStaff, setMinStaff] = useState(DEFAULTS.minStaff);

  // Today when it is in view, else the first day of the period.
  const dayKey = picked && days.includes(picked) ? picked : days.includes(todayKey) ? todayKey : days[0];
  const day = dayKey ? parseDay(dayKey) : null;

  const demand = useQuery({
    queryKey: moduleQueryKeys.workforce.key('coverage', locationId, lookbackDays, ordersPerStaff, minStaff, true),
    queryFn: () => getCoverage({ locationId: locationId!, lookbackDays, ordersPerStaff, minStaff, byWeekday: true }),
    enabled: !!locationId,
  });

  const result = useMemo(() => {
    if (!day || !demand.data) return null;
    const weekday = day.getDay();
    const rows = demand.data.coverage.filter((row) => isWeekdayRow(row) && row.weekday === weekday);
    return coverageForDay(rows, shifts, day);
  }, [day, demand.data, shifts]);

  const scale = Math.max(1, ...(result?.hours ?? []).flatMap((row) => [row.needed, row.rostered]));
  const shortHours = result?.short.reduce((sum, run) => sum + (run.to - run.from), 0) ?? 0;

  if (!locationId || !day) return null;

  return (
    <section className="overflow-hidden rounded-lg border border-rule/60 bg-field" aria-labelledby="cover-vs-demand">
      <header className="flex flex-wrap items-center gap-3 px-5 py-4">
        <span
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-md',
            shortHours > 0 ? 'bg-exception/8 text-exception' : 'bg-primary/8 text-primary',
          )}
        >
          {shortHours > 0 ? <AlertTriangle size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 id="cover-vs-demand" className="text-base font-semibold tracking-title text-foreground">
            Cover vs demand
          </h3>
          <p className="text-xs text-muted-foreground">
            {demand.isPending
              ? 'Reading recent orders…'
              : demand.isError
                ? 'Order history couldn’t be loaded.'
                : !result || result.hours.length === 0
                  ? `No orders or shifts on ${WEEKDAY_LONG.format(day)}s to compare yet.`
                  : shortHours > 0
                    ? result.short.map((run) => `Short by ${run.by} ${hourLabel(run.from)}–${hourLabel(run.to)}`).join(' · ')
                    : `Covered all day${result.peak ? ` · busiest at ${hourLabel(result.peak.hour)}` : ''}`}
          </p>
        </div>
        {days.length > 1 && (
          <SegmentedControl
            options={days.map((key) => ({ value: key, label: key === todayKey ? 'Today' : WEEKDAY.format(parseDay(key)) }))}
            value={dayKey}
            onChange={setPicked}
            ariaLabel="Day to check"
          />
        )}
        <Button
          variant="ghost"
          size="icon"
          aria-label="Adjust how demand is worked out"
          aria-pressed={tuning}
          title="Adjust"
          onClick={() => setTuning((value) => !value)}
        >
          <SlidersHorizontal size={16} />
        </Button>
      </header>

      {tuning && (
        <div className="flex flex-wrap items-end gap-4 border-t border-rule/50 bg-background/40 px-5 py-3.5">
          <NumberSetting label="Look back" unit="days" value={lookbackDays} min={7} max={365} onChange={setLookbackDays} />
          <NumberSetting
            label="One person per"
            unit="orders an hour"
            value={ordersPerStaff}
            min={1}
            max={200}
            onChange={setOrdersPerStaff}
          />
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-foreground">At least</span>
            <span className="flex items-center gap-2">
              <div className="w-32">
                <NumberWheelPicker
                  aria-label="At least this many on while open"
                  value={minStaff}
                  onValueChange={setMinStaff}
                  min={0}
                  max={20}
                  unit={(count) => (count === 1 ? 'person' : 'people')}
                />
              </div>
              <span className="text-xs text-muted-foreground">on while open</span>
            </span>
          </div>
          <button
            type="button"
            className="h-9 text-xs font-semibold text-muted-foreground hover:text-foreground"
            onClick={() => {
              setLookbackDays(DEFAULTS.lookbackDays);
              setOrdersPerStaff(DEFAULTS.ordersPerStaff);
              setMinStaff(DEFAULTS.minStaff);
            }}
          >
            Reset
          </button>
        </div>
      )}

      <div className="border-t border-rule/50 px-5 pt-4 pb-3">
        {demand.isPending ? (
          // The chart's own frame: a column per hour (count above, hour below), then the legend.
          <div role="status" aria-busy="true" aria-label="Checking coverage">
            <div className="flex items-end gap-1" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => (
                <div key={index} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                  <Bone className="h-3 w-6 max-w-full" />
                  <Bone className="h-32 w-full rounded-sm" />
                  <Bone className="h-2.5 w-4 max-w-full" />
                </div>
              ))}
            </div>
            <Bone className="mt-3 h-3 w-64 max-w-full" />
          </div>
        ) : !result || result.hours.length === 0 ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1 text-center">
            <TrendingUp size={20} className="text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">The check fills in once there are a few weeks of orders for this day.</p>
          </div>
        ) : (
          <>
            <div
              className="flex items-end gap-1"
              role="img"
              aria-label={`Rostered staff against the staff needed each hour on ${WEEKDAY_LONG.format(day)}`}
            >
              {result.hours.map((row, index) => {
                const short = row.gap < 0;
                // More on than the hour needs — including people on when no orders come in.
                const over = row.gap > 0;
                return (
                  <div key={row.hour} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                    <span className={cn('text-xs font-semibold', short ? 'text-exception' : 'text-muted-foreground')}>
                      {row.rostered}/{row.needed}
                    </span>
                    <div className="relative h-32 w-full rounded-sm bg-band/60">
                      <motion.div
                        className={cn(
                          'absolute inset-x-1 bottom-0 origin-bottom rounded-t-sm',
                          short ? 'bg-exception/70' : over ? 'bg-primary/35' : 'bg-primary',
                        )}
                        style={{ height: `${(row.rostered / scale) * 100}%` }}
                        initial={reduceMotion ? false : { scaleY: 0 }}
                        animate={{ scaleY: 1 }}
                        transition={{ duration: 0.5, delay: reduceMotion ? 0 : index * 0.025, ease: [0.16, 1, 0.3, 1] }}
                      />
                      {row.needed > 0 && (
                        // The hour's need, drawn over the bar: a bar below its line is short.
                        <span
                          aria-hidden="true"
                          className="absolute inset-x-0 border-t-2 border-dashed border-foreground/55"
                          style={{ bottom: `${(row.needed / scale) * 100}%` }}
                        />
                      )}
                    </div>
                    <span className="text-micro text-muted-foreground">{String(row.hour).padStart(2, '0')}</span>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-primary" aria-hidden="true" /> Rostered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-4 border-t-2 border-dashed border-foreground/55" aria-hidden="true" /> Needed
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-sm bg-exception/70" aria-hidden="true" /> Short
              </span>
              <span className="ml-auto">
                From the last {lookbackDays} days of orders · one person per {ordersPerStaff} an hour
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function NumberSetting({
  label,
  unit,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(event) => {
            const next = Number(event.target.value);
            if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, Math.round(next))));
          }}
          className="h-9 w-20 rounded-md border border-input bg-control px-2.5 text-sm text-foreground outline-none focus-visible:border-ring"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </span>
    </label>
  );
}
