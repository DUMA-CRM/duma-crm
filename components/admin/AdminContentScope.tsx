'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';

import { ContentScope } from '@/components/cms/ContentScope';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { changeTenantModule, getTenantModules, previewTenantModuleChange } from '@/lib/api/modules.service';
import { getPlatformContext, provisionInternalWorkspace } from '@/lib/api/platform.service';
import { BLOG_MODEL, BLOG_TYPE_KEY } from '@/lib/blog/model';
import { createCmsContentType, getCmsContentTypes } from '@/lib/modules/cms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

/** Content is owned by DUMA's internal tenant, without changing the tab's platform context. */
export function AdminContentScope({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const state = useQuery({
    queryKey: moduleQueryKeys.cms.key('admin-setup'),
    queryFn: async () => {
      const { internalWorkspace: workspace } = await getPlatformContext();
      if (!workspace) return { workspace, ready: false };
      const modules = await getTenantModules(workspace.id);
      if (!modules.some((item) => item.moduleId === 'cms' && item.status === 'enabled')) return { workspace, ready: false };
      const types = await getCmsContentTypes(workspace.id);
      return { workspace, ready: types.some((type) => type.key === BLOG_TYPE_KEY) };
    },
  });
  const setup = useMutation({
    mutationFn: async () => {
      const { workspace } = await provisionInternalWorkspace({
        name: 'DUMA',
        slug: 'duma-internal',
        timezone: 'Europe/London',
        moduleIds: ['cms'],
      });
      const modules = await getTenantModules(workspace.id);
      if (!modules.some((item) => item.moduleId === 'cms' && item.status === 'enabled')) {
        const preview = await previewTenantModuleChange(workspace.id, 'cms', 'enabled');
        await changeTenantModule(workspace.id, preview, 'Enable DUMA website content and blog');
      }
      const types = await getCmsContentTypes(workspace.id);
      if (!types.some((type) => type.key === BLOG_TYPE_KEY)) {
        try {
          await createCmsContentType({ ...BLOG_MODEL, previewUrl: 'https://duma-business.com/blog/{slug}' }, workspace.id);
        } catch (error) {
          // Another administrator may finish setup at the same time.
          if (!(error instanceof ApiError && error.status === 409)) throw error;
          if (!(await getCmsContentTypes(workspace.id)).some((type) => type.key === BLOG_TYPE_KEY)) throw error;
        }
      }
    },
    onSuccess: () => state.refetch(),
  });

  if (pathname === '/admin/content/storage') return children;
  if (state.isPending) return <LoadingState label="Loading DUMA content" />;
  if (state.isError)
    return <ErrorState title="Couldn’t load DUMA content" description={state.error.message} onRetry={() => void state.refetch()} />;
  if (!state.data.ready || !state.data.workspace) {
    return (
      <EditorShell title="Content">
        <div className="mx-auto max-w-xl space-y-4 py-8">
          <h2 className="text-lg font-semibold">Set up the DUMA blog</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Create the blog model in DUMA’s internal workspace. Published posts appear on /blog. You can write drafts, manage media and
            connect your own storage here.
          </p>
          <Button onClick={() => setup.mutate()} disabled={setup.isPending}>
            {setup.isPending ? 'Setting up…' : 'Set up blog'}
          </Button>
          {setup.isError && (
            <p role="alert" className="text-sm text-exception">
              {setup.error.message}
            </p>
          )}
        </div>
      </EditorShell>
    );
  }
  return (
    <ContentScope.Provider
      value={{
        tenantId: state.data.workspace.id,
        basePath: '/admin/content',
        storagePath: '/admin/settings/connectors?connector=media-storage',
      }}
    >
      {children}
    </ContentScope.Provider>
  );
}
