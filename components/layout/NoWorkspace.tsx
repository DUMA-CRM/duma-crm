'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { Building2, LogOut, Mail } from '@/components/icons';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Logo } from '@/components/shared/Logo';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { acceptMyInvitation, declineMyInvitation, getMyWorkspaces } from '@/lib/api/workspaces.service';
import { useAuth } from '@/lib/hooks/useAuth';
import { sendVerificationEmail } from '@/lib/modules/identity/client';
import { toast } from '@/lib/toast';
import { formatInstant } from '@/lib/utils/workspace-time';

import { enterWorkspace, myWorkspacesKey } from './MemberWorkspaces';

/**
 * What an account in no workspace sees: who to ask, the invitations waiting
 * for its confirmed address, and a way out. It checks again every 30 seconds, so being added by a manager or DUMA support
 * shows up without a reload.
 */
export function NoWorkspace({ email, name }: { email: string; name: string }) {
  const qc = useQueryClient();
  const { logout } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const mine = useQuery({
    queryKey: myWorkspacesKey,
    queryFn: ({ signal }) => getMyWorkspaces(signal),
    refetchInterval: 30_000,
    meta: { silentError: true },
  });
  const added = mine.data?.workspaces.find((workspace) => workspace.isActive);
  const resend = useMutation({
    mutationFn: () => sendVerificationEmail(email, `${window.location.origin}/verify-email`),
    onSuccess: () => toast('success', `Confirmation email sent to ${email}.`),
    onError: (error) => toast('error', error.message),
  });
  const decline = useMutation({
    mutationFn: declineMyInvitation,
    onSuccess: () => void qc.invalidateQueries({ queryKey: myWorkspacesKey }),
    onError: (error) => toast('error', error.message),
  });

  // Added while this screen was open: go straight in.
  useEffect(() => {
    if (added) window.location.assign(new URL('/dashboard', window.location.origin));
  }, [added]);

  const accept = async (id: string) => {
    setBusy(id);
    try {
      const { tenantId } = await acceptMyInvitation(id);
      await enterWorkspace(tenantId);
    } catch (error) {
      setBusy(null);
      toast('error', error instanceof Error ? error.message : 'The invitation couldn’t be accepted.');
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center text-center">
          <Logo size={48} className="rounded-[19.4%] shadow-sm" />
          <h1 className="mt-6 text-2xl font-semibold text-heading">You’re not in a workspace yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Hi {name.split(' ')[0] || 'there'}. Ask your manager to invite <strong className="text-foreground">{email}</strong> to their DUMA
            workspace. Invitations appear here as soon as they’re sent.
          </p>
        </div>

        <section className="mt-8" aria-labelledby="no-workspace-invitations">
          <h2 id="no-workspace-invitations" className="mb-2 text-label uppercase text-muted-foreground">
            Invitations
          </h2>
          {mine.isPending ? (
            <ListSkeleton rows={2} label="Loading invitations" />
          ) : mine.isError ? (
            <ErrorState title="Invitations couldn’t be loaded" description={mine.error.message} onRetry={() => void mine.refetch()} />
          ) : !mine.data.emailVerified ? (
            <div className="rounded-lg border border-border bg-card p-4 text-sm">
              <p className="text-foreground">Confirm your email to see invitations sent to it.</p>
              <p className="mt-1 text-muted-foreground">Or open the link in the invitation email — that confirms it too.</p>
              <Button className="mt-3" size="sm" variant="outline" disabled={resend.isPending || resend.isSuccess} onClick={() => resend.mutate()}>
                <Mail aria-hidden="true" />
                {resend.isSuccess ? 'Email sent' : 'Send confirmation email'}
              </Button>
            </div>
          ) : mine.data.invitations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
              No invitations yet. This page checks again on its own.
            </p>
          ) : (
            <ListRowGroup>
              {mine.data.invitations.map((invitation) => (
                <ListRow
                  key={invitation.id}
                  leading={<Building2 size={18} aria-hidden="true" className="text-muted-foreground" />}
                  title={invitation.workspaceName}
                  meta={`${invitation.roleName}${invitation.inviterName ? ` · from ${invitation.inviterName}` : ''} · expires ${formatInstant(invitation.expiresAt, { dateStyle: 'medium' })}`}
                  trailing={
                    <span className="flex gap-2">
                      <Button size="sm" variant="ghost" disabled={busy !== null || decline.isPending} onClick={() => decline.mutate(invitation.id)}>
                        Decline
                      </Button>
                      <Button size="sm" disabled={busy !== null} onClick={() => void accept(invitation.id)}>
                        {busy === invitation.id ? 'Joining…' : 'Join'}
                      </Button>
                    </span>
                  }
                />
              ))}
            </ListRowGroup>
          )}
        </section>

        <div className="mt-8 flex justify-center text-sm">
          <button type="button" onClick={() => void logout()} className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground">
            <LogOut size={14} aria-hidden="true" />
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
