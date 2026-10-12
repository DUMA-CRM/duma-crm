'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, BarChart3, CheckCircle2, Plug, RefreshCw, Trash2 } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  deleteAnalyticsConnection,
  getAnalyticsConnection,
  getExternalAnalyticsData,
  saveAnalyticsConnection,
  type ExternalAnalyticsData,
  type ExternalAnalyticsProvider,
} from '@/lib/modules/analytics/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConnectWizard, ProviderGrid, WizardRail, type WizardStep } from './ConnectWizard';
import { CONNECTORS_BY_ID } from './registry';
import { panelClass } from './shared';

const DEFINITION = CONNECTORS_BY_ID.analytics;
const PROVIDERS = [
  { value: 'umami', label: 'Umami', hint: 'Umami Cloud or a self-hosted instance.', apiUrl: 'https://api.umami.is/v1' },
  { value: 'posthog', label: 'PostHog', hint: 'US Cloud, EU Cloud or self-hosted.', apiUrl: 'https://us.posthog.com' },
] as const;

const connectionKey = (tenantId?: string | null) => moduleQueryKeys.analytics.key('external-connection', tenantId);

export function AnalyticsConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<ExternalAnalyticsProvider | null>(null);
  const [form, setForm] = useState({ displayName: '', siteId: '', apiUrl: '', apiKey: '' });
  const [error, setError] = useState<string | null>(null);
  const selected = PROVIDERS.find((item) => item.value === provider);
  const ready = Boolean(provider && form.displayName.trim() && form.siteId.trim() && form.apiKey.trim());
  const save = useMutation({
    mutationFn: () =>
      saveAnalyticsConnection(
        {
          provider: provider!,
          displayName: form.displayName.trim(),
          siteId: form.siteId.trim(),
          apiUrl: form.apiUrl.trim() || selected?.apiUrl,
          apiKey: form.apiKey.trim(),
        },
        tenantId,
      ),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: connectionKey(tenantId) });
      toast('success', 'Analytics connected and checked.');
    },
  });
  const update = (key: keyof typeof form, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const steps: WizardStep[] = [
    {
      key: 'provider',
      title: 'Which analytics service do you use?',
      description: 'Choose the provider that collects your website or product usage data.',
      ready: provider !== null,
      content: (
        <ProviderGrid
          ariaLabel="Analytics provider"
          options={PROVIDERS.map(({ value, label, hint }) => ({ value, label, icon: BarChart3, hint }))}
          value={provider}
          onChange={(value) => {
            setProvider(value);
            const item = PROVIDERS.find((option) => option.value === value);
            setForm((current) => ({ ...current, displayName: item?.label ?? '', apiUrl: item?.apiUrl ?? '' }));
          }}
        />
      ),
    },
    {
      key: 'details',
      title: 'Connect your analytics project',
      description:
        provider === 'umami'
          ? 'Create a read-only API key in Umami, then copy the website ID from its settings.'
          : 'Create a personal API key in PostHog and copy the project ID from Project settings.',
      ready,
      continueLabel: save.isPending ? 'Checking…' : 'Connect and test',
      onContinue: async () => {
        setError(null);
        try {
          await save.mutateAsync();
          return true;
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : 'Could not connect analytics.');
          return false;
        }
      },
      content: (
        <div className="space-y-4">
          <Input label="Connection name" autoFocus value={form.displayName} onChange={(event) => update('displayName', event.target.value)} />
          <Input
            label={provider === 'umami' ? 'Website ID' : 'Project ID'}
            value={form.siteId}
            onChange={(event) => update('siteId', event.target.value)}
            hint={provider === 'umami' ? 'Found in the website settings in Umami.' : 'Found in PostHog under Project settings.'}
          />
          <Input
            label="API address"
            value={form.apiUrl}
            placeholder={selected?.apiUrl}
            onChange={(event) => update('apiUrl', event.target.value)}
            hint="Use the default for cloud accounts, or enter your self-hosted instance address."
          />
          <Input
            label="Read-only API key"
            type="password"
            autoComplete="new-password"
            value={form.apiKey}
            onChange={(event) => update('apiKey', event.target.value)}
            hint="Encrypted when saved. DUMA checks the key and does not show it again."
          />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>
      ),
    },
  ];

  return (
    <ConnectWizard
      eyebrow="Analytics connector"
      title="Connect web analytics"
      icon={<BarChart3 size={20} aria-hidden="true" />}
      rail={<WizardRail requirements={DEFINITION.requirements} />}
      steps={steps}
      onClose={onClose}
      onFinish={onDone}
      dirty={Boolean(form.apiKey)}
    />
  );
}

export function AnalyticsConnectorPage({ onClose, onConnect }: { onClose: () => void; onConnect: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const key = connectionKey(tenantId);
  const connection = useQuery({
    queryKey: key,
    queryFn: () => getAnalyticsConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });
  const data = useMutation({ mutationFn: () => getExternalAnalyticsData(tenantId ?? undefined) });
  const remove = useMutation({
    mutationFn: () => deleteAnalyticsConnection(tenantId ?? undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      data.reset();
      toast('success', 'Analytics disconnected.');
    },
    onError: (failure) => toast('error', failure.message),
  });

  return (
    <EditorShell
      eyebrow="Connector"
      title="Web analytics"
      icon={<BarChart3 size={20} aria-hidden="true" />}
      onClose={onClose}
      actions={
        connection.data ? (
          <div className="flex gap-2">
            <Button variant="outline" className="h-9 gap-1.5" onClick={onConnect}>
              <Plug size={15} aria-hidden="true" /> Change connection
            </Button>
            <Button variant="outline" className="h-9 gap-1.5" disabled={remove.isPending} onClick={() => remove.mutate()}>
              <Trash2 size={15} aria-hidden="true" /> Disconnect
            </Button>
          </div>
        ) : (
          <Button className="h-9 gap-1.5" onClick={onConnect}>
            <Plug size={15} aria-hidden="true" /> Connect
          </Button>
        )
      }
    >
      {connection.isPending ? (
        <LoadingState label="Loading analytics connection" />
      ) : connection.isError ? (
        <div className={panelClass}>
          <p className="text-sm">The analytics connection couldn’t be loaded.</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void connection.refetch()}>Try again</Button>
        </div>
      ) : connection.data ? (
        <div className="space-y-5">
          <section className={panelClass}>
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><BarChart3 size={18} aria-hidden="true" /></span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{connection.data.displayName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {connection.data.provider === 'umami' ? 'Umami' : 'PostHog'} · Project {connection.data.siteId}
                </p>
                {connection.data.lastTestedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">Last checked {new Date(connection.data.lastTestedAt).toLocaleString()}</p>
                )}
              </div>
              <CheckCircle2 className="text-success" size={18} aria-label="Connected" />
            </div>
          </section>
          <section className={panelClass}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Fetch analytics data</h2>
                <p className="mt-1 text-sm text-muted-foreground">Retrieve the last seven days from your connected project.</p>
              </div>
              <Button variant="outline" className="gap-1.5" disabled={data.isPending} onClick={() => data.mutate()}>
                <RefreshCw size={15} aria-hidden="true" className={data.isPending ? 'animate-spin' : undefined} />
                {data.isPending ? 'Fetching…' : 'Fetch now'}
              </Button>
            </div>
            {data.isError && (
              <p role="alert" className="mt-4 flex gap-2 text-sm text-destructive">
                <AlertTriangle size={16} className="shrink-0" aria-hidden="true" /> {data.error.message}
              </p>
            )}
            {data.data && <AnalyticsDataPreview data={data.data} />}
          </section>
        </div>
      ) : (
        <div className={panelClass}>
          <p className="text-sm text-muted-foreground">Connect Umami or PostHog to test the credentials and fetch a seven-day sample.</p>
          <Button className="mt-4 gap-1.5" onClick={onConnect}><Plug size={15} aria-hidden="true" /> Connect analytics</Button>
        </div>
      )}
    </EditorShell>
  );
}

function AnalyticsDataPreview({ data }: { data: ExternalAnalyticsData }) {
  const lines = Object.entries(data)
    .filter(([key]) => key !== 'provider' && key !== 'columns')
    .map(([key, value]) => [key, JSON.stringify(value)] as const);
  return (
    <div className="mt-5 space-y-2 border-t border-rule/60 pt-4">
      {lines.map(([key, value]) => (
        <div key={key} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
          <span className="text-xs font-medium capitalize text-muted-foreground">{key}</span>
          <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded bg-band/60 p-2 text-xs">{value}</pre>
        </div>
      ))}
      <p className="text-xs text-muted-foreground">Data stays in your analytics provider; DUMA fetches it when requested.</p>
    </div>
  );
}
