'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { InfoRow, InfoRows } from '@/components/cms/rows';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock3,
  ExternalLink,
  KeyRound,
  Loader2,
  Mail,
  Plug,
  Send,
  Server,
  ShieldOff,
  Sparkles,
  Zap,
} from '@/components/icons';
import { useSettingsTenantId } from '@/components/settings/SettingsScope';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SaveBar, Switch } from '@/components/settings/controls';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type EmailConnection,
  type EmailConnectionPayload,
  getEmailConnection,
  saveEmailConnection,
  testEmailConnection,
} from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { emailConnectorState } from '@/lib/utils/connector-state';
import { useAuthStore } from '@/stores/authStore';

import { ConnectWizard, ProviderGrid, WizardInstruction, WizardRail, type WizardStep } from './ConnectWizard';
import { ConnectorManagePage, type ConnectorStatus } from './ConnectorManagePage';
import { PROVIDER_BRANDS, PROVIDER_COLOURS } from './brands';
import { useStoredDraft } from './draft';
import { CONNECTORS_BY_ID } from './registry';
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
    hint: 'Needs an App Password',
  },
  {
    value: 'microsoft',
    label: 'Microsoft 365',
    icon: Building2,
    host: 'smtp.office365.com',
    port: 587,
    security: 'starttls' as const,
    hint: 'SMTP AUTH must be on',
  },
  {
    value: 'other',
    label: 'Another provider',
    icon: Server,
    host: '',
    port: 587,
    security: 'starttls' as const,
    hint: 'Your host’s SMTP details',
  },
];

type ProviderKey = (typeof PROVIDERS)[number]['value'];

export { emailConnectorState };

/**
 * The saved connection plus whatever the person is currently typing, as one
 * object. Both the wizard and the manage page drive the same fields, so they
 * share the form rather than each keeping their own copy of the rules.
 */
function useEmailConnectionForm({ keep = false }: { keep?: boolean } = {}) {
  const capabilities = useAuthStore((state) => state.capabilities);
  const tenantId = useSettingsTenantId();
  const queryClient = useQueryClient();
  const { data: connection, isLoading } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId && hasCapability(capabilities, 'email.connections:read'),
    retry: false,
    meta: { silentForbidden: true },
  });

  // Everything but the password survives leaving the wizard; the password is a secret, so it never does.
  const kept = useStoredDraft<Partial<Omit<EmailConnectionPayload, 'password'>>>(keep && tenantId ? `email:${tenantId}` : null, {});
  const [password, setPassword] = useState<string | undefined>(undefined);
  const overrides: Partial<EmailConnectionPayload> = { ...kept.value, ...(password !== undefined ? { password } : {}) };
  const setOverrides = (next: (current: Partial<EmailConnectionPayload>) => Partial<EmailConnectionPayload>) => {
    const { password: nextPassword, ...rest } = next(overrides);
    kept.set(rest);
    setPassword(nextPassword);
  };

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
      kept.clear();
      setPassword(undefined);
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
    reset: () => {
      kept.clear();
      setPassword(undefined);
    },
  };
}

/** Send-a-test panel — the only proof that any of the settings above are right. */
function useConnectionTest() {
  const tenantId = useSettingsTenantId();
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
        hint="Leave blank to check without sending."
      />
      <Button variant="outline" disabled={!connection || test.isPending} onClick={() => test.mutate()} className="gap-2">
        {test.isPending ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Send size={15} aria-hidden="true" />}
        {test.isPending ? 'Checking…' : testEmail ? 'Check and send test' : 'Check connection'}
      </Button>
    </div>
  );
}

// ── Field groups, shared by the wizard steps and the manage page ──────────────

function ServerFields({
  form,
  update,
  hasPassword,
  idPrefix,
  passwordAction,
}: {
  form: EmailConnectionPayload;
  update: <K extends keyof EmailConnectionPayload>(key: K, value: EmailConnectionPayload[K]) => void;
  hasPassword: boolean;
  idPrefix: string;
  /** A link inside the password field — where to make an app password. */
  passwordAction?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      {/* Where the mail goes out from. */}
      <div className="space-y-3">
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
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor={`${idPrefix}-security`}>Encryption</FieldLabel>
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
      </div>
      {/* Who it signs in as. */}
      <div className="space-y-3">
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
          className={passwordAction ? 'pr-44' : undefined}
          rightAction={passwordAction}
        />
      </div>
    </div>
  );
}

function SenderFields({
  form,
  update,
  idPrefix,
  showSwitch = true,
}: {
  form: EmailConnectionPayload;
  update: <K extends keyof EmailConnectionPayload>(key: K, value: EmailConnectionPayload[K]) => void;
  idPrefix: string;
  /** A new connection always sends; only the manage page pauses it. */
  showSwitch?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          id={`${idPrefix}-from-name`}
          label="From name"
          value={form.fromName}
          onChange={(event) => update('fromName', event.target.value)}
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
        hint="If replies should go somewhere else."
      />
      {showSwitch && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-rule/50 bg-field px-3 py-2.5">
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">Send emails</span>
            <span className="block text-xs text-muted-foreground">Off holds everything — automations wait until you turn it back on.</span>
          </span>
          <Switch label="Send emails" checked={form.isEnabled} onChange={(value) => update('isEnabled', value)} />
        </div>
      )}
    </div>
  );
}

// ── Connect wizard ────────────────────────────────────────────────────────────

export function EmailConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const { connection, form, update, applyProvider, trySave, serverReady, senderReady, reset } = useEmailConnectionForm({ keep: true });
  const tenantId = useSettingsTenantId();
  const picked = useStoredDraft<{ provider: ProviderKey | null }>(tenantId ? `email-provider:${tenantId}` : null, { provider: null });
  const provider = picked.value.provider;
  const setProvider = (value: ProviderKey) => picked.set({ provider: value });

  const steps: WizardStep[] = [
    {
      key: 'provider',
      label: 'Provider',
      title: 'Choose your email provider',
      ready: provider !== null,
      content: (
        <ProviderGrid
          ariaLabel="Mail provider"
          options={PROVIDERS.map(({ value, label, icon, hint }) => ({
            value,
            label,
            icon,
            hint,
            brand:
              value === 'gmail'
                ? PROVIDER_BRANDS.gmail
                : value === 'microsoft'
                  ? { background: PROVIDER_COLOURS.microsoft, icon: Mail }
                  : undefined,
          }))}
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
      label: 'Mailbox',
      title: 'Sign in to the mailbox',
      ready: serverReady,
      content: (
        <div className="space-y-3">
          <WizardInstruction icon={provider === 'other' ? Server : KeyRound}>
            {provider === 'gmail'
              ? 'Create an App Password in your Google account, then paste it as the password.'
              : provider === 'microsoft'
                ? 'Use the full email address. SMTP AUTH must be turned on for this mailbox.'
                : 'Use the outgoing (SMTP) settings from your email host.'}
          </WizardInstruction>
          <ServerFields
            form={form}
            update={update}
            hasPassword={Boolean(connection?.hasPassword)}
            idPrefix="wizard"
            passwordAction={
              provider === 'gmail' ? (
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/8"
                >
                  Create App Password <ExternalLink size={12} aria-hidden="true" />
                </a>
              ) : undefined
            }
          />
        </div>
      ),
    },
    {
      key: 'sender',
      label: 'Sender',
      title: 'How customers see you',
      ready: senderReady,
      continueLabel: 'Save and continue',
      onContinue: trySave,
      content: <SenderFields form={form} update={update} idPrefix="wizard" showSwitch={false} />,
    },
    {
      key: 'test',
      label: 'Test',
      title: 'Send a test',
      skippable: true,
      continueLabel: 'Finish setup',
      content: (
        <div className="space-y-3">
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
      // Only the password is lost on leaving; the rest is kept for next time.
      dirty={Boolean(form.password)}
      steps={steps}
      onClose={onClose}
      onFinish={() => {
        picked.clear();
        onDone();
      }}
      resumeKey={tenantId ? `email:${tenantId}` : null}
      onStartOver={() => {
        reset();
        picked.clear();
      }}
      rail={<WizardRail requirements={DEFINITION.requirements} />}
    />
  );
}

// ── Manage page ───────────────────────────────────────────────────────────────

const USES = [
  { href: '/communications?tab=templates', icon: Mail, title: 'Templates', description: 'The emails themselves.' },
  { href: '/automation', icon: Sparkles, title: 'Automations', description: 'When each template is sent.' },
  { href: '/communications?tab=history', icon: Send, title: 'History', description: 'Every email that went out.' },
  { href: '/communications?tab=suppressions', icon: ShieldOff, title: 'Suppressions', description: 'Addresses we never email.' },
];

export function EmailConnectorPage({ onClose, onReconnect }: { onClose: () => void; onReconnect: () => void }) {
  const { connection, isLoading, form, update, save, serverReady, senderReady, dirty, reset } = useEmailConnectionForm();
  const state = emailConnectorState(connection);
  const [editingServer, setEditingServer] = useState(false);
  const checked = relativeTime(connection?.lastTestedAt);
  const security = { starttls: 'STARTTLS', tls: 'TLS/SSL', none: 'No encryption' }[form.security];

  const status: ConnectorStatus =
    state === 'attention'
      ? { tone: 'danger', text: 'The last check failed' }
      : state === 'paused'
        ? { tone: 'warning', text: 'Paused — nothing is being sent' }
        : connection?.lastTestSucceeded
          ? { tone: 'success', text: 'Working' }
          : { tone: 'muted', text: 'Not checked yet' };

  return (
    <ConnectorManagePage
      definition={DEFINITION}
      status={connection ? status : undefined}
      loading={isLoading}
      notSetUp={
        !connection ? (
          <div className={panelClass}>
            <p className="text-sm text-muted-foreground">Send order confirmations and offers from your own mailbox.</p>
            <Button className="mt-4 gap-1.5" onClick={onReconnect}>
              <Plug size={15} aria-hidden="true" /> Connect email
            </Button>
          </div>
        ) : undefined
      }
      health={
        connection
          ? {
              facts: [
                { icon: Mail, title: 'Sending from', value: connection.fromEmail || connection.username },
                { icon: Clock3, title: 'Last check', value: checked ?? 'Not checked yet', tone: checked ? undefined : 'warning' },
                { icon: Send, title: 'Emails', value: form.isEnabled ? 'Sending' : 'Paused' },
              ],
              problem: state === 'attention' ? connection.lastTestError : null,
              extra: <TestPanel connection={connection} />,
            }
          : undefined
      }
      usedBy={USES.map(({ href, icon, title }) => ({ icon, label: title, href }))}
      actions={[{ icon: Zap, label: 'Run setup again', onClick: onReconnect }]}
      dirty={dirty}
      onClose={onClose}
      footer={
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
          // It rarely changes, so it reads as one row until you ask to edit it.
          <InfoRows>
            <InfoRow
              icon={Server}
              title={form.host || 'No server set'}
              description={`Port ${form.port} · ${security}${form.username ? ` · ${form.username}` : ''}`}
            >
              {null}
            </InfoRow>
          </InfoRows>
        )}
      </SettingsSection>
    </ConnectorManagePage>
  );
}
