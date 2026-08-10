'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ActionCard } from '@/components/ai/ActionCard';
import { AgentMetrics } from '@/components/ai/AgentMetrics';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronRight,
  Copy,
  Loader2,
  MapPin,
  Package,
  Send,
  ShoppingCart,
  Sparkles,
  Users,
  X,
  Zap,
} from '@/components/icons';
import { Markdown } from '@/components/shared/Markdown';
import { Button } from '@/components/ui/button';

import type {
  AgentActionSubmission,
  AgentChatMessage,
  AgentChatResponse,
  AgentPendingAction,
  AgentShortcut,
  AgentStreamEvent,
} from '@/lib/ai/agent-types';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const STARTERS = [
  { icon: ShoppingCart, label: 'Order stock', prompt: 'Order 10 litres of oat milk for tomorrow from our usual supplier.' },
  { icon: BarChart3, label: 'Compare sales', prompt: 'How did latte sales this week compare with the same days last week?' },
  { icon: Package, label: 'Check stock risk', prompt: 'What runs out first at this location, and what should I reorder?' },
  { icon: Users, label: 'Check the rota', prompt: 'Who is working this week, and is anything uncovered?' },
];

const FOCUSABLE = 'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';
const SHORTCUT_FEEDBACK_MS = 450;
/** Recent turns sent with each request — the panel keeps the rest for display only. */
const HISTORY_SENT = 24;

function shortcutKey(shortcut: AgentShortcut) {
  return `${shortcut.href}-${shortcut.locationId ?? ''}`;
}

/**
 * The steps the agent actually took, streamed as it takes them. Completed steps
 * stay ticked so a slow answer reads as progress on real work rather than as a
 * spinner that might mean anything.
 */
function ThinkingTrail({ steps }: { steps: string[] }) {
  const visible = steps.slice(-4);
  return (
    <div className="mt-5 border-l border-reference pl-3" role="status" aria-live="polite">
      <ul className="space-y-1.5">
        {visible.map((step, index) => {
          const current = index === visible.length - 1;
          return (
            <li key={`${step}-${index}`} className="flex items-center gap-2">
              {current ? (
                <Loader2 size={13} className="shrink-0 animate-spin text-reference" aria-hidden="true" />
              ) : (
                <Check size={13} className="shrink-0 text-reference/60" aria-hidden="true" />
              )}
              <span className={cn('text-sm', current ? 'font-medium text-foreground' : 'text-muted-foreground')}>
                {step}
                {current ? '…' : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ShortcutList({
  shortcuts,
  openingKey,
  onOpen,
}: {
  shortcuts: AgentShortcut[];
  openingKey?: string;
  onOpen: (shortcut: AgentShortcut) => void;
}) {
  return (
    <section className="mt-3 border-t border-reference/25 pt-3" aria-label="Open in DUMA">
      <p className="text-label font-semibold uppercase tracking-wide text-reference">Open in DUMA</p>
      <div className="mt-1.5 space-y-1">
        {shortcuts.map((shortcut) => {
          const key = shortcutKey(shortcut);
          const opening = openingKey === key;
          const Icon = shortcut.kind === 'support' ? BookOpen : shortcut.locationId ? MapPin : ArrowRight;
          const progressLabel = shortcut.locationId
            ? 'Switching active location…'
            : shortcut.kind === 'support'
              ? 'Opening guide…'
              : 'Opening page…';
          return (
            <button
              key={key}
              type="button"
              onClick={() => onOpen(shortcut)}
              disabled={Boolean(openingKey)}
              className="group flex w-full items-center gap-2 rounded-sm px-2 py-2 text-left transition-colors hover:bg-reference/8 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring disabled:cursor-wait disabled:opacity-60"
            >
              {opening ? (
                <Loader2 size={14} className="shrink-0 animate-spin text-reference" aria-hidden="true" />
              ) : (
                <Icon size={14} className="shrink-0 text-reference" aria-hidden="true" />
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-semibold text-foreground">{shortcut.label}</span>
                {opening || shortcut.description ? (
                  <span className="mt-0.5 block text-label leading-4 text-muted-foreground">
                    {opening ? progressLabel : shortcut.description}
                  </span>
                ) : null}
              </span>
              {!opening ? (
                <ArrowRight
                  size={13}
                  className="shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CopyAnswer({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1_600);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(content).then(() => setCopied(true));
      }}
      className="inline-flex items-center gap-1 rounded-sm px-1.5 py-1 text-label font-semibold text-muted-foreground transition-colors hover:bg-band hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
    >
      {copied ? <Check size={11} aria-hidden="true" /> : <Copy size={11} aria-hidden="true" />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

export function DumaAgent() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [pendingAction, setPendingAction] = useState<AgentPendingAction>();
  const [testMode, setTestMode] = useState(true);
  const [busy, setBusy] = useState(false);
  const [steps, setSteps] = useState<string[]>([]);
  const [openingShortcut, setOpeningShortcut] = useState<string>();
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController>(null);
  const navigationTimerRef = useRef<number | undefined>(undefined);
  const locationId = useWorkspaceStore((state) => state.locationId);
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const setLocationId = useWorkspaceStore((state) => state.setLocationId);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, pendingAction, busy, steps]);

  useEffect(
    () => () => {
      if (navigationTimerRef.current) window.clearTimeout(navigationTimerRef.current);
      abortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        return;
      }
      if (event.key !== 'Tab' || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown);
      openerRef.current?.focus();
    };
  }, [open]);

  const openPanel = (opener: HTMLElement) => {
    openerRef.current = opener;
    setOpen(true);
  };

  const applyResponse = useCallback((result: AgentChatResponse) => {
    setMessages((current) => [
      ...current,
      {
        role: 'assistant',
        content: result.message,
        evidence: result.evidence,
        scope: result.scope,
        shortcuts: result.shortcuts,
        cards: result.cards,
        followUps: result.followUps,
        fallbackModel: result.fallbackModel,
      },
    ]);
    setPendingAction(result.pendingAction);
    setTestMode(result.testMode);
  }, []);

  const send = async (prompt = draft) => {
    const content = prompt.trim();
    if (!content || busy) return;
    const nextMessages: AgentChatMessage[] = [...messages, { role: 'user', content }];
    setMessages(nextMessages);
    setDraft('');
    setPendingAction(undefined);
    setError('');
    setSteps([]);
    setBusy(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the recent turns as plain text. The panel keeps the full
        // transcript for display, but cards, shortcuts and evidence are already
        // spent — replaying them would only grow the request every turn.
        body: JSON.stringify({
          messages: nextMessages.slice(-HISTORY_SENT).map(({ role, content }) => ({ role, content })),
          context: { locationId, tenantId },
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        const failure = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(failure.message || 'Ask DUMA could not complete the request.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let answered = false;

      // NDJSON: one event per line, so a partial chunk waits for its newline.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as AgentStreamEvent;
          if (event.type === 'step')
            setSteps((current) => (current[current.length - 1] === event.label ? current : [...current, event.label]));
          else if (event.type === 'error') throw new Error(event.message);
          else if (event.type === 'result') {
            applyResponse(event.response);
            answered = true;
          }
        }
      }

      if (!answered) throw new Error('The answer stopped before it arrived. Try again.');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') {
        setMessages((current) => [...current, { role: 'assistant', content: 'Stopped. Ask again when you are ready.' }]);
      } else {
        setError(caught instanceof Error ? caught.message : 'Ask DUMA could not complete the request.');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
      setSteps([]);
    }
  };

  const openShortcut = (shortcut: AgentShortcut) => {
    if (!shortcut.href.startsWith('/') || openingShortcut) return;
    setOpeningShortcut(shortcutKey(shortcut));
    navigationTimerRef.current = window.setTimeout(() => {
      if (shortcut.locationId) setLocationId(shortcut.locationId);
      setOpen(false);
      setOpeningShortcut(undefined);
      router.push(shortcut.href);
    }, SHORTCUT_FEEDBACK_MS);
  };

  const confirmAction = async (submission: AgentActionSubmission) => {
    if (busy) return;
    setBusy(true);
    setError('');
    setSteps(['Checking your approval', 'Validating the details', testMode ? 'Running a safe test' : 'Writing to DUMA']);
    try {
      const response = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmedAction: submission, context: { locationId, tenantId } }),
      });
      const result = (await response.json()) as AgentChatResponse;
      if (!response.ok) throw new Error(result.message || 'The action could not be completed.');
      setMessages((current) => [...current, { role: 'assistant', content: result.message, shortcuts: result.shortcuts }]);
      setPendingAction(undefined);
      setTestMode(result.testMode);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The action could not be completed.');
    } finally {
      setBusy(false);
      setSteps([]);
    }
  };

  const lastMessage = messages[messages.length - 1];
  const followUps = !busy && !pendingAction && lastMessage?.role === 'assistant' ? (lastMessage.followUps ?? []) : [];

  return (
    <>
      {/* One of the header's tools, at their size and in their material: a 36px
          ghost square holding an 18px glyph, like the reload and theme keys
          either side of it. The label lives in the panel it opens. */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(event) => openPanel(event.currentTarget)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Ask DUMA"
      >
        <Sparkles aria-hidden="true" className="size-4.5" />
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end" role="presentation">
          <button type="button" className="absolute inset-0 bg-foreground/25" onClick={() => setOpen(false)} aria-label="Close Ask DUMA" />
          <section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="duma-agent-title"
            tabIndex={-1}
            className="relative flex h-full w-full flex-col bg-card shadow-2xl sm:max-w-115 sm:border sm:border-rule animate-in slide-in-from-right duration-200"
          >
            <header className="flex items-start justify-between gap-4 border-b border-divider bg-background px-5 py-4">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Sparkles size={16} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 id="duma-agent-title" className="text-base font-semibold text-foreground">
                    Ask DUMA
                  </h2>
                  <p className="truncate text-xs text-muted-foreground">Reads the live workspace · pauses before every write</p>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setOpen(false)} aria-label="Close Ask DUMA">
                <X aria-hidden="true" />
              </Button>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-5 py-5" aria-live="polite">
              {messages.length === 0 ? (
                <div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">What needs doing?</h3>
                  <p className="mt-2 max-w-[38ch] text-sm leading-6 text-muted-foreground">
                    Ask about sales, stock, orders, customers or the rota. DUMA checks the live workspace, and anything it would change
                    comes back as a card you can edit before approving.
                  </p>
                  <div className="mt-6 divide-y divide-divider border-y border-divider">
                    {STARTERS.map(({ icon: Icon, label, prompt }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => void send(prompt)}
                        className="group flex w-full items-start gap-3 py-3 text-left transition-colors hover:bg-band/55 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                      >
                        <Icon size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{label}</span>
                          <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{prompt}</span>
                        </span>
                        <ChevronRight
                          size={14}
                          className="mt-0.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-5">
                  {messages.map((message, index) => (
                    <div key={`${message.role}-${index}`} className={cn('flex', message.role === 'user' ? 'justify-end' : 'justify-start')}>
                      <div
                        className={cn(
                          'text-sm leading-6',
                          message.role === 'user'
                            ? 'max-w-[88%] whitespace-pre-wrap rounded-md bg-foreground px-3 py-2 text-background'
                            : 'w-full border-l border-reference pl-3 text-foreground',
                        )}
                      >
                        {message.role === 'assistant' ? <Markdown content={message.content} variant="compact" /> : message.content}
                        {message.role === 'assistant' &&
                          message.cards?.map((card, cardIndex) => <AgentMetrics key={cardIndex} card={card} />)}
                        {message.role === 'assistant' && message.shortcuts?.length ? (
                          <ShortcutList shortcuts={message.shortcuts} openingKey={openingShortcut} onOpen={openShortcut} />
                        ) : null}
                        {message.role === 'assistant' && (message.scope || message.evidence?.length) ? (
                          <div className="mt-3 flex items-start justify-between gap-2 border-t border-reference/25 pt-2">
                            <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">
                              <span className="font-semibold text-reference">Checked</span>
                              <span> · {[message.scope, ...(message.evidence ?? [])].filter(Boolean).join(' · ')}</span>
                            </p>
                            <CopyAnswer content={message.content} />
                          </div>
                        ) : null}
                        {message.role === 'assistant' && message.fallbackModel ? (
                          <p className="mt-1.5 flex items-center gap-1.5 text-label text-muted-foreground">
                            <Zap size={11} className="shrink-0 text-stock" aria-hidden="true" />
                            Primary model was at its limit — answered by {message.fallbackModel}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {busy && steps.length > 0 ? <ThinkingTrail steps={steps} /> : null}
              {error && (
                <p className="mt-4 rounded-sm border border-exception/50 bg-exception/5 p-3 text-sm text-exception" role="alert">
                  {error}
                </p>
              )}
              {pendingAction && (
                <ActionCard
                  action={pendingAction}
                  testMode={testMode}
                  busy={busy}
                  onConfirm={(submission) => void confirmAction(submission)}
                  onCancel={() => setPendingAction(undefined)}
                />
              )}

              {followUps.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5" aria-label="Suggested follow-ups">
                  {followUps.map((followUp) => (
                    <button
                      key={followUp}
                      type="button"
                      onClick={() => void send(followUp)}
                      className="rounded-sm border border-rule bg-field px-2 py-1 text-xs text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring"
                    >
                      {followUp}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <form
              className="shrink-0 border-t border-divider bg-band/55 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                void send();
              }}
            >
              <div className="flex items-end gap-2 rounded-md border border-input bg-field p-2 shadow-sm focus-within:outline-2 focus-within:outline-measured">
                <textarea
                  ref={inputRef}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  rows={2}
                  maxLength={4_000}
                  placeholder="Ask about the business…"
                  aria-label="Message Ask DUMA"
                  className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-1 py-1 text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-sm"
                  disabled={busy}
                />
                {busy ? (
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => abortRef.current?.abort()}
                    aria-label="Stop generating"
                  >
                    <X aria-hidden="true" />
                  </Button>
                ) : (
                  <Button type="submit" size="icon" disabled={!draft.trim()} aria-label="Send message">
                    <Send aria-hidden="true" />
                  </Button>
                )}
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 px-1 text-label text-muted-foreground">
                <span>{testMode ? 'Test mode · writes are simulated' : 'Live mode · writes need approval'}</span>
                {messages.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setMessages([]);
                      setPendingAction(undefined);
                      setError('');
                    }}
                    className="font-semibold text-foreground hover:underline"
                  >
                    Clear
                  </button>
                )}
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}
