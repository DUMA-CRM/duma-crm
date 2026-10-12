'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { CalendarDays, CheckCircle2, Clock, Loader2, MapPin, Phone, Users } from '@/components/icons';
import { NumberStepper } from '@/components/shared/FormParts';
import { Logo } from '@/components/shared/Logo';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';

import { ApiError } from '@/lib/api/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type BookingPage, bookTable, getBookingPage, getOpenTimes } from '@/lib/modules/reservations/client';
import { cn } from '@/lib/utils/cn';
import { addDays, guestDetailsProblems, noTimesMessage, upcomingDays } from '@/lib/utils/reservations';
import { formatCalendarDate } from '@/lib/utils/workspace-time';

/** "Fri 3 Jul" for a calendar date. */
const dayLabel = (date: string) => formatCalendarDate(date, { weekday: 'short', day: 'numeric', month: 'short' });

/** "Friday 3 July at 19:30", in the place's own zone. */
function whenLabel(startsAt: string, timeZone: string) {
  const at = new Date(startsAt);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long', day: 'numeric', month: 'long' }).format(at);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at);
  return `${day} at ${time}`;
}

/** The place, in the same dark band as the QR menu. */
export function GuestHeader({ brandName, place }: { brandName: string; place?: string }) {
  return (
    <header className="bg-sidebar text-sidebar-foreground">
      <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-5 sm:px-6">
        <Logo size={38} variant="onDark" />
        <div>
          <p className="font-semibold">{brandName}</p>
          {place && <p className="text-xs text-sidebar-foreground/70">{place}</p>}
        </div>
      </div>
    </header>
  );
}

export function GuestUnavailable({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-5">
      <div className="max-w-md text-center">
        <Logo size={48} className="mx-auto" />
        <h1 className="mt-5 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </main>
  );
}

/**
 * A guest books a table: how many, which day, which time, then who. Times are
 * only those a table that seats the party is free for; the API checks again
 * under lock when they book, so a time taken meanwhile is a polite refusal.
 */
export function GuestBooking({ token }: { token: string }) {
  const page = useQuery({
    queryKey: moduleQueryKeys.reservations.key('public-page', token),
    queryFn: () => getBookingPage(token),
    retry: false,
  });

  if (page.isPending) {
    return (
      <main className="min-h-dvh bg-background" aria-busy="true">
        <div className="h-20 bg-sidebar" />
        <div className="mx-auto max-w-2xl space-y-4 px-4 py-8">
          <Bone className="h-24 rounded-lg" />
          <Bone className="h-48 rounded-lg" />
        </div>
      </main>
    );
  }
  if (page.isError || !page.data) {
    return (
      <GuestUnavailable title="Booking isn’t available here">
        The link may have changed, or this place isn’t taking bookings online just now. Please contact them directly.
      </GuestUnavailable>
    );
  }
  return <BookingSteps token={token} page={page.data} />;
}

function BookingSteps({ token, page }: { token: string; page: BookingPage }) {
  const [partySize, setPartySize] = useState(Math.min(2, page.maxPartySize));
  const [date, setDate] = useState(page.today);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [details, setDetails] = useState({ name: '', email: '', phone: '', notes: '' });
  const [showProblems, setShowProblems] = useState(false);
  const zone = page.location.timezone;

  const times = useQuery({
    queryKey: moduleQueryKeys.reservations.key('public-times', token, date, partySize),
    queryFn: () => getOpenTimes(token, date, partySize),
    enabled: partySize <= page.maxPartySize,
  });
  const book = useMutation({
    mutationFn: () =>
      bookTable(token, {
        startsAt: startsAt!,
        partySize,
        guestName: details.name.trim(),
        guestEmail: details.email.trim(),
        guestPhone: details.phone.trim(),
        ...(details.notes.trim() && { notes: details.notes.trim() }),
      }),
    // A time taken while they typed: back to the times, refreshed. Anything
    // else stays on the form, beside what they typed.
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setStartsAt(null);
        void times.refetch();
      }
    },
  });

  if (book.isSuccess) {
    const booked = book.data;
    return (
      <main className="min-h-dvh bg-background">
        <GuestHeader brandName={page.brandName} place={page.location.name} />
        <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <div className="rounded-lg bg-card p-6 shadow-md">
            <CheckCircle2 size={32} className="text-momentum" aria-hidden="true" />
            <h1 className="mt-3 text-2xl font-semibold">You’re booked, {booked.guestName.split(/\s+/)[0]}</h1>
            <p className="mt-2 text-base text-foreground">
              {whenLabel(booked.startsAt, zone)} · {booked.partySize} {booked.partySize === 1 ? 'guest' : 'guests'}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[booked.location.name, booked.location.address].filter(Boolean).join(', ')}
            </p>
            {page.guestMessage && <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-sm">{page.guestMessage}</p>}
            <p className="mt-4 text-sm text-muted-foreground">
              We’ve sent the details to {details.email.trim()}. If your plans change, you can cancel from the link in that email, or here:
            </p>
            <Button asChild variant="outline" className="mt-3">
              <Link href={`/book/manage/${booked.manageToken}`}>See or cancel your booking</Link>
            </Button>
          </div>
        </div>
      </main>
    );
  }

  const problems = guestDetailsProblems(details);
  const problem = (key: keyof typeof problems) => (showProblems ? problems[key] : undefined);
  const days = upcomingDays(page.today, page.bookingHorizonDays);
  const lastDay = addDays(page.today, page.bookingHorizonDays - 1);

  return (
    <main className="min-h-dvh bg-background">
      <GuestHeader brandName={page.brandName} place={page.location.name} />
      <div className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="text-2xl font-semibold">Book a table</h1>
          {page.location.address && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin size={14} aria-hidden="true" />
              {page.location.address}
            </p>
          )}
          {page.guestMessage && <p className="mt-3 rounded-md bg-band/60 px-3 py-2 text-sm">{page.guestMessage}</p>}
        </div>

        <section className="space-y-2" aria-labelledby="party-heading">
          <h2 id="party-heading" className="flex items-center gap-2 text-sm font-semibold">
            <Users size={15} aria-hidden="true" /> How many?
          </h2>
          <div className="max-w-56">
            <NumberStepper
              label="Guests"
              value={partySize}
              min={1}
              max={page.maxPartySize}
              unit={partySize === 1 ? 'guest' : 'guests'}
              onChange={(next) => {
                setPartySize(next);
                setStartsAt(null);
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            More than {page.maxPartySize}? {page.location.phone ? `Call us on ${page.location.phone}.` : 'Please get in touch.'}
          </p>
        </section>

        <section className="space-y-2" aria-labelledby="day-heading">
          <h2 id="day-heading" className="flex items-center gap-2 text-sm font-semibold">
            <CalendarDays size={15} aria-hidden="true" /> Which day?
          </h2>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {days.map((day) => (
              <button
                key={day}
                type="button"
                aria-pressed={day === date}
                onClick={() => {
                  setDate(day);
                  setStartsAt(null);
                }}
                className={cn(
                  'shrink-0 rounded-lg border px-3 py-2 text-sm transition-colors',
                  day === date ? 'border-primary bg-primary text-primary-foreground' : 'border-rule bg-card hover:bg-band',
                )}
              >
                {day === page.today ? 'Today' : dayLabel(day)}
              </button>
            ))}
          </div>
          {page.bookingHorizonDays > days.length && (
            <div className="max-w-56">
              <DatePicker
                value={date}
                min={page.today}
                max={lastDay}
                onValueChange={(value) => {
                  if (!value) return;
                  setDate(value);
                  setStartsAt(null);
                }}
                aria-label="Another day"
              />
            </div>
          )}
        </section>

        <section className="space-y-2" aria-labelledby="time-heading">
          <h2 id="time-heading" className="flex items-center gap-2 text-sm font-semibold">
            <Clock size={15} aria-hidden="true" /> What time? <span className="font-normal text-muted-foreground">· {dayLabel(date)}</span>
          </h2>
          {book.isError && !startsAt && (
            <p className="rounded-md bg-measured/10 px-3 py-2 text-sm text-measured" role="alert">
              {book.error.message}
            </p>
          )}
          {times.isPending ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" aria-busy="true" aria-label="Finding times">
              {Array.from({ length: 8 }, (_, index) => (
                <Bone key={index} className="h-10 rounded-lg" />
              ))}
            </div>
          ) : times.isError ? (
            <div className="rounded-md bg-exception/8 px-3 py-2 text-sm text-exception" role="alert">
              {times.error.message}{' '}
              <button type="button" className="underline" onClick={() => void times.refetch()}>
                Try again
              </button>
            </div>
          ) : times.data.slots.length === 0 ? (
            <p className="rounded-md bg-band/60 px-3 py-2 text-sm text-muted-foreground">
              {noTimesMessage(times.data.reason, page.location.phone)}
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group" aria-label="Open times">
              {times.data.slots.map((slot) => (
                <button
                  key={slot.startsAt}
                  type="button"
                  aria-pressed={slot.startsAt === startsAt}
                  onClick={() => setStartsAt(slot.startsAt)}
                  className={cn(
                    'h-10 rounded-lg border text-sm font-medium tabular-nums transition-colors',
                    slot.startsAt === startsAt ? 'border-primary bg-primary text-primary-foreground' : 'border-rule bg-card hover:bg-band',
                  )}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}
        </section>

        {startsAt && (
          <form
            className="space-y-4 rounded-lg bg-card p-5 shadow-md"
            onSubmit={(event) => {
              event.preventDefault();
              if (Object.keys(problems).length > 0) return setShowProblems(true);
              book.mutate();
            }}
          >
            <p className="text-base font-semibold">
              {whenLabel(startsAt, zone)} · {partySize} {partySize === 1 ? 'guest' : 'guests'}
            </p>
            <Input
              label="Name"
              autoComplete="name"
              value={details.name}
              onChange={(event) => setDetails({ ...details, name: event.target.value })}
              error={problem('name')}
            />
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                value={details.email}
                onChange={(event) => setDetails({ ...details, email: event.target.value })}
                error={problem('email')}
              />
              <Input
                label="Phone"
                type="tel"
                autoComplete="tel"
                leftIcon={<Phone size={14} />}
                value={details.phone}
                onChange={(event) => setDetails({ ...details, phone: event.target.value })}
                error={problem('phone')}
              />
            </div>
            <label className="block space-y-1.5">
              <span className="text-sm font-medium">Anything we should know? (optional)</span>
              <textarea
                value={details.notes}
                onChange={(event) => setDetails({ ...details, notes: event.target.value })}
                maxLength={500}
                rows={2}
                placeholder="Allergies, a birthday, a high chair…"
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              />
            </label>
            {book.isError && (
              <p className="rounded-md bg-exception/8 px-3 py-2 text-sm text-exception" role="alert">
                {book.error.message}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={book.isPending}>
              {book.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {book.isPending ? 'Booking…' : 'Book the table'}
            </Button>
            <p className="text-xs text-muted-foreground">
              We use these details only for this booking: to confirm it, remind you and reach you if something changes.
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
