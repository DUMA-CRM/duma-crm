'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { AlertCircle, Building2, CheckCircle2, Clock3, Loader2, Mail, Send, Server, ShieldOff, Sparkles, Zap } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar, Switch } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type EmailConnection,
  type EmailConnectionPayload,
  getEmailConnection,
  saveEmailConnection,
  testEmailConnection,
} from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConnectWizard, ProviderGrid, WizardRail, type WizardStep } from './ConnectWizard';
import { CONNECTORS_BY_ID, type ConnectorState } from './registry';
import { panelClass, relativeTime } from './shared';

const DEFINITION = CONNECTORS_BY_ID.email;

/** One-click host/port defaults for the mail providers small businesses actually use. */
const PROVIDERS = [
  {
    value: 'gmail',
    label: 'Gmail / Workspace',
    icon: Mail,
    host: 'smtp.gmail.com',
    port: 587,
    security: 'starttls' as const,
    hint: 'Google blocks normal passwords over SMTP — generate an App Password in your Google account first.',
  },
  {
    value: 'microsoft',
    label: 'Microsoft 365',
    icon: Building2,
    host: 'smtp.office365.com',
    port: 587,
    security: 'starttls' as const,
    hint: 'Your username is the full email address. SMTP AUTH must be enabled for the mailbox.',
  },
  {
    value: 'other',
    label: 'Another provider',
    icon: Server,
    host: '',
    port: 587,
    security: 'starttls' as const,
    hint: 'Your host will have given you a server name, port, username and password.',
  },
];

type ProviderKey = (typeof PROVIDERS)[number]['value'];

export function emailConnectorState(connection: EmailConnection | null | undefined): ConnectorState {
  if (!connection) return 'disconnected';
  if (connection.lastTestSucceeded === false) return 'attention';
  if (!connection.isEnabled) return 'paused';
  return 'connected';
}

/**
 * The saved connection plus whatever the person is currently typing, as one
 * object. Both the wizard and the manage page drive the same fields, so they
 * share the form rather than each keeping their own copy of the rules.
 */
function useEmailConnectionForm() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const { data: connection, isLoading } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });

  const [overrides, setOverrides] = useState<Partial<EmailConnectionPayload>>({});

  const form: EmailConnectionPayload = {
    host: connection?.host ?? '',
    port: connection?.port ?? 587,
    security: connection?.security ?? 'starttls',
    username: connection?.username ?? '',
    password: '',
    fromName: connection?.fromName ?? '',
    fromEmail: connection?.fromEmail ?? '',
    replyTo: connection?.replyTo ?? '',
    isEnabled: connection?.isEnabled ?? true,
    ...overrides,
  };

  const update = <K extends keyof EmailConnectionPayload>(key: K, value: EmailConnectionPayload[K]) =>
    setOverrides((current) => ({ ...current, [key]: value }));

  const applyProvider = (provider: (typeof PROVIDERS)[number]) =>
    setOverrides((current) => ({
      ...current,
      ...(provider.host ? { host: provider.host } : {}),
      port: provider.port,
      security: provider.security,
    }));

  const save = useMutation({
    mutationFn: () =>
      saveEmailConnection({
        ...form,
        tenantId: tenantId ?? undefined,
        replyTo: form.replyTo || null,
        // An empty password box means "keep the one you already have".
        ...(form.password ? {} : { password: undefined }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-connection') });
      setOverrides((current) => ({ ...current, password: '' }));
    },
  });

  /** Saves and reports back, so a wizard step can refuse to advance on failure. */
  async function trySave(): Promise<boolean> {
    try {
      await save.mutateAsync();
      return true;
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Email settings weren’t saved. Review the details and try again.');
      return false;
    }
  }

  const serverReady = Boolean(form.host && form.username && (form.password || connection?.hasPassword));
  const senderReady = Boolean(form.fromName && form.fromEmail);

  return {
    connection: connection ?? null,
    isLoading,
    form,
    update,
    applyProvider,
    save,
    trySave,
    serverReady,
    senderReady,
    dirty: Object.keys(overrides).length > 0,
    reset: () => setOverrides({}),
  };
}

/** Send-a-test panel — the only proof that any of the settings above are right. */
function useConnectionTest() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [testEmail, setTestEmail] = useState('');

  const test = useMutation({
    mutationFn: () => testEmailConnection({ tenantId: tenantId ?? undefined, ...(testEmail ? { toEmail: testEmail } : {}) }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-connection') });
      toast('success', testEmail ? `It works — test email sent to ${testEmail}.` : 'It works — the mail server accepted the connection.');
    },
    onError: (error) =>
      toast(
        'error',
        error instanceof Error ? error.message : 'DUMA couldn’t connect to the mail server. Check the settings and try again.',
      ),
  });

  return { testEmail, setTestEmail, test };
}

function ConnectionStatus({ connection }: { connection: EmailConnection | null }) {
  const checked = relativeTime(connection?.lastTestedAt);
  const succeeded = connection?.lastTestSucceeded;
  return (
    <div className="flex items-start gap-3">
      {succeeded ? (
        <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
      ) : succeeded === false ? (
        <AlertCircle size={20} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
      ) : (
        <Clock3 size={20} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {succeeded ? 'Verified — email is ready' : succeeded === false ? 'The last check failed' : 'Not checked yet'}
        </p>
        {checked && <p className="text-xs text-muted-foreground">Checked {checked}</p>}
        {connection?.lastTestError && <p className="mt-2 text-xs text-destructive">{connection.lastTestError}</p>}
      </div>
    </div>
  );
}

function TestPanel({ connection }: { connection: EmailConnection | null }) {
  const user = useAuthStore((state) => state.user);
  const { testEmail, setTestEmail, test } = useConnectionTest();
  return (
    <div className="space-y-3">
      <Input
        label="Send a test to"
        type="email"
        value={testEmail}
        onChange={(event) => setTestEmail(event.target.value)}
        placeholder={user?.email ?? 'you@example.com'}
        hint="Leave blank to check the connection without sending anything."
      />
      <Button variant="outline" disabled={!connection || test.isPending} onClick={() => test.mutate()} className="gap-2">
        {test.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
        {test.isPending ? 'Checking…' : testEmail ? 'Check and send test' : 'Check connection'}
      </Button>
      {!connection && <p className="text-xs text-muted-foreground">Save the settings first, then run a check.</p>}
    </div>
  );
}

// ── Field groups, shared by the wizard steps and the manage page ──────────────

function ServerFields({
  form,
  update,
  hasPassword,
  idPrefix,
}: {
  form: EmailConnectionPayload;
  update: <K extends keyof EmailConnectionPayload>(key: K, value: EmailConnectionPayload[K]) => void;
  hasPassword: boolean;
  idPrefix: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <Input
          id={`${idPrefix}-host`}
          label="Mail server"
          value={form.host}
          onChange={(event) => update('host', event.target.value)}
          placeholder="smtp.yourprovider.com"
        />
        <Input
          id={`${idPrefix}-port`}
          label="Port"
          type="number"
          value={form.port}
          onChange={(event) => update('port', Number(event.target.value))}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${idPrefix}-security`} className="block text-label uppercase text-muted-foreground">
          Encryption
        </label>
        <Select
          id={`${idPrefix}-security`}
          value={form.security}
          onValueChange={(value) => update('security', value as EmailConnectionPayload['security'])}
          options={[
            { value: 'starttls', label: 'STARTTLS — usual choice (port 587)' },
            { value: 'tls', label: 'TLS/SSL (port 465)' },
            { value: 'none', label: 'None — development only' },
          ]}
          ariaLabel="Encryption"
          className="w-full"
        />
      </div>
      <Input
        id={`${idPrefix}-username`}
        label="Username"
        value={form.username}
        onChange={(event) => update('username', event.target.value)}
        hint="Usually the full email address."
      />
      <Input
        id={`${idPrefix}-password`}
        label="Password"
        type="password"
        value={form.password ?? ''}
        onChange={(event) => update('password', event.target.value)}
        placeholder={hasPassword ? 'Leave blank to keep the saved password' : ''}
      />
    </div>
  );
}

function SenderFields({
  form,
  update,
  idPrefix,
}: {
  form: EmailConnectionPayload;
  update: <K extends keyof EmailConnectionPayload>(key: K, value: EmailConnectionPayload[K]) => void;
  idPrefix: string;
}) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id={`${idPrefix}-from-name`}
          label="From name"
          value={form.fromName}
          onChange={(event) => update('fromName', event.target.value)}
          hint="Shown as the sender."
        />
        <Input
          id={`${idPrefix}-from-email`}
          label="From email"
          type="email"
          value={form.fromEmail}
          onChange={(event) => update('fromEmail', event.target.value)}
        />
      </div>
      <Input
        id={`${idPrefix}-reply-to`}
        label="Reply-to (optional)"
        type="email"
        value={form.replyTo ?? ''}
        onChange={(event) => update('replyTo', event.target.value)}
        hint="Where customer replies should land, if different."
      />
      <div className="flex items-center justify-between gap-4 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-3">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">Send emails</span>
          <span className="block text-xs text-muted-foreground">Off holds everything — automations wait until you turn it back on.</span>
        </span>
        <Switch label="Send emails" checked={form.isEnabled} onChange={(value) => update('isEnabled', value)} />
      </div>
    </div>
  );
}

// ── Connect wizard ────────────────────────────────────────────────────────────

export function EmailConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { connection, form, update, applyProvider, trySave, serverReady, senderReady, dirty } = useEmailConnectionForm();
  const [provider, setProvider] = useState<ProviderKey | null>(null);

  const steps: WizardStep[] = [
    {
      key: 'provider',
      title: 'Who sends your email?',
      description: 'Pick your mail provider and we’ll fill in the server settings it expects. Nothing is saved yet.',
      ready: provider !== null,
      content: (
        <ProviderGrid
          ariaLabel="Mail provider"
          options={PROVIDERS.map(({ value, label, icon, hint }) => ({ value, label, icon, hint }))}
          value={provider}
          onChange={(value) => {
            setProvider(value);
            const chosen = PROVIDERS.find((item) => item.value === value);
            if (chosen) applyProvider(chosen);
          }}
        />
      ),
    },
    {
      key: 'server',
      title: 'Sign in to the mailbox',
      description: 'These are the outgoing (SMTP) details from your provider — not your website or POS login.',
      ready: serverReady,
      content: <ServerFields form={form} update={update} hasPassword={Boolean(connection?.hasPassword)} idPrefix="wizard" />,
    },
    {
      key: 'sender',
      title: 'How customers see you',
      description: 'The name and address on every email that goes out. Save this and we can run a real check next.',
      ready: senderReady,
      continueLabel: 'Save and continue',
      onContinue: trySave,
      content: <SenderFields form={form} update={update} idPrefix="wizard" />,
    },
    {
      key: 'test',
      title: 'Prove it works',
      description: 'Send yourself one email. If it lands, every template and automation will too.',
      skippable: true,
      continueLabel: 'Finish setup',
      content: (
        <div className="space-y-5">
          <div className={panelClass}>
            <ConnectionStatus connection={connection} />
          </div>
          <TestPanel connection={connection} />
        </div>
      ),
    },
  ];

  return (
    <ConnectWizard
      eyebrow="Connect"
      title="Email"
      icon={<Mail size={20} aria-hidden="true" />}
      dirty={dirty}
      steps={steps}
      onClose={onClose}
      onFinish={onDone}
      rail={
        <WizardRail
          icon={Mail}
          name={DEFINITION.name}
          tagline={DEFINITION.tagline}
          requirements={DEFINITION.requirements}
          footnote={
            <>
              Templates, automations and the delivery log live in{' '}
              <Link href="/communications" className="font-medium text-primary hover:underline">
                Communications
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

const USES = [
  { href: '/communications?tab=templates', icon: Mail, title: 'Templates', description: 'The emails themselves.' },
  { href: '/communications?tab=automations', icon: Sparkles, title: 'Automations', description: 'When each template is sent.' },
  { href: '/communications?tab=history', icon: Send, title: 'History', description: 'Every email that went out.' },
  { href: '/communications?tab=suppressions', icon: ShieldOff, title: 'Suppressions', description: 'Addresses we never email.' },
];

export function EmailConnectorPage({ onClose, onReconnect }: { onClose: () => void; onReconnect: () => void }) {
  const { connection, isLoading, form, update, save, serverReady, senderReady, dirty, reset } = useEmailConnectionForm();
  const state = emailConnectorState(connection);
  const [editingServer, setEditingServer] = useState(false);
  const checked = relativeTime(connection?.lastTestedAt);
  const security = { starttls: 'STARTTLS', tls: 'TLS/SSL', none: 'No encryption' }[form.security];

  const status =
    state === 'attention'
      ? { dot: 'bg-exception', text: 'The last check failed' }
      : state === 'paused'
        ? { dot: 'bg-stock', text: 'Paused — nothing is being sent' }
        : connection?.lastTestSucceeded
          ? { dot: 'bg-success', text: `Working${checked ? ` · checked ${checked}` : ''}` }
          : { dot: 'bg-muted-foreground/60', text: 'Not checked yet — send a test to be sure' };

  return (
    <EditorShell
      eyebrow="Connector"
      title="Email"
      icon={<Mail size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty}
      actions={
        <Button variant="outline" className="h-9 gap-1.5" onClick={onReconnect}>
          <Zap size={15} aria-hidden="true" />
          <span className="hidden md:inline">Run setup again</span>
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        {/* Who emails come from, and whether it works — no card, it is the page's headline. */}
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'flex size-14 shrink-0 items-center justify-center rounded-xl',
              state === 'attention' ? 'bg-exception/8 text-exception' : 'bg-primary/8 text-primary',
            )}
          >
            <Mail size={26} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xl font-semibold tracking-headline text-foreground">
              {isLoading ? (
                // The headline's own line, waiting for the sender — not a word standing in for it.
                <span role="status" aria-busy="true" aria-label="Loading the email connection" className="flex h-7 items-center">
                  <Bone className="h-5 w-64 max-w-full" />
                </span>
              ) : connection ? (
                `Sending from ${connection.fromEmail || connection.username}`
              ) : (
                'Email isn’t set up'
              )}
            </p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <span className={cn('size-1.5 rounded-full', status.dot)} aria-hidden="true" />
              {status.text}
            </p>
            {connection?.lastTestError && state === 'attention' && (
              <p className="mt-1 text-xs text-exception">{connection.lastTestError}</p>
            )}
          </div>
        </div>

        <SettingsTabBody
          aside={
            <>
              <SettingsSection title="Send a test">
                <TestPanel connection={connection} />
              </SettingsSection>
              <SettingsSection title="Used for">
                <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {USES.map(({ href, icon: Icon, title, description }) => (
                    <li key={href}>
                      <Link
                        href={href}
                        className="flex h-full items-center gap-3 rounded-lg border border-rule/50 bg-background/60 px-3 py-2.5 transition-colors hover:border-rule hover:bg-band/45"
                      >
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-foreground">{title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{description}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </SettingsSection>
            </>
          }
        >
          <SettingsSection title="Sender">
            <SenderFields form={form} update={update} idPrefix="manage" />
          </SettingsSection>

          <SettingsSection
            title="Mail server"
            actions={
              <Button variant={editingServer ? 'ghost' : 'outline'} size="sm" onClick={() => setEditingServer((open) => !open)}>
                {editingServer ? 'Close' : 'Change'}
              </Button>
            }
          >
            {editingServer ? (
              <ServerFields form={form} update={update} hasPassword={Boolean(connection?.hasPassword)} idPrefix="manage" />
            ) : (
              // It rarely changes, so it reads as one line until you ask to edit it.
              <div className="flex items-center gap-3 rounded-lg border border-rule/50 bg-background/60 px-3.5 py-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                  <Server size={18} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{form.host || 'No server set'}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    Port {form.port} · {security}
                    {form.username ? ` · ${form.username}` : ''}
                  </span>
                </span>
              </div>
            )}
          </SettingsSection>
        </SettingsTabBody>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        disabled={!serverReady || !senderReady || isLoading}
        onSave={() =>
          save.mutate(undefined, {
            onSuccess: () => {
              toast('success', 'Email settings saved.');
              reset();
              setEditingServer(false);
            },
            onError: (error) => toast('error', error.message),
          })
        }
        onDiscard={() => {
          reset();
          setEditingServer(false);
        }}
      />
    </EditorShell>
  );
}
