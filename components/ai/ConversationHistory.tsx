'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { ChevronRight, History, Loader2, Trash2, TriangleAlert } from '@/components/icons';
import { EmptyState } from '@/components/shared/EmptyState';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';

import { deleteAgentConversation, listAgentConversations } from '@/lib/api/agent-conversations.service';
import { cn } from '@/lib/utils/cn';

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
        <EmptyState
          icon={History}
          title="Choose a workspace first"
          description="Saved conversations belong to the workspace where they started."
          compact
        />
      )}
      {hasWorkspace && isPending && (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading conversations"
          className="divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-field"
        >
          {['w-3/5', 'w-4/5', 'w-1/2'].map((width) => (
            <div key={width} className="flex items-center gap-3 px-3.5 py-3" aria-hidden="true">
              <span className="min-w-0 flex-1">
                <Bone className={cn('h-3.5', width)} />
                <Bone className="mt-2 h-2.5 w-20" />
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
        <EmptyState
          icon={History}
          title="No saved conversations yet"
          description="Your conversations are saved here once you ask a question."
          compact
        />
      )}
      {/* The settings page's row list: one bordered panel, a row per chat. */}
      <ul className={cn('divide-y divide-rule/40 overflow-hidden rounded-lg border border-rule/60 bg-field', !data?.length && 'hidden')}>
        {data?.map((chat) => (
          <li key={chat.id} className="group/row flex items-center gap-2 pr-2">
            <button
              type="button"
              disabled={!!working}
              onClick={() => void act(chat.id, false)}
              className="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring disabled:opacity-50"
            >
              {/* The section heading already says these are history — no glyph per row repeating it. */}
              <span className="min-w-0 flex-1">
                <span className="block line-clamp-2 text-sm font-medium leading-5">{chat.title}</span>
                <RelativeTime iso={chat.updatedAt} className="mt-1 block text-label text-muted-foreground" />
              </span>
              {working === chat.id ? (
                <Loader2 size={15} className="shrink-0 animate-spin text-muted-foreground" aria-label="Opening" />
              ) : (
                <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
              )}
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
                className="opacity-0 transition-opacity group-hover/row:opacity-100 group-focus-within/row:opacity-100 pointer-coarse:opacity-100"
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
