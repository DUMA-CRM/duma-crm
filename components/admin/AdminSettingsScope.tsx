'use client';

import { useMutation, useQuery } from '@tanstack/react-query';

import { ContentScope } from '@/components/cms/ContentScope';
import { SettingsScope } from '@/components/settings/SettingsScope';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { getPlatformContext, provisionInternalWorkspace } from '@/lib/api/platform.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

export function AdminSettingsScope({ children }: { children: React.ReactNode }) {
  const context = useQuery({ queryKey: moduleQueryKeys.organization.key('admin-settings-context'), queryFn: getPlatformContext });
  const setup = useMutation({
    mutationFn: () => provisionInternalWorkspace({ name: 'DUMA', slug: 'duma-internal', timezone: 'Europe/London', moduleIds: ['cms'] }),
    onSuccess: () => context.refetch(),
  });
  if (context.isPending) return <LoadingState label="Loading DUMA settings" />;
  if (context.isError)
    return <ErrorState title="Couldn’t load DUMA settings" description={context.error.message} onRetry={() => void context.refetch()} />;
  const workspace = context.data.internalWorkspace;
  if (!workspace)
    return (
      <EditorShell title="Settings">
        <div className="max-w-xl space-y-4">
          <h2 className="text-lg font-semibold">Set up DUMA’s settings</h2>
          <p className="text-sm text-muted-foreground">
            Create DUMA’s internal workspace to keep its connections and configuration together.
          </p>
          <Button disabled={setup.isPending} onClick={() => setup.mutate()}>
            {setup.isPending ? 'Setting up…' : 'Set up settings'}
          </Button>
          {setup.isError && (
            <p role="alert" className="text-sm text-exception">
              {setup.error.message}
            </p>
          )}
        </div>
      </EditorShell>
    );
  return (
    <SettingsScope.Provider value={{ tenantId: workspace.id, connectorsPath: '/admin/settings/connectors' }}>
      <ContentScope.Provider
        value={{ tenantId: workspace.id, basePath: '/admin/content', storagePath: '/admin/settings/connectors?connector=media-storage' }}
      >
        {children}
      </ContentScope.Provider>
    </SettingsScope.Provider>
  );
}
