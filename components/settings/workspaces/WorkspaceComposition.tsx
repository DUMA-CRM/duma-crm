'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { CheckCircle2, CircleDashed, ClipboardList, LayoutDashboard, Loader2 } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  completeWorkspaceSetup,
  getDashboardLayouts,
  getWorkspaceSetup,
  publishDashboardLayout,
  startWorkspaceSetup,
  updateSetupRequirement,
  updateSetupTask,
} from '@/lib/api/workspace-composition.service';
import { useWorkspaceStore } from '@/stores/workspaceStore';

export function WorkspaceComposition() {
  const qc = useQueryClient();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const setupQuery = useQuery({
    queryKey: ['workspace-setup', tenantId],
    queryFn: () => getWorkspaceSetup(tenantId!),
    enabled: !!tenantId,
  });
  const layoutsQuery = useQuery({
    queryKey: ['dashboard-layouts', tenantId],
    queryFn: () => getDashboardLayouts(tenantId!),
    enabled: !!tenantId,
  });

  const refreshSetup = () => qc.invalidateQueries({ queryKey: ['workspace-setup', tenantId] });
  const start = useMutation({ mutationFn: () => startWorkspaceSetup(tenantId!), onSuccess: refreshSetup });
  const toggle = useMutation({
    mutationFn: async ({ requirementId, taskId, complete }: { requirementId: string; taskId?: string; complete: boolean }) => {
      await updateSetupRequirement(tenantId!, requirementId, complete);
      if (taskId) await updateSetupTask(tenantId!, taskId, complete ? 'completed' : 'pending');
    },
    onSuccess: refreshSetup,
  });
  const finish = useMutation({ mutationFn: () => completeWorkspaceSetup(tenantId!), onSuccess: refreshSetup });
  const publish = useMutation({
    mutationFn: () => publishDashboardLayout(tenantId!, 'owner', 'Owner dashboard'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['dashboard-layouts', tenantId] }),
  });

  const setup = setupQuery.data;
  const ownerLayouts = (layoutsQuery.data ?? []).filter((layout) => layout.audienceKey === 'owner');
  const publishedLayout = ownerLayouts.find((layout) => layout.status === 'published');
  const completed = setup?.requirements.filter((item) => item.isSatisfied).length ?? 0;
  const total = setup?.requirements.length ?? 0;
  const ready = !!setup && total > 0 && completed === total;
  const error = start.error ?? toggle.error ?? finish.error ?? publish.error ?? setupQuery.error ?? layoutsQuery.error;

  return (
    <SettingsSection
      title="Workspace readiness"
      description="Prepare a workspace for real operations, then publish the owner dashboard composition. Progress is retained across sessions."
      footnote="Publishing creates a new revision. Earlier dashboard versions remain available for audit and rollback; connector secrets are never stored in a layout."
      className="xl:col-span-2"
    >
      {!tenantId ? (
        <p className="text-sm text-muted-foreground">Select a workspace first.</p>
      ) : setupQuery.isLoading || layoutsQuery.isLoading ? (
        <div className="flex items-center gap-2 py-5 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Reading workspace readiness…
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,0.55fr)]">
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ClipboardList size={17} className="text-primary" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-foreground">Opening checklist</h3>
              </div>
              {setup && (
                <span className="font-mono text-xs font-semibold tabular-nums text-muted-foreground">
                  {completed}/{total}
                </span>
              )}
            </div>

            {!setup ? (
              <div className="rounded-md bg-band/55 px-4 py-4">
                <p className="text-sm font-medium text-foreground">No setup run has started.</p>
                <p className="mt-1 max-w-[58ch] text-xs leading-relaxed text-muted-foreground">
                  Start with the three decisions that make the workspace usable: identity, first location, and operating access.
                </p>
                <Button size="sm" className="mt-4" onClick={() => start.mutate()} disabled={start.isPending}>
                  {start.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                  Start setup
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-rule/45 border-y border-rule/55">
                {setup.requirements.map((requirement) => {
                  const task = setup.tasks.find((item) => item.taskKey === requirement.requirementKey);
                  return (
                    <div key={requirement.id} className="flex items-center gap-3 py-3">
                      {requirement.isSatisfied ? (
                        <CheckCircle2 size={17} className="shrink-0 text-success" aria-hidden="true" />
                      ) : (
                        <CircleDashed size={17} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{requirement.label}</p>
                        {task && <p className="mt-0.5 text-xs text-muted-foreground">{task.title}</p>}
                      </div>
                      {setup.status === 'in_progress' && (
                        <Button
                          size="sm"
                          variant={requirement.isSatisfied ? 'ghost' : 'outline'}
                          disabled={toggle.isPending}
                          onClick={() =>
                            toggle.mutate({ requirementId: requirement.id, taskId: task?.id, complete: !requirement.isSatisfied })
                          }
                        >
                          {requirement.isSatisfied ? 'Reopen' : 'Mark done'}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {setup?.status === 'in_progress' && (
              <div className="mt-4 flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">
                  {ready ? 'Required setup is complete.' : 'Complete every required item before finishing.'}
                </p>
                <Button size="sm" disabled={!ready || finish.isPending} onClick={() => finish.mutate()}>
                  {finish.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                  Finish setup
                </Button>
              </div>
            )}
            {setup?.status === 'completed' && <p className="mt-4 text-sm font-medium text-success">Workspace setup is complete.</p>}
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
