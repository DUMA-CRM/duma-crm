'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Banknote, Eye, EyeOff, Loader2, ShieldCheck } from '@/components/icons';
import {
  fmtDate,
  fmtMoney,
  inp,
  lbl,
} from '@/components/people/shared';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import {
  type BankDetailsPayload,
  getEmployee,
  getEmployeeBank,
  setEmployeeBank,
  updateEmployee,
} from '@/lib/api/hr.service';
import {
  getEmployeePayslips,
} from '@/lib/api/people-ops.service';
import { toast } from '@/stores/toastStore';


import { type Employee, Info } from './shared';

export function PayslipsCard({ userId }: { userId: string }) {
  const {
    data: payslips = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['employee-payslips', userId],
    queryFn: () => getEmployeePayslips(userId),
  });
  return (
    <section className="rounded-sm border border-rule bg-card shadow-sm overflow-hidden">
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

export function BankTab({ userId, emp }: { userId: string; emp: Employee }) {
  const qc = useQueryClient();
  const [reveal, setReveal] = useState(false);
  const { data: bank } = useQuery({ queryKey: ['employee-bank', userId, reveal], queryFn: () => getEmployeeBank(userId, reveal) });
  const { data: revealedEmp } = useQuery({
    queryKey: ['hr-employee', userId, 'reveal'],
    queryFn: () => getEmployee(userId, true),
    enabled: reveal,
  });
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState<BankDetailsPayload & { niNumber: string; taxCode: string }>({
    accountHolder: '',
    bankName: '',
    sortCode: '',
    accountNumber: '',
    niNumber: '',
    taxCode: emp.taxCode ?? '',
  });

  const save = useMutation({
    mutationFn: async () => {
      await setEmployeeBank(userId, {
        accountHolder: f.accountHolder || null,
        bankName: f.bankName || null,
        ...(f.sortCode ? { sortCode: f.sortCode } : {}),
        ...(f.accountNumber ? { accountNumber: f.accountNumber } : {}),
      });
      if (f.niNumber || f.taxCode) await updateEmployee(userId, { niNumber: f.niNumber || undefined, taxCode: f.taxCode || null });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['employee-bank', userId] });
      qc.invalidateQueries({ queryKey: ['hr-employee', userId] });
      setEdit(false);
      toast('success', 'Bank & statutory details saved.');
    },
    onError: (err) => toast('error', (err as Error).message || 'Bank and statutory details weren’t saved. Review the fields and try again.'),
  });

  const niDisplay = reveal ? revealedEmp?.niNumber : emp.niNumber;

  if (edit) {
    return (
      <div className="bg-card border border-rule rounded-sm p-5 space-y-4">
        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Bank & statutory</p>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Account holder</label>
            <input className={inp} value={f.accountHolder ?? ''} onChange={(e) => setF({ ...f, accountHolder: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Bank name</label>
            <input className={inp} value={f.bankName ?? ''} onChange={(e) => setF({ ...f, bankName: e.target.value })} />
          </div>
          <div>
            <label className={lbl}>Sort code</label>
            <input
              className={inp}
              value={f.sortCode ?? ''}
              onChange={(e) => setF({ ...f, sortCode: e.target.value })}
              placeholder="Leave blank to keep"
            />
          </div>
          <div>
            <label className={lbl}>Account number</label>
            <input
              className={inp}
              value={f.accountNumber ?? ''}
              onChange={(e) => setF({ ...f, accountNumber: e.target.value })}
              placeholder="Leave blank to keep"
            />
          </div>
          <div>
            <label className={lbl}>National Insurance no.</label>
            <input
              className={inp}
              value={f.niNumber}
              onChange={(e) => setF({ ...f, niNumber: e.target.value.toUpperCase() })}
              placeholder="Leave blank to keep"
            />
          </div>
          <div>
            <label className={lbl}>Tax code</label>
            <input className={inp} value={f.taxCode} onChange={(e) => setF({ ...f, taxCode: e.target.value.toUpperCase() })} />
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setEdit(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="flex-1">
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-rule rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-micro font-semibold text-muted-foreground uppercase tracking-micro">Bank & statutory</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setReveal((v) => !v)} className="gap-1.5">
            {reveal ? <EyeOff size={14} /> : <Eye size={14} />}
            {reveal ? 'Hide' : 'Reveal'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setF((current) => ({
                ...current,
                accountHolder: bank?.accountHolder ?? '',
                bankName: bank?.bankName ?? '',
                taxCode: emp.taxCode ?? '',
              }));
              setEdit(true);
            }}
          >
            Edit
          </Button>
        </div>
      </div>
      <dl className="grid sm:grid-cols-2 gap-4 text-sm">
        <Info label="Account holder" value={bank?.accountHolder} />
        <Info label="Bank" value={bank?.bankName} />
        <Info label="Sort code" value={bank?.sortCode} />
        <Info label="Account number" value={bank?.accountNumber} />
        <Info label="National Insurance" value={niDisplay} />
        <Info label="Tax code" value={emp.taxCode} />
      </dl>
      <p className="text-label text-muted-foreground mt-4 flex items-center gap-1.5">
        <ShieldCheck size={13} /> Sort code, account number and NI number are encrypted at rest and visible to HR/owners only.
      </p>
    </div>
  );
}

