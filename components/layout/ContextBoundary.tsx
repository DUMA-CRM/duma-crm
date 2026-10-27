'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Fragment, useEffect } from 'react';

import { ArrowLeft, Boxes, Building2 } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { isAdminRoute, isPersonalRoute } from '@/lib/constants/admin-nav';
import { useWorkspaceContext } from '@/lib/hooks/useWorkspaceContext';
import { useWorkspaceSwitch } from '@/lib/hooks/useWorkspaceSwitch';
import { moduleForPage } from '@/lib/modules/manifest';
import { useAuthStore } from '@/stores/authStore';

import { WorkspacePickerList } from './ContextSwitcher';

/** The neutral wait while a context loads: no workspace's name, colour or data. */
function NeutralLoading() {
  return (
    <div className="space-y-6" role="status" aria-busy="true" aria-label="Loading workspace">
      <div className="flex items-center justify-between gap-4">
        <Bone className="h-7 w-56 max-w-3/4" />
        <Bone className="hidden h-9 w-28 sm:block" />
      </div>
      <FactsSkeleton count={4} label="Loading figures" />
      <ListSkeleton rows={6} label="Loading list" />
    </div>
  );
}

/**
 * The content area belongs to exactly one context at a time.
 *
 * It is keyed by context, so a switch unmounts the old workspace's screen —
 * its data, half-typed filters and buttons — at once, rather than leaving it
 * on show (and clickable) while the new one loads. The new context renders
 * whole once its context has loaded; until then, a neutral wait. A failed load
 * offers retry and a way back, never a blend of two workspaces.
 *
 * In DUMA Admin a workspace page explains that it needs a workspace and offers
 * the picker; personal pages (account, updates, support) work in any context.
 */
export function ContextBoundary({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPlatformAccount = useAuthStore((state) => state.role === 'super_admin');
  const { context, partition, data, isError, error, refetch } = useWorkspaceContext();
  const switchTo = useWorkspaceSwitch();

  // Sign-in lands everyone on the dashboard; in DUMA Admin, that is Overview.
  const router = useRouter();
  const landing = context.kind === 'platform' && (pathname === '/dashboard' || pathname === '/');
  useEffect(() => {
    if (landing) router.replace('/admin/overview');
  }, [landing, router]);

  if (context.kind === 'unresolved' || landing) return <NeutralLoading />;

  const personal = isPersonalRoute(pathname);
  const admin = isAdminRoute(pathname);

  if (context.kind === 'platform' && !admin && !personal) {
    return (
      <div className="mx-auto max-w-xl space-y-4">
        <EmptyState
          icon={Building2}
          title="Choose a workspace"
          description="This page belongs to a workspace, and DUMA Admin is not one. Pick the workspace to open it in, or go back to DUMA Admin."
          kind="start"
          action={{ label: 'Back to DUMA Admin', icon: ArrowLeft, onClick: () => void switchTo({ kind: 'platform' }) }}
          compact
        />
        <WorkspacePickerList onPick={(target) => void switchTo(target, { href: pathname })} />
      </div>
    );
  }

  if (context.kind === 'workspace' && admin && isPlatformAccount) {
    // A typed URL or the back button into DUMA Admin from a workspace.
    return (
      <EmptyState
        icon={ArrowLeft}
        title="This is part of DUMA Admin"
        description="Leave the workspace to open it."
        kind="start"
        action={{ label: 'Go to DUMA Admin', onClick: () => void switchTo({ kind: 'platform' }, { href: pathname }) }}
      />
    );
  }

  if (isError && !personal) {
    const missing = error instanceof ApiError && (error.status === 404 || error.code === 'workspace_not_found');
    const refused = error instanceof ApiError && error.status === 403;
    return (
      <div className="flex flex-col items-center">
        <ErrorState
          title={
            missing ? 'That workspace no longer exists' : refused ? 'You can’t open this workspace' : 'This workspace couldn’t be loaded'
          }
          description={
            missing || refused
              ? 'Nothing from another workspace is shown in its place.'
              : 'Check your connection, then try again. Nothing from another workspace is shown in its place.'
          }
          onRetry={missing || refused ? undefined : () => void refetch()}
        />
        {isPlatformAccount && (
          <Button variant="outline" onClick={() => void switchTo({ kind: 'platform' })}>
            <ArrowLeft size={14} aria-hidden="true" />
            Back to DUMA Admin
          </Button>
        )}
      </div>
    );
  }

  if (!data && !personal) return <NeutralLoading />;

  // A module's own page in a workspace that has it switched off: say so, and
  // offer its settings. Opening a module never enables it as a side effect.
  // Only for a platform administrator — a member's workspace is known on the
  // server, whose module layouts already redirect (or fall back) for them.
  const pageModule = data?.actor.kind === 'platform' ? moduleForPage(pathname) : undefined;
  const state = pageModule ? data?.workspace?.modules.find((entry) => entry.moduleId === pageModule) : undefined;
  if (state && state.status !== 'enabled') {
    return (
      <EmptyState
        icon={Boxes}
        title={`This module is off in ${data?.workspace?.name ?? 'this workspace'}`}
        description="Switch it on in the workspace’s module settings to use it here. Its records, if any, are kept."
        kind="gone"
        action={{ label: 'Open module settings', href: '/settings/modules' }}
      />
    );
  }

  return <Fragment key={partition}>{children}</Fragment>;
}
