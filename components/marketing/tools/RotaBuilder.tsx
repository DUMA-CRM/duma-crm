'use client';

import { useEffect, useId, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Pencil,
  Printer,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
  UserPlus,
} from '@/components/icons';
import { downloadRotaImage } from '@/components/marketing/tools/rota-image';
import { Drawer, DrawerHeaderButton } from '@/components/shared/Drawer';
import { buttonVariants } from '@/components/ui/button';

import { absoluteUrl } from '@/lib/marketing/site';
import { cn } from '@/lib/utils/cn';
import { CURRENCIES, currencySymbol } from '@/lib/utils/currencies';
import {
  DAYS_IN_WEEK,
  DEFAULT_RULES,
  type FirstDay,
  type RotaPerson,
  type RotaShift,
  type RotaSummary,
  type RotaWarning,
  SHIFT_PRESETS,
  type WorkingTimeRules,
  costPence,
  formatHours,
  formatRotaMoney,
  ratePence,
  rotaSummary,
  rotaWarnings,
  shiftSpan,
  shiftWeek,
  shortShift,
  weekDays,
  weekStartOf,
} from '@/lib/utils/rota-builder';

type Rota = {
  title: string;
  weekStart: string;
  sales: string;
  people: RotaPerson[];
  nextId: number;
  currency: string;
  firstDay: FirstDay;
  rules: WorkingTimeRules;
};
type Panel = { kind: 'shift'; personId: number; day: number } | { kind: 'person'; personId: number } | { kind: 'settings' } | null;

/** This device only — so a refresh keeps the week. Nothing is sent anywhere. */
const STORAGE_KEY = 'duma:tools:rota-builder:v1';

/** The week the server renders, before the visitor's own week is known. */
const EXAMPLE_START = '2026-11-09';

const open = { start: '07:00', end: '15:00', breakMinutes: 30 };
const mid = { start: '10:00', end: '18:00', breakMinutes: 30 };
const close = { start: '14:00', end: '22:00', breakMinutes: 30 };
const lunch = { start: '11:00', end: '15:00', breakMinutes: 0 };

const SETTINGS_DEFAULTS = { currency: 'GBP', firstDay: 1 as FirstDay, rules: DEFAULT_RULES };

/** A small café's week. Josh closes Friday and opens Saturday, so the rest rule has something to show. */
function exampleRota(weekStart: string, settings: Pick<Rota, 'currency' | 'firstDay' | 'rules'> = SETTINGS_DEFAULTS): Rota {
  const people: RotaPerson[] = [
    { id: 1, name: 'Amira', role: 'Manager', rate: '14.50', shifts: [open, open, null, open, open, mid, null] },
    { id: 2, name: 'Josh', role: 'Kitchen', rate: '12.60', shifts: [null, close, close, null, close, open, mid] },
    { id: 3, name: 'Lena', role: 'Barista', rate: '12.21', shifts: [mid, null, open, mid, null, close, open] },
    { id: 4, name: 'Sam', role: 'Barista', rate: '12.21', shifts: [lunch, lunch, mid, close, mid, null, close] },
  ];
  // The example is written Monday first; a Sunday-first week moves Sunday to the front.
  const ordered = settings.firstDay === 0 ? people.map((p) => ({ ...p, shifts: [p.shifts[6], ...p.shifts.slice(0, 6)] })) : people;
  return {
    title: 'The Corner Café',
    weekStart,
    sales: '9,500',
    nextId: 5,
    people: ordered,
    currency: settings.currency,
    firstDay: settings.firstDay,
    rules: settings.rules,
  };
}

const emptyWeek = (): (RotaShift | null)[] => Array<RotaShift | null>(DAYS_IN_WEEK).fill(null);

function localToday(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const thisWeek = (firstDay: FirstDay) => weekStartOf(localToday(), firstDay) ?? EXAMPLE_START;

/** A saved rota, if this device has one that still reads as a rota. Settings it predates take their defaults. */
function loadRota(): Rota | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as Partial<Rota>;
    if (!Array.isArray(saved.people) || typeof saved.weekStart !== 'string') return null;
    return { ...exampleRota(saved.weekStart), ...saved, rules: { ...DEFAULT_RULES, ...saved.rules } } as Rota;
  } catch {
    return null;
  }
}

function saveRota(rota: Rota) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rota));
  } catch {
    // Private windows and full storage: the rota still works, it just isn't kept.
  }
}

/** Role tones, written out in full so Tailwind sees every class. Index matches ROLE_HEX in rota-image.ts. */
const ROLE_CHIP = [
  'bg-success/12 text-success ring-success/25',
  'bg-reference/12 text-reference ring-reference/25',
  'bg-measured/12 text-measured ring-measured/25',
  'bg-stock/12 text-stock ring-stock/25',
  'bg-primary/12 text-primary ring-primary/25',
] as const;
const ROLE_DOT = ['bg-success', 'bg-reference', 'bg-measured', 'bg-stock', 'bg-primary'] as const;

/** Each role gets the next tone in order of first appearance; people with no role share the first. */
function roleTones(people: readonly RotaPerson[]): (person: RotaPerson) => number {
  const roles: string[] = [];
  for (const person of people) {
    const role = person.role.trim().toLowerCase();
    if (role && !roles.includes(role)) roles.push(role);
  }
  return (person) => Math.max(0, roles.indexOf(person.role.trim().toLowerCase())) % ROLE_CHIP.length;
}

const FIELD =
  'h-10 w-full rounded-lg border border-[var(--mkt-line)] bg-white px-3 text-[0.9375rem] text-foreground outline-none placeholder:text-[var(--mkt-ink-3)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 dark:bg-transparent';
/** Times and money: figures in the mono face, like the rest of the site's numbers. */
const NUMBER_FIELD = `${FIELD} tabular-nums`;
const LABEL = 'mb-1.5 block text-sm font-medium text-foreground';
const LABEL_SMALL = 'text-[11px] font-medium tracking-[0.06em] text-[var(--mkt-ink-3)] uppercase';
/** A drawer section's heading. */
const SECTION = 'mb-2.5 text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase';
/** A pill that can be pressed: break lengths, the week's first day. */
const CHIP =
  'h-9 rounded-full border px-3.5 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40';
const chipState = (on: boolean) =>
  on
    ? 'border-primary bg-primary text-primary-foreground'
    : 'border-[var(--mkt-line)] bg-white text-foreground hover:border-primary/40 dark:bg-transparent';

const sameShift = (a: RotaShift | null, b: RotaShift | null) =>
  !!a && !!b && a.start === b.start && a.end === b.end && a.breakMinutes === b.breakMinutes;

function warningText(
  warning: RotaWarning,
  rules: WorkingTimeRules,
  name: (id: number) => string,
  days: ReturnType<typeof weekDays>,
): string {
  switch (warning.kind) {
    case 'break':
      return `${name(warning.personId)}, ${days[warning.day].short}: a ${formatHours(warning.lengthMinutes)} shift needs at least a ${rules.minBreakMinutes}-minute break.`;
    case 'rest':
      return `${name(warning.personId)}, ${days[warning.day].short}: ${warning.restMinutes > 0 ? `only ${formatHours(warning.restMinutes)}` : 'no'} rest since ${days[warning.day - 1].short}’s shift — ${formatHours(rules.restMinutes ?? 0)} is the minimum.`;
    case 'weekly':
      return `${name(warning.personId)}: ${formatHours(warning.paidMinutes)} this week, over the ${formatHours(rules.weeklyMinutes ?? 0)} limit.`;
  }
}

/** "9 – 15 Nov 2026", or "28 Dec – 3 Jan 2027" across a month. */
function weekLabel(start: string): string {
  const days = weekDays(start);
  const year = shiftWeek(start, 1).slice(0, 4);
  const [firstDate, firstMonth] = days[0].date.split(' ');
  const lastMonth = days[6].date.split(' ')[1];
  return `${firstMonth === lastMonth ? firstDate : days[0].date} – ${days[6].date} ${year}`;
}

/**
 * The free rota builder — a client island on /tools/rota-builder. A toolbar
 * (name, week, settings, print, image) over the rota, drawn like the home
 * page's rota tile; a day opens the shift drawer, a name the person drawer.
 * Hours, cost and the working-time checks come from lib/utils/rota-builder.ts,
 * in any currency and against rules the visitor sets for their country. Prints
 * (or saves as PDF) through a print-only copy, and downloads as a PNG drawn by
 * rota-image.ts. Kept in this browser's storage; nothing leaves the device.
 */
export function RotaBuilder() {
  // The server, and the first client render, show the example week; after that the visitor's own.
  const client = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return <Builder key={client ? 'client' : 'server'} client={client} />;
}

function Builder({ client }: { client: boolean }) {
  const uid = useId();
  const [rota, setRota] = useState<Rota>(() => (client ? (loadRota() ?? exampleRota(thisWeek(1))) : exampleRota(EXAMPLE_START)));
  const [panel, setPanel] = useState<Panel>(null);
  const [imageState, setImageState] = useState<'idle' | 'working' | 'failed'>('idle');

  useEffect(() => {
    if (client) saveRota(rota);
  }, [client, rota]);

  const { people, currency, rules } = rota;
  const days = weekDays(rota.weekStart);
  const summary = rotaSummary(people, rota.sales);
  const warnings = rotaWarnings(people, rules);
  const toneOf = roleTones(people);
  const money = (minor: number) => formatRotaMoney(minor, currency);
  const nameOf = (id: number) => people.find((p) => p.id === id)?.name.trim() || 'Unnamed';
  const warnedCells = new Set(warnings.flatMap((w) => (w.kind === 'weekly' ? [] : [`${w.personId}:${w.day}`])));
  const checksOn = rules.breakAfterMinutes !== null || rules.restMinutes !== null || rules.weeklyMinutes !== null;
  const rulesAreDefault = JSON.stringify(rules) === JSON.stringify(DEFAULT_RULES);

  const update = (patch: Partial<Rota>) => setRota((current) => ({ ...current, ...patch }));
  const updatePerson = (id: number, patch: Partial<RotaPerson>) =>
    setRota((current) => ({ ...current, people: current.people.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  const setShifts = (id: number, dayIndexes: readonly number[], shift: RotaShift | null) =>
    setRota((current) => ({
      ...current,
      people: current.people.map((p) =>
        p.id === id ? { ...p, shifts: p.shifts.map((s, day) => (dayIndexes.includes(day) ? shift && { ...shift } : s)) } : p,
      ),
    }));
  const addPerson = () => {
    const id = rota.nextId;
    setRota((current) => ({
      ...current,
      nextId: current.nextId + 1,
      people: [...current.people, { id, name: '', role: '', rate: '', shifts: emptyWeek() }],
    }));
    setPanel({ kind: 'person', personId: id });
  };
  const removePerson = (id: number) => {
    setRota((current) => ({ ...current, people: current.people.filter((p) => p.id !== id) }));
    setPanel(null);
  };
  /** Sunday-first and Monday-first weeks hold the same shifts on the same weekdays: the week turns, the shifts follow. */
  const setFirstDay = (firstDay: FirstDay) =>
    setRota((current) => {
      if (current.firstDay === firstDay) return current;
      const turn = (shifts: (RotaShift | null)[]) =>
        firstDay === 0 ? [shifts[6], ...shifts.slice(0, 6)] : [...shifts.slice(1), shifts[0]];
      return {
        ...current,
        firstDay,
        weekStart: weekStartOf(current.weekStart, firstDay) ?? current.weekStart,
        people: current.people.map((p) => ({ ...p, shifts: turn(p.shifts) })),
      };
    });
  const startBlank = () => {
    setRota((current) => ({
      ...current,
      title: '',
      sales: '',
      nextId: current.nextId + 1,
      people: [{ id: current.nextId, name: '', role: '', rate: '', shifts: emptyWeek() }],
    }));
    setPanel(null);
  };
  const loadExample = () => {
    setRota((current) => ({ ...exampleRota(current.weekStart, current), nextId: Math.max(current.nextId, 5) }));
    setPanel(null);
  };

  const downloadImage = async () => {
    setImageState('working');
    try {
      await downloadRotaImage({ title: rota.title, weekStart: rota.weekStart, currency, people, summary, toneOf });
      setImageState('idle');
    } catch {
      setImageState('failed');
    }
  };

  const panelPerson = panel && panel.kind !== 'settings' ? people.find((p) => p.id === panel.personId) : undefined;
  const iconButton =
    'grid size-8 place-items-center text-[var(--mkt-ink-2)] outline-none hover:bg-[var(--mkt-ground)] hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary';

  return (
    <div className="flex flex-col gap-4">
      {/* ── Toolbar: the rota's name and week, and what to do with it ── */}
      <div className="mkt-card flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-4 py-4 sm:px-5">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${uid}-title`} className="sr-only">
            Rota name
          </label>
          <span className="group/title relative flex max-w-md items-center">
            <input
              id={`${uid}-title`}
              className="-ml-2 h-10 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 pr-8 text-xl font-semibold tracking-display text-[var(--mkt-heading)] outline-none placeholder:text-[var(--mkt-ink-3)] hover:border-[var(--mkt-line)] focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25"
              autoComplete="off"
              value={rota.title}
              onChange={(e) => update({ title: e.target.value })}
              placeholder="Name your rota"
            />
            <Pencil
              className="pointer-events-none absolute right-2.5 size-3.5 text-[var(--mkt-ink-3)] opacity-60 group-hover/title:opacity-100"
              aria-hidden="true"
            />
          </span>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-2">
            <div className="flex items-center overflow-hidden rounded-lg border border-[var(--mkt-line)] bg-white dark:bg-transparent">
              <button
                type="button"
                onClick={() => update({ weekStart: shiftWeek(rota.weekStart, -1) })}
                className={iconButton}
                aria-label="Previous week"
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
              </button>
              <span
                className="min-w-[9.5rem] border-x border-[var(--mkt-line)] px-3 text-center text-sm leading-8 font-medium"
                aria-live="polite"
              >
                {weekLabel(rota.weekStart)}
              </span>
              <button
                type="button"
                onClick={() => update({ weekStart: shiftWeek(rota.weekStart, 1) })}
                className={iconButton}
                aria-label="Next week"
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </button>
            </div>
            {client && rota.weekStart !== thisWeek(rota.firstDay) && (
              <button
                type="button"
                onClick={() => update({ weekStart: thisWeek(rota.firstDay) })}
                className="text-sm font-medium text-primary hover:underline"
              >
                This week
              </button>
            )}
            <button
              type="button"
              onClick={() => setPanel({ kind: 'settings' })}
              className="text-sm text-[var(--mkt-ink-3)] hover:text-foreground"
            >
              {currency} · {rota.firstDay === 1 ? 'Monday' : 'Sunday'} start
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setPanel({ kind: 'settings' })}
            className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}
          >
            <SlidersHorizontal className="size-4" aria-hidden="true" />
            Settings
          </button>
          <button type="button" onClick={() => window.print()} className={cn(buttonVariants({ variant: 'outline' }), 'gap-1.5')}>
            <Printer className="size-4" aria-hidden="true" />
            Print or PDF
          </button>
          <button type="button" onClick={downloadImage} disabled={imageState === 'working'} className={cn(buttonVariants(), 'gap-1.5')}>
            <Download className="size-4" aria-hidden="true" />
            {imageState === 'working' ? 'Drawing…' : 'Download image'}
          </button>
        </div>
      </div>
      {imageState === 'failed' && (
        <p className="text-sm text-destructive" role="alert">
          The image couldn’t be made in this browser. Try Print or PDF instead.
        </p>
      )}

      {/* ── The rota, as on the home page's tile ── */}
      <div className="mkt-mock overflow-x-auto">
        <table className="w-full min-w-[54rem] border-collapse text-left">
          <caption className="sr-only">
            {rota.title.trim() || 'Rota'}, week of {days[0].long}. Choose a name to edit a person, or a day to edit a shift.
          </caption>
          <thead>
            <tr className="border-b border-[var(--mkt-line)] bg-[var(--mkt-ground)]">
              <th scope="col" className="w-40 px-4 py-2.5">
                <span className={LABEL_SMALL}>Team</span>
              </th>
              {days.map((day) => (
                <th key={day.long} scope="col" className="px-1 py-2.5 text-center font-normal">
                  <span className={cn(LABEL_SMALL, 'block')}>{day.short}</span>
                  <span className="block text-[12px] text-[var(--mkt-ink-2)]">{day.date}</span>
                </th>
              ))}
              <th scope="col" className="w-24 px-4 py-2.5 text-right">
                <span className={LABEL_SMALL}>Total</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {people.map((person) => {
              const totals = summary.people.find((p) => p.id === person.id);
              const tone = toneOf(person);
              const name = person.name.trim() || 'Unnamed';
              return (
                <tr key={person.id} className="border-b border-[var(--mkt-line)]">
                  <th scope="row" className="px-2 py-1.5 font-normal">
                    <button
                      type="button"
                      onClick={() => setPanel({ kind: 'person', personId: person.id })}
                      className="group/person flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-[var(--mkt-ground)] focus-visible:ring-2 focus-visible:ring-primary"
                      aria-label={`Edit ${name}`}
                    >
                      <span className={cn('size-2 shrink-0 rounded-full', ROLE_DOT[tone])} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            'block truncate text-[13px] font-semibold',
                            person.name.trim() ? 'text-[var(--mkt-heading)]' : 'text-[var(--mkt-ink-3)]',
                          )}
                        >
                          {name}
                        </span>
                        {person.role.trim() && (
                          <span className="block truncate text-[11px] text-[var(--mkt-ink-2)]">{person.role.trim()}</span>
                        )}
                      </span>
                      <Pencil
                        className="size-3.5 shrink-0 text-[var(--mkt-ink-3)] opacity-0 transition-opacity group-hover/person:opacity-100 group-focus-visible/person:opacity-100"
                        aria-hidden="true"
                      />
                    </button>
                  </th>
                  {days.map((day, index) => {
                    const shift = person.shifts[index];
                    const span = shift && shiftSpan(shift);
                    const isOpen = panel?.kind === 'shift' && panel.personId === person.id && panel.day === index;
                    const warned = warnedCells.has(`${person.id}:${index}`);
                    return (
                      <td key={day.long} className={cn('px-1 py-1.5', day.weekend && 'bg-[var(--mkt-ground)]/60')}>
                        <button
                          type="button"
                          onClick={() => setPanel({ kind: 'shift', personId: person.id, day: index })}
                          aria-label={`${name}, ${day.long}: ${shift ? `${shift.start} to ${shift.end}` : 'no shift'}${warned ? ', check the working-time warning' : ''}`}
                          className={cn(
                            'group/cell relative flex h-11 w-full flex-col items-center justify-center rounded-[6px] font-mono text-[11px] leading-tight tabular-nums ring-1 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary',
                            shift
                              ? ROLE_CHIP[tone]
                              : 'text-[var(--mkt-ink-3)] ring-transparent hover:bg-white hover:ring-[var(--mkt-line)] dark:hover:bg-transparent',
                            isOpen && 'ring-2 ring-primary',
                          )}
                        >
                          {shift ? (
                            <>
                              <span className="font-semibold">{shortShift(shift)}</span>
                              {span && <span className="text-[10px] opacity-75">{formatHours(span.paidMinutes)}</span>}
                            </>
                          ) : (
                            <span
                              className="text-base leading-none opacity-0 transition-opacity group-hover/cell:opacity-100 group-focus-visible/cell:opacity-100"
                              aria-hidden="true"
                            >
                              +
                            </span>
                          )}
                          {warned && <TriangleAlert className="absolute top-0.5 right-0.5 size-3 text-stock" aria-hidden="true" />}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-4 py-2 text-right">
                    <span className="block font-mono text-[13px] font-semibold tabular-nums">{formatHours(totals?.paidMinutes ?? 0)}</span>
                    {totals?.costPence != null && (
                      <span className="block font-mono text-[11px] text-[var(--mkt-ink-2)] tabular-nums">{money(totals.costPence)}</span>
                    )}
                  </td>
                </tr>
              );
            })}
            <tr className="border-b border-[var(--mkt-line)]">
              <td colSpan={DAYS_IN_WEEK + 2} className="px-2 py-2">
                <button
                  type="button"
                  onClick={addPerson}
                  className="flex h-10 w-full items-center gap-2 rounded-lg border border-dashed border-[var(--mkt-line)] px-3 text-sm font-medium text-[var(--mkt-ink-2)] transition-colors outline-none hover:border-primary/40 hover:bg-white hover:text-primary focus-visible:ring-2 focus-visible:ring-primary dark:hover:bg-transparent"
                >
                  <UserPlus className="size-4" aria-hidden="true" />
                  Add person
                </button>
              </td>
            </tr>
          </tbody>
          <tfoot>
            <tr className="bg-[var(--mkt-ground)] text-[12px] text-[var(--mkt-ink-2)]">
              <th scope="row" className="px-4 py-2.5 font-medium">
                Hours · cost
              </th>
              {summary.days.map((day, index) => (
                <td key={index} className="px-1 py-2.5 text-center font-mono tabular-nums">
                  {day.paidMinutes ? formatHours(day.paidMinutes) : '–'}
                  {day.costPence > 0 && <span className="block text-[11px] text-[var(--mkt-ink-3)]">{money(day.costPence)}</span>}
                </td>
              ))}
              <td className="px-4 py-2.5 text-right font-mono font-semibold text-foreground tabular-nums">
                {formatHours(summary.paidMinutes)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="-mt-1 flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm text-[var(--mkt-ink-3)]">
        <span>Choose a day to add or change a shift, or a name to edit the person.</span>
        <span className="flex gap-4">
          <button type="button" onClick={loadExample} className="font-medium text-primary hover:underline">
            Show the example
          </button>
          <button type="button" onClick={startBlank} className="font-medium text-primary hover:underline">
            Start blank
          </button>
        </span>
      </p>

      {/* ── The week's figures and the working-time checks ── */}
      <div className="mt-2 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]" aria-live="polite">
        <WeekFigures summary={summary} money={money} onAddSales={() => setPanel({ kind: 'settings' })} />
        <section className="mkt-card px-5 py-5" aria-labelledby={`${uid}-checks`}>
          <h3 id={`${uid}-checks`} className="text-sm font-semibold text-[var(--mkt-heading)]">
            Working-time checks
          </h3>
          {!checksOn ? (
            <p className="mt-2 text-[0.9375rem] text-[var(--mkt-ink-2)]">The checks are off. Turn them on in Settings.</p>
          ) : warnings.length === 0 ? (
            <p className="mt-2 text-[0.9375rem] text-[var(--mkt-ink-2)]">Every break, rest and weekly total is within your limits.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2.5">
              {warnings.map((warning, index) => (
                <li key={index} className="flex gap-2.5 text-[0.9375rem] leading-snug text-[var(--mkt-ink-2)]">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-stock" aria-hidden="true" />
                  {warningText(warning, rules, nameOf, days)}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 border-t border-[var(--mkt-line)] pt-3 text-xs leading-relaxed text-[var(--mkt-ink-3)]">
            {rulesAreDefault ? 'Checked against the EU and UK limits for adult workers. ' : 'Checked against your own limits. '}
            <button type="button" onClick={() => setPanel({ kind: 'settings' })} className="font-medium text-primary hover:underline">
              Set the rules for your country
            </button>
          </p>
        </section>
      </div>

      {panel?.kind === 'shift' && panelPerson && (
        <ShiftDrawer
          person={panelPerson}
          day={panel.day}
          days={days}
          money={money}
          onDay={(day) => setPanel({ kind: 'shift', personId: panelPerson.id, day })}
          onChange={(shift) => setShifts(panelPerson.id, [panel.day], shift)}
          onRepeat={(dayIndexes, shift) => setShifts(panelPerson.id, dayIndexes, shift)}
          onClose={() => setPanel(null)}
        />
      )}
      {panel?.kind === 'person' && panelPerson && (
        <PersonDrawer
          person={panelPerson}
          tone={toneOf(panelPerson)}
          roles={[...new Set(people.map((p) => p.role.trim()).filter(Boolean))]}
          totals={summary.people.find((p) => p.id === panelPerson.id)}
          days={days}
          currency={currency}
          money={money}
          canRemove={people.length > 1}
          onChange={(patch) => updatePerson(panelPerson.id, patch)}
          onRemove={() => removePerson(panelPerson.id)}
          onClose={() => setPanel(null)}
        />
      )}
      {panel?.kind === 'settings' && (
        <SettingsDrawer rota={rota} onChange={update} onFirstDay={setFirstDay} onClose={() => setPanel(null)} />
      )}

      {client && createPortal(<PrintRota rota={rota} summary={summary} warnings={warnings} nameOf={nameOf} money={money} />, document.body)}
    </div>
  );
}

function WeekFigures({ summary, money, onAddSales }: { summary: RotaSummary; money: (minor: number) => string; onAddSales: () => void }) {
  const figure = 'mt-1 font-mono text-2xl font-semibold tracking-tight tabular-nums';
  return (
    <section className="mkt-card px-5 py-5" aria-label="This week">
      <dl className="grid grid-cols-3 gap-4">
        <div>
          <dt className="text-sm text-[var(--mkt-ink-2)]">Paid hours</dt>
          <dd className={figure}>{formatHours(summary.paidMinutes)}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--mkt-ink-2)]">Staff cost</dt>
          <dd className={figure}>{summary.costPence > 0 ? money(summary.costPence) : '–'}</dd>
        </div>
        <div>
          <dt className="text-sm text-[var(--mkt-ink-2)]">Labour %</dt>
          <dd className={summary.labourPct === null ? 'mt-2' : figure}>
            {summary.labourPct === null ? (
              <button type="button" onClick={onAddSales} className="text-sm font-medium text-primary hover:underline">
                Add expected sales
              </button>
            ) : (
              `${summary.labourPct.toFixed(1)}%`
            )}
          </dd>
        </div>
      </dl>
      <p className="mt-4 border-t border-[var(--mkt-line)] pt-3 text-xs leading-relaxed text-[var(--mkt-ink-3)]">
        Hours × hourly rate, less unpaid breaks.
        {summary.unpricedMinutes > 0 && ` ${formatHours(summary.unpricedMinutes)} have no rate, so aren’t costed.`} Employer taxes, pension
        and holiday pay come on top.
      </p>
    </section>
  );
}

const BREAKS = [0, 15, 20, 30, 45, 60] as const;

/** One person's shift on one day: presets, times, break, and copying it to other days. Edits apply as you go. */
function ShiftDrawer({
  person,
  day,
  days,
  money,
  onDay,
  onChange,
  onRepeat,
  onClose,
}: {
  person: RotaPerson;
  day: number;
  days: ReturnType<typeof weekDays>;
  money: (minor: number) => string;
  onDay: (day: number) => void;
  onChange: (shift: RotaShift | null) => void;
  onRepeat: (dayIndexes: number[], shift: RotaShift) => void;
  onClose: () => void;
}) {
  const uid = useId();
  const shift = person.shifts[day];
  const span = shift && shiftSpan(shift);
  const rate = ratePence(person.rate);
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const name = person.name.trim() || 'Unnamed';
  const others = (indexes: number[]) => indexes.filter((d) => d !== day);

  const toggleRepeat = (index: number) =>
    setRepeatDays((current) => (current.includes(index) ? current.filter((d) => d !== index) : [...current, index]));
  const applyRepeat = () => {
    if (!shift || !span) return;
    onRepeat(repeatDays, shift);
    setRepeatDays([]);
  };
  const goTo = (next: number) => {
    setRepeatDays([]);
    onDay(next);
  };

  const description = span
    ? `${shift.start}–${shift.end} · ${formatHours(span.paidMinutes)} paid${rate !== null ? ` · ${money(costPence(span.paidMinutes, rate))}` : ''}${span.end > 24 * 60 ? ' · ends the next morning' : ''}`
    : shift
      ? 'Set a start and an end time'
      : 'No shift yet: pick one, or set the times';

  return (
    <Drawer
      title={`${name} · ${days[day].long}`}
      description={description}
      liveDescription
      onClose={onClose}
      className="sm:max-w-md"
      actions={
        <>
          <DrawerHeaderButton label="Previous day" onClick={() => goTo(day - 1)} disabled={day === 0}>
            <ChevronLeft size={15} aria-hidden="true" />
          </DrawerHeaderButton>
          <DrawerHeaderButton label="Next day" onClick={() => goTo(day + 1)} disabled={day === DAYS_IN_WEEK - 1}>
            <ChevronRight size={15} aria-hidden="true" />
          </DrawerHeaderButton>
        </>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!shift}
            onClick={() => onChange(null)}
            className={cn(buttonVariants({ variant: 'ghost' }), 'gap-1.5 text-destructive disabled:opacity-40')}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remove shift
          </button>
          <button type="button" onClick={onClose} className={buttonVariants()}>
            Done
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        <section aria-labelledby={`${uid}-pick`}>
          <h3 id={`${uid}-pick`} className={SECTION}>
            Quick pick
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {SHIFT_PRESETS.map((preset) => {
              const on = sameShift(shift, preset.shift);
              return (
                <button
                  key={preset.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onChange(preset.shift)}
                  className={cn(
                    'flex flex-col items-start rounded-xl border px-3.5 py-2.5 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    on ? 'border-primary bg-primary/8' : 'border-[var(--mkt-line)] bg-white hover:border-primary/40 dark:bg-transparent',
                  )}
                >
                  <span className="text-sm font-semibold text-foreground">{preset.label}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {preset.shift.start}–{preset.shift.end}
                    {preset.shift.breakMinutes > 0 && ` · ${preset.shift.breakMinutes}m break`}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby={`${uid}-times`}>
          <h3 id={`${uid}-times`} className={SECTION}>
            Times
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor={`${uid}-start`} className={LABEL}>
                Start
              </label>
              <input
                id={`${uid}-start`}
                type="time"
                className={NUMBER_FIELD}
                value={shift?.start ?? ''}
                onChange={(e) => onChange({ start: e.target.value, end: shift?.end ?? '', breakMinutes: shift?.breakMinutes ?? 30 })}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-end`} className={LABEL}>
                End
              </label>
              <input
                id={`${uid}-end`}
                type="time"
                className={NUMBER_FIELD}
                value={shift?.end ?? ''}
                onChange={(e) => onChange({ start: shift?.start ?? '', end: e.target.value, breakMinutes: shift?.breakMinutes ?? 30 })}
              />
            </div>
          </div>
        </section>

        <section aria-labelledby={`${uid}-break`}>
          <h3 id={`${uid}-break`} className={SECTION}>
            Unpaid break
          </h3>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`${uid}-break`}>
            {BREAKS.map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={shift?.breakMinutes === minutes}
                disabled={!shift}
                onClick={() => shift && onChange({ ...shift, breakMinutes: minutes })}
                className={cn(CHIP, chipState(shift?.breakMinutes === minutes))}
              >
                {minutes === 0 ? 'None' : `${minutes} min`}
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby={`${uid}-repeat`}>
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h3 id={`${uid}-repeat`} className={cn(SECTION, 'mb-0')}>
              Copy to other days
            </h3>
            <span className="flex gap-3 text-sm">
              <button
                type="button"
                disabled={!span}
                onClick={() => setRepeatDays(others(days.flatMap((d, index) => (d.weekend ? [] : [index]))))}
                className="font-medium text-primary hover:underline disabled:opacity-40"
              >
                Weekdays
              </button>
              <button
                type="button"
                disabled={!span}
                onClick={() => setRepeatDays(others(days.map((_, index) => index)))}
                className="font-medium text-primary hover:underline disabled:opacity-40"
              >
                Every day
              </button>
            </span>
          </div>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-labelledby={`${uid}-repeat`}>
            {days.map((d, index) => {
              const current = index === day;
              const on = current || repeatDays.includes(index);
              return (
                <button
                  key={d.long}
                  type="button"
                  aria-pressed={on}
                  aria-label={current ? `${d.long}, this shift` : d.long}
                  disabled={current || !span}
                  onClick={() => toggleRepeat(index)}
                  className={cn(
                    'flex h-12 flex-col items-center justify-center rounded-lg border text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
                    on
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-[var(--mkt-line)] bg-white text-foreground hover:border-primary/40 dark:bg-transparent',
                    !current && 'disabled:opacity-40',
                  )}
                >
                  {d.short.slice(0, 2)}
                  <span className="text-[10px] opacity-75">{d.date.split(' ')[0]}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            disabled={!span || repeatDays.length === 0}
            onClick={applyRepeat}
            className={cn(buttonVariants({ variant: 'outline' }), 'mt-3 w-full disabled:opacity-40')}
          >
            {repeatDays.length === 0
              ? 'Pick the days to copy to'
              : `Copy to ${repeatDays.length} ${repeatDays.length === 1 ? 'day' : 'days'}`}
          </button>
        </section>
      </div>
    </Drawer>
  );
}

/** One person: name, role and rate, and their week at a glance. */
function PersonDrawer({
  person,
  tone,
  roles,
  totals,
  days,
  currency,
  money,
  canRemove,
  onChange,
  onRemove,
  onClose,
}: {
  person: RotaPerson;
  tone: number;
  roles: string[];
  totals: RotaSummary['people'][number] | undefined;
  days: ReturnType<typeof weekDays>;
  currency: string;
  money: (minor: number) => string;
  canRemove: boolean;
  onChange: (patch: Partial<RotaPerson>) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const uid = useId();
  const initial = (person.name.trim()[0] ?? '?').toUpperCase();
  return (
    <Drawer
      title={person.name.trim() || 'New person'}
      description={person.role.trim() || 'Add their name, role and hourly rate'}
      onClose={onClose}
      className="sm:max-w-md"
      leading={
        <span
          className={cn('grid size-10 place-items-center rounded-full text-sm font-semibold ring-1', ROLE_CHIP[tone])}
          aria-hidden="true"
        >
          {initial}
        </span>
      }
      footer={
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            disabled={!canRemove}
            onClick={onRemove}
            className={cn(buttonVariants({ variant: 'ghost' }), 'gap-1.5 text-destructive disabled:opacity-40')}
          >
            <Trash2 className="size-4" aria-hidden="true" />
            Remove person
          </button>
          <button type="button" onClick={onClose} className={buttonVariants()}>
            Done
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        <section className="flex flex-col gap-4" aria-label="Details">
          <div>
            <label htmlFor={`${uid}-name`} className={LABEL}>
              Name
            </label>
            <input
              id={`${uid}-name`}
              className={FIELD}
              autoComplete="off"
              value={person.name}
              placeholder="Amira"
              onChange={(e) => onChange({ name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_8.5rem] gap-3">
            <div>
              <label htmlFor={`${uid}-role`} className={LABEL}>
                Role
              </label>
              <input
                id={`${uid}-role`}
                className={FIELD}
                autoComplete="off"
                list={`${uid}-roles`}
                value={person.role}
                placeholder="Barista"
                onChange={(e) => onChange({ role: e.target.value })}
              />
              <datalist id={`${uid}-roles`}>
                {roles.map((role) => (
                  <option key={role} value={role} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor={`${uid}-rate`} className={LABEL}>
                Per hour
              </label>
              <span className="relative block">
                <span
                  className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
                  aria-hidden="true"
                >
                  {currencySymbol(currency)}
                </span>
                <input
                  id={`${uid}-rate`}
                  className={cn(NUMBER_FIELD, 'pl-8 text-right')}
                  inputMode="decimal"
                  autoComplete="off"
                  value={person.rate}
                  placeholder="12.50"
                  onChange={(e) => onChange({ rate: e.target.value })}
                />
              </span>
            </div>
          </div>
          <p className="-mt-1 text-xs text-muted-foreground">
            People with the same role share a colour. Leave the rate blank to leave them out of the cost.
          </p>
        </section>

        <section aria-label="Their week">
          <h3 className={SECTION}>Their week</h3>
          <dl className="grid grid-cols-3 gap-2 rounded-xl border border-[var(--mkt-line)] bg-white px-4 py-3 dark:bg-transparent">
            <div>
              <dt className="text-xs text-muted-foreground">Shifts</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{totals?.shifts ?? 0}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Paid hours</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{formatHours(totals?.paidMinutes ?? 0)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Cost</dt>
              <dd className="font-mono text-lg font-semibold tabular-nums">{totals?.costPence == null ? '–' : money(totals.costPence)}</dd>
            </div>
          </dl>
          <ul className="mt-3 flex flex-col">
            {days.map((day, index) => {
              const shift = person.shifts[index];
              return (
                <li
                  key={day.long}
                  className="flex items-center justify-between gap-3 border-b border-[var(--mkt-line)] py-2 text-sm last:border-b-0"
                >
                  <span className="text-muted-foreground">
                    {day.short} {day.date}
                  </span>
                  <span className={cn('font-mono tabular-nums', !shift && 'text-muted-foreground')}>
                    {shift ? `${shift.start}–${shift.end}` : 'Off'}
                  </span>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            disabled={!person.shifts.some(Boolean)}
            onClick={() => onChange({ shifts: emptyWeek() })}
            className="mt-2 text-sm font-medium text-primary hover:underline disabled:opacity-40"
          >
            Clear their week
          </button>
        </section>
      </div>
    </Drawer>
  );
}

/** A limit in hours or minutes, empty for "no such rule". Kept as typed, so "6." survives until the next key. */
function RuleField({
  id,
  label,
  unit,
  value,
  scale,
  onChange,
}: {
  id: string;
  label: string;
  unit: string;
  value: number | null;
  /** Minutes per unit: 60 for hours, 1 for minutes. */
  scale: number;
  onChange: (minutes: number | null) => void;
}) {
  const [text, setText] = useState(value === null ? '' : String(value / scale));
  return (
    <div>
      <label htmlFor={id} className={LABEL}>
        {label}
      </label>
      <span className="relative block">
        <input
          id={id}
          className={cn(NUMBER_FIELD, 'pr-14 text-right')}
          inputMode="decimal"
          autoComplete="off"
          value={text}
          placeholder="Off"
          onChange={(e) => {
            setText(e.target.value);
            const number = Number(e.target.value);
            onChange(e.target.value.trim() === '' || !Number.isFinite(number) || number <= 0 ? null : Math.round(number * scale));
          }}
        />
        <span className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">
          {unit}
        </span>
      </span>
    </div>
  );
}

/** Currency, sales, the week's first day and the working-time rules — the parts that differ by country. */
function SettingsDrawer({
  rota,
  onChange,
  onFirstDay,
  onClose,
}: {
  rota: Rota;
  onChange: (patch: Partial<Rota>) => void;
  onFirstDay: (firstDay: FirstDay) => void;
  onClose: () => void;
}) {
  const uid = useId();
  // Bumped when a preset is applied, so the rule fields re-read their values.
  const [rulesKey, setRulesKey] = useState(0);
  const setRule = (patch: Partial<WorkingTimeRules>) => onChange({ rules: { ...rota.rules, ...patch } });
  const applyRules = (rules: WorkingTimeRules) => {
    onChange({ rules });
    setRulesKey((k) => k + 1);
  };

  return (
    <Drawer
      title="Rota settings"
      description="Currency, your week and the working-time rules where you are."
      icon={SlidersHorizontal}
      onClose={onClose}
      className="sm:max-w-md"
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className={buttonVariants()}>
            Done
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-7">
        <section className="flex flex-col gap-4" aria-labelledby={`${uid}-money`}>
          <h3 id={`${uid}-money`} className={cn(SECTION, 'mb-0')}>
            Money
          </h3>
          <div>
            <label htmlFor={`${uid}-currency`} className={LABEL}>
              Currency
            </label>
            <span className="relative block">
              <select
                id={`${uid}-currency`}
                className={cn(FIELD, 'appearance-none pr-9')}
                value={rota.currency}
                onChange={(e) => onChange({ currency: e.target.value })}
              >
                {CURRENCIES.map((entry) => (
                  <option key={entry.code} value={entry.code}>
                    {entry.code} — {entry.name} ({currencySymbol(entry.code)})
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden="true"
              />
            </span>
          </div>
          <div>
            <label htmlFor={`${uid}-sales`} className={LABEL}>
              Expected sales this week, before tax
            </label>
            <span className="relative block">
              <span
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground"
                aria-hidden="true"
              >
                {currencySymbol(rota.currency)}
              </span>
              <input
                id={`${uid}-sales`}
                className={cn(NUMBER_FIELD, 'pl-8 text-right')}
                inputMode="decimal"
                autoComplete="off"
                value={rota.sales}
                onChange={(e) => onChange({ sales: e.target.value })}
                placeholder="Optional"
              />
            </span>
            <p className="mt-1.5 text-xs text-muted-foreground">For labour %: the week’s staff cost as a share of these sales.</p>
          </div>
        </section>

        <section aria-labelledby={`${uid}-week`}>
          <h3 id={`${uid}-week`} className={SECTION}>
            Week starts on
          </h3>
          <div className="flex gap-2" role="group" aria-labelledby={`${uid}-week`}>
            {([1, 0] as const).map((firstDay) => (
              <button
                key={firstDay}
                type="button"
                aria-pressed={rota.firstDay === firstDay}
                onClick={() => onFirstDay(firstDay)}
                className={cn(CHIP, chipState(rota.firstDay === firstDay))}
              >
                {firstDay === 1 ? 'Monday' : 'Sunday'}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Shifts stay on their weekday when you switch.</p>
        </section>

        <section aria-labelledby={`${uid}-rules`}>
          <div className="mb-2.5 flex items-baseline justify-between gap-3">
            <h3 id={`${uid}-rules`} className={cn(SECTION, 'mb-0')}>
              Working-time rules
            </h3>
            <span className="flex gap-3 text-sm">
              <button type="button" onClick={() => applyRules(DEFAULT_RULES)} className="font-medium text-primary hover:underline">
                EU / UK
              </button>
              <button
                type="button"
                onClick={() => applyRules({ ...rota.rules, breakAfterMinutes: null, restMinutes: null, weeklyMinutes: null })}
                className="font-medium text-primary hover:underline"
              >
                All off
              </button>
            </span>
          </div>
          <div key={rulesKey} className="grid grid-cols-2 gap-3">
            <RuleField
              id={`${uid}-after`}
              label="Break after"
              unit="hours"
              scale={60}
              value={rota.rules.breakAfterMinutes}
              onChange={(m) => setRule({ breakAfterMinutes: m })}
            />
            <RuleField
              id={`${uid}-min`}
              label="Break of at least"
              unit="min"
              scale={1}
              value={rota.rules.minBreakMinutes}
              onChange={(m) => setRule({ minBreakMinutes: m ?? DEFAULT_RULES.minBreakMinutes })}
            />
            <RuleField
              id={`${uid}-rest`}
              label="Rest between shifts"
              unit="hours"
              scale={60}
              value={rota.rules.restMinutes}
              onChange={(m) => setRule({ restMinutes: m })}
            />
            <RuleField
              id={`${uid}-weekly`}
              label="Most in a week"
              unit="hours"
              scale={60}
              value={rota.rules.weeklyMinutes}
              onChange={(m) => setRule({ weeklyMinutes: m })}
            />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            The defaults are the EU and UK limits for adult workers. Rules differ by country, and are stricter for young workers: set yours,
            or leave a field empty to skip that check. A guide, not legal advice.
          </p>
        </section>
      </div>
    </Drawer>
  );
}

/**
 * The rota as it prints: a plain table on a landscape page. Rendered into
 * <body> and hidden on screen; marketing.css shows only this when printing,
 * so Print and the browser's own "Save as PDF" both give a clean page.
 */
function PrintRota({
  rota,
  summary,
  warnings,
  nameOf,
  money,
}: {
  rota: Rota;
  summary: RotaSummary;
  warnings: readonly RotaWarning[];
  nameOf: (id: number) => string;
  money: (minor: number) => string;
}) {
  const days = weekDays(rota.weekStart);
  return (
    <div className="rota-print" aria-hidden="true">
      <h1>{rota.title.trim() || 'Rota'}</h1>
      <p className="rota-print-week">Week of {weekLabel(rota.weekStart)}</p>
      <table>
        <thead>
          <tr>
            <th />
            {days.map((day) => (
              <th key={day.long}>
                {day.short}
                <span>{day.date}</span>
              </th>
            ))}
            <th className="rota-print-total">Total</th>
          </tr>
        </thead>
        <tbody>
          {rota.people.map((person) => {
            const totals = summary.people.find((p) => p.id === person.id);
            return (
              <tr key={person.id}>
                <th>
                  {person.name.trim() || 'Unnamed'}
                  {person.role.trim() && <span>{person.role.trim()}</span>}
                </th>
                {person.shifts.map((shift, day) => (
                  <td key={day}>
                    {shift && shiftSpan(shift) ? (
                      <>
                        <strong>
                          {shift.start}–{shift.end}
                        </strong>
                        <span>{shift.breakMinutes > 0 ? `${shift.breakMinutes}m break` : 'no break'}</span>
                      </>
                    ) : (
                      ''
                    )}
                  </td>
                ))}
                <td className="rota-print-total">
                  <strong>{formatHours(totals?.paidMinutes ?? 0)}</strong>
                  {totals?.costPence != null && <span>{money(totals.costPence)}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th>Hours</th>
            {summary.days.map((day, index) => (
              <td key={index}>{day.paidMinutes ? formatHours(day.paidMinutes) : '–'}</td>
            ))}
            <td className="rota-print-total">
              <strong>{formatHours(summary.paidMinutes)}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="rota-print-facts">
        {formatHours(summary.paidMinutes)} paid
        {summary.costPence > 0 && ` · ${money(summary.costPence)} staff cost`}
        {summary.labourPct !== null && ` · ${summary.labourPct.toFixed(1)}% of expected sales`}
      </p>
      {warnings.length > 0 && (
        <ul className="rota-print-warnings">
          {warnings.map((warning, index) => (
            <li key={index}>{warningText(warning, rota.rules, nameOf, days)}</li>
          ))}
        </ul>
      )}
      <p className="rota-print-credit">
        Made with the free rota builder at {absoluteUrl('/tools/rota-builder').replace(/^https?:\/\//, '')}
      </p>
    </div>
  );
}
