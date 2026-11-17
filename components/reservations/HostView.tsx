'use client';

import { type UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import {
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Info,
  LayoutGrid,
  ListView,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  UserPlus,
  Users,
} from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TimePicker } from '@/components/ui/time-picker';

import { useMinWidth } from '@/lib/hooks/useMinWidth';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type Booking,
  type BookingSource,
  type DiningArea,
  type WaitlistEntry,
  createBooking,
  getBookings,
  setBookingStatus,
} from '@/lib/modules/reservations/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { dateToIso, isoToDate } from '@/lib/utils/date';
import {
  type FloorState,
  type FloorTableState,
  floorTableState,
  floorUsage,
  shortDuration,
  waitlistForTable,
} from '@/lib/utils/floor-status';
import { type FloorTable, dayRange, defaultDurationMinutes, minutesBetween, slotOf } from '@/lib/utils/reservations';
import type { HostPanelTab } from '@/lib/utils/reservations-lists';
import { formatCalendarDate, workspaceTimeZone, zonedToInstant } from '@/lib/utils/workspace-time';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

import { BookingsDay } from './BookingsDay';
import { FaceSwatch, FloorCanvas, type TableFace, floorViewBox } from './FloorCanvas';
import { HostPanel, nextBookingLine, tableStateLine } from './HostPanel';
import { SeatModal } from './WaitlistPanel';
import { useMinuteClock } from './useMinuteClock';

const KEY: { state: FloorState; label: string }[] = [
  { state: 'free', label: 'Free' },
  { state: 'upcoming', label: 'Due soon' },
  { state: 'seated', label: 'Seated' },
  { state: 'overdue', label: 'Over time' },
];

/** Landscape on the host stand's iPad: the panel sits beside the floor; narrower, it slides over it. */
const WIDE = 1000;

type NewBookingPrefill = { time?: string; tableIds?: string[]; partySize?: number; source?: BookingSource };

const seatsLabel = (table: Pick<FloorTable, 'minCovers' | 'maxCovers'>) =>
  table.minCovers === table.maxCovers ? `${table.maxCovers}` : `${table.minCovers}–${table.maxCovers}`;

/**
 * The host stand — the day's bookings, the waitlist and the live floor on one
 * page, sized for an iPad at the door. Landscape: the panel (Bookings ·
 * Waitlist · Tables) beside the floor, both filling the screen and scrolling on
 * their own; the panel folds away from the toolbar. Narrower than 1000px the
 * panel is a slide-over opened from the same key, over a full-width floor.
 *
 * The floor shows each table now (ticking every 30 s) or at a chosen time,
 * on the chosen day: free, a party due, seated (with the stay used), over
 * time, and a "?" when it wants a look. Tapping a booked table opens its
 * booking in the panel; a free one offers a walk-in, a booking, or a party
 * from the waitlist, in a sheet beside it. *List* swaps the plan for the
 * day's full bookings list, with its search and filters.
 */
export function HostView({
  locationId,
  date,
  today,
  onDateChange,
  controlsSlot,
  floor,
  waitlist,
  canWrite,
  canDrawFloor,
  initialPanel,
  onOpenBooking,
  onNewBooking,
  onDrawFloor,
}: {
  locationId: string;
  date: string;
  today: string;
  onDateChange: (date: string) => void;
  /** Where the floor's controls go: the right of the page's tab row (no toolbar band of its own). */
  controlsSlot?: HTMLElement | null;
  floor: UseQueryResult<DiningArea[]>;
  waitlist: UseQueryResult<WaitlistEntry[]>;
  canWrite: boolean;
  canDrawFloor: boolean;
  /** The panel's list to open on — an old `?tab=waitlist` link lands on the waitlist. */
  initialPanel: HostPanelTab;
  onOpenBooking: (booking: Booking) => void;
  onNewBooking: (prefill: NewBookingPrefill) => void;
  onDrawFloor: () => void;
}) {
  const queryClient = useQueryClient();
  const now = useMinuteClock();
  const wide = useMinWidth(WIDE);
  const timeZone = workspaceTimeZone();
  const isToday = date === today;
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [focusBookingId, setFocusBookingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<HostPanelTab>(initialPanel);
  const [chosenView, setView] = useState<'plan' | 'list' | null>(null);
  const [walkIn, setWalkIn] = useState<FloorTable | null>(null);
  const [seating, setSeating] = useState<{ entry: WaitlistEntry; tableIds?: string[] } | null>(null);
  const showChairs = useUiSettingsStore((state) => state.showChairs);
  const canvasRef = useRef<HTMLDivElement>(null);

  const range = useMemo(() => dayRange(date, timeZone), [date, timeZone]);
  const bookings = useQuery({
    queryKey: moduleQueryKeys.reservations.key('bookings', locationId, date),
    queryFn: () => getBookings(locationId, range),
    // Another host may seat or book from their own screen.
    refetchInterval: 60_000,
  });

  // Today follows the clock until someone looks at another time.
  // A new day (from the page header's day picker) starts with the clock and nothing chosen.
  const [shownDate, setShownDate] = useState(date);
  if (shownDate !== date) {
    setShownDate(date);
    setPickedTime(null);
    setSelectedTableId(null);
    setFocusBookingId(null);
  }
  const live = isToday && !pickedTime;
  const time = pickedTime ?? (isToday ? slotOf(now.toISOString(), timeZone) : '19:00');
  const atMs = live ? now.getTime() : (zonedToInstant(date, time, timeZone) ?? now).getTime();

  const areas = useMemo(() => (floor.data ?? []).filter((candidate) => candidate.tables.length > 0), [floor.data]);
  const allTables = useMemo(() => areas.flatMap((candidate) => candidate.tables), [areas]);
  // Every table's state, worked out once per tick rather than per row.
  const { statusById, usage } = useMemo(() => {
    const at = new Date(atMs);
    const dayBookings = bookings.data ?? [];
    return {
      statusById: new Map<string, FloorTableState<Booking>>(
        allTables.map((table) => [table.id, floorTableState(table, dayBookings, at, { tables: allTables })]),
      ),
      usage: floorUsage(allTables, dayBookings, at),
    };
  }, [allTables, bookings.data, atMs]);
  const at = useMemo(() => new Date(atMs), [atMs]);

  // The slide-over closes on Escape — unless a dialog above it owns Escape.
  useEffect(() => {
    if (wide || !drawerOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.querySelector('[role="dialog"]')) setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [wide, drawerOpen]);

  const area = areas.find((candidate) => candidate.id === areaId) ?? areas[0];
  const view = chosenView ?? (areas.length > 0 || floor.isPending ? 'plan' : 'list');
  const focusBooking = bookings.data?.find((booking) => booking.id === focusBookingId) ?? null;
  const selectedTable = allTables.find((table) => table.id === selectedTableId) ?? null;
  const selectedStatus = selectedTable ? statusById.get(selectedTable.id) : undefined;
  const areaOf = (tableId: string) => areas.find((candidate) => candidate.tables.some((table) => table.id === tableId));

  const face = (table: FloorTable): TableFace => {
    const status = statusById.get(table.id)!;
    const booking = status.booking;
    return {
      state: status.state,
      caption:
        status.state === 'upcoming'
          ? slotOf(booking!.startsAt, timeZone)
          : status.state === 'overdue'
            ? `+${Math.abs(status.minutesLeft ?? 0)}m`
            : status.state === 'seated'
              ? booking!.guestName
              : null,
      covers: booking?.partySize,
      progress: status.progress,
      attention: Boolean(status.attention),
    };
  };
  // Tables put together for one party, joined on the plan.
  const joins = (area?.tables ?? []).flatMap((table) => {
    const status = statusById.get(table.id)!;
    return status.joined
      .filter((other) => other > table.id && area!.tables.some((candidate) => candidate.id === other))
      .map((other) => ({ from: table.id, to: other, state: status.state }));
  });

  const showArea = (id: string) => {
    setAreaId(id);
    setSelectedTableId(null);
  };
  /** A table chosen on the floor or in the panel's Tables list. */
  const chooseTable = (id: string | null, from: 'floor' | 'panel') => {
    setSelectedTableId(id);
    const booking = id ? statusById.get(id)?.booking : null;
    setFocusBookingId(booking?.id ?? null);
    const home = id ? areaOf(id) : undefined;
    if (home && home.id !== area?.id) setAreaId(home.id);
    if (from === 'floor' && booking) {
      // A booked table opens its booking in the panel.
      setPanelTab('bookings');
      if (!wide) setDrawerOpen(true);
    }
    // From the slide-over, get out of the way of the table just chosen.
    if (from === 'panel' && !wide) setDrawerOpen(false);
  };
  const focusOn = (booking: Booking | null) => {
    setFocusBookingId(booking?.id ?? null);
    setSelectedTableId(null);
    // Show the area the booking's tables are in.
    const first = booking?.tables[0];
    const home = first ? areaOf(first.id) : undefined;
    if (home && home.id !== area?.id) setAreaId(home.id);
  };
  const highlighted = focusBooking ? focusBooking.tables.map((table) => table.id) : selectedTableId ? [selectedTableId] : [];
  // Landscape keeps the panel beside the floor; portrait slides it over, from the header's panel button.
  const togglePanel = () => setDrawerOpen((value) => !value);
  const panelShown = drawerOpen;

  // The free table's sheet: pinned over the table, where it sits in the canvas's view box.
  const box = area ? floorViewBox(area.tables, area.fixtures ?? [], showChairs, 'content') : null;
  const sheetTable =
    view === 'plan' && selectedTable && selectedStatus && !selectedStatus.booking && area?.tables.some((t) => t.id === selectedTable.id)
      ? selectedTable
      : null;

  // The floor's controls, in the page header beside the day: when · area · plan/list (and, in portrait, the panel).
  const controls = (
    <>
      <Button
        variant="outline"
        size="icon"
        className="min-[1000px]:hidden"
        aria-label={panelShown ? 'Hide the host panel' : 'Show the host panel'}
        title={panelShown ? 'Hide the host panel' : 'Show the host panel'}
        aria-pressed={panelShown}
        onClick={togglePanel}
      >
        {panelShown ? <PanelLeftClose size={16} aria-hidden="true" /> : <PanelLeftOpen size={16} aria-hidden="true" />}
      </Button>
      <WhenPicker
        date={date}
        onDate={onDateChange}
        live={live}
        isToday={isToday}
        time={time}
        onTime={(value) => setPickedTime(value)}
        onLive={() => {
          onDateChange(today);
          setPickedTime(null);
        }}
      />
      {view === 'plan' && area && areas.length > 1 && <AreaPicker areas={areas} value={area.id} onChange={showArea} />}
      <SegmentedControl<'plan' | 'list'>
        iconOnly
        value={view}
        onChange={setView}
        ariaLabel="Show the floor as"
        options={[
          { value: 'plan', label: 'Plan', icon: LayoutGrid },
          { value: 'list', label: 'List', icon: ListView },
        ]}
      />
    </>
  );
  const toolbar = controlsSlot ? (
    createPortal(controls, controlsSlot)
  ) : (
    <div className="flex h-14 shrink-0 items-center gap-1.5 overflow-x-auto border-b border-border bg-field px-3 [scrollbar-width:none]">
      {controls}
    </div>
  );
  // How full the floor is, and what the colours mean — a quiet line under the plan.
  const footer = areas.length > 0 && (
    <div className="flex shrink-0 items-center gap-4 px-4 pb-2 text-sm tabular-nums">
      <span title="Tables in use">
        <span className="text-muted-foreground">Tables </span>
        <span className="font-semibold text-heading">{bookings.isSuccess ? `${usage.tables}/${usage.tablesTotal}` : '—'}</span>
      </span>
      <span title="Covers in use">
        <span className="text-muted-foreground">Covers </span>
        <span className="font-semibold text-heading">{bookings.isSuccess ? `${usage.covers}/${usage.coversTotal}` : '—'}</span>
      </span>
      {view === 'plan' && (
        <span className="ml-auto">
          <FloorKey />
        </span>
      )}
    </div>
  );

  let floorBody: React.ReactNode;
  if (view === 'list') {
    floorBody = (
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 md:px-5">
        <BookingsDay date={date} today={today} query={bookings} canWrite={canWrite} onOpen={onOpenBooking} onNew={() => onNewBooking({})} />
      </div>
    );
  } else if (floor.isPending) {
    floorBody = (
      <div className="flex min-h-0 flex-1 p-3">
        <Bone className="h-full w-full rounded-lg" />
      </div>
    );
  } else if (floor.isError) {
    floorBody = <ErrorState className="flex-1" title="Couldn’t load the floor plan" onRetry={() => void floor.refetch()} />;
  } else if (!area) {
    floorBody = (
      <EmptyState
        className="flex-1"
        icon={LayoutGrid}
        title="No tables yet"
        description={
          canDrawFloor
            ? 'Draw the floor plan and this shows which tables are free, booked or seated.'
            : 'A manager draws the floor plan; then this shows which tables are free, booked or seated.'
        }
        action={canDrawFloor ? { label: 'Draw the floor plan', onClick: onDrawFloor, icon: Pencil } : undefined}
      />
    );
  } else {
    const ratio = box!.width / box!.height;
    floorBody = (
      <>
        {bookings.isError && (
          <ErrorState
            title="Couldn’t load the day’s bookings — tables show as free"
            onRetry={() => void bookings.refetch()}
            className="shrink-0 py-3"
          />
        )}
        {/* Sized by container units so the plan fits the space both ways, with no page scroll. */}
        <div className="flex min-h-0 flex-1 items-center justify-center p-3 [container-type:size]">
          <div
            ref={canvasRef}
            className="relative"
            style={{ aspectRatio: `${box!.width} / ${box!.height}`, width: `min(100cqw, calc(100cqh * ${ratio}))` }}
          >
            <FloorCanvas
              tables={area.tables}
              fixtures={area.fixtures ?? []}
              faceFor={face}
              joins={joins}
              selectedIds={highlighted}
              onSelect={(id) => chooseTable(id, 'floor')}
              showChairs={showChairs}
              fit="content"
              ariaLabel={`${area.name} floor`}
              // On the page itself — no card behind the plan.
              className="h-full w-full rounded-none border-0 bg-transparent"
            />
            {sheetTable && (
              <Popover
                open
                onOpenChange={(open) => {
                  if (!open) setSelectedTableId(null);
                }}
              >
                <PopoverAnchor asChild>
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute"
                    style={{
                      left: `${((sheetTable.x - box!.x) / box!.width) * 100}%`,
                      top: `${((sheetTable.y - box!.y) / box!.height) * 100}%`,
                      width: `${(sheetTable.width / box!.width) * 100}%`,
                      height: `${(sheetTable.height / box!.height) * 100}%`,
                    }}
                  />
                </PopoverAnchor>
                <PopoverContent
                  side="right"
                  align="center"
                  sideOffset={10}
                  className="w-72 p-3"
                  // Another table on the plan takes over the selection itself.
                  onInteractOutside={(event) => {
                    if (canvasRef.current?.contains(event.target as Node)) event.preventDefault();
                  }}
                >
                  <FreeTableSheet
                    key={sheetTable.id}
                    table={sheetTable}
                    status={selectedStatus}
                    live={live}
                    isToday={isToday}
                    canWrite={canWrite}
                    waitlist={waitlist.data ?? []}
                    onWalkIn={() => {
                      setWalkIn(sheetTable);
                      setSelectedTableId(null);
                    }}
                    onNewBooking={() => {
                      onNewBooking({
                        time,
                        tableIds: [sheetTable.id],
                        partySize: Math.min(sheetTable.maxCovers, Math.max(sheetTable.minCovers, 2)),
                      });
                      setSelectedTableId(null);
                    }}
                    onSeatParty={(entry) => {
                      setSeating({ entry, tableIds: [sheetTable.id] });
                      setSelectedTableId(null);
                    }}
                    now={now}
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1">
      {drawerOpen && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-40 bg-black/30 duration-200 animate-in fade-in-0 min-[1000px]:hidden"
          onClick={() => setDrawerOpen(false)}
        />
      )}
      <HostPanel
        locationId={locationId}
        bookings={bookings}
        waitlist={waitlist}
        tables={areas.map((candidate) => ({ areaName: candidate.name, tables: candidate.tables }))}
        statusById={statusById}
        at={at}
        now={now}
        live={live}
        isToday={isToday}
        isPast={date < today}
        canWrite={canWrite}
        tab={panelTab}
        onTab={setPanelTab}
        focusBookingId={focusBookingId}
        onFocusBooking={focusOn}
        selectedTableId={selectedTableId}
        onChooseTable={(id) => chooseTable(id === selectedTableId ? null : id, 'panel')}
        onOpenBooking={onOpenBooking}
        onSeatWaitlist={(entry) => setSeating({ entry })}
        onClose={wide ? undefined : () => setDrawerOpen(false)}
        inert={!wide && !drawerOpen}
        className={cn(
          // Portrait: a slide-over from the left, over the floor.
          'fixed inset-y-0 left-0 z-50 w-[min(24rem,calc(100vw-2.5rem))] border-r border-border shadow-xl transition-transform duration-200 motion-reduce:transition-none',
          drawerOpen ? 'translate-x-0' : '-translate-x-full',
          // Landscape: beside the floor, folding away from the toolbar.
          'min-[1000px]:static min-[1000px]:z-auto min-[1000px]:w-[22.5rem] min-[1000px]:shrink-0 min-[1000px]:translate-x-0 min-[1000px]:shadow-none min-[1000px]:transition-none xl:w-96',
        )}
      />
      <section aria-label="The floor" className="@container flex min-h-0 min-w-0 flex-1 flex-col">
        {toolbar}
        {floorBody}
        {footer}
      </section>
      {walkIn && <WalkInModal table={walkIn} onClose={() => setWalkIn(null)} />}
      {seating && (
        <SeatModal
          entry={seating.entry}
          locationId={locationId}
          floor={floor.data ?? []}
          initialTableIds={seating.tableIds}
          onClose={() => setSeating(null)}
          onSeated={() => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all })}
        />
      )}
    </div>
  );
}

/**
 * A free table, tapped on the plan: what can happen at it — seat a walk-in,
 * take a booking, or seat a party from the waitlist (those it seats first).
 */
function FreeTableSheet({
  table,
  status,
  live,
  isToday,
  canWrite,
  waitlist,
  now,
  onWalkIn,
  onNewBooking,
  onSeatParty,
}: {
  table: FloorTable;
  status: FloorTableState<Booking> | undefined;
  live: boolean;
  isToday: boolean;
  canWrite: boolean;
  waitlist: WaitlistEntry[];
  now: Date;
  onWalkIn: () => void;
  onNewBooking: () => void;
  onSeatParty: (entry: WaitlistEntry) => void;
}) {
  const [picking, setPicking] = useState(false);
  const parties = waitlistForTable(waitlist, table);
  const next = nextBookingLine(status);

  if (picking) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-touch" aria-label="Back" onClick={() => setPicking(false)}>
            <ArrowLeft size={18} aria-hidden="true" />
          </Button>
          <p className="text-sm font-semibold text-heading">Seat at {table.label}</p>
        </div>
        <ul className="max-h-72 space-y-0.5 overflow-y-auto" aria-label="Parties waiting">
          {parties.map(({ entry, fits }) => (
            <li key={entry.id}>
              <button
                type="button"
                onClick={() => onSeatParty(entry)}
                className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                  {shortDuration(minutesBetween(entry.createdAt, now))}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold text-heading">{entry.guestName}</span>
                  {!fits && <span className="block text-xs text-warning">Seats {seatsLabel(table)}</span>}
                </span>
                <span
                  className="flex shrink-0 items-center gap-1 text-sm font-semibold tabular-nums text-muted-foreground"
                  aria-label={`${entry.partySize} guests`}
                >
                  <Users size={14} aria-hidden="true" />
                  {entry.partySize}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-11 min-w-11 items-center justify-center rounded-md border border-border bg-background px-1.5 text-base font-semibold text-heading">
          {table.label}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-heading">
            {tableStateLine(status, live).text} · seats {seatsLabel(table)}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{next ?? 'Nothing booked later'}</span>
        </span>
      </div>
      {canWrite && (
        <div className="grid gap-2">
          {isToday && (
            <Button size="touch" className="w-full" onClick={onWalkIn}>
              <UserPlus size={16} aria-hidden="true" />
              Seat walk-in
            </Button>
          )}
          <Button size="touch" variant="outline" className="w-full" onClick={onNewBooking}>
            <Plus size={16} aria-hidden="true" />
            New booking
          </Button>
          {isToday && parties.length > 0 && (
            <Button size="touch" variant="outline" className="w-full" onClick={() => setPicking(true)}>
              <Clock size={16} aria-hidden="true" />
              Seat from waitlist
              <span className="ml-auto text-sm tabular-nums text-muted-foreground">{parties.length}</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A party walks in and the table is free: record a walk-in booking from now
 * and seat it. Two steps on the API; if seating fails, the booking is still
 * there as booked, to be seated from its drawer.
 */
function WalkInModal({ table, onClose }: { table: FloorTable; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [partySize, setPartySize] = useState(Math.min(table.maxCovers, Math.max(table.minCovers, 2)));
  const [duration, setDuration] = useState(defaultDurationMinutes(partySize));
  const seat = useMutation({
    mutationFn: async () => {
      const start = new Date();
      const { data } = await createBooking(table.locationId, {
        guestName: 'Walk-in',
        partySize,
        startsAt: start.toISOString(),
        endsAt: new Date(start.getTime() + duration * 60_000).toISOString(),
        source: 'walk_in',
        tableIds: [table.id],
      });
      return setBookingStatus(data.id, 'seated');
    },
    onSuccess: async () => {
      toast('success', `Walk-in of ${partySize} seated at ${table.label}.`);
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
      onClose();
    },
    onError: async (error) => {
      toast('error', error.message);
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
    },
  });
  return (
    <Modal
      title={`Seat a walk-in at ${table.label}`}
      description="Held from now for the stay."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="touch" className="flex-1" onClick={onClose} disabled={seat.isPending}>
            Cancel
          </Button>
          <Button size="touch" className="flex-1" onClick={() => seat.mutate()} disabled={seat.isPending}>
            <CalendarCheck size={15} aria-hidden="true" />
            {seat.isPending ? 'Seating…' : 'Seat'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <NumberStepper label="Guests" value={partySize} min={1} max={200} unit="guests" onChange={setPartySize} />
        <SegmentedControl<string>
          size="lg"
          value={String(duration)}
          onChange={(value) => setDuration(Number(value))}
          ariaLabel="How long they stay"
          options={[60, 90, 120, 150].map((minutes) => ({
            value: String(minutes),
            label: minutes % 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}` : `${minutes / 60}h`,
          }))}
        />
      </div>
    </Modal>
  );
}

/**
 * When the floor shows, in one control: "● Today · Live 17:10" following the
 * clock, or "Tue 18 Nov · 19:00". Tap it for the calendar and a time, or to go
 * back to live.
 */
function WhenPicker({
  date,
  onDate,
  live,
  isToday,
  time,
  onTime,
  onLive,
}: {
  date: string;
  onDate: (date: string) => void;
  live: boolean;
  isToday: boolean;
  time: string;
  onTime: (time: string | null) => void;
  onLive: () => void;
}) {
  const [open, setOpen] = useState(false);
  const day = isToday ? 'Today' : formatCalendarDate(date, { weekday: 'short', day: 'numeric', month: 'short' });
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="shrink-0 gap-2 tabular-nums"
          aria-label={live ? `Today, live at ${time} — change the day or time` : `${day} at ${time} — change the day or time`}
        >
          {live ? (
            <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
          ) : (
            <CalendarDays size={15} className="text-muted-foreground" aria-hidden="true" />
          )}
          <span className="font-semibold">{day}</span>
          <span className="text-muted-foreground">{live ? `Live ${time}` : time}</span>
          <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto space-y-3 p-3">
        <Calendar
          mode="single"
          selected={isoToDate(date) ?? undefined}
          defaultMonth={isoToDate(date) ?? undefined}
          onSelect={(picked) => {
            if (picked) onDate(dateToIso(picked));
          }}
        />
        <div className="flex items-center gap-2">
          <TimePicker
            value={time}
            onValueChange={(value) => onTime(value || null)}
            minuteStep={15}
            required
            className="h-11 flex-1"
            aria-label="Show the floor at"
          />
          {!live && (
            <Button
              variant="outline"
              size="touch"
              className="shrink-0"
              onClick={() => {
                onLive();
                setOpen(false);
              }}
            >
              <span className="size-2 rounded-full bg-primary" aria-hidden="true" />
              Live
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Which area is on screen — a name and a chevron, opening the list of areas (like the workspace menu). */
function AreaPicker({ areas, value, onChange }: { areas: readonly DiningArea[]; value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = areas.find((candidate) => candidate.id === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="default"
          className="min-w-0 shrink-0 font-semibold"
          aria-label={`Area: ${current?.name ?? ''} — change`}
        >
          <span className="max-w-40 truncate">{current?.name}</span>
          <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-1" role="listbox" aria-label="Areas">
        {areas.map((candidate) => {
          const chosen = candidate.id === value;
          return (
            <button
              key={candidate.id}
              type="button"
              role="option"
              aria-selected={chosen}
              onClick={() => {
                onChange(candidate.id);
                setOpen(false);
              }}
              className="flex min-h-11 w-full items-center gap-2 rounded-md px-2.5 text-left text-sm transition-colors hover:bg-band focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
            >
              <span className={cn('min-w-0 flex-1 truncate', chosen && 'font-semibold text-heading')}>{candidate.name}</span>
              <span className="text-xs tabular-nums text-muted-foreground">{candidate.tables.length}</span>
              {chosen ? (
                <Check size={15} className="text-primary" aria-hidden="true" />
              ) : (
                <span className="size-[15px]" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </PopoverContent>
    </Popover>
  );
}

/** What the table colours mean, behind an ⓘ rather than a line under the plan. */
function FloorKey() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="What the colours mean" title="What the colours mean">
          <Info size={18} aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-3">
        <ul className="space-y-2 text-sm" aria-label="Key">
          {KEY.map((entry) => (
            <li key={entry.state} className="flex items-center gap-2.5">
              <FaceSwatch state={entry.state} />
              {entry.label}
            </li>
          ))}
          <li className="flex items-center gap-2.5">
            <span
              className="flex size-4 items-center justify-center rounded-full bg-measured text-[10px] font-bold text-card"
              aria-hidden="true"
            >
              ?
            </span>
            Needs a look
          </li>
        </ul>
      </PopoverContent>
    </Popover>
  );
}
