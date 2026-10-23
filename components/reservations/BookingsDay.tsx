'use client';

import { type UseQueryResult, useMutation, useQueryClient } from '@tanstack/react-query';

import { InfoRow, InfoRows } from '@/components/cms/rows';
import { AlertTriangle, CalendarCheck, CheckCircle2, Clock, Plus, Users, UsersRound, XCircle } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type Booking, setBookingStatus } from '@/lib/modules/reservations/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import {
  STATUS_BADGE,
  STATUS_LABELS,
  bookingActions,
  groupBySlot,
  isLive,
  isRunningLate,
  minutesBetween,
  slotOf,
  summariseDay,
} from '@/lib/utils/reservations';
import { workspaceTimeZone } from '@/lib/utils/workspace-time';

import { useMinuteClock } from './useMinuteClock';

/**
 * One day's bookings, under the time each starts, with the next step a tap
 * away (seat, finish, restore). The rest — moving, tables, cancelling — is in
 * the booking's drawer. Cancelled bookings stay listed, greyed, at the foot.
 */
export function BookingsDay({
  date,
  today,
  query,
  canWrite,
  onOpen,
  onNew,
}: {
  date: string;
  today: string;
  query: UseQueryResult<Booking[]>;
  canWrite: boolean;
  onOpen: (booking: Booking) => void;
  onNew: () => void;
}) {
  const now = useMinuteClock();
  const queryClient = useQueryClient();
  const step = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Booking['status'] }) => setBookingStatus(id, status),
    onSuccess: (booking) => {
      toast('success', `${booking.guestName}: ${STATUS_LABELS[booking.status].toLowerCase()}.`);
      return queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
    },
    onError: (error) => toast('error', error.message),
  });

  const all = query.data ?? [];
  const live = all.filter((booking) => booking.status !== 'cancelled');
  const cancelled = all.filter((booking) => booking.status === 'cancelled');
  const timeZone = workspaceTimeZone();

  if (query.isSuccess && all.length === 0) {
    return (
      <EmptyState
        className="flex-1"
        icon={CalendarCheck}
        title={date === today ? 'No bookings today' : 'No bookings this day'}
        description={
          canWrite
            ? 'Take a booking by phone or for a walk-in — give it tables and the floor shows it.'
            : 'Bookings appear here once someone takes one.'
        }
        action={canWrite ? { label: 'New booking', onClick: onNew, icon: Plus } : undefined}
      />
    );
  }

  const row = (booking: Booking) => {
    const late = date === today && isRunningLate(booking, now);
    const primary = bookingActions(booking.status).find((action) => action.primary);
    return (
      <li
        key={booking.id}
        className={cn(
          'flex items-center gap-3 rounded-lg border border-rule/50 bg-control px-3 py-2.5',
          !isLive(booking.status) && 'opacity-70',
        )}
      >
        <button type="button" onClick={() => onOpen(booking)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="w-12 shrink-0 text-sm font-semibold tabular-nums text-foreground">{slotOf(booking.startsAt, timeZone)}</span>
          <span className="min-w-0 flex-1">
            <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-foreground">
              <span className="truncate">{booking.guestName}</span>
              <span className="shrink-0 font-normal text-muted-foreground">· {booking.partySize}</span>
              {late && (
                <Badge variant="warning" className="shrink-0">
                  {minutesBetween(booking.startsAt, now)} min late
                </Badge>
              )}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {booking.tables.length ? booking.tables.map((table) => table.label).join(' + ') : 'No table yet'}
              {` · ${minutesBetween(booking.startsAt, booking.endsAt)} min`}
              {booking.notes && ` · ${booking.notes}`}
            </span>
          </span>
          <Badge variant={STATUS_BADGE[booking.status]} className="shrink-0">
            {STATUS_LABELS[booking.status]}
          </Badge>
        </button>
        {canWrite && primary && (
          <Button
            variant={primary.status === 'seated' ? 'default' : 'outline'}
            size="sm"
            className="shrink-0"
            disabled={step.isPending}
            onClick={() => step.mutate({ id: booking.id, status: primary.status })}
          >
            {primary.label}
          </Button>
        )}
      </li>
    );
  };

  return (
    <SettingsTabBody narrowAside aside={<DayAside bookings={all} loaded={query.isSuccess} />}>
      {query.isPending ? (
        <TilesSkeleton count={5} label="Loading bookings" />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load the bookings" onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-5">
          {groupBySlot(live, timeZone).map((group) => (
            <section key={group.slot} aria-label={`From ${group.slot}`}>
              <ul className="space-y-2">{group.bookings.map(row)}</ul>
            </section>
          ))}
          {cancelled.length > 0 && (
            <section aria-label="Cancelled">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cancelled</p>
              <ul className="space-y-2">{cancelled.map(row)}</ul>
            </section>
          )}
        </div>
      )}
    </SettingsTabBody>
  );
}

function DayAside({ bookings, loaded }: { bookings: Booking[]; loaded: boolean }) {
  const summary = summariseDay(bookings);
  const unassigned = bookings.filter((booking) => isLive(booking.status) && booking.tables.length === 0).length;
  const value = (n: number) => (loaded ? n : '—');
  return (
    <SettingsSection title="The day">
      <InfoRows>
        <InfoRow icon={CalendarCheck} title="Bookings">
          <span className="text-sm font-semibold tabular-nums">{value(summary.bookings)}</span>
        </InfoRow>
        <InfoRow icon={Users} title="Covers">
          <span className="text-sm font-semibold tabular-nums">{value(summary.covers)}</span>
        </InfoRow>
        <InfoRow icon={UsersRound} title="Seated now">
          <span className="text-sm font-semibold tabular-nums">{value(summary.seated)}</span>
        </InfoRow>
        <InfoRow icon={Clock} title="Still to come">
          <span className="text-sm font-semibold tabular-nums">{value(summary.toCome)}</span>
        </InfoRow>
        <InfoRow icon={XCircle} title="No-shows">
          <span className="text-sm font-semibold tabular-nums">{value(summary.noShows)}</span>
        </InfoRow>
        {loaded && unassigned > 0 ? (
          <InfoRow icon={AlertTriangle} title="Without a table">
            <Badge variant="warning">{unassigned}</Badge>
          </InfoRow>
        ) : loaded && summary.bookings > 0 ? (
          <InfoRow icon={CheckCircle2} title="Every booking has a table">
            <span />
          </InfoRow>
        ) : null}
      </InfoRows>
    </SettingsSection>
  );
}
