'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useCmsTenantId } from '@/components/cms/ContentScope';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { BLOG_MODEL, BLOG_TYPE_KEY } from '@/lib/blog/model';
import { createCmsContentType, getCmsContentTypes } from '@/lib/modules/cms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

/** Optional blog setup in the internal workspace's ordinary Content overview. */
export function InternalBlogSetup() {
  const tenantId = useCmsTenantId();
  const client = useQueryClient();
  const types = useQuery({
    queryKey: moduleQueryKeys.cms.key('internal-blog-model', tenantId),
    queryFn: () => getCmsContentTypes(tenantId!),
    enabled: !!tenantId,
  });
  const setup = useMutation({
    mutationFn: async () => {
      try {
        await createCmsContentType({ ...BLOG_MODEL, previewUrl: 'https://duma-business.com/blog/{slug}' }, tenantId!);
      } catch (error) {
        if (!(error instanceof ApiError && error.status === 409)) throw error;
        if (!(await getCmsContentTypes(tenantId!)).some((type) => type.key === BLOG_TYPE_KEY)) throw error;
      }
    },
    onSuccess: () => client.invalidateQueries({ queryKey: moduleQueryKeys.cms.all }),
  });
  if (types.isError) return <ErrorState title="Couldn’t check blog setup" onRetry={() => void types.refetch()} />;
  if (!types.data || types.data.some((type) => type.key === BLOG_TYPE_KEY)) return null;
  return (
    <div className="space-y-3 rounded-lg border border-rule/60 p-4">
      <p className="text-sm text-muted-foreground">Set up the DUMA blog model. Published posts appear on the DUMA website.</p>
      <Button disabled={setup.isPending} onClick={() => setup.mutate()}>
        {setup.isPending ? 'Setting up…' : 'Set up blog'}
      </Button>
      {setup.isError && (
        <p role="alert" className="text-sm text-exception">
          {setup.error.message}
        </p>
      )}
    </div>
  );
}
