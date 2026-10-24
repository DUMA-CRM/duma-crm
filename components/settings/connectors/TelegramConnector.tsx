'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { AlertCircle, CheckCircle2, Clock3, ExternalLink, Loader2, Plug, Search, Send, Sparkles, Trash2, Zap } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type TelegramConnection,
  deleteTelegramConnection,
  findTelegramChats,
  getTelegramConnection,
  saveTelegramConnection,
  telegramQueryKey,
  testTelegramConnection,
} from '@/lib/modules/communications/client';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConnectWizard, WizardRail, type WizardStep } from './ConnectWizard';
import { CONNECTORS_BY_ID, type ConnectorState } from './registry';
import { panelClass, relativeTime } from './shared';

const DEFINITION = CONNECTORS_BY_ID.telegram;

/** A connection that has never delivered a test still needs someone to look at it. */
export function telegramConnectorState(connection: TelegramConnection | null | undefined): ConnectorState {
  if (!connection) return 'disconnected';
  if (connection.lastError) return 'attention';
  if (!connection.isEnabled) return 'paused';
  return connection.lastTestedAt ? 'connected' : 'attention';
}

interface TelegramForm {
  botToken: string;
  chatId: string;
  isEnabled: boolean;
}

/**
 * The saved connection plus whatever the person is typing, shared by the wizard
 * and the manage page. An empty token means "keep the saved one".
 */
function useTelegramForm() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: telegramQueryKey(tenantId),
    queryFn: () => getTelegramConnection(tenantId!),
    enabled: !!tenantId,
  });
  const connection = query.data ?? null;
  const [overrides, setOverrides] = useState<Partial<TelegramForm>>({});
  const form: TelegramForm = {
    botToken: '',
    chatId: connection?.chatId ?? '',
    isEnabled: connection?.isEnabled ?? true,
    ...overrides,
  };
  const update = <K extends keyof TelegramForm>(key: K, value: TelegramForm[K]) =>
    setOverrides((current) => ({ ...current, [key]: value }));
  const invalidate = () => queryClient.invalidateQueries({ queryKey: telegramQueryKey(tenantId) });
  const token = form.botToken.trim();

  const save = useMutation({
    mutationFn: () =>
      saveTelegramConnection(tenantId!, { chatId: form.chatId.trim(), isEnabled: form.isEnabled, ...(token ? { botToken: token } : {}) }),
    onSuccess: async () => {
      setOverrides({});
      await invalidate();
    },
  });

  /** Saves and reports back, so a wizard step can refuse to advance on failure. */
  async function trySave(): Promise<boolean> {
    try {
      await save.mutateAsync();
      toast('success', 'Telegram saved. Send a test to check delivery.');
      return true;
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Telegram wasn’t saved. Check the token and chat, then try again.');
      return false;
    }
  }

  return {
    tenantId,
    query,
    connection,
    form,
    update,
    save,
    trySave,
    invalidate,
    tokenReady: Boolean(token || connection),
    chatReady: Boolean(form.chatId.trim()),
    dirty: Boolean(token) || form.chatId !== (connection?.chatId ?? '') || form.isEnabled !== (connection?.isEnabled ?? true),
    reset: () => setOverrides({}),
  };
}

// ── Field groups, shared by the wizard steps and the manage page ──────────────

function TokenField({
  value,
  onChange,
  hasToken,
  idPrefix,
}: {
  value: string;
  onChange: (value: string) => void;
  hasToken: boolean;
  idPrefix: string;
}) {
  return (
    <Input
      id={`${idPrefix}-telegram-token`}
      label="Bot token"
      type="password"
      autoComplete="new-password"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={hasToken ? 'Leave blank to keep the saved token' : '123456789:AA…'}
      hint="BotFather sends it after /newbot. It’s encrypted when saved and never shown again."
    />
  );
}

/** The destination: look it up from the bot's recent messages, or type a known ID. */
function ChatFields({
  tenantId,
  token,
  canSearch,
  chatId,
  onChange,
  idPrefix,
}: {
  tenantId: string;
  token: string;
  canSearch: boolean;
  chatId: string;
  onChange: (chatId: string) => void;
  idPrefix: string;
}) {
  const findChats = useMutation({ mutationFn: () => findTelegramChats(tenantId, token || undefined) });
  return (
    <div className="space-y-4">
      <ol className="space-y-1.5 text-sm text-muted-foreground">
        {['Add your bot to the staff group.', 'Send /start@your_bot_username in that group.', 'Choose “Find chats” below.'].map(
          (line, index) => (
            <li key={line} className="flex gap-2.5">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/8 text-micro font-semibold text-primary">
                {index + 1}
              </span>
              {line}
            </li>
          ),
        )}
      </ol>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          disabled={!canSearch || findChats.isPending}
          onClick={() => findChats.mutate()}
        >
          {findChats.isPending ? (
            <Loader2 size={15} className="animate-spin" aria-hidden="true" />
          ) : (
            <Search size={15} aria-hidden="true" />
          )}
          {findChats.isPending ? 'Finding chats…' : 'Find chats'}
        </Button>
        {!canSearch && <span className="text-xs text-muted-foreground">Add the bot token first.</span>}
      </div>
      {findChats.isError && (
        <p role="alert" className="text-xs text-exception">
          {findChats.error.message}
        </p>
      )}
      {findChats.isSuccess &&
        (findChats.data.length ? (
          <div className="space-y-1.5">
            <label htmlFor={`${idPrefix}-telegram-found-chat`} className="block text-label uppercase text-muted-foreground">
              Choose a chat
            </label>
            <Select
              id={`${idPrefix}-telegram-found-chat`}
              ariaLabel="Choose a chat"
              placeholder="Select your staff chat"
              value={findChats.data.some((chat) => chat.id === chatId) ? chatId : ''}
              onValueChange={onChange}
              options={findChats.data.map((chat) => ({ value: chat.id, label: `${chat.title} (${chat.id})` }))}
              className="w-full"
            />
          </div>
        ) : (
          <p role="status" className="text-xs text-muted-foreground">
            No recent chats found. Send /start@your_bot_username in the group, then try again. A bot used by another service may need the
            chat ID typed in.
          </p>
        ))}
      <Input
        id={`${idPrefix}-telegram-chat`}
        label="Destination chat ID"
        value={chatId}
        onChange={(event) => onChange(event.target.value)}
        placeholder="-1001234567890"
        hint="Filled in when you pick a chat. A known chat ID or @channelname works too — the bot needs permission to post."
      />
    </div>
  );
}

function ConnectionStatus({ connection }: { connection: TelegramConnection | null }) {
  const tested = relativeTime(connection?.lastTestedAt);
  return (
    <div className="flex items-start gap-3">
      {connection?.lastError ? (
        <AlertCircle size={20} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
      ) : connection?.lastTestedAt ? (
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
      ) : (
        <Clock3 size={20} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <div className="min-w-0" aria-live="polite">
        <p className="text-sm font-medium text-foreground">
          {connection?.lastError
            ? 'The last message failed'
            : connection?.lastTestedAt
              ? 'Delivered — Telegram is ready'
              : 'No successful test yet'}
        </p>
        {tested && <p className="text-xs text-muted-foreground">Last successful test {tested}</p>}
        {connection?.lastError && <p className="mt-2 text-xs text-destructive">{connection.lastError}</p>}
      </div>
    </div>
  );
}

/** Send-a-test — a message in the chat is the only proof the bot can post there. */
function TestPanel({
  connection,
  dirty,
  onSent,
}: {
  connection: TelegramConnection | null;
  dirty: boolean;
  onSent: () => Promise<unknown>;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const test = useMutation({
    mutationFn: () => testTelegramConnection(tenantId!),
    onSuccess: async () => {
      await onSent();
      toast('success', `Test message sent to ${connection?.chatTitle ?? 'Telegram'}.`);
    },
    onError: async (error) => {
      await onSent();
      toast('error', error.message);
    },
  });
  return (
    <div className="space-y-3">
      <ConnectionStatus connection={connection} />
      <Button variant="outline" className="gap-2" disabled={!connection || dirty || test.isPending} onClick={() => test.mutate()}>
        {test.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
        {test.isPending ? 'Sending…' : 'Send test message'}
      </Button>
      {dirty && <p className="text-xs text-muted-foreground">Save your changes before sending a test.</p>}
    </div>
  );
}

// ── Connect wizard ────────────────────────────────────────────────────────────

export function TelegramConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { tenantId, connection, form, update, trySave, invalidate, tokenReady, chatReady, dirty } = useTelegramForm();
  if (!tenantId) {
    return (
      <EditorShell eyebrow="Connect" title="Telegram" onClose={onClose}>
        <ErrorState title="Choose a workspace first" />
      </EditorShell>
    );
  }

  const steps: WizardStep[] = [
    {
      key: 'bot',
      title: 'Create your Telegram bot',
      description: 'The bot is who posts in your staff chat. Open BotFather, send /newbot, and paste the token it gives you.',
      ready: tokenReady,
      content: (
        <div className="space-y-3">
          <TokenField value={form.botToken} onChange={(value) => update('botToken', value)} hasToken={!!connection} idPrefix="wizard" />
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Open @BotFather <ExternalLink size={13} aria-hidden="true" />
          </a>
        </div>
      ),
    },
    {
      key: 'chat',
      title: 'Where should messages go?',
      description: 'Pick the group your team reads. DUMA checks the bot can post there before saving.',
      ready: chatReady,
      continueLabel: 'Verify and save',
      onContinue: trySave,
      content: (
        <ChatFields
          tenantId={tenantId}
          token={form.botToken.trim()}
          canSearch={tokenReady}
          chatId={form.chatId}
          onChange={(value) => update('chatId', value)}
          idPrefix="wizard"
        />
      ),
    },
    {
      key: 'test',
      title: 'Prove it works',
      description: connection ? `Send one message to ${connection.chatTitle}. If it lands, your automations will too.` : undefined,
      skippable: true,
      continueLabel: 'Finish setup',
      content: (
        <div className={panelClass}>
          <TestPanel connection={connection} dirty={false} onSent={invalidate} />
        </div>
      ),
    },
  ];

  return (
    <ConnectWizard
      eyebrow="Connect"
      title="Telegram"
      icon={<Send size={20} aria-hidden="true" />}
      dirty={dirty}
      steps={steps}
      onClose={onClose}
      onFinish={onDone}
      rail={
        <WizardRail
          requirements={DEFINITION.requirements}
          footnote={
            <>
              Choose when it sends messages in{' '}
              <Link href="/automation" className="font-medium text-primary hover:underline">
                Automations
              </Link>
              .
            </>
          }
        />
      }
    />
  );
}

// ── Manage page ───────────────────────────────────────────────────────────────

export function TelegramConnectorPage({ onClose, onConnect }: { onClose: () => void; onConnect: () => void }) {
  const { tenantId, query, connection, form, update, save, invalidate, chatReady, dirty, reset } = useTelegramForm();
  const [editingBot, setEditingBot] = useState(false);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const disconnect = useMutation({
    mutationFn: () => deleteTelegramConnection(tenantId!),
    onSuccess: async () => {
      await invalidate();
      setConfirmDisconnect(false);
      toast('success', 'Telegram disconnected.');
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  const state = telegramConnectorState(connection);
  const tested = relativeTime(connection?.lastTestedAt);
  const status =
    state === 'paused'
      ? { dot: 'bg-stock', text: 'Paused — automation messages are skipped' }
      : connection?.lastError
        ? { dot: 'bg-exception', text: 'The last message failed' }
        : connection?.lastTestedAt
          ? { dot: 'bg-success', text: `Working${tested ? ` · tested ${tested}` : ''}` }
          : { dot: 'bg-muted-foreground/60', text: 'Not tested yet — send a test to be sure' };

  return (
    <EditorShell
      eyebrow="Connector"
      title="Telegram"
      icon={<Send size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty}
      actions={
        connection ? (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 gap-1.5" onClick={onConnect}>
              <Zap size={15} aria-hidden="true" />
              <span className="hidden md:inline">Run setup again</span>
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => setConfirmDisconnect(true)}>
              <Trash2 size={15} aria-hidden="true" />
              <span className="hidden md:inline">Disconnect</span>
            </Button>
          </div>
        ) : null
      }
    >
      {!tenantId ? (
        <ErrorState title="Choose a workspace first" />
      ) : query.isError ? (
        <ErrorState title="Couldn’t load Telegram" onRetry={() => void query.refetch()} />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Where messages go, and whether they arrive — the page's headline. */}
          <div className="flex items-center gap-4">
            <span
              className={cn(
                'flex size-14 shrink-0 items-center justify-center rounded-xl',
                state === 'attention' && connection?.lastError ? 'bg-exception/8 text-exception' : 'bg-primary/8 text-primary',
              )}
            >
              <Send size={26} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-xl font-semibold tracking-headline text-foreground">
                {query.isPending ? (
                  <span role="status" aria-busy="true" aria-label="Loading the Telegram connection" className="flex h-7 items-center">
                    <Bone className="h-5 w-64 max-w-full" />
                  </span>
                ) : connection ? (
                  `Posting to ${connection.chatTitle}`
                ) : (
                  'Telegram isn’t set up'
                )}
              </p>
              {connection ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden="true" />
                  {status.text} · @{connection.botUsername}
                </p>
              ) : (
                !query.isPending && <p className="mt-0.5 text-sm text-muted-foreground">{DEFINITION.description}</p>
              )}
            </div>
          </div>

          {query.isPending ? null : !connection ? (
            <div className={panelClass}>
              <p className="text-sm text-muted-foreground">
                Create a bot with BotFather, add it to your staff group, and DUMA finds the chat for you. It takes about two minutes.
              </p>
              <Button className="mt-4 gap-1.5" onClick={onConnect}>
                <Plug size={15} aria-hidden="true" /> Connect Telegram
              </Button>
            </div>
          ) : (
            <SettingsTabBody
              aside={
                <>
                  <SettingsSection title="Send a test">
                    <TestPanel connection={connection} dirty={dirty} onSent={invalidate} />
                  </SettingsSection>
                  <SettingsSection title="Used for">
                    <Link
                      href="/automation"
                      className="flex items-center gap-3 rounded-lg border border-rule/50 bg-background/60 px-3 py-2.5 transition-colors hover:border-rule hover:bg-band/45"
                    >
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                        <Sparkles size={15} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">Automations</span>
                        <span className="block truncate text-xs text-muted-foreground">Add a “Send Telegram message” step.</span>
                      </span>
                    </Link>
                  </SettingsSection>
                </>
              }
            >
              <SettingsSection title="Destination">
                <ChatFields
                  tenantId={tenantId}
                  token={form.botToken.trim()}
                  canSearch
                  chatId={form.chatId}
                  onChange={(value) => update('chatId', value)}
                  idPrefix="manage"
                />
              </SettingsSection>

              <SettingsSection
                title="Bot"
                actions={
                  <Button variant={editingBot ? 'ghost' : 'outline'} size="sm" onClick={() => setEditingBot((open) => !open)}>
                    {editingBot ? 'Close' : 'Replace token'}
                  </Button>
                }
              >
                {editingBot ? (
                  <TokenField value={form.botToken} onChange={(value) => update('botToken', value)} hasToken idPrefix="manage" />
                ) : (
                  // The token never comes back, so this reads as one line until you ask to replace it.
                  <div className="flex items-center gap-3 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-3">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                      <Send size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-foreground">@{connection.botUsername}</span>
                      <span className="block truncate text-xs text-muted-foreground">Token saved and encrypted</span>
                    </span>
                  </div>
                )}
              </SettingsSection>

              <SettingsSection title="Notifications">
                <div className="flex items-center justify-between gap-4 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-3">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground">Allow automation notifications</span>
                    <span className="block text-xs text-muted-foreground">
                      Off skips Telegram steps — skipped messages aren’t sent later. Tests still work.
                    </span>
                  </span>
                  <Switch
                    label="Allow automation notifications"
                    checked={form.isEnabled}
                    onChange={(value) => update('isEnabled', value)}
                  />
                </div>
              </SettingsSection>
            </SettingsTabBody>
          )}
        </div>
      )}

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        disabled={!chatReady || query.isPending}
        saveLabel="Verify and save"
        onSave={() =>
          save.mutate(undefined, {
            onSuccess: () => {
              toast('success', 'Telegram saved.');
              setEditingBot(false);
            },
            onError: (error) => toast('error', error.message),
          })
        }
        onDiscard={() => {
          reset();
          setEditingBot(false);
        }}
      />

      {confirmDisconnect && (
        <ConfirmModal
          onClose={() => setConfirmDisconnect(false)}
          title="Disconnect Telegram?"
          message="Automations keep their Telegram steps, but those steps will fail until you reconnect."
          confirmLabel="Disconnect"
          onConfirm={() => disconnect.mutate()}
          isPending={disconnect.isPending}
          pendingLabel="Disconnecting…"
        />
      )}
    </EditorShell>
  );
}
