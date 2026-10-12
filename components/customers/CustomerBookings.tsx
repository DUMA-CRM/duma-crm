'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { SettingsSection } from '@/components/settings/SettingsSection';
import { ErrorState } from '@/components/shared/ErrorState';
import { TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Badge } from '@/components/ui/badge';

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

  const row = (booking: CustomerBooking) => (
    <li
      key={booking.id}
      className={cn(
        'flex items-center gap-3 rounded-lg border border-rule/50 bg-control px-3 py-2.5',
        !isLive(booking.status) && 'opacity-75',
      )}
    >
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">
          {formatInstant(booking.startsAt, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
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
      description={
        query.isSuccess && all.length > 0
          ? `${all.length} ${all.length === 1 ? 'booking' : 'bookings'}${noShows ? ` · ${noShows} no-show${noShows === 1 ? '' : 's'}` : ''}`
          : 'Their table bookings, coming up and past.'
      }
      actions={
        <Link href="/reservations" className="text-sm text-reference underline-offset-4 hover:underline">
          Reservations
        </Link>
      }
    >
      {query.isPending ? (
        <TilesSkeleton count={2} label="Loading bookings" />
      ) : query.isError ? (
        <ErrorState className="py-6" title="Bookings couldn’t be loaded" onRetry={() => void query.refetch()} />
      ) : all.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">No bookings linked to this customer yet.</p>
      ) : (
        <div className="space-y-4">
          {upcoming.length > 0 && (
            <section aria-label="Coming up">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Coming up</p>
              <ul className="space-y-2">{upcoming.map(row)}</ul>
            </section>
          )}
          {past.length > 0 && (
            <section aria-label="Past">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Past</p>
              <ul className="space-y-2">{past.slice(0, 10).map(row)}</ul>
            </section>
          )}
        </div>
      )}
    </SettingsSection>
  );
}
