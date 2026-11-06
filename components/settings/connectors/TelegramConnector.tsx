'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { InfoRow, InfoRows } from '@/components/cms/rows';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Clock3,
  ExternalLink,
  KeyRound,
  Loader2,
  Plug,
  Search,
  Send,
  Sparkles,
  UserPlus,
  Zap,
} from '@/components/icons';
import { useSettingsTenantId } from '@/components/settings/SettingsScope';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SaveBar, Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
import { telegramConnectorState } from '@/lib/utils/connector-state';

import { Command, ConnectWizard, WizardInstruction, WizardRail, type WizardStep } from './ConnectWizard';
import { ConnectorManagePage, type ConnectorStatus } from './ConnectorManagePage';
import { useStoredDraft } from './draft';
import { CONNECTORS_BY_ID } from './registry';
import { panelClass, relativeTime } from './shared';

const DEFINITION = CONNECTORS_BY_ID.telegram;

export { telegramConnectorState };

interface TelegramForm {
  botToken: string;
  chatId: string;
  isEnabled: boolean;
}

/**
 * The saved connection plus whatever the person is typing, shared by the wizard
 * and the manage page. An empty token means "keep the saved one".
 */
function useTelegramForm({ keep = false }: { keep?: boolean } = {}) {
  const tenantId = useSettingsTenantId();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: telegramQueryKey(tenantId),
    queryFn: () => getTelegramConnection(tenantId!),
    enabled: !!tenantId,
  });
  const connection = query.data ?? null;
  // The chat and the switch survive leaving the wizard; the bot token is a secret, so it never does.
  const kept = useStoredDraft<Partial<Omit<TelegramForm, 'botToken'>>>(keep && tenantId ? `telegram:${tenantId}` : null, {});
  const [botToken, setBotToken] = useState('');
  const form: TelegramForm = {
    botToken,
    chatId: connection?.chatId ?? '',
    isEnabled: connection?.isEnabled ?? true,
    ...kept.value,
  };
  const update = <K extends keyof TelegramForm>(key: K, value: TelegramForm[K]) => {
    if (key === 'botToken') setBotToken(value as string);
    else kept.set({ ...kept.value, [key]: value });
  };
  const reset = () => {
    kept.clear();
    setBotToken('');
  };
  const invalidate = () => queryClient.invalidateQueries({ queryKey: telegramQueryKey(tenantId) });
  const token = form.botToken.trim();

  const save = useMutation({
    mutationFn: () =>
      saveTelegramConnection(tenantId!, { chatId: form.chatId.trim(), isEnabled: form.isEnabled, ...(token ? { botToken: token } : {}) }),
    onSuccess: async () => {
      reset();
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
    reset,
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
      className="pr-32"
      rightAction={
        <a
          href="https://t.me/BotFather"
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/8"
        >
          Open BotFather <ExternalLink size={12} aria-hidden="true" />
        </a>
      }
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
    <div className="space-y-3">
      <WizardInstruction icon={UserPlus}>
        Add the bot to your staff group, then send <Command>/start</Command> there.
      </WizardInstruction>
      {/* One field: find the chat from inside it, or type a known ID. */}
      <Input
        id={`${idPrefix}-telegram-chat`}
        label="Staff chat"
        value={chatId}
        onChange={(event) => onChange(event.target.value)}
        placeholder="-1001234567890 or @channel"
        className="pr-32"
        rightAction={
          <button
            type="button"
            disabled={!canSearch || findChats.isPending}
            onClick={() => findChats.mutate()}
            className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/8 disabled:pointer-events-none disabled:opacity-50"
          >
            {findChats.isPending ? (
              <Loader2 size={12} className="animate-spin" aria-hidden="true" />
            ) : (
              <Search size={12} aria-hidden="true" />
            )}
            {findChats.isPending ? 'Finding…' : 'Find chats'}
          </button>
        }
      />
      {findChats.isError && (
        <p role="alert" className="text-xs text-exception">
          {findChats.error.message}
        </p>
      )}
      {findChats.isSuccess &&
        (findChats.data.length ? (
          <div role="radiogroup" aria-label="Chats the bot can see" className="flex flex-col gap-2">
            {findChats.data.map((chat) => {
              const selected = chat.id === chatId;
              return (
                <button
                  key={chat.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(chat.id)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg border bg-field px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-ring',
                    selected ? 'border-primary' : 'border-rule/50 hover:border-rule',
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">{chat.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">{chat.id}</span>
                  </span>
                  {selected && <CheckCircle2 size={16} className="shrink-0 text-primary" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ) : (
          <p role="status" className="text-xs text-muted-foreground">
            No chats found. Send <Command>/start</Command> in the group, then try again.
          </p>
        ))}
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
function useTelegramTest(connection: TelegramConnection | null, onSent: () => Promise<unknown>) {
  const tenantId = useSettingsTenantId();
  return useMutation({
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
}

function TestPanel({
  connection,
  dirty,
  onSent,
}: {
  connection: TelegramConnection | null;
  dirty: boolean;
  onSent: () => Promise<unknown>;
}) {
  const test = useTelegramTest(connection, onSent);
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
  const { tenantId, connection, form, update, trySave, invalidate, tokenReady, chatReady, reset } = useTelegramForm({ keep: true });
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
      label: 'Bot token',
      title: 'Create your Telegram bot',
      ready: tokenReady,
      content: (
        <div className="space-y-3">
          <WizardInstruction icon={KeyRound}>
            Send <Command>/newbot</Command> to BotFather and copy the token it replies with.
          </WizardInstruction>
          <TokenField value={form.botToken} onChange={(value) => update('botToken', value)} hasToken={!!connection} idPrefix="wizard" />
        </div>
      ),
    },
    {
      key: 'chat',
      label: 'Staff chat',
      title: 'Choose the staff chat',
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
      label: 'Test',
      title: 'Send a test',
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
      // Only the token is lost on leaving; the rest is kept for next time.
      dirty={Boolean(form.botToken.trim())}
      steps={steps}
      onClose={onClose}
      onFinish={onDone}
      resumeKey={`telegram:${tenantId}`}
      onStartOver={reset}
      rail={<WizardRail requirements={DEFINITION.requirements} />}
    />
  );
}

// ── Manage page ───────────────────────────────────────────────────────────────

export function TelegramConnectorPage({ onClose, onConnect }: { onClose: () => void; onConnect: () => void }) {
  const { tenantId, query, connection, form, update, save, invalidate, chatReady, dirty, reset } = useTelegramForm();
  const [editingBot, setEditingBot] = useState(false);
  const test = useTelegramTest(connection, invalidate);
  const disconnect = useMutation({
    mutationFn: () => deleteTelegramConnection(tenantId!),
    onSuccess: async () => {
      await invalidate();
      toast('success', 'Telegram disconnected.');
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  const state = telegramConnectorState(connection);
  const tested = relativeTime(connection?.lastTestedAt);
  const status: ConnectorStatus =
    state === 'paused'
      ? { tone: 'warning', text: 'Paused — automation messages are skipped' }
      : connection?.lastError
        ? { tone: 'danger', text: 'The last message failed' }
        : connection?.lastTestedAt
          ? { tone: 'success', text: 'Working' }
          : { tone: 'muted', text: 'Not tested yet' };

  if (!tenantId) {
    return (
      <EditorShell eyebrow="Connection" title="Telegram" onClose={onClose}>
        <ErrorState title="Choose a workspace first" />
      </EditorShell>
    );
  }

  return (
    <ConnectorManagePage
      definition={DEFINITION}
      status={connection ? status : undefined}
      loading={query.isPending}
      error={query.isError ? { title: 'Couldn’t load Telegram', onRetry: () => void query.refetch() } : undefined}
      notSetUp={
        !connection ? (
          <div className={panelClass}>
            <p className="text-sm text-muted-foreground">Send automation alerts to your staff chat.</p>
            <Button className="mt-4 gap-1.5" onClick={onConnect}>
              <Plug size={15} aria-hidden="true" /> Connect Telegram
            </Button>
          </div>
        ) : undefined
      }
      health={
        connection
          ? {
              facts: [
                { icon: Send, title: 'Bot', value: `@${connection.botUsername}` },
                {
                  icon: Clock3,
                  title: 'Last test',
                  value: tested ?? 'Not tested yet',
                  tone: connection.lastTestedAt ? undefined : 'warning',
                },
                { icon: Bell, title: 'Automation messages', value: connection.isEnabled ? 'Allowed' : 'Paused' },
              ],
              problem: connection.lastError,
              test: {
                label: 'Send a test message',
                icon: Send,
                pending: test.isPending,
                disabled: dirty,
                note: dirty ? 'Save your changes before sending a test.' : undefined,
                onTest: () => test.mutate(),
              },
            }
          : undefined
      }
      usedBy={[{ icon: Sparkles, label: 'Automations', href: '/automation' }]}
      actions={[{ icon: Zap, label: 'Run setup again', onClick: onConnect }]}
      disconnect={{
        consequences: [
          'Automation steps that send Telegram messages fail until you reconnect.',
          'Your bot and staff chat stay as they are in Telegram.',
        ],
        pending: disconnect.isPending,
        onConfirm: () => disconnect.mutate(),
      }}
      dirty={dirty}
      onClose={onClose}
      footer={
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
      }
    >
      {connection && (
        <>
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
              <InfoRows>
                <InfoRow icon={Send} title={`@${connection.botUsername}`} description="Token saved and encrypted">
                  {null}
                </InfoRow>
              </InfoRows>
            )}
          </SettingsSection>

          <SettingsSection title="Notifications">
            <InfoRows>
              <InfoRow icon={Bell} title="Allow automation notifications" description="Skipped messages aren’t sent later.">
                <Switch label="Allow automation notifications" checked={form.isEnabled} onChange={(value) => update('isEnabled', value)} />
              </InfoRow>
            </InfoRows>
          </SettingsSection>
        </>
      )}
    </ConnectorManagePage>
  );
}
