'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Banknote, Eye, EyeOff, Landmark, Loader2, Receipt, Shield, UserRound } from '@/components/icons';
import { fmtDate, fmtMoney } from '@/components/people/shared';
import { ErrorState } from '@/components/shared/ErrorState';
import { InfoRow } from '@/components/shared/InfoRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { getEmployee, getEmployeeBank } from '@/lib/modules/people/client';
import { getEmployeePayslips } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';

import { DetailCard } from './OverviewSection';
import { CARD, type Employee } from './shared';

export function PayslipsCard({ userId }: { userId: string }) {
  const {
    data: payslips = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: moduleQueryKeys.people.key('employee-payslips', userId),
    queryFn: () => getEmployeePayslips(userId),
  });
  return (
    <section className={`${CARD} overflow-hidden`}>
      <div className="px-5 py-4 border-b border-rule">
        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Payslips</p>
        <p className="text-xs text-muted-foreground mt-1">Draft and finalised payroll documents for this employee.</p>
      </div>
      {isLoading ? (
        <div className="py-10 flex justify-center">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        // This used to read "Payslips are restricted to payroll-authorised
        // roles" — a guess at the cause. The card is already behind
        // `hr.sensitive:read`, and today the actual failure is a 404 from an
        // endpoint being rebuilt. Report the failure, not a theory about it.
        <ErrorState
          icon={Banknote}
          title="Payslips couldn’t be loaded"
          description="No payslip has been read, so this is not a statement that none exist."
          onRetry={() => void refetch()}
        />
      ) : payslips.length === 0 ? (
        <p className="p-8 text-center text-sm text-muted-foreground">No payslips have been issued for this employee.</p>
      ) : (
        <div className="divide-y divide-border">
          {payslips.slice(0, 8).map((payslip) => (
            <div key={payslip.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">
                    {fmtDate(payslip.payPeriodStart)} – {fmtDate(payslip.payPeriodEnd)}
                  </p>
                  <Badge variant={payslip.status === 'finalised' ? 'success' : 'warning'}>{payslip.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gross {fmtMoney(payslip.grossPay)} · Tax {fmtMoney(payslip.taxDeducted)} · NI {fmtMoney(payslip.nationalInsurance)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold tabular-nums">{fmtMoney(payslip.netPay)}</p>
                <p className="text-micro uppercase tracking-micro text-muted-foreground">Net pay</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="px-5 py-3 border-t border-rule bg-muted/30">
        <p className="text-label text-muted-foreground">
          HMRC submissions, P45/P60 and pension assessment remain payroll-system responsibilities.
        </p>
      </div>
    </section>
  );
}

// ── Bank & Statutory (money roles only) ───────────────────────────────────────

export function BankTab({ userId, emp, onEdit, className }: { userId: string; emp: Employee; onEdit?: () => void; className?: string }) {
  const [reveal, setReveal] = useState(false);
  const {
    data: bank,
    isPending,
    isError,
    refetch,
  } = useQuery({ queryKey: moduleQueryKeys.people.key('employee-bank', userId, reveal), queryFn: () => getEmployeeBank(userId, reveal) });
  const { data: revealedEmp } = useQuery({
    queryKey: moduleQueryKeys.people.key('hr-employee', userId, 'reveal'),
    queryFn: () => getEmployee(userId, true),
    enabled: reveal,
  });

  const niDisplay = reveal ? revealedEmp?.niNumber : emp.niNumber;

  return (
    <DetailCard
      className={className}
      title="Bank & statutory"
      description="Stored encrypted. Revealing is a separate, audited request."
      action={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setReveal((current) => !current)} className="gap-1.5">
            {reveal ? <EyeOff size={13} /> : <Eye size={13} />}
            {reveal ? 'Hide' : 'Reveal'}
          </Button>
          {onEdit && (
            <Button variant="outline" size="sm" onClick={onEdit}>
              Edit
            </Button>
          )}
        </div>
      }
    >
      {isError ? (
        <ErrorState
          icon={Landmark}
          title="Bank details couldn’t be loaded"
          description="Nothing was read, so this is not a statement that none are held."
          onRetry={() => void refetch()}
          className="py-6"
        />
      ) : isPending ? (
        <div className="h-16 animate-pulse rounded-sm bg-band" aria-hidden="true" />
      ) : (
        <>
          <InfoRow icon={UserRound} label="Account holder" value={bank?.accountHolder} missingLabel="None on file" />
          <InfoRow icon={Landmark} label="Bank" value={bank?.bankName} missingLabel="Not recorded" />
          <InfoRow
            icon={Landmark}
            label="Sort code"
            value={bank?.sortCode ?? undefined}
            missingLabel={bank?.hasBankDetails ? 'Hidden' : 'None on file'}
            copyable={reveal}
          />
          <InfoRow
            icon={Landmark}
            label="Account number"
            value={bank?.accountNumber ?? undefined}
            missingLabel={bank?.hasBankDetails ? 'Hidden' : 'None on file'}
            copyable={reveal}
          />
          <InfoRow icon={Shield} label="National Insurance" value={niDisplay ?? undefined} missingLabel="Missing" copyable={reveal} />
          <InfoRow icon={Receipt} label="Tax code" value={emp.taxCode ?? undefined} missingLabel="Set by payroll" />
        </>
      )}
    </DetailCard>
  );
}
