import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { registerRequestScope } from '@/lib/api/request-scope';
import { type WorkspaceContext, contextPartition, scopeHeaders } from '@/lib/utils/workspace-context';

interface WorkspaceState {
  /** The account this tab's context belongs to; another account never inherits it. */
  accountId: string | null;
  /** Where this tab is working. See lib/utils/workspace-context.ts. */
  context: WorkspaceContext;
  /** Derived from `context`, for the many screens that only need these two. */
  tenantId: string | null;
  locationId: string | null;
  /** Replace the whole context. Switching workspaces goes through useWorkspaceSwitch, not here. */
  setContext: (accountId: string | null, context: WorkspaceContext) => void;
  /** Choose a workspace (or, with null, DUMA Admin) for the current account. Clears location. */
  setTenantId: (id: string | null) => void;
  setLocationId: (id: string | null) => void;
}

const derived = (context: WorkspaceContext) => ({
  context,
  tenantId: context.kind === 'workspace' ? context.tenantId : null,
  locationId: context.kind === 'workspace' ? context.locationId : null,
});

// Per tab, not per device: sessionStorage survives a refresh of this tab and
// nothing else, so two tabs can work in two workspaces and neither moves the
// other. A localStorage selection used to be shared by every tab and every
// person on the device.
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      accountId: null,
      ...derived({ kind: 'unresolved' }),
      setContext: (accountId, context) => set({ accountId, ...derived(context) }),
      setTenantId: (id) => set(derived(id ? { kind: 'workspace', tenantId: id, locationId: null } : { kind: 'platform' })),
      setLocationId: (id) => {
        const { context } = get();
        if (context.kind !== 'workspace') return;
        set(derived({ ...context, locationId: id }));
      },
    }),
    {
      name: 'duma-workspace-tab',
      version: 1,
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ accountId: state.accountId, context: state.context }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<Pick<WorkspaceState, 'accountId' | 'context'>> | undefined;
        return saved?.context ? { ...current, accountId: saved.accountId ?? null, ...derived(saved.context) } : current;
      },
    },
  ),
);

/** The cache partition for what this tab is looking at — see QueryProvider. */
export const currentPartition = () => {
  const { accountId, context } = useWorkspaceStore.getState();
  return contextPartition(accountId, context);
};

// Every browser request carries this tab's context, read when the request is
// made — so a mutation keeps the workspace it was submitted in even if the tab
// switches before it lands.
registerRequestScope(() => scopeHeaders(useWorkspaceStore.getState().context));
