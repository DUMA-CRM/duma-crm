'use client';

import { useQuery } from '@tanstack/react-query';

import { CheckCircle2, type IconComponent, Loader2, Route, Sparkles, Zap } from '@/components/icons';
import { Button } from '@/components/ui/button';
import type { AgentProviderInfo, AgentProviderPreference } from '@/lib/ai/provider-chain';
import { cn } from '@/lib/utils/cn';
import { useAgentSettingsStore } from '@/stores/agentSettingsStore';

/** Per-provider copy. The endpoint reports what is configured; this says why you'd pick it. */
const PROVIDER_COPY: Record<string, { description: string; icon: IconComponent }> = {
  gemini: { description: 'Google’s hosted model. The most reliable at using DUMA’s tools.', icon: Sparkles },
  openrouter: { description: 'Open models routed through OpenRouter. Slower, but a separate quota.', icon: Zap },
};

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
    queryKey: ['agent', 'providers'],
    queryFn: fetchProviders,
    staleTime: 5 * 60_000,
    enabled,
  });
}

function ModelRow({
  icon: Icon,
  title,
  description,
  meta,
  selected,
  compact,
  onSelect,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  meta?: string;
  selected: boolean;
  compact: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        'flex w-full items-start gap-3 rounded-md border text-left transition-colors',
        compact ? 'gap-2.5 rounded-sm px-2.5 py-2' : 'px-3 py-3',
        selected ? 'border-primary/50 bg-measured/6' : 'border-rule/65 bg-background/40 hover:border-rule hover:bg-band/60',
      )}
    >
      <Icon
        size={compact ? 14 : 16}
        className={cn('mt-0.5 shrink-0', selected ? 'text-primary' : 'text-muted-foreground')}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span className={cn('block font-medium text-foreground', compact ? 'text-xs' : 'text-sm')}>{title}</span>
        {/* In chat the description is the one line that has to earn its space,
            so the model id is dropped and the reason kept. */}
        <span className={cn('mt-0.5 block leading-relaxed text-muted-foreground', compact ? 'text-label' : 'mt-1 text-xs')}>
          {description}
        </span>
        {meta && !compact && <span className="mt-1 block truncate font-mono text-[11px] text-muted-foreground/80">{meta}</span>}
      </span>
      {selected && <CheckCircle2 size={compact ? 13 : 15} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />}
    </button>
  );
}

/**
 * The model picker itself — Settings wraps it in a plate, the chat panel drops it
 * straight into the transcript.
 *
 * Both render the same list off the same query and the same store, so a switch
 * made in chat is already ticked in Settings. It reads live state rather than a
 * snapshot, which is what lets a picker scrolled halfway up the transcript still
 * show — and set — the current model.
 */
export function ModelChoiceList({ compact = false, enabled = true }: { compact?: boolean; enabled?: boolean }) {
  const provider = useAgentSettingsStore((s) => s.provider);
  const setProvider = useAgentSettingsStore((s) => s.setProvider);
  const { data: providers, isLoading, isError, error, refetch, isFetching } = useAgentProviders({ enabled });

  // A stored choice for a provider this deployment no longer configures would
  // silently do nothing, so say so rather than showing a tick beside nothing.
  const orphaned = provider !== 'auto' && providers !== undefined && !providers.some((p) => p.id === provider);
  const primary = providers?.[0];

  if (isLoading) {
    return (
      <p className={cn('flex items-center gap-2 text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        <Loader2 size={14} className="animate-spin" aria-hidden="true" />
        Loading available models…
      </p>
    );
  }

  if (isError) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-destructive/5 px-3 py-2.5">
        <p className={cn('text-destructive', compact ? 'text-xs' : 'text-sm')}>
          {error instanceof Error ? error.message : 'Couldn’t load the available models.'}
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()} disabled={isFetching}>
          Try again
        </Button>
      </div>
    );
  }

  if (!providers || providers.length === 0) {
    return (
      <p className={cn('text-muted-foreground', compact ? 'text-xs' : 'text-sm')}>
        No AI model is configured on this server, so Ask DUMA cannot answer. An administrator needs to add a model key and restart the app.
      </p>
    );
  }

  return (
    <div className={cn('flex flex-col', compact ? 'gap-1.5' : 'gap-2')} role="radiogroup" aria-label="Ask DUMA model">
      <ModelRow
        icon={Route}
        title="Automatic"
        description={
          primary
            ? `Recommended — starts with ${primary.name} and moves on when it is at its limit.`
            : 'Recommended — DUMA picks the configured order.'
        }
        selected={provider === 'auto'}
        compact={compact}
        onSelect={() => setProvider('auto')}
      />
      {providers.map((option) => {
        const copy = PROVIDER_COPY[option.id];
        return (
          <ModelRow
            key={option.id}
            icon={copy?.icon ?? Sparkles}
            title={option.name}
            description={copy?.description ?? 'Answers Ask DUMA first, with the other configured models behind it.'}
            meta={option.model}
            selected={provider === option.id}
            compact={compact}
            onSelect={() => setProvider(option.id as AgentProviderPreference)}
          />
        );
      })}
      {orphaned && (
        <p role="status" className={cn('rounded-md bg-band/70 px-3 py-2.5 text-muted-foreground', compact ? 'text-label' : 'text-xs')}>
          Your saved choice isn’t configured on this server any more, so Ask DUMA is using the automatic order. Pick a model above to clear
          this.
        </p>
      )}
    </div>
  );
}
