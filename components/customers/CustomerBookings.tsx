'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { ArrowUpRight } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type CustomerBooking, getCustomerBookings } from '@/lib/modules/reservations/client';
import { cn } from '@/lib/utils/cn';
import { STATUS_BADGE, STATUS_LABELS, isLive } from '@/lib/utils/reservations';
import { formatInstant } from '@/lib/utils/workspace-time';

/**
 * Their table bookings — coming up first, then the most recent past ones — at
 * the locations the viewer can reach. Only bookings linked to this record:
 * one taken with just a name and phone number isn't found here.
 */
export function CustomerBookings({ customerId }: { customerId: string }) {
  const query = useQuery({
    queryKey: moduleQueryKeys.reservations.key('customer', customerId),
    queryFn: () => getCustomerBookings(customerId),
  });
  // Pinned on mount, so a booking doesn't hop between sections under a render.
  const [now] = useState(() => Date.now());
  const all = query.data ?? [];
  const upcoming = all.filter((booking) => isLive(booking.status) && new Date(booking.endsAt).getTime() > now).reverse();
  const past = all.filter((booking) => !upcoming.includes(booking));
  const noShows = all.filter((booking) => booking.status === 'no_show').length;

  // Plain rows inside the card: an outlined date tile (green for the next one), then when,
  // and party · location · tables, with the state on the right.
  const row = (booking: CustomerBooking, next = false) => (
    <li key={booking.id} className={cn('flex items-center gap-3 rounded-md px-2 py-2', !isLive(booking.status) && 'opacity-75')}>
      <span
        className={cn(
          'flex size-10 shrink-0 flex-col items-center justify-center rounded-md border leading-none',
          next ? 'border-momentum/35 bg-momentum/8 text-momentum' : 'border-border bg-background text-muted-foreground',
        )}
        aria-hidden="true"
      >
        <span className="text-sm font-semibold">{formatInstant(booking.startsAt, { day: 'numeric' })}</span>
        <span className="mt-0.5 text-micro font-semibold uppercase">{formatInstant(booking.startsAt, { month: 'short' })}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-foreground">
          {formatInstant(booking.startsAt, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">
          {booking.partySize} {booking.partySize === 1 ? 'guest' : 'guests'} · {booking.locationName}
          {booking.tables.length > 0 && ` · ${booking.tables.map((table) => table.label).join(' + ')}`}
          {booking.notes && ` · ${booking.notes}`}
        </span>
      </span>
      <Badge variant={STATUS_BADGE[booking.status]} className="shrink-0">
        {STATUS_LABELS[booking.status]}
      </Badge>
    </li>
  );

  return (
    <SettingsSection
      title="Bookings"
      // Only the fact worth flagging; the rows count themselves.
      description={query.isSuccess && noShows > 0 ? `${noShows} no-show${noShows === 1 ? '' : 's'}` : undefined}
      actions={
        <Tooltip label="Open Reservations" side="top">
          <Button asChild variant="ghost" size="icon-sm" className="text-muted-foreground">
            <Link href="/reservations" aria-label="Open Reservations">
              <ArrowUpRight aria-hidden="true" />
            </Link>
          </Button>
        </Tooltip>
      }
    >
      {query.isPending ? (
        <div className="space-y-2" role="status" aria-busy="true" aria-label="Loading bookings">
          <Bone className="h-14 rounded-md" />
          <Bone className="h-14 rounded-md" />
        </div>
      ) : query.isError ? (
        <ErrorState className="py-6" title="Bookings couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : all.length === 0 ? (
        <p className="text-sm text-muted-foreground">No bookings yet.</p>
      ) : (
        // Every booking in one list — coming up first, the next one marked, then the past ones, faded.
        <ul className="-mx-2 flex flex-col gap-0.5">
          {upcoming.map((booking, index) => row(booking, index === 0))}
          {past.map((booking) => row(booking))}
        </ul>
      )}
    </SettingsSection>
  );
}
