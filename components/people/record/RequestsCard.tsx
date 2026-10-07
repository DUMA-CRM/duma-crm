'use client';

import Link from 'next/link';

import { STATUS_ICON, STATUS_META, fmtAgo, ticketKey } from '@/components/helpdesk/shared';
import { ChevronRight, CircleHelp } from '@/components/icons';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';

import type { HelpdeskTicket, TicketStatus } from '@/lib/modules/people/client';
import { openTicketsFor, recordRequestList } from '@/lib/utils/employee-record';

import { RecordBlock, RecordList, RecordListRow } from './shared';

/** A ticket's status as the row's tint and pill — waiting on them is the one that wants attention. */
const STATUS_ROW: Record<
  TicketStatus,
  { tone: 'team' | 'money' | 'reference' | 'muted'; pill: 'success' | 'warning' | 'exception' | null }
> = {
  open: { tone: 'reference', pill: null },
  in_progress: { tone: 'team', pill: null },
  waiting_employee: { tone: 'money', pill: 'warning' },
  resolved: { tone: 'muted', pill: 'success' },
  closed: { tone: 'muted', pill: null },
};

/**
 * What this employee has asked HR, drawn as audit-log rows: the status icon in
 * its tile, the subject, the ticket key and age, and each row opens that
 * ticket on the helpdesk board.
 *
 * Deliberately a summary, not a second helpdesk: open ones first, then the
 * newest closed.
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
  const open = tickets ? openTicketsFor(tickets).length : 0;
  const shown = tickets ? recordRequestList(tickets) : [];
  const more = tickets ? tickets.length - shown.length : 0;

  return (
    <RecordBlock
      id="record-requests"
      title="Requests"
      action={
        <>
          {open > 0 && <Badge variant="warning">{open} open</Badge>}
          <Link
            href="/staff/helpdesk"
            className="flex items-center gap-0.5 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Helpdesk
            <ChevronRight size={13} aria-hidden="true" />
          </Link>
        </>
      }
      note={
        more > 0 && (
          <Link href="/staff/helpdesk" className="font-semibold hover:text-foreground">
            {more} older {more === 1 ? 'request' : 'requests'} on the helpdesk
          </Link>
        )
      }
    >
      {error ? (
        <ErrorState
          icon={CircleHelp}
          title="Requests couldn’t be loaded"
          description="Nothing was read, so this is not an empty history."
          onRetry={onRetry}
        />
      ) : loading ? (
        <ListSkeleton rows={3} label="Loading requests" />
      ) : (
        <RecordList>
          {shown.length === 0 ? (
            <RecordListRow icon={CircleHelp} tone="muted" label="Helpdesk" placeholder="They haven’t raised anything with HR" />
          ) : (
            shown.map((ticket) => {
              const row = STATUS_ROW[ticket.status];
              return (
                <RecordListRow
                  key={ticket.id}
                  href={`/staff/helpdesk?ticket=${ticket.id}`}
                  icon={STATUS_ICON[ticket.status].icon}
                  tone={row.tone}
                  value={ticket.subject}
                  label={ticketKey(ticket)}
                  detail={fmtAgo(ticket.createdAt)}
                  pill={row.pill ? { label: STATUS_META[ticket.status].label, tone: row.pill } : undefined}
                  trailing={row.pill ? undefined : STATUS_META[ticket.status].label}
                />
              );
            })
          )}
        </RecordList>
      )}
    </RecordBlock>
  );
}
