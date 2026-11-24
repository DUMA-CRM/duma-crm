'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { Fragment, useMemo, useState } from 'react';

import { RowWarning } from '@/components/shared/rows';
import {
  AlertTriangle,
  ArrowLeft,
  Banknote,
  Building2,
  CalendarRange,
  CheckCircle2,
  CircleAlert,
  Clock,
  Download,
  History,
  Loader2,
  Play,
  Send,
  Settings,
  Users,
  Wallet,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { LineEditor } from '@/components/payroll/LineEditor';
import { PayLineDrawer } from '@/components/payroll/PayLineDrawer';
import { PayrollSettingsDrawer } from '@/components/payroll/PayrollSettingsDrawer';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { ChangeRow, Fact, ValueAside, ValueMissing } from '@/components/settings/controls';
import { Avatar } from '@/components/shared/Avatar';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { IconTag } from '@/components/shared/IconTag';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Pill } from '@/components/shared/Pill';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { FactsSkeleton, ListSkeleton, LoadingState } from '@/components/shared/Skeleton';
import type { Tone } from '@/components/shared/tone';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
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
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { type PeriodGroup, combineBlockedReason, groupByPeriod, hasDuplicates, suggestSurvivor } from '@/lib/utils/payroll-duplicates';
import { PERIOD_LABEL, periodContaining, rangeLabel, recentPeriods } from '@/lib/utils/payroll-periods';
import { itemTotals, runTotals } from '@/lib/utils/payroll-totals';
import { useAuthStore } from '@/stores/authStore';

import { csvCell, formatDate, hours, missingRate } from './shared';
import { useMoney, usePayrollSettings } from './usePayroll';

type View = { kind: 'runs' } | { kind: 'run'; id: string } | { kind: 'new' };

type Stage = 'draft' | 'figures' | 'ready' | 'issued' | 'superseded';

/** Where a run is up to — the word, the row tile's tone and glyph. */
const STAGE: Record<Stage, { label: string; tone: Tone; icon: IconComponent }> = {
  draft: { label: 'Draft', tone: 'muted', icon: History },
  figures: { label: 'Needs figures', tone: 'warning', icon: Wallet },
  ready: { label: 'Ready to issue', tone: 'primary', icon: Send },
  issued: { label: 'Issued', tone: 'success', icon: CheckCircle2 },
  superseded: { label: 'Set aside', tone: 'muted', icon: History },
};

/** Where a run is up to, in the words the list and the run agree on. */
function stageOf(run: PayrollRun): Stage {
  if (run.status === 'issued') return 'issued';
  if (run.status === 'superseded') return 'superseded';
  if (run.status === 'draft') return 'draft';
  return run.lines.length > 0 && run.lines.every(lineIsComplete) ? 'ready' : 'figures';
}

const CARD = 'rounded-lg border border-border bg-card shadow-sm';
const FACTS = 'grid gap-2 sm:grid-cols-2 xl:grid-cols-4';
const STAGGER = { shown: { transition: { staggerChildren: 0.06 } } };

const people = (count: number) => `${count} ${count === 1 ? 'person' : 'people'}`;

/**
 * Payroll, the way pay-run tools work: a list of pay runs, one open run at a
 * time taken through three steps — hours and gross (worked out here), each
 * person's deductions (entered from whoever computes tax), then issue.
 *
 * Country-agnostic by design: periods are weekly, fortnightly, twice-monthly
 * or monthly; money is in the workspace's currency; deductions are named lines
 * the country only suggests. Nothing here computes tax, in any country.
 *
 * Laid out as a workload screen: the figures that matter as `Fact` tiles, the
 * runs and the people in a run as one list each, a run opening in place of
 * the list and a payslip in a drawer.
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
    <motion.div key={view.kind} className="flex flex-col gap-5" initial="hidden" animate="shown" variants={STAGGER}>
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
          onSettings={settings.data ? () => setSettingsOpen(true) : undefined}
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
    </motion.div>
  );
}

// ── Aligned figures ───────────────────────────────────────────────────────────

/** One money column. The header names it once; `label` keeps it named for screen readers. */
function Cell({
  label,
  children,
  narrow = false,
  className,
}: {
  label: string;
  children: React.ReactNode;
  /** Dropped below `sm`. */
  narrow?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('w-24 text-right text-sm tabular-nums sm:w-28', narrow && 'hidden sm:block', className)}>
      <span className="sr-only">{label}: </span>
      {children}
    </span>
  );
}

/**
 * The column names, once, as the list's first line — drawn on the same grid as
 * a `ListRow` (tile and text, trailing cells, the chevron's width) so every
 * figure sits under its name.
 */
function ColumnHeads({ first, columns }: { first: string; columns: { label: string; narrow?: boolean }[] }) {
  return (
    <li aria-hidden="true" className="flex items-center gap-3 border-b border-border bg-band/35 px-3.5 py-2 text-xs text-muted-foreground">
      <span className="min-w-0 flex-1">{first}</span>
      <span className="flex shrink-0 items-center gap-2">
        {columns.map((column) => (
          <span key={column.label} className={cn('w-24 text-right sm:w-28', column.narrow && 'hidden sm:block')}>
            {column.label}
          </span>
        ))}
      </span>
      <span className="w-3.5 shrink-0" />
    </li>
  );
}

function BackLink({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      className="flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft size={15} /> Pay runs
    </button>
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
  onSettings?: () => void;
}) {
  const money = useMoney();
  const groups = useMemo(() => groupByPeriod(runs), [runs]);
  const open = runs.find((run) => stageOf(run) === 'figures' || stageOf(run) === 'ready');
  const lastIssued = runs.filter((run) => run.status === 'issued').sort((a, b) => (b.issuedAt ?? '').localeCompare(a.issuedAt ?? ''))[0];
  const current = periodContaining(period, new Date());
  const unread = error ? '—' : null;

  const list = loading ? (
    <ListSkeleton rows={3} label="Loading pay runs" />
  ) : error ? (
    // Financial records: "couldn't read" and "there are none" are different claims.
    <div className={CARD}>
      <ErrorState
        icon={History}
        title="Pay runs couldn’t be loaded"
        description="No run has been read, so this is not a statement that none exist."
        onRetry={onRetry}
      />
    </div>
  ) : runs.length === 0 ? (
    <div className={CARD}>
      <EmptyState
        compact
        icon={History}
        title="No pay runs yet"
        description="Run payroll to freeze a period’s hours and pay into a record here."
        action={canWrite ? { label: 'Run payroll', onClick: onNew, icon: Play } : undefined}
      />
    </div>
  ) : (
    <ListRowGroup>
      <ColumnHeads first="Period" columns={[{ label: 'Gross', narrow: true }, { label: 'Net' }]} />
      {groups.map((group) => (
        <Fragment key={group.key}>
          {hasDuplicates(group) && <DuplicateNotice group={group} canWrite={canWrite} />}
          {group.runs.map((run) => (
            <RunRow key={run.id} run={run} money={money} onOpen={() => onOpen(run.id)} />
          ))}
        </Fragment>
      ))}
    </ListRowGroup>
  );

  return (
    <>
      {loading ? (
        <FactsSkeleton count={4} surface="card" label="Loading payroll" className={FACTS} />
      ) : (
        <motion.dl variants={SECTION_RISE} className={FACTS}>
          <Fact
            surface="card"
            icon={Settings}
            label="Pay schedule"
            value={PERIOD_LABEL[period].name}
            hint={countryByCode(country)?.name ?? 'No country set'}
            onSelect={onSettings}
            action={canWrite && onSettings ? 'Change' : undefined}
          />
          <Fact surface="card" icon={CalendarRange} label="Next pay run" value={current.label} />
          {open ? (
            <Fact
              surface="card"
              icon={Wallet}
              label={STAGE[stageOf(open)].label}
              value={rangeLabel(open.periodStart, open.periodEnd)}
              hint={`${runTotals(open.lines).entered} of ${open.lines.length} payslips entered`}
              tone={stageOf(open) === 'figures' ? 'warning' : 'default'}
              onSelect={() => onOpen(open.id)}
            />
          ) : (
            <Fact
              surface="card"
              icon={CheckCircle2}
              label="Open run"
              value={unread ?? 'Nothing waiting'}
              hint={error ? 'Couldn’t be loaded' : undefined}
            />
          )}
          <Fact
            surface="card"
            icon={Banknote}
            label="Last issued"
            value={unread ?? (lastIssued ? money(runTotals(lastIssued.lines).net) : 'None yet')}
            hint={
              error ? 'Couldn’t be loaded' : lastIssued ? `Net · ${rangeLabel(lastIssued.periodStart, lastIssued.periodEnd)}` : undefined
            }
          />
        </motion.dl>
      )}

      <RecordGroup
        id="pay-runs"
        title="Pay runs"
        actions={
          canWrite && (
            <Button size="sm" onClick={onNew}>
              <Play data-icon="inline-start" />
              Run payroll
            </Button>
          )
        }
      >
        {list}
      </RecordGroup>
    </>
  );
}

function RunRow({ run, money, onOpen }: { run: PayrollRun; money: (value: string | number) => string; onOpen: () => void }) {
  const stage = stageOf(run);
  const totals = runTotals(run.lines);
  const meta =
    stage === 'issued' && run.issuedAt ? (
      <>
        Issued <RelativeTime iso={run.issuedAt} /> · {people(totals.people)}
      </>
    ) : stage === 'figures' ? (
      `Needs figures · ${totals.entered} of ${totals.people} entered`
    ) : (
      `${STAGE[stage].label} · ${people(totals.people)}`
    );
  return (
    <ListRow
      icon={STAGE[stage].icon}
      tone={STAGE[stage].tone}
      iconLabel={STAGE[stage].label}
      title={rangeLabel(run.periodStart, run.periodEnd)}
      meta={
        <>
          {meta} · {PERIOD_LABEL[run.period].name}
        </>
      }
      muted={stage === 'superseded'}
      onClick={onOpen}
      trailing={
        <>
          <Cell label="Gross" narrow className="font-semibold text-foreground">
            {money(totals.gross)}
          </Cell>
          <Cell label="Net" className={totals.entered === totals.people ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
            {totals.entered === totals.people ? money(totals.net) : '—'}
          </Cell>
        </>
      }
    />
  );
}

/** Two live runs for one period: the same work recorded twice. Said once, above the runs it is about. */
function DuplicateNotice({ group, canWrite }: { group: PeriodGroup; canWrite: boolean }) {
  const [combining, setCombining] = useState(false);
  const blocked = combineBlockedReason(group);
  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border bg-measured/6 px-3.5 py-2.5">
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
          <ul className="overflow-hidden rounded-lg border border-border">
            {group.active.map((run) => (
              <li key={run.id} className="border-b border-border last:border-b-0">
                <label className="flex cursor-pointer items-center gap-3 p-3 hover:bg-band/40">
                  <input type="radio" name="payroll-survivor" checked={survivorId === run.id} onChange={() => setSurvivorId(run.id)} />
                  <span className="min-w-0 text-sm">
                    <span className="font-semibold">{STAGE[stageOf(run)].label}</span> · {money(runTotals(run.lines).gross)} gross ·
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
  const [issuing, setIssuing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [source, setSource] = useState('');
  const stage = stageOf(run);
  const totals = runTotals(run.lines);
  const allEntered = totals.entered === totals.people;
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

  const deductionsDone = allEntered && totals.people > 0;

  return (
    <>
      <BackLink onBack={onBack} />

      <motion.header variants={SECTION_RISE} className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-2xl font-semibold tracking-headline text-heading">
            {rangeLabel(run.periodStart, run.periodEnd)}
            {/* A set-aside run is the one reading that must not be missed. */}
            {stage === 'superseded' && <Pill tone="muted">Set aside</Pill>}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {PERIOD_LABEL[run.period].name} · {people(totals.people)}
            {run.deductionsSource ? ` · figures from ${run.deductionsSource}` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={() => exportRun(run)}>
          <Download data-icon="inline-start" />
          Export for your accountant
        </Button>
      </motion.header>

      {/* The run's totals beside where it is up to. */}
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <motion.dl variants={SECTION_RISE} className="grid min-w-0 gap-2 sm:grid-cols-2">
          <Fact surface="card" icon={Banknote} label="Gross pay" value={money(totals.gross)} hint={people(totals.people)} />
          <Fact surface="card" icon={Wallet} label="Taken from pay" value={money(totals.employeeDeductions)} hint="Tax and contributions" />
          <Fact
            surface="card"
            icon={Users}
            label="Net pay"
            value={allEntered ? money(totals.net) : '—'}
            hint={allEntered ? 'Paid to employees' : 'Shown once every payslip is entered'}
          />
          <Fact
            surface="card"
            icon={Building2}
            label="Cost to the business"
            value={money(totals.totalCost)}
            hint={`Includes ${money(totals.employerCost)} employer contributions`}
          />
        </motion.dl>

        <SettingsSection title="Progress">
          <ChangeRow
            icon={Clock}
            label="Hours and gross"
            value={
              <>
                Frozen <ValueAside>· {formatDate(run.finalisedAt)}</ValueAside>
              </>
            }
            trailing={<IconTag icon={CheckCircle2} label="Done" tone="success" size={16} />}
          />
          <ChangeRow
            icon={Wallet}
            label="Deductions"
            value={
              <>
                {totals.entered} of {totals.people} entered
                {!deductionsDone && stage !== 'superseded' && <ValueAside>· {totals.people - totals.entered} to go</ValueAside>}
              </>
            }
            trailing={deductionsDone ? <IconTag icon={CheckCircle2} label="Done" tone="success" size={16} /> : undefined}
          />
          <ChangeRow
            icon={Send}
            label="Payslips"
            value={
              stage === 'issued' ? (
                <>
                  Issued <ValueAside>· {formatDate(run.issuedAt)}</ValueAside>
                </>
              ) : stage === 'superseded' ? (
                <ValueMissing>Set aside — never issued</ValueMissing>
              ) : (
                <ValueMissing>{stage === 'ready' ? 'Ready to issue' : 'Not issued'}</ValueMissing>
              )
            }
            trailing={stage === 'issued' ? <IconTag icon={CheckCircle2} label="Done" tone="success" size={16} /> : undefined}
            open={issuing}
            onToggle={
              editable && stage === 'ready'
                ? () => {
                    setIssuing((current) => !current);
                    setSource('');
                  }
                : undefined
            }
            verbs={['Issue', 'Cancel']}
          >
            <div className="space-y-2">
              <FieldLabel htmlFor="payroll-figures-source">Where the figures came from</FieldLabel>
              <div className="flex flex-wrap gap-2">
                <Input
                  id="payroll-figures-source"
                  value={source}
                  onChange={(event) => setSource(event.target.value)}
                  placeholder="e.g. BrightPay, or Kowalski Accounting"
                  className="min-w-48 flex-1"
                  autoFocus
                />
                <Button onClick={() => setConfirming(true)} disabled={!source.trim() || issue.isPending}>
                  <Send data-icon="inline-start" />
                  Issue {totals.people} payslips
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Printed on each payslip.</p>
            </div>
          </ChangeRow>
        </SettingsSection>
      </div>

      <RecordGroup id="payslips" title="Payslips">
        {lines.length === 0 ? (
          <div className={CARD}>
            <EmptyState compact icon={Users} title="No one in this run" description="Nobody had hours or a salary when it was frozen." />
          </div>
        ) : (
          <ListRowGroup>
            <ColumnHeads
              first="Person"
              columns={[{ label: 'Gross', narrow: true }, { label: 'Deductions', narrow: true }, { label: 'Net' }]}
            />
            {lines.map((line) => {
              const done = lineIsComplete(line);
              return (
                <ListRow
                  key={line.id}
                  leading={<Avatar name={line.employeeName ?? 'Unknown'} />}
                  title={line.employeeName ?? 'Unknown'}
                  meta={`${hours(line.paidHours)} paid${
                    line.payType === 'salaried' ? ' · salaried' : line.hourlyRate ? ` · ${money(line.hourlyRate)}/h` : ''
                  }`}
                  onClick={() => setEditing(line)}
                  trailing={
                    <>
                      <Cell label="Gross" narrow className="text-foreground">
                        {money(line.grossPay)}
                      </Cell>
                      <Cell label="Deductions" narrow className="text-muted-foreground">
                        {done ? `− ${money(itemTotals(line.items).employee)}` : '—'}
                      </Cell>
                      <Cell label="Net" className={done ? 'font-semibold text-foreground' : 'text-xs font-semibold text-measured'}>
                        {done ? money(line.netPay) : editable ? 'Enter figures' : 'Not entered'}
                      </Cell>
                    </>
                  }
                />
              );
            })}
            {/* The run's own totals, under the columns they add up. */}
            <li className="flex items-center gap-3 bg-band/35 px-3.5 py-3">
              <span className="min-w-0 flex-1 text-sm font-semibold text-foreground">Total</span>
              <span className="flex shrink-0 items-center gap-2">
                <Cell label="Gross" narrow className="font-semibold text-foreground">
                  {money(totals.gross)}
                </Cell>
                <Cell label="Deductions" narrow className="text-muted-foreground">
                  − {money(totals.employeeDeductions)}
                </Cell>
                <Cell label="Net" className={allEntered ? 'font-semibold text-foreground' : 'text-muted-foreground'}>
                  {allEntered ? money(totals.net) : '—'}
                </Cell>
              </span>
              <span className="w-3.5 shrink-0" aria-hidden="true" />
            </li>
          </ListRowGroup>
        )}
      </RecordGroup>

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

  const list = preview.isPending ? (
    <ListSkeleton rows={3} avatar label="Loading the hours" />
  ) : preview.isError ? (
    <div className={CARD}>
      <ErrorState
        icon={Users}
        title="The hours couldn’t be loaded"
        description="No hours have been read, so this is not a period with nobody in it."
        onRetry={() => void preview.refetch()}
      />
    </div>
  ) : lines.length === 0 ? (
    <div className={CARD}>
      <EmptyState compact icon={Users} title="Nobody to pay" description={`No one on the team has hours or a salary in ${range.label}.`} />
    </div>
  ) : (
    <ListRowGroup>
      <ColumnHeads first="Person" columns={[{ label: 'Hours', narrow: true }, { label: 'Rate', narrow: true }, { label: 'Gross' }]} />
      {lines.map((line) => (
        <ListRow
          key={line.userId}
          leading={<Avatar name={line.name} />}
          title={line.name}
          meta={line.jobTitle}
          onClick={() => setExplaining(line)}
          trailing={
            <>
              <Cell label="Hours" narrow className="text-muted-foreground">
                {hours(line.paidHours)}
              </Cell>
              <Cell label="Rate" narrow className="text-muted-foreground">
                {line.payType === 'salaried' ? 'Salaried' : line.hourlyRate ? `${money(line.hourlyRate)}/h` : '—'}
              </Cell>
              {missingRate(line) ? (
                <Cell label="Gross" className="text-xs font-semibold text-exception">
                  <span className="inline-flex items-center gap-1">
                    <CircleAlert size={13} aria-hidden="true" /> No rate
                  </span>
                </Cell>
              ) : (
                <Cell label="Gross" className="font-semibold text-foreground">
                  {money(line.grossPay)}
                </Cell>
              )}
            </>
          }
        />
      ))}
    </ListRowGroup>
  );

  return (
    <>
      <BackLink onBack={onBack} />

      <motion.header variants={SECTION_RISE} className="flex flex-wrap items-end gap-3">
        <h2 className="min-w-0 flex-1 text-2xl font-semibold tracking-headline text-heading">Run payroll</h2>
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
      </motion.header>

      {existing && (
        <RowWarning className="text-sm">
          This period already has a pay run ({STAGE[stageOf(existing)].label.toLowerCase()}). Running it again would record the same work
          twice.
        </RowWarning>
      )}

      {preview.isPending ? (
        <FactsSkeleton count={4} surface="card" label="Loading the period" className={FACTS} />
      ) : (
        <motion.dl variants={SECTION_RISE} className={FACTS}>
          <Fact
            surface="card"
            icon={Users}
            label="To be paid"
            value={preview.isError ? '—' : worked.length}
            hint={lines.length > worked.length ? `${lines.length - worked.length} with no hours` : 'Everyone on the team'}
          />
          <Fact
            surface="card"
            icon={Clock}
            label="Paid hours"
            value={preview.isError ? '—' : hours(paidHours)}
            hint="After unpaid breaks"
          />
          <Fact
            surface="card"
            icon={Banknote}
            label="Gross pay"
            value={preview.data ? money(preview.data.totals.gross) : '—'}
            hint="Before deductions"
          />
          <Fact
            surface="card"
            icon={CircleAlert}
            label="Can’t be paid"
            value={preview.isError ? '—' : unpayable.length}
            hint={unpayable.length ? 'Hourly, with hours but no rate' : 'Everyone has a rate'}
            tone={unpayable.length ? 'danger' : 'default'}
          />
        </motion.dl>
      )}

      <RecordGroup
        id="payroll-preview"
        title="Hours and gross"
        footnote={`Freezing locks these hours and this pay for ${range.label}. Later rota edits won’t change it.`}
      >
        {list}
      </RecordGroup>

      <div className="flex justify-end">
        <Button onClick={() => setConfirming(true)} disabled={!preview.data || lines.length === 0 || !!existing || finalise.isPending}>
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
