'use client';

import { useQuery } from '@tanstack/react-query';

import { CheckCircle2, Clock, Loader2, TriangleAlert } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Badge } from '@/components/ui/badge';

import { getEmailAutomationRun } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString('en-GB') : '—');

export function WorkflowRunDrawer({ runId, onClose }: { runId: string; onClose: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const {
    data: run,
    isLoading,
    error,
  } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-automation-run', runId, tenantId),
    queryFn: () => getEmailAutomationRun(runId, tenantId ?? undefined),
    enabled: !!tenantId,
    refetchInterval: (query) => (query.state.data?.status === 'running' ? 5_000 : false),
  });

  return (
    <Drawer title="Workflow run" description={run ? `${run.eventKey} · version ${run.version}` : 'Execution details'} onClose={onClose}>
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" /> Loading run…
        </div>
      ) : error || !run ? (
        <div className="rounded-sm border border-destructive/30 bg-destructive/6 p-4 text-sm text-destructive">
          This workflow run could not be loaded.
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 rounded-sm border border-rule bg-band p-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Status</p>
              <Badge
                className="mt-1 capitalize"
                variant={run.status === 'completed' ? 'success' : run.status === 'failed' ? 'destructive' : 'primary'}
              >
                {run.status}
              </Badge>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Started</p>
              <p className="mt-1 font-medium">{formatDate(run.startedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="mt-1 font-medium">{formatDate(run.completedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Recipient record</p>
              <p className="mt-1 truncate font-mono text-xs">{run.customerId ?? run.orderId ?? 'No record'}</p>
            </div>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Step timeline</p>
            <div className="mt-3 space-y-3">
              {run.steps.map((step, index) => {
                const node = run.definition.nodes.find((candidate) => candidate.id === step.nodeId);
                const failed = step.status === 'failed' || step.status === 'failed_permanently';
                const pending = step.status === 'queued' || step.status === 'running';
                const Icon = failed ? TriangleAlert : pending ? Clock : CheckCircle2;
                return (
                  <div key={step.id} className="relative flex gap-3 rounded-sm border border-rule p-4">
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full ${
                        failed ? 'bg-destructive/6 text-destructive' : pending ? 'bg-band text-primary' : 'bg-success/6 text-success'
                      }`}
                    >
                      <Icon size={15} className={step.status === 'running' ? 'animate-pulse' : undefined} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold">
                          {index + 1}. {node?.name ?? step.nodeType.replaceAll('_', ' ')}
                        </p>
                        <Badge variant={failed ? 'destructive' : pending ? 'primary' : 'success'} className="capitalize">
                          {step.status.replaceAll('_', ' ')}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs capitalize text-muted-foreground">
                        {step.nodeType.replaceAll('_', ' ')} · scheduled {formatDate(step.scheduledAt)} · attempt {step.attemptCount}
                      </p>
                      {step.lastError && <p className="mt-2 rounded-sm bg-destructive/6 p-2 text-xs text-destructive">{step.lastError}</p>}
                      {step.output && Object.keys(step.output).length > 0 && (
                        <pre className="mt-2 overflow-auto rounded-sm bg-muted p-2 text-label text-muted-foreground">
                          {JSON.stringify(step.output, null, 2)}
                        </pre>
                      )}
                    </div>
                  </div>
                );
              })}
              {!run.steps.length && <p className="rounded-sm bg-muted p-4 text-sm text-muted-foreground">No steps have started yet.</p>}
            </div>
          </div>
        </div>
      )}
    </Drawer>
  );
}
