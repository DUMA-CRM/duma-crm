'use client';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { BookMarked, Loader2, Trash2, TriangleAlert } from '@/components/icons';
import { Drawer } from '@/components/shared/Drawer';
import { Bone } from '@/components/shared/Skeleton';
import { ActionButton, useDoneBeat } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';

import { clearAgentMemory, getAgentMemory, saveAgentMemory } from '@/lib/api/agent-conversations.service';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const editor =
  'min-h-72 w-full resize-y rounded-md border border-input bg-control px-3 py-3 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:outline-2 focus:outline-offset-1 focus:outline-ring';

export function AgentMemoryDrawer({ onClose }: { onClose: () => void }) {
  const client = useQueryClient();
  const userId = useAuthStore((state) => state.user?.id ?? '');
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const key = ['agent-memory', userId, tenantId];
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [justSaved, flashSaved] = useDoneBeat();
  const [confirmClear, setConfirmClear] = useState(false);
  const [failure, setFailure] = useState('');
  const memory = useQuery({
    queryKey: key,
    queryFn: () => getAgentMemory(tenantId),
    enabled: Boolean(userId && tenantId),
    staleTime: 0,
  });

  useEffect(() => {
    if (memory.data) setDraft(memory.data.content);
  }, [memory.data]);

  const original = memory.data?.content ?? '';
  const dirty = draft.trim() !== original;

  async function save() {
    if (!tenantId || !dirty || saving) return;
    setSaving(true);
    setFailure('');
    try {
      const result = await saveAgentMemory(draft.trim(), tenantId);
      client.setQueryData(key, result);
      setDraft(result.content);
      flashSaved();
    } catch {
      setFailure('Your memory could not be saved. Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function clear() {
    if (!tenantId || saving) return;
    setSaving(true);
    setFailure('');
    try {
      await clearAgentMemory(tenantId);
      client.setQueryData(key, { content: '', updatedAt: null });
      setDraft('');
      setConfirmClear(false);
    } catch {
      setFailure('Your memory could not be cleared. Try again.');
    } finally {
      setSaving(false);
    }
  }

  const footer = confirmClear ? (
    <div className="flex flex-wrap items-center gap-2">
      <p className="mr-auto text-sm text-foreground">Clear everything Ask DUMA remembers?</p>
      <Button variant="ghost" onClick={() => setConfirmClear(false)} disabled={saving}>
        Keep memory
      </Button>
      <Button variant="destructive" onClick={() => void clear()} disabled={saving}>
        {saving && <Loader2 className="animate-spin" />}Clear
      </Button>
    </div>
  ) : (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="ghost"
        className="mr-auto text-destructive hover:text-destructive"
        onClick={() => setConfirmClear(true)}
        disabled={!original || saving}
      >
        <Trash2 />
        Clear memory
      </Button>
      {dirty && (
        <Button variant="ghost" onClick={() => setDraft(original)} disabled={saving}>
          Discard
        </Button>
      )}
      <ActionButton className="min-w-32" onClick={() => void save()} disabled={!dirty} pending={saving} done={justSaved}>
        Save memory
      </ActionButton>
    </div>
  );

  return (
    <Drawer
      title="Ask DUMA memory"
      description="One private note that helps Ask DUMA adapt to how you work."
      onClose={onClose}
      className="sm:max-w-xl"
      footer={footer}
    >
      {!tenantId ? (
        <MemoryState title="Choose a workspace first" detail="Memory is kept separately for each workspace." />
      ) : memory.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading memory" className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-rule/55 bg-band/35 p-4" aria-hidden="true">
            <Bone className="size-9 shrink-0" />
            <span className="min-w-0 flex-1 space-y-1.5">
              <Bone className="h-3.5 w-52 max-w-full" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-3/4" />
            </span>
          </div>
          <div className="space-y-1.5" aria-hidden="true">
            <Bone className="h-2.5 w-16" />
            <Bone className="h-72 w-full" />
          </div>
        </div>
      ) : memory.isError ? (
        <MemoryState
          error
          title="Couldn’t load memory"
          detail="Try again without losing your current chat."
          action={
            <Button variant="outline" size="sm" onClick={() => void memory.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <section className="space-y-4" aria-label="Ask DUMA memory editor">
          {failure && (
            <p
              role="alert"
              className="flex items-start gap-2 rounded-md border border-exception/25 bg-exception/5 px-3 py-2.5 text-sm text-exception"
            >
              <TriangleAlert size={15} className="mt-0.5 shrink-0" />
              {failure}
            </p>
          )}
          <div className="rounded-lg border border-rule/55 bg-band/35 p-4">
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-primary">
                <BookMarked size={17} />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">What Ask DUMA should remember</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Response preferences learned from your chats appear here. You can add, change or remove anything. Memory never grants
                  access or replaces live business data.
                </p>
              </div>
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-label font-semibold uppercase tracking-label text-muted-foreground">Memory</span>
            <textarea
              aria-label="Ask DUMA memory"
              maxLength={6000}
              className={editor}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder={'Examples:\n- Prefer detailed answers with a clear next step.\n- Use charts for comparisons when useful.'}
            />
            <span className="mt-1.5 block text-right text-label text-muted-foreground">{draft.length.toLocaleString()} / 6,000</span>
          </label>
        </section>
      )}
    </Drawer>
  );
}

function MemoryState({
  title,
  detail,
  error = false,
  action,
}: {
  title: string;
  detail: string;
  error?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border border-dashed px-5 py-10 text-center ${error ? 'border-exception/35 bg-exception/5' : 'border-rule/60'}`}
    >
      {error ? (
        <TriangleAlert size={20} className="mx-auto text-exception" />
      ) : (
        <BookMarked size={20} className="mx-auto text-muted-foreground" />
      )}
      <p className="mt-3 text-sm font-semibold text-foreground">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-muted-foreground">{detail}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
