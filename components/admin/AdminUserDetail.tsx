'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { InfoRow, InfoRows, RowWarning } from '@/components/shared/rows';
import {
  Ban,
  Building2,
  Calendar,
  Clock3,
  Copy,
  Fingerprint,
  KeyRound,
  Link2,
  Loader2,
  LogOut,
  Mail,
  Monitor,
  Pencil,
  Plus,
  Plug,
  Search,
  ShieldCheck,
  ShieldOff,
  Smartphone,
  Trash2,
  User,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type PlatformUserDetail,
  type PlatformUserMembership,
  addPlatformUserMembership,
  deletePlatformUser,
  endAllPlatformUserSessions,
  endPlatformUserSession,
  getMembershipOptions,
  getPlatformUser,
  removePlatformUserMembership,
  renamePlatformUser,
  sendPlatformUserPasswordReset,
  suspendPlatformUser,
  unlinkPlatformUserMethod,
  unsuspendPlatformUser,
  updatePlatformUserMembership,
  updatePlatformUserVerification,
} from '@/lib/api/platform.service';
import { useTenants } from '@/lib/hooks/useTenants';
import { useWorkspaceSwitch } from '@/lib/hooks/useWorkspaceSwitch';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { describeDevice, signInMethodLabel } from '@/lib/utils/platform-users';
import { formatInstant } from '@/lib/utils/workspace-time';

import { platformUsersKey } from './AdminUsers';

type Detail = PlatformUserDetail;
type Dialog =
  | { kind: 'rename' | 'verify' | 'unverify' | 'reset' | 'suspend' | 'unsuspend' | 'end-all' | 'delete' }
  | { kind: 'end-session'; sessionId: string; label: string }
  | { kind: 'unlink'; methodId: string; label: string }
  | { kind: 'add-membership' }
  | { kind: 'change-membership' | 'toggle-membership' | 'remove-membership'; membership: PlatformUserMembership };

const date = (iso: string) => formatInstant(iso, { dateStyle: 'medium' });

/** One mutation per dialog: invalidate the account and the directory on success. */
function useAccountAction<T>(userId: string, run: (input: T) => Promise<unknown>, done: string | ((result: unknown) => string), after?: () => void) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (result) => {
      void qc.invalidateQueries({ queryKey: platformUsersKey });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-user', userId) });
      toast('success', typeof done === 'string' ? done : done(result));
      after?.();
    },
    onError: () => void qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('platform-user', userId) }),
    meta: { silentError: true },
  });
}

/** A confirmation that asks why — the reason is kept in the audit log. */
function ReasonModal({
  title, message, confirmLabel, pending, error, onConfirm, onClose,
}: {
  title: string; message: string; confirmLabel: string; pending: boolean; error?: string;
  onConfirm: (reason: string) => void; onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  return (
    <Modal title={title} onClose={() => { if (!pending) onClose(); }}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onConfirm(reason.trim()); }}>
        <p className="text-sm text-muted-foreground">{message}</p>
        <label className="block text-sm font-medium text-foreground">
          Reason
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={3}
            required
            className="mt-1.5 w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:outline-2 focus-visible:outline-ring/30"
          />
          <span className="mt-1 block text-xs text-muted-foreground">Kept in the activity log with your name.</span>
        </label>
        {error && <p role="alert" className="text-sm text-exception">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={pending} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={pending || reason.trim().length < 3}>
            {pending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RenameModal({ detail, onClose }: { detail: Detail; onClose: () => void }) {
  const [name, setName] = useState(detail.user.name);
  const rename = useAccountAction(detail.user.id, (value: string) => renamePlatformUser(detail.user.id, value), 'Name updated.', onClose);
  return (
    <Modal title="Change name" onClose={() => { if (!rename.isPending) onClose(); }}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); rename.mutate(name.trim()); }}>
        <Input label="Name" value={name} maxLength={120} required autoFocus onChange={(event) => setName(event.target.value)} />
        {rename.error && <p role="alert" className="text-sm text-exception">{rename.error.message}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" disabled={rename.isPending} onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={rename.isPending || !name.trim() || name.trim() === detail.user.name}>Save</Button>
        </div>
      </form>
    </Modal>
  );
}

type Scope = PlatformUserMembership['scope'];

/**
 * Add an account to a workspace, or change its role there. Adding picks the
 * workspace first; role and locations come from that workspace's own list.
 * A membership's current locations are only known as a count, so they are
 * replaced only when a location is picked.
 */
function MembershipModal({ detail, membership, onClose }: { detail: Detail; membership?: PlatformUserMembership; onClose: () => void }) {
  const userId = detail.user.id;
  const [tenantId, setTenantId] = useState(membership?.workspaceId ?? '');
  const [workspaceName, setWorkspaceName] = useState(membership?.workspace ?? '');
  const [query, setQuery] = useState('');
  const [role, setRole] = useState(membership?.role ?? '');
  const [scope, setScope] = useState<Scope>(membership?.scope ?? 'global');
  const [locationIds, setLocationIds] = useState<string[] | null>(null);
  const [notify, setNotify] = useState(true);
  const { tenants, isLoading: tenantsLoading, isError: tenantsError, refetch: refetchTenants } = useTenants({ enabled: !membership });
  const joined = useMemo(() => new Set(detail.memberships.map((entry) => entry.workspaceId)), [detail.memberships]);
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tenants.filter((tenant) => !joined.has(tenant.id) && (!q || `${tenant.name} ${tenant.slug}`.toLowerCase().includes(q))).slice(0, 50);
  }, [joined, query, tenants]);
  const options = useQuery({
    queryKey: moduleQueryKeys.identity.key('membership-options', tenantId),
    queryFn: ({ signal }) => getMembershipOptions(tenantId, signal),
    enabled: Boolean(tenantId),
    meta: { silentError: true },
  });

  const add = useAccountAction(userId, () => addPlatformUserMembership(userId, {
    tenantId, role, scope, locationIds: scope === 'location' ? locationIds : null, notify,
  }), (result) => `Added to ${workspaceName}${(result as { notified: boolean }).notified ? ' — they’ve been emailed.' : '.'}`, onClose);
  const change = useAccountAction(userId, () => updatePlatformUserMembership(userId, tenantId, {
    role,
    scope,
    // Untouched locations stay as they are; a switch to all locations clears them.
    ...(scope !== 'location' ? { locationIds: null } : locationIds ? { locationIds } : {}),
  }), `Access in ${workspaceName} updated.`, onClose);
  const action = membership ? change : add;

  const needsLocations = scope === 'location' && (locationIds ? locationIds.length === 0 : membership?.scope !== 'location');
  const unchanged = membership && role === membership.role && scope === membership.scope && !locationIds;
  const pickedLocations = locationIds ?? [];
  const scopeOptions = [
    { value: 'global', label: 'All locations' },
    ...(scope === 'franchise' ? [{ value: 'franchise', label: 'Franchise' }] : []),
    { value: 'location', label: 'Specific locations' },
  ];

  return (
    <Modal title={membership ? `Access in ${membership.workspace}` : 'Add to workspace'} onClose={() => { if (!action.isPending) onClose(); }}>
      {!tenantId ? (
        <div className="space-y-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search workspaces…"
            aria-label="Search workspaces"
            leftIcon={<Search size={14} aria-hidden="true" />}
            autoFocus
          />
          {tenantsLoading ? (
            <ListSkeleton rows={4} label="Loading workspaces" />
          ) : tenantsError ? (
            <ErrorState title="Workspaces couldn’t be loaded" onRetry={() => void refetchTenants()} />
          ) : candidates.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted-foreground">{query ? 'No workspace matches that search.' : 'They are already in every workspace.'}</p>
          ) : (
            <ul className="flex max-h-[50dvh] flex-col gap-1.5 overflow-y-auto" aria-label="Workspaces">
              {candidates.map((tenant) => (
                <li key={tenant.id}>
                  <button
                    type="button"
                    onClick={() => { setTenantId(tenant.id); setWorkspaceName(tenant.name); }}
                    className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left outline-none hover:bg-band/45 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <Building2 size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{tenant.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{tenant.slug}</span>
                    </span>
                    {tenant.status !== 'active' && <Badge variant="muted">{tenant.status === 'winding_down' ? 'Winding down' : 'Inactive'}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); action.mutate(undefined); }}>
          {!membership && (
            <div className="flex items-center justify-between gap-3 rounded-md bg-band/65 px-3 py-2.5 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-foreground"><Building2 size={14} aria-hidden="true" /><span className="truncate">{workspaceName}</span></span>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setTenantId(''); setRole(''); setLocationIds(null); }}>Change</Button>
            </div>
          )}
          {options.isPending ? (
            <ListSkeleton rows={3} label="Loading roles" />
          ) : options.isError ? (
            <ErrorState title="Roles couldn’t be loaded" description={options.error.message} onRetry={() => void options.refetch()} />
          ) : (
            <>
              <label className="block text-sm font-medium text-foreground">
                Role
                <Select
                  className="mt-1.5"
                  ariaLabel="Role"
                  value={role}
                  placeholder="Choose a role"
                  options={options.data.roles.map((entry) => ({ value: entry.key, label: entry.name }))}
                  onValueChange={setRole}
                />
              </label>
              <label className="block text-sm font-medium text-foreground">
                Locations
                <Select className="mt-1.5" ariaLabel="Locations" value={scope} options={scopeOptions} onValueChange={(value) => setScope(value as Scope)} />
              </label>
              {scope === 'location' && (
                <fieldset className="space-y-2">
                  <legend className="text-xs text-muted-foreground">
                    {membership?.scope === 'location' && !locationIds
                      ? `Currently ${membership.locationCount ?? 0} ${membership.locationCount === 1 ? 'location' : 'locations'}. Pick to replace them.`
                      : 'Pick at least one.'}
                  </legend>
                  {options.data.locations.length === 0 ? (
                    <p className="text-sm text-muted-foreground">This workspace has no locations yet.</p>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {options.data.locations.map((location) => {
                        const checked = pickedLocations.includes(location.id);
                        return (
                          <label key={location.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2.5 py-2 text-sm hover:bg-band/45">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setLocationIds(checked ? pickedLocations.filter((id) => id !== location.id) : [...pickedLocations, location.id])}
                              className="size-4 accent-primary"
                            />
                            <span className="truncate">{location.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </fieldset>
              )}
              {!membership && (
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input type="checkbox" checked={notify} onChange={(event) => setNotify(event.target.checked)} className="size-4 accent-primary" />
                  Email {detail.user.email} about it
                </label>
              )}
            </>
          )}
          {action.error && <p role="alert" className="text-sm text-exception">{action.error.message}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={action.isPending} onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={action.isPending || !options.isSuccess || !role || needsLocations || Boolean(unchanged)}>
              {action.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {membership ? 'Save' : 'Add to workspace'}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

/** Every dialog the page can open, each with its own copy and call. */
function AccountDialog({ dialog, detail, onClose }: { dialog: Dialog; detail: Detail; onClose: () => void }) {
  const router = useRouter();
  const { user } = detail;
  const ref = { id: user.id, email: user.email };
  const verify = useAccountAction(user.id, (verified: boolean) => updatePlatformUserVerification(ref, verified),
    dialog.kind === 'verify' ? 'Email marked as verified.' : 'Email marked as unverified.', onClose);
  const reset = useAccountAction(user.id, () => sendPlatformUserPasswordReset(ref), 'Password reset email sent.', onClose);
  const suspend = useAccountAction(user.id, (reason: string) => suspendPlatformUser(ref, reason),
    (result) => {
      const ended = (result as { sessionsEnded: number }).sessionsEnded;
      return `Account suspended${ended ? ` and signed out of ${ended} ${ended === 1 ? 'session' : 'sessions'}` : ''}.`;
    }, onClose);
  const unsuspend = useAccountAction(user.id, (reason: string) => unsuspendPlatformUser(user.id, reason), 'Suspension lifted. They can sign in again.', onClose);
  const endOne = useAccountAction(user.id, (sessionId: string) => endPlatformUserSession(user.id, sessionId), 'Session ended.', onClose);
  const endAll = useAccountAction(user.id, () => endAllPlatformUserSessions(user.id),
    (result) => `Signed out of ${(result as { ended: number }).ended} ${(result as { ended: number }).ended === 1 ? 'session' : 'sessions'}.`, onClose);
  const unlink = useAccountAction(user.id, (methodId: string) => unlinkPlatformUserMethod(user.id, methodId), 'Sign-in method disconnected.', onClose);
  const remove = useAccountAction(user.id, () => deletePlatformUser(ref), 'Account deleted.', () => router.push('/admin/users'));
  const target = 'membership' in dialog ? dialog.membership : null;
  const toggle = useAccountAction(user.id, () => updatePlatformUserMembership(user.id, target!.workspaceId, { isActive: !target!.isActive }),
    target?.isActive ? `Access to ${target.workspace} paused.` : `Access to ${target?.workspace} restored.`, onClose);
  const leave = useAccountAction(user.id, () => removePlatformUserMembership(user.id, target!.workspaceId), `Removed from ${target?.workspace}.`, onClose);

  const confirm = (props: { title: string; message: React.ReactNode; label: string; pending: boolean; error: Error | null; run: () => void; confirmText?: string }) => (
    <ConfirmModal
      title={props.title}
      message={<>{props.message}{props.error && <span role="alert" className="mt-3 block text-exception">{props.error.message}</span>}</>}
      confirmLabel={props.label}
      pendingLabel="Working…"
      isPending={props.pending}
      confirmText={props.confirmText}
      onConfirm={props.run}
      onClose={() => { if (!props.pending) onClose(); }}
    />
  );

  switch (dialog.kind) {
    case 'rename':
      return <RenameModal detail={detail} onClose={onClose} />;
    case 'verify':
    case 'unverify':
      return confirm({
        title: dialog.kind === 'verify' ? 'Mark email as verified?' : 'Clear email verification?',
        message: dialog.kind === 'verify'
          ? `Only after confirming ${user.name} controls ${user.email} — a verified address can be linked to a Google sign-in.`
          : `${user.name} will be asked to verify ${user.email} again.`,
        label: dialog.kind === 'verify' ? 'Mark as verified' : 'Clear verification',
        pending: verify.isPending, error: verify.error, run: () => verify.mutate(dialog.kind === 'verify'),
      });
    case 'reset':
      return confirm({
        title: 'Send a password link?', message: `DUMA emails ${user.email} a link to choose a password. It works for an hour, and creates one if they sign in with Google only.`,
        label: 'Send reset email', pending: reset.isPending, error: reset.error, run: () => reset.mutate(undefined),
      });
    case 'suspend':
      return (
        <ReasonModal
          title={`Suspend ${user.name}?`}
          message="They are signed out everywhere, ChatGPT access is revoked, and they cannot sign in until the suspension is lifted. Nothing in their workspace changes."
          confirmLabel="Suspend account" pending={suspend.isPending} error={suspend.error?.message}
          onConfirm={(reason) => suspend.mutate(reason)} onClose={onClose}
        />
      );
    case 'unsuspend':
      return (
        <ReasonModal
          title={`Lift ${user.name}’s suspension?`} message="They can sign in again straight away."
          confirmLabel="Lift suspension" pending={unsuspend.isPending} error={unsuspend.error?.message}
          onConfirm={(reason) => unsuspend.mutate(reason)} onClose={onClose}
        />
      );
    case 'end-session':
      return confirm({
        title: 'End this session?', message: `${dialog.label} is signed out. They can sign in again.`,
        label: 'End session', pending: endOne.isPending, error: endOne.error, run: () => endOne.mutate(dialog.sessionId),
      });
    case 'end-all':
      return confirm({
        title: 'Sign out everywhere?', message: 'Every session ends and ChatGPT access is revoked. They can sign in again.',
        label: 'Sign out everywhere', pending: endAll.isPending, error: endAll.error, run: () => endAll.mutate(undefined),
      });
    case 'unlink':
      return confirm({
        title: `Disconnect ${dialog.label}?`, message: `${user.name} can no longer sign in with ${dialog.label} until they connect it again.`,
        label: 'Disconnect', pending: unlink.isPending, error: unlink.error, run: () => unlink.mutate(dialog.methodId),
      });
    case 'add-membership':
      return <MembershipModal detail={detail} onClose={onClose} />;
    case 'change-membership':
      return <MembershipModal detail={detail} membership={dialog.membership} onClose={onClose} />;
    case 'toggle-membership':
      return confirm({
        title: dialog.membership.isActive ? `Deactivate in ${dialog.membership.workspace}?` : `Reactivate in ${dialog.membership.workspace}?`,
        message: dialog.membership.isActive
          ? `${user.name} keeps their place in ${dialog.membership.workspace} but cannot work in it until reactivated. Their other workspaces are untouched.`
          : `${user.name} can work in ${dialog.membership.workspace} again with their current role.`,
        label: dialog.membership.isActive ? 'Deactivate' : 'Reactivate',
        pending: toggle.isPending, error: toggle.error, run: () => toggle.mutate(undefined),
      });
    case 'remove-membership':
      return confirm({
        title: `Remove from ${dialog.membership.workspace}?`,
        message: `${user.name} loses access to ${dialog.membership.workspace}. Their account, other workspaces and the history they left there stay.`,
        label: 'Remove', pending: leave.isPending, error: leave.error, run: () => leave.mutate(undefined),
      });
    case 'delete':
      return confirm({
        title: `Delete ${user.name}’s account?`,
        message: 'The account, its sign-in methods and sessions are deleted for good. Records they created elsewhere keep their history without them.',
        label: 'Delete account', pending: remove.isPending, error: remove.error, run: () => remove.mutate(undefined), confirmText: user.email,
      });
  }
}

function ProfileSection({ detail, open }: { detail: Detail; open: (dialog: Dialog) => void }) {
  const { user } = detail;
  const copyId = () => {
    void navigator.clipboard.writeText(user.id).then(() => toast('success', 'User ID copied.'), () => toast('error', 'Couldn’t copy the ID.'));
  };
  return (
    <SettingsSection title="Profile">
      <InfoRows>
        <InfoRow icon={User} title="Name" description={user.name}>
          <Button variant="ghost" size="sm" onClick={() => open({ kind: 'rename' })}><Pencil aria-hidden="true" />Change</Button>
        </InfoRow>
        <InfoRow icon={Mail} title="Email" description={user.email} tone={user.emailVerified ? 'success' : 'warning'}>
          <Badge variant={user.emailVerified ? 'success' : 'warning'}>{user.emailVerified ? 'Verified' : 'Unverified'}</Badge>
          <Button variant="ghost" size="sm" onClick={() => open({ kind: user.emailVerified ? 'unverify' : 'verify' })}>
            {user.emailVerified ? 'Clear' : 'Mark verified'}
          </Button>
        </InfoRow>
        <InfoRow icon={Fingerprint} title="User ID" description={user.id}>
          <Button variant="ghost" size="icon-sm" aria-label="Copy user ID" onClick={copyId}><Copy aria-hidden="true" /></Button>
        </InfoRow>
        <InfoRow icon={Calendar} title="Joined"><span className="text-sm text-foreground">{date(user.createdAt)}</span></InfoRow>
        <InfoRow icon={Clock3} title="Last signed in">
          <span className="text-sm text-foreground">{detail.lastSignInAt ? <RelativeTime iso={detail.lastSignInAt} /> : 'Not recorded'}</span>
        </InfoRow>
      </InfoRows>
    </SettingsSection>
  );
}

function SignInSection({ detail, open }: { detail: Detail; open: (dialog: Dialog) => void }) {
  const password = detail.methods.find((method) => method.providerId === 'credential' && method.hasPassword);
  const others = detail.methods.filter((method) => method.providerId !== 'credential');
  return (
    <SettingsSection title="Sign-in methods" footnote="A Google sign-in with this address opens this account.">
      <InfoRows>
        <InfoRow icon={KeyRound} title="Password" description={password ? `Set ${date(password.createdAt)}` : 'Not set — signs in another way'}>
          <Button variant="ghost" size="sm" onClick={() => open({ kind: 'reset' })}>{password ? 'Send reset' : 'Send set-password link'}</Button>
        </InfoRow>
        {others.map((method) => {
          const label = signInMethodLabel(method.providerId);
          return (
            <InfoRow key={method.id} icon={Link2} title={label} description={`Connected ${date(method.createdAt)}`}>
              {method.canUnlink && (
                <Button variant="ghost" size="sm" onClick={() => open({ kind: 'unlink', methodId: method.id, label })}>Disconnect</Button>
              )}
            </InfoRow>
          );
        })}
      </InfoRows>
    </SettingsSection>
  );
}

function SessionsSection({ detail, open }: { detail: Detail; open: (dialog: Dialog) => void }) {
  return (
    <SettingsSection
      title="Active sessions"
      actions={detail.sessions.length > 0 && !detail.isSelf && (
        <Button variant="outline" className="h-9" onClick={() => open({ kind: 'end-all' })}><LogOut size={14} aria-hidden="true" />Sign out everywhere</Button>
      )}
      footnote={detail.connectedApps > 0 ? `Also connected to ${detail.connectedApps} ${detail.connectedApps === 1 ? 'app' : 'apps'} such as ChatGPT. Signing out everywhere revokes them.` : undefined}
    >
      {detail.sessions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not signed in anywhere.</p>
      ) : (
        <InfoRows>
          {detail.sessions.map((session) => {
            const device = describeDevice(session.userAgent);
            return (
              <InfoRow
                key={session.id}
                icon={device.mobile ? Smartphone : Monitor}
                title={device.label}
                description={[session.ipAddress, `signed in ${date(session.createdAt)}`, `expires ${date(session.expiresAt)}`].filter(Boolean).join(' · ')}
              >
                <span className="hidden text-xs text-muted-foreground sm:inline">Active <RelativeTime iso={session.updatedAt} /></span>
                {session.current ? <Badge variant="reference">This session</Badge> : (
                  <Button variant="ghost" size="sm" onClick={() => open({ kind: 'end-session', sessionId: session.id, label: device.label })}>End</Button>
                )}
              </InfoRow>
            );
          })}
        </InfoRows>
      )}
    </SettingsSection>
  );
}

function membershipLine(member: PlatformUserMembership): string {
  const places = member.scope !== 'location' || member.locationCount === null
    ? 'All locations'
    : `${member.locationCount} ${member.locationCount === 1 ? 'location' : 'locations'}`;
  return [member.roleName ?? member.role, places, `joined ${date(member.joinedAt)}`].join(' · ');
}

function WorkspacesSection({ detail, open }: { detail: Detail; open: (dialog: Dialog) => void }) {
  const switchTo = useWorkspaceSwitch();
  return (
    <SettingsSection
      title="Workspaces"
      actions={<Button variant="outline" className="h-9" onClick={() => open({ kind: 'add-membership' })}><Plus size={14} aria-hidden="true" />Add to workspace</Button>}
    >
      {detail.memberships.length === 0 ? (
        <p className="text-sm text-muted-foreground">Not a member of any workspace. They see “ask your manager to add you” when they sign in.</p>
      ) : (
        <InfoRows>
          {detail.memberships.map((member) => (
            <InfoRow key={member.workspaceId} icon={Building2} title={member.workspace} description={membershipLine(member)} tone={member.isActive ? undefined : 'warning'} wrap>
              {!member.isActive ? <Badge variant="muted">Inactive</Badge> : member.activationPending && <Badge variant="warning">Invited</Badge>}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void switchTo({ kind: 'workspace', tenantId: member.workspaceId, locationId: null }, { href: `/staff/${encodeURIComponent(detail.user.id)}` })}
              >
                Staff record
              </Button>
              <Button variant="ghost" size="sm" onClick={() => open({ kind: 'change-membership', membership: member })}>Change</Button>
              <Button variant="ghost" size="sm" onClick={() => open({ kind: 'toggle-membership', membership: member })}>{member.isActive ? 'Deactivate' : 'Reactivate'}</Button>
              <Button variant="ghost" size="icon-sm" aria-label={`Remove from ${member.workspace}`} onClick={() => open({ kind: 'remove-membership', membership: member })}>
                <Trash2 aria-hidden="true" />
              </Button>
            </InfoRow>
          ))}
        </InfoRows>
      )}
    </SettingsSection>
  );
}

function DangerSection({ detail, open }: { detail: Detail; open: (dialog: Dialog) => void }) {
  const suspended = Boolean(detail.suspension);
  return (
    <SettingsSection title="Account access">
      <InfoRows>
        <InfoRow
          icon={Ban}
          tone={suspended ? 'danger' : undefined}
          title={suspended ? 'Suspended' : 'Suspend account'}
          description={suspended ? 'Cannot sign in until the suspension is lifted.' : detail.blockers.suspend ?? 'Signs them out everywhere and blocks sign-in.'}
          wrap
        >
          {suspended ? (
            <Button variant="outline" size="sm" onClick={() => open({ kind: 'unsuspend' })}>Lift suspension</Button>
          ) : (
            <Button variant="outline" size="sm" disabled={Boolean(detail.blockers.suspend)} onClick={() => open({ kind: 'suspend' })}>Suspend</Button>
          )}
        </InfoRow>
        <InfoRow
          icon={Trash2}
          tone="danger"
          title="Delete account"
          description={detail.blockers.delete ?? 'Permanently removes the account and how it signs in.'}
          wrap
        >
          <Button variant="destructive" size="sm" disabled={Boolean(detail.blockers.delete)} onClick={() => open({ kind: 'delete' })}>Delete</Button>
        </InfoRow>
      </InfoRows>
    </SettingsSection>
  );
}

function Aside({ detail }: { detail: Detail }) {
  return (
    <>
      <SettingsSection title="Platform access">
        {detail.platformRoles.length > 0 ? (
          <InfoRows>
            {detail.platformRoles.map((role) => (
              <InfoRow key={role.id} icon={ShieldCheck} tone="success" title="DUMA Admin" description={`Since ${date(role.grantedAt)}`}>
                <Badge variant="success">Active</Badge>
              </InfoRow>
            ))}
          </InfoRows>
        ) : (
          <InfoRow icon={ShieldOff} title="None"><span /></InfoRow>
        )}
      </SettingsSection>
      {detail.connectedApps > 0 && (
        <SettingsSection title="Connected apps">
          <InfoRow icon={Plug} title={`${detail.connectedApps} ${detail.connectedApps === 1 ? 'app' : 'apps'}`} description="OAuth grants such as ChatGPT"><span /></InfoRow>
        </SettingsSection>
      )}
    </>
  );
}

/**
 * DUMA Admin → Users → one account. Modelled on an identity provider's user
 * page: profile, the workspaces they belong to, how they sign in, where they are signed in,
 * and suspension or deletion. The API decides what is allowed (`blockers`);
 * the buttons only reflect it.
 */
export function AdminUserDetail({ userId }: { userId: string }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const account = useQuery({
    queryKey: moduleQueryKeys.identity.key('platform-user', userId),
    queryFn: ({ signal }) => getPlatformUser(userId, signal),
    meta: { silentError: true },
  });
  const detail = account.data;

  return (
    <EditorShell
      eyebrow="DUMA Admin · Users"
      title={detail?.user.name ?? 'Account'}
      leading={detail && <Avatar name={detail.user.name} email={detail.user.email} size="sm" />}
      meta={detail?.suspension && <Badge variant="destructive">Suspended</Badge>}
      onClose={() => router.push('/admin/users')}
    >
      {account.isPending ? (
        <ListSkeleton rows={8} label="Loading account" />
      ) : account.isError ? (
        <ErrorState title="This account couldn’t be loaded" description={account.error.message} onRetry={() => void account.refetch()} />
      ) : (
        <div className="w-full space-y-4">
          {detail!.suspension && (
            <RowWarning>
              Suspended {date(detail!.suspension.at)}{detail!.suspension.by ? ` by ${detail!.suspension.by}` : ''}: “{detail!.suspension.reason}”
            </RowWarning>
          )}
          <SettingsTabBody narrowAside aside={<Aside detail={detail!} />}>
            <ProfileSection detail={detail!} open={setDialog} />
            <WorkspacesSection detail={detail!} open={setDialog} />
            <SignInSection detail={detail!} open={setDialog} />
            <SessionsSection detail={detail!} open={setDialog} />
            <DangerSection detail={detail!} open={setDialog} />
          </SettingsTabBody>
        </div>
      )}
      {dialog && detail && <AccountDialog dialog={dialog} detail={detail} onClose={() => setDialog(null)} />}
    </EditorShell>
  );
}
