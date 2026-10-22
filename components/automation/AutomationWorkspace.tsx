'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';

import { AutomationEditorPage } from '@/components/communications/AutomationEditorPage';
import { AutomationsPanel } from '@/components/communications/AutomationsPanel';
import { useEmailAccess } from '@/components/communications/useEmailAccess';
import { Activity, CalendarDays, Plus, Zap } from '@/components/icons';
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
  const tab = params.get('tab') === 'runs' ? 'runs' : params.get('tab') === 'scheduled' ? 'scheduled' : 'workflows';
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
  return (
    <EditorShell
      title="Automation"
      icon={<Zap size={20} aria-hidden="true" />}
      actions={
        access.canWrite && tab === 'workflows' ? (
          <Button size="sm" onClick={() => navigate({ automation: 'new' })}>
            <Plus size={15} />
            New workflow
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
            { value: 'scheduled', label: 'Scheduled jobs', icon: CalendarDays },
          ]}
        />
      }
    >
      {tab === 'workflows' && (
        <AutomationsPanel onEdit={({ automation }) => navigate({ automation: automation?.id ?? 'new' })} onOpenTemplates={templates} />
      )}
      {tab === 'runs' && <AutomationRuns tenantId={tenantId} onOpenWorkflow={(id) => navigate({ automation: id })} />}
      {tab === 'scheduled' && <ScheduledAutomations />}
    </EditorShell>
  );
}
