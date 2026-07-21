'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, PlugZap, Users } from 'lucide-react';
import { useState } from 'react';

import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type PayrollPeriod, createPayrollRun, getPayrollPreview } from '@/lib/api/payroll.service';
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
  thClass,
  weekRange,
} from './shared';

const PERIOD_OPTIONS = [
  { value: 'weekly' as const, label: 'Weekly' },
  { value: 'monthly' as const, label: 'Monthly' },
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
          <Button
            variant="outline"
            size="sm"
            disabled
            title="Coming soon — connect a payroll provider"
            className="gap-1.5"
          >
            <PlugZap size={14} />
            Send to connector
          </Button>
          <Button size="sm" onClick={() => setConfirmOpen(true)} disabled={!hasLines || finalise.isPending}>
            {finalise.isPending ? 'Finalising…' : 'Finalise run'}
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="min-h-0 flex-1 bg-card border border-border rounded-2xl overflow-hidden flex flex-col">
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : isError ? (
            <div className="py-24">
              <EmptyState icon={Users} title="Couldn't load payroll" description={(error as Error)?.message || 'Try again shortly.'} />
            </div>
          ) : !hasLines ? (
            <div className="py-24">
              <EmptyState icon={Users} title="No employees" description="No hours in this period." />
            </div>
          ) : (
            <table className="w-full text-sm border-collapse">
              <thead className="sticky top-0 z-10">
                <tr className="border-b border-border bg-muted">
                  <th className={thClass}>Employee</th>
                  <th className={thClass}>Pay type</th>
                  <th className={`${thClass} text-right`}>Raw hours</th>
                  <th className={`${thClass} text-right`}>Paid hours</th>
                  <th className={`${thClass} text-right`}>Rate</th>
                  <th className={`${thClass} text-right`}>Gross pay</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.userId} className="border-b border-border/50 last:border-0 hover:bg-surface-offset transition-colors">
                    <td className="px-3 md:px-5 py-3">
                      <p className="font-medium text-foreground">{l.name}</p>
                      <p className="text-xs text-muted-foreground">{l.jobTitle}</p>
                    </td>
                    <td className="px-3 md:px-5 py-3">
                      <Badge variant={l.payType === 'hourly' ? 'primary' : 'muted'}>{l.payType}</Badge>
                    </td>
                    <td className="px-3 md:px-5 py-3 text-right tabular-nums text-muted-foreground">{hours(l.rawHours)}</td>
                    <td className="px-3 md:px-5 py-3 text-right tabular-nums">{hours(l.paidHours)}</td>
                    <td className="px-3 md:px-5 py-3 text-right tabular-nums text-muted-foreground">
                      {l.payType === 'hourly' && l.hourlyRate != null ? money(l.hourlyRate) : '—'}
                    </td>
                    <td className="px-3 md:px-5 py-3 text-right tabular-nums font-semibold text-foreground">{money(l.grossPay)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-border bg-surface-offset/50">
                  <td colSpan={2} className="px-3 md:px-5 py-3 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    {totals.employees} {totals.employees === 1 ? 'employee' : 'employees'}
                  </td>
                  <td colSpan={3} className="px-3 md:px-5 py-3 text-right text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    Total gross
                  </td>
                  <td className="px-3 md:px-5 py-3 text-right tabular-nums font-bold text-primary">{money(totals.gross)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {confirmOpen && (
        <ConfirmModal
          title="Finalise payroll run"
          message={
            <>
              This snapshots an immutable payroll record for{' '}
              <span className="font-semibold text-foreground">{formatRange(from, to)}</span> covering{' '}
              <span className="font-semibold text-foreground">{totals.employees}</span> employees and{' '}
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
