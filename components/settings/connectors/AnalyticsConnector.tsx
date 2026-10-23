'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { DumaSays } from '@/components/cms/DumaSays';
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Cloud,
  ExternalLink,
  KeyRound,
  LineChart,
  LogIn,
  Plug,
  RefreshCw,
  Server,
  Trash2,
} from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { MiniBar } from '@/components/shared/MiniBar';
import { LoadingState } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type ExternalAnalyticsData,
  type ExternalAnalyticsProvider,
  deleteAnalyticsConnection,
  getAnalyticsConnection,
  getExternalAnalyticsData,
  saveAnalyticsConnection,
} from '@/lib/modules/analytics/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import {
  type AnalyticsForm,
  EMPTY_ANALYTICS_FORM,
  type FieldHelp,
  HOSTING_CHOICES,
  POSTHOG_US_API,
  PROVIDER_CHOICES,
  SIGN_IN_CHOICES,
  type UmamiHosting,
  type UmamiSignIn,
  analyticsConnectionInput,
  analyticsFormReady,
  analyticsHelp,
  apiUrlProblem,
  formatRate,
  formatVisitDuration,
  setupFrom,
  setupLabel,
  setupOf,
} from '@/lib/utils/analytics-connector';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ConnectWizard, ProviderGrid, WizardRail, type WizardStep } from './ConnectWizard';
import { CONNECTORS_BY_ID } from './registry';
import { panelClass } from './shared';

const DEFINITION = CONNECTORS_BY_ID.analytics;
const ICONS = { umami: BarChart3, posthog: LineChart, cloud: Cloud, self: Server, apiKey: KeyRound, login: LogIn } as const;

const connectionKey = (tenantId?: string | null) => moduleQueryKeys.analytics.key('external-connection', tenantId);

/**
 * The onboarding shape, one question per screen: Umami or PostHog, then for
 * Umami where it runs, then for a self-hosted one how DUMA signs in — and
 * only then the fields, each with where to find it.
 */
export function AnalyticsConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const [provider, setProvider] = useState<ExternalAnalyticsProvider | null>(null);
  const [hosting, setHosting] = useState<UmamiHosting | null>(null);
  const [signIn, setSignIn] = useState<UmamiSignIn | null>(null);
  const [form, setForm] = useState<AnalyticsForm>(EMPTY_ANALYTICS_FORM);
  const [addressTouched, setAddressTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setup = setupFrom(provider, hosting);
  const method = signIn ?? 'apiKey';
  const save = useMutation({
    mutationFn: () => saveAnalyticsConnection(analyticsConnectionInput(setup!, method, form), tenantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: connectionKey(tenantId) });
      toast('success', 'Analytics connected and checked.');
    },
  });
  const update = (key: keyof AnalyticsForm, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const choices = <T extends keyof typeof ICONS>(options: readonly { value: T; label: string; hint: string }[]) =>
    options.map(({ value, label, hint }) => ({ value, label, hint, icon: ICONS[value] }));

  const steps: WizardStep[] = [
    {
      key: 'provider',
      title: 'Which analytics do you use?',
      ready: provider !== null,
      content: (
        <ProviderGrid
          ariaLabel="Analytics provider"
          options={choices(PROVIDER_CHOICES)}
          value={provider}
          onChange={(value) => {
            setProvider(value);
            setHosting(null);
            setSignIn(null);
            setError(null);
            setForm({
              ...EMPTY_ANALYTICS_FORM,
              displayName: setupLabel(value === 'posthog' ? 'posthog' : 'umami-cloud'),
              apiUrl: value === 'posthog' ? POSTHOG_US_API : '',
            });
          }}
        />
      ),
    },
  ];
  if (provider === 'umami') {
    steps.push({
      key: 'hosting',
      title: 'Where does your Umami run?',
      description: 'If you sign in at cloud.umami.is, it’s Umami Cloud.',
      ready: hosting !== null,
      content: (
        <ProviderGrid
          ariaLabel="Where Umami runs"
          options={choices(HOSTING_CHOICES)}
          value={hosting}
          onChange={(value) => {
            setHosting(value);
            setSignIn(value === 'cloud' ? 'apiKey' : null);
            setForm((current) => ({ ...current, displayName: setupLabel(value === 'cloud' ? 'umami-cloud' : 'umami-self') }));
          }}
        />
      ),
    });
  }
  if (provider === 'umami' && hosting === 'self') {
    steps.push({
      key: 'sign-in',
      title: 'How should DUMA sign in?',
      description: 'No “API keys” page under Settings in your Umami? Choose username and password.',
      ready: signIn !== null,
      content: <ProviderGrid ariaLabel="How DUMA signs in" options={choices(SIGN_IN_CHOICES)} value={signIn} onChange={setSignIn} />,
    });
  }
  const help = setup ? analyticsHelp(setup, method) : null;
  const addressProblem = setup ? apiUrlProblem(setup, form.apiUrl) : null;
  const providerName = provider === 'posthog' ? 'PostHog' : 'Umami';
  steps.push({
    key: 'details',
    title: provider === 'posthog' ? 'Connect your PostHog project' : 'Connect your Umami website',
    ready: analyticsFormReady(setup, method, form),
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
    content: help && (
      <div className="space-y-5">
        <DumaSays
          line={save.isPending ? `Checking with ${providerName}…` : (error ?? help.intro)}
          busy={save.isPending}
          tone={error && !save.isPending ? 'error' : 'idle'}
          cheer={0}
        />
        {help.link && (
          <a
            href={help.link.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {help.link.label} <ExternalLink size={13} aria-hidden="true" />
          </a>
        )}
        {help.address && (
          <Field help={help.address}>
            <Input
              label={setup === 'umami-self' ? 'Umami address' : 'API address'}
              inputMode="url"
              placeholder={setup === 'umami-self' ? 'https://stats.yourcafe.com' : POSTHOG_US_API}
              value={form.apiUrl}
              onChange={(event) => update('apiUrl', event.target.value)}
              onBlur={() => setAddressTouched(true)}
              error={addressTouched && addressProblem ? addressProblem : undefined}
            />
          </Field>
        )}
        <Field help={help.siteId}>
          <Input
            label={provider === 'posthog' ? 'Project ID' : 'Website ID'}
            value={form.siteId}
            onChange={(event) => update('siteId', event.target.value)}
          />
        </Field>
        <Field help={help.credential}>
          {method === 'login' ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Input
                label="Username"
                autoComplete="off"
                value={form.username}
                onChange={(event) => update('username', event.target.value)}
              />
              <Input
                label="Password"
                type="password"
                autoComplete="new-password"
                value={form.password}
                onChange={(event) => update('password', event.target.value)}
              />
            </div>
          ) : (
            <Input
              label="API key"
              type="password"
              autoComplete="new-password"
              value={form.apiKey}
              onChange={(event) => update('apiKey', event.target.value)}
            />
          )}
        </Field>
        <Input label="Connection name" value={form.displayName} onChange={(event) => update('displayName', event.target.value)} />
      </div>
    ),
  });

  return (
    <ConnectWizard
      eyebrow="Analytics connector"
      title="Connect web analytics"
      icon={<BarChart3 size={20} aria-hidden="true" />}
      rail={<WizardRail requirements={DEFINITION.requirements} />}
      steps={steps}
      onClose={onClose}
      onFinish={onDone}
      dirty={Boolean(form.apiKey || form.password)}
    />
  );
}

/** A field with where to find its value underneath: the menu path, then one line. */
function Field({ help, children }: { help: FieldHelp; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      {children}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
        {help.path && (
          <span className="flex items-center gap-1" aria-label={`Find it in ${help.path.join(', then ')}`}>
            {help.path.map((part, index) => (
              <span key={part} className="flex items-center gap-1">
                {index > 0 && <ChevronRight size={11} aria-hidden="true" />}
                <span className="rounded border border-rule/60 bg-band/60 px-1.5 py-px font-medium text-foreground">{part}</span>
              </span>
            ))}
          </span>
        )}
        <span>{help.text}</span>
      </div>
    </div>
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
          <Button size="sm" variant="outline" className="mt-3" onClick={() => void connection.refetch()}>
            Try again
          </Button>
        </div>
      ) : connection.data ? (
        <div className="space-y-5">
          <section className={panelClass}>
            <div className="flex items-start gap-3">
              <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                <BarChart3 size={18} aria-hidden="true" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold">{connection.data.displayName}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {setupLabel(setupOf(connection.data))} · {connection.data.provider === 'posthog' ? 'Project' : 'Website'}{' '}
                  <span className="font-mono text-xs">{connection.data.siteId}</span>
                </p>
                {connection.data.lastTestedAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Last checked {new Date(connection.data.lastTestedAt).toLocaleString()}
                  </p>
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
          <p className="text-sm text-muted-foreground">
            Connect Umami Cloud, a self-hosted Umami or PostHog. DUMA walks you through finding each value and tests them before saving.
          </p>
          <Button className="mt-4 gap-1.5" onClick={onConnect}>
            <Plug size={15} aria-hidden="true" /> Connect analytics
          </Button>
        </div>
      )}
    </EditorShell>
  );
}

function AnalyticsDataPreview({ data }: { data: ExternalAnalyticsData }) {
  const { summary, daily, website } = data;
  const busiest = Math.max(1, ...daily.map((day) => day.pageviews));
  const tiles = [
    { label: 'Pageviews', value: summary.pageviews?.toLocaleString() ?? '—' },
    { label: 'Visitors', value: summary.visitors?.toLocaleString() ?? '—' },
    { label: 'Bounce rate', value: formatRate(summary.bounceRate) },
    { label: 'Avg. visit', value: formatVisitDuration(summary.avgVisitSeconds) },
  ].filter((tile) => data.provider === 'umami' || tile.value !== '—');
  return (
    <div className="mt-5 space-y-4 border-t border-rule/60 pt-4">
      {website?.name && (
        <p className="text-sm">
          <span className="font-medium">{website.name}</span>
          {website.domain && <span className="text-muted-foreground"> · {website.domain}</span>}
        </p>
      )}
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-lg border border-rule/60 px-3 py-2.5">
            <dt className="text-xs text-muted-foreground">{tile.label}</dt>
            <dd className="mt-1 text-lg font-semibold tabular-nums">{tile.value}</dd>
          </div>
        ))}
      </dl>
      {daily.length === 0 ? (
        <p className="text-sm text-muted-foreground">No visits recorded in the last seven days. Is the tracking snippet on your website?</p>
      ) : (
        <table className="w-full text-sm">
          <caption className="sr-only">Pageviews and visitors per day</caption>
          <thead>
            <tr className="text-left text-xs text-muted-foreground">
              <th scope="col" className="pb-1.5 font-medium">
                Day
              </th>
              <th scope="col" className="w-1/2 pb-1.5 font-medium">
                Pageviews
              </th>
              <th scope="col" className="pb-1.5 text-right font-medium">
                Visitors
              </th>
            </tr>
          </thead>
          <tbody>
            {daily.map((day) => (
              <tr key={day.date} className="border-t border-rule/40">
                <td className="py-1.5 tabular-nums">
                  {new Date(`${day.date}T00:00:00Z`).toLocaleDateString(undefined, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    timeZone: 'UTC',
                  })}
                </td>
                <td className="py-1.5">
                  <div className="flex items-center gap-2">
                    <MiniBar value={day.pageviews} max={busiest} label={`${day.pageviews} pageviews`} className="flex-1" />
                    <span className="w-10 text-right tabular-nums">{day.pageviews.toLocaleString()}</span>
                  </div>
                </td>
                <td className="py-1.5 text-right tabular-nums">{day.visitors.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="text-xs text-muted-foreground">Data stays in your analytics provider; DUMA fetches it when requested.</p>
    </div>
  );
}
