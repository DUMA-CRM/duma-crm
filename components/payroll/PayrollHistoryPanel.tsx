'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, History } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { DataTable, type DataTableColumn } from '@/components/ui/data-table';

import { type PayrollRun, getPayrollRuns } from '@/lib/api/payroll.service';
import { cn } from '@/lib/utils/cn';

import { formatDate, formatRange, hours, money } from './shared';

const runGross = (run: PayrollRun) => run.lines.reduce((sum, l) => sum + Number(l.grossPay), 0);
type PayrollLine = PayrollRun['lines'][number];

const payrollColumns: DataTableColumn<PayrollLine>[] = [
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
];

function RunCard({ run }: { run: PayrollRun }) {
  const [open, setOpen] = useState(false);
  const gross = runGross(run);

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 px-4 md:px-5 py-3.5 text-left hover:bg-surface-offset transition-colors"
      >
        <ChevronRight size={16} className={cn('text-muted-foreground transition-transform shrink-0', open && 'rotate-90')} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground">{formatRange(run.periodStart, run.periodEnd)}</span>
            <Badge variant={run.status === 'finalised' ? 'success' : 'muted'} className="capitalize">
              {run.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            <span className="capitalize">{run.period}</span> · finalised {formatDate(run.finalisedAt)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="tabular-nums font-bold text-primary">{money(gross)}</p>
          <p className="text-xs text-muted-foreground">
            {run.lines.length} {run.lines.length === 1 ? 'employee' : 'employees'}
          </p>
        </div>
      </button>

      {open && (
        <DataTable
          aria-label={`Payroll details for ${formatRange(run.periodStart, run.periodEnd)}`}
          data={run.lines}
          columns={payrollColumns}
          getRowKey={(line) => line.id}
          density="compact"
          borders={{ outer: false }}
          className="border-t border-border rounded-none"
        />
      )}
    </div>
  );
}

export function PayrollHistoryPanel() {
  const { data: runs = [], isLoading } = useQuery({ queryKey: ['payroll-runs'], queryFn: getPayrollRuns });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted rounded-2xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="py-24">
        <EmptyState icon={History} title="No payroll runs yet" description="Finalise a run to keep an immutable record here." />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {runs.map((run) => (
        <RunCard key={run.id} run={run} />
      ))}
    </div>
  );
}
