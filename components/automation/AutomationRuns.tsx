'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { WorkflowRunDrawer } from '@/components/communications/WorkflowRunDrawer';
import { Activity } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import { getAutomationRuns } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { fmtDateTime } from '@/lib/utils/format';

export function AutomationRuns({ tenantId, onOpenWorkflow }: { tenantId: string; onOpenWorkflow: (id: string) => void }) {
  const [status, setStatus] = useState('all');
  const [runId, setRunId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: moduleQueryKeys.automation.key('email-automation-runs', tenantId, status),
    queryFn: () => getAutomationRuns(tenantId, status),
    refetchInterval: 30_000,
  });
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">The latest 100 runs. Open a run to inspect each step and its outcome.</p>
        <Select
          ariaLabel="Filter runs by status"
          value={status}
          onValueChange={setStatus}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'running', label: 'Running' },
            { value: 'completed', label: 'Completed' },
            { value: 'failed', label: 'Failed' },
          ]}
        />
      </div>
      {query.isPending ? (
        <LoadingState label="Loading workflow runs" />
      ) : query.isError ? (
        <ErrorState description={query.error.message} onRetry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <EmptyState
          icon={Activity}
          title="No runs found"
          description="Runs appear when a published workflow starts. Try another status if a filter is selected."
        />
      ) : (
        <ul className="divide-y divide-rule/60 border-y border-rule/60">
          {query.data.map((run) => (
            <li key={run.id} className="flex flex-wrap items-center gap-3 py-3">
              <button
                type="button"
                onClick={() => setRunId(run.id)}
                className="min-w-0 flex-1 rounded-sm px-2 py-1 text-left hover:bg-band focus-visible:outline-2 focus-visible:outline-ring"
              >
                <span className="block text-sm font-semibold">{run.automationName}</span>
                <span className="block text-xs text-muted-foreground">
                  {fmtDateTime(run.createdAt)} · Version {run.version} · {run.stepCount} steps
                </span>
              </button>
              <span className={run.status === 'failed' ? 'text-sm text-exception' : 'text-sm text-muted-foreground'}>
                {run.status === 'running' ? 'Running' : run.status === 'completed' ? 'Completed' : 'Failed'}
              </span>
              <Button variant="ghost" size="sm" onClick={() => onOpenWorkflow(run.automationId)}>
                Open workflow
              </Button>
            </li>
          ))}
        </ul>
      )}
      {runId && <WorkflowRunDrawer runId={runId} onClose={() => setRunId(null)} />}
    </div>
  );
}
