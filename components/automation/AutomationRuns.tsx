'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { CommunicationsToolbar } from '@/components/communications/CommunicationsToolbar';
import { RUN_STATUS_BADGE, RUN_STATUS_ICON, WorkflowRunDrawer, triggerLabel } from '@/components/communications/WorkflowRunDrawer';
import { History, Search, XCircle, Zap } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { NeedsAttention } from '@/components/shared/NeedsAttention';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone, ListSkeleton } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { Badge } from '@/components/ui/badge';
import { Select, type SelectOption } from '@/components/ui/select';

import { dayHeading, localDayKey } from '@/lib/audit/groups';
import { timeOfDay } from '@/lib/audit/narrative';
import { getAutomationRuns } from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { RUN_STATUS_LABELS, type RunStatus, countRuns, deliveriesByDay, runStepsInWords, runTrigger } from '@/lib/utils/communications';
import { formatDateTime } from '@/lib/utils/date';

const RUN_TONE: Record<RunStatus, Tone> = { running: 'primary', completed: 'success', failed: 'exception' };

/**
 * The newest workflow runs, as Email history reads: failures counted at the
 * top with a way to them, the search with the Status select and the count,
 * then a titled list per day, newest first. A row opens the run's steps in a
 * drawer. Read-only — nothing here changes a workflow.
 *
 * Filtering happens here, over the 100 loaded — the query stays unfiltered.
 */
export function AutomationRuns({
  tenantId,
  onOpenWorkflow,
  onOpenWorkflows,
}: {
  tenantId: string;
  onOpenWorkflow: (id: string) => void;
  /** The empty state's way to the workflows. */
  onOpenWorkflows?: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [runId, setRunId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<RunStatus | 'all'>('all');
  const query = useQuery({
    queryKey: moduleQueryKeys.automation.key('email-automation-runs', tenantId, 'all'),
    queryFn: () => getAutomationRuns(tenantId, 'all'),
    refetchInterval: 30_000,
  });
  // Day headings are measured from the last fetch, so they move on with each 30-second refresh.
  const now = query.dataUpdatedAt;
  const runs = useMemo(() => query.data ?? [], [query.data]);
  const counts = useMemo(() => countRuns(runs), [runs]);

  const needle = search.trim().toLowerCase();
  const visible = runs.filter((run) => (status === 'all' || run.status === status) && run.automationName.toLowerCase().includes(needle));
  const days = deliveriesByDay(visible, localDayKey);
  const filtered = status !== 'all' || Boolean(needle);
  const clearFilters = () => {
    setSearch('');
    setStatus('all');
  };
  const statusOptions: SelectOption[] = [
    { value: 'all', label: 'Any status' },
    ...(['running', 'completed', 'failed'] as const).map((value) => ({ value, label: `${RUN_STATUS_LABELS[value]} · ${counts[value]}` })),
  ];

  const drawer = runId && <WorkflowRunDrawer runId={runId} onClose={() => setRunId(null)} onOpenWorkflow={onOpenWorkflow} />;

  if (query.isPending)
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        <div className="flex flex-wrap items-center gap-2" aria-hidden="true">
          <Bone className="h-9 min-w-56 flex-1" />
          <Bone className="h-9 w-40" />
        </div>
        <ListSkeleton rows={8} label="Loading workflow runs" />
      </div>
    );

  if (query.isError)
    return (
      <ErrorState
        className="flex-1"
        title="Couldn’t load the runs"
        description={query.error.message}
        onRetry={() => void query.refetch()}
      />
    );

  if (runs.length === 0)
    return (
      <EmptyState
        className="flex-1"
        icon={History}
        title="No runs yet"
        description="A run starts each time a published workflow’s trigger happens."
        action={onOpenWorkflows ? { label: 'Go to workflows', onClick: onOpenWorkflows, icon: Zap } : undefined}
      />
    );

  return (
    <motion.div
      className="flex flex-1 flex-col gap-5"
      initial={reduceMotion ? false : 'hidden'}
      animate="shown"
      variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
    >
      {/* A count and a way to them — the drawer shows the step that broke and why. */}
      {status !== 'failed' && (
        <NeedsAttention
          items={
            counts.failed > 0
              ? [
                  {
                    key: 'failed',
                    tone: 'exception',
                    icon: XCircle,
                    title: `${counts.failed} ${counts.failed === 1 ? 'run' : 'runs'} failed`,
                    detail: 'Open one to see the step that broke',
                    fix: { label: 'Show failed', run: () => setStatus('failed') },
                  },
                ]
              : []
          }
        />
      )}

      <motion.div variants={SECTION_RISE}>
        <CommunicationsToolbar
          search={search}
          onSearch={setSearch}
          placeholder="Workflow name…"
          label="Find runs by workflow name"
          count={filtered ? `${visible.length} of ${runs.length}` : `${runs.length} latest ${runs.length === 1 ? 'run' : 'runs'}`}
          filters={
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as RunStatus | 'all')}
              options={statusOptions}
              ariaLabel="Status"
              className="w-40"
            />
          }
        />
      </motion.div>

      {days.length === 0 ? (
        <motion.div variants={SECTION_RISE} className="flex flex-1 flex-col">
          <EmptyState
            className="flex-1"
            icon={Search}
            kind="search"
            title="No run matches"
            description="Try a different search or status."
            action={{ label: 'Clear filters', onClick: clearFilters }}
          />
        </motion.div>
      ) : (
        days.map((day) => (
          <RecordGroup key={day.day} id={`runs-day-${day.day}`} title={dayHeading(day.day, now)}>
            <ListRowGroup aria-label={dayHeading(day.day, now)}>
              {day.items.map((run) => (
                <ListRow
                  key={run.id}
                  icon={RUN_STATUS_ICON[run.status]}
                  tone={RUN_TONE[run.status]}
                  iconLabel={RUN_STATUS_LABELS[run.status]}
                  title={run.automationName}
                  titleExtra={
                    run.status !== 'completed' ? (
                      <Badge variant={RUN_STATUS_BADGE[run.status]} className="shrink-0">
                        {RUN_STATUS_LABELS[run.status]}
                      </Badge>
                    ) : undefined
                  }
                  meta={`${triggerLabel(runTrigger(run.eventKey))} · ${runStepsInWords(run.stepCount, run.failedStepCount)}`}
                  trailing={
                    <time
                      dateTime={run.createdAt}
                      title={formatDateTime(run.createdAt)}
                      className="w-12 text-right text-xs tabular-nums text-muted-foreground"
                    >
                      {timeOfDay(run.createdAt).slice(0, 5)}
                    </time>
                  }
                  targetLabel={`Open run of ${run.automationName}, ${RUN_STATUS_LABELS[run.status].toLowerCase()}`}
                  onClick={() => setRunId(run.id)}
                  selected={runId === run.id}
                />
              ))}
            </ListRowGroup>
          </RecordGroup>
        ))
      )}

      <p className="pb-2 text-center text-xs text-muted-foreground">The latest 100 runs · refreshed every 30 seconds</p>
      {drawer}
    </motion.div>
  );
}
