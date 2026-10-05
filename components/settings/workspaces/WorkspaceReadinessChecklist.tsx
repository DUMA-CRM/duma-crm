'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';

import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, ClipboardList, Loader2, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { completeWorkspaceSetup, getWorkspaceSetup, startWorkspaceSetup } from '@/lib/modules/organization/client';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const MODULE_NAMES: Record<string, string> = {
  organization: 'Organisation',
  identity: 'Access',
  catalog: 'Products',
  payments: 'Payments',
  inventory: 'Inventory',
  purchasing: 'Purchasing',
  workforce: 'Workforce',
  people: 'People',
  payroll: 'Payroll',
  communications: 'Communications',
};

export function WorkspaceReadinessChecklist({ compact = false }: { compact?: boolean }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const queryKey = ['workspace-setup', tenantId];
  const setup = useQuery({ queryKey, queryFn: () => getWorkspaceSetup(tenantId!), enabled: Boolean(tenantId) });
  const refresh = () => queryClient.invalidateQueries({ queryKey });
  const start = useMutation({ mutationFn: () => startWorkspaceSetup(tenantId!), onSuccess: refresh });
  const finish = useMutation({ mutationFn: () => completeWorkspaceSetup(tenantId!), onSuccess: refresh });
  const pending = start.isPending || finish.isPending;
  const error = setup.error ?? start.error ?? finish.error;

  if (!tenantId) return <p className="text-sm text-muted-foreground">Select a workspace to read its readiness.</p>;
  if (setup.isLoading) {
    return (
      <div className="flex min-h-24 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Checking this workspace…
      </div>
    );
  }
  if (setup.isError) {
    return (
      <div className="flex items-start gap-3 border-y border-exception/35 py-3" role="alert">
        <AlertTriangle size={17} className="mt-0.5 shrink-0 text-exception" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Readiness could not be checked</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Check the connection, then try again.</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => void setup.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  const session = setup.data;
  if (!session) {
    return (
      <div className="border-y border-rule/55 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <ClipboardList size={19} className="shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">Check what this workspace needs</p>
            <p className="mt-0.5 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
              DUMA will read the enabled modules and point to the real missing setup. Nothing is marked complete by hand.
            </p>
          </div>
          <Button size="sm" disabled={start.isPending} onClick={() => start.mutate()}>
            {start.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Check readiness
          </Button>
        </div>
        {error && <p className="mt-3 text-xs text-exception">{error.message}</p>}
      </div>
    );
  }

  const tasks = [...session.tasks].sort((left, right) => {
    const leftDone = left.status === 'completed' ? 1 : 0;
    const rightDone = right.status === 'completed' ? 1 : 0;
    return (
      leftDone - rightDone ||
      Number(right.requiredBeforeGoLive) - Number(left.requiredBeforeGoLive) ||
      left.title.localeCompare(right.title)
    );
  });
  const ready = session.readiness.ready;
  const complete = session.status === 'completed';

  const { completedCount, totalCount, blockingCount } = session.readiness;
  const share = totalCount === 0 ? 1 : completedCount / totalCount;
  const titleId = compact ? 'dashboard-readiness-title' : 'workspace-readiness-title';

  return (
    <section aria-labelledby={titleId}>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <h3 id={titleId} className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {ready ? (
              <CheckCircle2 size={17} className="shrink-0 text-success" aria-hidden="true" />
            ) : (
              <ClipboardList size={17} className="shrink-0 text-primary" aria-hidden="true" />
            )}
            {ready ? 'Ready for service' : `${blockingCount} ${blockingCount === 1 ? 'thing' : 'things'} left before service`}
          </h3>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="h-1.5 flex-1 overflow-hidden rounded-full bg-band"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={totalCount}
              aria-valuenow={completedCount}
              aria-label="Setup checks complete"
            >
              <motion.div
                className={cn('h-full rounded-full', ready ? 'bg-success' : 'bg-primary')}
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${share * 100}%` }}
                transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {completedCount} of {totalCount}
            </span>
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Check again" disabled={pending} onClick={() => void refresh()}>
          <RefreshCw aria-hidden="true" />
        </Button>
        {ready && !complete && (
          <Button size="sm" disabled={pending} onClick={() => finish.mutate()}>
            {finish.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Confirm ready
          </Button>
        )}
        {!ready && complete && (
          <Button size="sm" variant="outline" disabled={pending} onClick={() => start.mutate()}>
            {start.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Review changes
          </Button>
        )}
      </div>

      <ul className={cn('space-y-2', compact && 'max-h-[28rem] overflow-y-auto')}>
        {tasks.map((task, index) => {
          const done = task.status === 'completed';
          return (
            <motion.li
              key={task.id}
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : index * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3.5 py-3',
                done ? 'border-rule/40 bg-transparent' : 'border-rule/60 bg-background/60',
              )}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-md',
                  done ? 'bg-success-highlight text-success' : 'bg-band text-muted-foreground',
                )}
              >
                {done ? <CheckCircle2 size={17} aria-hidden="true" /> : <CircleDashed size={17} aria-hidden="true" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className={cn('text-sm font-semibold', done ? 'text-muted-foreground' : 'text-foreground')}>{task.title}</span>
                  <span className="text-label uppercase text-muted-foreground">{MODULE_NAMES[task.moduleId] ?? task.moduleId}</span>
                  {!task.requiredBeforeGoLive && !done && <span className="annot text-reference">Optional</span>}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {done ? task.description : (task.blockerReason ?? task.description)}
                </p>
              </div>
              {!done && (
                <Button asChild size="sm" variant="outline" className="shrink-0">
                  <Link href={task.deepLink}>
                    Fix <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
              )}
            </motion.li>
          );
        })}
      </ul>
      {error && <p className="mt-3 text-xs text-exception">{error.message}</p>}
    </section>
  );
}
