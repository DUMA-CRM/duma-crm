'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';

import { AlertCircle, Building2, CheckCircle2, Clock3, Loader2, Mail, Send, Server, ShieldOff, Sparkles, Zap } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
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
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConnectWizard, ProviderGrid, WizardRail, type WizardStep } from './ConnectWizard';
import { CONNECTORS_BY_ID, type ConnectorState } from './registry';
import { eyebrowClass, panelClass, relativeTime } from './shared';

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
        <label htmlFor={`${idPrefix}-security`} className="block text-xs font-bold tracking-widest text-muted-foreground">
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
      <label className="flex items-start gap-2.5 text-sm">
        <input
          type="checkbox"
          checked={form.isEnabled}
          onChange={(event) => update('isEnabled', event.target.checked)}
          className="mt-0.5 size-4 rounded accent-primary"
        />
        <span>
          Allow emails to be sent
          <span className="block text-xs text-muted-foreground">
            Untick to hold all email — automations keep queueing but nothing goes out.
          </span>
        </span>
      </label>
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
  const { connection, isLoading, form, update, save, serverReady, senderReady, dirty } = useEmailConnectionForm();
  const state = emailConnectorState(connection);

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
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_0.8fr]">
        <section className={panelClass}>
          <div className="mb-5 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-sm bg-band text-primary">
              <Server size={18} aria-hidden="true" />
            </div>
            <div>
              <p className="font-semibold text-foreground">Your sending account</p>
              <p className="text-xs text-muted-foreground">
                Emails go out through your own mail provider, so replies come back to you. Credentials are encrypted and never shown again.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <ServerFields form={form} update={update} hasPassword={Boolean(connection?.hasPassword)} idPrefix="manage" />
            <div className="border-t border-rule pt-4">
              <SenderFields form={form} update={update} idPrefix="manage" />
            </div>
            <Button disabled={!serverReady || !senderReady || save.isPending || isLoading} onClick={() => save.mutate()} className="gap-2">
              {save.isPending && <Loader2 size={15} className="animate-spin" aria-hidden="true" />}
              {save.isPending ? 'Saving…' : 'Save settings'}
            </Button>
            {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
          </div>
        </section>

        <div className="space-y-5">
          <section className={panelClass}>
            <p className={eyebrowClass}>Is it working?</p>
            <div className="mt-4">
              <ConnectionStatus connection={connection} />
            </div>
            <div className="mt-5 border-t border-rule pt-5">
              <TestPanel connection={connection} />
            </div>
          </section>

          {state === 'paused' && (
            <section className="rounded-sm border border-warning/30 bg-warning/5 p-5">
              <p className="text-sm font-medium text-foreground">Sending is paused</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Automations keep queueing but nothing leaves the building. Tick “Allow emails to be sent” and save to resume.
              </p>
            </section>
          )}

          <section className={panelClass}>
            <p className={eyebrowClass}>Where this is used</p>
            <ul className="mt-3 space-y-1">
              {USES.map(({ href, icon: Icon, title, description }) => (
                <li key={href}>
                  <Link href={href} className="flex items-center gap-3 rounded-sm px-2 py-2.5 transition-colors hover:bg-band">
                    <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground">{title}</span>
                      <span className="block text-xs text-muted-foreground">{description}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </EditorShell>
  );
}
