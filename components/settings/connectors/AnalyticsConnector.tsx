'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  BarChart3,
  CheckCircle2,
  ChevronRight,
  Cloud,
  ExternalLink,
  Globe,
  KeyRound,
  LineChart,
  LogIn,
  Plug,
  RefreshCw,
  Server,
} from '@/components/icons';
import { useSettingsTenantId } from '@/components/settings/SettingsScope';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type ExternalAnalyticsProvider,
  checkAnalyticsConnection,
  deleteAnalyticsConnection,
  getAnalyticsConnection,
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
  setupFrom,
  setupLabel,
  setupOf,
} from '@/lib/utils/analytics-connector';

import { Command, ConnectWizard, ProviderGrid, WizardInstruction, WizardRail, type WizardStep } from './ConnectWizard';
import { ConnectorManagePage } from './ConnectorManagePage';
import { type ConnectorBrand, PROVIDER_BRANDS } from './brands';
import { useStoredDraft } from './draft';
import { CONNECTORS_BY_ID } from './registry';
import { panelClass, relativeTime } from './shared';

const DEFINITION = CONNECTORS_BY_ID.analytics;
const ICONS = { umami: BarChart3, posthog: LineChart, cloud: Cloud, self: Server, apiKey: KeyRound, login: LogIn } as const;

const connectionKey = (tenantId?: string | null) => moduleQueryKeys.analytics.key('external-connection', tenantId);

/**
 * The onboarding shape, one question per screen: Umami or PostHog, then for
 * Umami where it runs, then for a self-hosted one how DUMA signs in — and
 * only then the fields, each with where to find it.
 */
/** Umami Cloud is Umami's own; a self-hosted Umami and the sign-in choices keep their icons. */
const BRANDS: Partial<Record<string, ConnectorBrand>> = {
  umami: PROVIDER_BRANDS.umami,
  posthog: PROVIDER_BRANDS.posthog,
  cloud: PROVIDER_BRANDS.umami,
};

export function AnalyticsConnectWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const tenantId = useSettingsTenantId() ?? undefined;
  const queryClient = useQueryClient();
  // The choices and IDs survive leaving the wizard; the API key and password never do.
  const kept = useStoredDraft<{
    provider: ExternalAnalyticsProvider | null;
    hosting: UmamiHosting | null;
    signIn: UmamiSignIn | null;
    form: Omit<AnalyticsForm, 'apiKey' | 'password'>;
  }>(tenantId ? `analytics:${tenantId}` : null, { provider: null, hosting: null, signIn: null, form: EMPTY_ANALYTICS_FORM });
  const [secrets, setSecrets] = useState({ apiKey: '', password: '' });
  const { provider, hosting, signIn } = kept.value;
  const form: AnalyticsForm = { ...EMPTY_ANALYTICS_FORM, ...kept.value.form, ...secrets };
  const restart = () => {
    kept.clear();
    setSecrets({ apiKey: '', password: '' });
  };
  const [addressTouched, setAddressTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setup = setupFrom(provider, hosting);
  const method = signIn ?? 'apiKey';
  const save = useMutation({
    mutationFn: () => saveAnalyticsConnection(analyticsConnectionInput(setup!, method, form), tenantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: connectionKey(tenantId) });
      restart();
      toast('success', 'Analytics connected and checked.');
    },
  });
  const update = (key: keyof AnalyticsForm, value: string) => {
    if (key === 'apiKey' || key === 'password') setSecrets((current) => ({ ...current, [key]: value }));
    else kept.set({ ...kept.value, form: { ...kept.value.form, [key]: value } });
  };
  const choices = <T extends keyof typeof ICONS>(options: readonly { value: T; label: string; hint: string }[]) =>
    options.map(({ value, label, hint }) => ({ value, label, hint, icon: ICONS[value], brand: BRANDS[value] }));

  const steps: WizardStep[] = [
    {
      key: 'provider',
      label: 'Provider',
      title: 'Which analytics do you use?',
      ready: provider !== null,
      content: (
        <ProviderGrid
          ariaLabel="Analytics provider"
          options={choices(PROVIDER_CHOICES)}
          value={provider}
          onChange={(value) => {
            setError(null);
            setSecrets({ apiKey: '', password: '' });
            // One write: a new provider starts its own setup from scratch.
            kept.set({
              provider: value,
              hosting: null,
              signIn: null,
              form: {
                ...EMPTY_ANALYTICS_FORM,
                displayName: setupLabel(value === 'posthog' ? 'posthog' : 'umami-cloud'),
                apiUrl: value === 'posthog' ? POSTHOG_US_API : '',
              },
            });
          }}
        />
      ),
    },
  ];
  if (provider === 'umami') {
    steps.push({
      key: 'hosting',
      label: 'Hosting',
      title: 'Where does your Umami run?',
      ready: hosting !== null,
      content: (
        <div className="space-y-3">
          <WizardInstruction icon={Globe}>
            If you sign in at <Command>cloud.umami.is</Command>, it’s Umami Cloud.
          </WizardInstruction>
          <ProviderGrid
            ariaLabel="Where Umami runs"
            options={choices(HOSTING_CHOICES)}
            value={hosting}
            onChange={(value) => {
              kept.set({
                ...kept.value,
                hosting: value,
                signIn: value === 'cloud' ? 'apiKey' : null,
                form: { ...kept.value.form, displayName: setupLabel(value === 'cloud' ? 'umami-cloud' : 'umami-self') },
              });
            }}
          />
        </div>
      ),
    });
  }
  if (provider === 'umami' && hosting === 'self') {
    steps.push({
      key: 'sign-in',
      label: 'Sign-in',
      title: 'How should DUMA sign in?',
      ready: signIn !== null,
      content: (
        <div className="space-y-3">
          <WizardInstruction icon={KeyRound}>
            No “API keys” page under Settings in your Umami? Choose username and password.
          </WizardInstruction>
          <ProviderGrid
            ariaLabel="How DUMA signs in"
            options={choices(SIGN_IN_CHOICES)}
            value={signIn}
            onChange={(value) => kept.set({ ...kept.value, signIn: value })}
          />
        </div>
      ),
    });
  }
  const help = setup ? analyticsHelp(setup, method) : null;
  const addressProblem = setup ? apiUrlProblem(setup, form.apiUrl) : null;
  const providerName = provider === 'posthog' ? 'PostHog' : 'Umami';
  steps.push({
    key: 'details',
    label: 'Connect',
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
      <div className="space-y-6">
        {/* What to copy from the provider, and the fields it fills. */}
        <div className="space-y-3">
          <WizardInstruction icon={KeyRound}>Copy these from {providerName}. DUMA checks them before saving.</WizardInstruction>
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
              className={help.link ? 'pr-44' : undefined}
              rightAction={
                help.link ? (
                  <a
                    href={help.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-7 items-center gap-1 rounded-sm px-2 text-xs font-medium text-primary transition-colors hover:bg-primary/8"
                  >
                    Open {providerName} <ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : undefined
              }
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
        </div>
        <Input label="Connection name" value={form.displayName} onChange={(event) => update('displayName', event.target.value)} />
        {error && !save.isPending && (
          <p role="alert" className="rounded-md border border-exception/50 bg-exception/6 px-3 py-2 text-sm text-exception">
            {error}
          </p>
        )}
      </div>
    ),
  });

  return (
    <ConnectWizard
      eyebrow="Connect"
      title={DEFINITION.name}
      icon={<BarChart3 size={20} aria-hidden="true" />}
      rail={<WizardRail requirements={DEFINITION.requirements} />}
      steps={steps}
      onClose={onClose}
      onFinish={onDone}
      resumeKey={tenantId ? `analytics:${tenantId}` : null}
      onStartOver={restart}
      // Only the key or password is lost on leaving; the rest is kept for next time.
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
  const tenantId = useSettingsTenantId();
  const queryClient = useQueryClient();
  const key = connectionKey(tenantId);
  const connection = useQuery({
    queryKey: key,
    queryFn: () => getAnalyticsConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });
  // A check, not a report: the API fetches a week to prove it works and records when. The traffic is in Reports.
  const data = useMutation({
    mutationFn: () => checkAnalyticsConnection(tenantId ?? undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      toast('success', 'Analytics is working.');
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteAnalyticsConnection(tenantId ?? undefined),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: key });
      data.reset();
      toast('success', 'Analytics disconnected.');
    },
    onError: (failure) => toast('error', failure.message),
  });

  const connected = connection.data;
  const checked = relativeTime(connected?.lastTestedAt);

  return (
    <ConnectorManagePage
      definition={DEFINITION}
      brand={connected ? (connected.provider === 'posthog' ? PROVIDER_BRANDS.posthog : PROVIDER_BRANDS.umami) : undefined}
      status={connected ? { tone: 'success', text: 'Connected' } : undefined}
      loading={connection.isPending}
      error={
        connection.isError ? { title: 'The analytics connection couldn’t be loaded', onRetry: () => void connection.refetch() } : undefined
      }
      notSetUp={
        !connected ? (
          <div className={panelClass}>
            <p className="text-sm text-muted-foreground">Bring website traffic from Umami or PostHog into DUMA.</p>
            <Button className="mt-4 gap-1.5" onClick={onConnect}>
              <Plug size={15} aria-hidden="true" /> Connect analytics
            </Button>
          </div>
        ) : undefined
      }
      health={
        connected
          ? {
              facts: [
                { icon: BarChart3, title: 'Provider', value: setupLabel(setupOf(connected)) },
                { icon: LineChart, title: connected.provider === 'posthog' ? 'Project' : 'Website', value: connected.siteId },
                { icon: CheckCircle2, title: 'Last check', value: checked ?? 'Not checked yet', tone: checked ? undefined : 'warning' },
              ],
              problem: data.isError ? data.error.message : null,
              test: {
                label: data.isPending ? 'Checking…' : 'Check connection',
                icon: RefreshCw,
                pending: data.isPending,
                onTest: () => data.mutate(),
              },
            }
          : undefined
      }
      usedBy={[{ icon: LineChart, label: 'Reports', href: '/reports' }]}
      actions={[{ icon: Plug, label: 'Change connection', onClick: onConnect }]}
      disconnect={{
        consequences: [
          'Reports stop showing website traffic until you connect again.',
          `Nothing changes in your ${connected?.provider === 'posthog' ? 'PostHog' : 'Umami'} account.`,
        ],
        pending: remove.isPending,
        onConfirm: () => remove.mutate(),
      }}
      onClose={onClose}
    ></ConnectorManagePage>
  );
}
