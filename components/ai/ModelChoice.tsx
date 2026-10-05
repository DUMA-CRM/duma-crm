'use client';

import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

import { ArrowRight, Check, CheckCircle2, type IconComponent, Loader2, Route, Sparkles, Zap } from '@/components/icons';
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
 * The Settings-size option: the same answer card as onboarding, so choosing a
 * model reads like every other choice in the product. The chat panel keeps
 * the compact ModelRow above — in a transcript, a card this size would shout.
 */
function ModelCard({
  icon: Icon,
  title,
  description,
  meta,
  badge,
  selected,
  index,
  onSelect,
}: {
  icon: IconComponent;
  title: string;
  description: string;
  meta?: string;
  badge?: string;
  selected: boolean;
  index: number;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : index * 0.05, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      className={cn(
        'group flex w-full items-start gap-3.5 rounded-lg border bg-field px-4 py-3.5 text-left',
        'transition-[border-color,background-color,box-shadow] duration-150',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
        selected
          ? 'border-primary bg-primary/5 shadow-[inset_0_0_0_1px_var(--primary)]'
          : 'border-rule/70 hover:border-rule hover:bg-band/45',
      )}
    >
      <span
        className={cn(
          'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border transition-colors',
          selected
            ? 'border-primary/40 bg-primary text-primary-foreground'
            : 'border-rule/55 bg-background text-muted-foreground group-hover:text-foreground',
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold leading-snug text-foreground">{title}</span>
          {badge && <span className="annot text-primary">{badge}</span>}
        </span>
        <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">{description}</span>
        {meta && (
          <span className="mt-2 inline-flex max-w-full rounded-sm border border-rule/55 bg-background px-1.5 py-0.5 font-mono text-label text-muted-foreground">
            <span className="truncate">{meta}</span>
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className={cn(
          'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border transition-colors',
          selected ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/70',
        )}
      >
        {selected && <Check size={12} strokeWidth={3} />}
      </span>
    </motion.button>
  );
}

/**
 * The order Ask DUMA will actually try, as chips. Choosing a model only moves it
 * to the front; everything behind it still catches an overflow, and this makes
 * that visible instead of leaving it to a footnote.
 */
function FallbackOrder({ order }: { order: AgentProviderInfo[] }) {
  const reduceMotion = useReducedMotion();
  if (order.length < 2) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-rule/60 px-4 py-3"
      aria-label="Order Ask DUMA tries"
    >
      <span className="mr-1 text-label uppercase text-muted-foreground">Backup order</span>
      {order.map((option, index) => (
        <motion.span
          key={option.id}
          layout={!reduceMotion}
          transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          className="flex items-center gap-2"
        >
          {index > 0 && <ArrowRight size={13} className="text-muted-foreground" aria-hidden="true" />}
          <span
            className={cn(
              'rounded-md border px-2 py-1 text-xs font-semibold',
              index === 0 ? 'border-primary/40 bg-primary/8 text-primary' : 'border-rule/60 text-muted-foreground',
            )}
          >
            {option.name}
          </span>
        </motion.span>
      ))}
    </div>
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
  const { data: providers, isLoading, isError, refetch, isFetching } = useAgentProviders({ enabled });

  // A stored choice for a provider this deployment no longer configures would
  // silently do nothing, so say so rather than showing a tick beside nothing.
  const orphaned = provider !== 'auto' && providers !== undefined && !providers.some((p) => p.id === provider);
  const primary = providers?.[0];

  if (isLoading && !compact) {
    return (
      <div className="flex flex-col gap-2" aria-label="Loading available models">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-[4.5rem] animate-pulse rounded-lg bg-band/60" style={{ animationDelay: `${index * 90}ms` }} />
        ))}
      </div>
    );
  }

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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-exception/30 bg-exception/5 px-3 py-2.5">
        <div>
          <p className={cn('font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}>Models aren’t available right now</p>
          <p className={cn('mt-0.5 text-muted-foreground', compact ? 'text-label' : 'text-xs')}>Ask DUMA can try loading them again.</p>
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
        <p className={cn('font-semibold text-foreground', compact ? 'text-xs' : 'text-sm')}>Ask DUMA isn’t available yet</p>
        <p className={cn('mt-0.5 text-muted-foreground', compact ? 'text-label' : 'text-xs')}>
          Ask an administrator to finish the AI setup.
        </p>
      </div>
    );
  }

  const orphanNotice = orphaned && (
    <p role="status" className={cn('rounded-md bg-band/70 px-3 py-2.5 text-muted-foreground', compact ? 'text-label' : 'text-xs')}>
      Your saved choice isn’t configured on this server any more, so Ask DUMA is using the automatic order. Pick a model above to clear
      this.
    </p>
  );

  if (!compact) {
    const chosen = providers.find((option) => option.id === provider);
    const order = chosen ? [chosen, ...providers.filter((option) => option !== chosen)] : providers;
    return (
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="Ask DUMA model">
          <ModelCard
            icon={Route}
            title="Automatic"
            badge="Recommended"
            description={primary ? `Starts with ${primary.name} and moves on when it’s at its limit.` : 'DUMA picks the configured order.'}
            selected={provider === 'auto' || orphaned}
            index={0}
            onSelect={() => setProvider('auto')}
          />
          {providers.map((option, index) => {
            const copy = PROVIDER_COPY[option.id];
            return (
              <ModelCard
                key={option.id}
                icon={copy?.icon ?? Sparkles}
                title={option.name}
                description={copy?.description ?? 'Answers Ask DUMA first, with the other models behind it.'}
                meta={option.model}
                selected={provider === option.id}
                index={index + 1}
                onSelect={() => setProvider(option.id as AgentProviderPreference)}
              />
            );
          })}
        </div>
        <FallbackOrder
          order={
            providers.some((item) => item.id === 'openrouter')
              ? [...order, { id: 'nvidia', name: 'NVIDIA Nemotron', model: 'Final backup' }]
              : order
          }
        />
        <AnimatePresence>{orphanNotice}</AnimatePresence>
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
      {orphanNotice}
    </div>
  );
}
