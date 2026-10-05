'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import {
  AlertTriangle, ArrowLeft, Building2, CalendarClock, CheckCircle2, ChefHat, Clock, Coffee, FileText, Globe, Loader2, MapPin,
  ShieldCheck, Store, Timer, UserRound, Users, Wallet, X,
} from '@/components/icons';
import { type Choice, ChoiceGrid } from '@/components/onboarding/ChoiceGrid';
import { BigInput, Em } from '@/components/onboarding/questions';
import { usePayrollLocale } from '@/components/payroll/usePayroll';
import { AddressFields } from '@/components/people/AddressFields';
import { EMPLOYMENT_CONFIG, PAY_CONFIG } from '@/components/people/shared';
import { NumberStepper } from '@/components/shared/FormParts';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';

import { ApiError } from '@/lib/api/client';
import type { EmploymentType, PayType } from '@/lib/api/hr.service';
import type { OnboardResult } from '@/lib/api/onboarding.service';
import type { StaffScope } from '@/lib/api/staff.service';
import { type AccessRole, getRoles, onboardEmployee } from '@/lib/modules/identity/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/date';
import { ageBasedMinimumWage, statutoryIdLabel } from '@/lib/utils/employee-compliance';
import { formatNiNumber, formatSortCode } from '@/lib/utils/my-hr';
import { formatMoney } from '@/lib/utils/payroll-totals';
import {
  STAFF_SECTIONS, STAFF_STEPS, type StaffContext, type StaffDraft, type StaffStepId, bankIssues, emptyStaffDraft, firstName,
  isStaffStepComplete, isStepSkipped, nextStaffStep, niValid, previousStaffStep, resolveStaffStep, staffOnboardPayload,
  staffProgressFor,
} from '@/lib/utils/staff-onboarding';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const EASE = [0.16, 1, 0.3, 1] as const;
/** Long enough to see the card tick, short enough not to feel like waiting — the sign-up's pace. */
const AUTO_ADVANCE_MS = 280;

const todayISO = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const SCOPE_CHOICES: Choice<StaffScope>[] = [
  { value: 'location', label: 'At chosen locations', detail: 'Only the sites you pick below.', icon: MapPin },
  { value: 'franchise', label: 'Across their franchise', detail: 'Every site in the franchise.', icon: Building2 },
  { value: 'global', label: 'Everywhere', detail: 'Every location in the business.', icon: Globe },
];

const CONTRACT_CHOICES: Choice<EmploymentType>[] = [
  { value: 'full_time', label: EMPLOYMENT_CONFIG.full_time.label, detail: 'Regular hours, usually 35 or more a week.', icon: Clock },
  { value: 'part_time', label: EMPLOYMENT_CONFIG.part_time.label, detail: 'Regular hours, fewer than full time.', icon: CalendarClock },
  { value: 'zero_hours', label: EMPLOYMENT_CONFIG.zero_hours.label, detail: 'No guaranteed hours — paid for the shifts they work.', icon: Timer },
  { value: 'contractor', label: EMPLOYMENT_CONFIG.contractor.label, detail: 'Self-employed and invoices for their work.', icon: FileText },
];

const PAY_CHOICES: Choice<PayType>[] = [
  { value: 'hourly', label: PAY_CONFIG.hourly.label, detail: 'Paid for the hours on their timesheet.', icon: Clock },
  { value: 'salaried', label: PAY_CONFIG.salaried.label, detail: 'A fixed yearly amount, split across pay days.', icon: Wallet },
];

const SCOPE_LABEL: Record<StaffScope, string> = { location: 'Chosen locations', franchise: 'Their franchise', global: 'Every location' };

function roleIcon(key: string) {
  if (/owner|admin/.test(key)) return ShieldCheck;
  if (/manager|lead|supervisor/.test(key)) return Users;
  if (/barista/.test(key)) return Coffee;
  if (/chef|kitchen|cook/.test(key)) return ChefHat;
  if (/cashier|server|front/.test(key)) return Store;
  return UserRound;
}

function currencySymbol(currency: string) {
  try {
    return new Intl.NumberFormat('en-GB', { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0).find((part) => part.type === 'currency')?.value ?? currency;
  } catch {
    return currency;
  }
}

/**
 * Onboarding a new team member, in the same shape as the workspace sign-up:
 * one question per screen, a segment per section, single-choice answers that
 * move on by themselves, and a review with "Change" links before anything is
 * created. The rules live in `lib/utils/staff-onboarding.ts`.
 */
export function OnboardingPage({ onClose, onCreated }: { onClose: () => void; onCreated: (userId: string) => void }) {
  const qc = useQueryClient();
  const reduceMotion = useReducedMotion();
  const actorRole = useAuthStore((state) => state.role);
  const { tenantId } = useWorkspaceStore();
  const { country, uk, currency } = usePayrollLocale();

  const roles = useQuery({
    queryKey: moduleQueryKeys.identity.key('roles', tenantId),
    queryFn: () => getRoles(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const availableRoles = (roles.data?.roles ?? []).filter(
    (role) => role.key !== 'super_admin' && (actorRole !== 'hr_manager' || role.key !== 'franchise_owner'),
  );
  const locations = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const [today] = useState(todayISO);
  const ctx: StaffContext = { uk, today };
  const [draft, setDraft] = useState<StaffDraft>(() => emptyStaffDraft(today));
  // The latest answers for the auto-advance timer and the mutation, written with every change rather than during render.
  const draftRef = useRef(draft);
  const [requested, setRequested] = useState<StaffStepId>('name');
  const step = resolveStaffStep(requested, draft, ctx);
  const [error, setError] = useState<{ message: string; step?: StaffStepId } | null>(null);
  const [created, setCreated] = useState<OnboardResult | null>(null);
  const advanceTimer = useRef<number | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Direction of travel, derived during render from the previous step's position.
  const order = STAFF_STEPS.map((entry) => entry.id);
  const [seen, setSeen] = useState({ step, direction: 1 });
  if (seen.step !== step) setSeen({ step, direction: order.indexOf(step) >= order.indexOf(seen.step) ? 1 : -1 });
  const { direction } = seen;

  const goTo = (target: StaffStepId) => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    setRequested(target);
  };

  useEffect(() => () => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
  }, []);

  // Screen readers land on the new question; a step that autofocused its own field keeps that focus.
  useEffect(() => {
    const active = document.activeElement;
    if (!active || active === document.body || !document.getElementById('staff-onboarding')?.contains(active) || active.tagName === 'BUTTON') {
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [step, created]);

  // Escape backs out of the whole flow — nothing is saved until the last step. Enter moves on from
  // anywhere the ↵ hint promises it, not only from inside a field (a field already submits the form).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (document.querySelector('[role=dialog], [data-radix-popper-content-wrapper]')) return;
      if (event.key === 'Escape') onClose();
      const target = event.target as HTMLElement | null;
      if (event.key === 'Enter' && !event.defaultPrevented && !target?.closest('input, textarea, select, button, a')) {
        // Without this the next step's autofocused field receives the same keypress and submits again.
        event.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const update = (patch: Partial<StaffDraft>) => {
    draftRef.current = { ...draftRef.current, ...patch };
    setDraft(draftRef.current);
  };

  const create = useMutation({
    mutationFn: () => onboardEmployee(staffOnboardPayload(draftRef.current, uk)),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: moduleQueryKeys.identity.key('staff') });
      qc.invalidateQueries({ queryKey: moduleQueryKeys.people.key('hr-employees') });
      setError(null);
      setCreated(result);
    },
    onError: (err) => {
      // The review is long; the reason sits above it, out of sight from the button that was pressed.
      requestAnimationFrame(() => document.getElementById('staff-onboarding')?.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' }));
      if (err instanceof ApiError && err.status === 409) {
        setError({ message: `There is already an account for ${draftRef.current.email.trim()}. Use a different email, or find them in the team list.`, step: 'email' });
      } else {
        setError({ message: (err as Error).message || 'They weren’t onboarded. Check the details and try again.' });
      }
    },
  });

  const advance = () => {
    const fresh = draftRef.current;
    if (!isStaffStepComplete(step, fresh, { uk, today })) return;
    if (step === 'review') {
      create.mutate();
      return;
    }
    const target = nextStaffStep(step);
    if (target) goTo(target);
  };

  const choose = (patch: Partial<StaffDraft>) => {
    update(patch);
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    advanceTimer.current = window.setTimeout(advance, reduceMotion ? 0 : AUTO_ADVANCE_MS);
  };

  const back = () => {
    const target = previousStaffStep(step);
    if (target) goTo(target);
    else onClose();
  };

  const startAnother = () => {
    setCreated(null);
    draftRef.current = emptyStaffDraft(today);
    setDraft(draftRef.current);
    setRequested('name');
  };

  const progress = staffProgressFor(created ? 'review' : step);
  const sectionLabel = STAFF_SECTIONS.find((section) => section.id === progress.activeSection)?.label;
  const canContinue = isStaffStepComplete(step, draft, ctx) && !create.isPending;
  const skipping = isStepSkipped(step, draft);
  const first = firstName(draft.name) || 'them';

  const question = created ? null : questionFor(step, {
    draft, ctx, update, choose, first, country, currency,
    roles: { list: availableRoles, isLoading: roles.isLoading, isError: roles.isError, retry: () => roles.refetch() },
    locations: { list: locations.data ?? [], isLoading: locations.isLoading, isError: locations.isError, retry: () => locations.refetch() },
  });

  return (
    <div id="staff-onboarding" className="fixed inset-0 z-[60] flex flex-col overflow-y-auto bg-background">
      <header className="sticky top-0 z-10 grid grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-4 bg-background/90 px-4 py-3 backdrop-blur md:px-6">
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close onboarding" className="size-11 text-muted-foreground">
          <X size={20} />
        </Button>
        <div className="mx-auto w-full max-w-xs">
          <p className="mb-2 text-center text-label uppercase text-muted-foreground">New team member</p>
          <StaffProgressRail progress={progress} label={sectionLabel} />
        </div>
        <span aria-hidden="true" />
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-14">
        {created ? (
          <Done
            result={created}
            first={firstName(created.name) || created.name}
            uk={uk}
            headingRef={headingRef}
            onOpen={() => onCreated(created.userId)}
            onAnother={startAnother}
          />
        ) : (
          <form
            ref={formRef}
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
                {sectionLabel && (
                  <p className="text-label uppercase text-muted-foreground">
                    {sectionLabel}
                    <span className="ml-2 tabular-nums text-muted-foreground/70">{progress.position} of {progress.total}</span>
                    {STAFF_STEPS.find((entry) => entry.id === step)?.optional && <span className="ml-2 normal-case tracking-normal text-muted-foreground/70">· optional</span>}
                  </p>
                )}
                <h1 ref={headingRef} tabIndex={-1} className="mt-3 text-2xl font-semibold leading-tight tracking-headline text-foreground outline-none sm:text-3xl">
                  {step === 'review' ? <>Check the details, then add <Em>{first}</Em> to the team.</> : question?.title}
                </h1>
                {question?.hint && <p className="mt-2 max-w-[56ch] text-sm leading-6 text-muted-foreground">{question.hint}</p>}
                <div className="mt-8">
                  {step === 'review' ? (
                    <StaffReview draft={draft} ctx={ctx} currency={currency} country={country} roles={availableRoles} locations={locations.data ?? []} error={error} onEdit={goTo} />
                  ) : (
                    question?.body
                  )}
                </div>
              </motion.div>
            </AnimatePresence>

            <div className="mt-12 flex items-center justify-between gap-4">
              <Button type="button" variant="ghost" size="lg" onClick={back} className="h-11 gap-1.5 px-4 text-muted-foreground">
                <ArrowLeft aria-hidden="true" />
                {previousStaffStep(step) ? 'Back' : 'Cancel'}
              </Button>
              <Button type="submit" size="lg" disabled={!canContinue} variant={skipping ? 'outline' : 'default'} className="h-11 min-w-36 gap-2 px-5">
                {create.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
                {step === 'review' ? (create.isPending ? 'Adding…' : `Add ${first}`) : skipping ? 'Skip for now' : 'Continue'}
                {!create.isPending && (
                  <kbd aria-hidden="true" className={cn('hidden rounded border px-1 font-mono text-micro sm:inline', skipping ? 'border-rule' : 'border-primary-foreground/30')}>↵</kbd>
                )}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

// ── The rail ──────────────────────────────────────────────────────────────────

function StaffProgressRail({ progress, label }: { progress: ReturnType<typeof staffProgressFor>; label?: string }) {
  const reduceMotion = useReducedMotion();
  const percent = Math.round(progress.overall * 100);
  return (
    <div
      role="progressbar"
      aria-label="Onboarding progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-valuetext={`${label ?? 'Review'}, ${percent}% complete`}
      className="grid grid-cols-4 gap-1.5"
    >
      {STAFF_SECTIONS.map((section, index) => (
        <div key={section.id} className="h-1 overflow-hidden rounded-full bg-band">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={false}
            animate={{ width: `${progress.sections[index] * 100}%` }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE }}
          />
        </div>
      ))}
    </div>
  );
}

// ── Questions ─────────────────────────────────────────────────────────────────

interface Loadable<T> {
  list: T[];
  isLoading: boolean;
  isError: boolean;
  retry: () => void;
}

interface QuestionContext {
  draft: StaffDraft;
  ctx: StaffContext;
  update: (patch: Partial<StaffDraft>) => void;
  choose: (patch: Partial<StaffDraft>) => void;
  first: string;
  country: string | null;
  currency: string;
  roles: Loadable<AccessRole>;
  locations: Loadable<{ id: string; name: string; address?: string }>;
}

interface Question {
  title: React.ReactNode;
  hint?: string;
  body: React.ReactNode;
}

const fieldLabel = 'mb-1.5 block text-label uppercase text-muted-foreground';

function questionFor(step: StaffStepId, q: QuestionContext): Question | null {
  const { draft, update, choose, first } = q;
  const them = <Em>{first}</Em>;

  switch (step) {
    case 'name':
      return {
        title: 'Who’s joining the team?',
        hint: 'Their full name, as it should appear on the rota and their payslips.',
        body: (
          <BigInput label="Full name" name="name" autoComplete="off" placeholder="Jane Doe" maxLength={255} value={draft.name} onChange={(name) => update({ name })} />
        ),
      };

    case 'email':
      return {
        title: <>What’s {them}’s email?</>,
        hint: 'We’ll send a single-use link there so they can set a password and sign in.',
        body: (
          <BigInput label="Email" name="email" type="email" inputMode="email" autoComplete="off" placeholder="jane@example.com" value={draft.email} onChange={(email) => update({ email })} />
        ),
      };

    case 'role':
      return {
        title: <>What will {them} do?</>,
        hint: 'Their role decides what they can see and do. You can change it at any time.',
        body: (
          <Loaded source={q.roles} what="roles" empty="There are no roles to give yet. Create one under Staff → Roles first.">
            <ChoiceGrid
              label="Role"
              selected={draft.role ? [draft.role] : []}
              onChange={(role) => choose({ role })}
              choices={q.roles.list.map((role) => ({
                value: role.key,
                label: role.name,
                detail: role.description ?? `${role.capabilities.length} permission${role.capabilities.length === 1 ? '' : 's'}`,
                icon: roleIcon(role.key),
              }))}
            />
          </Loaded>
        ),
      };

    case 'access':
      return {
        title: <>Where will {them} work?</>,
        hint: 'They only see the locations their access covers.',
        body: (
          <div className="space-y-8">
            <ChoiceGrid
              label="Access"
              columns={3}
              selected={draft.scope ? [draft.scope] : []}
              onChange={(scope) => (scope === 'location' ? update({ scope }) : choose({ scope }))}
              choices={SCOPE_CHOICES}
            />
            {draft.scope === 'location' && (
              <div>
                <p className={fieldLabel}>Which locations?</p>
                <Loaded source={q.locations} what="locations" empty="This workspace has no locations yet.">
                  <ChoiceGrid
                    label="Locations"
                    multiple
                    shortcuts={false}
                    selected={draft.locationIds}
                    onChange={(id) =>
                      update({ locationIds: draft.locationIds.includes(id) ? draft.locationIds.filter((entry) => entry !== id) : [...draft.locationIds, id] })}
                    choices={q.locations.list.map((location) => ({ value: location.id, label: location.name, detail: location.address || undefined }))}
                  />
                </Loaded>
              </div>
            )}
          </div>
        ),
      };

    case 'birthday':
      return {
        title: <>When is {them}’s birthday?</>,
        hint: 'Used to check pay against the age-based minimum wage. The rest of the team never sees it.',
        body: (
          <div className="max-w-xs">
            <DatePicker label="Date of birth" value={draft.dateOfBirth} onValueChange={(dateOfBirth) => update({ dateOfBirth })} max={q.ctx.today} autoFocus />
          </div>
        ),
      };

    case 'address':
      return {
        title: <>Where does {them} live?</>,
        hint: 'Needed on contracts and payslips. You can add it later from their record.',
        body: <AddressFields value={draft.address} onChange={(address) => update({ address })} labelClassName={fieldLabel} />,
      };

    case 'emergency':
      return {
        title: <>Who should we call if something happens to {them}?</>,
        hint: 'An emergency contact the manager on shift can reach.',
        body: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Name" value={draft.emergencyContactName} maxLength={255} onChange={(event) => update({ emergencyContactName: event.target.value })} autoFocus />
            <Input label="Relationship" value={draft.emergencyContactRelation} maxLength={100} placeholder="e.g. Partner" onChange={(event) => update({ emergencyContactRelation: event.target.value })} />
            <div className="sm:col-span-2">
              <Input label="Phone" type="tel" value={draft.emergencyContactPhone} maxLength={30} onChange={(event) => update({ emergencyContactPhone: event.target.value })} />
            </div>
          </div>
        ),
      };

    case 'job':
      return {
        title: <>What’s {them}’s job title?</>,
        hint: 'As it should read on their contract.',
        body: (
          <div className="space-y-6">
            <BigInput label="Job title" name="jobTitle" autoComplete="off" placeholder="Barista" maxLength={255} value={draft.jobTitle} onChange={(jobTitle) => update({ jobTitle })} />
            <div className="max-w-sm">
              <Input label="Department" value={draft.department} maxLength={100} placeholder="e.g. Front of house" hint="Optional." onChange={(event) => update({ department: event.target.value })} />
            </div>
          </div>
        ),
      };

    case 'contract':
      return {
        title: <>What kind of contract does {them} have?</>,
        body: (
          <ChoiceGrid
            label="Contract"
            selected={draft.employmentType ? [draft.employmentType] : []}
            onChange={(employmentType) => choose({ employmentType })}
            choices={CONTRACT_CHOICES}
          />
        ),
      };

    case 'start':
      return {
        title: <>When does {them} start?</>,
        hint: 'Their first day. Rotas and holiday entitlement count from here.',
        body: (
          <div className="max-w-xs">
            <DatePicker label="Start date" value={draft.startDate} onValueChange={(startDate) => update({ startDate })} required autoFocus />
          </div>
        ),
      };

    case 'pay': {
      const hourly = draft.payType !== 'salaried';
      const ageRate = draft.payType === 'hourly' ? ageBasedMinimumWage(draft.dateOfBirth || undefined, new Date(`${q.ctx.today}T12:00:00`), q.country) : null;
      const belowAgeRate = !!ageRate && draft.hourlyRate.trim() !== '' && Number(draft.hourlyRate) < ageRate.rate;
      return {
        title: <>How is {them} paid?</>,
        body: (
          <div className="space-y-8">
            <ChoiceGrid label="Pay type" shortcuts={false} selected={draft.payType ? [draft.payType] : []} onChange={(payType) => update({ payType })} choices={PAY_CHOICES} />
            {draft.payType && (
              <div>
                <p className={fieldLabel}>{hourly ? 'Hourly rate' : 'Annual salary'}</p>
                <BigInput
                  key={draft.payType}
                  label={hourly ? 'Hourly rate' : 'Annual salary'}
                  name={hourly ? 'hourlyRate' : 'annualSalary'}
                  inputMode="decimal"
                  autoComplete="off"
                  prefix={currencySymbol(q.currency)}
                  placeholder={hourly ? '12.60' : '26,000'}
                  value={hourly ? draft.hourlyRate : draft.annualSalary}
                  onChange={(value) => update(hourly ? { hourlyRate: value.replace(/[^\d.,]/g, '') } : { annualSalary: value.replace(/[^\d.,]/g, '') })}
                />
                {ageRate && !belowAgeRate && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Minimum for {ageRate.label.toLowerCase()}: {formatMoney(ageRate.rate, q.currency)} an hour from 1 April 2026.
                  </p>
                )}
              </div>
            )}
            {belowAgeRate && (
              <p role="alert" className="flex gap-2.5 rounded-lg border border-exception/35 bg-destructive/6 px-4 py-3 text-sm text-foreground">
                <AlertTriangle size={17} className="mt-0.5 shrink-0 text-destructive" aria-hidden="true" />
                <span>
                  That’s below the {formatMoney(ageRate.rate, q.currency)} minimum for {ageRate.label.toLowerCase()} from 1 April 2026. Apprentice rates differ and need checking separately.
                </span>
              </p>
            )}
          </div>
        ),
      };
    }

    case 'breaks':
      return {
        title: <>What break does {them} get?</>,
        hint: 'A planning rule for the rota. Record whether the break was actually taken — never deduct one that wasn’t.',
        body: (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className={fieldLabel}>Unpaid break</p>
              <NumberStepper label="Unpaid break" value={draft.unpaidBreakMins} onChange={(value) => update({ unpaidBreakMins: Math.round(value) })} min={0} max={480} step={5} unit="min" />
            </div>
            <div>
              <p className={fieldLabel}>Once a shift passes</p>
              <NumberStepper
                label="Break threshold"
                value={draft.breakThresholdMins / 60}
                onChange={(value) => update({ breakThresholdMins: Math.round(value * 60) })}
                min={0}
                max={24}
                step={0.5}
                unit="hours"
              />
            </div>
          </div>
        ),
      };

    case 'tax': {
      const idLabel = q.ctx.uk ? 'National Insurance number' : statutoryIdLabel(q.country);
      const niBad = !niValid(draft, q.ctx.uk);
      return {
        title: <>{them}’s tax details</>,
        hint: 'Add them now or from their record later. Encrypted, and visible only to HR and owners.',
        body: (
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label={idLabel}
              value={q.ctx.uk ? formatNiNumber(draft.niNumber) : draft.niNumber}
              onChange={(event) => update({ niNumber: q.ctx.uk ? event.target.value.toUpperCase() : event.target.value })}
              maxLength={13}
              placeholder={q.ctx.uk ? 'AB 12 34 56 C' : ''}
              autoComplete="off"
              spellCheck={false}
              autoFocus
              hint={q.ctx.uk ? 'Two letters, six digits, then a letter A–D.' : 'Up to 13 characters.'}
              error={niBad && draft.niNumber.replace(/\s/g, '').length >= 9 ? 'That isn’t a valid National Insurance number.' : undefined}
            />
            <Input
              label="Tax code"
              value={draft.taxCode}
              onChange={(event) => update({ taxCode: event.target.value.toUpperCase() })}
              maxLength={20}
              placeholder={q.ctx.uk ? '1257L' : 'If your payroll uses one'}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        ),
      };
    }

    case 'bank':
      return {
        title: <>Where should {them}’s pay go?</>,
        hint: 'All or nothing — a sort code with no account number can’t be paid into. Encrypted at rest.',
        body: <BankFields draft={draft} update={update} uk={q.ctx.uk} />,
      };

    case 'review':
      return null;
  }
}

function BankFields({ draft, update, uk }: { draft: StaffDraft; update: (patch: Partial<StaffDraft>) => void; uk: boolean }) {
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const blur = (key: string) => () => setTouched((current) => ({ ...current, [key]: true }));
  const issues = bankIssues(draft, uk);
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Input label="Name on the account" value={draft.accountHolder} maxLength={255} onChange={(event) => update({ accountHolder: event.target.value })} onBlur={blur('holder')} error={touched.holder ? issues.holder : undefined} autoFocus />
      <Input label="Bank" value={draft.bankName} maxLength={255} placeholder="Optional" onChange={(event) => update({ bankName: event.target.value })} />
      <Input
        label={uk ? 'Sort code' : 'Bank code'}
        value={uk ? formatSortCode(draft.sortCode) : draft.sortCode}
        onChange={(event) => update({ sortCode: event.target.value })}
        onBlur={blur('sortCode')}
        inputMode={uk ? 'numeric' : undefined}
        maxLength={uk ? 8 : 10}
        placeholder={uk ? '04-00-04' : ''}
        autoComplete="off"
        error={touched.sortCode ? issues.sortCode : undefined}
      />
      <Input
        label="Account number"
        value={draft.accountNumber}
        onChange={(event) => update({ accountNumber: uk ? event.target.value.replace(/\D/g, '').slice(0, 8) : event.target.value })}
        onBlur={blur('accountNumber')}
        inputMode={uk ? 'numeric' : undefined}
        maxLength={uk ? 8 : 34}
        placeholder={uk ? '12345678' : ''}
        autoComplete="off"
        error={touched.accountNumber ? issues.accountNumber : undefined}
      />
    </div>
  );
}

/** Loading, error-with-retry and empty for a question fed by a query; its children are the success state. */
function Loaded<T>({ source, what, empty, children }: { source: Loadable<T>; what: string; empty: string; children: React.ReactNode }) {
  if (source.isLoading) {
    return (
      <div className="grid gap-3 sm:grid-cols-2" aria-busy="true" aria-label={`Loading ${what}`}>
        {[0, 1, 2, 3].map((index) => <div key={index} className="h-[4.5rem] animate-pulse rounded-lg bg-band/60" />)}
      </div>
    );
  }
  if (source.isError) {
    return (
      <div role="alert" className="flex items-center justify-between gap-4 rounded-lg border border-exception/35 bg-destructive/6 px-4 py-3 text-sm">
        <span className="text-foreground">The {what} didn’t load.</span>
        <Button type="button" variant="outline" size="sm" onClick={source.retry}>Try again</Button>
      </div>
    );
  }
  if (source.list.length === 0) return <p className="rounded-lg border border-dashed border-rule px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>;
  return <>{children}</>;
}

// ── Review ────────────────────────────────────────────────────────────────────

function StaffReview({
  draft, ctx, currency, country, roles, locations, error, onEdit,
}: {
  draft: StaffDraft;
  ctx: StaffContext;
  currency: string;
  country: string | null;
  roles: AccessRole[];
  locations: Array<{ id: string; name: string }>;
  error: { message: string; step?: StaffStepId } | null;
  onEdit: (step: StaffStepId) => void;
}) {
  const skipped = 'Not added';
  const access = draft.scope === 'location'
    ? locations.filter((location) => draft.locationIds.includes(location.id)).map((location) => location.name).join(', ') || SCOPE_LABEL.location
    : draft.scope ? SCOPE_LABEL[draft.scope] : '—';
  const pay = draft.payType === 'salaried'
    ? `${formatMoney(draft.annualSalary.replace(/,/g, ''), currency)} a year`
    : `${formatMoney(draft.hourlyRate.replace(/,/g, ''), currency)} an hour`;
  const threshold = draft.breakThresholdMins / 60;
  const emergency = [draft.emergencyContactName, draft.emergencyContactRelation && `(${draft.emergencyContactRelation})`, draft.emergencyContactPhone]
    .filter((part) => part && part.trim()).join(' ');
  const tax = [draft.niNumber && (ctx.uk ? formatNiNumber(draft.niNumber) : draft.niNumber), draft.taxCode && `Tax code ${draft.taxCode}`].filter(Boolean).join(' · ');
  const bank = draft.accountNumber
    ? `${draft.accountHolder.trim()} · ${ctx.uk ? formatSortCode(draft.sortCode) : draft.sortCode} · ••••${draft.accountNumber.replace(/\s/g, '').slice(-4)}`
    : '';

  const groups: Array<{ title: string; rows: Array<{ step: StaffStepId; label: string; value: string; muted?: boolean }> }> = [
    {
      title: 'Account',
      rows: [
        { step: 'name', label: 'Name', value: draft.name.trim() },
        { step: 'email', label: 'Email', value: draft.email.trim() },
        { step: 'role', label: 'Role', value: roles.find((role) => role.key === draft.role)?.name ?? draft.role },
        { step: 'access', label: 'Works at', value: access },
      ],
    },
    {
      title: 'Personal',
      rows: [
        { step: 'birthday', label: 'Birthday', value: draft.dateOfBirth ? formatDate(draft.dateOfBirth) : skipped, muted: !draft.dateOfBirth },
        { step: 'address', label: 'Address', value: isStepSkipped('address', draft) ? skipped : draft.address.replace(/^[,\s]+|[,\s]+$/g, ''), muted: isStepSkipped('address', draft) },
        { step: 'emergency', label: 'Emergency', value: emergency || skipped, muted: !emergency },
      ],
    },
    {
      title: 'Job & pay',
      rows: [
        { step: 'job', label: 'Job', value: [draft.jobTitle.trim(), draft.department.trim()].filter(Boolean).join(' · ') },
        { step: 'contract', label: 'Contract', value: draft.employmentType ? EMPLOYMENT_CONFIG[draft.employmentType].label : '—' },
        { step: 'start', label: 'Starts', value: formatDate(draft.startDate) },
        { step: 'pay', label: 'Pay', value: pay },
        { step: 'breaks', label: 'Breaks', value: draft.unpaidBreakMins ? `${draft.unpaidBreakMins} min unpaid after ${threshold} hour${threshold === 1 ? '' : 's'}` : 'No unpaid break' },
      ],
    },
    {
      title: 'Tax & bank',
      rows: [
        { step: 'tax', label: ctx.uk ? 'NI & tax' : statutoryIdLabel(country), value: tax || skipped, muted: !tax },
        { step: 'bank', label: 'Bank', value: bank || skipped, muted: !bank },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      {error && (
        <div role="alert" className="flex items-start justify-between gap-4 rounded-md border border-exception/35 bg-destructive/6 px-4 py-3 text-sm text-destructive">
          <span>{error.message}</span>
          {error.step && (
            <button type="button" onClick={() => onEdit(error.step!)} className="shrink-0 text-xs font-semibold underline-offset-4 hover:underline">
              Change
            </button>
          )}
        </div>
      )}
      {groups.map((group) => (
        <section key={group.title}>
          <h2 className="mb-1 text-label uppercase text-muted-foreground/80">{group.title}</h2>
          <dl className="divide-y divide-rule/45 border-y border-rule/45">
            {group.rows.map((row) => (
              <div key={row.label} className="flex items-baseline gap-4 py-2.5">
                <dt className="w-28 shrink-0 text-sm text-muted-foreground">{row.label}</dt>
                <dd className={cn('min-w-0 flex-1 truncate text-sm', row.muted ? 'text-muted-foreground/70' : 'text-foreground')}>{row.value}</dd>
                <dd>
                  <button
                    type="button"
                    onClick={() => onEdit(row.step)}
                    className="text-xs font-semibold text-reference underline-offset-4 hover:underline"
                    aria-label={`Change ${row.label.toLowerCase()}`}
                  >
                    {row.muted ? 'Add' : 'Change'}
                  </button>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="text-xs text-muted-foreground">
        Adding {firstName(draft.name) || 'them'} creates their account and employee record, and emails them a link to sign in.
      </p>
    </div>
  );
}

// ── Done ──────────────────────────────────────────────────────────────────────

const FOLLOW_UP_UK = [
  'Check and keep a copy of their right-to-work evidence.',
  'Give them a written statement of terms on day one.',
  'Complete the HMRC starter checklist, or take their P45.',
  'Assess them for workplace pension auto-enrolment.',
  'Set their work pattern and holiday entitlement.',
];

const FOLLOW_UP = [
  'Check and keep their right-to-work evidence.',
  'Give them a written contract or statement of terms.',
  'Register them with your payroll and tax authority.',
  'Set their work pattern and holiday entitlement.',
];

function Done({
  result, first, uk, headingRef, onOpen, onAnother,
}: {
  result: OnboardResult;
  first: string;
  uk: boolean;
  headingRef: React.Ref<HTMLHeadingElement>;
  onOpen: () => void;
  onAnother: () => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-success/10 text-success" aria-hidden="true">
        <CheckCircle2 size={24} />
      </span>
      <h1 ref={headingRef} tabIndex={-1} className="mt-6 text-2xl font-semibold leading-tight tracking-headline text-foreground outline-none sm:text-3xl">
        <Em>{first}</Em> is on the team.
      </h1>
      <p className="mt-2 max-w-[56ch] text-sm leading-6 text-muted-foreground">
        We’ve emailed a single-use link to <span className="font-medium text-foreground">{result.email}</span> so they can set a password and sign in.
      </p>

      <section className="mt-10">
        <h2 className="text-label uppercase text-muted-foreground">Before their first shift</h2>
        <ul className="mt-3 divide-y divide-rule/45 border-y border-rule/45">
          {(uk ? FOLLOW_UP_UK : FOLLOW_UP).map((item, index) => (
            <motion.li
              key={item}
              initial={reduceMotion ? false : { opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: reduceMotion ? 0 : 0.2 + index * 0.05, duration: 0.3, ease: EASE }}
              className="flex items-start gap-3 py-2.5 text-sm text-foreground"
            >
              <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-rule/70 text-micro tabular-nums text-muted-foreground">{index + 1}</span>
              {item}
            </motion.li>
          ))}
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap items-center justify-between gap-4">
        <Button type="button" variant="ghost" size="lg" onClick={onAnother} className="h-11 px-4 text-muted-foreground">
          Add someone else
        </Button>
        <Button type="button" size="lg" onClick={onOpen} className="h-11 min-w-36 px-5" autoFocus>
          Open {first}’s record
        </Button>
      </div>
    </motion.div>
  );
}
