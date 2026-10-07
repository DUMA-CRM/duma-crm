'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Download,
  History,
  Loader2,
  Play,
  Send,
  Settings,
  Users,
  Wallet,
} from '@/components/icons';
import { LineEditor } from '@/components/payroll/LineEditor';
import { PayLineDrawer } from '@/components/payroll/PayLineDrawer';
import { PayrollSettingsDrawer } from '@/components/payroll/PayrollSettingsDrawer';
import { Fact } from '@/components/settings/controls';
import { TileSkeleton, TilesSkeleton } from '@/components/shared/TileSkeleton';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { MiniBar } from '@/components/shared/MiniBar';
import { Pill } from '@/components/shared/Pill';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone, LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  PAYROLL_PERIODS,
  type PayrollPeriod,
  type PayrollPreviewLine,
  type PayrollRun,
  type PayrollRunLine,
  createPayrollRun,
  getPayrollPreview,
  getPayrollRuns,
  issuePayrollRun,
  lineIsComplete,
  supersedePayrollRun,
} from '@/lib/modules/payroll/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { countryByCode } from '@/lib/payroll/countries';
import { cn } from '@/lib/utils/cn';
import { type PeriodGroup, combineBlockedReason, groupByPeriod, hasDuplicates, suggestSurvivor } from '@/lib/utils/payroll-duplicates';
import { PERIOD_LABEL, periodContaining, rangeLabel, recentPeriods } from '@/lib/utils/payroll-periods';
import { itemTotals, runTotals } from '@/lib/utils/payroll-totals';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

import { csvCell, formatDate, hours, missingRate } from './shared';
import { useMoney, usePayrollSettings } from './usePayroll';

type View = { kind: 'runs' } | { kind: 'run'; id: string } | { kind: 'new' };

const STATUS_CHIP: Record<string, { label: string; variant: 'muted' | 'warning' | 'success' | 'primary' }> = {
  draft: { label: 'Draft', variant: 'muted' },
  figures: { label: 'Needs figures', variant: 'warning' },
  ready: { label: 'Ready to issue', variant: 'primary' },
  issued: { label: 'Issued', variant: 'success' },
  superseded: { label: 'Set aside', variant: 'muted' },
};

/** Where a run is up to, in the words the list and the run agree on. */
function stageOf(run: PayrollRun): keyof typeof STATUS_CHIP {
  if (run.status === 'issued') return 'issued';
  if (run.status === 'superseded') return 'superseded';
  if (run.status === 'draft') return 'draft';
  return run.lines.length > 0 && run.lines.every(lineIsComplete) ? 'ready' : 'figures';
}

/**
 * Payroll, the way pay-run tools work: a list of pay runs, one open run at a
 * time taken through three steps — hours and gross (worked out here), each
 * person's deductions (entered from whoever computes tax), then issue.
 *
 * Country-agnostic by design: periods are weekly, fortnightly, twice-monthly
 * or monthly; money is in the workspace's currency; deductions are named lines
 * the country only suggests. Nothing here computes tax, in any country.
 */
export function PayrollWorkspace() {
  const capabilities = useAuthStore((state) => state.capabilities);
  // Reading is hr.payroll:read; running, entering figures and issuing are writes,
  // so an auditor sees every run and none of the controls.
  const canWrite = hasCapability(capabilities, 'hr.payroll:write');
  const [view, setView] = useState<View>({ kind: 'runs' });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settings = usePayrollSettings();
  const runs = useQuery({ queryKey: moduleQueryKeys.payroll.key('payroll-runs'), queryFn: getPayrollRuns });

  const openRun = view.kind === 'run' ? (runs.data ?? []).find((run) => run.id === view.id) : undefined;

  return (
    <div className="space-y-5">
      {view.kind === 'runs' && (
        <RunsView
          runs={runs.data ?? []}
          loading={runs.isPending}
          error={runs.isError}
          onRetry={() => void runs.refetch()}
          canWrite={canWrite}
          period={settings.data?.payrollPeriod ?? 'monthly'}
          onOpen={(id) => setView({ kind: 'run', id })}
          onNew={() => setView({ kind: 'new' })}
          onSettings={() => setSettingsOpen(true)}
          country={settings.data?.payrollCountry ?? null}
        />
      )}
      {view.kind === 'new' && (
        <NewRunView
          defaultPeriod={settings.data?.payrollPeriod ?? 'monthly'}
          runs={runs.data ?? []}
          onBack={() => setView({ kind: 'runs' })}
          onCreated={(id) => setView({ kind: 'run', id })}
        />
      )}
      {view.kind === 'run' &&
        (openRun ? (
          <RunView
            run={openRun}
            canWrite={canWrite}
            country={settings.data?.payrollCountry ?? null}
            onBack={() => setView({ kind: 'runs' })}
          />
        ) : runs.isPending ? (
          <LoadingState label="Loading the pay run" />
        ) : (
          <EmptyState
            icon={History}
            kind="gone"
            title="This pay run isn’t here any more"
            action={{ label: 'Back to pay runs', onClick: () => setView({ kind: 'runs' }) }}
          />
        ))}
      {settingsOpen && settings.data && <PayrollSettingsDrawer settings={settings.data} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

// ── The list of pay runs ──────────────────────────────────────────────────────

function RunsView({
  runs,
  loading,
  error,
  onRetry,
  canWrite,
  period,
  country,
  onOpen,
  onNew,
  onSettings,
}: {
  runs: PayrollRun[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  canWrite: boolean;
  period: PayrollPeriod;
  country: string | null;
  onOpen: (id: string) => void;
  onNew: () => void;
  onSettings: () => void;
}) {
  const money = useMoney();
  const reduceMotion = useReducedMotion();
  const groups = useMemo(() => groupByPeriod(runs), [runs]);
  const open = runs.find((run) => stageOf(run) === 'figures' || stageOf(run) === 'ready');
  const current = periodContaining(period, new Date());

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {PERIOD_LABEL[period].name} · {countryByCode(country)?.name ?? 'No country set'}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onSettings} className="gap-1.5">
            <Settings size={15} /> Payroll settings
          </Button>
          {canWrite && (
            <Button onClick={onNew} className="gap-1.5">
              <Play size={15} /> Run payroll
            </Button>
          )}
        </div>
      </div>

      {/* The one thing to do next. */}
      {!loading && !error && (
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-rule/60 bg-field px-5 py-4">
          <span
            className={cn(
              'flex size-11 shrink-0 items-center justify-center rounded-md',
              open ? 'bg-measured/10 text-measured' : 'bg-primary/8 text-primary',
            )}
          >
            {open ? <Wallet size={20} aria-hidden="true" /> : <CheckCircle2 size={20} aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            {open ? (
              <>
                <p className="text-sm font-semibold text-foreground">
                  {stageOf(open) === 'ready'
                    ? `${rangeLabel(open.periodStart, open.periodEnd)} is ready to issue`
                    : `Finish ${rangeLabel(open.periodStart, open.periodEnd)}`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {runTotals(open.lines).entered} of {open.lines.length} payslips have their figures
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground">Nothing waiting</p>
                <p className="text-xs text-muted-foreground">Next pay run: {current.label}</p>
              </>
            )}
          </div>
          {open ? (
            <Button variant="outline" onClick={() => onOpen(open.id)} className="gap-1">
              Continue <ChevronRight size={14} />
            </Button>
          ) : (
            canWrite && (
              <Button variant="outline" onClick={onNew} className="gap-1">
                Start {current.label} <ChevronRight size={14} />
              </Button>
            )
          )}
        </div>
      )}

      {loading ? (
        <section role="status" aria-busy="true" aria-label="Loading pay runs">
          <Bone className="mx-1 mb-2 h-3.5 w-20" />
          <div className="space-y-2" aria-hidden="true">
            {[0, 1, 2].map((index) => (
              <TileSkeleton
                key={index}
                index={index}
                tile={null}
                trailing={['hidden h-8 w-28 sm:block', 'hidden h-8 w-28 md:block']}
                className="gap-4 border-rule/60 bg-field px-4"
              />
            ))}
          </div>
        </section>
      ) : error ? (
        // Financial records: "couldn't read" and "there are none" are different claims.
        <ErrorState
          icon={History}
          title="Pay runs couldn’t be loaded"
          description="No run has been read, so this is not a statement that none exist."
          onRetry={onRetry}
        />
      ) : runs.length === 0 ? (
        <EmptyState
          icon={History}
          title="No pay runs yet"
          description="Run payroll to freeze a period’s hours and pay into a record here."
          action={canWrite ? { label: 'Run payroll', onClick: onNew, icon: Play } : undefined}
        />
      ) : (
        <section>
          <h3 className="mb-2 px-1 text-sm font-semibold text-foreground">Pay runs</h3>
          <ul className="space-y-2">
            {groups.map((group) => (
              <PeriodRows key={group.key} group={group} canWrite={canWrite} onOpen={onOpen} money={money} reduceMotion={!!reduceMotion} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function PeriodRows({
  group,
  canWrite,
  onOpen,
  money,
  reduceMotion,
}: {
  group: PeriodGroup;
  canWrite: boolean;
  onOpen: (id: string) => void;
  money: (value: string | number) => string;
  reduceMotion: boolean;
}) {
  const [combining, setCombining] = useState(false);
  const duplicated = hasDuplicates(group);
  const blocked = combineBlockedReason(group);

  return (
    <li className={cn(duplicated && 'space-y-2 rounded-lg border border-measured/40 bg-measured/5 p-2')}>
      {duplicated && (
        <div className="flex flex-wrap items-center gap-2 px-2 py-1">
          <AlertTriangle size={15} className="shrink-0 text-measured" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-foreground">
            <span className="font-semibold">{group.active.length} runs cover this period</span> — the same work is recorded twice.{' '}
            {blocked ?? 'Keep one and set the other aside.'}
          </p>
          {canWrite && !blocked && (
            <Button size="sm" variant="outline" onClick={() => setCombining(true)}>
              Combine
            </Button>
          )}
        </div>
      )}
      <ul className="space-y-2">
        {group.runs.map((run, index) => {
          const stage = stageOf(run);
          const chip = STATUS_CHIP[stage];
          const totals = runTotals(run.lines);
          return (
            <motion.li
              key={run.id}
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reduceMotion ? 0 : Math.min(index, 6) * 0.03 }}
            >
              <button
                type="button"
                onClick={() => onOpen(run.id)}
                className={cn(
                  'group flex w-full items-center gap-4 rounded-lg border border-rule/60 bg-field px-4 py-3 text-left transition-colors hover:bg-band/40',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                  stage === 'superseded' && 'opacity-60',
                )}
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{rangeLabel(run.periodStart, run.periodEnd)}</span>
                    <RunSteps stage={stage} label={chip.label} />
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {PERIOD_LABEL[run.period].name} · {totals.people} {totals.people === 1 ? 'person' : 'people'}
                    {run.issuedAt && (
                      <>
                        {' '}
                        · issued <RelativeTime iso={run.issuedAt} />
                      </>
                    )}
                  </span>
                </span>
                <span className="hidden w-28 text-right sm:block">
                  <span className="block text-xs text-muted-foreground">Gross</span>
                  <span className="block text-sm font-semibold text-foreground">{money(totals.gross)}</span>
                </span>
                <span className="hidden w-28 text-right md:block">
                  <span className="block text-xs text-muted-foreground">Net</span>
                  <span className="block text-sm font-semibold text-foreground">
                    {totals.entered === totals.people ? money(totals.net) : '—'}
                  </span>
                </span>
                <ChevronRight
                  size={15}
                  className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </button>
            </motion.li>
          );
        })}
      </ul>
      {combining && <CombineDialog group={group} onClose={() => setCombining(false)} />}
    </li>
  );
}

/** Keep one run for a period. Never a merge: summing two snapshots pays the same work twice. */
function CombineDialog({ group, onClose }: { group: PeriodGroup; onClose: () => void }) {
  const qc = useQueryClient();
  const money = useMoney();
  const [survivorId, setSurvivorId] = useState(() => suggestSurvivor(group)?.id ?? group.active[0]?.id);
  const combine = useMutation({
    mutationFn: async () => {
      for (const loser of group.active.filter((run) => run.id !== survivorId)) await supersedePayrollRun(loser.id, survivorId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.payroll.key('payroll-runs') });
      toast('success', 'The duplicate runs were set aside.');
      onClose();
    },
    onError: (error) => toast('error', (error as Error).message || 'The runs weren’t combined. Try again.'),
  });
  return (
    <ConfirmModal
      title="Keep one run for this period"
      message={
        <div className="space-y-3 text-left">
          <p>Nothing is merged or deleted. The run you keep stays as it is; the others are set aside, still readable.</p>
          <ul className="space-y-2">
            {group.active.map((run) => (
              <li key={run.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-rule/60 p-3 hover:bg-band/40">
                  <input type="radio" name="payroll-survivor" checked={survivorId === run.id} onChange={() => setSurvivorId(run.id)} />
                  <span className="min-w-0 text-sm">
                    <span className="font-semibold">{STATUS_CHIP[stageOf(run)].label}</span> · {money(runTotals(run.lines).gross)} gross ·
                    finalised {formatDate(run.finalisedAt)}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </div>
      }
      confirmLabel="Keep this one"
      pendingLabel="Setting aside…"
      isPending={combine.isPending}
      onConfirm={() => combine.mutate()}
      onClose={onClose}
    />
  );
}

// ── One pay run ───────────────────────────────────────────────────────────────

function RunView({ run, canWrite, country, onBack }: { run: PayrollRun; canWrite: boolean; country: string | null; onBack: () => void }) {
  const qc = useQueryClient();
  const money = useMoney();
  const [editing, setEditing] = useState<PayrollRunLine | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [source, setSource] = useState('');
  const stage = stageOf(run);
  const totals = runTotals(run.lines);
  const editable = canWrite && (stage === 'figures' || stage === 'ready');
  const lines = [...run.lines].sort(
    (a, b) => Number(lineIsComplete(a)) - Number(lineIsComplete(b)) || (a.employeeName ?? '').localeCompare(b.employeeName ?? ''),
  );

  const issue = useMutation({
    mutationFn: () => issuePayrollRun(run.id, source.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.payroll.key('payroll-runs') });
      // Employees read their own payslips under different keys.
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.payroll.key('payslips-me') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.payroll.key('employee-payslips') });
      setConfirming(false);
      toast('success', 'Payslips issued. Everyone can see theirs in My HR.');
    },
    onError: (error) => toast('error', (error as Error).message || 'The run wasn’t issued. Try again.'),
  });

  const steps = [
    { label: 'Hours & gross', done: true, detail: 'Frozen when the run was finalised' },
    {
      label: 'Deductions',
      done: totals.entered === totals.people && totals.people > 0,
      detail: `${totals.entered} of ${totals.people} entered`,
    },
    {
      label: 'Issue payslips',
      done: stage === 'issued',
      detail: stage === 'issued' ? `Issued ${formatDate(run.issuedAt)}` : 'Employees see them in My HR',
    },
  ];

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Pay runs
      </button>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-xl font-semibold tracking-headline text-foreground">
            {rangeLabel(run.periodStart, run.periodEnd)}
            {/* The steps below say where a live run is up to; nothing says a
                run was set aside, and that is the one reading that must not be missed. */}
            {stage === 'superseded' && <Pill tone="muted">Set aside</Pill>}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {PERIOD_LABEL[run.period].name} · finalised {formatDate(run.finalisedAt)}
            {run.deductionsSource ? ` · figures from ${run.deductionsSource}` : ''}
          </p>
        </div>
        <Button variant="outline" className="gap-1.5" onClick={() => exportRun(run)}>
          <Download size={15} /> Export for your accountant
        </Button>
      </header>

      {/* Where this run is up to. */}
      <ol className="grid gap-2 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.label}
            className={cn(
              'flex items-center gap-3 rounded-lg border px-4 py-3',
              step.done ? 'border-rule/60 bg-field' : 'border-dashed border-rule/70',
            )}
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-md text-sm font-semibold',
                step.done ? 'bg-primary text-primary-foreground' : 'bg-band text-muted-foreground',
              )}
            >
              {step.done ? <CheckCircle2 size={16} aria-hidden="true" /> : index + 1}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{step.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{step.detail}</span>
            </span>
          </li>
        ))}
      </ol>

      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          surface="page"
          icon={Banknote}
          label="Gross pay"
          value={money(totals.gross)}
          hint={`${totals.people} ${totals.people === 1 ? 'person' : 'people'}`}
        />
        <Fact surface="page" icon={Wallet} label="Taken from pay" value={money(totals.employeeDeductions)} hint="Tax and contributions" />
        <Fact
          surface="page"
          icon={Users}
          label="Net pay"
          value={totals.entered === totals.people ? money(totals.net) : '—'}
          hint={totals.entered === totals.people ? 'Paid to employees' : 'Shown once every payslip is entered'}
        />
        <Fact
          surface="page"
          icon={Building2}
          label="Cost to the business"
          value={money(totals.totalCost)}
          hint={`Includes ${money(totals.employerCost)} employer contributions`}
        />
      </dl>

      <section>
        {/* The column names once, above the rows, instead of on every row. */}
        <div className="mb-2 flex items-end gap-4 px-4">
          <h3 className="min-w-0 flex-1 text-sm font-semibold text-foreground">Payslips</h3>
          <span className="hidden w-28 text-right text-xs text-muted-foreground sm:block">Gross</span>
          <span className="hidden w-28 text-right text-xs text-muted-foreground sm:block">Deductions</span>
          <span className="w-32 text-right text-xs text-muted-foreground">Net</span>
          <span className="w-[15px] shrink-0" aria-hidden="true" />
        </div>
        <ul className="space-y-2">
          {lines.map((line) => {
            const done = lineIsComplete(line);
            const lineTotals = itemTotals(line.items);
            return (
              <li key={line.id}>
                <button
                  type="button"
                  onClick={() => setEditing(line)}
                  className={cn(
                    'group flex w-full items-center gap-4 rounded-lg border bg-field px-4 py-3 text-left transition-colors hover:bg-band/40',
                    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    done ? 'border-rule/60' : 'border-dashed border-measured/50',
                  )}
                >
                  <Avatar name={line.employeeName ?? 'Unknown'} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{line.employeeName ?? 'Unknown'}</span>
                    <span className="block text-xs text-muted-foreground">
                      {hours(line.paidHours)} paid{' '}
                      {line.payType === 'salaried' ? '· salaried' : line.hourlyRate ? `· ${money(line.hourlyRate)}/h` : ''}
                    </span>
                  </span>
                  <Amount label="Gross" value={money(line.grossPay)} />
                  <Amount label="Deductions" value={done ? `− ${money(lineTotals.employee)}` : '—'} muted />
                  <span className="w-32 text-right">
                    {done ? (
                      <>
                        <span className="block text-sm font-semibold text-foreground">{money(line.netPay)}</span>
                        {Number(line.grossPay) > 0 && (
                          <MiniBar
                            value={Number(line.netPay)}
                            max={Number(line.grossPay)}
                            tone="success"
                            label={`Net ${money(line.netPay)} of ${money(line.grossPay)} gross`}
                            className="mt-1 ml-auto w-20"
                          />
                        )}
                      </>
                    ) : (
                      <span className="text-xs font-semibold text-measured">{editable ? 'Enter figures' : 'Not entered'}</span>
                    )}
                  </span>
                  <ChevronRight
                    size={15}
                    className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {editable && stage === 'ready' && (
        <section className="flex flex-wrap items-end gap-3 rounded-lg border border-primary/30 bg-primary/5 px-5 py-4">
          <div className="min-w-64 flex-1">
            <p className="text-sm font-semibold text-foreground">Every payslip has its figures</p>
            <p className="text-xs text-muted-foreground">Say where they came from — it’s printed on each payslip.</p>
            <Input
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="e.g. BrightPay, or Kowalski Accounting"
              aria-label="Where the figures came from"
              className="mt-2"
            />
          </div>
          <Button onClick={() => setConfirming(true)} disabled={!source.trim() || issue.isPending} className="gap-1.5">
            <Send size={15} /> Issue {totals.people} payslips
          </Button>
        </section>
      )}

      {editing && <LineEditor runId={run.id} line={editing} country={country} editable={editable} onClose={() => setEditing(null)} />}

      {confirming && (
        <ConfirmModal
          title="Issue these payslips?"
          message={`${totals.people} people will see their payslip for ${rangeLabel(run.periodStart, run.periodEnd)} in My HR — ${money(totals.net)} in net pay. Issued payslips can’t be changed.`}
          confirmLabel="Issue payslips"
          pendingLabel="Issuing…"
          isPending={issue.isPending}
          onConfirm={() => issue.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}

/** A figure under a column header named once above the list; `label` keeps it named for screen readers. */
function Amount({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <span className="hidden w-28 text-right sm:block">
      <span className="sr-only">{label} </span>
      <span className={cn('block text-sm', muted ? 'text-muted-foreground' : 'font-semibold text-foreground')}>{value}</span>
    </span>
  );
}

/** The run's three steps as dots — finalised, figures in, issued — with the stage word on hover. */
const RUN_STEPS_DONE: Record<keyof typeof STATUS_CHIP, number> = { draft: 0, figures: 1, ready: 2, issued: 3, superseded: 0 };

function RunSteps({ stage, label }: { stage: keyof typeof STATUS_CHIP; label: string }) {
  const done = RUN_STEPS_DONE[stage];
  return (
    <span className="inline-flex items-center gap-1" role="img" aria-label={label} title={label}>
      {[0, 1, 2].map((step) => (
        <span
          key={step}
          aria-hidden="true"
          className={cn(
            'size-1.5 rounded-full',
            stage === 'superseded'
              ? 'bg-muted-foreground/30'
              : step < done
                ? stage === 'issued'
                  ? 'bg-momentum'
                  : 'bg-primary'
                : step === done
                  ? stage === 'figures'
                    ? 'bg-measured'
                    : 'border border-primary/60'
                  : 'bg-band ring-1 ring-rule',
          )}
        />
      ))}
    </span>
  );
}

/** One row per person, one column per named line — the sheet an accountant works from. */
function exportRun(run: PayrollRun) {
  const labels = [
    ...new Set(run.lines.flatMap((line) => line.items.map((item) => `${item.label}${item.paidBy === 'employer' ? ' (employer)' : ''}`))),
  ];
  const header = ['Name', 'Pay type', 'Paid hours', 'Hourly rate', 'Gross', ...labels, 'Net'];
  const rows = run.lines.map((line) => {
    const byLabel = new Map(line.items.map((item) => [`${item.label}${item.paidBy === 'employer' ? ' (employer)' : ''}`, item.amount]));
    return [
      line.employeeName ?? '',
      line.payType,
      line.paidHours,
      line.hourlyRate ?? '',
      line.grossPay,
      ...labels.map((label) => byLabel.get(label) ?? ''),
      line.netPay ?? '',
    ];
  });
  const csv = [header, ...rows].map((row) => row.map((cell) => csvCell(cell)).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `payroll-${run.periodStart}-to-${run.periodEnd}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

// ── Starting a run ────────────────────────────────────────────────────────────

function NewRunView({
  defaultPeriod,
  runs,
  onBack,
  onCreated,
}: {
  defaultPeriod: PayrollPeriod;
  runs: PayrollRun[];
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const qc = useQueryClient();
  const money = useMoney();
  const [period, setPeriod] = useState<PayrollPeriod>(defaultPeriod);
  const options = useMemo(() => recentPeriods(period, 8), [period]);
  const [rangeKey, setRangeKey] = useState<string>('');
  const range = options.find((option) => option.from === rangeKey) ?? options[0];
  const [explaining, setExplaining] = useState<PayrollPreviewLine | null>(null);
  const [confirming, setConfirming] = useState(false);

  const preview = useQuery({
    queryKey: moduleQueryKeys.payroll.key('payroll-preview', period, range.from, range.to),
    queryFn: () => getPayrollPreview(period, range.from, range.to),
  });
  // Nothing in the database stops the same period being finalised twice
  // (DB-TD-019), so the screen looks — and the API refuses with 409 too.
  const existing = runs.find(
    (run) => run.period === period && run.periodStart === range.from && run.periodEnd === range.to && run.status !== 'superseded',
  );

  const finalise = useMutation({
    mutationFn: () => createPayrollRun({ period, periodStart: range.from, periodEnd: range.to }),
    onSuccess: (run) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.payroll.key('payroll-runs') });
      toast('success', 'Hours and pay frozen. Now enter each person’s deductions.');
      onCreated(run.id);
    },
    onError: (error) => toast('error', (error as Error).message || 'The run wasn’t finalised. Try again.'),
  });

  const lines = preview.data?.lines ?? [];
  const worked = lines.filter((line) => line.rawHours > 0 || line.payType === 'salaried');
  const unpayable = lines.filter(missingRate);
  const paidHours = worked.reduce((sum, line) => sum + line.paidHours, 0);

  return (
    <>
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={15} /> Pay runs
      </button>

      <header className="flex flex-wrap items-end gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold tracking-headline text-foreground">Run payroll</h2>
          <p className="mt-1 text-sm text-muted-foreground">Check the hours and gross pay, then freeze them. Deductions come next.</p>
        </div>
        <Select
          value={period}
          onValueChange={(value) => {
            setPeriod(value as PayrollPeriod);
            setRangeKey('');
          }}
          options={PAYROLL_PERIODS.map((value) => ({ value, label: PERIOD_LABEL[value].name }))}
          ariaLabel="Pay period"
          className="w-44"
        />
        <Select
          value={range.from}
          onValueChange={setRangeKey}
          options={options.map((option) => ({ value: option.from, label: option.label }))}
          ariaLabel="Which period"
          className="w-56"
        />
      </header>

      {existing && (
        <p
          className="flex items-start gap-2 rounded-lg border border-measured/40 bg-measured/5 px-4 py-3 text-sm text-foreground"
          role="status"
        >
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
          <span>
            <span className="font-semibold">This period already has a pay run</span> ({STATUS_CHIP[stageOf(existing)].label.toLowerCase()}).
            Running it again would record the same work twice.
          </span>
        </p>
      )}

      <dl className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Fact
          surface="page"
          icon={Users}
          label="To be paid"
          value={preview.isPending ? '—' : worked.length}
          hint={lines.length > worked.length ? `${lines.length - worked.length} with no hours` : 'Everyone on the team'}
        />
        <Fact
          surface="page"
          icon={History}
          label="Paid hours"
          value={preview.isPending ? '—' : hours(paidHours)}
          hint="After unpaid breaks"
        />
        <Fact
          surface="page"
          icon={Banknote}
          label="Gross pay"
          value={preview.data ? money(preview.data.totals.gross) : '—'}
          hint="Before deductions"
        />
        <Fact
          surface="page"
          icon={CircleAlert}
          label="Can’t be paid"
          value={preview.isPending ? '—' : unpayable.length}
          hint={unpayable.length ? 'Hourly, with hours but no rate' : 'Everyone has a rate'}
          tone={unpayable.length ? 'danger' : 'default'}
        />
      </dl>

      {preview.isPending ? (
        <TilesSkeleton
          count={3}
          label="Loading the hours"
          tile={null}
          trailing={['hidden h-4 w-28 sm:block', 'hidden h-4 w-28 sm:block', 'h-4 w-32']}
          tileClassName="gap-4 border-rule/60 bg-field px-4"
        />
      ) : preview.isError ? (
        <ErrorState
          icon={Users}
          title="The hours couldn’t be loaded"
          description="No hours have been read, so this is not a period with nobody in it."
          onRetry={() => void preview.refetch()}
        />
      ) : lines.length === 0 ? (
        <EmptyState icon={Users} title="Nobody to pay" description={`No one on the team has hours or a salary in ${range.label}.`} />
      ) : (
        <ul className="space-y-2">
          {lines.map((line) => (
            <li key={line.userId}>
              <button
                type="button"
                onClick={() => setExplaining(line)}
                className="group flex w-full items-center gap-4 rounded-lg border border-rule/60 bg-field px-4 py-3 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-foreground">{line.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">{line.jobTitle}</span>
                </span>
                <Amount label="Hours" value={hours(line.paidHours)} muted />
                <Amount
                  label="Rate"
                  value={line.payType === 'salaried' ? 'Salaried' : line.hourlyRate ? `${money(line.hourlyRate)}/h` : '—'}
                  muted
                />
                <span className="w-32 text-right">
                  {missingRate(line) ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-exception">
                      <CircleAlert size={13} aria-hidden="true" /> No rate
                    </span>
                  ) : (
                    <>
                      <span className="block text-xs text-muted-foreground">Gross</span>
                      <span className="block text-sm font-semibold text-foreground">{money(line.grossPay)}</span>
                    </>
                  )}
                </span>
                <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-rule/50 pt-4">
        <p className="text-xs text-muted-foreground">
          Freezing locks these hours and this pay for {range.label}. Later rota edits won’t change it.
        </p>
        <Button
          onClick={() => setConfirming(true)}
          disabled={!preview.data || lines.length === 0 || !!existing || finalise.isPending}
          className="gap-1.5"
        >
          {finalise.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          Freeze and continue
        </Button>
      </div>

      {explaining && (
        <PayLineDrawer line={explaining} period={period} from={range.from} to={range.to} onClose={() => setExplaining(null)} />
      )}
      {confirming && preview.data && (
        <ConfirmModal
          title={`Freeze ${range.label}?`}
          message={`Hours and gross pay for ${preview.data.totals.employees} people — ${money(preview.data.totals.gross)} — are saved as they are now and can’t be edited afterwards.`}
          confirmLabel="Freeze and continue"
          pendingLabel="Freezing…"
          isPending={finalise.isPending}
          onConfirm={() => finalise.mutate()}
          onClose={() => setConfirming(false)}
        />
      )}
    </>
  );
}
