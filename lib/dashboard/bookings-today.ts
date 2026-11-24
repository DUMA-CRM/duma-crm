import { type ReservationStatus, minutesBetween } from '../utils/reservations.ts';

interface BookingLike {
  id: string;
  partySize: number;
  startsAt: string;
  status: ReservationStatus;
}

/**
 * Today's bookings as the dashboard reads them. Cancelled and no-show bookings
 * don't count towards the day; the rest split into still to come (booked or
 * confirmed), seated and finished. `next` is the ones still to come, soonest
 * first, and `late` counts those more than 15 minutes past their time — the
 * same grace the host stand uses before it flags a booking.
 */
export function bookingsTodaySummary<T extends BookingLike>(bookings: readonly T[], now: Date) {
  const counted = bookings.filter((booking) => booking.status !== 'cancelled' && booking.status !== 'no_show');
  const next = counted
    .filter((booking) => booking.status === 'booked' || booking.status === 'confirmed')
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  return {
    total: counted.length,
    covers: counted.reduce((sum, booking) => sum + booking.partySize, 0),
    toCome: next.length,
    seated: counted.filter((booking) => booking.status === 'seated').length,
    finished: counted.filter((booking) => booking.status === 'completed').length,
    next,
    late: next.filter((booking) => minutesBetween(booking.startsAt, now) > 15).length,
  };
}
