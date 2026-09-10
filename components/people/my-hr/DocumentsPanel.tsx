'use client';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { ChevronDown, FileText, Loader2, Wallet } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import type { HrEmployee } from '@/lib/api/hr.service';
import { type EmployeeDocument, type Payslip, getMyAttendance, getMyPayslips } from '@/lib/api/people-ops.service';
import { payVariesWithHours } from '@/lib/utils/my-hr';

import { PanelHeading } from './PanelHeading';
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
  onDataRequest,
}: {
  employee?: HrEmployee;
  documents: EmployeeDocument[];
  onDataRequest: () => void;
}) {
  return (
    <div className="space-y-6">
      {/* Two independent lists that are read, not worked through, so they sit
          side by side rather than stacking one below a fold. `items-start` keeps
          each as tall as its own contents. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <PayslipsSection employee={employee} />
        <DocumentsSection documents={documents} />
      </div>

      {/* The UK GDPR access right, exercised where the record lives. There is
          no staff privacy-request endpoint — `/privacy-requests` requires a
          `customerId` — so it raises a tagged helpdesk ticket, which gives HR
          an auditable trail and the employee a thread to follow. */}
      <p className="border-t border-rule pt-5 text-sm text-muted-foreground">
        Your employer also holds pay, attendance and leave records about you.{' '}
        <button type="button" onClick={onDataRequest} className="font-medium text-primary underline-offset-2 hover:underline">
          Ask for a copy of your data
        </button>
        .
      </p>
    </div>
  );
}

function PayslipsSection({ employee }: { employee?: HrEmployee }) {
  const {
    data: payslips = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({ queryKey: ['payslips-me'], queryFn: getMyPayslips, retry: false });
  const [openId, setOpenId] = useState<string | null>(null);
  const showHours = payVariesWithHours(employee);

  // Attendance backs the hours line that ERA s.9 requires for variable pay, and
  // is only fetched for the people it applies to, across the span the payslips
  // actually cover.
  const span = payslipSpan(payslips);
  const { data: attendance = [] } = useQuery({
    queryKey: ['attendance-me', span?.from, span?.to],
    queryFn: () => getMyAttendance(span!.from, span!.to),
    enabled: showHours && !!span,
  });

  return (
    <section className="space-y-4">
      <PanelHeading
        title="Payslips"
      />
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        // Until the rebuilt endpoint ships this read fails, and the empty
        // state below would tell an employee they have no payslips — a claim
        // about their pay that nothing has checked. Say what is true instead:
        // nothing could be read.
        <div className="rounded-md border border-rule bg-card shadow-sm">
          <ErrorState
            icon={Wallet}
            title="Your payslips couldn’t be loaded"
            description="This is not a statement that you have none. If you have been paid and nothing appears here, raise a payroll request."
            onRetry={() => void refetch()}
          />
        </div>
      ) : payslips.length === 0 ? (
        <div className="rounded-md border border-rule bg-card shadow-sm">
          <EmptyState
            icon={Wallet}
            title="No payslips yet"
            description="Payslips appear here once payroll has issued them. If you have been paid and nothing is listed, raise a payroll request."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {payslips.map((payslip) =>
            openId === payslip.id ? (
              <li key={payslip.id}>
                <PayslipStatement payslip={payslip} attendance={attendance} showHours={showHours} />
                <Button variant="ghost" size="sm" className="mt-1" onClick={() => setOpenId(null)}>
                  Close
                </Button>
              </li>
            ) : (
              <li key={payslip.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(payslip.id)}
                  className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-md border border-rule bg-card px-4 py-3 text-left shadow-sm transition-colors hover:bg-band/50 md:px-5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {fmt(payslip.payPeriodStart)} – {fmt(payslip.payPeriodEnd)}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {money(payslip.grossPay, payslip.currency)} gross · {money(payslip.taxDeducted, payslip.currency)} tax
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                      {money(payslip.netPay, payslip.currency)}
                    </span>
                    <ChevronDown size={15} className="text-muted-foreground" aria-hidden="true" />
                  </div>
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </section>
  );
}

/** The full range the payslips cover, so one attendance read serves them all. */
function payslipSpan(payslips: Payslip[]): { from: string; to: string } | null {
  if (payslips.length === 0) return null;
  const starts = payslips.map((p) => p.payPeriodStart.slice(0, 10)).sort();
  const ends = payslips.map((p) => p.payPeriodEnd.slice(0, 10)).sort();
  return { from: starts[0], to: ends[ends.length - 1] };
}

function DocumentsSection({ documents }: { documents: EmployeeDocument[] }) {
  // Read once on mount: a clock read during render is not idempotent, and an
  // expiry badge must not flicker between renders of the same list.
  const [now] = useState(() => Date.now());
  const cutoff = now + 60 * 86400000;

  return (
    <section className="space-y-4">
      {/* Requesting one is the header's primary action on this tab — a second
          button for the same thing is just another thing to read. */}
      <PanelHeading title="Documents" />
      {documents.length === 0 ? (
        <div className="rounded-md border border-rule bg-card shadow-sm">
          <EmptyState
            icon={FileText}
            title="No documents on file"
            description="You have a legal right to a written statement of your employment particulars. If you have never been given one, ask HR for a copy."
          />
        </div>
      ) : (
        <ul className="divide-y divide-rule overflow-hidden rounded-md border border-rule bg-card shadow-sm">
          {documents.map((document) => {
            const expiring = document.expiresAt && new Date(document.expiresAt).getTime() < cutoff;
            const expired = document.expiresAt && new Date(document.expiresAt).getTime() < now;
            return (
              <li key={document.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 md:px-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{document.title}</p>
                    {expiring && <Badge variant={expired ? 'destructive' : 'warning'}>{expired ? 'Expired' : 'Expiring'}</Badge>}
                  </div>
                  <p className="mt-0.5 text-sm capitalize text-muted-foreground">
                    {document.documentType}
                    {document.reference ? ` · ${document.reference}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-muted-foreground">
                  {document.expiresAt ? `Expires ${fmt(document.expiresAt)}` : document.issuedAt ? `Issued ${fmt(document.issuedAt)}` : ''}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
