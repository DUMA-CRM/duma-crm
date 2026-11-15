'use client';

import { useQuery } from '@tanstack/react-query';

import { CheckCircle2, type IconComponent, Loader2, Route, Sparkles, Zap } from '@/components/icons';
import { Button } from '@/components/ui/button';

import type { AgentProviderInfo, AgentProviderPreference } from '@/lib/ai/provider-chain';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';

/** Per-provider copy. The endpoint reports what is configured; this says why you'd pick it. */
const PROVIDER_COPY: Record<string, { description: string; icon: IconComponent }> = {
  gemini: { description: 'Google’s hosted model. The most reliable at using DUMA’s tools.', icon: Sparkles },
  openrouter: { description: 'Open models routed through OpenRouter. Slower, but a separate quota.', icon: Zap },
};

/** The glyph a provider is drawn with, here and in Settings. */
export function providerIcon(id: string): IconComponent {
  return PROVIDER_COPY[id]?.icon ?? Sparkles;
}

async function fetchProviders(): Promise<AgentProviderInfo[]> {
  const response = await fetch('/api/agent/providers');
  if (!response.ok) {
    const failure = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(failure.message || 'Could not load the available models.');
  }
  const body = (await response.json()) as { providers?: AgentProviderInfo[] };
  return body.providers ?? [];
}

/**
 * Which models this deployment actually has keys for.
 *
 * One query key for the settings screen and the chat panel, so opening the
 * picker in one does not re-ask on behalf of the other. `enabled` exists because
 * the agent panel is mounted on every page — it should not cost a request until
 * somebody opens it.
 */
export function useAgentProviders({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: moduleQueryKeys.agent.key('agent', 'providers'),
    queryFn: fetchProviders,
    staleTime: 5 * 60_000,
    enabled,
  });
}

function ModelRow({
  icon: Icon,
  title,
  description,
  selected,
  onSelect,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-2.5 rounded-sm border px-2.5 py-2 text-left transition-colors',
        selected ? 'border-primary/50 bg-measured/6' : 'border-border bg-background/40 hover:border-rule hover:bg-band/60',
      )}
    >
      <Icon size={14} className={cn('mt-0.5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium text-foreground">{title}</span>
        {/* In chat the description is the one line that has to earn its space,
            so the model id is dropped and the reason kept. */}
        <span className="mt-0.5 block text-label leading-relaxed text-muted-foreground">{description}</span>
      </span>
      {selected && <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />}
    </button>
  );
}

/**
 * The chat panel's picker, dropped straight into the transcript — the one
 * place the model is chosen (Automatic unless someone picks). It reads live
 * state rather than a snapshot, which is what lets a picker scrolled halfway up
 * the transcript still show — and set — the current model.
 */
export function ModelChoiceList({ enabled = true }: { enabled?: boolean }) {
  const provider = useAgentSettingsStore((s) => s.provider);
  const setProvider = useAgentSettingsStore((s) => s.setProvider);
  const { data: providers, isLoading, isError, refetch, isFetching } = useAgentProviders({ enabled });

  // A stored choice for a provider this deployment no longer configures would
  // silently do nothing, so say so rather than showing a tick beside nothing.
  const orphaned = provider !== 'auto' && providers !== undefined && !providers.some((p) => p.id === provider);
  const primary = providers?.[0];

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Loading available models…
      </p>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-exception/30 bg-exception/5 px-3 py-2.5">
        <div>
          <p className="text-xs font-semibold text-foreground">Models aren’t available right now</p>
          <p className="mt-0.5 text-label text-muted-foreground">Ask DUMA can try loading them again.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          {isFetching && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
          Try again
        </Button>
      </div>
    );
  }

  if (!providers || providers.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-rule/60 px-3 py-3">
        <p className="text-xs font-semibold text-foreground">Ask DUMA isn’t available yet</p>
        <p className="mt-0.5 text-label text-muted-foreground">Ask an administrator to finish the AI setup.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Ask DUMA model">
      <ModelRow
        icon={Route}
        title="Automatic"
        description={
          primary
            ? `Recommended — starts with ${primary.name} and moves on when it is at its limit.`
            : 'Recommended — DUMA picks the configured order.'
        }
        selected={provider === 'auto'}
        onSelect={() => setProvider('auto')}
      />
      {providers.map((option) => (
        <ModelRow
          key={option.id}
          icon={providerIcon(option.id)}
          title={option.name}
          description={PROVIDER_COPY[option.id]?.description ?? 'Answers Ask DUMA first, with the other configured models behind it.'}
          selected={provider === option.id}
          onSelect={() => setProvider(option.id as AgentProviderPreference)}
        />
      ))}
      {orphaned && (
        <p role="status" className="rounded-md bg-band/70 px-3 py-2.5 text-label text-muted-foreground">
          Your saved choice isn’t configured on this server any more, so Ask DUMA is using the automatic order. Pick a model above to clear
          this.
        </p>
      )}
    </div>
  );
}
