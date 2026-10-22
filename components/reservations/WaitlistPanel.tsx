'use client';

import { type UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { InfoRow, InfoRows, PickerRow } from '@/components/cms/rows';
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  Clock,
  LayoutGrid,
  Loader2,
  Phone,
  Plus,
  Timer,
  UserRound,
  Users,
  UsersRound,
  X,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type DiningArea,
  type WaitlistEntry,
  addToWaitlist,
  getAvailability,
  getWaitlist,
  seatWaitlistEntry,
  setWaitlistStatus,
} from '@/lib/modules/reservations/client';
import { cn } from '@/lib/utils/cn';
import {
  type FloorTable,
  WAITLIST_LABELS,
  bestFitTable,
  defaultDurationMinutes,
  minutesBetween,
  seatsAtMost,
  waitTone,
} from '@/lib/utils/reservations';
import { toast } from '@/stores/toastStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

import { FloorCanvas, type TableTone, ToneSwatch } from './FloorCanvas';
import { useMinuteClock } from './useMinuteClock';

const seatsLabel = (table: Pick<FloorTable, 'minCovers' | 'maxCovers'>) =>
  table.minCovers === table.maxCovers ? `${table.maxCovers}` : `${table.minCovers}–${table.maxCovers}`;

const QUOTES = [null, 10, 15, 20, 30, 45] as const;
const STAYS = [60, 90, 120, 150];
const stayLabel = (minutes: number) => (minutes % 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}` : `${minutes / 60}h`);

/**
 * Walk-ins waiting for a table, longest wait first, each against the wait they
 * were quoted. Laid out like the Bookings tab: the list straight on the page,
 * one row per party with its status and the next step, and the day's picture
 * in the aside. Seating one picks free tables and records a walk-in booking,
 * so the floor shows them seated.
 */
export function WaitlistPanel({
  locationId,
  query,
  floor,
  canWrite,
}: {
  locationId: string;
  query: UseQueryResult<WaitlistEntry[]>;
  floor: DiningArea[];
  canWrite: boolean;
}) {
  const now = useMinuteClock();
  const queryClient = useQueryClient();
  const [seating, setSeating] = useState<WaitlistEntry | null>(null);
  const [showRecent, setShowRecent] = useState(false);
  const recent = useQuery({
    queryKey: moduleQueryKeys.reservations.key('waitlist-recent', locationId),
    queryFn: () => getWaitlist(locationId, true),
    enabled: showRecent,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'waiting' | 'notified' | 'left' | 'cancelled' }) => setWaitlistStatus(id, status),
    onSuccess: (entry) => {
      toast('success', `${entry.guestName}: ${WAITLIST_LABELS[entry.status].toLowerCase()}.`);
      return invalidate();
    },
    onError: (error) => toast('error', error.message),
  });

  const waiting = query.data ?? [];
  const longest = waiting.reduce((max, entry) => Math.max(max, minutesBetween(entry.createdAt, now)), 0);
  const removed = (recent.data ?? []).filter((entry) => entry.removedAt);

  const row = (entry: WaitlistEntry) => {
    const waited = minutesBetween(entry.createdAt, now);
    const tone = waitTone(waited, entry.quotedWaitMinutes);
    return (
      <li key={entry.id} className="flex items-center gap-3 rounded-lg border border-rule/50 bg-control px-3 py-2.5">
        <span
          className={cn(
            'w-12 shrink-0 text-sm font-semibold tabular-nums text-foreground',
            tone === 'over' && 'text-exception',
            tone === 'near' && 'text-measured',
          )}
        >
          {waited} min
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
            <span className="truncate">{entry.guestName}</span>
            <span className="shrink-0 font-normal text-muted-foreground">· {entry.partySize}</span>
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {entry.quotedWaitMinutes !== null ? `${entry.quotedWaitMinutes} min quoted` : 'No wait quoted'}
            {entry.guestPhone && ` · ${entry.guestPhone}`}
            {entry.notes && ` · ${entry.notes}`}
          </span>
        </span>
        <Badge
          variant={entry.status === 'notified' ? 'reference' : 'outline'}
          className="hidden shrink-0 sm:inline-flex"
        >
          {entry.status === 'notified' ? 'Told it’s ready' : 'Waiting'}
        </Badge>
        {canWrite && (
          <>
            {entry.status === 'waiting' ? (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={move.isPending}
                onClick={() => move.mutate({ id: entry.id, status: 'notified' })}
              >
                <Bell aria-hidden="true" />
                Ready
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="shrink-0"
                disabled={move.isPending}
                onClick={() => move.mutate({ id: entry.id, status: 'waiting' })}
              >
                Not yet
              </Button>
            )}
            <Button size="sm" className="shrink-0" onClick={() => setSeating(entry)}>
              Seat
            </Button>
            <Tooltip side="top" align="end" label="Left without a table">
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                aria-label={`${entry.guestName} left`}
                disabled={move.isPending}
                onClick={() => move.mutate({ id: entry.id, status: 'left' })}
              >
                <X size={15} />
              </Button>
            </Tooltip>
          </>
        )}
      </li>
    );
  };

  return (
    <SettingsTabBody
      narrowAside
      aside={
        <>
          <SettingsSection title="Right now">
            <InfoRows>
              <InfoRow icon={UsersRound} title="Parties waiting">
                <span className="text-sm font-semibold tabular-nums">{query.isSuccess ? waiting.length : '—'}</span>
              </InfoRow>
              <InfoRow icon={Users} title="Guests waiting">
                <span className="text-sm font-semibold tabular-nums">
                  {query.isSuccess ? waiting.reduce((sum, entry) => sum + entry.partySize, 0) : '—'}
                </span>
              </InfoRow>
              <InfoRow icon={Timer} title="Longest wait">
                <span className="text-sm font-semibold tabular-nums">{query.isSuccess && waiting.length ? `${longest} min` : '—'}</span>
              </InfoRow>
              <InfoRow icon={Bell} title="Told it’s ready">
                <span className="text-sm font-semibold tabular-nums">
                  {query.isSuccess ? waiting.filter((entry) => entry.status === 'notified').length : '—'}
                </span>
              </InfoRow>
            </InfoRows>
          </SettingsSection>
          {canWrite && <AddToWaitlist locationId={locationId} onAdded={invalidate} />}
        </>
      }
    >
      {query.isPending ? (
        <TilesSkeleton count={3} label="Loading the waitlist" />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load the waitlist" onRetry={() => void query.refetch()} />
      ) : waiting.length === 0 ? (
        <EmptyState
          icon={Clock}
          title="Nobody’s waiting"
          description={
            canWrite
              ? 'When the floor is full, add a party with the form alongside — quote them a wait and seat them from here when a table frees up.'
              : 'Parties waiting for a table appear here.'
          }
        />
      ) : (
        <ol className="space-y-2" aria-label="Waiting, longest first">
          {waiting.map(row)}
        </ol>
      )}

      <section aria-label="Came off the list">
        <div className="mb-2 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last 12 hours</p>
          <Button variant="ghost" size="sm" onClick={() => setShowRecent((value) => !value)}>
            {showRecent ? 'Hide' : 'Show'}
          </Button>
        </div>
        {showRecent &&
          (recent.isPending ? (
            <TilesSkeleton count={2} label="Loading" />
          ) : recent.isError ? (
            <ErrorState title="Couldn’t load the recent list" onRetry={() => void recent.refetch()} className="py-4" />
          ) : removed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nobody’s come off the list yet.</p>
          ) : (
            <ul className="space-y-2">
              {removed.map((entry) => (
                <li key={entry.id} className="flex items-center gap-3 rounded-lg border border-rule/50 bg-control px-3 py-2.5 opacity-70">
                  <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {minutesBetween(entry.createdAt, entry.removedAt!)} min
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                    {entry.guestName}
                    <span className="font-normal text-muted-foreground"> · {entry.partySize}</span>
                  </span>
                  <Badge variant={entry.status === 'seated' ? 'success' : 'muted'} className="shrink-0">
                    {WAITLIST_LABELS[entry.status]}
                  </Badge>
                  {canWrite && entry.status !== 'seated' && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      disabled={move.isPending}
                      onClick={() => move.mutate({ id: entry.id, status: 'waiting' })}
                    >
                      Back on the list
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </section>

      {seating && (
        <SeatModal entry={seating} locationId={locationId} floor={floor} onClose={() => setSeating(null)} onSeated={invalidate} />
      )}
    </SettingsTabBody>
  );
}

function AddToWaitlist({ locationId, onAdded }: { locationId: string; onAdded: () => Promise<unknown> }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [quote, setQuote] = useState<number | null>(15);
  // One row open at a time, the name to start with; a tap on the open one closes it.
  const [open, setOpen] = useState<'name' | 'phone' | 'party' | 'quote' | null>('name');
  // Fields take focus once someone is using the form — not when the tab first opens.
  const [engaged, setEngaged] = useState(false);
  const toggle = (row: NonNullable<typeof open>) => {
    setEngaged(true);
    setOpen((current) => (current === row ? null : row));
  };
  const add = useMutation({
    mutationFn: () =>
      addToWaitlist(locationId, { guestName: name.trim(), guestPhone: phone.trim() || null, partySize, quotedWaitMinutes: quote }),
    onSuccess: async (entry) => {
      toast('success', `${entry.guestName} is on the list.`);
      setName('');
      setPhone('');
      setPartySize(2);
      // Ready for the next party.
      setEngaged(true);
      setOpen('name');
      await onAdded();
    },
    onError: (error) => toast('error', error.message),
  });
  return (
    <SettingsSection title="Add a party">
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            setOpen('name');
            return void toast('error', 'Add a name to call them by');
          }
          add.mutate();
        }}
      >
        <PickerRow
          icon={UserRound}
          title="Name"
          value={name.trim() || 'To call them by'}
          muted={!name.trim()}
          open={open === 'name'}
          onToggle={() => toggle('name')}
        >
          <Input aria-label="Name" autoFocus={engaged} value={name} placeholder="To call them by" onChange={(event) => setName(event.target.value)} />
        </PickerRow>
        <PickerRow
          icon={Phone}
          title="Phone"
          value={phone.trim() || 'Optional'}
          muted={!phone.trim()}
          open={open === 'phone'}
          onToggle={() => toggle('phone')}
        >
          <Input aria-label="Phone" autoFocus={engaged} type="tel" value={phone} placeholder="Optional" onChange={(event) => setPhone(event.target.value)} />
        </PickerRow>
        <PickerRow
          icon={Users}
          title="Party"
          value={`${partySize} ${partySize === 1 ? 'guest' : 'guests'}`}
          open={open === 'party'}
          onToggle={() => toggle('party')}
        >
          <NumberStepper label="Guests" value={partySize} min={1} max={200} unit={partySize === 1 ? 'guest' : 'guests'} onChange={setPartySize} />
        </PickerRow>
        <PickerRow
          icon={Clock}
          title="Quoted wait"
          value={quote === null ? 'None' : `${quote} min`}
          open={open === 'quote'}
          onToggle={() => toggle('quote')}
        >
          <SegmentedControl<string>
            value={String(quote)}
            onChange={(value) => setQuote(value === 'null' ? null : Number(value))}
            ariaLabel="Quoted wait in minutes"
            options={QUOTES.map((minutes) => ({ value: String(minutes), label: minutes === null ? '—' : `${minutes}` }))}
            className="w-full [&>button]:flex-1"
          />
        </PickerRow>
        <Button type="submit" className="mt-1 w-full" disabled={add.isPending}>
          {add.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
          Add to the list
        </Button>
      </form>
    </SettingsSection>
  );
}

/**
 * Seat a waiting party: the floor map with the tables free for their whole
 * stay ready to tap (booked ones greyed), the best single fit chosen to start
 * with, and the stay and the seats-versus-party check alongside.
 */
function SeatModal({
  entry,
  locationId,
  floor,
  onClose,
  onSeated,
}: {
  entry: WaitlistEntry;
  locationId: string;
  floor: DiningArea[];
  onClose: () => void;
  onSeated: () => Promise<unknown>;
}) {
  const showChairs = useUiSettingsStore((state) => state.showChairs);
  const [duration, setDuration] = useState(defaultDurationMinutes(entry.partySize));
  // Null until someone taps a table: the best fit stands in for it.
  const [picked, setPicked] = useState<string[] | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [stayOpen, setStayOpen] = useState(false);
  // The window is pinned when the modal opens; the API checks again on seating.
  const [start] = useState(() => new Date());
  const window = { startsAt: start.toISOString(), endsAt: new Date(start.getTime() + duration * 60_000).toISOString() };
  const availability = useQuery({
    queryKey: moduleQueryKeys.reservations.key('availability', locationId, window.startsAt, window.endsAt, entry.partySize, null),
    queryFn: () => getAvailability(locationId, { ...window, partySize: entry.partySize }),
  });
  const byId = new Map((availability.data ?? []).map((table) => [table.id, table]));
  const best = bestFitTable(availability.data ?? []);
  const chosen = picked ?? (best ? [best.id] : []);

  const seat = useMutation({
    mutationFn: () => seatWaitlistEntry(entry.id, chosen, duration),
    onSuccess: async (result) => {
      toast('success', `${entry.guestName} seated at ${result.reservation.tables.map((table) => table.label).join(' + ')}.`);
      await onSeated();
      onClose();
    },
    onError: async (error) => {
      toast('error', error.message);
      // Someone else took a table: show the floor as it is now.
      await availability.refetch();
    },
  });

  const areas = floor.filter((area) => area.tables.length > 0);
  const area = areas.find((candidate) => candidate.id === areaId) ?? areas.find((candidate) => candidate.tables.some((table) => chosen.includes(table.id))) ?? areas[0];
  const tables = floor.flatMap((candidate) => candidate.tables);
  const chosenTables = tables.filter((table) => chosen.includes(table.id));
  const seats = seatsAtMost(chosenTables);
  const freeCount = (availability.data ?? []).filter((table) => table.free).length;
  const toggle = (id: string | null) => {
    if (!id || !byId.get(id)?.free) return;
    setPicked(chosen.includes(id) ? chosen.filter((value) => value !== id) : [...chosen, id]);
  };
  const tone = (table: FloorTable): TableTone => {
    if (chosen.includes(table.id)) return 'chosen';
    const info = byId.get(table.id);
    return !info || info.free ? 'free' : 'muted';
  };
  const caption = (table: FloorTable) => {
    const info = byId.get(table.id);
    if (!info) return null;
    if (!info.free) return 'Booked';
    return `${seatsLabel(table)} seats`;
  };

  return (
    <Modal
      size="2xl"
      title={`Seat ${entry.guestName}`}
      description={`A party of ${entry.partySize}, from now. Tap the tables to seat them at — only tables free for the whole stay can be chosen.`}
      onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={onClose} disabled={seat.isPending}>
            Cancel
          </Button>
          <Button className="min-w-32" onClick={() => seat.mutate()} disabled={seat.isPending || chosen.length === 0}>
            {seat.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {chosenTables.length ? `Seat at ${chosenTables.map((table) => table.label).join(' + ')}` : 'Seat'}
          </Button>
        </div>
      }
    >
      <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-3">
          {areas.length > 1 && area && (
            <SegmentedControl<string>
              value={area.id}
              onChange={setAreaId}
              ariaLabel="Area"
              options={areas.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
            />
          )}
          {!area ? (
            <p className="rounded-md bg-band/60 px-3 py-2 text-sm text-muted-foreground">No tables on the floor plan yet.</p>
          ) : availability.isPending ? (
            <Bone className="aspect-[3/2] w-full rounded-lg" />
          ) : availability.isError ? (
            <ErrorState title="Couldn’t check the tables" onRetry={() => void availability.refetch()} className="py-4" />
          ) : (
            <>
              <FloorCanvas
                tables={area.tables}
                toneFor={tone}
                captionFor={caption}
                selectedIds={chosen}
                onSelect={toggle}
                showChairs={showChairs}
                ariaLabel={`${area.name}: choose tables for ${entry.guestName}`}
                className="bg-background"
              />
              <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground" aria-label="Key">
                {(
                  [
                    ['free', 'Free for the stay'],
                    ['chosen', 'Chosen'],
                    ['muted', 'Booked'],
                  ] as const
                ).map(([key, label]) => (
                  <li key={key} className="flex items-center gap-1.5">
                    <ToneSwatch tone={key} />
                    {label}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div className="space-y-4">
          <InfoRows>
            <PickerRow icon={Timer} title="Stay" value={stayLabel(duration)} open={stayOpen} onToggle={() => setStayOpen((open) => !open)}>
              <SegmentedControl<string>
                value={String(duration)}
                onChange={(value) => {
                  setDuration(Number(value));
                  setPicked(null);
                }}
                ariaLabel="How long they stay"
                options={STAYS.map((minutes) => ({ value: String(minutes), label: stayLabel(minutes) }))}
                className="w-full [&>button]:flex-1"
              />
            </PickerRow>
            <InfoRow icon={LayoutGrid} title="Tables">
              <span className={cn('truncate text-sm font-semibold', !chosenTables.length && 'font-normal text-muted-foreground')}>
                {chosenTables.length ? chosenTables.map((table) => table.label).join(' + ') : 'None chosen'}
              </span>
            </InfoRow>
            <InfoRow icon={Users} title="Seats">
              <span className={cn('text-sm font-semibold tabular-nums', chosenTables.length > 0 && seats < entry.partySize && 'text-measured')}>
                {chosenTables.length ? `${seats} for ${entry.partySize}` : '—'}
              </span>
            </InfoRow>
            <InfoRow icon={CheckCircle2} title="Free for the stay">
              <span className="text-sm font-semibold tabular-nums">{availability.isSuccess ? freeCount : '—'}</span>
            </InfoRow>
          </InfoRows>
          {availability.isSuccess && freeCount === 0 ? (
            <p className="rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
              No table is free for that long — try a shorter stay, or keep them on the list.
            </p>
          ) : chosenTables.length > 0 && seats < entry.partySize ? (
            <p className="flex items-center gap-1.5 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
              <AlertTriangle size={13} aria-hidden="true" />
              Those tables seat {seats}; add another or pull up chairs.
            </p>
          ) : picked === null && best ? (
            <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              {best.label} is the closest fit for {entry.partySize}. Tap others to put tables together.
            </p>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}
