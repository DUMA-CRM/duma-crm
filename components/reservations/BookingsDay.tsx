'use client';

import { type UseQueryResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { CalendarCheck, Plus, Search, X } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type Booking, setBookingStatus } from '@/lib/modules/reservations/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { STATUS_BADGE, STATUS_LABELS, bookingActions, isLive, isRunningLate, minutesBetween, slotOf } from '@/lib/utils/reservations';
import { BOOKINGS_VIEW_LABELS, type BookingsView, filterBookings, groupBookings, inBookingsView } from '@/lib/utils/reservations-lists';
import { workspaceTimeZone } from '@/lib/utils/workspace-time';

import { useMinuteClock } from './useMinuteClock';

const VIEWS: readonly BookingsView[] = ['all', 'to_come', 'seated', 'late', 'unconfirmed', 'no_table', 'finished', 'no_show', 'cancelled'];

/**
 * One day's bookings as a list — the host stand's List view, beside the panel:
 * a search with the Show select and the count, then the bookings by time of
 * day with the next step a tap away (seat, finish, restore). The rest —
 * moving, tables, cancelling — is in the booking's drawer. The day's figures
 * are on the Overview and what needs chasing is in the panel, so neither is
 * repeated here.
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
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [view, setView] = useState<BookingsView>('all');
  const [search, setSearch] = useState('');
  const step = useMutation({
    mutationFn: ({ id, status }: { id: string; status: Booking['status'] }) => setBookingStatus(id, status),
    onSuccess: (booking) => {
      toast('success', `${booking.guestName}: ${STATUS_LABELS[booking.status].toLowerCase()}.`);
      return queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
    },
    onError: (error) => toast('error', error.message),
  });

  const timeZone = workspaceTimeZone();
  const clock = { now, isToday: date === today };

  if (query.isPending)
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Bone className="h-9 min-w-56 flex-1" />
          <Bone className="h-9 w-40" />
        </div>
        <ListSkeleton rows={5} label="Loading bookings" />
      </div>
    );

  if (query.isError) return <ErrorState className="flex-1" title="Couldn’t load the bookings" onRetry={() => void query.refetch()} />;

  const all = query.data;
  if (all.length === 0)
    return (
      <EmptyState
        className="flex-1"
        icon={CalendarCheck}
        title={date === today ? 'No bookings today' : 'No bookings this day'}
        description={
          canWrite
            ? 'Take one by phone or for a walk-in — give it tables and the floor shows it.'
            : 'Bookings appear here once someone takes one.'
        }
        action={canWrite ? { label: 'New booking', onClick: onNew, icon: Plus } : undefined}
      />
    );

  const shown = filterBookings(all, { view, search }, clock);
  const filtersActive = Boolean(search.trim()) || view !== 'all';
  const clearFilters = () => {
    setSearch('');
    setView('all');
  };
  const viewCount = (value: BookingsView) => all.filter((booking) => inBookingsView(booking, value, clock)).length;

  const groups = groupBookings(shown, timeZone);

  return (
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div
      className="flex flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      <motion.section variants={SECTION_RISE} className="flex flex-col gap-3" aria-label="Bookings">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-56 flex-1">
            <Input
              type="search"
              aria-label="Find a booking by name, phone, note or table"
              placeholder="Name, phone or table…"
              value={search}
              className="pointer-coarse:h-11"
              leftIcon={<Search size={14} aria-hidden="true" />}
              onChange={(event) => setSearch(event.target.value)}
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
            value={view}
            onValueChange={(value) => setView(value as BookingsView)}
            options={VIEWS.map((value) => ({
              value,
              label: `${BOOKINGS_VIEW_LABELS[value]} · ${viewCount(value)}`,
            }))}
            ariaLabel="Which bookings"
            className="w-40"
          />
          <span className="ml-auto text-xs tabular-nums text-muted-foreground" aria-live="polite">
            {filtersActive ? `${shown.length} of ${all.length}` : `${all.length} ${all.length === 1 ? 'booking' : 'bookings'}`}
          </span>
        </div>

        {groups.length === 0 ? (
          <EmptyState
            icon={Search}
            kind="search"
            title="No booking matches"
            description="Try a different search or filter."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        ) : (
          groups.map((group) => (
            <RecordGroup
              key={group.key}
              id={`bookings-${group.key}`}
              title={group.title}
              actions={
                group.covers > 0 ? (
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {group.covers} {group.covers === 1 ? 'cover' : 'covers'}
                  </span>
                ) : undefined
              }
            >
              <ListRowGroup aria-label={group.title}>
                {group.bookings.map((booking) => (
                  <BookingRow
                    key={booking.id}
                    booking={booking}
                    late={clock.isToday && isRunningLate(booking, now)}
                    lateBy={minutesBetween(booking.startsAt, now)}
                    timeZone={timeZone}
                    canWrite={canWrite}
                    pending={step.isPending && step.variables?.id === booking.id}
                    disabled={step.isPending}
                    onOpen={() => onOpen(booking)}
                    onStep={(status) => step.mutate({ id: booking.id, status })}
                  />
                ))}
              </ListRowGroup>
            </RecordGroup>
          ))
        )}
      </motion.section>
    </motion.div>
  );
}

/** One booking: its time, who and how many, tables and stay, its status — and the likely next step at the right edge. */
function BookingRow({
  booking,
  late,
  lateBy,
  timeZone,
  canWrite,
  pending,
  disabled,
  onOpen,
  onStep,
}: {
  booking: Booking;
  late: boolean;
  lateBy: number;
  timeZone?: string;
  canWrite: boolean;
  pending: boolean;
  disabled: boolean;
  onOpen: () => void;
  onStep: (status: Booking['status']) => void;
}) {
  const primary = bookingActions(booking.status).find((action) => action.primary);
  const live = isLive(booking.status);
  return (
    <ListRow
      leading={
        <span className={cn('w-11 shrink-0 text-sm font-semibold tabular-nums', live ? 'text-foreground' : 'text-muted-foreground')}>
          {slotOf(booking.startsAt, timeZone)}
        </span>
      }
      title={
        <>
          {booking.guestName}
          <span className="font-normal text-muted-foreground"> · {booking.partySize}</span>
        </>
      }
      titleExtra={
        <>
          <Badge variant={STATUS_BADGE[booking.status]} className="shrink-0">
            {STATUS_LABELS[booking.status]}
          </Badge>
          {late && (
            <Badge variant="warning" className="shrink-0">
              {lateBy} min late
            </Badge>
          )}
        </>
      }
      meta={
        <>
          {booking.tables.length ? (
            booking.tables.map((table) => table.label).join(' + ')
          ) : (
            <span className="text-measured">No table yet</span>
          )}
          {` · ${minutesBetween(booking.startsAt, booking.endsAt)} min`}
          {booking.notes && ` · ${booking.notes}`}
        </>
      }
      muted={!live}
      targetLabel={`Open ${booking.guestName}’s booking at ${slotOf(booking.startsAt, timeZone)}`}
      onClick={onOpen}
      chevron={false}
      control={
        canWrite && primary ? (
          <Button
            variant={primary.status === 'seated' ? 'default' : 'outline'}
            size="sm"
            className="min-w-16 pointer-coarse:h-11 pointer-coarse:px-4 pointer-coarse:text-sm"
            disabled={disabled}
            aria-busy={pending || undefined}
            onClick={() => onStep(primary.status)}
          >
            {primary.label}
          </Button>
        ) : undefined
      }
    />
  );
}
