'use client';

import { type UseQueryResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ActionRow, ActionRows, InfoRow, InfoRows } from '@/components/cms/rows';
import { CalendarCheck, Clock, LayoutGrid, LogOut, Pencil, Plus, UserPlus, Users, UsersRound, X } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TimePicker } from '@/components/ui/time-picker';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type Booking, type BookingSource, type DiningArea, createBooking, setBookingStatus } from '@/lib/modules/reservations/client';
import { cn } from '@/lib/utils/cn';
import {
  type FloorTable,
  STATUS_BADGE,
  STATUS_LABELS,
  TABLE_STATE_LABELS,
  type TableState,
  defaultDurationMinutes,
  isLive,
  slotOf,
  tableStatus,
} from '@/lib/utils/reservations';
import { workspaceTimeZone, zonedToInstant } from '@/lib/utils/workspace-time';
import { toast } from '@/stores/toastStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

import { FloorCanvas, TABLE_TONE_LEGEND, ToneSwatch } from './FloorCanvas';
import { useMinuteClock } from './useMinuteClock';

const seatsLabel = (table: Pick<FloorTable, 'minCovers' | 'maxCovers'>) =>
  table.minCovers === table.maxCovers ? `${table.maxCovers}` : `${table.minCovers}–${table.maxCovers}`;

const TONE_BADGE: Record<TableState, 'outline' | 'reference' | 'warning' | 'success'> = {
  free: 'outline',
  soon: 'reference',
  held: 'warning',
  seated: 'success',
};

/**
 * The floor at a moment — now, for today — each table coloured by what it's
 * doing: free, booked within the hour, due but not seated, or seated. Laid out
 * like the Bookings tab: the map in the main column, and in the aside either
 * the floor at a glance (which doubles as the key) or the chosen table — its
 * state, the next step, and its day.
 */
export function FloorView({
  date,
  today,
  floor,
  bookings,
  canWrite,
  canDrawFloor,
  onOpenBooking,
  onNewBooking,
  onDrawFloor,
}: {
  locationId: string;
  date: string;
  today: string;
  floor: UseQueryResult<DiningArea[]>;
  bookings: UseQueryResult<Booking[]>;
  canWrite: boolean;
  canDrawFloor: boolean;
  onOpenBooking: (booking: Booking) => void;
  onNewBooking: (prefill: { time?: string; tableIds?: string[]; partySize?: number; source?: BookingSource }) => void;
  onDrawFloor: () => void;
}) {
  const now = useMinuteClock();
  const timeZone = workspaceTimeZone();
  const isToday = date === today;
  const [pickedTime, setPickedTime] = useState<string | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [walkIn, setWalkIn] = useState<FloorTable | null>(null);
  const showChairs = useUiSettingsStore((state) => state.showChairs);
  const setShowChairs = useUiSettingsStore((state) => state.setShowChairs);

  // Today follows the clock until someone looks at another time.
  const time = pickedTime ?? (isToday ? slotOf(now.toISOString(), timeZone) : '19:00');
  const at = isToday && !pickedTime ? now : (zonedToInstant(date, time, timeZone) ?? now);

  if (floor.isPending) return <Bone className="aspect-[3/2] w-full rounded-lg" />;
  if (floor.isError) return <ErrorState title="Couldn’t load the floor plan" onRetry={() => void floor.refetch()} />;

  const areas = floor.data.filter((area) => area.tables.length > 0);
  if (areas.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={LayoutGrid}
        title="No tables yet"
        description={
          canDrawFloor
            ? 'Draw the floor plan — your rooms and the tables in them — and this page shows which are free, booked or seated.'
            : 'A manager draws the floor plan; then this page shows which tables are free, booked or seated.'
        }
        action={canDrawFloor ? { label: 'Draw the floor plan', onClick: onDrawFloor, icon: Pencil } : undefined}
      />
    );
  }

  const area = areas.find((candidate) => candidate.id === areaId) ?? areas[0]!;
  const dayBookings = bookings.data ?? [];
  const status = (table: FloorTable) => tableStatus(table.id, dayBookings, at);
  const caption = (table: FloorTable) => {
    const current = status(table);
    if (current.state === 'seated' || current.state === 'held') return current.booking!.guestName;
    if (current.state === 'soon') return slotOf(current.booking!.startsAt, timeZone);
    return `${seatsLabel(table)} seats`;
  };
  const selected = area.tables.find((table) => table.id === selectedId) ?? null;
  const counts = area.tables.reduce<Record<TableState, number>>(
    (all, table) => ({ ...all, [status(table).state]: all[status(table).state] + 1 }),
    { free: 0, soon: 0, held: 0, seated: 0 },
  );

  const aside = selected ? (
    <TablePanel
      table={selected}
      at={at}
      bookings={dayBookings.filter((booking) => booking.tables.some((table) => table.id === selected.id))}
      state={status(selected).state}
      current={status(selected).booking as Booking | null}
      isToday={isToday}
      canWrite={canWrite}
      onClose={() => setSelectedId(null)}
      onOpenBooking={onOpenBooking}
      onBook={() =>
        onNewBooking({ time, tableIds: [selected.id], partySize: Math.min(selected.maxCovers, Math.max(selected.minCovers, 2)) })
      }
      onWalkIn={() => setWalkIn(selected)}
    />
  ) : (
    <SettingsSection
      title={isToday && !pickedTime ? 'The floor now' : `The floor at ${time}`}
      footnote="Choose a table to see its day, seat a party or take a walk-in."
    >
      <InfoRows>
        {TABLE_TONE_LEGEND.map((entry) => (
          <div key={entry.tone} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background">
                <ToneSwatch tone={entry.tone} />
              </span>
              <p className="truncate text-sm font-semibold text-foreground">{entry.label}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums">{bookings.isSuccess ? counts[entry.tone as TableState] : '—'}</span>
          </div>
        ))}
        <InfoRow icon={Users} title="Show chairs">
          <Switch checked={showChairs} onChange={setShowChairs} label="Show chairs" />
        </InfoRow>
      </InfoRows>
    </SettingsSection>
  );

  return (
    <SettingsTabBody narrowAside aside={aside}>
      <SettingsSection
        alignActionsToTitle
        title={areas.length > 1 ? 'Floor' : area.name}
        actions={
          <>
            <div className="w-28">
              <TimePicker
                value={time}
                onValueChange={(value) => setPickedTime(value || null)}
                minuteStep={15}
                required
                aria-label="Show the floor at"
              />
            </div>
            {isToday && pickedTime && (
              <Button variant="outline" className="h-9" onClick={() => setPickedTime(null)}>
                Now
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-4">
          {areas.length > 1 && (
            <SegmentedControl<string>
              value={area.id}
              onChange={(value) => {
                setAreaId(value);
                setSelectedId(null);
              }}
              ariaLabel="Area"
              options={areas.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            />
          )}
          {bookings.isError && (
            <ErrorState title="Couldn’t load the day’s bookings — tables show as free" onRetry={() => void bookings.refetch()} className="py-4" />
          )}
          <FloorCanvas
            tables={area.tables}
            toneFor={(table) => status(table).state}
            captionFor={caption}
            selectedId={selectedId}
            onSelect={setSelectedId}
            showChairs={showChairs}
            ariaLabel={`${area.name} floor plan`}
            className="bg-background"
          />
        </div>
      </SettingsSection>
      {walkIn && <WalkInModal table={walkIn} onClose={() => setWalkIn(null)} />}
    </SettingsTabBody>
  );
}

function TablePanel({
  table,
  at,
  bookings,
  state,
  current,
  isToday,
  canWrite,
  onClose,
  onOpenBooking,
  onBook,
  onWalkIn,
}: {
  table: FloorTable;
  at: Date;
  bookings: Booking[];
  state: TableState;
  current: Booking | null;
  isToday: boolean;
  canWrite: boolean;
  onClose: () => void;
  onOpenBooking: (booking: Booking) => void;
  onBook: () => void;
  onWalkIn: () => void;
}) {
  const queryClient = useQueryClient();
  const timeZone = workspaceTimeZone();
  const step = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Booking['status'] }) => setBookingStatus(id, status),
    onSuccess: (booking) => {
      toast('success', `${booking.guestName}: ${STATUS_LABELS[booking.status].toLowerCase()}.`);
      return queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
    },
    onError: (error) => toast('error', error.message),
  });
  const next = bookings
    .filter((booking) => isLive(booking.status) && booking.id !== current?.id && new Date(booking.startsAt) > at)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];

  return (
    <>
      <SettingsSection
        title={`Table ${table.label}`}
        actions={
          <>
            <Badge variant={TONE_BADGE[state]}>{TABLE_STATE_LABELS[state]}</Badge>
            <Button variant="ghost" size="icon-sm" aria-label="Back to the floor" onClick={onClose}>
              <X size={15} />
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <InfoRows>
            <InfoRow icon={Users} title="Seats">
              <span className="text-sm font-semibold tabular-nums">{seatsLabel(table)}</span>
            </InfoRow>
            <InfoRow icon={UsersRound} title={current?.status === 'seated' ? 'Seated' : current ? 'Due' : 'Now'}>
              <span className="truncate text-sm font-semibold">
                {current ? `${current.guestName} · ${current.partySize}` : 'Free'}
              </span>
            </InfoRow>
            <InfoRow icon={Clock} title="Next">
              <span className="truncate text-sm font-semibold">
                {next ? `${slotOf(next.startsAt, timeZone)} · ${next.guestName}` : <span className="font-normal text-muted-foreground">Nothing later</span>}
              </span>
            </InfoRow>
          </InfoRows>
          {canWrite && (
            <ActionRows>
              {current?.status === 'seated' && (
                <ActionRow
                  icon={LogOut}
                  label="Finish — free the table"
                  disabled={step.isPending}
                  onClick={() => step.mutate({ id: current.id, status: 'completed' })}
                />
              )}
              {current && current.status !== 'seated' && isToday && (
                <ActionRow
                  icon={CalendarCheck}
                  label={`Seat ${current.guestName}`}
                  disabled={step.isPending}
                  onClick={() => step.mutate({ id: current.id, status: 'seated' })}
                />
              )}
              {!current && isToday && <ActionRow icon={UserPlus} label="Seat a walk-in" onClick={onWalkIn} />}
              <ActionRow icon={Plus} label="Book this table" onClick={onBook} />
            </ActionRows>
          )}
        </div>
      </SettingsSection>

      <SettingsSection title="This day">
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No bookings on this table.</p>
        ) : (
          <ul className="space-y-2">
            {bookings.map((booking) => (
              <li key={booking.id}>
                <button
                  type="button"
                  onClick={() => onOpenBooking(booking)}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg border border-rule/50 bg-control px-3 py-2.5 text-left transition-colors hover:bg-band/40',
                    !isLive(booking.status) && 'opacity-70',
                  )}
                >
                  <span className="w-11 shrink-0 text-sm font-semibold tabular-nums text-foreground">{slotOf(booking.startsAt, timeZone)}</span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {booking.guestName}
                    <span className="font-normal text-muted-foreground"> · {booking.partySize}</span>
                  </span>
                  <Badge variant={STATUS_BADGE[booking.status]} className="shrink-0">
                    {STATUS_LABELS[booking.status]}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </>
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
      description="Held from now for the stay — the floor shows it seated."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={seat.isPending}>
            Cancel
          </Button>
          <Button size="lg" className="flex-1" onClick={() => seat.mutate()} disabled={seat.isPending}>
            <CalendarCheck size={15} aria-hidden="true" />
            {seat.isPending ? 'Seating…' : 'Seat'}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <NumberStepper label="Guests" value={partySize} min={1} max={200} unit="guests" onChange={setPartySize} />
        <SegmentedControl<string>
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
