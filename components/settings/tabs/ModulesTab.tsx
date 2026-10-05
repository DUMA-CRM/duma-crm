'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

import { AlertTriangle, ArrowLeft, ArrowRight, Check, Loader2, ShieldCheck, Sparkles } from '@/components/icons';
import { FOUNDATION_MODULES, MODULE_COPY, byModuleOrder, moduleCopy } from '@/components/onboarding/modules';
import { type QuestionContext, questionFor } from '@/components/onboarding/questions';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { ModuleChangeDialog } from '@/components/settings/workspaces/ModuleChangeDialog';
import { ErrorState } from '@/components/shared/ErrorState';
import { Button } from '@/components/ui/button';

import { hasCapability } from '@/lib/auth/capabilities';
import { useCurrentWorkspace } from '@/lib/hooks/useCurrentWorkspace';
import {
  type ModuleChangePreview,
  type WorkspaceModuleId,
  type WorkspaceSetupSession,
  applyWorkspaceRecommendation,
  generateWorkspaceRecommendation,
  getCurrentTenantModules,
  previewTenantModuleChange,
  startWorkspaceSetup,
} from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { draftFromAnswers, selectedModulesFor, toOnboardingAnswers } from '@/lib/onboarding/answers';
import { EMPTY_DRAFT, type OnboardingDraft, type StepId, isStepComplete, visibleSteps } from '@/lib/onboarding/flow';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const EASE = [0.16, 1, 0.3, 1] as const;
const AUTO_ADVANCE_MS = 280;

type View =
  | { kind: 'overview' }
  | { kind: 'questions'; session: WorkspaceSetupSession }
  | { kind: 'proposal'; session: WorkspaceSetupSession; draft: OnboardingDraft };

export function ModulesTab() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const capabilities = useAuthStore((state) => state.capabilities);
  const [view, setView] = useState<View>({ kind: 'overview' });
  // Every proposal saves the answers and bumps the revision; the next one must quote the latest or it is refused as stale.
  const revision = useRef(0);
  const modulesKey = moduleQueryKeys.organization.key('current-tenant-modules', tenantId);
  const modules = useQuery({
    queryKey: modulesKey,
    queryFn: () => getCurrentTenantModules(tenantId ?? undefined),
    enabled: Boolean(tenantId),
  });
  const enabled = new Set(
    (modules.data?.modules ?? []).filter((row) => row.status === 'enabled').map((row) => row.moduleId as WorkspaceModuleId),
  );

  const begin = useMutation({
    // Start returns the running session if there is one, so re-running never forks setup.
    mutationFn: () => startWorkspaceSetup(tenantId!),
    onSuccess: (session) => {
      revision.current = session.recommendationRevision;
      setView({ kind: 'questions', session });
    },
    onError: (error) => toast('error', error.message),
  });

  if (!tenantId) {
    return (
      <SettingsSection title="Modules">
        <p className="text-sm text-muted-foreground">Choose a workspace to see its modules.</p>
      </SettingsSection>
    );
  }

  return (
    <SettingsTabBody>
      <AnimatePresence mode="wait" initial={false}>
        {view.kind === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex flex-col gap-5"
          >
            <ModuleOverview
              modules={modules}
              enabled={enabled}
              canToggle={hasCapability(capabilities, 'settings:write')}
              reviewing={begin.isPending}
              onReview={() => begin.mutate()}
            />
          </motion.div>
        )}
        {view.kind === 'questions' && (
          <motion.div key="questions" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <SetupQuestions
              session={view.session}
              onCancel={() => setView({ kind: 'overview' })}
              onDone={(draft) => setView({ kind: 'proposal', session: view.session, draft })}
            />
          </motion.div>
        )}
        {view.kind === 'proposal' && (
          <motion.div key="proposal" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
            <Proposal
              session={view.session}
              draft={view.draft}
              revisionRef={revision}
              enabled={enabled}
              onBack={() => setView({ kind: 'questions', session: view.session })}
              onApplied={() => setView({ kind: 'overview' })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </SettingsTabBody>
  );
}

/**
 * Every tool in one grid — on first, then off — so there is one place to see
 * the workspace and one way to change it. Owners change it through the guided
 * review (the API only lets them add, via the setup rules); platform admins
 * also get a switch per tool, which previews the change before applying it.
 */
function ModuleOverview({
  modules,
  enabled,
  canToggle,
  reviewing,
  onReview,
}: {
  modules: ReturnType<typeof useQuery<Awaited<ReturnType<typeof getCurrentTenantModules>>>>;
  enabled: Set<WorkspaceModuleId>;
  canToggle: boolean;
  reviewing: boolean;
  onReview: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [preview, setPreview] = useState<ModuleChangePreview | null>(null);
  const previewChange = useMutation({
    mutationFn: ({ moduleId, status }: { moduleId: WorkspaceModuleId; status: 'enabled' | 'disabled' }) =>
      previewTenantModuleChange(tenantId!, moduleId, status),
    onSuccess: setPreview,
    onError: (error) => toast('error', error.message),
  });

  const all = (Object.keys(MODULE_COPY) as WorkspaceModuleId[]).filter((id) => !FOUNDATION_MODULES.has(id)).sort(byModuleOrder);
  const ordered = [...all.filter((id) => enabled.has(id)), ...all.filter((id) => !enabled.has(id))];
  const onCount = all.filter((id) => enabled.has(id)).length;

  return (
    <SettingsSection
      title="Your tools"
      actions={
        <Button size="sm" onClick={onReview} disabled={reviewing}>
          {reviewing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          Review my setup
        </Button>
      }
    >
      {modules.isPending ? (
        <div className="grid gap-2 sm:grid-cols-2" aria-label="Loading modules">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-[4.25rem] animate-pulse rounded-lg bg-band/60" />
          ))}
        </div>
      ) : modules.isError ? (
        <ErrorState title="Couldn’t load this workspace’s modules" onRetry={() => void modules.refetch()} />
      ) : (
        <>
          <div className="mb-4 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-band" aria-hidden="true">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={reduceMotion ? false : { width: 0 }}
                animate={{ width: `${(onCount / all.length) * 100}%` }}
                transition={{ duration: 0.7, ease: EASE }}
              />
            </div>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
              {onCount} of {all.length} on
            </span>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {ordered.map((id, index) => {
              const on = enabled.has(id);
              const busy = previewChange.isPending && previewChange.variables?.moduleId === id;
              return (
                <ModuleCard key={id} id={id} index={index} state={on ? 'on' : 'off'} reduceMotion={reduceMotion}>
                  {canToggle ? (
                    busy ? (
                      <Loader2 size={16} className="animate-spin text-muted-foreground" aria-label="Checking" />
                    ) : (
                      <Switch
                        label={`${on ? 'Turn off' : 'Turn on'} ${moduleCopy(id).name}`}
                        checked={on}
                        disabled={previewChange.isPending}
                        onChange={() => previewChange.mutate({ moduleId: id, status: on ? 'disabled' : 'enabled' })}
                      />
                    )
                  ) : on ? (
                    <Check size={16} className="text-success" aria-label="On" />
                  ) : (
                    <span className="text-xs text-muted-foreground">Off</span>
                  )}
                </ModuleCard>
              );
            })}
          </ul>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck size={14} className="text-success" aria-hidden="true" />
            Sign-in, roles and workspace settings are always on.
          </p>
        </>
      )}
      {preview && <ModuleChangeDialog preview={preview} onClose={() => setPreview(null)} />}
    </SettingsSection>
  );
}

function ModuleCard({
  id,
  index,
  state,
  reduceMotion,
  children,
}: {
  id: WorkspaceModuleId;
  index: number;
  state: 'on' | 'off' | 'new';
  reduceMotion: boolean | null;
  children?: React.ReactNode;
}) {
  const copy = moduleCopy(id);
  const Icon = copy.icon;
  return (
    <motion.li
      layout={!reduceMotion}
      initial={reduceMotion ? false : { opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ delay: reduceMotion ? 0 : Math.min(index, 12) * 0.03, type: 'spring', stiffness: 380, damping: 30 }}
      className={cn(
        'flex items-center gap-3 rounded-lg border px-3.5 py-3',
        state === 'off' ? 'border-dashed border-rule/60 bg-transparent' : 'border-rule/50 bg-background/60',
        state === 'new' && 'border-primary/40 bg-primary/5',
      )}
    >
      <span
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-md',
          state === 'off' ? 'bg-band text-muted-foreground' : 'bg-primary/8 text-primary',
        )}
      >
        <Icon size={18} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-sm font-semibold', state === 'off' ? 'text-muted-foreground' : 'text-foreground')}>
          {copy.name}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground">{copy.detail}</span>
      </span>
      {state === 'new' && <span className="annot shrink-0 text-primary">New</span>}
      {children && <span className="flex shrink-0 items-center">{children}</span>}
    </motion.li>
  );
}

// The questionnaire steps that describe the business; naming and the account are onboarding-only.
const SETUP_SECTIONS = new Set(['business', 'operations', 'people']);
const setupSteps = (draft: OnboardingDraft) =>
  visibleSteps(draft).filter((step) => step.section && SETUP_SECTIONS.has(step.section) && step.id !== 'name');

function SetupQuestions({
  session,
  onCancel,
  onDone,
}: {
  session: WorkspaceSetupSession;
  onCancel: () => void;
  onDone: (draft: OnboardingDraft) => void;
}) {
  const reduceMotion = useReducedMotion();
  const { tenant } = useCurrentWorkspace();
  const [draft, setDraft] = useState<OnboardingDraft>(() => ({
    ...EMPTY_DRAFT,
    ...draftFromAnswers(session.answers),
    businessName: tenant?.name ?? '',
  }));
  const [position, setPosition] = useState({ step: setupSteps(draft)[0].id as StepId, direction: 1 });
  const latest = useRef(draft);
  useLayoutEffect(() => {
    latest.current = draft;
  });
  const timer = useRef<number | null>(null);

  const steps = setupSteps(draft);
  const index = Math.max(
    0,
    steps.findIndex((step) => step.id === position.step),
  );
  const step = steps[index]?.id ?? steps[0].id;
  const complete = isStepComplete(step, draft, '');

  const go = useCallback(
    (offset: 1 | -1) => {
      if (timer.current) window.clearTimeout(timer.current);
      const current = latest.current;
      const list = setupSteps(current);
      const at = list.findIndex((entry) => entry.id === position.step);
      if (offset === 1 && !isStepComplete(list[at].id, current, '')) return;
      const target = list[at + offset];
      if (!target) {
        if (offset === 1) onDone(current);
        else onCancel();
        return;
      }
      setPosition({ step: target.id, direction: offset });
    },
    [onCancel, onDone, position.step],
  );

  const update = useCallback((patch: Partial<OnboardingDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
  }, []);
  const choose = useCallback(
    (patch: Partial<OnboardingDraft>) => {
      latest.current = { ...latest.current, ...patch };
      update(patch);
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => go(1), reduceMotion ? 0 : AUTO_ADVANCE_MS);
    },
    [go, reduceMotion, update],
  );

  return (
    <section className="rounded-lg border border-rule/60 bg-field p-5 sm:p-8">
      <div className="mb-8 flex items-center gap-4">
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-band"
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={steps.length}
          aria-valuenow={index + 1}
          aria-label="Setup questions"
        >
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${((index + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.4, ease: EASE }}
          />
        </div>
        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
          {index + 1} of {steps.length}
        </span>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          go(1);
        }}
      >
        <AnimatePresence mode="popLayout" custom={position.direction} initial={false}>
          <motion.div
            key={step}
            custom={position.direction}
            variants={{
              enter: (dir: number) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * 24 }),
              center: { opacity: 1, x: 0 },
              exit: (dir: number) => (reduceMotion ? { opacity: 0 } : { opacity: 0, x: dir * -24 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.26, ease: EASE }}
          >
            {/* The name is read at render time: the tenant can arrive after the draft was seeded. */}
            <QuestionView
              step={step}
              context={{
                draft: { ...draft, businessName: tenant?.name ?? draft.businessName },
                password: '',
                update,
                choose,
                setPassword: noop,
              }}
            />
          </motion.div>
        </AnimatePresence>
        <div className="mt-8 flex items-center justify-between gap-4">
          <Button type="button" variant="ghost" size="lg" className="h-11 gap-1.5 px-4 text-muted-foreground" onClick={() => go(-1)}>
            <ArrowLeft aria-hidden="true" /> {index === 0 ? 'Cancel' : 'Back'}
          </Button>
          <Button type="submit" size="lg" className="h-11 min-w-36 gap-2 px-5" disabled={!complete}>
            {index === steps.length - 1 ? 'See proposal' : 'Continue'} <ArrowRight aria-hidden="true" />
          </Button>
        </div>
      </form>
    </section>
  );
}

const noop = () => {};

function QuestionView({ step, context }: { step: StepId; context: QuestionContext }) {
  const question = questionFor(step, context);
  return (
    <>
      <h3 className="text-xl font-semibold leading-tight tracking-headline text-foreground sm:text-2xl">{question?.title}</h3>
      {question?.hint && <p className="mt-2 max-w-[56ch] text-sm leading-6 text-muted-foreground">{question.hint}</p>}
      <div className="mt-6">{question?.body}</div>
    </>
  );
}

function Proposal({
  draft,
  revisionRef,
  enabled,
  onBack,
  onApplied,
}: {
  session: WorkspaceSetupSession;
  draft: OnboardingDraft;
  revisionRef: React.RefObject<number>;
  enabled: Set<WorkspaceModuleId>;
  onBack: () => void;
  onApplied: () => void;
}) {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const tenantId = useWorkspaceStore((state) => state.tenantId)!;
  const [added, setAdded] = useState<WorkspaceModuleId[]>([]);
  const answers = toOnboardingAnswers(draft);

  const proposal = useQuery({
    // Saving the answers is what produces the proposal; keyed on them so going back and changing one re-proposes.
    queryKey: ['workspace-setup-proposal', tenantId, answers],
    queryFn: async () => {
      const saved = await generateWorkspaceRecommendation(tenantId, answers, revisionRef.current);
      revisionRef.current = saved.recommendationRevision;
      return saved;
    },
    staleTime: Infinity,
    retry: false,
  });

  const apply = useMutation({
    mutationFn: (saved: WorkspaceSetupSession) =>
      applyWorkspaceRecommendation(tenantId, selectedModulesFor(saved.recommendation!, added), saved.recommendationRevision),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId) });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenant-modules', tenantId) });
      void qc.invalidateQueries({ queryKey: ['workspace-setup', tenantId] });
      toast('success', 'Setup updated.');
      onApplied();
    },
    onError: (error) => toast('error', error.message),
  });

  if (proposal.isPending) {
    return (
      <section className="rounded-lg border border-rule/60 bg-field p-8" role="status">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" aria-hidden="true" /> Matching tools to your answers…
        </p>
      </section>
    );
  }
  if (proposal.isError) {
    return (
      <section className="rounded-lg border border-rule/60 bg-field p-8">
        <ErrorState title="We couldn’t build a proposal" description={proposal.error.message} onRetry={() => void proposal.refetch()} />
        <Button variant="ghost" className="mt-4" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> Back to the questions
        </Button>
      </section>
    );
  }

  const saved = proposal.data;
  const recommendation = saved.recommendation!;
  const issues = [
    ...recommendation.conflicts.map((entry) => entry.message),
    ...recommendation.assumptions.filter((entry) => entry.blocking).map((entry) => entry.message),
  ];
  const visible = (ids: WorkspaceModuleId[]) => ids.filter((id) => !FOUNDATION_MODULES.has(id)).sort(byModuleOrder);
  const fresh = visible(recommendation.requiredModules.filter((id) => !enabled.has(id)));
  const kept = visible(recommendation.requiredModules.filter((id) => enabled.has(id)));
  const optional = visible(recommendation.optionalModules.filter((id) => !enabled.has(id)));
  const nothingToDo = fresh.length === 0 && added.length === 0;

  return (
    <section className="rounded-lg border border-rule/60 bg-field p-5 sm:p-8">
      <p className="text-label uppercase text-muted-foreground">Proposal</p>
      <h3 className="mt-2 text-2xl font-semibold leading-tight tracking-headline text-foreground">
        {fresh.length > 0
          ? `${fresh.length} ${fresh.length === 1 ? 'tool' : 'tools'} to switch on`
          : 'You already have everything this needs'}
      </h3>

      {issues.length > 0 && (
        <div role="alert" className="mt-5 flex gap-3 rounded-md border border-stock/40 bg-warning-highlight px-4 py-3 text-sm">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-stock" aria-hidden="true" />
          <div>
            {issues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        </div>
      )}

      {fresh.length > 0 && (
        <ul className="mt-6 grid gap-2 sm:grid-cols-2">
          {fresh.map((id, index) => (
            <ModuleCard key={id} id={id} index={index} state="new" reduceMotion={reduceMotion} />
          ))}
        </ul>
      )}

      {optional.length > 0 && (
        <fieldset className="mt-6">
          <legend className="text-sm font-semibold text-foreground">Worth adding</legend>
          <div className="mt-3 flex flex-wrap gap-2">
            {optional.map((id) => {
              const active = added.includes(id);
              return (
                <label
                  key={id}
                  className={cn(
                    'inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors',
                    'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/70 bg-field text-foreground hover:bg-band',
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={active}
                    onChange={() => setAdded((list) => (active ? list.filter((entry) => entry !== id) : [...list, id]))}
                  />
                  {active && <Check size={14} aria-hidden="true" />}
                  {moduleCopy(id).name}
                </label>
              );
            })}
          </div>
        </fieldset>
      )}

      {kept.length > 0 && (
        <p className="mt-6 text-sm text-muted-foreground">Already on: {kept.map((id) => moduleCopy(id).name).join(', ')}.</p>
      )}

      <div className="mt-8 flex items-center justify-between gap-4">
        <Button type="button" variant="ghost" size="lg" className="h-11 gap-1.5 px-4 text-muted-foreground" onClick={onBack}>
          <ArrowLeft aria-hidden="true" /> Change answers
        </Button>
        <Button
          size="lg"
          className="h-11 min-w-36 px-5"
          onClick={() => (nothingToDo ? onApplied() : apply.mutate(saved))}
          disabled={issues.length > 0 || apply.isPending}
        >
          {apply.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
          {nothingToDo ? 'Done' : 'Switch them on'}
        </Button>
      </div>
    </section>
  );
}
