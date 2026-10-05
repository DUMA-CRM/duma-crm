'use client';

import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';

import { AlertTriangle, Check, ShieldCheck } from '@/components/icons';
import { ErrorState } from '@/components/shared/ErrorState';

import { type WorkspaceModuleId, type WorkspaceRecommendation, previewWorkspaceRecommendation } from '@/lib/modules/organization/client';
import { businessProfile, toOnboardingAnswers } from '@/lib/onboarding/answers';
import type { OnboardingDraft } from '@/lib/onboarding/flow';
import { cn } from '@/lib/utils/cn';

import { FOUNDATION_MODULES, byModuleOrder, moduleCopy } from './modules';

const EASE = [0.16, 1, 0.3, 1] as const;

export function useRecommendationPreview(draft: OnboardingDraft, enabled = true) {
  const answers = toOnboardingAnswers(draft);
  return useQuery({
    // Answers are the whole input; the preview is stateless, so this key is exact.
    queryKey: ['workspace-setup-preview', answers],
    queryFn: () => previewWorkspaceRecommendation(answers),
    staleTime: Infinity,
    retry: 1,
    enabled,
  });
}

/** Blocking conflicts or assumptions the API will refuse to activate with. */
export function blockingIssues(recommendation: WorkspaceRecommendation | undefined): string[] {
  if (!recommendation) return [];
  return [
    ...recommendation.conflicts.map((entry) => entry.message),
    ...recommendation.assumptions.filter((entry) => entry.blocking).map((entry) => entry.message),
  ];
}

interface RevealStepProps {
  draft: OnboardingDraft;
  onToggleModule: (moduleId: WorkspaceModuleId) => void;
  onChangeAnswers: () => void;
}

export function RevealStep({ draft, onToggleModule, onChangeAnswers }: RevealStepProps) {
  const reduceMotion = useReducedMotion();
  const preview = useRecommendationPreview(draft);
  const profile = businessProfile(draft);

  if (preview.isPending) return <RevealLoading />;
  if (preview.isError) {
    return (
      <ErrorState
        title="We couldn’t build your proposal"
        description="Your answers are saved. Check your connection and try again."
        onRetry={() => preview.refetch()}
      />
    );
  }

  const recommendation = preview.data;
  const modules = recommendation.requiredModules.filter((id) => !FOUNDATION_MODULES.has(id)).sort(byModuleOrder);
  const optional = recommendation.optionalModules.filter((id) => !FOUNDATION_MODULES.has(id)).sort(byModuleOrder);
  const issues = blockingIssues(recommendation);
  const appear = (delay: number) =>
    reduceMotion
      ? {}
      : { initial: { opacity: 0, y: 10 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.45, ease: EASE } };

  return (
    <div>
      <motion.p {...appear(0)} className="text-label uppercase text-muted-foreground">
        Your proposal
      </motion.p>
      <motion.h1 {...appear(0.08)} className="mt-3 text-3xl font-semibold leading-[1.1] tracking-display text-foreground sm:text-4xl">
        You’re running {profile.article} <span className="text-primary">{profile.noun}</span>.
      </motion.h1>
      {profile.traits.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="What shaped this proposal">
          {profile.traits.map((trait, index) => (
            <motion.li key={trait} {...appear(0.2 + index * 0.05)} className="annot text-muted-foreground">
              {trait}
            </motion.li>
          ))}
        </ul>
      )}

      {issues.length > 0 && (
        <div
          role="alert"
          className="mt-6 flex gap-3 rounded-md border border-stock/40 bg-warning-highlight px-4 py-3 text-sm text-foreground"
        >
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-stock" aria-hidden="true" />
          <div>
            {issues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
            <button type="button" onClick={onChangeAnswers} className="mt-1 font-semibold text-reference underline underline-offset-4">
              Change my answers
            </button>
          </div>
        </div>
      )}

      <motion.h2 {...appear(0.3)} className="mt-9 text-sm font-semibold text-foreground">
        We’ll switch these on for {draft.businessName.trim() || 'you'}
      </motion.h2>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2">
        {modules.map((id, index) => {
          const copy = moduleCopy(id);
          const Icon = copy.icon;
          return (
            <motion.li
              key={id}
              initial={reduceMotion ? false : { opacity: 0, y: 14, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: reduceMotion ? 0 : 0.38 + index * 0.07, type: 'spring', stiffness: 380, damping: 30 }}
              className="flex items-start gap-3 rounded-lg border border-rule/60 bg-field px-3.5 py-3"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/8 text-primary">
                <Icon size={17} aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">{copy.name}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{copy.detail}</span>
              </span>
            </motion.li>
          );
        })}
      </ul>
      <motion.p {...appear(0.45 + modules.length * 0.07)} className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck size={14} className="text-success" aria-hidden="true" />
        Sign-in, roles and workspace settings are always included.
      </motion.p>

      {optional.length > 0 && (
        <motion.fieldset {...appear(0.55 + modules.length * 0.07)} className="mt-8">
          <legend className="text-sm font-semibold text-foreground">Worth adding</legend>
          <p className="mt-1 text-xs text-muted-foreground">These pair well with your setup. You can change this at any time.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {optional.map((id) => {
              const active = draft.addedModules.includes(id);
              return (
                <label
                  key={id}
                  className={cn(
                    'inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
                    'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/70 bg-field text-foreground hover:bg-band',
                  )}
                >
                  <input type="checkbox" className="sr-only" checked={active} onChange={() => onToggleModule(id)} />
                  {active && <Check size={14} aria-hidden="true" />}
                  {moduleCopy(id).name}
                </label>
              );
            })}
          </div>
        </motion.fieldset>
      )}
    </div>
  );
}

function RevealLoading() {
  return (
    <div role="status" aria-live="polite">
      <p className="text-label uppercase text-muted-foreground">Your proposal</p>
      <p className="mt-3 text-2xl font-semibold tracking-headline text-foreground">Matching tools to your answers…</p>
      <div className="mt-9 grid gap-2 sm:grid-cols-2" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="h-[4.25rem] animate-pulse rounded-lg border border-rule/40 bg-band/50"
            style={{ animationDelay: `${index * 90}ms` }}
          />
        ))}
      </div>
    </div>
  );
}
