'use client';

import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { InfoRow, InfoRows, RowTile } from '@/components/cms/rows';
import {
  RUN_STATUS_BADGE,
  RUN_STATUS_ICON,
  RUN_STATUS_TONE,
  WorkflowRunDrawer,
  triggerLabel,
} from '@/components/communications/WorkflowRunDrawer';
import { AlertTriangle, ChevronRight, History } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

import { getAutomationRuns } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { RUN_STATUS_LABELS, countRuns, runStepsInWords, runTrigger, timeAgo } from '@/lib/utils/communications';
import { fmtDateTime } from '@/lib/utils/format';

/**
 * The newest workflow runs, laid out like the settings tabs: the runs in the
 * main column, each a row that opens the run's steps in a drawer; how the
 * latest 100 went alongside. Read-only — nothing here changes a workflow.
 */
export function AutomationRuns({ tenantId, onOpenWorkflow }: { tenantId: string; onOpenWorkflow: (id: string) => void }) {
  const reduceMotion = useReducedMotion();
  const [runId, setRunId] = useState<string | null>(null);
  const query = useQuery({
    queryKey: moduleQueryKeys.automation.key('email-automation-runs', tenantId, 'all'),
    queryFn: () => getAutomationRuns(tenantId, 'all'),
    refetchInterval: 30_000,
  });
  // "3m ago" is measured from the last fetch, so it moves on with each 30-second refresh.
  const now = query.dataUpdatedAt;

  return (
    <motion.div
      className="w-full"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: 0.06 } } }}
    >
      <SettingsTabBody narrowAside aside={<RunSummary query={query} now={now} />}>
        <div className="space-y-3">
          <h2 className="text-base font-semibold tracking-title text-foreground">Recent runs</h2>
          <SettingsSection>
            {query.isPending ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }, (_, index) => (
                  <Bone key={index} className="h-11 w-full rounded-md" />
                ))}
              </div>
            ) : query.isError ? (
              <ErrorState title="Couldn’t load the runs" description={query.error.message} onRetry={() => void query.refetch()} />
            ) : !query.data.length ? (
              <p className="text-sm text-muted-foreground">
                No runs yet. A run starts each time a published workflow’s trigger happens — publish one on the Workflows tab.
              </p>
            ) : (
              <div className="-mx-2 flex flex-col gap-0.5">
                {query.data.map((run) => (
                  <button
                    key={run.id}
                    type="button"
                    onClick={() => setRunId(run.id)}
                    className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <RowTile icon={RUN_STATUS_ICON[run.status]} tone={RUN_STATUS_TONE[run.status]} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{run.automationName}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {triggerLabel(runTrigger(run.eventKey))} ·{' '}
                        <time dateTime={run.createdAt} title={fmtDateTime(run.createdAt)}>
                          {timeAgo(run.createdAt, now)}
                        </time>{' '}
                        · {runStepsInWords(run.stepCount, run.failedStepCount)}
                      </span>
                    </span>
                    <Badge variant={RUN_STATUS_BADGE[run.status]}>{RUN_STATUS_LABELS[run.status]}</Badge>
                    <ChevronRight
                      size={14}
                      className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </button>
                ))}
              </div>
            )}
          </SettingsSection>
        </div>
      </SettingsTabBody>
      {runId && <WorkflowRunDrawer runId={runId} onClose={() => setRunId(null)} onOpenWorkflow={onOpenWorkflow} />}
    </motion.div>
  );
}

/** How the newest 100 runs went: a count per state, when the last one started, and a nudge when any failed. */
function RunSummary({ query, now }: { query: UseQueryResult<Awaited<ReturnType<typeof getAutomationRuns>>>; now: number }) {
  const counts = query.data ? countRuns(query.data) : null;
  return (
    <SettingsSection
      title="Latest 100 runs"
      actions={
        counts && query.data!.length > 0 ? (
          <Badge variant={counts.failed ? 'warning' : 'success'}>{counts.failed ? 'Needs a look' : 'All clear'}</Badge>
        ) : undefined
      }
    >
      {query.isPending ? (
        <Bone className="h-40 w-full rounded-md" />
      ) : query.isError ? (
        <ErrorState title="Couldn’t count the runs" description={query.error.message} onRetry={() => void query.refetch()} />
      ) : !query.data.length ? (
        <p className="text-sm text-muted-foreground">Counts appear here once a published workflow has run.</p>
      ) : (
        <>
          <InfoRows>
            {(['running', 'completed', 'failed'] as const).map((key) => (
              <InfoRow
                key={key}
                icon={RUN_STATUS_ICON[key]}
                title={RUN_STATUS_LABELS[key]}
                tone={key === 'failed' && counts!.failed ? 'danger' : undefined}
              >
                <span className="text-sm font-semibold tabular-nums text-foreground">{counts![key]}</span>
              </InfoRow>
            ))}
            <InfoRow icon={History} title="Last run">
              <time
                dateTime={query.data[0].createdAt}
                title={fmtDateTime(query.data[0].createdAt)}
                className="text-sm font-semibold text-foreground"
              >
                {timeAgo(query.data[0].createdAt, now)}
              </time>
            </InfoRow>
          </InfoRows>
          {counts!.failed > 0 && (
            <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
              <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
              <span>
                {counts!.failed === 1 ? 'A run failed.' : `${counts!.failed} runs failed.`} Open one to see the step that broke and why,
                then fix it in its workflow.
              </span>
            </p>
          )}
          <p className="mt-4 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">Refreshed every 30 seconds.</p>
        </>
      )}
    </SettingsSection>
  );
}
