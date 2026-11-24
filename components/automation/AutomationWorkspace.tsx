'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';

import { AutomationEditorPage } from '@/components/communications/AutomationEditorPage';
import { AutomationsPanel } from '@/components/communications/AutomationsPanel';
import { useEmailAccess } from '@/components/communications/useEmailAccess';
import { Activity, Zap } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { LoadingState } from '@/components/shared/Skeleton';

import type { EmailAutomation } from '@/lib/modules/communications/client';
import { getEmailAutomations } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

import { AutomationRuns } from './AutomationRuns';
import { ScheduledAutomations } from './ScheduledAutomations';

/**
 * Automations live in Communications as a tab (`/communications?tab=automations`).
 * The old `/automation` route forwards there. The tab has two views — the
 * workflows and their runs (`&view=runs`) — and `&automation=<id|new>` opens
 * one workflow in the full-page editor.
 */
export type AutomationView = 'workflows' | 'runs';

export const automationView = (value: string | null): AutomationView => (value === 'runs' ? 'runs' : 'workflows');

/** The same query the list and the editor read, so the tab's header action knows whether the list is empty. */
export function useEmailAutomations(tenantId: string | null, enabled = true) {
  return useQuery({
    queryKey: moduleQueryKeys.automation.key('email-automations', tenantId),
    queryFn: () => getEmailAutomations(tenantId ?? undefined),
    enabled: !!tenantId && enabled,
  });
}

/** One workflow in the full-page editor, or the state that stands in for it. */
export function AutomationEditorView({
  tenantId,
  automationId,
  onClose,
  onSaved,
  onOpenTemplates,
}: {
  tenantId: string;
  automationId: string;
  onClose: () => void;
  onSaved: (saved: EmailAutomation) => void;
  onOpenTemplates: () => void;
}) {
  const router = useRouter();
  const access = useEmailAccess();
  const query = useEmailAutomations(tenantId);
  if (automationId !== 'new' && query.isPending)
    return (
      <EditorShell title="Automation" onClose={onClose}>
        <LoadingState label="Loading workflow" />
      </EditorShell>
    );
  if (automationId !== 'new' && query.isError)
    return (
      <EditorShell title="Automation" onClose={onClose}>
        <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />
      </EditorShell>
    );
  const automation = query.data?.find((item) => item.id === automationId);
  if (automationId !== 'new' && !automation)
    return (
      <EditorShell title="Workflow not found" onClose={onClose}>
        <EmptyState icon={Zap} title="Workflow not found" description="It may have been deleted or belong to another workspace." />
      </EditorShell>
    );
  return (
    <AutomationEditorPage
      key={automationId}
      automation={automation}
      onClose={onClose}
      onSaved={onSaved}
      onOpenTemplates={onOpenTemplates}
      onOpenConnection={access.canConfigure ? () => router.push('/settings/connectors?connector=email') : undefined}
    />
  );
}

/** The Automations tab's body: workflows (with scheduled jobs under them) or runs. */
export function AutomationsTab({
  tenantId,
  view,
  onViewChange,
  onOpenAutomation,
  onOpenTemplates,
}: {
  tenantId: string;
  view: AutomationView;
  onViewChange: (view: AutomationView) => void;
  /** An automation id, or `'new'`. */
  onOpenAutomation: (id: string) => void;
  onOpenTemplates: () => void;
}) {
  return (
    <div className="flex flex-1 flex-col gap-4">
      <SegmentedControl<AutomationView>
        value={view}
        onChange={onViewChange}
        ariaLabel="Automations view"
        options={[
          { value: 'workflows', label: 'Workflows', icon: Zap },
          { value: 'runs', label: 'Runs', icon: Activity },
        ]}
      />
      {/* A flex column, so an empty state can fill the page and centre. */}
      <div className="flex flex-1 flex-col">
        {view === 'workflows' && (
          <AutomationsPanel
            onEdit={({ automation }) => onOpenAutomation(automation?.id ?? 'new')}
            onOpenTemplates={onOpenTemplates}
            onOpenRuns={() => onViewChange('runs')}
            after={<ScheduledAutomations />}
          />
        )}
        {view === 'runs' && (
          <AutomationRuns tenantId={tenantId} onOpenWorkflow={onOpenAutomation} onOpenWorkflows={() => onViewChange('workflows')} />
        )}
      </div>
    </div>
  );
}
