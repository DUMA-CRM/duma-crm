'use client';

import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import { Banknote, ChevronDown, Download, Eye, EyeOff, KeyRound, Landmark, Receipt, ReceiptText, Shield, UserRound } from '@/components/icons';
import { usePayrollLocale } from '@/components/payroll/usePayroll';
import { fmtDate } from '@/components/people/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Fact } from '@/components/settings/controls';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';

import { getEmployee, getEmployeeBank } from '@/lib/modules/people/client';
import { type Payslip, getEmployeePayslips } from '@/lib/modules/payroll/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { statutoryIdLabel } from '@/lib/utils/employee-record';
import { payslipDeductions, payslipEmployerLines, payslipYearSummary } from '@/lib/utils/my-hr';
import { formatMoney } from '@/lib/utils/payroll-totals';

import { CopyButton, type Employee, RecordBlock, RecordList, RecordListRow } from './shared';

/*
 * Pay & statutory, in the Overview's vocabulary: payslips as audit-log rows
 * that unfold to their named lines, and the bank and statutory details beside
 * them. Money is in the workspace's payroll currency (`useMoney`), the ID is
 * called by its local name, and nothing here computes tax — these are the
 * figures entered from whatever runs payroll.
 */

const PERIOD = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

/** "August 2026" for a calendar month, "1 – 15 Sept 2026" for anything else. */
function periodLabel(payslip: Payslip) {
  const start = new Date(`${payslip.payPeriodStart.slice(0, 10)}T12:00:00`);
  const end = new Date(`${payslip.payPeriodEnd.slice(0, 10)}T12:00:00`);
  const lastOfMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  if (start.getDate() === 1 && end.getDate() === lastOfMonth && start.getMonth() === end.getMonth()) return PERIOD.format(start);
  return `${fmtDate(payslip.payPeriodStart)} – ${fmtDate(payslip.payPeriodEnd)}`;
}

// ── Payslips ─────────────────────────────────────────────────────────────────

export function PayslipsCard({ userId }: { userId: string }) {
  const { currency } = usePayrollLocale();
  const money = (amount: string | number | null | undefined) => formatMoney(amount, currency);
  const [year] = useState(() => new Date().getFullYear());
  const [open, setOpen] = useState<string | null>(null);
  const {
    data: payslips = [],
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: moduleQueryKeys.payroll.key('employee-payslips', userId),
    queryFn: () => getEmployeePayslips(userId),
  });
  const ytd = payslipYearSummary(payslips, year);
  const latest = payslips.find((payslip) => payslip.status === 'finalised');

  return (
    <RecordBlock
      id="record-payslips"
      title="Payslips"
      note="Tax filings and year-end forms come from your payroll provider — these are the figures entered from it."
    >
      {isError ? (
        // This used to read "Payslips are restricted to payroll-authorised
        // roles" — a guess at the cause. Report the failure, not a theory.
        <ErrorState
          icon={Banknote}
          title="Payslips couldn’t be loaded"
          description="No payslip has been read, so this isn’t a statement that none exist."
          onRetry={() => void refetch()}
        />
      ) : isPending ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-16 animate-pulse rounded-lg bg-band/60" />
          <div className="h-40 animate-pulse rounded-lg bg-band/60" />
        </div>
      ) : (
        <div className="space-y-3">
          {payslips.length > 0 && (
            <dl className="grid gap-3 sm:grid-cols-3">
              <Fact
                surface="page"
                icon={Banknote}
                label="Last net pay"
                value={latest ? money(latest.netPay) : '—'}
                hint={latest ? periodLabel(latest) : 'Nothing finalised yet'}
              />
              <Fact
                surface="page"
                icon={ReceiptText}
                label={`Gross · ${year}`}
                value={money(ytd.gross)}
                hint={`${money(ytd.net)} net`}
              />
              <Fact
                surface="page"
                icon={Receipt}
                label={`Deducted · ${year}`}
                value={money(ytd.deductions)}
                hint={ytd.employer > 0 ? `+${money(ytd.employer)} employer` : 'From their pay'}
              />
            </dl>
          )}
          <RecordList>
            {payslips.length === 0 ? (
              <RecordListRow icon={ReceiptText} tone="muted" label="Issued from a pay run" placeholder="No payslips yet" />
            ) : (
              payslips.slice(0, 12).map((payslip) => (
                <PayslipRow
                  key={payslip.id}
                  payslip={payslip}
                  money={money}
                  open={open === payslip.id}
                  onToggle={() => setOpen((current) => (current === payslip.id ? null : payslip.id))}
                />
              ))
            )}
          </RecordList>
        </div>
      )}
    </RecordBlock>
  );
}

/** One payslip as an audit row that unfolds to its lines — what came off their pay, and what the business paid on top. */
function PayslipRow({
  payslip,
  money,
  open,
  onToggle,
}: {
  payslip: Payslip;
  money: (amount: string | number | null | undefined) => string;
  open: boolean;
  onToggle: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const lines = payslipDeductions(payslip);
  const employer = payslipEmployerLines(payslip);
  const deducted = lines.reduce((total, line) => total + line.amount, 0);
  const draft = payslip.status !== 'finalised';

  return (
    <li className="border-b border-rule/45 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className={cn(
          'flex w-full items-center gap-3 px-3.5 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
          open ? 'bg-band/50' : 'hover:bg-band/40',
        )}
      >
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', draft ? 'bg-measured/8 text-measured' : 'bg-momentum/8 text-momentum')}>
          <ReceiptText size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{periodLabel(payslip)}</span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            Gross {money(payslip.grossPay)} · {money(deducted)} deducted
          </span>
        </span>
        {draft && <span className="shrink-0 rounded-sm bg-measured/10 px-1.5 py-0.5 text-micro font-semibold text-measured">Draft</span>}
        <span className="shrink-0 text-right">
          <span className="block text-sm font-semibold text-foreground">{money(payslip.netPay)}</span>
          <span className="block text-xs text-muted-foreground">net</span>
        </span>
        <ChevronDown size={14} aria-hidden="true" className={cn('shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden bg-band/25"
          >
            <dl className="space-y-1.5 px-3.5 pt-2 pb-3 pl-15 text-sm">
              <Line label="Gross pay" value={money(payslip.grossPay)} strong />
              {lines.length === 0 ? (
                <Line label="No deductions" value="—" muted />
              ) : (
                lines.map((line) => <Line key={line.label} label={line.label} value={`− ${money(line.amount)}`} muted />)
              )}
              <div className="border-t border-rule/45 pt-1.5">
                <Line label="Net pay" value={money(payslip.netPay)} strong />
              </div>
              {employer.length > 0 && (
                <div className="pt-2">
                  <p className="text-label uppercase text-muted-foreground">Paid by the business on top</p>
                  <div className="mt-1 space-y-1.5">
                    {employer.map((line) => (
                      <Line key={line.label} label={line.label} value={money(line.amount)} muted />
                    ))}
                  </div>
                </div>
              )}
              {payslip.documentUrl && (
                <div className="pt-2">
                  <Button asChild variant="outline" size="sm">
                    <a href={payslip.documentUrl} download>
                      <Download data-icon="inline-start" />
                      Download payslip
                    </a>
                  </Button>
                </div>
              )}
            </dl>
          </motion.div>
        )}
      </AnimatePresence>
    </li>
  );
}

function Line({ label, value, strong, muted }: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className={cn(strong ? 'font-semibold text-foreground' : 'text-muted-foreground')}>{label}</dt>
      <dd className={cn(strong ? 'font-semibold text-foreground' : muted ? 'text-muted-foreground' : 'text-foreground')}>{value}</dd>
    </div>
  );
}

// ── Bank and statutory (money roles only) ────────────────────────────────────

/**
 * Where their pay goes, and the identifiers payroll needs. Stored encrypted and
 * masked; Reveal is a separate, audited request, and a copy button appears only
 * once the real value is on screen.
 */
export function BankTab({ userId, emp, onEdit }: { userId: string; emp: Employee; onEdit?: () => void }) {
  const [reveal, setReveal] = useState(false);
  const { country, uk } = usePayrollLocale();
  const idLabel = statutoryIdLabel(country);
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
  const hidden = bank?.hasBankDetails ? 'Hidden until revealed' : undefined;

  const actions = (
    <>
      <Button variant="ghost" size="sm" onClick={() => setReveal((current) => !current)}>
        {reveal ? <EyeOff data-icon="inline-start" /> : <Eye data-icon="inline-start" />}
        {reveal ? 'Hide' : 'Reveal'}
      </Button>
      {onEdit && (
        <Button variant="outline" size="sm" onClick={onEdit}>
          Edit
        </Button>
      )}
    </>
  );

  return (
    <motion.div variants={SECTION_RISE} className="flex flex-col gap-5">
      <RecordBlock id="record-bank" title="Bank details" action={actions} note="Stored encrypted. Revealing is a separate request, and it’s audited.">
        {isError ? (
          <ErrorState
            icon={Landmark}
            title="Bank details couldn’t be loaded"
            description="Nothing was read, so this isn’t a statement that none are held."
            onRetry={() => void refetch()}
          />
        ) : isPending ? (
          <div className="h-32 animate-pulse rounded-lg bg-band/60" aria-hidden="true" />
        ) : (
          <RecordList>
            <RecordListRow
              icon={UserRound}
              tone="money"
              label="Account holder"
              detail={bank?.bankName ?? undefined}
              value={bank?.accountHolder}
              missing="No bank details"
            />
            {/* The column is `sortCode`; outside the UK it holds the local bank or routing code. */}
            <RecordListRow
              icon={Landmark}
              tone="money"
              label={uk ? 'Sort code' : 'Bank code'}
              value={bank?.sortCode}
              placeholder={hidden ?? 'None on file'}
              trailing={reveal && bank?.sortCode && <CopyButton value={bank.sortCode} label={uk ? 'sort code' : 'bank code'} />}
            />
            <RecordListRow
              icon={KeyRound}
              tone="money"
              label="Account number"
              value={bank?.accountNumber}
              placeholder={hidden ?? 'None on file'}
              trailing={reveal && bank?.accountNumber && <CopyButton value={bank.accountNumber} label="account number" />}
            />
          </RecordList>
        )}
      </RecordBlock>

      <RecordBlock id="record-statutory" title="Tax & ID">
        <RecordList>
          <RecordListRow
            icon={Shield}
            tone="reference"
            label={idLabel}
            value={niDisplay}
            missing={emp.hasNiNumber ? undefined : 'Not recorded'}
            placeholder="Hidden until revealed"
            trailing={reveal && niDisplay && <CopyButton value={niDisplay} label={idLabel} />}
          />
          <RecordListRow icon={Receipt} tone="reference" label="Tax code" value={emp.taxCode} placeholder="Set by payroll" />
        </RecordList>
      </RecordBlock>
    </motion.div>
  );
}
