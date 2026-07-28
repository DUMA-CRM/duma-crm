'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, PlugZap, Users } from 'lucide-react';
import { useState } from 'react';

import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

import { type PayrollPeriod, type PayrollPreviewLine, createPayrollRun, getPayrollPreview } from '@/lib/api/payroll.service';
import { toast } from '@/stores/toastStore';

import {
  csvCell,
  currentMonth,
  currentWeekStart,
  formatRange,
  hours,
  inputClass,
  labelClass,
  money,
  monthRange,
  weekRange,
} from './shared';

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
    cell: ({ row }) => money(row.grossPay),
  },
];

export function RunPayrollPanel({ onFinalised }: { onFinalised: () => void }) {
  const qc = useQueryClient();
  const [period, setPeriod] = useState<PayrollPeriod>('monthly');
  const [month, setMonth] = useState(currentMonth);
  const [weekStart, setWeekStart] = useState(currentWeekStart);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const { from, to } = period === 'monthly' ? monthRange(month) : weekRange(weekStart);
  const validRange = Boolean(from && to);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['payroll-preview', period, from, to],
    queryFn: () => getPayrollPreview(period, from, to),
    enabled: validRange,
  });

  const finalise = useMutation({
    mutationFn: () => createPayrollRun({ period, periodStart: from, periodEnd: to }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['payroll-runs'] });
      toast('success', 'Payroll run finalised.');
      setConfirmOpen(false);
      onFinalised();
    },
    onError: (err) => toast('error', err.message || 'Failed to finalise the payroll run.'),
  });

  const lines = data?.lines ?? [];
  const totals = data?.totals ?? { employees: 0, gross: 0 };
  const hasLines = lines.length > 0;

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
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className={labelClass}>Period</label>
          <SegmentedControl options={PERIOD_OPTIONS} value={period} onChange={setPeriod} />
        </div>
        {period === 'monthly' ? (
          <div>
            <label className={labelClass} htmlFor="payroll-month">
              Month
            </label>
            <input id="payroll-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className={inputClass} />
          </div>
        ) : (
          <div>
            <label className={labelClass} htmlFor="payroll-week">
              Week starting
            </label>
            <input id="payroll-week" type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} className={inputClass} />
          </div>
        )}
        {validRange && <p className="text-xs text-muted-foreground pb-2.5">{formatRange(from, to)}</p>}

        <div className="flex items-center gap-2 ml-auto pb-px">
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
          <EmptyState icon={Users} title="Couldn't load payroll" description={(error as Error)?.message || 'Try again shortly.'} />
        }
        emptyState={<EmptyState icon={Users} title="No employees" description="No hours in this period." />}
        minWidth={720}
        rowClassName="hover:bg-surface-offset/70"
        footer={
          hasLines ? (
            <div className="grid grid-cols-[1fr_auto_auto] items-center gap-6">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {totals.employees} {totals.employees === 1 ? 'employee' : 'employees'}
              </p>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Total gross</p>
              <p className="tabular-nums font-bold text-primary">{money(totals.gross)}</p>
            </div>
          ) : null
        }
      />

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
