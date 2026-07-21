'use client';

import { useQuery } from '@tanstack/react-query';
import { ChevronRight, History } from 'lucide-react';
import { useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';

import { type PayrollRun, getPayrollRuns } from '@/lib/api/payroll.service';
import { cn } from '@/lib/utils/cn';

import { formatDate, formatRange, hours, money, thClass } from './shared';

const runGross = (run: PayrollRun) => run.lines.reduce((sum, l) => sum + Number(l.grossPay), 0);

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
        <div className="border-t border-border overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className={thClass}>Employee</th>
                <th className={`${thClass} text-right`}>Paid hours</th>
                <th className={`${thClass} text-right`}>Gross</th>
              </tr>
            </thead>
            <tbody>
              {run.lines.map((l) => (
                <tr key={l.id} className="border-b border-border/50 last:border-0">
                  <td className="px-3 md:px-5 py-2.5 text-foreground">{l.employeeName ?? 'Unknown'}</td>
                  <td className="px-3 md:px-5 py-2.5 text-right tabular-nums text-muted-foreground">{hours(l.paidHours)}</td>
                  <td className="px-3 md:px-5 py-2.5 text-right tabular-nums font-semibold text-foreground">{money(l.grossPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
