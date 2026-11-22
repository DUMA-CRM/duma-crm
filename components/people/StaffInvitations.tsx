'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Loader2, Mail } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FIELD_LABEL_CLASS } from '@/components/ui/label';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import { getRoles } from '@/lib/api/roles.service';
import type { StaffScope } from '@/lib/api/staff.service';
import {
  type StaffInvitation,
  getStaffInvitations,
  resendStaffInvitation,
  revokeStaffInvitation,
  sendStaffInvitation,
} from '@/lib/api/workspaces.service';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';

const SCOPE_OPTIONS: { value: StaffScope; label: string }[] = [
  { value: 'global', label: 'Every location' },
  { value: 'franchise', label: 'Their franchise' },
  { value: 'location', label: 'Chosen locations' },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export const staffInvitationsKey = (tenantId: string | null) => moduleQueryKeys.identity.key('staff-invitations', tenantId);

function useInvalidateInvitations(tenantId: string | null) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: staffInvitationsKey(tenantId) });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('staff') });
  };
}

/** The toast after a send: an email that failed is still a saved invitation, resendable from the list. */
function reportSend(email: string, emailSent: boolean, verb: 'sent' | 'resent') {
  if (emailSent) toast('success', `Invitation ${verb} to ${email}.`);
  else toast('error', `The invitation to ${email} is saved, but the email couldn’t be sent. Use Resend to try again.`);
}

/**
 * Invite someone by email. They get a link valid for seven days; whether they
 * already use DUMA is settled when they open it, not here.
 */
export function InviteDialog({ tenantId, onClose }: { tenantId: string; onClose: () => void }) {
  const invalidate = useInvalidateInvitations(tenantId);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('');
  const [scope, setScope] = useState<StaffScope>('global');
  const [locationIds, setLocationIds] = useState<string[]>([]);
  const [problem, setProblem] = useState<string | null>(null);

  const roles = useQuery({
    queryKey: moduleQueryKeys.identity.key('roles', tenantId),
    queryFn: () => getRoles(tenantId),
  });
  const locations = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId),
    enabled: scope === 'location',
  });

  const send = useMutation({
    mutationFn: () =>
      sendStaffInvitation({ email: email.trim(), role, scope, locationIds: scope === 'location' ? locationIds : undefined }),
    onSuccess: ({ invitation, emailSent }) => {
      invalidate();
      reportSend(invitation.email, emailSent, 'sent');
      onClose();
    },
    // Shown in the dialog, beside what caused it — "already a member", a role above theirs.
    onError: (error) => setProblem(error instanceof ApiError || error instanceof Error ? error.message : 'The invitation wasn’t sent.'),
  });

  const roleOptions = (roles.data?.roles ?? []).map((entry) => ({ value: entry.key, label: entry.name }));
  const ready = /\S+@\S+\.\S+/.test(email.trim()) && !!role && (scope !== 'location' || locationIds.length > 0);

  return (
    <Modal
      title="Invite to the team"
      description="They get an email with a link to join. It works for seven days."
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!ready || send.isPending} onClick={() => send.mutate()} className="gap-2">
            {send.isPending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
            {send.isPending ? 'Sending…' : 'Send invitation'}
          </Button>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !send.isPending) send.mutate();
        }}
      >
        <label className="block">
          <span className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>Email</span>
          <Input
            type="email"
            value={email}
            autoComplete="off"
            autoFocus
            maxLength={320}
            placeholder="name@example.com"
            onChange={(event) => {
              setEmail(event.target.value);
              setProblem(null);
            }}
          />
        </label>
        <div>
          <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>Role</p>
          {roles.isError ? (
            <p className="text-sm text-muted-foreground">
              Roles couldn’t be loaded.{' '}
              <button type="button" className="font-semibold text-foreground underline" onClick={() => void roles.refetch()}>
                Try again
              </button>
            </p>
          ) : (
            <Select
              value={role}
              onValueChange={(value) => {
                setRole(value);
                setProblem(null);
              }}
              options={roleOptions}
              placeholder={roles.isLoading ? 'Loading roles…' : 'Choose a role'}
              ariaLabel="Role"
              className="w-full"
            />
          )}
        </div>
        <div>
          <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>Where they work</p>
          <Select
            value={scope}
            onValueChange={(value) => setScope(value as StaffScope)}
            options={SCOPE_OPTIONS}
            ariaLabel="Where they work"
            className="w-full"
          />
        </div>
        {scope === 'location' && (
          <div>
            <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>Locations</p>
            <MultiSelect
              value={locationIds}
              onChange={setLocationIds}
              options={(locations.data ?? []).map((location) => ({ value: location.id, label: location.name }))}
              placeholder={locations.isLoading ? 'Loading locations…' : 'Choose locations'}
              ariaLabel="Locations"
              className="w-full"
            />
          </div>
        )}
        {problem && (
          <p role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
      </form>
    </Modal>
  );
}

function expiryLabel(invitation: StaffInvitation, now: number): string {
  const days = Math.ceil((new Date(invitation.expiresAt).getTime() - now) / DAY_MS);
  return days <= 1 ? 'expires today' : `expires in ${days} days`;
}

function InvitationRow({ invitation, tenantId, now }: { invitation: StaffInvitation; tenantId: string; now: number }) {
  const invalidate = useInvalidateInvitations(tenantId);
  const [confirming, setConfirming] = useState(false);
  const expired = invitation.state === 'expired';

  const resend = useMutation({
    mutationFn: () => resendStaffInvitation(invitation.id),
    onSuccess: ({ emailSent }) => {
      invalidate();
      reportSend(invitation.email, emailSent, 'resent');
    },
    onError: (error) => toast('error', (error as Error).message || 'The invitation wasn’t resent. Try again.'),
  });
  const revoke = useMutation({
    mutationFn: () => revokeStaffInvitation(invitation.id),
    onSuccess: () => {
      invalidate();
      setConfirming(false);
      toast('success', `Invitation to ${invitation.email} cancelled.`);
    },
    onError: (error) => toast('error', (error as Error).message || 'The invitation wasn’t cancelled. Try again.'),
  });

  return (
    <>
      <ListRow
        leading={
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
            <Mail size={16} aria-hidden="true" />
          </span>
        }
        title={invitation.email}
        titleExtra={expired && <Badge variant="warning">Expired</Badge>}
        meta={
          <span className="truncate">
            {invitation.roleName}
            {invitation.invitedBy && ` · Invited by ${invitation.invitedBy}`}
            {!expired && ` · ${expiryLabel(invitation, now)}`}
          </span>
        }
        trailing={
          <span className="flex items-center gap-1.5">
            <Button size="sm" variant="outline" disabled={resend.isPending} onClick={() => resend.mutate()}>
              {resend.isPending ? 'Sending…' : 'Resend'}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirming(true)}>
              Cancel
            </Button>
          </span>
        }
      />
      {confirming && (
        <ConfirmModal
          title="Cancel this invitation?"
          message={
            <>
              The link sent to <span className="font-medium text-foreground">{invitation.email}</span> stops working at once. You can invite them
              again later.
            </>
          }
          confirmLabel="Cancel invitation"
          pendingLabel="Cancelling…"
          isPending={revoke.isPending}
          onConfirm={() => revoke.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

/**
 * Who has been invited and hasn't joined yet. Renders nothing while loading or
 * when there are none — the directory below is the page; this is an aside to it.
 */
export function PendingInvitations({ tenantId }: { tenantId: string }) {
  const [now] = useState(() => Date.now());
  const invitations = useQuery({
    queryKey: staffInvitationsKey(tenantId),
    queryFn: ({ signal }) => getStaffInvitations({}, signal),
    meta: { silentError: true },
  });

  if (invitations.isError) {
    return (
      <ErrorState
        icon={Mail}
        title="Invitations couldn’t be loaded"
        description="Pending invitations weren’t read, so there may be some."
        onRetry={() => void invitations.refetch()}
      />
    );
  }
  if (!invitations.data?.length) return null;

  return (
    <section aria-labelledby="pending-invitations" className="space-y-2">
      <h2 id="pending-invitations" className="text-label uppercase text-muted-foreground">
        Invited · {invitations.data.length}
      </h2>
      <ListRowGroup aria-label="Pending invitations">
        {invitations.data.map((invitation) => (
          <InvitationRow key={invitation.id} invitation={invitation} tenantId={tenantId} now={now} />
        ))}
      </ListRowGroup>
    </section>
  );
}
