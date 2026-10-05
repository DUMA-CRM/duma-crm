'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ChevronRight, Clock, History, Loader2, Trash2, TriangleAlert } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { deleteAgentConversation, listAgentConversations } from '@/lib/api/agent-conversations.service';
import { cn } from '@/lib/utils/cn';

function conversationDate(value: string) {
  const date = new Date(value);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const sameDay = (left: Date, right: Date) => left.toDateString() === right.toDateString();
  const day = sameDay(date, today)
    ? 'Today'
    : sameDay(date, yesterday)
      ? 'Yesterday'
      : date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${day}, ${date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`;
}

export function ConversationHistory({
  tenantId,
  locationId,
  userId,
  onSelect,
  onDeleted,
  onWorking,
}: {
  tenantId: string | null;
  locationId: string | null;
  userId: string;
  onSelect: (id: string) => Promise<void>;
  onDeleted: (id: string) => void;
  onWorking: (working: boolean) => void;
}) {
  const client = useQueryClient();
  const hasWorkspace = Boolean(userId && tenantId);
  const key = ['agent-conversations', userId, tenantId, locationId];
  const { data, isPending, error, refetch } = useQuery({
    queryKey: key,
    queryFn: () => listAgentConversations(tenantId, locationId),
    staleTime: 0,
    enabled: hasWorkspace,
  });
  const [confirmDelete, setConfirmDelete] = useState<string>();
  const [working, setWorking] = useState<string>();
  const [failure, setFailure] = useState('');
  async function act(id: string, remove: boolean) {
    if (working) return;
    setWorking(id);
    onWorking(true);
    setFailure('');
    try {
      if (remove) {
        await deleteAgentConversation(id);
        onDeleted(id);
        await client.invalidateQueries({ queryKey: key });
        setConfirmDelete(undefined);
      } else await onSelect(id);
    } catch {
      setFailure(remove ? 'Could not delete this chat. Try again.' : 'Could not open this chat. Try again.');
    } finally {
      setWorking(undefined);
      onWorking(false);
    }
  }
  return (
    <section aria-label="Saved conversations" className="py-1">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-semibold tracking-title text-foreground">Your conversations</h3>
        {data && data.length > 0 && <span className="text-label text-muted-foreground">{data.length} saved</span>}
      </div>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">Recent chats in this workspace and location. Only you can open them.</p>
      {!hasWorkspace && (
        <div className="rounded-lg border border-dashed border-rule/60 px-4 py-8 text-center">
          <History size={20} className="mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-foreground">Choose a workspace first</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Saved conversations belong to the workspace where they started.</p>
        </div>
      )}
      {hasWorkspace && isPending && (
        <div role="status" aria-label="Loading conversations" className="overflow-hidden rounded-lg border border-rule/60 bg-field">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex items-center gap-3 border-b border-rule/40 px-3.5 py-3 last:border-b-0">
              <span className="size-8 animate-pulse rounded-md bg-band" />
              <span className="flex-1">
                <span className="block h-3 w-3/5 animate-pulse rounded bg-band" />
                <span className="mt-2 block h-2.5 w-24 animate-pulse rounded bg-band/70" />
              </span>
            </div>
          ))}
        </div>
      )}
      {hasWorkspace && error && (
        <div role="alert" className="rounded-lg border border-exception/30 bg-exception/5 px-4 py-4">
          <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-exception/10 text-exception">
              <TriangleAlert size={16} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">Couldn’t load conversations</p>
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">Your current chat is still available in this window.</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => void refetch()}>
            Try again
          </Button>
        </div>
      )}
      {failure && (
        <p
          role="alert"
          className="mb-3 flex items-start gap-2 rounded-md border border-exception/25 bg-exception/5 px-3 py-2 text-xs text-exception"
        >
          <TriangleAlert size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
          <span>{failure}</span>
        </p>
      )}
      {hasWorkspace && data?.length === 0 && (
        <div className="rounded-lg border border-dashed border-rule/60 px-4 py-8 text-center">
          <History size={20} className="mx-auto text-muted-foreground" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-foreground">No saved conversations yet</p>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Your first conversation will appear here after you ask a question.</p>
        </div>
      )}
      {/* The settings page's row list: one bordered panel, a row per chat. */}
      <ul className={cn('divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-field', !data?.length && 'hidden')}>
        {data?.map((chat) => (
          <li key={chat.id} className="flex items-center gap-2 pr-2">
            <button
              type="button"
              disabled={!!working}
              onClick={() => void act(chat.id, false)}
              className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground">
                {working === chat.id ? (
                  <Loader2 size={15} className="animate-spin" aria-hidden="true" />
                ) : (
                  <History size={15} aria-hidden="true" />
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block line-clamp-2 text-sm font-medium leading-5">{chat.title}</span>
                <span className="mt-1 flex items-center gap-1 text-label text-muted-foreground">
                  <Clock size={11} aria-hidden="true" />
                  {conversationDate(chat.updatedAt)}
                </span>
              </span>
              <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            {confirmDelete === chat.id ? (
              <>
                <Button variant="destructive" size="sm" disabled={!!working} onClick={() => void act(chat.id, true)}>
                  Delete
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(undefined)}>
                  Keep
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                disabled={!!working}
                aria-label={`Delete ${chat.title}`}
                onClick={() => setConfirmDelete(chat.id)}
              >
                <Trash2 size={15} />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
