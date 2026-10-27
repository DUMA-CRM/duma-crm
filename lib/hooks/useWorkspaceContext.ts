'use client';

import { useQuery } from '@tanstack/react-query';
import { createContext, createElement, useContext } from 'react';

import type { TenantModuleState } from '@/lib/api/modules.service';
import { type WorkspaceContextResponse, getWorkspaceContext } from '@/lib/api/platform.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { type WorkspaceContext, contextPartition, describesContext } from '@/lib/utils/workspace-context';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/** One key, partitioned by context in QueryProvider — so each context has its own entry. */
export const WORKSPACE_CONTEXT_KEY = moduleQueryKeys.organization.key('workspace-context');

/**
 * A member's context as the server read it. The tab's own context lives in
 * sessionStorage, which neither the server nor the first client render can
 * see; for a member it can only be their own workspace, so the server says so
 * and both renders agree — the page server-renders whole instead of as a
 * skeleton. Platform administrators get no seed: only the tab knows.
 */
export type WorkspaceSeed = { accountId: string; data: WorkspaceContextResponse } | null;

const WorkspaceSeedContext = createContext<WorkspaceSeed>(null);

export function WorkspaceSeedProvider({ seed, children }: { seed: WorkspaceSeed; children: React.ReactNode }) {
  return createElement(WorkspaceSeedContext.Provider, { value: seed }, children);
}

/**
 * The tab's context as the API describes it: the actor, and the workspace's
 * identity, status, brand, timezone and modules. Every consumer shares the one
 * request. An answer that does not describe the tab's current selection (a
 * late response from before a switch) is treated as no answer at all.
 */
export function useWorkspaceContext() {
  const seed = useContext(WorkspaceSeedContext);
  const stored = useWorkspaceStore((state) => state.context);
  const storedAccount = useWorkspaceStore((state) => state.accountId);
  const seededWorkspace = seed?.data.workspace;
  const context: WorkspaceContext =
    stored.kind === 'unresolved' && seededWorkspace ? { kind: 'workspace', tenantId: seededWorkspace.id, locationId: null } : stored;
  const accountId = stored.kind === 'unresolved' && seed ? seed.accountId : storedAccount;

  const query = useQuery({
    queryKey: WORKSPACE_CONTEXT_KEY,
    queryFn: ({ signal }) => getWorkspaceContext(signal),
    // Only once the tab itself has decided: requests carry the tab's context.
    enabled: stored.kind !== 'unresolved',
    staleTime: 30_000,
    // Module switches and brand changes made elsewhere arrive within a minute.
    refetchInterval: 60_000,
    // The boundary shows this failure itself, with retry — no toast on top.
    meta: { silentError: true },
  });
  const fromQuery = query.data && describesContext(context, query.data) ? query.data : undefined;
  const fromSeed = seed && accountId === seed.accountId && describesContext(context, seed.data) ? seed.data : undefined;
  const data: WorkspaceContextResponse | undefined = fromQuery ?? fromSeed;
  return {
    context,
    partition: contextPartition(accountId, context),
    data,
    workspace: data?.workspace ?? null,
    isLoading: context.kind === 'unresolved' || (!data && !query.isError),
    isError: !data && query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

/** The workspace's module state, or undefined while it is not known — never another workspace's. */
export function useWorkspaceModules(): readonly TenantModuleState[] | undefined {
  return useWorkspaceContext().workspace?.modules;
}
