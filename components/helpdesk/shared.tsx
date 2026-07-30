import { ChevronDown, ChevronUp, ChevronsUp, Equal, type LucideIcon } from 'lucide-react';

import type { HelpdeskTicket, TicketCategory, TicketPriority, TicketStatus } from '@/lib/api/people-ops.service';
import { cn } from '@/lib/utils/cn';

// ── Status ────────────────────────────────────────────────────────────────────
// Statuses group into the three workflow columns an issue tracker shows (to do,
// in progress, done) — the group drives the lozenge colour, the label stays ours.

export type StatusGroup = 'todo' | 'progress' | 'done';

export const TICKET_STATUSES: TicketStatus[] = ['open', 'in_progress', 'waiting_employee', 'resolved', 'closed'];

export const STATUS_META: Record<TicketStatus, { label: string; group: StatusGroup; lozenge: string }> = {
  open: { label: 'To do', group: 'todo', lozenge: 'bg-muted text-muted-foreground' },
  in_progress: { label: 'In progress', group: 'progress', lozenge: 'bg-info/15 text-info' },
  waiting_employee: { label: 'Waiting for reply', group: 'progress', lozenge: 'bg-warning/15 text-warning' },
  resolved: { label: 'Resolved', group: 'done', lozenge: 'bg-success/15 text-success' },
  closed: { label: 'Closed', group: 'done', lozenge: 'bg-surface-offset text-muted-foreground' },
};

export const isOpenStatus = (status: TicketStatus) => STATUS_META[status].group !== 'done';

/** Uppercase status chip — the lozenge an issue tracker puts next to a key. */
export function StatusLozenge({ status, className }: { status: TicketStatus; className?: string }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center rounded px-1.5 text-[11px] font-bold uppercase tracking-wide whitespace-nowrap',
        meta.lozenge,
        className,
      )}
    >
      {meta.label}
    </span>
  );
}

// ── Priority ──────────────────────────────────────────────────────────────────

export const TICKET_PRIORITIES: TicketPriority[] = ['urgent', 'high', 'normal', 'low'];

export const PRIORITY_META: Record<TicketPriority, { label: string; icon: LucideIcon; className: string }> = {
  urgent: { label: 'Urgent', icon: ChevronsUp, className: 'text-destructive' },
  high: { label: 'High', icon: ChevronUp, className: 'text-warning' },
  normal: { label: 'Normal', icon: Equal, className: 'text-info' },
  low: { label: 'Low', icon: ChevronDown, className: 'text-muted-foreground' },
};

export function PriorityTag({ priority, showLabel = true }: { priority: TicketPriority; showLabel?: boolean }) {
  const meta = PRIORITY_META[priority];
  const Icon = meta.icon;
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs font-medium', meta.className)} title={`${meta.label} priority`}>
      <Icon size={14} aria-hidden="true" />
      {showLabel ? meta.label : <span className="sr-only">{meta.label} priority</span>}
    </span>
  );
}

// ── Category ──────────────────────────────────────────────────────────────────

export const TICKET_CATEGORIES: TicketCategory[] = ['hr', 'payroll', 'scheduling', 'leave', 'workplace', 'it', 'other'];

export const CATEGORY_META: Record<TicketCategory, { label: string; prefix: string }> = {
  hr: { label: 'HR', prefix: 'HR' },
  payroll: { label: 'Payroll', prefix: 'PAY' },
  scheduling: { label: 'Scheduling', prefix: 'SCH' },
  leave: { label: 'Leave', prefix: 'LVE' },
  workplace: { label: 'Workplace', prefix: 'WRK' },
  it: { label: 'IT', prefix: 'IT' },
  other: { label: 'Other', prefix: 'GEN' },
};

/**
 * Short human-readable key for a ticket, e.g. `PAY-4F9C`. The API has no ticket
 * number, so it is derived from the category and the tail of the id — stable for
 * the life of the ticket and short enough to read out over the phone.
 */
export function ticketKey(ticket: Pick<HelpdeskTicket, 'id' | 'category'>): string {
  const tail = ticket.id.replace(/[^a-z0-9]/gi, '').slice(-4).toUpperCase();
  return `${CATEGORY_META[ticket.category].prefix}-${tail || '0000'}`;
}

// ── Dates ─────────────────────────────────────────────────────────────────────

export const fmtWhen = (iso: string) => new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });

export function fmtAgo(iso: string): string {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`;
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── Author avatar ─────────────────────────────────────────────────────────────

const AVATAR_TINTS = [
  'bg-primary/15 text-primary',
  'bg-info/15 text-info',
  'bg-success/15 text-success',
  'bg-warning/15 text-warning',
  'bg-destructive/15 text-destructive',
];

/** Deterministic initials bubble for a comment author. */
export function AuthorAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const initials = (parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1][0]}` : (parts[0] ?? '?').slice(0, 2)).toUpperCase();
  const tint = AVATAR_TINTS[[...name].reduce((sum, char) => sum + char.charCodeAt(0), 0) % AVATAR_TINTS.length];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full font-bold select-none',
        size === 'sm' ? 'size-6 text-[10px]' : 'size-8 text-xs',
        tint,
      )}
    >
      {initials}
    </span>
  );
}
