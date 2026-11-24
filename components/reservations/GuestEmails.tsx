'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { RowWarning } from '@/components/shared/rows';
import { Bell, type IconComponent, Loader2, Mail, Plus, XCircle } from '@/components/icons';
import { ChangeRow, ValueMissing } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards } from '@/components/shared/FormParts';
import { Modal } from '@/components/shared/Modal';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { SettingRowSkeleton } from '@/components/shared/TileSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type BookingEmailAutomation, type BookingEmailTrigger, getGuestEmails, setUpGuestEmails } from '@/lib/modules/reservations/client';
import { toast } from '@/lib/toast';
import { useAuthStore } from '@/stores/authStore';

const MOMENTS: { trigger: BookingEmailTrigger; title: string; icon: IconComponent }[] = [
  { trigger: 'reservation_confirmed', title: 'Confirmation', icon: Mail },
  { trigger: 'reservation_reminder', title: 'Reminder', icon: Bell },
  { trigger: 'reservation_cancelled', title: 'Cancellation', icon: XCircle },
];

/** Where an automation stands, as its badge. */
function stateOf(automation: BookingEmailAutomation): { label: string; variant: 'success' | 'muted' | 'warning' } {
  if (!automation.published) return { label: 'Draft', variant: 'muted' };
  return automation.isEnabled ? { label: 'Live', variant: 'success' } : { label: 'Off', variant: 'warning' };
}

/**
 * A booking's guest emails are Communications automations — a template the
 * workspace edits and a workflow that sends it — so every guest email lives in
 * one place. This lists the automation for each moment as a row (its state,
 * and Open to edit it in Communications), and sets up the starter ones (live or as drafts) for any
 * moment that has none. A moment without an enabled automation sends nothing.
 */
export function GuestEmails({ locationId, canEdit }: { locationId: string; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canSetUp = canEdit && hasCapability(capabilities, 'email:write');
  const canPublish = hasCapability(capabilities, 'email:publish');
  const [settingUp, setSettingUp] = useState(false);

  const query = useQuery({
    queryKey: moduleQueryKeys.reservations.key('guest-emails', locationId),
    queryFn: () => getGuestEmails(locationId),
  });
  const setUp = useMutation({
    mutationFn: (live: boolean) => setUpGuestEmails(locationId, live),
    onSuccess: async (result, live) => {
      setSettingUp(false);
      toast(
        'success',
        result.made === 0
          ? 'Every booking email already has an automation.'
          : `${result.made} booking ${result.made === 1 ? 'email' : 'emails'} set up${live ? ' and sending' : ' as drafts — review them in Communications'}.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all }),
        queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.all }),
      ]);
    },
    onError: (error) => toast('error', error.message),
  });

  const automations = query.data?.automations ?? [];
  const missing = MOMENTS.filter((moment) => !automations.some((automation) => automation.trigger === moment.trigger));
  const email = query.data?.email;

  return (
    <RecordGroup
      card
      id="booking-rules-emails"
      title="Guest emails"
      actions={
        canSetUp && query.isSuccess && missing.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setSettingUp(true)}>
            <Plus aria-hidden="true" />
            Set up
          </Button>
        ) : undefined
      }
      footnote={
        query.isSuccess && !(email && !email.ready)
          ? `Sent to the email on the booking through Communications — change the wording, timing or location there.${
              missing.length > 0 && !canSetUp ? ' Someone who can edit Communications can set up the missing ones.' : ''
            }`
          : undefined
      }
    >
      {query.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading the guest emails" className="space-y-5">
          <SettingRowSkeleton rows={MOMENTS.length} action={false} />
        </div>
      ) : query.isError ? (
        <ErrorState title="Couldn’t load the guest emails" onRetry={() => void query.refetch()} className="py-4" />
      ) : (
        <div>
          {MOMENTS.map((moment) => {
            const automation = automations.find((candidate) => candidate.trigger === moment.trigger);
            const state = automation ? stateOf(automation) : null;
            return (
              <ChangeRow
                key={moment.trigger}
                icon={moment.icon}
                label={moment.title}
                value={
                  automation ? (
                    <>
                      <span className="truncate">
                        {automation.name}
                        {automation.offsetHours ? (
                          <span className="font-normal text-muted-foreground"> · {automation.offsetHours} h before</span>
                        ) : null}
                      </span>
                      {state && (
                        <Badge variant={state.variant} className="shrink-0">
                          {state.label}
                        </Badge>
                      )}
                    </>
                  ) : (
                    <ValueMissing>Not set up — nothing is sent</ValueMissing>
                  )
                }
                trailing={
                  automation ? (
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/communications?tab=automations&automation=${automation.id}`}
                        aria-label={`Open the ${moment.title.toLowerCase()} email in Communications`}
                      >
                        Open
                      </Link>
                    </Button>
                  ) : undefined
                }
              />
            );
          })}
          {email && !email.ready && (
            <RowWarning className="mt-3">
              {email.reason === 'module_off' ? (
                <>
                  Nothing is sent while Communications is off. Switch it on in{' '}
                  <Link href="/settings/modules" className="underline underline-offset-2">
                    Settings → Modules
                  </Link>
                  .
                </>
              ) : (
                <>
                  Nothing is sent until an email account is connected in{' '}
                  <Link href="/settings/connectors" className="underline underline-offset-2">
                    Settings → Connectors
                  </Link>
                  .
                </>
              )}
            </RowWarning>
          )}
        </div>
      )}

      {settingUp && (
        <SetUpModal
          missing={missing.map((moment) => moment.title.toLowerCase())}
          canPublish={canPublish}
          isPending={setUp.isPending}
          onConfirm={(live) => setUp.mutate(live)}
          onClose={() => setSettingUp(false)}
        />
      )}
    </RecordGroup>
  );
}

/** Live or drafts: what "Set up" should make. */
function SetUpModal({
  missing,
  canPublish,
  isPending,
  onConfirm,
  onClose,
}: {
  missing: string[];
  canPublish: boolean;
  isPending: boolean;
  onConfirm: (live: boolean) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<'live' | 'draft'>(canPublish ? 'live' : 'draft');
  const list = missing.length > 1 ? `${missing.slice(0, -1).join(', ')} and ${missing.at(-1)}` : missing[0];
  return (
    <Modal
      title="Set up guest emails"
      description={`A template and automation for the ${list} email${missing.length === 1 ? '' : 's'}, for every location. The wording can be changed in Communications.`}
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={() => onConfirm(mode === 'live')} disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {mode === 'live' ? 'Set up and send' : 'Create drafts'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <ChoiceCards<'live' | 'draft'>
          value={mode}
          onChange={(next) => (next === 'live' && !canPublish ? undefined : setMode(next))}
          options={[
            { value: 'live', label: 'Live now' },
            { value: 'draft', label: 'Drafts to review' },
          ]}
        />
        <p className="text-sm text-muted-foreground">
          {mode === 'live'
            ? 'Guests are emailed from the next booking on.'
            : 'Nothing is sent until someone checks each one in Communications and publishes it.'}
        </p>
        {!canPublish && (
          <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
            Going live needs permission to publish emails — these are made as drafts for someone who can.
          </p>
        )}
      </div>
    </Modal>
  );
}
