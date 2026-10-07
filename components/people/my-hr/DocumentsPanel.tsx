'use client';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { ChevronDown, Download, FileText, Wallet } from '@/components/icons';
import { RecordBlock, RecordList, RecordListRow } from '@/components/people/record/shared';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { type Payslip, getMyPayslips } from '@/lib/modules/payroll/client';
import type { HrEmployee } from '@/lib/modules/people/client';
import { type EmployeeDocument, employeeDocumentDownloadUrl, getMyAttendance } from '@/lib/modules/people/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { payVariesWithHours } from '@/lib/utils/my-hr';

import { PayslipStatement } from './PayslipStatement';
import { fmt, money } from './shared';

/**
 * The record HR holds about you: the pay statements you are entitled to, and
 * the documents filed against your name. Both are things you look up rather
 * than act on, so they share a tab.
 */
export function DocumentsPanel({
  employee,
  documents,
  payrollEnabled,
  onDataRequest,
}: {
  employee?: HrEmployee;
  documents: EmployeeDocument[];
  payrollEnabled: boolean;
  onDataRequest: () => void;
}) {
  // The data-subject link closes whichever block is last, rather than floating under both.
  const dataNote = (
    <>
      Your employer also holds pay, attendance and leave records about you.{' '}
      <button type="button" onClick={onDataRequest} className="font-medium text-primary underline-offset-2 hover:underline">
        Ask for a copy of your data
      </button>
      .
    </>
  );

  return (
    <motion.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      {payrollEnabled ? (
        // Payslips are what people open this tab for, so they take the main column.
        <SettingsTabBody narrowAside aside={<DocumentsSection documents={documents} note={dataNote} />}>
          <PayslipsSection employee={employee} />
        </SettingsTabBody>
      ) : (
        <DocumentsSection documents={documents} note={dataNote} />
      )}
    </motion.div>
  );
}

function PayslipsSection({ employee }: { employee?: HrEmployee }) {
  const {
    data: payslips = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: moduleQueryKeys.payroll.key('payslips-me'), queryFn: getMyPayslips, retry: false });
  const [openId, setOpenId] = useState<string | null>(null);
  const showHours = payVariesWithHours(employee);

  // Attendance backs the hours line that ERA s.9 requires for variable pay, and
  // is only fetched for the people it applies to, across the span the payslips
  // actually cover.
  const span = payslipSpan(payslips);
  const { data: attendance = [] } = useQuery({
    queryKey: moduleQueryKeys.people.key('attendance-me', span?.from, span?.to),
    queryFn: () => getMyAttendance(span!.from, span!.to),
    enabled: showHours && !!span,
  });

  const open = payslips.find((payslip) => payslip.id === openId);

  return (
    <RecordBlock id="my-payslips" title="Payslips">
      {isLoading ? (
        <ListSkeleton rows={3} label="Loading your payslips" />
      ) : isError ? (
        // A failed read is not "you have none" — that would be a claim about
        // someone's pay that nothing has checked. Say what is true instead.
        <div className="rounded-lg border border-rule/60 bg-card">
          <ErrorState
            icon={Wallet}
            title="Your payslips couldn’t be loaded"
            description="This is not a statement that you have none. If you have been paid and nothing appears here, raise a payroll request."
            onRetry={() => void refetch()}
          />
        </div>
      ) : (
        <>
          <RecordList>
            {payslips.length === 0 ? (
              <RecordListRow icon={Wallet} tone="muted" label="They appear here once payroll issues them" placeholder="No payslips yet" />
            ) : (
              payslips.map((payslip) => (
                <RecordListRow
                  key={payslip.id}
                  icon={Wallet}
                  tone="money"
                  value={`${fmt(payslip.payPeriodStart)} – ${fmt(payslip.payPeriodEnd)}`}
                  label={`${money(payslip.grossPay, payslip.currency)} gross · ${money(payslip.employeeDeductions ?? payslip.taxDeducted, payslip.currency)} deductions`}
                  trailing={
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                        {money(payslip.netPay, payslip.currency)}
                      </span>
                      <ChevronDown
                        size={14}
                        className={cn('transition-transform', openId === payslip.id && 'rotate-180')}
                        aria-hidden="true"
                      />
                    </span>
                  }
                  onSelect={() => setOpenId((current) => (current === payslip.id ? null : payslip.id))}
                />
              ))
            )}
          </RecordList>
          {open && (
            <div className="mt-3">
              <PayslipStatement payslip={open} attendance={attendance} showHours={showHours} />
              <Button variant="ghost" size="sm" className="mt-1" onClick={() => setOpenId(null)}>
                Close payslip
              </Button>
            </div>
          )}
        </>
      )}
    </RecordBlock>
  );
}

/** The full range the payslips cover, so one attendance read serves them all. */
function payslipSpan(payslips: Payslip[]): { from: string; to: string } | null {
  if (payslips.length === 0) return null;
  const starts = payslips.map((p) => p.payPeriodStart.slice(0, 10)).sort();
  const ends = payslips.map((p) => p.payPeriodEnd.slice(0, 10)).sort();
  return { from: starts[0], to: ends[ends.length - 1] };
}

function DocumentsSection({ documents, note }: { documents: EmployeeDocument[]; note: React.ReactNode }) {
  // Read once on mount: a clock read during render is not idempotent, and an
  // expiry pill must not flicker between renders of the same list.
  const [now] = useState(() => Date.now());
  const cutoff = now + 60 * 86400000;

  return (
    // Requesting one is the header's primary action on this tab, so no second button here.
    <RecordBlock id="my-documents" title="Documents" note={note}>
      <RecordList>
        {documents.length === 0 ? (
          <RecordListRow
            icon={FileText}
            tone="muted"
            label="You’re entitled to a written statement of your employment terms — ask HR if you’ve never had one"
            placeholder="No documents on file"
          />
        ) : (
          documents.map((document) => {
            const expires = document.expiresAt ? new Date(document.expiresAt).getTime() : null;
            const expired = expires !== null && expires < now;
            const expiring = expires !== null && expires < cutoff;
            return (
              <RecordListRow
                key={document.id}
                icon={FileText}
                tone="reference"
                value={document.title}
                label={capitalise(document.documentType) + (document.reference ? ` · ${document.reference}` : '')}
                detail={
                  document.expiresAt
                    ? `${expired ? 'expired' : 'expires'} ${fmt(document.expiresAt)}`
                    : document.issuedAt
                      ? `issued ${fmt(document.issuedAt)}`
                      : undefined
                }
                pill={expiring ? { label: expired ? 'Expired' : 'Expiring', tone: expired ? 'exception' : 'warning' } : undefined}
                trailing={
                  document.hasFile ? (
                    <Button asChild variant="ghost" size="sm">
                      <a href={employeeDocumentDownloadUrl(document.id)} download aria-label={`Download ${document.title}`}>
                        <Download data-icon="inline-start" />
                        Download
                      </a>
                    </Button>
                  ) : undefined
                }
              />
            );
          })
        )}
      </RecordList>
    </RecordBlock>
  );
}

const capitalise = (value: string) => value.charAt(0).toUpperCase() + value.slice(1).replaceAll('_', ' ');
