'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { ArrowLeft } from '@/components/icons';
import { Logo } from '@/components/shared/Logo';
import { Button } from '@/components/ui/button';
import {
  type OnboardingDraft, SECTIONS, type StepId, isStepComplete, isStepId, nextStep, previousStep, progressFor,
  resolveStep, slugFrom, visibleSteps,
} from '@/lib/onboarding/flow';
import { useOnboardingStore } from '@/stores/onboardingStore';

import { ProgressRail } from './ProgressRail';
import { Provisioning } from './Provisioning';
import { type QuestionContext, questionFor } from './questions';
import { RevealStep, blockingIssues, useRecommendationPreview } from './RevealStep';
import { ReviewStep } from './ReviewStep';
import { WelcomeStep } from './WelcomeStep';

const EASE = [0.16, 1, 0.3, 1] as const;
/** Long enough to see the card tick, short enough not to feel like waiting. */
const AUTO_ADVANCE_MS = 280;

const subscribeNothing = () => () => {};
/** True once running in the browser, where the persisted draft is readable. */
const useIsClient = () => useSyncExternalStore(subscribeNothing, () => true, () => false);

export function OnboardingFlow() {
  const isClient = useIsClient();
  if (!isClient) return <FlowFrame />;
  return <Flow />;
}

function Flow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reduceMotion = useReducedMotion();
  const draft = useOnboardingStore((state) => state.draft);
  const password = useOnboardingStore((state) => state.password);
  const setPassword = useOnboardingStore((state) => state.setPassword);
  const [phase, setPhase] = useState<'questions' | 'provisioning'>('questions');
  const [reviewError, setReviewError] = useState<string | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const param = searchParams.get('step');
  const requested: StepId = isStepId(param) ? param : 'welcome';
  const step = resolveStep(requested, draft, password);

  // Direction of travel, derived during render from the previous step's position.
  const order = visibleSteps(draft).map((entry) => entry.id);
  const [seen, setSeen] = useState({ step, direction: 1 });
  if (seen.step !== step) setSeen({ step, direction: order.indexOf(step) >= order.indexOf(seen.step) ? 1 : -1 });
  const { direction } = seen;

  const goTo = useCallback(
    (target: StepId, mode: 'push' | 'replace' = 'push') => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      const href = target === 'welcome' ? '/sign-up' : `/sign-up?step=${target}`;
      if (mode === 'push') router.push(href, { scroll: false });
      else router.replace(href, { scroll: false });
    },
    [router],
  );

  // A deep link or restored session pointing past an unanswered question is corrected in the address bar too.
  useEffect(() => {
    if (param !== null && step !== requested) goTo(step, 'replace');
  }, [goTo, param, requested, step]);

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  // Screen readers land on the new question; a step that autofocused its own field keeps that focus.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !document.querySelector('main')?.contains(active)) {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [step]);

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    const current = useOnboardingStore.getState().draft;
    const next = { ...patch };
    if (patch.businessName !== undefined && !current.slugTouched) next.workspaceSlug = slugFrom(patch.businessName);
    useOnboardingStore.getState().update(next);
  }, []);

  const preview = useRecommendationPreview(draft, step === 'reveal');
  const revealBlocked = step === 'reveal' && (!preview.isSuccess || blockingIssues(preview.data).length > 0);
  const canContinue = isStepComplete(step, draft, password) && !revealBlocked;

  const advance = useCallback(() => {
    const fresh = useOnboardingStore.getState();
    if (!isStepComplete(step, fresh.draft, fresh.password)) return;
    if (step === 'review') {
      setReviewError(null);
      setPhase('provisioning');
      return;
    }
    const target = nextStep(step, fresh.draft);
    if (target) goTo(target);
  }, [goTo, step]);

  const choose = useCallback(
    (patch: Partial<OnboardingDraft>) => {
      update(patch);
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
      advanceTimer.current = window.setTimeout(advance, reduceMotion ? 0 : AUTO_ADVANCE_MS);
    },
    [advance, reduceMotion, update],
  );

  const back = () => {
    const target = previousStep(step, draft);
    if (target) goTo(target);
  };

  if (phase === 'provisioning') {
    return (
      <FlowFrame>
        <main className="flex flex-1 items-center justify-center px-5 py-12">
          <Provisioning
            onEditDetails={(message) => {
              setReviewError(message);
              setPhase('questions');
              goTo('review', 'replace');
            }}
          />
        </main>
      </FlowFrame>
    );
  }

  const progress = progressFor(step, draft);
  const counted = visibleSteps(draft).filter((entry) => entry.section === progress.activeSection);
  const sectionLabel = SECTIONS.find((section) => section.id === progress.activeSection)?.label;
  const position = counted.findIndex((entry) => entry.id === step) + 1;
  const resuming = draft.businessName.trim().length > 0;

  let body: React.ReactNode;
  if (step === 'welcome') {
    // Resuming lands on the first unanswered question (or the review, if nothing is missing).
    body = <WelcomeStep resuming={resuming} onStart={() => goTo(resolveStep('review', draft, password))} />;
  } else if (step === 'reveal') {
    body = (
      <RevealStep
        draft={draft}
        onChangeAnswers={() => goTo('presence')}
        onToggleModule={(id) => {
          const added = draft.addedModules.includes(id) ? draft.addedModules.filter((entry) => entry !== id) : [...draft.addedModules, id];
          update({ addedModules: added });
        }}
      />
    );
  } else {
    body = (
      <QuestionScreen
        step={step}
        eyebrow={sectionLabel ? { label: sectionLabel, position, total: counted.length } : undefined}
        headingRef={headingRef}
        context={{ draft, password, update, choose, setPassword }}
        review={<ReviewStep draft={draft} error={reviewError} onEdit={(target) => goTo(target)} update={update} />}
      />
    );
  }

  const showChrome = step !== 'welcome';
  return (
    <FlowFrame progress={showChrome ? progress : undefined}>
      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        <form
          className="relative w-full max-w-2xl"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (canContinue) advance();
          }}
        >
          <AnimatePresence mode="popLayout" custom={direction}>
            <motion.div
              key={step}
              custom={direction}
              variants={{
                enter: (dir: number) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * 28, filter: 'blur(3px)' }),
                center: { opacity: 1, x: 0, filter: 'blur(0px)' },
                exit: (dir: number) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * -28, filter: 'blur(3px)' }),
              }}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: EASE }}
            >
              {body}
            </motion.div>
          </AnimatePresence>

          {showChrome && (
            <div className="mt-12 flex items-center justify-between gap-4">
              <Button type="button" variant="ghost" size="lg" onClick={back} className="h-11 gap-1.5 px-4 text-muted-foreground">
                <ArrowLeft aria-hidden="true" />
                Back
              </Button>
              <Button type="submit" size="lg" disabled={!canContinue} className="h-11 min-w-36 gap-2 px-5">
                {step === 'review' ? 'Create workspace' : step === 'reveal' ? 'Looks right' : 'Continue'}
                {/* The Enter hint rides inside the button rather than as a third, shorter control beside it. */}
                <kbd aria-hidden="true" className="hidden rounded border border-primary-foreground/30 px-1 font-mono text-micro sm:inline">↵</kbd>
              </Button>
            </div>
          )}
        </form>
      </main>
    </FlowFrame>
  );
}

interface QuestionScreenProps {
  step: StepId;
  eyebrow?: { label: string; position: number; total: number };
  headingRef: React.Ref<HTMLHeadingElement>;
  context: QuestionContext;
  review: React.ReactNode;
}

function QuestionScreen({ step, eyebrow, headingRef, context, review }: QuestionScreenProps) {
  const question = questionFor(step, context);
  return (
    <>
      {eyebrow && (
        <p className="text-label uppercase text-muted-foreground">
          {eyebrow.label}
          <span className="ml-2 tabular-nums text-muted-foreground/70">{eyebrow.position} of {eyebrow.total}</span>
        </p>
      )}
      <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-2xl font-semibold leading-tight tracking-headline text-foreground outline-none sm:text-3xl">
        {step === 'review' ? 'Check your details, then create your workspace.' : question?.title}
      </h1>
      {question?.hint && <p className="mt-2 max-w-[56ch] text-sm leading-6 text-muted-foreground">{question.hint}</p>}
      <div className="mt-8">{step === 'review' ? review : question?.body}</div>
    </>
  );
}

function FlowFrame({ progress, children }: { progress?: ReturnType<typeof progressFor>; children?: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex flex-col items-center gap-4 px-5 pt-6">
        <Link href="/" aria-label="DUMA home">
          <Logo size={32} />
        </Link>
        {/* Fixed height so the welcome screen (no progress yet) sits where the questions will. */}
        <div className="flex h-4 w-full max-w-xs items-center gap-3">
          {progress && (
            <>
              <div className="min-w-0 flex-1">
                <ProgressRail progress={progress} />
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">~{progress.minutesLeft} min</span>
            </>
          )}
        </div>
      </header>
      {children ?? <div className="flex-1" />}
    </div>
  );
}
