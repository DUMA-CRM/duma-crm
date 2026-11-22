'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Building2, Check, Loader2, Mail } from '@/components/icons';
import { Badge } from '@/components/ui/badge';

import { acceptMyInvitation, getMyWorkspaces, setActiveWorkspace } from '@/lib/api/workspaces.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { hasUnsavedWork } from '@/lib/utils/unsaved-work';

export const myWorkspacesKey = moduleQueryKeys.identity.key('my-workspaces');

/**
 * Switching is per browser for workspace members: the API remembers the choice
 * (cookie + account), and a full load lets the server render the new
 * workspace's role, modules and brand from the first paint — every check made
 * on the server is then right for it, which a client-only swap could not be.
 */
export async function enterWorkspace(tenantId: string) {
  await setActiveWorkspace(tenantId);
  window.location.assign(new URL('/dashboard', window.location.origin));
}

/**
 * The account menu's workspace rows for a member: the one they are in, the
 * others they can switch to, and invitations waiting for them. With a single
 * workspace and nothing pending it is just the name, as before.
 */
export function MemberWorkspaces({ open, fallbackName, itemClass }: { open: boolean; fallbackName: string | undefined; itemClass: string }) {
  const mine = useQuery({ queryKey: myWorkspacesKey, queryFn: ({ signal }) => getMyWorkspaces(signal), enabled: open, staleTime: 60_000, meta: { silentError: true } });
  const [busy, setBusy] = useState<string | null>(null);

  const go = async (id: string, action: () => Promise<unknown>) => {
    if (hasUnsavedWork() && !window.confirm('Switch workspace and discard your unsaved changes?')) return;
    setBusy(id);
    try {
      await action();
    } catch (error) {
      setBusy(null);
      toast('error', error instanceof Error ? error.message : 'That didn’t work. Try again.');
    }
  };

  const others = mine.data?.workspaces.filter((workspace) => !workspace.current && workspace.isActive) ?? [];
  const invitations = mine.data?.invitations ?? [];
  const current = mine.data?.workspaces.find((workspace) => workspace.current);
  const name = current?.name ?? fallbackName;

  return (
    <div role="group" aria-label="Workspaces">
      {name && (
        <div className={cn(itemClass, 'hover:bg-transparent')}>
          <Building2 size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          {others.length > 0 && <Check size={14} aria-label="Current workspace" className="shrink-0 text-primary" />}
        </div>
      )}
      {others.map((workspace) => (
        <button
          key={workspace.tenantId}
          type="button"
          className={itemClass}
          disabled={busy !== null}
          onClick={() => void go(workspace.tenantId, () => enterWorkspace(workspace.tenantId))}
        >
          {busy === workspace.tenantId ? (
            <Loader2 size={16} aria-hidden="true" className="shrink-0 motion-safe:animate-spin text-muted-foreground" />
          ) : (
            <Building2 size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{workspace.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{workspace.roleName}</span>
        </button>
      ))}
      {invitations.map((invitation) => (
        <button
          key={invitation.id}
          type="button"
          className={itemClass}
          disabled={busy !== null}
          onClick={() =>
            void go(invitation.id, async () => {
              const { tenantId } = await acceptMyInvitation(invitation.id);
              await enterWorkspace(tenantId);
            })
          }
          aria-label={`Accept the invitation to ${invitation.workspaceName} and switch to it`}
        >
          {busy === invitation.id ? (
            <Loader2 size={16} aria-hidden="true" className="shrink-0 motion-safe:animate-spin text-muted-foreground" />
          ) : (
            <Mail size={16} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          )}
          <span className="min-w-0 flex-1 truncate text-left">{invitation.workspaceName}</span>
          <Badge variant="reference">Join</Badge>
        </button>
      ))}
    </div>
  );
}
