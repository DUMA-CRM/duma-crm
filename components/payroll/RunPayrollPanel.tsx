'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, Banknote, CircleAlert, Clock, Download, PlugZap, Users } from '@/components/icons';
import { PayLineDrawer } from '@/components/payroll/PayLineDrawer';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { StatCard, StatCardGrid } from '@/components/shared/StatCard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
import { DatePicker } from '@/components/ui/date-picker';
import { Select } from '@/components/ui/select';

import {
  type PayrollPeriod,
  type PayrollPreviewLine,
  createPayrollRun,
  getPayrollPreview,
  getPayrollRuns,
} from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';

import {
  csvCell,
  currentMonth,
  currentWeekStart,
  formatRange,
  hours,
  labelClass,
  missingRate,
  money,
  monthRange,
  recentMonths,
  weekRange,
} from './shared';

/** Computed once: the list does not change while the panel is open. */
const MONTH_OPTIONS = recentMonths(12);

/**
 * A labelled control of a fixed height, so a row of them shares one baseline
 * whatever each one contains — a segmented control, a select, or plain text.
 */
function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label className={labelClass} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
    </div>
  );
}

const PERIOD_OPTIONS = [
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
];

const payrollColumns: DataTableColumn<PayrollPreviewLine>[] = [
  {
    id: 'employee',
    header: 'Employee',
    minWidth: 180,
    cell: ({ row }) => (
      <>
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">{row.jobTitle}</p>
      </>
    ),
  },
  {
    id: 'pay-type',
    header: 'Pay type',
    width: 'fit',
    cell: ({ row }) => <Badge variant={row.payType === 'hourly' ? 'primary' : 'muted'}>{row.payType}</Badge>,
  },
  {
    id: 'raw-hours',
    header: 'Raw hours',
    align: 'right',
    width: 'fit',
    cellClassName: 'tabular-nums text-muted-foreground',
    cell: ({ row }) => hours(row.rawHours),
  },
  {
    id: 'paid-hours',
    header: 'Paid hours',
    align: 'right',
    width: 'fit',
    cellClassName: 'tabular-nums',
    cell: ({ row }) => hours(row.paidHours),
  },
  {
    id: 'rate',
    header: 'Rate',
    align: 'right',
    width: 'fit',
    cellClassName: 'tabular-nums text-muted-foreground',
    cell: ({ row }) => (row.payType === 'hourly' && row.hourlyRate != null ? money(row.hourlyRate) : '—'),
  },
  {
    id: 'gross',
    header: 'Gross pay',
    align: 'right',
    width: 'fit',
    cellClassName: 'tabular-nums font-semibold',
    // An hourly line with hours but no rate is not "£0.00 owed" — it is a
    // record nobody can be paid from, and it must not read as a settled figure.
    cell: ({ row }) =>
      missingRate(row) ? (
        <span className="inline-flex items-center gap-1.5 font-semibold text-exception">
          <CircleAlert size={13} aria-hidden="true" />
          No rate
        </span>
      ) : (
        money(row.grossPay)
      ),
  },
];

export function RunPayrollPanel({ onFinalised }: { onFinalised: () => void }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<PayrollPeriod>('monthly');
  const [month, setMonth] = useState(currentMonth);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [openLine, setOpenLine] = useState<PayrollPreviewLine | null>(null);

  const { from, to } = period === 'monthly' ? monthRange(month) : weekRange(weekStart);
  const validRange = Boolean(from && to);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: moduleQueryKeys.people.key('payroll-preview', period, from, to),
    queryFn: () => getPayrollPreview(period, from, to),
    enabled: validRange,
  });

  const finalise = useMutation({
    mutationFn: () => createPayrollRun({ period, periodStart: from, periodEnd: to }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('payroll-runs') });
      toast('success', 'Payroll run finalised.');
      setConfirmOpen(false);
      onFinalised();
    },
    onError: (err) => toast('error', err.message || 'The payroll run wasn’t finalised. Review it and try again.'),
  });

  // Nothing in the database stops the same period being finalised twice —
  // there is no UNIQUE on (tenant, period_start, period_end, period), recorded
  // as a double-payment risk in DB-TD-019. The UI is the only thing that can
  // notice, so it looks.
  const { data: runs = [] } = useQuery({ queryKey: moduleQueryKeys.people.key('payroll-runs'), queryFn: getPayrollRuns });
  const existingRun = runs.find((run) => run.periodStart === from && run.periodEnd === to && run.period === period);

  const lines = data?.lines ?? [];
  const totals = data?.totals ?? { employees: 0, gross: 0 };
  const hasLines = lines.length > 0;

  // Who is actually in this run, and who cannot be paid from it.
  const worked = lines.filter((line) => line.rawHours > 0);
  const unpayable = lines.filter(missingRate);
  const paidHours = worked.reduce((sum, line) => sum + line.paidHours, 0);
  const overtime = worked.reduce((sum, line) => sum + Math.max(0, line.rawHours - line.paidHours), 0);

  const exportCsv = () => {
    const header = ['Name', 'Job title', 'Pay type', 'Raw hours', 'Paid hours', 'Rate', 'Gross'];
    const rows = lines.map((l) => [
      l.name,
      l.jobTitle,
      l.payType,
      l.rawHours,
      l.paidHours,
      l.payType === 'hourly' && l.hourlyRate != null ? Number(l.hourlyRate).toFixed(2) : '',
      Number(l.grossPay).toFixed(2),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payroll-${from}-to-${to}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col gap-4 h-full min-h-0">
      {/* Which period, then what to do with it.
          Each control is a labelled field of the same height, so they sit on
          one baseline without the per-child `pb-2.5` / `pb-px` nudges this row
          used to need. The month was a raw `<input type="month">` — a native
          widget that renders differently in every browser and matched nothing
          else on the page. */}
      <div className="flex flex-wrap items-end gap-x-3 gap-y-4">
        <Field label="Period">
          <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </Field>

        {period === 'monthly' ? (
          <Field label="Month" htmlFor="payroll-month">
            <Select
              id="payroll-month"
              value={month}
              onValueChange={setMonth}
              options={MONTH_OPTIONS}
              ariaLabel="Payroll month"
              className="w-48"
            />
          </Field>
        ) : (
          <Field label="Week starting" htmlFor="payroll-week">
            {/* DatePicker's own root is `w-full`, so the width is set here. */}
            <div className="w-44">
              <DatePicker id="payroll-week" value={weekStart} onValueChange={setWeekStart} />
            </div>
          </Field>
        )}

        {validRange && (
          <Field label="Covers">
            <p className="flex h-9 items-center text-sm text-foreground tabular-nums">{formatRange(from, to)}</p>
          </Field>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv} disabled={!hasLines} className="gap-1.5">
            <Download size={14} />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" disabled title="Coming soon — connect a payroll provider" className="gap-1.5">
            <PlugZap size={14} />
            Send to connector
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!hasLines || finalise.isPending}>
            {finalise.isPending ? 'Finalising…' : 'Finalise run'}
          </Button>
        </div>
      </div>

      {/* Already finalised: the one thing a manager must not do twice. */}
      {existingRun && (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-measured/40 bg-card px-4 py-3" role="status">
          <AlertTriangle size={16} className="shrink-0 text-measured" aria-hidden="true" />
          <p className="min-w-0 flex-1 text-sm text-foreground">
            <span className="font-semibold">This period has already been finalised</span>
            {existingRun.status === 'issued' ? ' and issued to employees.' : '.'} Finalising again creates a second run for the same dates —
            nothing in the database prevents it.
          </p>
        </div>
      )}

      {/* What the period actually contains, before reading a row of it. */}
      <StatCardGrid columns="auto">
        <StatCard
          size="sm"
          icon={Users}
          accent="primary"
          label="To be paid"
          value={worked.length}
          caption={lines.length > worked.length ? `${lines.length - worked.length} with no hours` : 'Everyone worked'}
          loading={isLoading}
          error={isError}
        />
        <StatCard
          size="sm"
          icon={Clock}
          accent="info"
          label="Paid hours"
          value={hours(paidHours)}
          caption={overtime > 0 ? `${hours(overtime)} clocked beyond the rota` : 'No time beyond the rota'}
          loading={isLoading}
          error={isError}
        />
        <StatCard
          size="sm"
          icon={Banknote}
          accent="success"
          label="Total gross"
          value={money(totals.gross)}
          caption="Before tax and National Insurance"
          loading={isLoading}
          error={isError}
        />
        <StatCard
          size="sm"
          icon={CircleAlert}
          accent={unpayable.length > 0 ? 'danger' : 'neutral'}
          label="Cannot be paid"
          value={unpayable.length}
          caption={unpayable.length > 0 ? 'Hourly, with hours but no rate' : 'Every worked line has a rate'}
          loading={isLoading}
          error={isError}
        />
      </StatCardGrid>

      <DataTable
        aria-label="Payroll preview"
        className="min-h-0 flex-1 flex flex-col"
        containerClassName="min-h-0 flex-1"
        data={lines}
        columns={payrollColumns}
        getRowKey={(line) => line.userId}
        isLoading={isLoading}
        isError={isError}
        errorState={
          <ErrorState
            icon={Users}
            title="The payroll preview couldn’t be loaded"
            description={(error as Error)?.message || 'No hours have been read, so this is not a period with nobody in it.'}
            onRetry={() => void refetch()}
          />
        }
        emptyState={<EmptyState icon={Users} title="No employees" description="No hours in this period." />}
        minWidth={720}
        rowClassName="hover:bg-band cursor-pointer"
        onRowClick={({ row }) => setOpenLine(row)}
        rowAriaLabel={({ row }) => `How ${row.name}'s pay was calculated`}
        footer={
          hasLines ? (
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-6">
              <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">
                {totals.employees} {totals.employees === 1 ? 'employee' : 'employees'}
              </p>
              <p className="text-micro font-semibold uppercase tracking-micro text-muted-foreground">Total gross</p>
              <p className="tabular-nums font-bold text-primary">{money(totals.gross)}</p>
            </div>
          ) : null
        }
      />

      {openLine && <PayLineDrawer line={openLine} period={period} from={from} to={to} onClose={() => setOpenLine(null)} />}

      {confirmOpen && (
        <ConfirmModal
          title="Finalise payroll run"
          message={
            <>
              This snapshots an immutable payroll record for <span className="font-semibold text-foreground">{formatRange(from, to)}</span>{' '}
              covering <span className="font-semibold text-foreground">{totals.employees}</span> employees and{' '}
              <span className="font-semibold text-foreground">{money(totals.gross)}</span> gross. It cannot be edited afterwards.
            </>
          }
          confirmLabel="Finalise run"
          pendingLabel="Finalising…"
          isPending={finalise.isPending}
          onConfirm={() => finalise.mutate()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </div>
  );
}
