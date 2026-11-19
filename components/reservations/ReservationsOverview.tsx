'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { InfoRow, InfoRows } from '@/components/cms/rows';
import {
  CalendarCheck,
  CalendarClock,
  Clock,
  Info,
  LayoutGrid,
  Plus,
  Repeat,
  RotateCcw,
  Timer,
  UserMinus,
  UserPlus,
  Users,
  XCircle,
} from '@/components/icons';
import { Fact } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Bone, FactSkeleton } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { BOARD_COLUMNS, WidgetGrid, boardMetrics } from '@/components/shared/widget-grid/WidgetGrid';
import { useGridEditor } from '@/components/shared/widget-grid/useGridEditor';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type Booking, type WaitlistEntry, getBookings, getFloorPlan, getWaitlist } from '@/lib/modules/reservations/client';
import { floorUsage } from '@/lib/utils/floor-status';
import { SOURCE_LABELS, minutesBetween, minutesLabel, seatsAtMost, slotOf } from '@/lib/utils/reservations';
import { lateBookings, waitlistOverview } from '@/lib/utils/reservations-lists';
import {
  DEFAULT_OVERVIEW_LAYOUT,
  OVERVIEW_CARDS,
  OVERVIEW_COLUMNS,
  type OverviewCardKey,
  readOverviewLayout,
} from '@/lib/utils/reservations-overview-layout';
import {
  BOOKINGS_LIMIT,
  BUSY_SHARE,
  PARTY_BAND_LABELS,
  PAST_DAYS,
  coversByDay,
  coversHeatGrid,
  overCapacity,
  overviewRange,
  partyMix,
  percentLabel,
  repeatGuests,
  serviceQuality,
  sourceMix,
  splitBookings,
  stayLabel,
  todayGlance,
  unconfirmedToday,
} from '@/lib/utils/reservations-stats';
import type { Cell } from '@/lib/utils/widget-grid';
import { resolvedTimeZone, workspaceDateKey, workspaceTimeZone } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { CoversHeatGrid } from './overview/CoversHeatGrid';
import { ShareBars } from './overview/ShareBars';
import { WeekCovers } from './overview/WeekCovers';
import { useMinuteClock } from './useMinuteClock';

/** Where an Overview card or day sends the host: a Host tab, and a day on it. */
export interface HostTarget {
  tab?: 'bookings' | 'waitlist';
  /** `YYYY-MM-DD` in the workspace zone. */
  date?: string;
}

const guests = (count: number) => (count === 1 ? '1 guest' : `${count} guests`);
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

/**
 * The manager's Reservations overview: today at a glance, the next 7 days,
 * service quality and the busiest hours. One bookings call covers it all —
 * 30 full days back to 7 days ahead in the workspace zone — beside the floor
 * plan and the waitlist, both on the keys the Host tab already uses. Every
 * figure comes from `lib/utils/reservations-stats.ts`, where each metric's
 * rule (which statuses count) is written down and tested.
 */
export function ReservationsOverview({ locationId, onOpenHost }: { locationId: string; onOpenHost?: (target?: HostTarget) => void }) {
  const now = useMinuteClock();
  const timeZone = workspaceTimeZone();
  const today = workspaceDateKey(now, timeZone);
  const range = useMemo(() => overviewRange(today, timeZone), [today, timeZone]);

  const bookings = useQuery({
    queryKey: moduleQueryKeys.reservations.key('overview', locationId, range.from, range.to),
    queryFn: () => getBookings(locationId, { from: range.from, to: range.to }),
    refetchInterval: 60_000,
  });
  const floor = useQuery({
    queryKey: moduleQueryKeys.reservations.key('floor', locationId),
    queryFn: () => getFloorPlan(locationId),
  });
  const waitlist = useQuery({
    queryKey: moduleQueryKeys.reservations.key('waitlist', locationId),
    queryFn: () => getWaitlist(locationId),
    refetchInterval: 60_000,
  });

  if (bookings.isPending || floor.isPending) return <OverviewSkeleton />;
  if (bookings.isError || floor.isError)
    return (
      <ErrorState
        title="Couldn’t load the overview"
        onRetry={() => {
          if (bookings.isError) void bookings.refetch();
          if (floor.isError) void floor.refetch();
        }}
      />
    );

  const all = bookings.data;
  const tables = floor.data.flatMap((area) => area.tables);
  const split = splitBookings(all, today, timeZone);
  const openHost = onOpenHost ? (target?: HostTarget) => onOpenHost(target) : undefined;

  if (all.length === 0)
    return (
      <EmptyState
        className="flex-1"
        icon={CalendarCheck}
        title={`No bookings in the last ${PAST_DAYS} days`}
        description="Bookings taken in Host fill this in."
        action={openHost ? { label: 'Open Host', onClick: () => openHost() } : undefined}
      />
    );

  const today_ = todayFigures({
    bookings: split.today,
    tables,
    waitlist,
    now,
    today,
    truncated: all.length >= BOOKINGS_LIMIT,
    onOpenHost: openHost,
  });
  const tiles = Object.fromEntries(Object.entries(today_.tiles).map(([key, node]) => [key, () => node])) as Record<
    keyof typeof today_.tiles,
    () => React.ReactNode
  >;
  const cards: Record<OverviewCardKey, () => React.ReactNode> = {
    ...tiles,
    week: () => (
      <NextDays
        bookings={split.ahead}
        days={range.ahead}
        seats={seatsAtMost(tables)}
        today={today}
        onOpenDay={openHost ? (date) => openHost({ tab: 'bookings', date }) : undefined}
      />
    ),
    hours: () => <BusiestHours bookings={split.past} />,
    quality: () => <Quality bookings={split.past} tableCount={tables.length} />,
    guests: () => <Guests bookings={split.past} />,
  };

  return (
    <div className="flex flex-col gap-5">
      <NeedsAttention items={today_.attention} label="Needs attention today" />
      <OverviewBoard cards={cards} />
    </div>
  );
}

// ─── The board ────────────────────────────────────────────────────────────────

/**
 * A person's arrangement of the overview, kept per workspace in their browser. It is a preference about
 * their own screen — nothing anyone else sees — and if it is ever lost the overview is simply the default.
 */
function useOverviewLayout() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const key = tenantId && userId ? `duma:reservations-overview:${tenantId}:${userId}` : null;
  const read = () => {
    try {
      return key ? readOverviewLayout(window.localStorage.getItem(key)) : null;
    } catch {
      return null;
    }
  };
  const [saved, setSaved] = useState<Cell[] | null>(() => (typeof window === 'undefined' ? null : read()));
  const save = (cells: Cell[] | null) => {
    setSaved(cells);
    try {
      if (!key) return;
      if (cells) window.localStorage.setItem(key, JSON.stringify(cells));
      else window.localStorage.removeItem(key);
    } catch {
      // Storage refused (a private window): the arrangement lasts until the page closes.
    }
  };
  return [saved, save] as const;
}

/**
 * The overview's cards on the dashboard's grid. "Edit overview" in the avatar menu (`?edit=1`) arranges it the
 * same way: drag, resize at the corner, remove with the badge, add back from the bar; Done keeps it, Cancel
 * puts it back. Editing needs the four-column board, a tablet's width or more; a phone reads it in two.
 */
function OverviewBoard({ cards }: { cards: Record<OverviewCardKey, () => React.ReactNode> }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const editing = searchParams.get('edit') === '1';
  const [saved, save] = useOverviewLayout();
  const editor = useGridEditor(saved ?? DEFAULT_OVERVIEW_LAYOUT, DEFAULT_OVERVIEW_LAYOUT, saved !== null, OVERVIEW_COLUMNS);
  const [boardWidth, setBoardWidth] = useState<number | null>(null);
  const canEdit = editing && boardWidth !== null && boardMetrics(boardWidth).columns === BOARD_COLUMNS;
  const [adding, setAdding] = useState(false);
  const layout = editing ? editor.cells : (saved ?? DEFAULT_OVERVIEW_LAYOUT);
  const hidden = (Object.keys(OVERVIEW_CARDS) as OverviewCardKey[]).filter((key) => !layout.some((cell) => cell.key === key));

  const leave = () => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete('edit');
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const done = () => {
    if (editor.resetRequested) save(null);
    else if (editor.isDirty) save(editor.cells);
    editor.cancel();
    leave();
  };
  const cancel = () => {
    editor.cancel();
    leave();
  };

  const widgets = Object.fromEntries(
    (Object.keys(OVERVIEW_CARDS) as OverviewCardKey[]).map((key) => [
      key,
      { label: OVERVIEW_CARDS[key].label, sizes: OVERVIEW_CARDS[key].sizes, render: cards[key] },
    ]),
  );

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        // The edit controls stay in reach over the board while you scroll, as on the dashboard.
        <div
          className="sticky top-2 z-30 flex items-center gap-2 rounded-lg border border-border bg-card/95 p-1.5 shadow-sm backdrop-blur-sm"
          role="group"
          aria-label="Edit overview"
        >
          <Popover open={adding} onOpenChange={setAdding}>
            <PopoverTrigger asChild>
              <Button variant="outline" disabled={hidden.length === 0}>
                <Plus aria-hidden="true" /> Add card
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              {hidden.map((key) => (
                <Button
                  key={key}
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={() => {
                    editor.add(key, OVERVIEW_CARDS[key].sizes[0]!);
                    setAdding(false);
                  }}
                >
                  {OVERVIEW_CARDS[key].label}
                </Button>
              ))}
            </PopoverContent>
          </Popover>
          <Button variant="ghost" onClick={editor.reset}>
            <RotateCcw aria-hidden="true" /> Reset
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button onClick={done}>Done</Button>
          </div>
        </div>
      )}
      {editing && boardWidth !== null && !canEdit && (
        <p className="text-sm text-muted-foreground">Widen the window to arrange the overview.</p>
      )}
      <WidgetGrid
        widgets={widgets}
        layout={layout}
        editing={canEdit}
        onChange={editor.change}
        onRemove={editor.remove}
        onMeasure={setBoardWidth}
      />
      {layout.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {canEdit
            ? 'Add a card to build your overview.'
            : 'Every card is hidden. Choose Edit overview in your account menu to add them back.'}
        </p>
      )}
    </div>
  );
}

/** A tall card on the board: its title, the reading filling the cell, and how it's counted behind the info mark. */
function OverviewCard({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm">
      <header className="flex shrink-0 items-center gap-1.5 px-5 pt-4">
        <h2 className="text-base font-semibold tracking-title text-heading">{title}</h2>
        <Tooltip label={note} side="bottom" wrap>
          <span
            tabIndex={0}
            aria-label={`How ${title.toLowerCase()} is counted`}
            className="grid size-6 place-items-center rounded-sm text-muted-foreground"
          >
            <Info size={14} aria-hidden="true" />
          </span>
        </Tooltip>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-3 pb-4">{children}</div>
    </section>
  );
}

// ─── Today at a glance ────────────────────────────────────────────────────────

/** Today's figures: what needs someone (the strip above the board) and each figure as its own tile. */
function todayFigures({
  bookings,
  tables,
  waitlist,
  now,
  today,
  truncated,
  onOpenHost,
}: {
  bookings: Booking[];
  tables: { id: string; maxCovers: number }[];
  waitlist: UseQueryResult<WaitlistEntry[]>;
  now: Date;
  today: string;
  truncated: boolean;
  onOpenHost?: (target?: HostTarget) => void;
}): {
  attention: NeedsAttentionItem[];
  tiles: Record<'covers' | 'to-come' | 'walk-ins' | 'no-shows' | 'waitlist' | 'tables-free', React.ReactNode>;
} {
  const timeZone = workspaceTimeZone();
  const glance = todayGlance(bookings);
  const usage = floorUsage(tables, bookings, now);
  const queue = waitlist.data ? waitlistOverview(waitlist.data, now) : null;
  const openBookings = onOpenHost ? () => onOpenHost({ tab: 'bookings', date: today }) : undefined;
  const openWaitlist = onOpenHost ? () => onOpenHost({ tab: 'waitlist' }) : undefined;

  const late = lateBookings(bookings, { now, isToday: true });
  const unconfirmed = unconfirmedToday(bookings, now);
  const tooBig = overCapacity(bookings, tables);
  const seatsOf = (booking: Booking) =>
    booking.tables.reduce((sum, held) => sum + (tables.find((table) => table.id === held.id)?.maxCovers ?? 0), 0);
  const fix = openBookings && { label: 'Open', run: openBookings };

  const attention: NeedsAttentionItem[] = [
    ...late.map((booking) => ({
      key: `late-${booking.id}`,
      tone: 'exception' as const,
      icon: Clock,
      title: `${booking.guestName} is ${minutesLabel(minutesBetween(booking.startsAt, now))} late`,
      detail: [
        guests(booking.partySize),
        `booked ${slotOf(booking.startsAt, timeZone)}`,
        booking.tables.map((table) => table.label).join('+'),
      ]
        .filter(Boolean)
        .join(' · '),
      ...(fix && { fix }),
    })),
    ...(unconfirmed.length
      ? [
          {
            key: 'unconfirmed',
            tone: 'measured' as const,
            icon: CalendarClock,
            title: `${plural(unconfirmed.length, 'booking', 'bookings')} not confirmed`,
            detail: `${guests(unconfirmed.reduce((sum, booking) => sum + booking.partySize, 0))} today and tonight`,
            ...(openBookings && { fix: { label: 'Show', run: openBookings } }),
          },
        ]
      : []),
    ...tooBig.map((booking) => ({
      key: `too-big-${booking.id}`,
      tone: 'measured' as const,
      icon: Users,
      title: `${booking.guestName}’s party of ${booking.partySize} outgrows ${booking.tables.map((table) => table.label).join('+')}`,
      detail: `${plural(seatsOf(booking), 'seat', 'seats')} · ${slotOf(booking.startsAt, timeZone)}`,
      ...(fix && { fix }),
    })),
    ...(truncated
      ? [
          {
            key: 'truncated',
            tone: 'info' as const,
            icon: Info,
            title: `Only the first ${BOOKINGS_LIMIT.toLocaleString('en-GB')} bookings were read`,
            detail: 'figures for the later days may be low',
          },
        ]
      : []),
  ];

  // Each figure is the product's stat tile, a board row tall — the same `Fact` the dashboard's figures are.
  const tile = (fact: React.ReactNode) => <dl className="grid h-full">{fact}</dl>;
  return {
    attention,
    tiles: {
      covers: tile(
        <Fact surface="page" icon={Users} label="Covers" value={`${glance.coversSeated} of ${glance.coversBooked}`} hint="seated so far" />,
      ),
      'to-come': tile(
        <Fact
          surface="page"
          icon={CalendarClock}
          label="Still to come"
          value={glance.toCome}
          hint={guests(glance.toComeCovers)}
          onSelect={openBookings}
        />,
      ),
      'walk-ins': tile(<Fact surface="page" icon={UserPlus} label="Walk-ins" value={glance.walkIns} hint={guests(glance.walkInCovers)} />),
      'no-shows': tile(
        <Fact
          surface="page"
          icon={UserMinus}
          label="No-shows"
          value={glance.noShows}
          hint={glance.noShows ? guests(glance.noShowCovers) : 'none today'}
        />,
      ),
      waitlist: tile(
        <Fact
          surface="page"
          icon={Clock}
          label="Waitlist now"
          value={queue ? plural(queue.parties, 'party', 'parties') : '—'}
          hint={
            waitlist.isError
              ? 'Couldn’t load the waitlist'
              : !queue
                ? undefined
                : queue.parties
                  ? `longest ${minutesLabel(queue.longest, 'just now')}`
                  : 'nobody waiting'
          }
          tone={waitlist.isError ? 'warning' : 'default'}
          onSelect={waitlist.isError ? () => void waitlist.refetch() : openWaitlist}
        />,
      ),
      'tables-free': tile(
        <Fact
          surface="page"
          icon={LayoutGrid}
          label="Tables free now"
          value={usage.tablesTotal ? `${usage.tablesTotal - usage.tables} of ${usage.tablesTotal}` : '—'}
          hint={usage.tablesTotal ? `${guests(usage.covers)} at tables` : 'no floor plan yet'}
          onSelect={onOpenHost ? () => onOpenHost() : undefined}
        />,
      ),
    },
  };
}

// ─── The next seven days ──────────────────────────────────────────────────────

function NextDays({
  bookings,
  days,
  seats,
  today,
  onOpenDay,
}: {
  bookings: Booking[];
  days: string[];
  seats: number;
  today: string;
  onOpenDay?: (date: string) => void;
}) {
  const rows = coversByDay(bookings, days, seats, workspaceTimeZone());
  return (
    <OverviewCard
      title="Next 7 days"
      note={[
        'Covers booked, cancellations and no-shows left out. Lunch starts before 4pm, dinner from 4pm.',
        seats > 0 && `Busy: lunch or dinner fills ${Math.round(BUSY_SHARE * 100)}% of the floor’s ${seats} seats.`,
        onOpenDay && 'Tap a day to open it in Host.',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <WeekCovers days={rows} today={today} onOpenDay={onOpenDay} />
    </OverviewCard>
  );
}

// ─── Service quality ──────────────────────────────────────────────────────────

function Quality({ bookings, tableCount }: { bookings: Booking[]; tableCount: number }) {
  const quality = serviceQuality(bookings, tableCount, PAST_DAYS);
  const { lateness } = quality;
  const minutes = (value: number | null) => (value === null ? '—' : `${Math.round(value)} min`);
  return (
    <OverviewCard
      title="Service quality"
      note="Last 30 days, not counting today. Time at the table runs from seated to finished; a party on two tables turns both. Late means seated after the booked time. Walk-ins are never late, no-shows or cancellations."
    >
      {bookings.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No bookings in the last 30 days.</p>
      ) : (
        <InfoRows>
          <InfoRow icon={Timer} title="Time at the table" description={plural(quality.staysMeasured, 'finished stay', 'finished stays')}>
            <Value>{stayLabel(quality.averageStayMinutes)}</Value>
          </InfoRow>
          <InfoRow
            icon={RotateCcw}
            title="Turns per table"
            description={tableCount ? `a day, over ${plural(tableCount, 'table', 'tables')}` : 'no tables on the floor plan'}
          >
            <Value>{quality.turnsPerTableDay === null ? '—' : quality.turnsPerTableDay.toFixed(1)}</Value>
          </InfoRow>
          <InfoRow
            icon={Clock}
            title="Lateness"
            description={
              lateness.late
                ? `median · average ${minutes(lateness.averageMinutes)} · ${lateness.late} of ${lateness.measured} parties late`
                : lateness.measured
                  ? `nobody late of ${lateness.measured} parties`
                  : 'no seated parties on record'
            }
          >
            <Value>{minutes(lateness.medianMinutes)}</Value>
          </InfoRow>
          <InfoRow
            icon={UserMinus}
            title="No-show rate"
            description={`${quality.noShows} of ${plural(quality.expected, 'booking', 'bookings')}`}
            tone={quality.noShowRate !== null && quality.noShowRate >= 0.1 ? 'warning' : 'default'}
          >
            <Value>{percentLabel(quality.noShowRate)}</Value>
          </InfoRow>
          <InfoRow
            icon={XCircle}
            title="Cancellation rate"
            description={`${quality.cancelled} of ${plural(quality.booked, 'booking', 'bookings')}`}
          >
            <Value>{percentLabel(quality.cancellationRate)}</Value>
          </InfoRow>
        </InfoRows>
      )}
    </OverviewCard>
  );
}

function Value({ children }: { children: React.ReactNode }) {
  return <span className="text-sm font-semibold tabular-nums text-foreground">{children}</span>;
}

// ─── Busiest hours ────────────────────────────────────────────────────────────

function BusiestHours({ bookings }: { bookings: Booking[] }) {
  const grid = coversHeatGrid(bookings, workspaceTimeZone());
  const any = grid.some((row) => row.some((value) => value > 0));
  return (
    <OverviewCard
      title="Busiest hours"
      note={`Covers by the hour bookings start, last 30 days, cancellations and no-shows left out. Times in ${resolvedTimeZone().replaceAll('_', ' ')}.`}
    >
      {any ? <CoversHeatGrid grid={grid} /> : <p className="py-2 text-sm text-muted-foreground">No covers in the last 30 days.</p>}
    </OverviewCard>
  );
}

// ─── Guests ───────────────────────────────────────────────────────────────────

function Guests({ bookings }: { bookings: Booking[] }) {
  const sources = sourceMix(bookings);
  const parties = partyMix(bookings);
  const repeat = repeatGuests(bookings);
  return (
    <OverviewCard
      title="Guests"
      note="Last 30 days, cancellations left out. Repeat guests are bookings by a customer booked more than once in that time; a booking not linked to a customer can’t be recognised."
    >
      {repeat.total === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No bookings in the last 30 days.</p>
      ) : (
        <div className="space-y-5">
          <InfoRow
            icon={Repeat}
            title="Repeat guests"
            description={`${repeat.repeatBookings} of ${plural(repeat.total, 'booking', 'bookings')} · ${plural(repeat.returningGuests, 'guest', 'guests')}`}
          >
            <Value>{percentLabel(repeat.share)}</Value>
          </InfoRow>
          <div className="grid gap-5 sm:grid-cols-2">
            <ShareBars
              title="Source"
              unit={['booking', 'bookings']}
              rows={sources.map((row) => ({ key: row.key, label: SOURCE_LABELS[row.key], count: row.bookings, share: row.share }))}
            />
            <ShareBars
              title="Party size"
              unit={['booking', 'bookings']}
              rows={parties.map((row) => ({ key: row.key, label: PARTY_BAND_LABELS[row.key], count: row.bookings, share: row.share }))}
            />
          </div>
        </div>
      )}
    </OverviewCard>
  );
}

// ─── Loading ──────────────────────────────────────────────────────────────────

function OverviewSkeleton() {
  const section = (height: string) => (
    <div className="space-y-2">
      <Bone className="ml-1 h-4 w-28" />
      <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-sm">
        <Bone className={`w-full ${height}`} />
      </div>
    </div>
  );
  return (
    <div role="status" aria-busy="true" aria-label="Loading the overview" className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <FactSkeleton key={index} surface="page" />
        ))}
      </div>
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          {section('h-52')}
          {section('h-56')}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          {section('h-56')}
          {section('h-48')}
        </div>
      </div>
    </div>
  );
}
