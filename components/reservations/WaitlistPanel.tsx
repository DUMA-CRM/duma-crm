'use client';

import { type UseQueryResult, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, Bell, CheckCircle2, Clock, LayoutGrid, Loader2, LogOut, Plus, Timer, Users } from '@/components/icons';
import { ChangeRow } from '@/components/settings/controls';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';

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
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { shortDuration } from '@/lib/utils/floor-status';
import {
  type FloorTable,
  WAITLIST_LABELS,
  bestFitTable,
  defaultDurationMinutes,
  minutesBetween,
  seatsAtMost,
  waitTone,
} from '@/lib/utils/reservations';
import { waitlistGroups } from '@/lib/utils/reservations-lists';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

import { FloorCanvas, type TableTone, ToneSwatch } from './FloorCanvas';

const seatsLabel = (table: Pick<FloorTable, 'minCovers' | 'maxCovers'>) =>
  table.minCovers === table.maxCovers ? `${table.maxCovers}` : `${table.minCovers}–${table.maxCovers}`;

const QUOTES = [null, 10, 15, 20, 30, 45] as const;
const STAYS = [60, 90, 120, 150];
const stayLabel = (minutes: number) => (minutes % 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}` : `${minutes / 60}h`);

// ─── The host panel's shared pieces ──────────────────────────────────────────
// Here rather than in `HostPanel`, which imports this file: one direction, no cycle.

/** The focus ring every target in the host panel shares, drawn inside so rows never clip it. */
export const HOST_FOCUS = 'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring';
/** An open row or a chosen table: a soft brand tint and a thin outline, never a heavy fill. */
export const HOST_PICKED = 'bg-primary/5 ring-1 ring-primary/20 ring-inset';

/** The host panel's own scroll — the page never scrolls. Rows sit 8px from the edge, so their tint has room. */
export function PanelScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pt-2 pb-4', className)}>{children}</div>;
}

/** A group's title, above its rows: the name and how many, with the guests at the far end. */
export function GroupTitle({ title, count, aside, tone }: { title: string; count: number; aside?: string; tone?: 'exception' }) {
  return (
    <h3 className="flex h-9 items-center gap-2 px-2">
      <span className={cn('text-sm font-semibold', tone === 'exception' ? 'text-exception' : 'text-heading')}>{title}</span>
      <span className="text-sm tabular-nums text-muted-foreground">{count}</span>
      {aside && <span className="ml-auto text-xs tabular-nums text-muted-foreground">{aside}</span>}
    </h3>
  );
}

const guests = (entries: readonly Pick<WaitlistEntry, 'partySize'>[]) => {
  const count = entries.reduce((sum, entry) => sum + entry.partySize, 0);
  return `${count} ${count === 1 ? 'guest' : 'guests'}`;
};

// ─── The waitlist ────────────────────────────────────────────────────────────

/**
 * The host stand's waitlist, in the host panel: *Waiting · Off the list* and
 * *Add party* pinned at the top, then the parties told their table is ready and
 * those still waiting, each longest first. A row shows the wait against the
 * quote (saffron near it, red past it, in words too) and *Seat*; tapping it
 * opens the phone, the note, *Ready* (or *Not yet*) and *Left without a table*.
 * *Off the list* shows the last 12 hours, with *Back on the list*. Seating is
 * the caller's: it owns the seat modal, so a free table on the floor can seat
 * a party too.
 */
export function HostWaitlist({
  locationId,
  query,
  now,
  canWrite,
  onSeat,
}: {
  locationId: string;
  query: UseQueryResult<WaitlistEntry[]>;
  /** The wall clock — waits move with it. */
  now: Date;
  canWrite: boolean;
  onSeat: (entry: WaitlistEntry) => void;
}) {
  const queryClient = useQueryClient();
  const [view, setView] = useState<'waiting' | 'recent'>('waiting');
  const [adding, setAdding] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const showRecent = view === 'recent';
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

  const header = (
    <div className="flex shrink-0 items-center gap-2 px-3 pt-3 pb-1">
      <SegmentedControl<'waiting' | 'recent'>
        size="lg"
        value={view}
        onChange={setView}
        ariaLabel="Which parties"
        options={[
          { value: 'waiting', label: 'Waiting' },
          { value: 'recent', label: 'Off the list' },
        ]}
      />
      {canWrite && (
        <Button variant="outline" size="touch" className="ml-auto px-3 text-sm" onClick={() => setAdding(true)}>
          <Plus size={15} aria-hidden="true" />
          Add party
        </Button>
      )}
    </div>
  );

  const modal = adding && canWrite && <AddPartyModal locationId={locationId} onAdded={invalidate} onClose={() => setAdding(false)} />;

  let body: React.ReactNode;
  if (showRecent) {
    const removed = (recent.data ?? []).filter((entry) => entry.removedAt);
    body = recent.isPending ? (
      <RowsSkeleton label="Loading the last 12 hours" />
    ) : recent.isError ? (
      <ErrorState title="Couldn’t load the recent list" onRetry={() => void recent.refetch()} className="py-8" />
    ) : removed.length === 0 ? (
      <EmptyState compact icon={Clock} title="Nobody’s come off the list yet" description="Parties seated or gone in the last 12 hours." />
    ) : (
      <section aria-label="Off the list in the last 12 hours">
        <GroupTitle title="Last 12 hours" count={removed.length} aside={guests(removed)} />
        <ul className="space-y-0.5">
          {removed.map((entry) => (
            <li key={entry.id} className="flex min-h-14 items-center gap-3 px-2 py-2">
              <WaitMinutes minutes={minutesBetween(entry.createdAt, entry.removedAt!)} muted />
              <span className="min-w-0 flex-1">
                <PartyName entry={entry} muted />
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">{WAITLIST_LABELS[entry.status]}</span>
              </span>
              {canWrite && entry.status !== 'seated' && (
                <Button
                  variant="outline"
                  size="touch"
                  className="px-3 text-sm"
                  disabled={move.isPending}
                  onClick={() => move.mutate({ id: entry.id, status: 'waiting' })}
                >
                  Back on the list
                </Button>
              )}
            </li>
          ))}
        </ul>
      </section>
    );
  } else if (query.isPending) {
    body = <RowsSkeleton label="Loading the waitlist" />;
  } else if (query.isError) {
    body = <ErrorState title="Couldn’t load the waitlist" onRetry={() => void query.refetch()} className="py-8" />;
  } else if (query.data.length === 0) {
    body = (
      <EmptyState
        compact
        kind="done"
        icon={Clock}
        title="Nobody’s waiting"
        description={canWrite ? 'Add a party when the floor is full and quote them a wait.' : undefined}
      />
    );
  } else {
    const { ready, waiting } = waitlistGroups(query.data);
    const group = (title: string, entries: WaitlistEntry[]) =>
      entries.length > 0 && (
        <section aria-label={title}>
          <GroupTitle title={title} count={entries.length} aside={guests(entries)} />
          <ul className="space-y-0.5">
            {entries.map((entry) => (
              <WaitRow
                key={entry.id}
                entry={entry}
                now={now}
                canWrite={canWrite}
                expanded={entry.id === openId}
                onToggle={() => setOpenId(entry.id === openId ? null : entry.id)}
                moving={move.isPending}
                leaving={move.isPending && move.variables?.id === entry.id && move.variables.status === 'left'}
                onMove={(status) => move.mutate({ id: entry.id, status })}
                onSeat={() => onSeat(entry)}
              />
            ))}
          </ul>
        </section>
      );
    body = (
      <div className="space-y-4">
        {group('Ready', ready)}
        {group('Waiting', waiting)}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}
      <PanelScroll>{body}</PanelScroll>
      {modal}
    </div>
  );
}

/**
 * One waiting party: the wait over the quote, who and how many, where they
 * stand in a word, and *Seat*. Open, the phone and the note, then *Ready* or
 * *Not yet* and *Left without a table*.
 */
function WaitRow({
  entry,
  now,
  canWrite,
  expanded,
  onToggle,
  moving,
  leaving,
  onMove,
  onSeat,
}: {
  entry: WaitlistEntry;
  now: Date;
  canWrite: boolean;
  expanded: boolean;
  onToggle: () => void;
  /** Any party's status is being changed — one change at a time. */
  moving: boolean;
  leaving: boolean;
  onMove: (status: 'waiting' | 'notified' | 'left') => void;
  onSeat: () => void;
}) {
  const waited = minutesBetween(entry.createdAt, now);
  const tone = waitTone(waited, entry.quotedWaitMinutes);
  const note = entry.notes?.trim();
  // Where they stand, only when it's worth a word: told it's ready, or kept past their quote.
  const word =
    entry.status === 'notified'
      ? {
          text: entry.notifiedAt ? `Told ${shortDuration(minutesBetween(entry.notifiedAt, now))} ago` : 'Told it’s ready',
          tone: 'font-medium text-reference',
        }
      : tone === 'over' && entry.quotedWaitMinutes !== null
        ? { text: `Over by ${shortDuration(waited - entry.quotedWaitMinutes)}`, tone: 'font-medium text-exception' }
        : entry.quotedWaitMinutes === null
          ? { text: 'No wait quoted', tone: '' }
          : null;
  const detail = expanded ? null : (note?.split('\n')[0] ?? null);

  return (
    <li className={cn('rounded-lg transition-colors', expanded && HOST_PICKED)}>
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={expanded}
          onClick={onToggle}
          className={cn(
            'flex min-h-14 min-w-0 flex-1 items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
            HOST_FOCUS,
            !expanded && 'hover:bg-band/40',
          )}
        >
          <WaitMinutes minutes={waited} quoted={entry.quotedWaitMinutes} tone={tone} />
          <span className="min-w-0 flex-1">
            <PartyName entry={entry} />
            {(word || detail) && (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {word && <span className={word.tone}>{word.text}</span>}
                {word && detail && ' · '}
                {detail}
              </span>
            )}
          </span>
        </button>
        {canWrite && (
          <Button size="touch" className="mr-1 min-w-16 px-4" onClick={onSeat}>
            Seat
          </Button>
        )}
      </div>
      {expanded && (
        <div className="space-y-1.5 pb-3 text-sm">
          {(entry.guestPhone || note) && (
            <div className="space-y-1.5 pr-2 pl-[4.25rem]">
              {entry.guestPhone && (
                <p>
                  <a href={`tel:${entry.guestPhone}`} className="tabular-nums text-foreground underline-offset-4 hover:underline">
                    {entry.guestPhone}
                  </a>
                </p>
              )}
              {note && <p className="leading-relaxed break-words whitespace-pre-line text-foreground">{note}</p>}
            </div>
          )}
          {canWrite ? (
            <div className="flex gap-2 px-2 pt-1.5">
              {entry.status === 'waiting' ? (
                <Button size="touch" variant="outline" className="flex-1" disabled={moving} onClick={() => onMove('notified')}>
                  <Bell size={16} aria-hidden="true" />
                  Ready
                </Button>
              ) : (
                <Button size="touch" variant="outline" className="flex-1" disabled={moving} onClick={() => onMove('waiting')}>
                  Not yet
                </Button>
              )}
              <Button
                size="touch"
                variant="ghost"
                className="text-exception hover:text-exception"
                disabled={moving}
                onClick={() => onMove('left')}
              >
                {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut size={16} aria-hidden="true" />}
                Left without a table
              </Button>
            </div>
          ) : (
            !entry.guestPhone && !note && <p className="pr-2 pl-[4.25rem] text-muted-foreground">No phone or note</p>
          )}
        </div>
      )}
    </li>
  );
}

function RowsSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} aria-busy="true">
      <Bone className="mt-2 mb-2 ml-2 h-4 w-20" />
      {[0, 1, 2].map((index) => (
        <div key={index} className="flex min-h-14 items-center gap-3 px-2">
          <span className="w-12 space-y-1.5">
            <Bone className="h-4 w-9" />
            <Bone className="h-3 w-10" />
          </span>
          <Bone className="h-4 min-w-0 flex-1" />
          <Bone className="h-11 w-16 rounded-md" />
        </div>
      ))}
    </div>
  );
}

/** "Patel · 4": who, and how many. */
function PartyName({ entry, muted = false }: { entry: Pick<WaitlistEntry, 'guestName' | 'partySize'>; muted?: boolean }) {
  return (
    <span className={cn('flex min-w-0 items-baseline gap-1 text-base font-semibold', muted ? 'text-muted-foreground' : 'text-heading')}>
      <span className="truncate">{entry.guestName}</span>
      <span className="shrink-0 font-normal tabular-nums text-muted-foreground" aria-label={`${entry.partySize} guests`}>
        · {entry.partySize}
      </span>
    </span>
  );
}

/** Minutes waited, in the row's leading slot — saffron near the quote, red past it — over the quote. */
function WaitMinutes({
  minutes,
  quoted = null,
  tone = 'ok',
  muted = false,
}: {
  minutes: number;
  quoted?: number | null;
  tone?: 'ok' | 'near' | 'over';
  muted?: boolean;
}) {
  return (
    <span className="w-12 shrink-0">
      <span
        className={cn(
          'block text-sm font-semibold tabular-nums',
          muted ? 'text-muted-foreground' : tone === 'over' ? 'text-exception' : tone === 'near' ? 'text-warning' : 'text-foreground',
        )}
      >
        {shortDuration(minutes)}
      </span>
      {quoted !== null && <span className="block text-xs tabular-nums text-muted-foreground">of {quoted}m</span>}
    </span>
  );
}

/** A party joining the list: typed straight through, then added in one tap. */
function AddPartyModal({ locationId, onAdded, onClose }: { locationId: string; onAdded: () => Promise<unknown>; onClose: () => void }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [quote, setQuote] = useState<number | null>(15);
  const [nameMissing, setNameMissing] = useState(false);
  const add = useMutation({
    mutationFn: () =>
      addToWaitlist(locationId, { guestName: name.trim(), guestPhone: phone.trim() || null, partySize, quotedWaitMinutes: quote }),
    onSuccess: async (entry) => {
      toast('success', `${entry.guestName} is on the list.`);
      await onAdded();
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });
  return (
    <Modal
      title="Add a party"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" className="pointer-coarse:h-11" onClick={onClose} disabled={add.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="waitlist-add" className="min-w-32 pointer-coarse:h-11" disabled={add.isPending}>
            {add.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />}
            Add to the list
          </Button>
        </div>
      }
    >
      <form
        id="waitlist-add"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (!name.trim()) {
            setNameMissing(true);
            return void toast('error', 'Add a name to call them by');
          }
          add.mutate();
        }}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Name"
            required
            autoFocus
            value={name}
            placeholder="To call them by"
            error={nameMissing && !name.trim() ? 'Add a name to call them by' : undefined}
            onChange={(event) => setName(event.target.value)}
          />
          <Input
            label="Phone"
            type="tel"
            autoComplete="tel"
            value={phone}
            placeholder="Optional"
            onChange={(event) => setPhone(event.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Party</FieldLabel>
          <NumberStepper
            label="Guests"
            value={partySize}
            min={1}
            max={200}
            unit={partySize === 1 ? 'guest' : 'guests'}
            onChange={setPartySize}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel>Quoted wait (min)</FieldLabel>
          <SegmentedControl<string>
            value={String(quote)}
            onChange={(value) => setQuote(value === 'null' ? null : Number(value))}
            ariaLabel="Quoted wait in minutes"
            options={QUOTES.map((minutes) => ({ value: String(minutes), label: minutes === null ? 'None' : `${minutes}` }))}
            className="w-full [&>button]:flex-1"
          />
        </div>
      </form>
    </Modal>
  );
}

/**
 * Seat a waiting party: the floor map with the tables free for their whole
 * stay ready to tap (booked ones greyed), the best single fit chosen to start
 * with, and the stay and the seats-versus-party check alongside.
 */
export function SeatModal({
  entry,
  locationId,
  floor,
  initialTableIds,
  onClose,
  onSeated,
}: {
  entry: WaitlistEntry;
  locationId: string;
  floor: DiningArea[];
  /** A table chosen on the floor first — stands in for the best fit. */
  initialTableIds?: string[];
  onClose: () => void;
  onSeated: () => Promise<unknown>;
}) {
  const showChairs = useUiSettingsStore((state) => state.showChairs);
  const [duration, setDuration] = useState(defaultDurationMinutes(entry.partySize));
  // Null until someone taps a table: the best fit stands in for it.
  const [picked, setPicked] = useState<string[] | null>(initialTableIds?.length ? initialTableIds : null);
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
  // A table chosen on the floor may not be free for the whole stay: it drops out once availability says so.
  const chosen = (picked ?? (best ? [best.id] : [])).filter((id) => !availability.isSuccess || byId.get(id)?.free !== false);

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
  const area =
    areas.find((candidate) => candidate.id === areaId) ??
    areas.find((candidate) => candidate.tables.some((table) => chosen.includes(table.id))) ??
    areas[0];
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
          <div>
            <ChangeRow
              icon={Timer}
              label="Stay"
              value={stayLabel(duration)}
              open={stayOpen}
              onToggle={() => setStayOpen((open) => !open)}
              verbs={['Change', 'Done']}
              touch
            >
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
            </ChangeRow>
            <ChangeRow
              icon={LayoutGrid}
              label="Tables"
              value={
                chosenTables.length ? (
                  <span className="truncate">{chosenTables.map((table) => table.label).join(' + ')}</span>
                ) : (
                  <span className="font-normal text-muted-foreground">None chosen</span>
                )
              }
            />
            <ChangeRow
              icon={Users}
              label="Seats"
              tone={chosenTables.length > 0 && seats < entry.partySize ? 'warning' : undefined}
              value={
                <span className={cn('tabular-nums', chosenTables.length > 0 && seats < entry.partySize && 'text-measured')}>
                  {chosenTables.length ? `${seats} for ${entry.partySize}` : '—'}
                </span>
              }
            />
            <ChangeRow
              icon={CheckCircle2}
              label="Free for the stay"
              value={<span className="tabular-nums">{availability.isSuccess ? freeCount : '—'}</span>}
            />
          </div>
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
