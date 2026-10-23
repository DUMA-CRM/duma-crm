'use client';

import { useQuery } from '@tanstack/react-query';

import { ActionRow, ActionRows, InfoRow, InfoRows, RowTile } from '@/components/cms/rows';
import {
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock,
  Hash,
  type IconComponent,
  Play,
  ShoppingBag,
  Timer,
  TriangleAlert,
  UserRound,
  Zap,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Drawer } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

import { getEmailAutomationRun } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  RUN_STATUS_LABELS,
  type RunStatus,
  type StepState,
  durationInWords,
  runTrigger,
  stepState,
  stepStatusLabel,
} from '@/lib/utils/communications';
import { formatInstant } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { TRIGGER_LABELS } from './shared';

// A run's status reads the same on the Runs list, its summary and here.
export const RUN_STATUS_ICON: Record<RunStatus, IconComponent> = { running: Clock, completed: CheckCircle2, failed: TriangleAlert };
export const RUN_STATUS_TONE = { running: 'default', completed: 'success', failed: 'danger' } as const;
export const RUN_STATUS_BADGE = { running: 'muted', completed: 'success', failed: 'destructive' } as const;
export const triggerLabel = (trigger: string) => (TRIGGER_LABELS as Record<string, string>)[trigger] ?? trigger.replaceAll('_', ' ');

const STEP_ICON: Record<StepState, IconComponent> = {
  done: CheckCircle2,
  pending: Clock,
  retrying: TriangleAlert,
  failed: TriangleAlert,
  other: Clock,
};
const STEP_TONE = { done: 'success', pending: 'default', retrying: 'warning', failed: 'danger', other: 'default' } as const;
const STEP_BADGE = { done: 'success', pending: 'muted', retrying: 'warning', failed: 'destructive', other: 'muted' } as const;

const formatDate = (value?: string | null) =>
  formatInstant(value, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * One workflow run: what started it and how long it took, then each step with
 * its outcome, error and output. Polls while the run is still going.
 */
export function WorkflowRunDrawer({
  runId,
  onClose,
  onOpenWorkflow,
}: {
  runId: string;
  onClose: () => void;
  onOpenWorkflow?: (id: string) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const query = useQuery({
    queryKey: moduleQueryKeys.automation.key('email-automation-run', runId, tenantId),
    queryFn: () => getEmailAutomationRun(runId, tenantId ?? undefined),
    enabled: !!tenantId,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 5_000 : false),
  });
  const run = query.data;
  const took = run ? durationInWords(run.startedAt, run.completedAt) : null;
  const record = run?.customerId ?? run?.orderId ?? run?.staffUserId ?? null;

  return (
    <Drawer
      icon={ClipboardList}
      title="Workflow run"
      description={run ? `${triggerLabel(runTrigger(run.eventKey))} · version ${run.version}` : 'Execution details'}
      onClose={onClose}
    >
      {query.isLoading ? (
        <Bone className="h-96 w-full rounded-lg" />
      ) : query.isError || !run ? (
        <ErrorState title="Couldn’t load this run" onRetry={() => void query.refetch()} />
      ) : (
        <div className="space-y-5">
          <SettingsSection title="This run" actions={<Badge variant={RUN_STATUS_BADGE[run.status]}>{RUN_STATUS_LABELS[run.status]}</Badge>}>
            <InfoRows>
              <InfoRow icon={Zap} title="Started by">
                <span className="truncate text-sm font-semibold text-foreground">{triggerLabel(runTrigger(run.eventKey))}</span>
              </InfoRow>
              <InfoRow icon={Hash} title="Workflow version">
                <span className="text-sm font-semibold text-foreground">Version {run.version}</span>
              </InfoRow>
              <InfoRow icon={Play} title="Started">
                <span className="text-sm font-semibold tabular-nums text-foreground">{formatDate(run.startedAt)}</span>
              </InfoRow>
              <InfoRow icon={CalendarCheck} title="Finished">
                {run.completedAt ? (
                  <span className="text-sm font-semibold tabular-nums text-foreground">{formatDate(run.completedAt)}</span>
                ) : (
                  <span className="text-sm text-muted-foreground/70">{run.status === 'running' ? 'Still running' : 'Not finished'}</span>
                )}
              </InfoRow>
              {took && (
                <InfoRow icon={Timer} title="Took">
                  <span className="text-sm font-semibold text-foreground">{took}</span>
                </InfoRow>
              )}
              <InfoRow
                icon={run.orderId && !run.customerId ? ShoppingBag : UserRound}
                title={run.audience === 'staff' ? 'Employee record' : 'Recipient record'}
              >
                {record ? (
                  <span title={record} className="max-w-[11rem] truncate font-mono text-xs text-foreground">
                    {record}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/70">None</span>
                )}
              </InfoRow>
            </InfoRows>
            {onOpenWorkflow && (
              <div className="mt-4">
                <ActionRows>
                  <ActionRow icon={Zap} label="Open workflow" onClick={() => onOpenWorkflow(run.automationId)} />
                </ActionRows>
              </div>
            )}
          </SettingsSection>

          <SettingsSection title="Steps">
            {!run.steps.length ? (
              <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">No steps have started yet.</p>
            ) : (
              <ol className="space-y-3">
                {run.steps.map((step, index) => {
                  const node = run.definition.nodes.find((candidate) => candidate.id === step.nodeId);
                  const state = stepState(step.status);
                  const kind = step.nodeType.replaceAll('_', ' ');
                  return (
                    <li key={step.id}>
                      <div className="flex items-center gap-3">
                        <RowTile icon={STEP_ICON[state]} tone={STEP_TONE[state]} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {index + 1}. {node?.name ?? kind}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            <span className="capitalize">{kind}</span> · scheduled {formatDate(step.scheduledAt)}
                            {step.attemptCount > 1 && ` · attempt ${step.attemptCount}`}
                          </p>
                        </div>
                        <Badge variant={STEP_BADGE[state]}>{stepStatusLabel(step.status)}</Badge>
                      </div>
                      {step.lastError && (
                        <p className="mt-2 ml-11 rounded-md bg-exception/6 px-3 py-2 text-xs font-medium break-words text-exception">
                          {step.lastError}
                        </p>
                      )}
                      {step.output && Object.keys(step.output).length > 0 && (
                        <details className="mt-2 ml-11 rounded-md bg-band/60">
                          <summary className="cursor-pointer rounded-md px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring">
                            What it did
                          </summary>
                          <pre className="max-h-64 overflow-auto border-t border-rule/40 p-3 text-label text-muted-foreground">
                            {JSON.stringify(step.output, null, 2)}
                          </pre>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}
          </SettingsSection>
        </div>
      )}
    </Drawer>
  );
}
