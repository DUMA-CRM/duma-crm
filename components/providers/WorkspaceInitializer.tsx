'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useLayoutEffect } from 'react';

import type { WorkspaceContextResponse } from '@/lib/api/platform.service';
import { WORKSPACE_CONTEXT_KEY } from '@/lib/hooks/useWorkspaceContext';
import { type AccountKind, initialContext } from '@/lib/utils/workspace-context';
import { useOfflineOrdersStore } from '@/stores/offlineOrdersStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Decides where this tab starts, once the account is known.
 *
 * A member is always in their own workspace. A platform administrator resumes
 * this tab's remembered context, or starts in DUMA Admin — never in a client
 * workspace because it happens to be the only one. A different account signing
 * in on this browser starts fresh (lib/utils/workspace-context.ts).
 *
 * The server read a member's workspace context with the profile; it seeds the
 * cache for that exact workspace only, so the first paint is complete and no
 * other workspace can inherit it.
 */
export function WorkspaceInitializer({
  userId,
  account,
  homeTenantId,
  locationIds,
  seed,
}: {
  userId: string;
  account: AccountKind;
  homeTenantId: string | null;
  locationIds: readonly string[] | null;
  seed: WorkspaceContextResponse | null;
}) {
  const qc = useQueryClient();

  useLayoutEffect(() => {
    const store = useWorkspaceStore.getState();
    const next = initialContext({
      accountId: userId,
      account,
      homeTenantId,
      assignedLocationIds: locationIds,
      remembered: { accountId: store.accountId, context: store.context },
    });
    if (store.accountId !== userId || JSON.stringify(store.context) !== JSON.stringify(next)) store.setContext(userId, next);

    if (seed?.workspace && next.kind === 'workspace' && seed.workspace.id === next.tenantId && !qc.getQueryData(WORKSPACE_CONTEXT_KEY)) {
      qc.setQueryData(WORKSPACE_CONTEXT_KEY, seed);
    }

    // Sales queued before scoping existed belong to the member's own workspace.
    // A platform administrator's are never reassigned to wherever they are now.
    if (account === 'member' && homeTenantId) useOfflineOrdersStore.getState().claimUnscoped(userId, homeTenantId);

    // The pre-2026-10 device-wide selection: no longer read, so no longer kept.
    try {
      localStorage.removeItem('duma-workspace');
    } catch {
      // Storage blocked — nothing to clean.
    }
  }, [account, homeTenantId, locationIds, qc, seed, userId]);

  return null;
}
