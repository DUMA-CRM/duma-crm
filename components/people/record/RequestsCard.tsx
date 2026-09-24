'use client';

import Link from 'next/link';

import { ArrowRight, CircleHelp } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { Badge } from '@/components/ui/badge';

import type { HelpdeskTicket } from '@/lib/modules/people/client';
import { formatDate } from '@/lib/utils/date';
import { openTicketsFor } from '@/lib/utils/employee-record';

import { DetailCard } from './OverviewSection';

const STATUS_TONE: Record<string, 'warning' | 'success' | 'muted'> = {
  open: 'warning',
  in_progress: 'warning',
  waiting_employee: 'warning',
  resolved: 'success',
  closed: 'muted',
};

/**
 * What this employee has asked HR, on the record rather than only in the
 * helpdesk queue. My HR gives the employee a Requests tab; a manager reviewing
 * them could previously see none of it without going to the queue and
 * searching by name.
 *
 * Deliberately a summary, not a second helpdesk: the newest few, and a way
 * through to the real board.
 */
export function EmployeeRequestsCard({
  tickets,
  loading,
  error,
  onRetry,
}: {
  tickets?: HelpdeskTicket[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const open = tickets ? openTicketsFor(tickets) : [];

  return (
    <DetailCard
      title="Requests"
      description={tickets && !error ? `${open.length} open · ${tickets.length} in total` : undefined}
      action={
        <Link href="/staff/helpdesk" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary-hover">
          Helpdesk <ArrowRight size={13} aria-hidden="true" />
        </Link>
      }
    >
      {error ? (
        <ErrorState
          icon={CircleHelp}
          title="Requests couldn’t be loaded"
          description="Nothing was read, so this is not an empty history."
          onRetry={onRetry}
          className="py-6"
        />
      ) : loading ? (
        <div className="h-16 animate-pulse rounded-sm bg-band" aria-hidden="true" />
      ) : !tickets || tickets.length === 0 ? (
        <EmptyState icon={CircleHelp} title="No requests" description="This employee hasn’t raised anything with HR." />
      ) : (
        <ul className="divide-y divide-rule/45">
          {tickets.slice(0, 5).map((ticket) => (
            <li key={ticket.id} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{ticket.subject}</span>
                <span className="block truncate text-xs text-muted-foreground">{formatDate(ticket.createdAt)}</span>
              </span>
              <Badge variant={STATUS_TONE[ticket.status] ?? 'muted'}>{ticket.status.replaceAll('_', ' ')}</Badge>
            </li>
          ))}
        </ul>
      )}
    </DetailCard>
  );
}
