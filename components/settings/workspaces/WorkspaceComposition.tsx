'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { LayoutDashboard, Loader2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { WorkspaceReadinessChecklist } from '@/components/settings/workspaces/WorkspaceReadinessChecklist';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getDashboardLayouts, publishDashboardLayout } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function WorkspaceComposition() {
  const qc = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const layoutsQuery = useQuery({
    queryKey: moduleQueryKeys.organization.key('dashboard-layouts', tenantId),
    queryFn: () => getDashboardLayouts(tenantId!),
    enabled: !!tenantId,
  });

  const publish = useMutation({
    mutationFn: () => publishDashboardLayout(tenantId!, 'owner', 'Owner dashboard'),
    onSuccess: () => qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('dashboard-layouts', tenantId) }),
  });

  const ownerLayouts = (layoutsQuery.data ?? []).filter((layout) => layout.audienceKey === 'owner');
  const publishedLayout = ownerLayouts.find((layout) => layout.status === 'published');
  const error = publish.error ?? layoutsQuery.error;

  return (
    <SettingsSection
      title="Workspace readiness"
      description="DUMA reads the enabled modules and live workspace data, then points to each missing prerequisite. Readiness cannot be checked off by hand."
      footnote="Publishing creates a new revision. Earlier dashboard versions remain available for audit and rollback; connector secrets are never stored in a layout."
      className="xl:col-span-2"
    >
      {!tenantId ? (
        <p className="text-sm text-muted-foreground">Select a workspace first.</p>
      ) : layoutsQuery.isLoading ? (
        <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Reading workspace readiness…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.55fr)]">
          <div className="min-w-0">
            <WorkspaceReadinessChecklist />
          </div>

          <div className="border-t border-rule/55 pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
            <div className="flex items-center gap-2">
              <LayoutDashboard size={17} className="text-reference" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Owner dashboard</h3>
            </div>
            {publishedLayout ? (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <Badge variant="success">Published</Badge>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">Version {publishedLayout.version}</span>
                </div>
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  This revision controls the registered panels shown to owners. Panels from disabled modules are removed automatically.
                </p>
              </div>
            ) : (
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Publish the recommended owner template. It will include only panels supported by this workspace.
              </p>
            )}
            <Button size="sm" variant="outline" className="mt-4" onClick={() => publish.mutate()} disabled={publish.isPending}>
              {publish.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              {publishedLayout ? 'Publish new revision' : 'Publish owner template'}
            </Button>
            {ownerLayouts.length > 1 && (
              <p className="mt-2 text-xs text-muted-foreground">
                {ownerLayouts.length - 1} earlier revision{ownerLayouts.length === 2 ? '' : 's'} retained.
              </p>
            )}
          </div>
        </div>
      )}
      {error && <p className="mt-4 text-sm text-exception">{error.message}</p>}
    </SettingsSection>
  );
}
