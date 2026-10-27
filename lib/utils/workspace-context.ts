/**
 * The one context model: where this tab is working.
 *
 * - `platform` — DUMA Admin. No workspace; platform tools and aggregates only.
 * - `workspace` — one workspace (a client's, or DUMA's internal one) and,
 *   optionally, one of its locations.
 * - `unresolved` — not decided yet (hydrating, or a new tab before the account
 *   is known). A loading state, never a choice; nothing tenant-scoped renders.
 *
 * The context is per tab (sessionStorage) and per account: a second tab can sit
 * in another workspace, and a different person signing in on the same browser
 * never inherits a selection. Every API request carries it explicitly
 * (`X-Duma-Workspace`, or `X-Duma-Context: platform`), so the server never
 * guesses from a home workspace.
 *
 * Pure: imported by stores, the API client and the tests.
 */

export type WorkspaceContext =
  | { kind: 'unresolved' }
  | { kind: 'platform' }
  | { kind: 'workspace'; tenantId: string; locationId: string | null };

export const WORKSPACE_HEADER = 'X-Duma-Workspace';
export const CONTEXT_HEADER = 'X-Duma-Context';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The headers that scope a request to a context. None while unresolved. */
export function scopeHeaders(context: WorkspaceContext): Record<string, string> {
  if (context.kind === 'platform') return { [CONTEXT_HEADER]: 'platform' };
  if (context.kind === 'workspace' && UUID.test(context.tenantId)) return { [WORKSPACE_HEADER]: context.tenantId };
  return {};
}

/**
 * The cache partition for a context. Location is deliberately not part of it:
 * changing location inside a workspace keeps the workspace's cache, and every
 * location-scoped query already names its location in its key.
 */
export function contextPartition(accountId: string | null, context: WorkspaceContext): string {
  const who = accountId ?? 'anonymous';
  if (context.kind === 'workspace') return `${who}|w:${context.tenantId}`;
  return `${who}|${context.kind}`;
}

/**
 * Whether a context response still describes what the tab has selected. A
 * switch made while it was in flight makes it stale: it is dropped, never
 * applied — so a slow answer for A cannot repaint B.
 */
export function describesContext(
  context: WorkspaceContext,
  response: { mode: 'platform' | 'workspace'; workspace: { id: string } | null },
): boolean {
  if (context.kind === 'platform') return response.mode === 'platform';
  if (context.kind === 'workspace') return response.mode === 'workspace' && response.workspace?.id === context.tenantId;
  return false;
}

export type AccountKind = 'platform' | 'member' | 'none';

/**
 * Where a tab starts.
 *
 * A remembered context is used only when it belongs to this account. A member
 * is always in their own workspace (their location is kept only when it is
 * still one of theirs). A platform administrator with nothing remembered starts
 * in DUMA Admin — never auto-dropped into a client because only one exists.
 */
export function initialContext(input: {
  accountId: string;
  account: AccountKind;
  homeTenantId: string | null;
  assignedLocationIds: readonly string[] | null;
  remembered: { accountId: string | null; context: WorkspaceContext } | null;
}): WorkspaceContext {
  const remembered = input.remembered?.accountId === input.accountId ? input.remembered.context : null;

  if (input.account === 'platform') {
    return remembered && remembered.kind !== 'unresolved' ? remembered : { kind: 'platform' };
  }
  if (input.account === 'member' && input.homeTenantId) {
    const assigned = input.assignedLocationIds ?? [];
    const rememberedLocation =
      remembered?.kind === 'workspace' && remembered.tenantId === input.homeTenantId ? remembered.locationId : null;
    const locationId =
      assigned.length === 0
        ? rememberedLocation
        : rememberedLocation && assigned.includes(rememberedLocation)
          ? rememberedLocation
          : (assigned[0] ?? null);
    return { kind: 'workspace', tenantId: input.homeTenantId, locationId };
  }
  return { kind: 'unresolved' };
}

/** Which contexts a member may select. Only platform administrators may leave their own. */
export function canSelect(account: AccountKind, homeTenantId: string | null, target: WorkspaceContext): boolean {
  if (target.kind === 'unresolved') return false;
  if (account === 'platform') return true;
  return account === 'member' && target.kind === 'workspace' && target.tenantId === homeTenantId;
}

export const sameContext = (a: WorkspaceContext, b: WorkspaceContext): boolean =>
  a.kind === b.kind && (a.kind !== 'workspace' || (b.kind === 'workspace' && a.tenantId === b.tenantId));

/**
 * The analytics properties for events in this context. Platform administrators
 * visiting a client are support, not the client's usage — `actor_kind` says so,
 * and DUMA Admin's usage query excludes them. No names, no content.
 */
export function analyticsContext(
  account: AccountKind,
  context: WorkspaceContext,
  classification: 'customer' | 'internal' | 'demo' | null,
): Record<string, string | null> {
  return {
    context_kind: context.kind === 'workspace' ? 'workspace' : context.kind,
    workspace_id: context.kind === 'workspace' ? context.tenantId : null,
    workspace_classification: context.kind === 'workspace' ? classification : null,
    actor_kind: account === 'platform' ? 'platform_admin' : account === 'member' ? 'staff' : 'none',
  };
}

/** Brand caches per context. DUMA Admin always wears DUMA's default. */
export function brandForContext<B extends string>(
  cache: Readonly<Record<string, NoInfer<B>>>,
  partition: string,
  context: WorkspaceContext,
  fallback: B,
): B {
  if (context.kind !== 'workspace') return fallback;
  return cache[partition] ?? fallback;
}
