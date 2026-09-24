'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, ShieldCheck, Sparkles } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

import {
  type WorkspaceModuleId,
  type WorkspaceOnboardingAnswers,
  applyWorkspaceRecommendation,
  generateWorkspaceRecommendation,
  getWorkspaceSetup,
  startWorkspaceSetup,
} from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const MODULE_NAMES: Record<WorkspaceModuleId, string> = {
  core: 'Core platform', identity: 'Identity & access', organization: 'Organisation', customers: 'Customers',
  catalog: 'Products', ordering: 'Ordering', payments: 'Payments', inventory: 'Inventory', purchasing: 'Purchasing',
  workforce: 'Workforce', people: 'People & payroll', communications: 'Communications', compliance: 'Compliance',
  analytics: 'Analytics', agent: 'Ask DUMA', support: 'Support',
};

const DEFAULT_ANSWERS: WorkspaceOnboardingAnswers = {
  salesChannels: [], paymentMethods: [], fulfilment: [], liveFulfilmentQueue: false,
  stockTracking: 'none', automaticConsumption: false, purchasing: false, peopleRecords: false,
  scheduling: false, attendance: false, leave: false, payroll: false, customers: false, loyalty: false,
  communications: false, compliance: false, analytics: false, support: false, agent: false, declinedModules: [],
};

const WORKFLOW_CHOICES: Array<{ key: keyof WorkspaceOnboardingAnswers; label: string; detail: string }> = [
  { key: 'liveFulfilmentQueue', label: 'Live fulfilment queue', detail: 'Coordinate kitchen, collection or dispatch work as orders arrive.' },
  { key: 'automaticConsumption', label: 'Automatic stock use', detail: 'Consume recipe or item stock when a sale completes.' },
  { key: 'purchasing', label: 'Supplier purchasing', detail: 'Raise purchase orders and receive deliveries.' },
  { key: 'peopleRecords', label: 'Employee records', detail: 'Keep employment, documents and pay data together.' },
  { key: 'scheduling', label: 'Rotas', detail: 'Plan shifts and publish schedules.' },
  { key: 'attendance', label: 'Attendance', detail: 'Track clock-ins and actual hours.' },
  { key: 'leave', label: 'Leave', detail: 'Manage allowances and requests.' },
  { key: 'payroll', label: 'Payroll', detail: 'Prepare and retain payroll runs.' },
  { key: 'customers', label: 'Customer records', detail: 'Recognise customers across visits.' },
  { key: 'loyalty', label: 'Loyalty', detail: 'Earn and redeem loyalty points.' },
  { key: 'communications', label: 'Communications', detail: 'Send customer or staff messages.' },
  { key: 'compliance', label: 'Compliance', detail: 'Run privacy and audit workflows.' },
  { key: 'analytics', label: 'Analytics', detail: 'Compare performance and operating trends.' },
  { key: 'agent', label: 'Ask DUMA', detail: 'Use the in-product operational assistant.' },
  { key: 'support', label: 'Support', detail: 'Use the help centre and staff helpdesk.' },
];

const SALES_CHANNELS = [
  ['counter', 'Counter'], ['online', 'Online'], ['qr', 'QR ordering'], ['phone', 'Phone'], ['marketplace', 'Marketplace'],
] as const;
const PAYMENT_METHODS = [['cash', 'Cash'], ['card', 'Card'], ['invoice', 'Invoice']] as const;
const FULFILMENT = [
  ['prepare', 'Prepare'], ['table_service', 'Table service'], ['collection', 'Collection'], ['delivery', 'Delivery'], ['pick_pack', 'Pick & pack'],
] as const;

function ToggleRow({ checked, label, detail, onChange }: { checked: boolean; label: string; detail: string; onChange: () => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-2.5">
      <input type="checkbox" checked={checked} onChange={onChange} className="mt-0.5 size-4 shrink-0 rounded accent-primary" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{label}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{detail}</span>
      </span>
    </label>
  );
}

function ChoiceStrip<T extends string>({
  label, values, selected, onToggle,
}: { label: string; values: readonly (readonly [T, string])[]; selected: T[]; onToggle: (value: T) => void }) {
  return (
    <fieldset>
      <legend className="text-xs font-semibold text-foreground">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {values.map(([value, text]) => {
          const active = selected.includes(value);
          return (
            <label key={value} className={cn(
              'inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm transition-colors',
              active ? 'border-primary bg-primary text-primary-foreground' : 'border-rule bg-field text-foreground hover:bg-band',
            )}>
              <input type="checkbox" className="sr-only" checked={active} onChange={() => onToggle(value)} />
              {active && <CheckCircle2 size={14} aria-hidden="true" />}
              {text}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function WorkspaceRecommendation() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const queryKey = ['workspace-setup', tenantId];
  const setup = useQuery({ queryKey, queryFn: () => getWorkspaceSetup(tenantId!), enabled: Boolean(tenantId) });
  const [answers, setAnswers] = useState<WorkspaceOnboardingAnswers>(DEFAULT_ANSWERS);
  const [selectedModules, setSelectedModules] = useState<WorkspaceModuleId[]>([]);
  const [editing, setEditing] = useState(false);
  const [loadedRevision, setLoadedRevision] = useState(-1);
  if (setup.data && loadedRevision !== setup.data.recommendationRevision) {
    setLoadedRevision(setup.data.recommendationRevision);
    setAnswers({ ...DEFAULT_ANSWERS, ...setup.data.answers });
    setSelectedModules(setup.data.recommendation?.selectedModules ?? []);
  }

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenant-modules', tenantId) }),
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId) }),
    ]);
  };
  const start = useMutation({ mutationFn: () => startWorkspaceSetup(tenantId!), onSuccess: refresh });
  const generate = useMutation({
    mutationFn: () => generateWorkspaceRecommendation(tenantId!, answers, setup.data!.recommendationRevision),
    onSuccess: async () => { setEditing(false); await refresh(); toast('success', 'Workspace proposal is ready to review.'); },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The workspace proposal could not be generated.'),
  });
  const apply = useMutation({
    mutationFn: () => applyWorkspaceRecommendation(tenantId!, selectedModules, setup.data!.recommendationRevision),
    onSuccess: async () => { await refresh(); toast('success', 'Workspace modules activated from the reviewed proposal.'); },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The proposal changed. Generate it again before activating.'),
  });

  if (!tenantId) return null;
  if (setup.isLoading) return <div className="h-24 animate-pulse rounded-md bg-muted" aria-label="Loading workspace plan" />;
  if (!setup.data) {
    return (
      <div className="flex flex-wrap items-center gap-3 border-y border-rule/55 py-4">
        <Sparkles size={18} className="text-primary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Build this workspace around how the business runs</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Answer a short operating profile, then review every module before anything changes.</p>
        </div>
        <Button size="sm" onClick={() => start.mutate()} disabled={start.isPending}>
          {start.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Start workspace plan
        </Button>
      </div>
    );
  }

  const session = setup.data;
  const recommendation = session.recommendation;
  const showForm = editing || !recommendation;
  const toggleArray = <T extends string>(key: 'salesChannels' | 'paymentMethods' | 'fulfilment', value: T) => {
    setAnswers((current) => {
      const values = current[key] as string[];
      return { ...current, [key]: values.includes(value) ? values.filter((item) => item !== value) : [...values, value] };
    });
  };

  if (showForm) {
    const hasDirectNeed = answers.salesChannels.length > 0
      || answers.paymentMethods.length > 0
      || answers.fulfilment.length > 0
      || answers.stockTracking !== 'none'
      || WORKFLOW_CHOICES.some((choice) => Boolean(answers[choice.key]));
    return (
      <div className="border-y border-rule/55 py-5">
        <div className="flex items-start gap-3">
          <Sparkles size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Tell DUMA what this workspace needs to run</h3>
            <p className="mt-1 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
              This creates a reviewable proposal. It does not switch anything on until you approve the final list.
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(14rem,0.7fr)_minmax(0,1.3fr)]">
          <div className="space-y-4">
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Closest business type</span>
              <Select
                value={answers.businessType ?? ''}
                onValueChange={(value) => setAnswers((current) => ({ ...current, businessType: value as WorkspaceOnboardingAnswers['businessType'] }))}
                options={[
                  { value: 'cafe', label: 'Café' }, { value: 'restaurant', label: 'Restaurant' }, { value: 'retail', label: 'Retail' },
                  { value: 'online_retail', label: 'Online retail' }, { value: 'services', label: 'Services' },
                  { value: 'people_management', label: 'People management' }, { value: 'other', label: 'Something else' },
                ]}
                ariaLabel="Closest business type"
                className="mt-2 w-full"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Number of locations</span>
              <input
                type="number" min={1} max={10_000} value={answers.locationCount ?? 1}
                onChange={(event) => setAnswers((current) => ({ ...current, locationCount: Math.max(1, Number(event.target.value) || 1) }))}
                className="mt-2 h-9 w-full rounded-md border border-input bg-field px-3 text-base text-foreground outline-none focus:border-primary focus:outline-2 focus:outline-primary/25 sm:text-sm"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-foreground">Stock tracking</span>
              <Select
                value={answers.stockTracking}
                onValueChange={(value) => setAnswers((current) => ({ ...current, stockTracking: value as WorkspaceOnboardingAnswers['stockTracking'] }))}
                options={[
                  { value: 'none', label: 'Not needed' }, { value: 'simple', label: 'Simple quantities' },
                  { value: 'batch_expiry', label: 'Batches and expiry' }, { value: 'serial', label: 'Serial numbers' },
                  { value: 'container', label: 'Containers and partial units' },
                ]}
                ariaLabel="Stock tracking method"
                className="mt-2 w-full"
              />
            </label>
          </div>
          <div className="space-y-5">
            <ChoiceStrip label="Where sales arrive" values={SALES_CHANNELS} selected={answers.salesChannels} onToggle={(value) => toggleArray('salesChannels', value)} />
            <ChoiceStrip label="How customers pay" values={PAYMENT_METHODS} selected={answers.paymentMethods} onToggle={(value) => toggleArray('paymentMethods', value)} />
            <ChoiceStrip label="How work is fulfilled" values={FULFILMENT} selected={answers.fulfilment} onToggle={(value) => toggleArray('fulfilment', value)} />
          </div>
        </div>

        <div className="mt-5 grid divide-y divide-rule/45 border-y border-rule/45 sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          <div className="divide-y divide-rule/35 sm:pr-5">
            {WORKFLOW_CHOICES.slice(0, 8).map((choice) => (
              <ToggleRow key={choice.key} checked={Boolean(answers[choice.key])} label={choice.label} detail={choice.detail}
                onChange={() => setAnswers((current) => ({ ...current, [choice.key]: !current[choice.key] }))} />
            ))}
          </div>
          <div className="divide-y divide-rule/35 sm:pl-5">
            {WORKFLOW_CHOICES.slice(8).map((choice) => (
              <ToggleRow key={choice.key} checked={Boolean(answers[choice.key])} label={choice.label} detail={choice.detail}
                onChange={() => setAnswers((current) => ({ ...current, [choice.key]: !current[choice.key] }))} />
            ))}
          </div>
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {recommendation && <Button variant="outline" size="sm" onClick={() => setEditing(false)}>Keep current proposal</Button>}
          <Button size="sm" disabled={(!answers.businessType && !hasDirectNeed) || generate.isPending} onClick={() => generate.mutate()}>
            {generate.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {recommendation ? 'Generate new proposal' : 'Build module proposal'}
          </Button>
        </div>
      </div>
    );
  }

  const issues = [
    ...recommendation.conflicts.map((item) => item.message),
    ...recommendation.assumptions.filter((item) => item.blocking).map((item) => item.message),
  ];
  const optional = recommendation.optionalModules;
  const approved = Boolean(session.reviewedAt);
  const toggleOptional = (moduleId: WorkspaceModuleId) => setSelectedModules((current) =>
    current.includes(moduleId) ? current.filter((item) => item !== moduleId) : [...current, moduleId],
  );

  return (
    <div className="border-y border-rule/55 py-5">
      <div className="flex flex-wrap items-start gap-3">
        {approved ? <CheckCircle2 size={18} className="mt-0.5 text-success" aria-hidden="true" /> : <ShieldCheck size={18} className="mt-0.5 text-primary" aria-hidden="true" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">{approved ? 'Workspace proposal approved' : 'Review the workspace proposal'}</h3>
            <Badge variant={approved ? 'success' : 'reference'}>Revision {recommendation.revision}</Badge>
          </div>
          <p className="mt-1 max-w-[68ch] text-xs leading-relaxed text-muted-foreground">
            {approved
              ? 'The approved module set is active. You can update the operating profile whenever the business changes.'
              : 'Required modules are locked because another selected workflow depends on them. Recommended companions stay optional.'}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
          <RefreshCw size={14} aria-hidden="true" /> Update answers
        </Button>
      </div>

      {issues.length > 0 && (
        <div className="mt-4 flex gap-3 rounded-md border border-exception/45 bg-exception/6 p-3 text-sm text-exception" role="alert">
          <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
          <div><p className="font-semibold">Resolve before activation</p><ul className="mt-1 list-disc space-y-1 pl-4">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>
        </div>
      )}

      <div className="mt-4 divide-y divide-rule/45 border-y border-rule/55">
        {recommendation.requiredModules.map((moduleId) => (
          <div key={moduleId} className="flex items-start gap-3 py-3">
            <ShieldCheck size={16} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-semibold text-foreground">{MODULE_NAMES[moduleId]}</p><Badge variant="muted">Required</Badge></div>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{recommendation.reasons[moduleId]?.join(' ')}</p>
            </div>
          </div>
        ))}
        {optional.map((moduleId) => (
          <label key={moduleId} className="flex cursor-pointer items-start gap-3 py-3">
            <input type="checkbox" checked={selectedModules.includes(moduleId)} onChange={() => toggleOptional(moduleId)} disabled={approved} className="mt-0.5 size-4 rounded accent-primary" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-foreground">{MODULE_NAMES[moduleId]}</span><Badge variant="reference">Recommended</Badge></span>
              <span className="mt-0.5 block text-xs text-muted-foreground">Useful alongside the selected workflow, but not required for it to work.</span>
            </span>
          </label>
        ))}
      </div>
      {!approved && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-[60ch] text-xs leading-relaxed text-muted-foreground">Activation is one transaction. If the workspace changed since this preview, DUMA will stop and ask for a fresh proposal.</p>
          <Button size="sm" disabled={issues.length > 0 || apply.isPending} onClick={() => apply.mutate()}>
            {apply.isPending && <Loader2 className="animate-spin" aria-hidden="true" />} Review and activate
          </Button>
        </div>
      )}
    </div>
  );
}
