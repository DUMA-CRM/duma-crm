'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo, useState } from 'react';

import { CalendarCheck, CalendarDays, ChevronLeft, ChevronRight, Clock, LayoutGrid, MapPin, Pencil, Plus, SlidersHorizontal } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { hasCapability } from '@/lib/auth/capabilities';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type Booking, getBookings, getFloorPlan, getWaitlist } from '@/lib/modules/reservations/client';
import { dateToIso, isoToDate } from '@/lib/utils/date';
import { addDays, dayRange } from '@/lib/utils/reservations';
import { formatCalendarDate, workspaceDateKey, workspaceTimeZone } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { BookingDrawer, type BookingDrawerState } from './BookingDrawer';
import { BookingRules } from './BookingRules';
import { BookingsDay } from './BookingsDay';
import { FloorPlanEditor } from './FloorPlanEditor';
import { FloorView } from './FloorView';
import { WaitlistPanel } from './WaitlistPanel';

type Tab = 'bookings' | 'floor' | 'waitlist' | 'plan' | 'rules';
const TABS: readonly Tab[] = ['bookings', 'floor', 'waitlist', 'plan', 'rules'];

/**
 * Bookings, the live floor, the waitlist and (for managers) the floor plan, for
 * the location chosen in the sidebar. The tab lives in the query string so a
 * refresh or a shared link lands in the same place; the day is local state.
 */
export function ReservationsWorkspace() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locationId = useWorkspaceStore((state) => state.locationId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'reservations:write');
  const canDrawFloor = hasCapability(capabilities, 'reservations.floor:write');
  const canSetRules = hasCapability(capabilities, 'reservations.settings:write');

  const requested = searchParams.get('tab') as Tab | null;
  const tab: Tab =
    requested && TABS.includes(requested) && (requested !== 'plan' || canDrawFloor) && (requested !== 'rules' || canSetRules)
      ? requested
      : 'bookings';
  const setTab = (next: Tab) => {
    const query = new URLSearchParams(searchParams.toString());
    if (next === 'bookings') query.delete('tab');
    else query.set('tab', next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const today = workspaceDateKey();
  const [date, setDate] = useState(today);
  const [drawer, setDrawer] = useState<BookingDrawerState | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const range = useMemo(() => dayRange(date, workspaceTimeZone()), [date]);
  const floor = useQuery({
    queryKey: moduleQueryKeys.reservations.key('floor', locationId),
    queryFn: () => getFloorPlan(locationId!),
    enabled: Boolean(locationId),
  });
  const bookings = useQuery({
    queryKey: moduleQueryKeys.reservations.key('bookings', locationId, date),
    queryFn: () => getBookings(locationId!, range),
    enabled: Boolean(locationId),
    // Another host may seat or book from their own screen.
    refetchInterval: 60_000,
  });
  const waitlist = useQuery({
    queryKey: moduleQueryKeys.reservations.key('waitlist', locationId),
    queryFn: () => getWaitlist(locationId!),
    enabled: Boolean(locationId),
    refetchInterval: 60_000,
  });

  const openBooking = (booking: Booking) => setDrawer({ mode: 'edit', booking });

  // My rota's stepper: outline keys at the header's height, the calendar behind an icon.
  const dayControls = (tab === 'bookings' || tab === 'floor') && locationId && (
    <>
      <Button
        variant="outline"
        size="icon"
        className="size-9"
        aria-label="Previous day"
        title="Previous day"
        onClick={() => setDate(addDays(date, -1))}
      >
        <ChevronLeft size={16} aria-hidden="true" />
      </Button>
      <Button variant="outline" className="h-9" onClick={() => setDate(today)} disabled={date === today}>
        Today
      </Button>
      <Button variant="outline" size="icon" className="size-9" aria-label="Next day" title="Next day" onClick={() => setDate(addDays(date, 1))}>
        <ChevronRight size={16} aria-hidden="true" />
      </Button>
      <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="size-9" aria-label="Go to a date" title="Go to a date">
            <CalendarDays size={16} aria-hidden="true" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto">
          <Calendar
            mode="single"
            selected={isoToDate(date) ?? undefined}
            defaultMonth={isoToDate(date) ?? undefined}
            onSelect={(picked) => {
              if (!picked) return;
              setDate(dateToIso(picked));
              setPickerOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );

  return (
    <EditorShell
      eyebrow="Front of house"
      title="Reservations"
      icon={<CalendarCheck size={20} aria-hidden="true" />}
      meta={
        locationId && (tab === 'bookings' || tab === 'floor') ? (
          <span className="text-xs text-muted-foreground">
            {formatCalendarDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
          </span>
        ) : undefined
      }
      subheader={
        <SectionTabs<Tab>
          tabs={[
            { value: 'bookings', label: 'Bookings', icon: CalendarCheck },
            { value: 'floor', label: 'Floor', icon: LayoutGrid },
            {
              value: 'waitlist',
              label: 'Waitlist',
              icon: Clock,
              count: waitlist.data?.length,
              countLabel: `${waitlist.data?.length ?? 0} parties waiting`,
            },
            ...(canDrawFloor ? [{ value: 'plan' as const, label: 'Floor plan', icon: Pencil }] : []),
            ...(canSetRules ? [{ value: 'rules' as const, label: 'Booking rules', icon: SlidersHorizontal }] : []),
          ]}
          value={tab}
          onChange={setTab}
          ariaLabel="Reservations sections"
          animationId="reservations-tabs"
        />
      }
      actions={
        <div className="flex items-center gap-2">
          {dayControls}
          {canWrite && locationId && tab !== 'plan' && tab !== 'rules' && (
            <Button className="h-9" aria-label="New booking" onClick={() => setDrawer({ mode: 'new', date })}>
              <Plus size={15} aria-hidden="true" />
              <span className="hidden md:inline">New booking</span>
            </Button>
          )}
        </div>
      }
    >
      {!locationId ? (
        <EmptyState
          className="flex-1"
          icon={MapPin}
          title="Choose a location"
          description="Bookings, tables and the waitlist belong to one location. Pick it from the location menu at the foot of the sidebar."
        />
      ) : tab === 'bookings' ? (
        <BookingsDay
          date={date}
          today={today}
          query={bookings}
          canWrite={canWrite}
          onOpen={openBooking}
          onNew={() => setDrawer({ mode: 'new', date })}
        />
      ) : tab === 'floor' ? (
        <FloorView
          locationId={locationId}
          date={date}
          today={today}
          floor={floor}
          bookings={bookings}
          canWrite={canWrite}
          canDrawFloor={canDrawFloor}
          onOpenBooking={openBooking}
          onNewBooking={(prefill) => setDrawer({ mode: 'new', date, ...prefill })}
          onDrawFloor={() => setTab('plan')}
        />
      ) : tab === 'waitlist' ? (
        <WaitlistPanel locationId={locationId} query={waitlist} floor={floor.data ?? []} canWrite={canWrite} />
      ) : tab === 'rules' ? (
        <BookingRules locationId={locationId} canEdit={canSetRules} />
      ) : (
        <FloorPlanEditor locationId={locationId} floor={floor} />
      )}
      {drawer && (
        <BookingDrawer
          key={drawer.mode === 'edit' ? drawer.booking.id : 'new'}
          locationId={locationId!}
          state={drawer}
          floor={floor.data ?? []}
          canWrite={canWrite}
          onClose={() => setDrawer(null)}
        />
      )}
    </EditorShell>
  );
}
