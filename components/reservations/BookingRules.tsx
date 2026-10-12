'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { InfoRow } from '@/components/cms/rows';
import {
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  Clock,
  Globe,
  type IconComponent,
  RefreshCw,
  StickyNote,
  Timer,
  Users,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { PublicQrCodeCard } from '@/components/shared/PublicQrCodeCard';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type ReservationSettings,
  type ReservationSettingsInput,
  getReservationSettings,
  replaceBookingLink,
  saveReservationSettings,
} from '@/lib/modules/reservations/client';
import { minutesLabel } from '@/lib/utils/reservations';
import { toast } from '@/stores/toastStore';

import { GuestEmails } from './GuestEmails';
import { PickerRow } from './PickerRow';

type Draft = Required<ReservationSettingsInput>;
type Row = 'onlineMaxPartySize' | 'onlineDurationMinutes' | 'slotIntervalMinutes' | 'minNoticeMinutes' | 'bookingHorizonDays' | 'guestMessage' | 'turnBufferMinutes';

const draftOf = (settings: ReservationSettings): Draft => ({
  onlineEnabled: settings.onlineEnabled,
  slotIntervalMinutes: settings.slotIntervalMinutes,
  turnBufferMinutes: settings.turnBufferMinutes,
  onlineDurationMinutes: settings.onlineDurationMinutes,
  onlineMaxPartySize: settings.onlineMaxPartySize,
  minNoticeMinutes: settings.minNoticeMinutes,
  bookingHorizonDays: settings.bookingHorizonDays,
  guestMessage: settings.guestMessage,
});

/**
 * A location's booking rules: whether guests can book online (and the page's
 * link), the gap kept between bookings on a table, and the emails the guest
 * gets. Edited as a draft and saved together, like the other settings pages.
 * Laid out like the other tabs: the rules in the main column, each number a
 * row that opens its stepper; the booking page's link and QR code alongside.
 */
export function BookingRules({ locationId, canEdit }: { locationId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: moduleQueryKeys.reservations.key('settings', locationId),
    queryFn: () => getReservationSettings(locationId),
  });
  const [draftState, setDraftState] = useState<{ locationId: string; value: Draft } | null>(null);
  const [confirmNewLink, setConfirmNewLink] = useState(false);
  // One rule open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<Row | null>(null);

  const saved = query.data ? draftOf(query.data) : null;
  const draft = draftState?.locationId === locationId ? draftState.value : saved;
  const dirty = Boolean(saved && draft && JSON.stringify(saved) !== JSON.stringify(draft));
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraftState({ locationId, value: { ...draft!, [key]: value } });

  const settle = async (next: ReservationSettings) => {
    queryClient.setQueryData(moduleQueryKeys.reservations.key('settings', locationId), next);
    await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
  };
  const save = useMutation({
    mutationFn: () => saveReservationSettings(locationId, { ...draft!, guestMessage: draft!.guestMessage?.trim() || null }),
    onSuccess: async (next) => {
      setDraftState(null);
      await settle(next);
    },
    onError: (error) => toast('error', error.message),
  });
  const newLink = useMutation({
    mutationFn: () => replaceBookingLink(locationId),
    onSuccess: async (next) => {
      setConfirmNewLink(false);
      toast('success', 'New booking link made — the old one no longer works.');
      await settle(next);
    },
    onError: (error) => toast('error', error.message),
  });

  if (query.isPending) return <Bone className="h-96 w-full rounded-lg" />;
  if (query.isError) return <ErrorState title="Couldn’t load the booking rules" onRetry={() => void query.refetch()} />;
  const settings = query.data;
  const value = draft!;

  const toggle = (row: Row) => setOpen((current) => (current === row ? null : row));
  /** A number rule: its value on the row, the stepper (and why it matters) underneath. */
  const numberRow = (row: Row & keyof Draft, icon: IconComponent, title: string, shown: string, hint: string, min: number, max: number, step: number, unit: string) => (
    <PickerRow icon={icon} title={title} value={shown} open={open === row} onToggle={() => toggle(row)}>
      <NumberStepper label={title} value={value[row] as number} min={min} max={max} step={step} unit={unit} onChange={(next) => set(row, next as never)} />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </PickerRow>
  );
  const switchRow = (key: keyof Draft, icon: IconComponent, title: string) => (
    <InfoRow icon={icon} title={title}>
      <Switch checked={value[key] as boolean} onChange={(next) => set(key, next as never)} label={title} disabled={!canEdit} />
    </InfoRow>
  );

  return (
    <SettingsTabBody
      narrowAside
      aside={
        <SettingsSection
          title="Booking page"
          actions={<Badge variant={settings.onlineEnabled ? 'success' : 'muted'}>{settings.onlineEnabled ? 'Live' : 'Off'}</Badge>}
        >
          {settings.publicUrl ? (
            <div className="space-y-3">
              <PublicQrCodeCard url={settings.publicUrl} locationName="your location" purpose="booking page" downloadPrefix="booking" />
              {!settings.onlineEnabled && (
                <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">The page answers only while online booking is on.</p>
              )}
              {canEdit && (
                <Button variant="outline" className="h-9 w-full" onClick={() => setConfirmNewLink(true)}>
                  <RefreshCw size={14} aria-hidden="true" />
                  New link
                </Button>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Save these rules once and the link appears here — put it on your website, Google profile or social pages.
            </p>
          )}
        </SettingsSection>
      }
    >
      <SettingsSection title="Online booking">
        <fieldset disabled={!canEdit} className="space-y-3">
          {switchRow('onlineEnabled', Globe, 'Take bookings online')}
          {numberRow(
            'onlineMaxPartySize',
            Users,
            'Largest party online',
            `${value.onlineMaxPartySize} ${value.onlineMaxPartySize === 1 ? 'guest' : 'guests'}`,
            'Bigger parties see your phone number instead.',
            1,
            50,
            1,
            'guests',
          )}
          {numberRow('onlineDurationMinutes', Clock, 'Table held for', minutesLabel(value.onlineDurationMinutes), 'How long an online booking keeps its table.', 15, 720, 15, 'min')}
          {numberRow('slotIntervalMinutes', CalendarClock, 'Times offered every', minutesLabel(value.slotIntervalMinutes), 'Start times run from opening at this step.', 5, 120, 5, 'min')}
          {numberRow('minNoticeMinutes', Timer, 'Soonest booking', minutesLabel(value.minNoticeMinutes, 'Any time'), 'How far ahead of now a guest must book.', 0, 10080, 15, 'min')}
          {numberRow(
            'bookingHorizonDays',
            CalendarDays,
            'Furthest ahead',
            `${value.bookingHorizonDays} ${value.bookingHorizonDays === 1 ? 'day' : 'days'}`,
            'How many days ahead guests can book.',
            1,
            365,
            1,
            'days',
          )}
          <PickerRow
            icon={StickyNote}
            title="Note for guests"
            value={value.guestMessage?.trim() || 'None'}
            muted={!value.guestMessage?.trim()}
            open={open === 'guestMessage'}
            onToggle={() => toggle('guestMessage')}
          >
            <textarea
              aria-label="Note for guests"
              value={value.guestMessage ?? ''}
              onChange={(event) => set('guestMessage', event.target.value)}
              maxLength={500}
              rows={3}
              autoFocus
              placeholder="We hold tables for 15 minutes. Dogs welcome on the terrace."
              className="w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-measured focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-measured disabled:opacity-60"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">Shown on the booking page and in the confirmation email.</p>
          </PickerRow>
        </fieldset>
        {!settings.hasOpeningHours && (
          <Warning>
            Online times come from this location’s opening hours, and it has none set — guests would see no times. Set them in{' '}
            <Link href="/settings/workspaces" className="underline underline-offset-2">
              Settings → Workspace
            </Link>
            .
          </Warning>
        )}
      </SettingsSection>

      <SettingsSection title="Between bookings">
        <fieldset disabled={!canEdit} className="space-y-3">
          {numberRow(
            'turnBufferMinutes',
            Timer,
            'Turn time',
            minutesLabel(value.turnBufferMinutes, 'Back to back'),
            'Kept free on a table after a party leaves, to clear and reset it — for every booking, online, by phone and walk-ins.',
            0,
            120,
            5,
            'min',
          )}
        </fieldset>
      </SettingsSection>

      <GuestEmails locationId={locationId} canEdit={canEdit} />

      {canEdit && <SaveBar dirty={dirty} saving={save.isPending} onSave={() => save.mutate()} onDiscard={() => setDraftState(null)} />}

      {confirmNewLink && (
        <ConfirmModal
          title="Make a new booking link?"
          message="The current link stops working — anywhere you’ve shared it will need the new one. Bookings already made keep their own links."
          confirmLabel="Make a new link"
          pendingLabel="Making…"
          isPending={newLink.isPending}
          onConfirm={() => newLink.mutate()}
          onClose={() => setConfirmNewLink(false)}
        />
      )}
    </SettingsTabBody>
  );
}

/** Something that stops a rule working, with where to fix it. */
function Warning({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
