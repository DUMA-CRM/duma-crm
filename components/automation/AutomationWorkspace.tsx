'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';

import { AutomationEditorPage } from '@/components/communications/AutomationEditorPage';
import { AutomationsPanel } from '@/components/communications/AutomationsPanel';
import { useEmailAccess } from '@/components/communications/useEmailAccess';
import { Activity, Plus, Zap } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SectionTabs } from '@/components/shared/SectionTabs';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { getEmailAutomations } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { AutomationRuns } from './AutomationRuns';
import { ScheduledAutomations } from './ScheduledAutomations';

export function AutomationWorkspace() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // A workspace switch discards the old workspace's editor state.
  return <Workspace key={tenantId ?? 'none'} tenantId={tenantId} />;
}
function Workspace({ tenantId }: { tenantId: string | null }) {
  const router = useRouter();
  const params = useSearchParams();
  const access = useEmailAccess();
  const automationId = params.get('automation');
  // The old Scheduled jobs tab (`?tab=scheduled`) is now a card on Workflows, so it lands there.
  const tab = params.get('tab') === 'runs' ? 'runs' : 'workflows';
  const query = useQuery({
    queryKey: moduleQueryKeys.automation.key('email-automations', tenantId),
    queryFn: () => getEmailAutomations(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const navigate = (patch: Record<string, string | null>, replace = false) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value === null) next.delete(key);
      else next.set(key, value);
    }
    router[replace ? 'replace' : 'push'](`/automation${next.size ? `?${next}` : ''}`);
  };
  const close = () => navigate({ automation: null });
  const templates = () => router.push('/communications?tab=templates');
  if (!tenantId)
    return (
      <EditorShell title="Automation" icon={<Zap size={20} />}>
        <EmptyState icon={Zap} title="No workspace selected" description="Choose a workspace to manage its workflows." />
      </EditorShell>
    );
  if (automationId) {
    if (automationId !== 'new' && query.isPending)
      return (
        <EditorShell title="Automation" onClose={close}>
          <LoadingState label="Loading workflow" />
        </EditorShell>
      );
    if (automationId !== 'new' && query.isError)
      return (
        <EditorShell title="Automation" onClose={close}>
          <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />
        </EditorShell>
      );
    const automation = query.data?.find((item) => item.id === automationId);
    if (automationId !== 'new' && !automation)
      return (
        <EditorShell title="Workflow not found" onClose={close}>
          <EmptyState icon={Zap} title="Workflow not found" description="It may have been deleted or belong to another workspace." />
        </EditorShell>
      );
    return (
      <AutomationEditorPage
        key={automationId}
        automation={automation}
        onClose={close}
        onSaved={(saved) => navigate({ automation: saved.id }, true)}
        onOpenTemplates={templates}
        onOpenConnection={access.canConfigure ? () => router.push('/settings/connectors?connector=email') : undefined}
      />
    );
  }
  // An empty list offers "New workflow" in its empty state, so it isn't there twice.
  const empty = query.isSuccess && query.data.length === 0;
  return (
    <EditorShell
      title="Automation"
      icon={<Zap size={20} aria-hidden="true" />}
      actions={
        access.canWrite && tab === 'workflows' && !empty ? (
          <Button className="h-9 gap-1.5" aria-label="New workflow" onClick={() => navigate({ automation: 'new' })}>
            <Plus size={15} aria-hidden="true" />
            <span className="hidden md:inline">New workflow</span>
          </Button>
        ) : undefined
      }
      subheader={
        <SectionTabs
          value={tab}
          onChange={(value) => navigate({ tab: value }, true)}
          ariaLabel="Automation sections"
          tabs={[
            { value: 'workflows', label: 'Workflows', icon: Zap },
            { value: 'runs', label: 'Runs', icon: Activity },
          ]}
        />
      }
    >
      {/* A flex column, so an empty state can fill the page and centre. */}
      <div className="flex flex-1 flex-col">
        {tab === 'workflows' && (
          <AutomationsPanel
            onEdit={({ automation }) => navigate({ automation: automation?.id ?? 'new' })}
            onOpenTemplates={templates}
            onOpenRuns={() => navigate({ tab: 'runs' }, true)}
            after={<ScheduledAutomations />}
          />
        )}
        {tab === 'runs' && (
          <AutomationRuns
            tenantId={tenantId}
            onOpenWorkflow={(id) => navigate({ automation: id })}
            onOpenWorkflows={() => navigate({ tab: null }, true)}
          />
        )}
      </div>
    </EditorShell>
  );
}
