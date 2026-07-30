'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, CircleHelp, Loader2, Lock, MessageSquarePlus, Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type HelpdeskTicket,
  type TicketPriority,
  type TicketStatus,
  getTicket,
  replyTicket,
  updateTicket,
} from '@/lib/api/people-ops.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';

import {
  AuthorAvatar,
  CATEGORY_META,
  PRIORITY_META,
  PriorityTag,
  STATUS_META,
  StatusLozenge,
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
  status: string;
  category: string;
}

const EMPTY_FILTERS: HelpdeskFilters = { search: '', status: '', category: '' };

/**
 * Issue-tracker layout for helpdesk tickets: a filterable queue on the left, the
 * selected ticket on the right with its description, activity feed and a details
 * field panel.
 *
 * `mode` decides what the viewer may do — an employee reads their own tickets and
 * comments on them; an agent also moves the status, sets priority and can leave
 * private notes. Pass `filters`/`onFiltersChange` when the parent filters
 * server-side (the managed queue); leave them out and the board filters the list
 * it was given.
 */
export function HelpdeskBoard({
  mode,
  tickets,
  loading = false,
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

  // A controlled parent has already applied the filters on the server.
  const visible = useMemo(() => {
    if (controlled) return tickets;
    const needle = active.search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (active.status && ticket.status !== active.status) return false;
      if (active.category && ticket.category !== active.category) return false;
      if (needle && !`${ticket.subject} ${ticketKey(ticket)}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [controlled, tickets, active]);

  const hasFilters = !!(active.search || active.status || active.category);

  return (
    <div className="flex min-h-0 flex-1">
      {/* Queue */}
      <aside
        className={cn(
          'w-full min-w-0 flex-col border-border bg-card lg:flex lg:w-88 lg:shrink-0 lg:border-r',
          selectedId ? 'hidden' : 'flex',
        )}
      >
        <div className="shrink-0 border-b border-border px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {visible.length} {visible.length === 1 ? 'request' : 'requests'}
            </p>
            {onNew && (
              <Button size="sm" onClick={onNew} className="gap-1.5">
                <MessageSquarePlus size={14} /> {newLabel}
              </Button>
            )}
          </div>
          <div className="mt-2.5 space-y-2">
            <Input
              value={active.search}
              onChange={(event) => setFilters({ ...active, search: event.target.value })}
              leftIcon={<Search size={14} />}
              placeholder={isAgent ? 'Search employee or subject…' : 'Search your requests…'}
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
            <div className="flex gap-2">
              <Select
                value={active.status}
                onValueChange={(value) => setFilters({ ...active, status: value })}
                options={[
                  { value: '', label: 'All statuses' },
                  ...TICKET_STATUSES.map((value) => ({ value, label: STATUS_META[value].label })),
                ]}
                ariaLabel="Filter by status"
                className="flex-1"
              />
              <Select
                value={active.category}
                onValueChange={(value) => setFilters({ ...active, category: value })}
                options={[
                  { value: '', label: 'All categories' },
                  ...TICKET_CATEGORIES.map((value) => ({ value, label: CATEGORY_META[value].label })),
                ]}
                ariaLabel="Filter by category"
                className="flex-1"
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : visible.length === 0 ? (
            <div className="px-4 py-12">
              <EmptyState
                icon={CircleHelp}
                title={hasFilters ? 'No matching requests' : emptyTitle}
                description={hasFilters ? 'Try clearing the filters above.' : emptyDescription}
              />
            </div>
          ) : (
            visible.map((ticket) => {
              const selected = ticket.id === selectedId;
              return (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => onSelect(ticket.id)}
                  className={cn(
                    'w-full border-b border-border/60 px-4 py-3 text-left transition-colors last:border-0',
                    selected ? 'border-l-2 border-l-primary bg-primary/5 pl-3.5' : 'hover:bg-surface-offset/50',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] font-bold text-muted-foreground">{ticketKey(ticket)}</span>
                    <PriorityTag priority={ticket.priority} showLabel={false} />
                    <StatusLozenge status={ticket.status} className="ml-auto" />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-foreground">{ticket.subject}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {isAgent && ticket.employee ? `${ticket.employee.name ?? ticket.employee.email} · ` : ''}
                    {CATEGORY_META[ticket.category].label} · {fmtAgo(ticket.updatedAt)}
                  </p>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Selected ticket */}
      <section className={cn('min-w-0 flex-1 flex-col lg:flex', selectedId ? 'flex' : 'hidden')}>
        {selectedId ? (
          <TicketView key={selectedId} ticketId={selectedId} isAgent={isAgent} onBack={() => onSelect(null)} onChanged={onChanged} />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8">
            <EmptyState
              icon={CircleHelp}
              title="Select a request"
              description="Pick a request from the queue to read its history, add a comment and see its details."
            />
          </div>
        )}
      </section>
    </div>
  );
}

// ── One ticket: description, activity, details panel ──────────────────────────

function TicketView({
  ticketId,
  isAgent,
  onBack,
  onChanged,
}: {
  ticketId: string;
  isAgent: boolean;
  onBack: () => void;
  onChanged?: () => void;
}) {
  const qc = useQueryClient();
  const scope = isAgent ? 'agent' : 'employee';
  const [comment, setComment] = useState('');
  const [internal, setInternal] = useState(false);

  const { data: ticket, isLoading } = useQuery({
    queryKey: ['helpdesk-ticket', scope, ticketId],
    queryFn: () => getTicket(ticketId),
  });

  function refresh() {
    void qc.invalidateQueries({ queryKey: ['helpdesk-ticket', scope, ticketId] });
    onChanged?.();
  }

  const send = useMutation({
    mutationFn: () => replyTicket(ticketId, comment.trim(), isAgent && internal),
    onSuccess: () => {
      setComment('');
      refresh();
    },
    onError: (error) => toast('error', (error as Error).message || 'Failed to add the comment.'),
  });

  const setField = useMutation({
    mutationFn: (data: { status?: TicketStatus; priority?: TicketPriority }) => updateTicket(ticketId, data),
    onSuccess: () => {
      refresh();
      toast('success', 'Request updated.');
    },
    onError: (error) => toast('error', (error as Error).message || 'Failed to update the request.'),
  });

  if (isLoading || !ticket) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  const messages = ticket.messages ?? [];
  const [description, ...activity] = messages;
  const canComment = isAgent || isOpenStatus(ticket.status);

  return (
    <>
      {/* Issue header */}
      <div className="shrink-0 border-b border-border bg-card px-4 py-4 md:px-6">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2 gap-1.5 lg:hidden">
            <ArrowLeft size={14} /> Queue
          </Button>
          <span className="hidden lg:inline">{CATEGORY_META[ticket.category].label}</span>
          <span className="hidden lg:inline" aria-hidden="true">
            /
          </span>
          <span className="font-mono font-bold text-foreground">{ticketKey(ticket)}</span>
        </div>
        <h2 className="mt-1.5 text-xl font-semibold text-foreground">{ticket.subject}</h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isAgent ? (
            <Select
              value={ticket.status}
              onValueChange={(value) => setField.mutate({ status: value as TicketStatus })}
              options={TICKET_STATUSES.map((value) => ({ value, label: STATUS_META[value].label }))}
              ariaLabel="Request status"
              className="w-44"
            />
          ) : (
            <StatusLozenge status={ticket.status} />
          )}
          <PriorityTag priority={ticket.priority} />
          <span className="text-xs text-muted-foreground">Updated {fmtAgo(ticket.updatedAt)}</span>
        </div>
      </div>

      {/* Body: content + details panel */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid items-start gap-5 p-4 md:p-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="min-w-0 space-y-5">
            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</h3>
              <div className="mt-2 rounded-xl border border-border bg-card p-4">
                {description ? (
                  <p className="whitespace-pre-wrap text-sm text-foreground">{description.body}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">No description was given.</p>
                )}
                {description && (
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    {description.authorName} · {fmtWhen(description.createdAt)}
                  </p>
                )}
              </div>
            </section>

            <section>
              <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Activity {activity.length > 0 && <span className="text-muted-foreground/70">({activity.length})</span>}
              </h3>
              {activity.length === 0 ? (
                <p className="mt-2 text-sm text-muted-foreground">No comments yet.</p>
              ) : (
                <ol className="mt-3 space-y-4">
                  {activity.map((message) => (
                    <li key={message.id} className="flex gap-3">
                      <AuthorAvatar name={message.authorName} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{message.authorName}</span>
                          <span className="text-[11px] text-muted-foreground">{fmtAgo(message.createdAt)}</span>
                          {message.internal && (
                            <span className="inline-flex h-5 items-center gap-1 rounded bg-warning/15 px-1.5 text-[10px] font-bold uppercase tracking-wide text-warning">
                              <Lock size={10} aria-hidden="true" /> Internal
                            </span>
                          )}
                        </div>
                        <div
                          className={cn(
                            'mt-1.5 rounded-xl border p-3 text-sm whitespace-pre-wrap',
                            message.internal ? 'border-warning/30 bg-warning/5' : 'border-border bg-card',
                          )}
                        >
                          {message.body}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}

              {canComment ? (
                <div className="mt-4">
                  <textarea
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder={internal ? 'Add a private note for HR…' : 'Add a comment…'}
                    rows={3}
                    onKeyDown={(event) => {
                      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && comment.trim()) send.mutate();
                    }}
                    className="w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none transition-[border-color,box-shadow] duration-150 focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                    {isAgent ? (
                      <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                        <input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />
                        Private note — the employee cannot see this
                      </label>
                    ) : (
                      <span className="text-xs text-muted-foreground">⌘/Ctrl + Enter to send</span>
                    )}
                    <Button onClick={() => send.mutate()} disabled={!comment.trim() || send.isPending} className="gap-1.5">
                      {send.isPending && <Loader2 size={14} className="animate-spin" />}
                      {internal ? 'Add note' : 'Comment'}
                    </Button>
                  </div>
                </div>
              ) : (
                <p className="mt-4 rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  This request is {STATUS_META[ticket.status].label.toLowerCase()}. Raise a new request if you still need help.
                </p>
              )}
            </section>
          </div>

          {/* Details panel */}
          <aside className="rounded-xl border border-border bg-card xl:sticky xl:top-0">
            <div className="border-b border-border px-4 py-2.5">
              <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Details</h3>
            </div>
            <dl className="divide-y divide-border/60 px-4">
              <Field label="Status">
                <StatusLozenge status={ticket.status} />
              </Field>
              <Field label="Priority">
                {isAgent ? (
                  <Select
                    value={ticket.priority}
                    onValueChange={(value) => setField.mutate({ priority: value as TicketPriority })}
                    options={TICKET_PRIORITIES.map((value) => ({ value, label: PRIORITY_META[value].label }))}
                    ariaLabel="Request priority"
                    className="w-36"
                  />
                ) : (
                  <PriorityTag priority={ticket.priority} />
                )}
              </Field>
              <Field label="Category">
                <span className="text-sm text-foreground">{CATEGORY_META[ticket.category].label}</span>
              </Field>
              <Field label="Reporter">
                {ticket.employee ? (
                  <span className="flex items-center gap-2">
                    <AuthorAvatar name={ticket.employee.name ?? ticket.employee.email} size="sm" />
                    <span className="min-w-0 text-sm text-foreground">{ticket.employee.name ?? ticket.employee.email}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">You</span>
                )}
              </Field>
              <Field label="Assignee">
                {ticket.assignee ? (
                  <span className="flex items-center gap-2">
                    <AuthorAvatar name={ticket.assignee.name} size="sm" />
                    <span className="min-w-0 text-sm text-foreground">{ticket.assignee.name}</span>
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">Unassigned</span>
                )}
              </Field>
              <Field label="Created">
                <span className="text-sm text-foreground tabular-nums">{fmtWhen(ticket.createdAt)}</span>
              </Field>
              <Field label="Updated">
                <span className="text-sm text-foreground tabular-nums">{fmtWhen(ticket.updatedAt)}</span>
              </Field>
            </dl>
          </aside>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 justify-end">{children}</dd>
    </div>
  );
}
