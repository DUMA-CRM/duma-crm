'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { track } from '@/lib/analytics/client';
import { hasUnsavedWork } from '@/lib/utils/unsaved-work';
import { type WorkspaceContext, canSelect, sameContext } from '@/lib/utils/workspace-context';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Move this tab to another context — DUMA Admin, or a workspace.
 *
 * In order: ask about unsaved work; cancel the old context's reads; replace the
 * context (location cleared); navigate. The content area is keyed by context,
 * so the old workspace's screens, actions and colour leave at once and the new
 * one appears whole when its context has loaded. Queued writes keep the
 * workspace they were submitted in — apiFetch read it when they were sent.
 */
export function useWorkspaceSwitch() {
  const qc = useQueryClient();
  const router = useRouter();
  const role = useAuthStore((state) => state.role);
  const userId = useAuthStore((state) => state.user?.id ?? null);

  return useCallback(
    async (target: Exclude<WorkspaceContext, { kind: 'unresolved' }>, options: { href?: string; discardUnsaved?: boolean } = {}) => {
      const { context, tenantId } = useWorkspaceStore.getState();
      const account = role === 'super_admin' ? 'platform' : 'member';
      const href = options.href ?? (target.kind === 'platform' ? '/admin/overview' : '/dashboard');
      if (!canSelect(account, tenantId, target)) return false;
      if (sameContext(context, target)) {
        router.push(href);
        return true;
      }
      // Callers with their own confirmation (ContextSwitcher) pass discardUnsaved.
      if (!options.discardUnsaved && hasUnsavedWork() && !window.confirm('You have unsaved changes. Switch anyway and discard them?'))
        return false;

      // Reads belong to the context that asked for them. Writes are left alone.
      await qc.cancelQueries();
      useWorkspaceStore.getState().setContext(userId, target.kind === 'workspace' ? { ...target, locationId: null } : target);
      track('workspace_switched', { to: target.kind });
      router.push(href);
      return true;
    },
    [qc, role, router, userId],
  );
}
