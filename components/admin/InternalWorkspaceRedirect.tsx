'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';

import { Building2 } from '@/components/icons';
import { usePlatformContext } from '@/components/layout/ContextSwitcher';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';

import { INTERNAL_WORKSPACE_ROUTES } from '@/lib/constants/admin-nav';
import { useWorkspaceSwitch } from '@/lib/hooks/useWorkspaceSwitch';

function RedirectToInternal() {
  const platform = usePlatformContext();
  const switchTo = useWorkspaceSwitch();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const workspace = platform.data?.internalWorkspace;
  const params = new URLSearchParams(searchParams.toString());
  if (pathname === '/admin/updates') params.set('tab', 'updates');
  if (pathname === '/admin/content/storage') params.set('connector', 'media-storage');
  const destination = INTERNAL_WORKSPACE_ROUTES[pathname] ?? '/dashboard';
  const href = `${destination}${params.size ? `?${params}` : ''}`;

  useEffect(() => {
    if (workspace) void switchTo({ kind: 'workspace', tenantId: workspace.id, locationId: null }, { href, replace: true });
  }, [workspace, href, switchTo]);

  if (platform.isError) return <ErrorState title="Couldn’t load the internal workspace" onRetry={() => void platform.refetch()} />;
  if (platform.isPending || workspace) return <LoadingState label="Opening DUMA’s internal workspace" />;
  return (
    <EmptyState
      icon={Building2}
      title="Set up DUMA’s internal workspace"
      description="DUMA’s content, updates and connections now live in its own workspace."
      action={{ label: 'Open workspaces', onClick: () => void switchTo({ kind: 'platform' }, { href: '/admin/workspaces' }) }}
    />
  );
}

/** Keep bookmarks working while switching the whole tab, including its request scope. */
export function InternalWorkspaceRedirect() {
  return (
    <Suspense fallback={<LoadingState label="Opening DUMA’s internal workspace" />}>
      <RedirectToInternal />
    </Suspense>
  );
}
