'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';

import { AlertTriangle, ArrowRight, CheckCircle2, CircleDashed, ClipboardList, Loader2, RefreshCw } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { completeWorkspaceSetup, getWorkspaceSetup, startWorkspaceSetup } from '@/lib/api/workspace-composition.service';
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
  people: 'People & payroll',
  communications: 'Communications',
};

export function WorkspaceReadinessChecklist({ compact = false }: { compact?: boolean }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
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

  return (
    <section aria-labelledby={compact ? 'dashboard-readiness-title' : 'workspace-readiness-title'}>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {ready ? (
            <CheckCircle2 size={18} className="shrink-0 text-success" aria-hidden="true" />
          ) : (
            <ClipboardList size={18} className="shrink-0 text-primary" aria-hidden="true" />
          )}
          <div>
            <h3 id={compact ? 'dashboard-readiness-title' : 'workspace-readiness-title'} className="text-sm font-semibold text-foreground">
              {ready
                ? 'Ready for service'
                : `${session.readiness.blockingCount} required ${session.readiness.blockingCount === 1 ? 'blocker' : 'blockers'}`}
            </h3>
            <p className="text-xs text-muted-foreground">
              {session.readiness.completedCount} of {session.readiness.totalCount} enabled-module checks complete
            </p>
          </div>
        </div>
        <Button size="icon-sm" variant="ghost" aria-label="Refresh workspace readiness" disabled={pending} onClick={() => void refresh()}>
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

      <div className={cn('divide-y divide-rule/45 border-y border-rule/55', compact && 'max-h-[28rem] overflow-y-auto')}>
        {tasks.map((task) => {
          const done = task.status === 'completed';
          return (
            <div key={task.id} className="flex items-start gap-3 py-3">
              {done ? (
                <CheckCircle2 size={17} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
              ) : (
                <CircleDashed size={17} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <p className={cn('text-sm font-medium', done ? 'text-muted-foreground' : 'text-foreground')}>{task.title}</p>
                  <span className="text-xs text-muted-foreground">{MODULE_NAMES[task.moduleId] ?? task.moduleId}</span>
                  {!task.requiredBeforeGoLive && !done && <span className="text-xs font-medium text-reference">Next value</span>}
                </div>
                <p className="mt-0.5 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
                  {done ? task.description : (task.blockerReason ?? task.description)}
                </p>
              </div>
              {!done && (
                <Link
                  href={task.deepLink}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-semibold text-primary hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                >
                  Fix <ArrowRight size={13} aria-hidden="true" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="mt-3 text-xs text-exception">{error.message}</p>}
    </section>
  );
}
