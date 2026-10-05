'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useMemo, useState } from 'react';

import { CalendarDays, CircleHelp, Loader2, Lock, MessageSquarePlus, Search, Send, X } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type HelpdeskTicket,
  type TicketPriority,
  type TicketStatus,
  getTicket,
  replyTicket,
  updateTicket,
} from '@/lib/modules/support/client';
import { cn } from '@/lib/utils/cn';
import { type BoardColumn, buildBoard, ticketAge } from '@/lib/utils/helpdesk-board';
import { toast } from '@/stores/toastStore';

import {
  AuthorAvatar,
  CATEGORY_META,
  PRIORITY_META,
  PriorityTag,
  STATUS_ICON,
  STATUS_META,
  TICKET_CATEGORIES,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  fmtAgo,
  fmtWhen,
  isOpenStatus,
  ticketKey,
} from './shared';

export interface HelpdeskFilters {
  search: string;
  /** Kept for callers that filter server-side; the board itself shows every status as columns. */
  status: string;
  category: string;
}

const EMPTY_FILTERS: HelpdeskFilters = { search: '', status: '', category: '' };

const COLUMN_DOT: Record<BoardColumn<never>['key'], string> = {
  open: 'bg-muted-foreground/50',
  in_progress: 'bg-primary',
  waiting_employee: 'bg-measured',
  done: 'bg-momentum',
};

/**
 * The helpdesk. Managers get a board — To do, In progress, Waiting for reply,
 * Done — and move a request by dragging its card; an employee gets their own
 * requests as a short list. Either way one click opens the request in a side
 * panel: its fields once at the top, then the conversation, then the reply box.
 *
 * Status is shown once per view: the column on the board, the field in the
 * panel. Pass `filters`/`onFiltersChange` when the parent filters on the server.
 */
export function HelpdeskBoard({
  mode,
  tickets,
  loading = false,
  error = false,
  onRetry,
  selectedId,
  onSelect,
  onNew,
  newLabel = 'New request',
  filters,
  onFiltersChange,
  onChanged,
  emptyTitle = 'No requests',
  emptyDescription,
}: {
  mode: 'employee' | 'agent';
  tickets: HelpdeskTicket[];
  loading?: boolean;
  /** The list read failed. Distinct from an empty queue — say so, don't imply it. */
  error?: boolean;
  onRetry?: () => void;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onNew?: () => void;
  newLabel?: string;
  filters?: HelpdeskFilters;
  onFiltersChange?: (next: HelpdeskFilters) => void;
  /** Called after a reply or field change so the parent can refresh its own list query. */
  onChanged?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const isAgent = mode === 'agent';
  const controlled = !!filters && !!onFiltersChange;
  const [localFilters, setLocalFilters] = useState<HelpdeskFilters>(EMPTY_FILTERS);
  const active = filters ?? localFilters;
  const setFilters = (next: HelpdeskFilters) => (onFiltersChange ? onFiltersChange(next) : setLocalFilters(next));

  const visible = useMemo(() => {
    const needle = active.search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      // A controlled parent has already applied these on the server.
      if (controlled) return true;
      if (active.category && ticket.category !== active.category) return false;
      if (needle && !`${ticket.subject} ${ticketKey(ticket)}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [controlled, tickets, active]);

  const hasFilters = !!(active.search || active.category);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-56 flex-1">
          <Input
            value={active.search}
            onChange={(event) => setFilters({ ...active, search: event.target.value })}
            leftIcon={<Search size={14} />}
            placeholder={isAgent ? 'Search requests or people…' : 'Search your requests…'}
            aria-label="Search requests"
            rightAction={
              active.search ? (
                <button
                  type="button"
                  onClick={() => setFilters({ ...active, search: '' })}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : undefined
            }
          />
        </div>
        <Select
          value={active.category}
          onValueChange={(value) => setFilters({ ...active, category: value })}
          options={[
            { value: '', label: 'Every topic' },
            ...TICKET_CATEGORIES.map((value) => ({ value, label: CATEGORY_META[value].label })),
          ]}
          ariaLabel="Filter by topic"
          className="w-40"
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              setFilters({ ...active, search: '', category: '' });
            }}
          >
            <X size={14} /> Clear
          </Button>
        )}
        {onNew && (
          <Button onClick={onNew} className="ml-auto gap-1.5">
            <MessageSquarePlus size={15} /> {newLabel}
          </Button>
        )}
      </div>

      {loading ? (
        <div className={cn('grid gap-3', isAgent && 'md:grid-cols-2 xl:grid-cols-4')} aria-label="Loading requests">
          {Array.from({ length: isAgent ? 4 : 3 }, (_, index) => (
            <div key={index} className={cn('animate-pulse rounded-lg bg-band/60', isAgent ? 'h-72' : 'h-20')} />
          ))}
        </div>
      ) : error ? (
        <ErrorState
          icon={CircleHelp}
          title="Requests couldn’t be loaded"
          description="Nothing was read, so this is not an empty queue."
          onRetry={onRetry}
        />
      ) : isAgent ? (
        <Board tickets={visible} onOpen={onSelect} onChanged={onChanged} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CircleHelp}
          title={hasFilters ? 'No requests match' : emptyTitle}
          description={hasFilters ? 'Try clearing the search.' : emptyDescription}
        />
      ) : (
        <MyRequests tickets={visible} onOpen={onSelect} />
      )}

      {selectedId && (
        <TicketPanel key={selectedId} ticketId={selectedId} isAgent={isAgent} onClose={() => onSelect(null)} onChanged={onChanged} />
      )}
    </div>
  );
}

// ── Board (managers) ──────────────────────────────────────────────────────────

function Board({ tickets, onOpen, onChanged }: { tickets: HelpdeskTicket[]; onOpen: (id: string) => void; onChanged?: () => void }) {
  const qc = useQueryClient();
  const [dragging, setDragging] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const { columns, hiddenDone } = useMemo(() => buildBoard(tickets), [tickets]);

  // No optimistic move: the card stays put, marked busy, until the server agrees.
  const move = useMutation({
    mutationFn: ({ id, status }: { id: string; status: TicketStatus }) => updateTicket(id, { status }),
    onSuccess: (_, variables) => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.support.key('helpdesk-ticket', 'agent', variables.id) });
      onChanged?.();
      toast('success', `Moved to ${STATUS_META[variables.status].label.toLowerCase()}.`);
    },
    onError: (error) => toast('error', (error as Error).message || 'The request wasn’t moved. Try again.'),
  });

  return (
    <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((column) => (
        <section
          key={column.key}
          aria-label={column.title}
          onDragOver={(event) => {
            if (!dragging) return;
            event.preventDefault();
            setOver(column.key);
          }}
          onDragLeave={() => setOver((current) => (current === column.key ? null : current))}
          onDrop={(event) => {
            event.preventDefault();
            setOver(null);
            const id = event.dataTransfer.getData('text/plain');
            const ticket = tickets.find((item) => item.id === id);
            setDragging(null);
            if (ticket && column.tickets.every((item) => item.id !== id)) move.mutate({ id, status: column.dropStatus });
          }}
          className={cn(
            'flex min-h-40 flex-col rounded-lg border bg-band/40 p-2 transition-colors',
            over === column.key ? 'border-primary/50 bg-primary/5' : 'border-transparent',
          )}
        >
          <header className="flex items-center gap-2 px-2 pt-1 pb-2.5">
            <span className={cn('size-2 rounded-full', COLUMN_DOT[column.key])} aria-hidden="true" />
            <h3 className="text-sm font-semibold text-foreground">{column.title}</h3>
            <span className="rounded-sm bg-field px-1.5 text-xs font-semibold text-muted-foreground">
              {column.tickets.length + (column.key === 'done' ? hiddenDone : 0)}
            </span>
          </header>
          <ul className="space-y-2">
            {column.tickets.map((ticket, index) => (
              <TicketCard
                key={ticket.id}
                ticket={ticket}
                index={index}
                busy={move.isPending && move.variables?.id === ticket.id}
                onOpen={() => onOpen(ticket.id)}
                onDragStart={() => setDragging(ticket.id)}
                onDragEnd={() => {
                  setDragging(null);
                  setOver(null);
                }}
              />
            ))}
          </ul>
          {column.tickets.length === 0 && (
            <p className="mx-1 rounded-md border border-dashed border-rule/70 px-3 py-6 text-center text-xs text-muted-foreground">
              {dragging ? 'Drop here' : column.key === 'open' ? 'Nothing new' : 'Nothing here'}
            </p>
          )}
          {column.key === 'done' && hiddenDone > 0 && (
            <p className="px-2 pt-2 text-xs text-muted-foreground">+ {hiddenDone} older — search to find them</p>
          )}
        </section>
      ))}
    </div>
  );
}

function TicketCard({
  ticket,
  index,
  busy,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  ticket: HelpdeskTicket;
  index: number;
  busy: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const [now] = useState(() => Date.now());
  const age = ticketAge(ticket, now);
  const requester = ticket.employee?.name ?? ticket.employee?.email ?? 'Someone';

  return (
    <motion.li
      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : Math.min(index, 6) * 0.03, duration: 0.25 }}
    >
      <button
        type="button"
        draggable
        onDragStart={(event) => {
          event.dataTransfer.setData('text/plain', ticket.id);
          event.dataTransfer.effectAllowed = 'move';
          onDragStart();
        }}
        onDragEnd={onDragEnd}
        onClick={onOpen}
        className={cn(
          'group w-full cursor-grab rounded-md border border-rule/60 bg-field p-3 text-left shadow-xs transition-[border-color,box-shadow,opacity] hover:border-rule hover:shadow-sm active:cursor-grabbing',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
          busy && 'pointer-events-none opacity-50',
        )}
      >
        <p className="line-clamp-2 text-sm font-medium text-foreground">{ticket.subject}</p>
        <div className="mt-2.5 flex items-center gap-2">
          {/* Only when it changes what to do next — colour on a card means urgency, nothing else. */}
          {(ticket.priority === 'urgent' || ticket.priority === 'high') && <PriorityTag priority={ticket.priority} showLabel={false} />}
          <span className="rounded-sm bg-band px-1.5 py-0.5 font-sans text-xs font-medium text-muted-foreground">
            {CATEGORY_META[ticket.category].label}
          </span>
          <span
            className={cn('ml-auto text-xs', age.stale ? 'font-semibold text-exception' : 'text-muted-foreground')}
            title={`Updated ${fmtWhen(ticket.updatedAt)}`}
          >
            {age.days < 1 ? 'Today' : `${age.days}d`}
          </span>
        </div>
        <div className="mt-2.5 flex items-center gap-2 border-t border-rule/40 pt-2.5">
          <AuthorAvatar name={requester} size="sm" />
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{requester}</span>
          {busy ? <Loader2 size={13} className="animate-spin text-muted-foreground" aria-label="Moving" /> : null}
        </div>
      </button>
    </motion.li>
  );
}

// ── List (employees) ──────────────────────────────────────────────────────────

function MyRequests({ tickets, onOpen }: { tickets: HelpdeskTicket[]; onOpen: (id: string) => void }) {
  const open = tickets.filter((ticket) => isOpenStatus(ticket.status));
  const closed = tickets.filter((ticket) => !isOpenStatus(ticket.status));
  return (
    <div className="space-y-5">
      {[
        { title: 'Open', rows: open },
        { title: 'Finished', rows: closed },
      ]
        .filter((group) => group.rows.length > 0)
        .map((group) => (
          <section key={group.title}>
            <h3 className="mb-2 px-1 text-sm font-semibold text-foreground">{group.title}</h3>
            <ul className="space-y-2">
              {group.rows.map((ticket) => (
                <li key={ticket.id}>
                  <button
                    type="button"
                    onClick={() => onOpen(ticket.id)}
                    className="flex w-full items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3 text-left transition-colors hover:bg-band/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{ticket.subject}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {CATEGORY_META[ticket.category].label} · updated {fmtAgo(ticket.updatedAt)}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-md bg-band px-2 py-1 text-xs font-medium text-foreground">
                      {STATUS_META[ticket.status].label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  );
}

// ── The request, in a side panel ──────────────────────────────────────────────

function TicketPanel({
  ticketId,
  isAgent,
  onClose,
  onChanged,
}: {
  ticketId: string;
  isAgent: boolean;
  onClose: () => void;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const scope = isAgent ? 'agent' : 'employee';
  const [comment, setComment] = useState('');
  const [kind, setKind] = useState<'reply' | 'note'>('reply');

  const {
    data: ticket,
    isPending,
    isError,
    refetch,
  } = useQuery({
    queryKey: moduleQueryKeys.support.key('helpdesk-ticket', scope, ticketId),
    queryFn: () => getTicket(ticketId),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.support.key('helpdesk-ticket', scope, ticketId) });
    onChanged?.();
  }

  const note = isAgent && kind === 'note';
  const send = useMutation({
    mutationFn: () => replyTicket(ticketId, comment.trim(), note),
    onSuccess: () => {
      setComment('');
      refresh();
    },
    onError: (error) => toast('error', (error as Error).message || 'The message wasn’t sent. Try again.'),
  });
  const setField = useMutation({
    mutationFn: (data: { status?: TicketStatus; priority?: TicketPriority }) => updateTicket(ticketId, data),
    onSuccess: refresh,
    onError: (error) => toast('error', (error as Error).message || 'The request wasn’t updated. Try again.'),
  });

  const messages = ticket?.messages ?? [];
  const canComment = !!ticket && (isAgent || isOpenStatus(ticket.status));
  const requester = ticket?.employee?.name ?? ticket?.employee?.email ?? 'You';

  return (
    <Drawer
      title={ticket?.subject ?? 'Request'}
      description={
        ticket
          ? // The topic and date have their own fields below; this line only says who.
            `${ticketKey(ticket)} · from ${requester}`
          : undefined
      }
      onClose={onClose}
      footer={
        canComment ? (
          <div className="space-y-2">
            {isAgent && (
              <SegmentedControl
                options={[
                  { value: 'reply', label: `Reply to ${requester.split(' ')[0]}` },
                  { value: 'note', label: 'Private note', icon: Lock },
                ]}
                value={kind}
                onChange={setKind}
                ariaLabel="Message type"
              />
            )}
            <div
              className={cn(
                'rounded-lg border bg-background transition-colors',
                note ? 'border-measured/40 bg-measured/5' : 'border-input',
              )}
            >
              <textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder={note ? 'Only managers will see this…' : 'Write a message…'}
                rows={3}
                aria-label={note ? 'Private note' : 'Message'}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && comment.trim()) send.mutate();
                }}
                className="block w-full resize-none rounded-t-lg bg-transparent px-3 pt-3 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <div className="flex items-center justify-between gap-2 px-3 pb-2.5">
                <span className="text-xs text-muted-foreground">⌘ / Ctrl + Enter</span>
                <Button size="sm" onClick={() => send.mutate()} disabled={!comment.trim() || send.isPending} className="gap-1.5">
                  {send.isPending ? <Loader2 size={13} className="animate-spin" /> : note ? <Lock size={13} /> : <Send size={13} />}
                  {note ? 'Add note' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        ) : ticket ? (
          <p className="text-sm text-muted-foreground">
            This request is {STATUS_META[ticket.status].label.toLowerCase()}. Raise a new one if you still need help.
          </p>
        ) : undefined
      }
    >
      {isPending ? (
        <div className="flex justify-center py-16">
          <Loader2 className="animate-spin text-muted-foreground" />
        </div>
      ) : isError || !ticket ? (
        <ErrorState title="This request couldn’t be loaded" onRetry={() => void refetch()} />
      ) : (
        <div className="space-y-6">
          {/* The request's fields, once. */}
          <dl className="grid grid-cols-1 gap-x-4 gap-y-3.5 rounded-lg border border-rule/60 bg-field p-4 sm:grid-cols-2">
            <Property label="Status">
              {isAgent ? (
                <Select
                  value={ticket.status}
                  onValueChange={(value) => setField.mutate({ status: value as TicketStatus })}
                  options={TICKET_STATUSES.map((value) => ({
                    value,
                    label: STATUS_META[value].label,
                    icon: <StatusIcon status={value} />,
                  }))}
                  ariaLabel="Status"
                  className="w-full"
                  disabled={setField.isPending}
                />
              ) : (
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <StatusIcon status={ticket.status} /> {STATUS_META[ticket.status].label}
                </span>
              )}
            </Property>
            <Property label="Priority">
              {isAgent ? (
                <Select
                  value={ticket.priority}
                  onValueChange={(value) => setField.mutate({ priority: value as TicketPriority })}
                  options={TICKET_PRIORITIES.map((value) => ({
                    value,
                    label: PRIORITY_META[value].label,
                    icon: <PriorityIcon priority={value} />,
                  }))}
                  ariaLabel="Priority"
                  className="w-full"
                  disabled={setField.isPending}
                />
              ) : (
                <PriorityTag priority={ticket.priority} />
              )}
            </Property>
            <Property label="Raised">
              <span className="flex h-9 items-center gap-2 text-sm font-medium text-foreground" title={fmtWhen(ticket.createdAt)}>
                <CalendarDays size={14} className="text-muted-foreground" aria-hidden="true" /> {fmtWhen(ticket.createdAt)}
              </span>
            </Property>
          </dl>

          {/* The conversation — the first message is the request itself. */}
          <ol className="space-y-4" aria-label="Conversation">
            {messages.length === 0 && <li className="text-sm text-muted-foreground">No description was given.</li>}
            {messages.map((message, index) => (
              <li key={message.id} className="flex gap-3">
                <AuthorAvatar name={message.authorName} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">{message.authorName}</span>
                    <span className="text-xs text-muted-foreground" title={fmtWhen(message.createdAt)}>
                      {fmtAgo(message.createdAt)}
                    </span>
                    {index === 0 && <span className="text-xs text-muted-foreground">· raised the request</span>}
                    {message.internal && (
                      <span className="inline-flex items-center gap-1 rounded-sm bg-measured/10 px-1.5 py-0.5 font-sans text-xs font-semibold text-measured">
                        <Lock size={10} aria-hidden="true" /> Private note
                      </span>
                    )}
                  </p>
                  <div
                    className={cn(
                      'mt-1.5 rounded-lg px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap text-foreground',
                      message.internal ? 'border border-dashed border-measured/40 bg-measured/5' : 'bg-band/60',
                    )}
                  >
                    {message.body}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Drawer>
  );
}

function StatusIcon({ status }: { status: TicketStatus }) {
  const { icon: Icon, className } = STATUS_ICON[status];
  return <Icon size={14} className={className} aria-hidden="true" />;
}

function PriorityIcon({ priority }: { priority: TicketPriority }) {
  const { icon: Icon, className } = PRIORITY_META[priority];
  return <Icon size={14} className={className} aria-hidden="true" />;
}

function Property({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="mb-1 text-label uppercase text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}
