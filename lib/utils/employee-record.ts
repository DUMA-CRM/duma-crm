// ---------------------------------------------------------------------------
// What the employee record should put in front of a manager first.
//
// The record used to open on all six compliance checks at once, each with a
// badge — so a complete record spent its most valuable space showing six green
// "Ready" pills. This decides what actually needs someone, in the same shape
// My HR and the staff overview use.
//
// Pure, so the rules about somebody's employment can be tested without a
// browser. → UI-ADR-007
// ---------------------------------------------------------------------------

import type { ComplianceCheck } from '@/lib/utils/employee-compliance';
import type { HelpdeskTicket } from '@/lib/api/people-ops.service';

export type RecordAttentionSeverity = 'blocking' | 'attention' | 'info';

export interface RecordAttentionItem {
  id: string;
  severity: RecordAttentionSeverity;
  title: string;
  detail: string;
  actionLabel: string;
  /** Which part of the record resolves it. */
  target: 'edit' | 'documents' | 'access' | 'requests' | 'pay';
}

/**
 * A completed check says nothing, so it contributes no row.
 *
 * `destructive` is reserved in `employeeSetupChecks` for the two things that
 * carry legal exposure — expired right-to-work evidence, and a rate below the
 * age-based National Minimum Wage — so it maps to `blocking` rather than
 * merely urgent.
 */
const TONE_SEVERITY: Record<ComplianceCheck['tone'], RecordAttentionSeverity | null> = {
  destructive: 'blocking',
  warning: 'attention',
  muted: 'info',
  success: null,
};

/** Where each check is fixed. A check with nowhere to go is not actionable. */
const CHECK_TARGET: Record<string, RecordAttentionItem['target']> = {
  profile: 'edit',
  'right-to-work': 'documents',
  contract: 'documents',
  pay: 'edit',
  statutory: 'edit',
  access: 'access',
};

const ACTION_LABEL: Record<RecordAttentionItem['target'], string> = {
  edit: 'Edit details',
  documents: 'Open documents',
  access: 'Review access',
  requests: 'Open requests',
  pay: 'Open pay',
};

/** A ticket left this long without a reply has been forgotten. */
export const TICKET_STALE_DAYS = 7;

const daysSince = (iso: string, now: Date) => Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);

/** This employee's tickets, newest first — the managed queue has no user filter. */
export const ticketsForEmployee = (tickets: HelpdeskTicket[], userId: string): HelpdeskTicket[] =>
  tickets.filter((ticket) => ticket.createdBy === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

export const openTicketsFor = (tickets: HelpdeskTicket[]): HelpdeskTicket[] =>
  tickets.filter((ticket) => ticket.status !== 'resolved' && ticket.status !== 'closed');

export interface RecordAttentionInput {
  now: Date;
  checks?: ComplianceCheck[];
  /** Already narrowed to this employee. */
  tickets?: HelpdeskTicket[];
}

/**
 * Build the record's attention list, worst first.
 *
 * Every input is optional because the panel is assembled per capability: a
 * reader without `hr.documents:read` never fetches documents, and a row about
 * them must be absent rather than reassuring.
 */
export function buildRecordAttention({ now, checks, tickets }: RecordAttentionInput): RecordAttentionItem[] {
  const items: RecordAttentionItem[] = [];

  for (const check of checks ?? []) {
    if (check.complete) continue;
    const severity = TONE_SEVERITY[check.tone];
    if (!severity) continue;
    const target = CHECK_TARGET[check.id] ?? 'edit';
    items.push({
      id: `check-${check.id}`,
      severity,
      title: check.label,
      detail: check.detail,
      actionLabel: ACTION_LABEL[target],
      target,
    });
  }

  const open = tickets ? openTicketsFor(tickets) : [];

  // A request the employee has to answer is blocking *them*, and a manager
  // looking at the record is the person who can unblock it.
  const waiting = open.filter((ticket) => ticket.status === 'waiting_employee');
  if (waiting.length) {
    items.push({
      id: 'tickets-waiting-employee',
      severity: 'attention',
      title: `${waiting.length === 1 ? 'A request is' : `${waiting.length} requests are`} waiting on this employee`,
      detail: waiting[0].subject,
      actionLabel: ACTION_LABEL.requests,
      target: 'requests',
    });
  }

  const stale = open.filter((ticket) => ticket.status !== 'waiting_employee' && daysSince(ticket.createdAt, now) >= TICKET_STALE_DAYS);
  if (stale.length) {
    items.push({
      id: 'tickets-stale',
      severity: 'attention',
      title: `${stale.length} ${stale.length === 1 ? 'request has' : 'requests have'} been open over a week`,
      detail: stale[0].subject,
      actionLabel: ACTION_LABEL.requests,
      target: 'requests',
    });
  }

  const ORDER: Record<RecordAttentionSeverity, number> = { blocking: 0, attention: 1, info: 2 };
  return items.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
}
