'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, CheckCircle2, Clock3, Loader2, Send, Server } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type EmailConnectionPayload, getEmailConnection, saveEmailConnection, testEmailConnection } from '@/lib/api/email.service';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { labelClass, panelClass } from './shared';

/** One-click host/port defaults for the mail providers small businesses actually use. */
const PROVIDERS: { key: string; label: string; host: string; port: number; security: EmailConnectionPayload['security']; hint: string }[] =
  [
    {
      key: 'gmail',
      label: 'Gmail / Google Workspace',
      host: 'smtp.gmail.com',
      port: 587,
      security: 'starttls',
      hint: 'Use an App Password, not your normal Google password.',
    },
    {
      key: 'microsoft',
      label: 'Microsoft 365 / Outlook',
      host: 'smtp.office365.com',
      port: 587,
      security: 'starttls',
      hint: 'Your username is the full email address.',
    },
    {
      key: 'other',
      label: 'Another provider',
      host: '',
      port: 587,
      security: 'starttls',
      hint: 'Your host will give you a server name, port, username and password.',
    },
  ];

export function ConnectionPanel() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const { data: connection, isLoading } = useQuery({
    queryKey: ['email-connection', tenantId],
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const [overrides, setOverrides] = useState<Partial<EmailConnectionPayload>>({});
  const [testEmail, setTestEmail] = useState('');
  const [providerHint, setProviderHint] = useState<string | null>(null);

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

  const save = useMutation({
    mutationFn: () =>
      saveEmailConnection({
        ...form,
        tenantId: tenantId ?? undefined,
        replyTo: form.replyTo || null,
        ...(form.password ? {} : { password: undefined }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connection'] });
      setOverrides((current) => ({ ...current, password: '' }));
      toast('success', 'Saved. Now send yourself a test to confirm it works.');
    },
    onError: (error) => toast('error', error.message),
  });
  const test = useMutation({
    mutationFn: () => testEmailConnection({ tenantId: tenantId ?? undefined, ...(testEmail ? { toEmail: testEmail } : {}) }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-connection'] });
      toast('success', testEmail ? `Connection works — test email sent to ${testEmail}.` : 'Connection works.');
    },
    onError: (error) => toast('error', error.message),
  });

  const update = <K extends keyof EmailConnectionPayload>(key: K, value: EmailConnectionPayload[K]) =>
    setOverrides((current) => ({ ...current, [key]: value }));

  const canSave = Boolean(form.host && form.username && form.fromName && form.fromEmail);

  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_0.75fr]">
      <section className={panelClass}>
        <div className="mb-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Server size={18} />
          </div>
          <div>
            <p className="font-semibold">Your sending account</p>
            <p className="text-xs text-muted-foreground">
              Emails go out through your own mail provider, so replies come back to you. Credentials are encrypted and never shown again.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <p className={labelClass}>Start with your provider</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PROVIDERS.map((provider) => (
                <Button
                  key={provider.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setOverrides((current) => ({
                      ...current,
                      ...(provider.host ? { host: provider.host } : {}),
                      port: provider.port,
                      security: provider.security,
                    }));
                    setProviderHint(provider.hint);
                  }}
                >
                  {provider.label}
                </Button>
              ))}
            </div>
            {providerHint && <p className="mt-2 text-xs text-primary">{providerHint}</p>}
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
            <Input
              label="Mail server"
              value={form.host}
              onChange={(event) => update('host', event.target.value)}
              placeholder="smtp.yourprovider.com"
            />
            <Input label="Port" type="number" value={form.port} onChange={(event) => update('port', Number(event.target.value))} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="smtp-security" className={labelClass}>
              Encryption
            </label>
            <Select
              id="smtp-security"
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
            label="Username"
            value={form.username}
            onChange={(event) => update('username', event.target.value)}
            hint="Usually the full email address."
          />
          <Input
            label="Password"
            type="password"
            value={form.password ?? ''}
            onChange={(event) => update('password', event.target.value)}
            placeholder={connection?.hasPassword ? 'Leave blank to keep the saved password' : ''}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="From name"
              value={form.fromName}
              onChange={(event) => update('fromName', event.target.value)}
              hint="Shown as the sender."
            />
            <Input label="From email" type="email" value={form.fromEmail} onChange={(event) => update('fromEmail', event.target.value)} />
          </div>
          <Input
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
          <Button disabled={!canSave || save.isPending || isLoading} onClick={() => save.mutate()} className="gap-2">
            {save.isPending && <Loader2 size={15} className="animate-spin" />}
            {save.isPending ? 'Saving…' : 'Save settings'}
          </Button>
        </div>
      </section>

      <section className={`${panelClass} h-fit`}>
        <p className={labelClass}>Is it working?</p>
        <div className="mt-4 flex items-start gap-3">
          {connection?.lastTestSucceeded ? (
            <CheckCircle2 className="text-success" size={20} />
          ) : connection?.lastTestSucceeded === false ? (
            <AlertCircle className="text-destructive" size={20} />
          ) : (
            <Clock3 className="text-muted-foreground" size={20} />
          )}
          <div>
            <p className="text-sm font-medium">
              {connection?.lastTestSucceeded
                ? 'Verified — email is ready'
                : connection?.lastTestSucceeded === false
                  ? 'Last check failed'
                  : 'Not checked yet'}
            </p>
            {connection?.lastTestedAt && (
              <p className="text-xs text-muted-foreground">{new Date(connection.lastTestedAt).toLocaleString('en-GB')}</p>
            )}
            {connection?.lastTestError && <p className="mt-2 text-xs text-destructive">{connection.lastTestError}</p>}
          </div>
        </div>
        <div className="mt-5 space-y-3 border-t border-border pt-5">
          <Input
            label="Send a test to"
            type="email"
            value={testEmail}
            onChange={(event) => setTestEmail(event.target.value)}
            placeholder={user?.email ?? 'you@example.com'}
            hint="Leave blank to check the connection without sending anything."
          />
          <Button variant="outline" disabled={!connection || test.isPending} onClick={() => test.mutate()} className="gap-2">
            {test.isPending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            {test.isPending ? 'Checking…' : testEmail ? 'Check and send test' : 'Check connection'}
          </Button>
          {!connection && <p className="text-xs text-muted-foreground">Save your settings first, then run a check.</p>}
        </div>
      </section>
    </div>
  );
}
