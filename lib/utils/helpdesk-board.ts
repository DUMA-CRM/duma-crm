/**
 * The helpdesk as a board: tickets sorted into workflow columns, each column in
 * the order a manager should work it. Pure, so the ordering rules are tested.
 */

export type BoardStatus = 'open' | 'in_progress' | 'waiting_employee' | 'resolved' | 'closed';
export type BoardPriority = 'urgent' | 'high' | 'normal' | 'low';

export interface BoardTicket {
  id: string;
  status: BoardStatus;
  priority: BoardPriority;
  createdAt: string;
  updatedAt: string;
  assignedTo?: string | null;
}

export interface BoardColumn<T> {
  key: 'open' | 'in_progress' | 'waiting_employee' | 'done';
  title: string;
  /** The status a card dropped here takes. */
  dropStatus: BoardStatus;
  tickets: T[];
}

const PRIORITY_RANK: Record<BoardPriority, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

/** A request untouched this long is going stale — the card says so. */
export const STALE_AFTER_DAYS = 3;
/** Done keeps only the latest, so a year of closed tickets doesn't bury the board. */
export const DONE_LIMIT = 20;

const COLUMNS: Omit<BoardColumn<never>, 'tickets'>[] = [
  { key: 'open', title: 'To do', dropStatus: 'open' },
  { key: 'in_progress', title: 'In progress', dropStatus: 'in_progress' },
  { key: 'waiting_employee', title: 'Waiting for reply', dropStatus: 'waiting_employee' },
  { key: 'done', title: 'Done', dropStatus: 'resolved' },
];

export function columnOf(status: BoardStatus): BoardColumn<never>['key'] {
  return status === 'resolved' || status === 'closed' ? 'done' : status;
}

/**
 * Open work: most urgent first, then the one that has waited longest.
 * Done: most recently finished first, capped at DONE_LIMIT.
 */
export function buildBoard<T extends BoardTicket>(tickets: readonly T[]): { columns: BoardColumn<T>[]; hiddenDone: number } {
  const columns = COLUMNS.map((column) => ({ ...column, tickets: [] as T[] }));
  for (const ticket of tickets) columns.find((column) => column.key === columnOf(ticket.status))!.tickets.push(ticket);
  let hiddenDone = 0;
  for (const column of columns) {
    if (column.key === 'done') {
      column.tickets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      hiddenDone = Math.max(0, column.tickets.length - DONE_LIMIT);
      column.tickets = column.tickets.slice(0, DONE_LIMIT);
    } else {
      column.tickets.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || a.createdAt.localeCompare(b.createdAt));
    }
  }
  return { columns, hiddenDone };
}

/** Whole days since the ticket last moved, and whether that's long enough to flag. */
export function ticketAge(ticket: Pick<BoardTicket, 'updatedAt' | 'status'>, now: number): { days: number; stale: boolean } {
  const days = Math.floor((now - new Date(ticket.updatedAt).getTime()) / 86_400_000);
  const open = ticket.status !== 'resolved' && ticket.status !== 'closed';
  return { days, stale: open && days >= STALE_AFTER_DAYS };
}
