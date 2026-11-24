'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { RowWarning } from '@/components/shared/rows';
import { copyText } from '@/components/cms/shared';
import {
  CalendarClock,
  CalendarDays,
  Clock,
  ExternalLink,
  Globe,
  type IconComponent,
  Link2,
  RefreshCw,
  StickyNote,
  Timer,
  Users,
} from '@/components/icons';
import { ChangeRow, SaveBar, Switch, ValueMissing } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { PublicQrCodeCard } from '@/components/shared/PublicQrCodeCard';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { SectionSkeleton, SettingRowSkeleton } from '@/components/shared/TileSkeleton';
import { CopyButton } from '@/components/ui/action-button';
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
import { toast } from '@/lib/toast';
import { minutesLabel } from '@/lib/utils/reservations';

import { GuestEmails } from './GuestEmails';

type Draft = Required<ReservationSettingsInput>;
type Row =
  | 'onlineMaxPartySize'
  | 'onlineDurationMinutes'
  | 'slotIntervalMinutes'
  | 'minNoticeMinutes'
  | 'bookingHorizonDays'
  | 'guestMessage'
  | 'turnBufferMinutes';

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
 * A location's booking rules, in the Settings → Account layout: two stacks of
 * titled cards — Online booking · Guest emails | Booking page · Between
 * bookings. Each rule is a row whose Change opens its stepper; the rules are
 * one draft saved through the bar, and Cancel puts a row back as it was.
 */
export function BookingRules({ locationId, canEdit }: { locationId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const query = useQuery({
    queryKey: moduleQueryKeys.reservations.key('settings', locationId),
    queryFn: () => getReservationSettings(locationId),
  });
  const [draftState, setDraftState] = useState<{ locationId: string; value: Draft } | null>(null);
  const [confirmNewLink, setConfirmNewLink] = useState(false);
  // One rule open at a time, with what it held when it opened so Cancel can put it back.
  const [open, setOpen] = useState<Row | null>(null);
  const [before, setBefore] = useState<Draft | null>(null);

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
      setOpen(null);
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

  if (query.isPending) return <RulesSkeleton />;
  if (query.isError) return <ErrorState title="Couldn’t load the booking rules" onRetry={() => void query.refetch()} />;
  const settings = query.data;
  const value = draft!;

  const toggle = (row: Row) => {
    if (open === row) {
      if (before) set(row, before[row] as never);
      setOpen(null);
      return;
    }
    setBefore(value);
    setOpen(row);
  };
  /** Read-only users see the value alone, with no Change. */
  const changer = (row: Row) => (canEdit ? { open: open === row, onToggle: () => toggle(row) } : {});
  /** A number rule: its value on the row, the stepper (and why it matters) underneath. */
  const numberRow = (
    row: Row & keyof Draft,
    icon: IconComponent,
    label: string,
    shown: React.ReactNode,
    hint: string,
    min: number,
    max: number,
    step: number,
    unit: string,
  ) => (
    <ChangeRow icon={icon} label={label} value={shown} {...changer(row)}>
      <NumberStepper
        label={label}
        value={value[row] as number}
        min={min}
        max={max}
        step={step}
        unit={unit}
        onChange={(next) => set(row, next as never)}
      />
      <p className="mt-1.5 text-xs text-muted-foreground">{hint}</p>
    </ChangeRow>
  );

  return (
    // Outside the settings shell, so it brings the shell's stagger with it.
    <motion.div
      className="flex flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      {/* Two stacked columns, not paired rows: a short card never leaves a gap beside a tall one. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-5">
          <RecordGroup card id="booking-rules-online" title="Online booking">
            <div>
              <ChangeRow
                icon={Globe}
                label="Take bookings online"
                value={value.onlineEnabled ? 'On' : <ValueMissing>Off</ValueMissing>}
                trailing={
                  <Switch
                    checked={value.onlineEnabled}
                    onChange={(next) => set('onlineEnabled', next)}
                    label="Take bookings online"
                    disabled={!canEdit}
                  />
                }
              />
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
              {numberRow(
                'onlineDurationMinutes',
                Clock,
                'Table held for',
                minutesLabel(value.onlineDurationMinutes),
                'How long an online booking keeps its table.',
                15,
                720,
                15,
                'min',
              )}
              {numberRow(
                'slotIntervalMinutes',
                CalendarClock,
                'Times offered every',
                minutesLabel(value.slotIntervalMinutes),
                'Start times run from opening at this step.',
                5,
                120,
                5,
                'min',
              )}
              {numberRow(
                'minNoticeMinutes',
                Timer,
                'Soonest booking',
                value.minNoticeMinutes > 0 ? `${minutesLabel(value.minNoticeMinutes)} ahead` : <ValueMissing>Any time</ValueMissing>,
                'How far ahead of now a guest must book.',
                0,
                10080,
                15,
                'min',
              )}
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
              <ChangeRow
                icon={StickyNote}
                label="Note for guests"
                value={
                  value.guestMessage?.trim() ? (
                    <span className="truncate">{value.guestMessage.trim()}</span>
                  ) : (
                    <ValueMissing>None</ValueMissing>
                  )
                }
                {...changer('guestMessage')}
              >
                <textarea
                  aria-label="Note for guests"
                  value={value.guestMessage ?? ''}
                  onChange={(event) => set('guestMessage', event.target.value)}
                  maxLength={500}
                  rows={3}
                  autoFocus
                  placeholder="We hold tables for 15 minutes. Dogs welcome on the terrace."
                  className="w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-ring/30 disabled:opacity-60"
                />
                <p className="mt-1.5 text-xs text-muted-foreground">Shown on the booking page and in the confirmation email.</p>
              </ChangeRow>
              {!settings.hasOpeningHours && (
                <RowWarning className="mt-3">
                  Online times come from this location’s opening hours, and it has none set — guests would see no times. Set them in{' '}
                  <Link href="/settings/workspaces" className="underline underline-offset-2">
                    Settings → Workspace
                  </Link>
                  .
                </RowWarning>
              )}
            </div>
          </RecordGroup>

          <GuestEmails locationId={locationId} canEdit={canEdit} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <RecordGroup
            card
            id="booking-rules-page"
            title="Booking page"
            actions={
              <div className="flex items-center gap-2">
                <Badge variant={settings.onlineEnabled ? 'success' : 'muted'}>{settings.onlineEnabled ? 'Live' : 'Off'}</Badge>
                {canEdit && settings.publicUrl && (
                  <Button variant="outline" size="sm" onClick={() => setConfirmNewLink(true)}>
                    <RefreshCw aria-hidden="true" />
                    New link
                  </Button>
                )}
              </div>
            }
            footnote={
              !settings.publicUrl
                ? undefined
                : settings.onlineEnabled
                  ? 'Put it on your website, Google profile or social pages.'
                  : 'The page answers only while online booking is on.'
            }
          >
            {settings.publicUrl ? (
              <div className="space-y-4">
                <ChangeRow
                  icon={Link2}
                  label="Link"
                  value={<span className="truncate font-mono text-xs font-medium">{settings.publicUrl.replace(/^https?:\/\//, '')}</span>}
                  trailing={
                    <>
                      <CopyButton onCopy={() => copyText(settings.publicUrl!)} iconOnly label="Copy the link" className="size-8" />
                      <Button asChild variant="outline" size="icon-sm" aria-label="Open the booking page">
                        <a href={settings.publicUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={14} aria-hidden="true" />
                        </a>
                      </Button>
                    </>
                  }
                />
                <PublicQrCodeCard url={settings.publicUrl} locationName="your location" purpose="booking page" downloadPrefix="booking" />
              </div>
            ) : (
              <ChangeRow icon={Link2} label="Link" value={<ValueMissing>Appears once these rules are saved</ValueMissing>} />
            )}
          </RecordGroup>

          <RecordGroup
            card
            id="booking-rules-between"
            title="Between bookings"
            footnote="For every booking — online, by phone and walk-ins."
          >
            <div>
              {numberRow(
                'turnBufferMinutes',
                Timer,
                'Turn time',
                value.turnBufferMinutes > 0 ? minutesLabel(value.turnBufferMinutes) : <ValueMissing>Back to back</ValueMissing>,
                'Kept free on a table after a party leaves, to clear and reset it.',
                0,
                120,
                5,
                'min',
              )}
            </div>
          </RecordGroup>
        </div>
      </div>

      {canEdit && (
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          onSave={() => save.mutate()}
          onDiscard={() => {
            setDraftState(null);
            setOpen(null);
          }}
        />
      )}

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
    </motion.div>
  );
}

/** The two stacks of cards, without their words. */
function RulesSkeleton() {
  return (
    <div role="status" aria-label="Loading the booking rules" className="grid items-start gap-5 xl:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-5">
        <SectionSkeleton><SettingRowSkeleton rows={7} /></SectionSkeleton>
        <SectionSkeleton><SettingRowSkeleton rows={3} /></SectionSkeleton>
      </div>
      <div className="flex min-w-0 flex-col gap-5">
        <SectionSkeleton><SettingRowSkeleton rows={1} /></SectionSkeleton>
        <SectionSkeleton><SettingRowSkeleton rows={1} /></SectionSkeleton>
      </div>
    </div>
  );
}
