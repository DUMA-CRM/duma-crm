'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { DumaSays } from '@/components/cms/DumaSays';
import { ArrowUp, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { QUESTION_MAX, QUESTION_MIN, type ReservationFacts } from '@/lib/ai/reservation-assist';
import { getCurrentTenantModules } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { useWorkspaceStore } from '@/stores/workspaceStore';

/**
 * Ask DUMA about the booking that's open, with the answer in the mascot's
 * bubble. The booking's
 * facts go with the question — the agent has no reservations tools of its own.
 * Hidden while the workspace has Ask DUMA switched off.
 */
export function BookingAssist({ facts }: { facts: ReservationFacts }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // The header's query, so this is a cache hit.
  const modules = useQuery({
    queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId),
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    enabled: Boolean(tenantId),
    staleTime: 30_000,
  });
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [reply, setReply] = useState<null | { tone: 'done' | 'error'; text: string; asked: string }>(null);
  const [cheer, setCheer] = useState(0);

  if (!modules.data?.modules.some((module) => module.moduleId === 'agent' && module.status === 'enabled')) return null;

  async function ask(text = question.trim()) {
    if (text.length < QUESTION_MIN || busy) return;
    setBusy(true);
    try {
      const response = await fetch('/api/reservations/assist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, facts }),
      });
      const json = (await response.json().catch(() => ({}))) as { answer?: string; error?: string };
      if (!response.ok || !json.answer) throw new Error(json.error ?? 'Ask DUMA is unavailable right now.');
      setReply({ tone: 'done', text: json.answer, asked: text });
      setQuestion('');
      setCheer((count) => count + 1);
    } catch (error) {
      setReply({ tone: 'error', text: error instanceof Error ? error.message : 'That didn’t work — try again.', asked: text });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 px-4 py-3.5">
      <DumaSays
        line={busy ? 'Thinking…' : (reply?.text ?? `Anything you want to know about ${facts.guest}’s booking?`)}
        busy={busy}
        tone={reply?.tone ?? 'idle'}
        cheer={cheer}
      />
      {reply && !busy && <p className="pl-16 text-xs text-muted-foreground">You asked: {reply.asked}</p>}
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
      >
        <Input
          aria-label="Ask about this booking"
          value={question}
          maxLength={QUESTION_MAX}
          disabled={busy}
          placeholder="Ask about this booking…"
          onChange={(event) => setQuestion(event.target.value)}
        />
        <Button type="submit" size="icon" aria-label="Ask" disabled={busy || question.trim().length < QUESTION_MIN}>
          {busy ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ArrowUp size={15} aria-hidden="true" />}
        </Button>
      </form>
    </div>
  );
}
