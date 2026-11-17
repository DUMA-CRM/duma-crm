'use client';

import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { CalendarCheck, LayoutDashboard, LayoutGrid, MapPin, Pencil, Plus, SlidersHorizontal } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionTabs } from '@/components/shared/SectionTabs';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type Booking, getFloorPlan, getWaitlist } from '@/lib/modules/reservations/client';
import { type HostPanelTab, type ReservationsTab, resolveReservationsTab } from '@/lib/utils/reservations-lists';
import { workspaceDateKey } from '@/lib/utils/workspace-time';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { BookingDrawer, type BookingDrawerState } from './BookingDrawer';
import { BookingRules } from './BookingRules';
import { FloorPlanEditor } from './FloorPlanEditor';
import { HostView } from './HostView';
import { type HostTarget, ReservationsOverview } from './ReservationsOverview';

/**
 * Reservations for the location chosen in the sidebar: the Overview (where it
 * always opens), the Host stand — bookings, waitlist and the live floor on one
 * page — and, for managers, the Floor plan and Booking rules. The tab lives in
 * the query string so a refresh or a shared link lands in the same place; old
 * `?tab=bookings|floor|waitlist` links land on Host (see
 * `resolveReservationsTab`). The header holds New booking on Host and nothing
 * elsewhere; the day is chosen on the floor's toolbar.
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

  const { tab, panel } = resolveReservationsTab(searchParams.get('tab'), { canDrawFloor, canSetRules });
  const setTab = (next: ReservationsTab) => {
    const query = new URLSearchParams(searchParams.toString());
    if (next === 'overview') query.delete('tab');
    else query.set('tab', next);
    const search = query.toString();
    router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false });
  };

  const today = workspaceDateKey();
  const [date, setDate] = useState(today);
  const [drawer, setDrawer] = useState<BookingDrawerState | null>(null);
  const [hostControls, setHostControls] = useState<HTMLElement | null>(null);
  // The panel list an Overview card asked for; Host reads it when it opens.
  const [hostPanel, setHostPanel] = useState<HostPanelTab | null>(null);

  const floor = useQuery({
    queryKey: moduleQueryKeys.reservations.key('floor', locationId),
    queryFn: () => getFloorPlan(locationId!),
    enabled: Boolean(locationId),
  });
  const waitlist = useQuery({
    queryKey: moduleQueryKeys.reservations.key('waitlist', locationId),
    queryFn: () => getWaitlist(locationId!),
    enabled: Boolean(locationId),
    refetchInterval: 60_000,
  });

  const openBooking = (booking: Booking) => setDrawer({ mode: 'edit', booking });
  const openHost = (target?: HostTarget) => {
    if (target?.date) setDate(target.date);
    setHostPanel(target?.tab ?? null);
    setTab('host');
  };
  const host = tab === 'host' && Boolean(locationId);

  return (
    <EditorShell
      eyebrow="Front of house"
      title="Reservations"
      icon={<CalendarCheck size={20} aria-hidden="true" />}
      // The host stand fills the screen and scrolls its panes on their own.
      flush={host}
      subheader={
        <SectionTabs<ReservationsTab>
          tabs={[
            { value: 'overview', label: 'Overview', icon: LayoutDashboard },
            {
              value: 'host',
              label: 'Host',
              icon: LayoutGrid,
              count: waitlist.data?.length,
              countLabel: `${waitlist.data?.length ?? 0} parties waiting`,
            },
            ...(canDrawFloor ? [{ value: 'plan' as const, label: 'Floor plan', icon: Pencil }] : []),
            ...(canSetRules ? [{ value: 'rules' as const, label: 'Booking rules', icon: SlidersHorizontal }] : []),
          ]}
          value={tab}
          onChange={(next) => {
            setHostPanel(null);
            setTab(next);
          }}
          ariaLabel="Reservations sections"
          animationId="reservations-tabs"
        />
      }
      actions={
        host && locationId ? (
          // The day on the floor sits with the page's one action; the floor's toolbar keeps the live controls.
          <div className="flex items-center gap-2">
            {/* Host's floor controls (day and time, area, plan/list) render here. */}
            <div ref={setHostControls} className="flex items-center gap-2" />
            {canWrite && (
              <Button aria-label="New booking" onClick={() => setDrawer({ mode: 'new', date })}>
                <Plus size={15} aria-hidden="true" />
                <span className="hidden md:inline">New booking</span>
              </Button>
            )}
          </div>
        ) : undefined
      }
    >
      {!locationId ? (
        <EmptyState
          className="flex-1"
          icon={MapPin}
          title="Choose a location"
          description="Bookings, tables and the waitlist belong to one location. Pick it from the location menu at the foot of the sidebar."
        />
      ) : tab === 'overview' ? (
        <ReservationsOverview locationId={locationId} onOpenHost={openHost} />
      ) : tab === 'host' ? (
        <HostView
          // A different location starts the stand afresh.
          key={locationId}
          locationId={locationId}
          date={date}
          today={today}
          onDateChange={setDate}
          controlsSlot={hostControls}
          floor={floor}
          waitlist={waitlist}
          canWrite={canWrite}
          canDrawFloor={canDrawFloor}
          initialPanel={hostPanel ?? panel}
          onOpenBooking={openBooking}
          onNewBooking={(prefill) => setDrawer({ mode: 'new', date, ...prefill })}
          onDrawFloor={() => setTab('plan')}
        />
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
