'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, ChevronRight, History, Send } from '@/components/icons';
import { useState } from 'react';

import { DeductionsDrawer } from '@/components/payroll/DeductionsDrawer';
import { PayrollScheduleCard } from '@/components/payroll/PayrollScheduleCard';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { Input } from '@/components/ui/input';

import {
  type PayrollRun,
  type PayrollRunLine,
  getPayrollRuns,
  issuePayrollRun,
  lineIsComplete,
  supersedePayrollRun,
} from '@/lib/api/payroll.service';
import {
  type PeriodGroup,
  combineBlockedReason,
  groupByPeriod,
  hasDuplicates,
  isSuperseded,
  suggestSurvivor,
} from '@/lib/utils/payroll-duplicates';
import { hasCapability } from '@/lib/auth/capabilities';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

import { formatDate, formatRange, hours, money } from './shared';

const runGross = (run: PayrollRun) => run.lines.reduce((sum, l) => sum + Number(l.grossPay), 0);
type PayrollLine = PayrollRun['lines'][number];

const buildColumns = (onEdit: ((line: PayrollLine) => void) | null): DataTableColumn<PayrollLine>[] => [
  {
    id: 'employee',
    header: 'Employee',
    minWidth: 180,
    cell: ({ row }) => row.employeeName ?? 'Unknown',
  },
  {
    id: 'hours',
    header: 'Paid hours',
    align: 'right',
    width: 'fit',
    cellClassName: 'tabular-nums text-muted-foreground',
    cell: ({ row }) => hours(row.paidHours),
  },
  {
    id: 'gross',
    header: 'Gross',
    align: 'right',
    width: 'fit',
    cellClassName: 'tabular-nums font-semibold',
    cell: ({ row }) => money(row.grossPay),
  },
  {
    id: 'deductions',
    header: 'Tax · NI',
    align: 'right',
    width: 'fit',
    cellClassName: 'tabular-nums text-muted-foreground',
    // A blank is not a zero. Until someone enters the figures there is nothing
    // to report, and rendering £0.00 would be a claim nobody has made.
    cell: ({ row }) =>
      lineIsComplete(row) ? (
        `${money(row.taxDeducted)} · ${money(row.nationalInsurance)}`
      ) : (
        <span className="text-measured">Not entered</span>
      ),
  },
  {
    id: 'net',
    header: 'Net',
    align: 'right',
    width: 'fit',
    cellClassName: 'tabular-nums font-semibold',
    cell: ({ row }) => (row.netPay === null ? <span className="text-muted-foreground">—</span> : money(row.netPay)),
  },
  ...(onEdit
    ? [
        {
          id: 'edit',
          header: '',
          align: 'right' as const,
          width: 'fit' as const,
          cell: ({ row }: { row: PayrollLine }) => (
            <Button variant="outline" size="sm" onClick={() => onEdit(row)}>
              {lineIsComplete(row) ? 'Edit' : 'Enter'}
            </Button>
          ),
        },
      ]
    : []),
];

function RunCard({ run, canWrite }: { run: PayrollRun; canWrite: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PayrollRunLine | null>(null);
  const [issuing, setIssuing] = useState(false);
  const [source, setSource] = useState('');
  const gross = runGross(run);

  const issued = run.status === 'issued';
  const setAside = isSuperseded(run);
  const incomplete = run.lines.filter((line) => !lineIsComplete(line));
  // A run set aside is a record of what happened, not a thing to keep editing.
  const editable = canWrite && !issued && !setAside;
  const readyToIssue = editable && run.lines.length > 0 && incomplete.length === 0;

  const issue = useMutation({
    mutationFn: () => issuePayrollRun(run.id, source.trim()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      // The employee's own view reads a different key.
      qc.invalidateQueries({ queryKey: ['payslips-me'] });
      qc.invalidateQueries({ queryKey: ['employee-payslips'] });
      setIssuing(false);
      toast('success', 'Payslips issued. Employees can now see them in My HR.');
    },
    onError: (error) => toast('error', (error as Error).message || 'The run wasn’t issued. Try again.'),
  });

  return (
    <div className={cn('overflow-hidden rounded-sm border border-rule bg-card', setAside && 'opacity-60')}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-band md:px-5"
      >
        <ChevronRight size={16} className={cn('shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{formatRange(run.periodStart, run.periodEnd)}</span>
            <Badge variant={issued ? 'success' : setAside ? 'muted' : run.status === 'finalised' ? 'warning' : 'muted'} className="capitalize">
              {setAside ? 'Set aside' : run.status}
            </Badge>
            {editable && incomplete.length > 0 && (
              <Badge variant="destructive">
                {incomplete.length} awaiting {incomplete.length === 1 ? 'deductions' : 'deductions'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="capitalize">{run.period}</span> · finalised {formatDate(run.finalisedAt)}
            {issued && run.issuedAt ? ` · issued ${formatDate(run.issuedAt)}` : ''}
            {issued && run.deductionsSource ? ` · from ${run.deductionsSource}` : ''}
            {setAside && run.supersededAt ? ` · set aside ${formatDate(run.supersededAt)}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-bold tabular-nums text-primary">{money(gross)}</p>
          <p className="text-xs text-muted-foreground">
            {run.lines.length} {run.lines.length === 1 ? 'employee' : 'employees'}
          </p>
        </div>
      </button>

      {open && (
        <>
          <DataTable
            aria-label={`Payroll details for ${formatRange(run.periodStart, run.periodEnd)}`}
            data={run.lines}
            columns={buildColumns(editable ? setEditing : null)}
            getRowKey={(line) => line.id}
            density="compact"
            borders={{ outer: false }}
            className="rounded-none border-t border-rule"
          />

          {editable && (
            <div className="flex flex-wrap items-center gap-3 border-t border-rule bg-band/40 px-4 py-3 md:px-5">
              {incomplete.length > 0 ? (
                <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
                  <AlertTriangle size={14} className="shrink-0 text-measured" aria-hidden="true" />
                  Enter tax, National Insurance and net pay for every employee before issuing.
                </p>
              ) : (
                <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 size={14} className="shrink-0 text-momentum" aria-hidden="true" />
                  Every line is complete. Issuing publishes these payslips to employees and cannot be undone.
                </p>
              )}
              <Button size="sm" disabled={!readyToIssue} onClick={() => setIssuing(true)} className="gap-1.5">
                <Send size={14} />
                Issue payslips
              </Button>
            </div>
          )}
        </>
      )}

      {editing && <DeductionsDrawer run={run} line={editing} onClose={() => setEditing(null)} />}

      {issuing && (
        <ConfirmModal
          title="Issue these payslips?"
          message={
            <div className="space-y-3">
              <p>
                Every employee on this run will be able to see their payslip in My HR. The figures are frozen — issuing cannot be undone,
                and the deductions can no longer be edited.
              </p>
              <label className="block text-left">
                <span className="mb-1 block text-micro font-semibold tracking-micro text-muted-foreground uppercase">
                  Where did these figures come from?
                </span>
                <Input
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="e.g. BrightPay, March 2026"
                  autoFocus
                />
                <span className="mt-1 block text-xs text-muted-foreground">
                  Recorded on the run, because DUMA did not calculate them and a statement whose source is unrecorded cannot be reconciled
                  later.
                </span>
              </label>
            </div>
          }
          confirmLabel="Issue payslips"
          pendingLabel="Issuing…"
          isPending={issue.isPending}
          onConfirm={() => source.trim() && issue.mutate()}
          onClose={() => setIssuing(false)}
        />
      )}
    </div>
  );
}

export function PayrollHistoryPanel() {
  const { data: runs = [], isLoading, isError, refetch } = useQuery({ queryKey: ['payroll-runs'], queryFn: getPayrollRuns });
  // Reading a run is `hr.payroll:read`; entering deductions and issuing are
  // writes, so an auditor sees the history and none of the controls.
  const canWrite = hasCapability(
    useAuthStore((state) => state.capabilities),
    'hr.payroll:write',
  );

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-sm animate-pulse" />
        ))}
      </div>
    );
  }

  // A failed read must never render as "no payroll runs yet". These are
  // financial records: absence and unavailability are different claims.
  if (isError) {
    return (
      <div className="py-24">
        <ErrorState
          icon={History}
          title="Payroll history couldn’t be loaded"
          description="No run has been read, so this is not a statement that none exist."
          onRetry={() => void refetch()}
        />
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="py-16">
          <EmptyState icon={History} title="No payroll runs yet" description="Finalise a run to keep an immutable record here." />
        </div>
        {/* Shown here too: no runs yet is precisely when a schedule gets set up. */}
        {canWrite && <PayrollScheduleCard />}
      </div>
    );
  }

  const groups = groupByPeriod(runs);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {groups.map((group) => (
          <PeriodSection key={group.key} group={group} canWrite={canWrite} />
        ))}
      </div>
      {/* The schedule belongs with the runs it produces, not on the Trading &
          payments page next to currency and VAT. */}
      {canWrite && <PayrollScheduleCard />}
    </div>
  );
}

/**
 * One period, and every run taken of it.
 *
 * Usually that is a single run and this is invisible. When it is more than
 * one, the period is contested — two snapshots of the same work — and that is
 * worth saying before either run is read.
 */
function PeriodSection({ group, canWrite }: { group: PeriodGroup; canWrite: boolean }) {
  const [combining, setCombining] = useState(false);
  const duplicated = hasDuplicates(group);
  const blocked = combineBlockedReason(group);

  return (
    <section className={cn('space-y-2', duplicated && 'rounded-md border border-measured/40 bg-band/30 p-3')}>
      {duplicated && (
        <div className="flex flex-wrap items-center gap-3">
          <AlertTriangle size={16} className="shrink-0 text-measured" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-foreground">
            <span className="font-semibold">
              {group.active.length} runs cover {formatRange(group.periodStart, group.periodEnd)}
            </span>{' '}
            — the same work is snapshotted twice. {blocked ?? 'Keep one and set the other aside.'}
          </p>
          {canWrite && !blocked && (
            <Button size="sm" variant="outline" onClick={() => setCombining(true)}>
              Combine
            </Button>
          )}
        </div>
      )}

      {group.runs.map((run) => (
        <RunCard key={run.id} run={run} canWrite={canWrite} />
      ))}

      {combining && <CombineDialog group={group} onClose={() => setCombining(false)} />}
    </section>
  );
}

/**
 * Choose which run survives.
 *
 * Never a merge. Summing two runs for one period pays that work twice, so one
 * is kept exactly as it is and the other is set aside — still readable, and
 * pointing at its replacement.
 */
function CombineDialog({ group, onClose }: { group: PeriodGroup; onClose: () => void }) {
  const qc = useQueryClient();
  const [survivorId, setSurvivorId] = useState(() => suggestSurvivor(group)?.id ?? group.active[0]?.id);

  const combine = useMutation({
    mutationFn: async () => {
      const losers = group.active.filter((run) => run.id !== survivorId);
      for (const loser of losers) await supersedePayrollRun(loser.id, survivorId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      onClose();
      toast('success', 'The duplicate runs were set aside.');
    },
    onError: (error) => toast('error', (error as Error).message || 'The runs weren’t combined. Try again.'),
  });

  return (
    <ConfirmModal
      title="Keep one run for this period"
      message={
        <div className="space-y-3 text-left">
          <p>
            Nothing is merged and nothing is deleted. The run you keep stays exactly as it is; the others are set aside, still readable,
            recording which run replaced them.
          </p>
          <ul className="space-y-2">
            {group.active.map((run) => (
              <li key={run.id}>
                <label className="flex cursor-pointer items-start gap-3 rounded-sm border border-rule p-3 hover:bg-band">
                  <input
                    type="radio"
                    name="payroll-survivor"
                    className="mt-1"
                    checked={survivorId === run.id}
                    onChange={() => setSurvivorId(run.id)}
                  />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">
                      Finalised {formatDate(run.finalisedAt)} · {money(runGross(run))}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {run.lines.length} {run.lines.length === 1 ? 'employee' : 'employees'}
                      {run.lines.some(lineIsComplete) ? ' · deductions entered' : ' · no deductions yet'}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      }
      confirmLabel="Keep this run"
      pendingLabel="Setting aside…"
      isPending={combine.isPending}
      onConfirm={() => combine.mutate()}
      onClose={onClose}
    />
  );
}
