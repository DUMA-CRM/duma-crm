'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ArrowRight, Loader2 } from '@/components/icons';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { type WorkspaceSignupInput, createWorkspace } from '@/lib/modules/identity/client';
import { applyWorkspaceRecommendation, generateWorkspaceRecommendation, startWorkspaceSetup } from '@/lib/modules/organization/client';
import { selectedModulesFor, toOnboardingAnswers } from '@/lib/onboarding/answers';
import { type OnboardingDraft, slugFrom } from '@/lib/onboarding/flow';
import { type Landing, landingFor } from '@/lib/onboarding/landing';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { useLoginIntroStore } from '@/stores/loginIntroStore';
import { useOnboardingStore } from '@/stores/onboardingStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const EASE = [0.16, 1, 0.3, 1] as const;

type Stage = 'account' | 'modules' | 'done';

const STAGES: Array<{ id: Exclude<Stage, 'done'>; label: string }> = [
  { id: 'account', label: 'Creating your workspace and owner account' },
  { id: 'modules', label: 'Switching on the tools you chose' },
];

interface Failure {
  stage: Exclude<Stage, 'done'>;
  message: string;
  /** The details were rejected — only editing them can fix it. */
  editable: boolean;
  /** Retrying now cannot succeed; offer signing in instead of "Try again". */
  rateLimited?: boolean;
}

async function fingerprint(payload: WorkspaceSignupInput): Promise<string> {
  // A hash, not the payload: the fingerprint is persisted and the payload holds the password.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

function describeFailure(stage: Failure['stage'], cause: unknown): Failure {
  if (stage === 'account' && cause instanceof ApiError) {
    if (cause.code === 'provisioning_conflict') {
      return { stage, editable: true, message: 'That email or workspace ID is already in use. Change it and try again.' };
    }
    if (cause.code === 'rate_limited') {
      return {
        stage,
        editable: false,
        rateLimited: true,
        message:
          'Workspace sign-up is limited to 3 attempts an hour from one network, and that limit has been reached. Your answers are saved — come back within the hour and try again. If an earlier attempt already created your workspace, sign in instead.',
      };
    }
    if (cause.code === 'provisioning_in_progress') {
      return { stage, editable: false, message: 'Your workspace is still being created. Give it a few seconds, then try again.' };
    }
    if (cause.status === 400 || cause.status === 422) return { stage, editable: true, message: cause.message };
  }
  const message = cause instanceof Error ? cause.message : 'Something went wrong.';
  return stage === 'account'
    ? { stage, editable: false, message: `We couldn’t create the workspace. ${message}` }
    : { stage, editable: false, message: `Your workspace exists, but its tools weren’t switched on. ${message}` };
}

interface ProvisioningProps {
  onEditDetails: (error: string) => void;
}

export function Provisioning({ onEditDetails }: ProvisioningProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  // Snapshot on mount: the store is cleared once the workspace is ready, and the
  // welcome screen still needs the names.
  const [draft] = useState<OnboardingDraft>(() => useOnboardingStore.getState().draft);
  const [stage, setStage] = useState<Stage>(() => (useOnboardingStore.getState().provisioned ? 'modules' : 'account'));
  // Where to go next, from the modules actually switched on.
  const [landing, setLanding] = useState<Landing | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setFailure(null);
    const store = useOnboardingStore.getState();
    let current: Failure['stage'] = store.provisioned ? 'modules' : 'account';

    try {
      let workspace = store.provisioned;
      if (!workspace) {
        setStage('account');
        const payload: WorkspaceSignupInput = {
          businessName: draft.businessName.trim(),
          workspaceSlug: slugFrom(draft.workspaceSlug),
          locationName: draft.locationName.trim(),
          locationAddress: draft.locationAddress.trim(),
          // Decides the starter categories — a shop does not open to "Coffee" and "Iced".
          ...(draft.businessType ? { businessType: draft.businessType } : {}),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London',
          ownerName: draft.ownerName.trim(),
          email: draft.email.trim().toLowerCase(),
          password: store.password,
        };
        const key = store.commandFor(await fingerprint(payload));
        const result = await createWorkspace(payload, key);
        useAuthStore.getState().setUser(result.user);
        workspace = { tenantId: result.workspace.tenantId, locationId: result.workspace.locationId };
        useWorkspaceStore.setState(workspace);
        store.setProvisioned(workspace);
      }

      current = 'modules';
      setStage('modules');
      const session = await startWorkspaceSetup(workspace.tenantId);
      const proposed = await generateWorkspaceRecommendation(
        workspace.tenantId,
        toOnboardingAnswers(draft),
        session.recommendationRevision,
      );
      if (!proposed.recommendation) throw new Error('No proposal was returned.');
      const modules = selectedModulesFor(proposed.recommendation, draft.addedModules);
      await applyWorkspaceRecommendation(workspace.tenantId, modules, proposed.recommendationRevision);
      setLanding(landingFor(modules, draft));

      useOnboardingStore.getState().reset();
      setStage('done');
    } catch (cause) {
      const described = describeFailure(current, cause);
      if (described.editable) onEditDetails(described.message);
      else setFailure(described);
    } finally {
      running.current = false;
    }
  }, [draft, onEditDetails]);

  useEffect(() => {
    void run();
  }, [run]);

  if (stage === 'done') {
    const next = landing ?? landingFor([], draft);
    const go = (href: string) => {
      useLoginIntroStore.getState().start();
      router.replace(href);
    };
    return (
      <Ready
        firstName={draft.ownerName.trim().split(/\s+/)[0] ?? ''}
        landing={next}
        onPrimary={() => go(next.primary.href)}
        onSecondary={() => go(next.secondary.href)}
      />
    );
  }

  const activeIndex = STAGES.findIndex((entry) => entry.id === stage);
  return (
    <div className="mx-auto w-full max-w-md" aria-live="polite">
      <p className="text-label uppercase text-muted-foreground">Almost there</p>
      <h1 className="mt-3 text-2xl font-semibold tracking-headline text-foreground">Setting up {draft.businessName.trim()}</h1>
      <ol className="mt-8 space-y-4">
        {STAGES.map((entry, index) => {
          const done = index < activeIndex;
          const active = index === activeIndex;
          const failed = failure?.stage === entry.id;
          return (
            <motion.li
              key={entry.id}
              initial={reduceMotion ? false : { opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1, duration: 0.35, ease: EASE }}
              className="flex items-center gap-3"
            >
              <span
                className={cn(
                  'flex size-6 shrink-0 items-center justify-center rounded-full border',
                  done
                    ? 'border-success bg-success text-success-foreground'
                    : failed
                      ? 'border-exception text-exception'
                      : active
                        ? 'border-primary text-primary'
                        : 'border-rule text-muted-foreground',
                )}
              >
                {done ? (
                  <DrawnCheck className="size-3.5" />
                ) : active && !failed ? (
                  <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                ) : null}
              </span>
              <span className={cn('text-sm', done || active ? 'text-foreground' : 'text-muted-foreground')}>{entry.label}</span>
            </motion.li>
          );
        })}
      </ol>

      {failure && (
        <div role="alert" className="mt-8 rounded-md border border-exception/35 bg-destructive/6 px-4 py-3">
          <p className="text-sm text-foreground">{failure.message}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {failure.rateLimited ? (
              <Button size="lg" onClick={() => router.push('/sign-in')} className="h-11 px-5">
                Sign in
              </Button>
            ) : (
              <Button size="lg" onClick={() => void run()} className="h-11 px-5">
                Try again
              </Button>
            )}
            {failure.stage === 'account' && (
              <Button size="lg" variant="outline" onClick={() => onEditDetails(failure.message)} className="h-11 px-5">
                Review details
              </Button>
            )}
            {failure.stage === 'modules' && (
              <Button size="lg" variant="outline" onClick={() => router.replace('/settings/workspaces')} className="h-11 px-5">
                Finish in settings
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DrawnCheck({ className }: { className?: string }) {
  const reduceMotion = useReducedMotion();
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <motion.path
        d="M5 12.5l4.5 4.5L19 7.5"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      />
    </svg>
  );
}

interface ReadyProps {
  firstName: string;
  landing: Landing;
  onPrimary: () => void;
  onSecondary: () => void;
}

function Ready({ firstName, landing, onPrimary, onSecondary }: ReadyProps) {
  const reduceMotion = useReducedMotion();
  const appear = (delay: number) =>
    reduceMotion ? {} : { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { delay, duration: 0.5, ease: EASE } };

  return (
    <div className="mx-auto flex max-w-lg flex-col items-center text-center" role="status">
      <motion.span
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
        className="flex size-16 items-center justify-center rounded-full bg-success text-success-foreground"
      >
        <DrawnCheck className="size-8" />
      </motion.span>
      <motion.h1 {...appear(0.2)} className="mt-8 text-3xl font-semibold leading-[1.1] tracking-display text-foreground sm:text-4xl">
        Welcome to DUMA{firstName ? `, ${firstName}` : ''}.
      </motion.h1>
      <motion.p {...appear(0.3)} className="mt-4 max-w-[44ch] text-sm leading-6 text-muted-foreground">
        {landing.message}
      </motion.p>
      <motion.div {...appear(0.4)} className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" onClick={onPrimary} autoFocus className="h-11 gap-2 px-5">
          {landing.primary.label}
          <ArrowRight aria-hidden="true" />
        </Button>
        <Button size="lg" variant="outline" onClick={onSecondary} className="h-11 px-5">
          {landing.secondary.label}
        </Button>
      </motion.div>
    </div>
  );
}
