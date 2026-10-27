'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { CalendarDays, Loader2, MapPin, Phone, Users } from '@/components/icons';
import { GuestHeader, GuestUnavailable } from '@/components/shared/GuestChrome';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cancelGuestBooking, getGuestBooking } from '@/lib/modules/reservations/client';
import { STATUS_BADGE } from '@/lib/utils/reservations';

const GUEST_STATUS: Record<string, string> = {
  booked: 'Booked',
  confirmed: 'Confirmed',
  seated: 'You’re here',
  completed: 'Visited',
  cancelled: 'Cancelled',
  no_show: 'Missed',
};

/**
 * The guest's own booking, from the link in their email: when, where, how
 * many — and a cancel button while it's still ahead of them.
 */
export function GuestManageBooking({ token }: { token: string }) {
  const queryClient = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const key = moduleQueryKeys.reservations.key('public-manage', token);
  const booking = useQuery({ queryKey: key, queryFn: () => getGuestBooking(token), retry: false });
  const cancel = useMutation({
    mutationFn: () => cancelGuestBooking(token),
    onSuccess: (next) => {
      queryClient.setQueryData(key, next);
      setConfirming(false);
    },
  });

  if (booking.isPending) {
    return (
      <main className="min-h-dvh bg-background" aria-busy="true">
        <div className="h-20 bg-sidebar" />
        <div className="mx-auto max-w-2xl px-4 py-8">
          <Bone className="h-48 rounded-lg" />
        </div>
      </main>
    );
  }
  if (booking.isError || !booking.data) {
    return (
      <GuestUnavailable title="We couldn’t find that booking">
        Check the link in your confirmation email, or contact the restaurant directly.
      </GuestUnavailable>
    );
  }

  const data = booking.data;
  const zone = data.location.timezone;
  const at = new Date(data.startsAt);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: zone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    at,
  );
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);

  return (
    <main className="min-h-dvh bg-background">
      <GuestHeader brandName={data.brandName} place={data.location.name} />
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <div className="space-y-4 rounded-lg bg-card p-6 shadow-md">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold">Your booking, {data.guestName.split(/\s+/)[0]}</h1>
            <Badge variant={STATUS_BADGE[data.status]}>{GUEST_STATUS[data.status]}</Badge>
          </div>
          <ul className="space-y-2 text-sm">
            <li className="flex items-center gap-2">
              <CalendarDays size={15} className="text-muted-foreground" aria-hidden="true" />
              {day} at {time}
            </li>
            <li className="flex items-center gap-2">
              <Users size={15} className="text-muted-foreground" aria-hidden="true" />
              {data.partySize} {data.partySize === 1 ? 'guest' : 'guests'}
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={15} className="text-muted-foreground" aria-hidden="true" />
              {[data.location.name, data.location.address].filter(Boolean).join(', ')}
            </li>
            {data.location.phone && (
              <li className="flex items-center gap-2">
                <Phone size={15} className="text-muted-foreground" aria-hidden="true" />
                <a href={`tel:${data.location.phone.replace(/\s+/g, '')}`} className="underline underline-offset-2">
                  {data.location.phone}
                </a>
              </li>
            )}
          </ul>

          {data.status === 'cancelled' ? (
            <p className="rounded-md bg-band/60 px-3 py-2 text-sm">This booking is cancelled. We hope to see you another time.</p>
          ) : data.canCancel ? (
            confirming ? (
              <div className="space-y-3 rounded-md border border-exception/40 p-3">
                <p className="text-sm">
                  Cancel your table for {day} at {time}? This can’t be undone online.
                </p>
                {cancel.isError && (
                  <p className="text-sm text-exception" role="alert">
                    {cancel.error.message}
                  </p>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setConfirming(false)} disabled={cancel.isPending}>
                    Keep it
                  </Button>
                  <Button variant="destructive" onClick={() => cancel.mutate()} disabled={cancel.isPending}>
                    {cancel.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                    Cancel booking
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={() => setConfirming(true)}>
                Cancel this booking
              </Button>
            )
          ) : (
            data.status !== 'completed' && (
              <p className="text-sm text-muted-foreground">
                To change this booking, please {data.location.phone ? `call us on ${data.location.phone}` : 'contact us'}.
              </p>
            )
          )}
        </div>
      </div>
    </main>
  );
}
