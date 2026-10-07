'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useState } from 'react';

import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  type IconComponent,
  LayoutDashboard,
  LayoutGrid,
  Loader2,
  Plug,
  ShieldCheck,
  Zap,
} from '@/components/icons';
import { moduleCopy } from '@/components/onboarding/modules';
import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';

import { DASHBOARD_WIDGETS } from '@/lib/dashboard/widget-registry';
import { CRM_MODULE_MANIFESTS, type ModuleId } from '@/lib/modules/manifest';
import { type ModuleChangePreview, changeTenantModule } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type ImpactGroup, describeModuleImpact, listSentence } from '@/lib/utils/module-impact';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const EASE = [0.16, 1, 0.3, 1] as const;
const WIDGET_LABELS = Object.fromEntries(DASHBOARD_WIDGETS.map((widget) => [widget.key, widget.label]));

// One vocabulary for tools across onboarding, the Modules grid and this dialog.
const nameOf = (moduleId: ModuleId) => moduleCopy(moduleId).name;

// One tap fills the reason; the audit log still gets a real sentence.
const REASONS = {
  off: ['We’re not using it', 'Setting it up later', 'Trying things out'],
  on: ['We’re starting to use it', 'Trying it out', 'Needed for another tool'],
} as const;

/** What changes, said the way an owner would say it. Staff permissions live under "technical details". */
function changeSentences(groups: ImpactGroup[], name: string, turningOff: boolean): Array<{ icon: IconComponent; text: string }> {
  const lines: Array<{ icon: IconComponent; text: string }> = [];
  const items = (key: ImpactGroup['key']) => groups.find((group) => group.key === key)?.items ?? [];
  const pages = items('pages');
  const panels = items('panels');
  const automations = items('automations');
  const integrations = items('integrations');
  if (pages.length) {
    lines.push({
      icon: LayoutGrid,
      text: turningOff
        ? `${listSentence(pages)} ${pages.length === 1 ? 'disappears' : 'disappear'} from the menu.`
        : `${listSentence(pages)} ${pages.length === 1 ? 'appears' : 'appear'} in the menu.`,
    });
  }
  if (panels.length) {
    const panelWord = panels.length === 1 ? 'panel' : 'panels';
    lines.push({
      icon: LayoutDashboard,
      text: turningOff
        ? `The ${listSentence(panels)} ${panelWord} ${panels.length === 1 ? 'leaves' : 'leave'} the dashboard.`
        : `The ${listSentence(panels)} ${panelWord} can show on the dashboard.`,
    });
  }
  if (automations.length) {
    lines.push({
      icon: Zap,
      text: turningOff
        ? `${listSentence(automations)} ${automations.length === 1 ? 'stops' : 'stop'} running automatically.`
        : `${listSentence(automations)} ${automations.length === 1 ? 'starts' : 'start'} running automatically.`,
    });
  }
  if (integrations.length) {
    lines.push({
      icon: Plug,
      text: turningOff
        ? `${listSentence(integrations)} ${integrations.length === 1 ? 'is' : 'are'} paused.`
        : `${listSentence(integrations)} ${integrations.length === 1 ? 'needs' : 'need'} setting up.`,
    });
  }
  if (lines.length === 0)
    lines.push({ icon: LayoutGrid, text: turningOff ? `Your team stops seeing ${name}.` : `Your team starts seeing ${name}.` });
  return lines;
}

/** Review-then-confirm for turning one tool on or off. Platform admins only (`tenants:write`). */
export function ModuleChangeDialog({ preview, onClose }: { preview: ModuleChangePreview; onClose: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId)!;
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();
  const [reason, setReason] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const turningOff = preview.proposed.status === 'disabled';
  const verb = turningOff ? 'Turn off' : 'Turn on';
  const copy = moduleCopy(preview.moduleId);
  const Icon = copy.icon;
  const manifest = CRM_MODULE_MANIFESTS.find((item) => item.id === preview.moduleId);
  const impact = describeModuleImpact(
    {
      navigation: manifest?.navigation ?? [],
      routes: manifest?.routes ?? [],
      widgets: [...(manifest?.widgets ?? []), ...preview.blastRadius.widgets],
      backgroundWorkers: preview.blastRadius.workflows.backgroundWorkers,
      integrations: preview.blastRadius.integrations,
      capabilities: preview.blastRadius.capabilities,
    },
    WIDGET_LABELS,
  );
  const lines = changeSentences(impact, copy.name, turningOff);
  const permissions = impact.find((group) => group.key === 'access')?.items ?? [];
  const suggestions = turningOff ? REASONS.off : REASONS.on;

  const apply = useMutation({
    mutationFn: () => changeTenantModule(tenantId, preview, reason.trim()),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('tenant-modules', tenantId) }),
        queryClient.invalidateQueries({ queryKey: moduleQueryKeys.organization.key('current-tenant-modules', tenantId) }),
      ]);
      toast('success', `${copy.name} is ${turningOff ? 'off' : 'on'}.`);
      onClose();
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'Nothing was changed. Try again.'),
  });
  const canConfirm = preview.canApply && reason.trim().length >= 3 && !apply.isPending;

  return (
    <Modal
      title={`${verb} ${copy.name}?`}
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" size="lg" className="h-11 px-4" onClick={onClose}>
            Keep it {turningOff ? 'on' : 'off'}
          </Button>
          <Button
            type="button"
            size="lg"
            className="h-11 min-w-40 px-5"
            variant={turningOff ? 'destructive' : 'default'}
            disabled={!canConfirm}
            onClick={() => apply.mutate()}
          >
            {apply.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {apply.isPending ? 'Saving…' : `${verb} ${copy.name}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Which tool, and the one-line answer to "what does this mean for me". */}
        <div className="flex items-center gap-4">
          <span
            className={cn(
              'flex size-14 shrink-0 items-center justify-center rounded-xl transition-colors',
              turningOff ? 'bg-band text-muted-foreground' : 'bg-primary/8 text-primary',
            )}
          >
            <Icon size={26} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">{copy.name}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {turningOff
                ? `Your team won’t see ${copy.name} until you turn it back on.`
                : 'Your team can start using it as soon as you confirm.'}
            </p>
          </div>
        </div>

        {!preview.canApply && (
          <div role="alert" className="flex gap-3 rounded-lg border border-exception/40 bg-exception/6 px-4 py-3 text-sm text-foreground">
            <AlertTriangle size={17} className="mt-0.5 shrink-0 text-exception" aria-hidden="true" />
            <p>
              {preview.blockers.foundation
                ? `${copy.name} is part of every workspace, so it can’t be turned off.`
                : `Turn off ${listSentence(preview.blockers.requiredBy.map((blocker) => nameOf(blocker.moduleId)))} first — ${preview.blockers.requiredBy.length === 1 ? 'it uses' : 'they use'} ${copy.name}.`}
            </p>
          </div>
        )}

        {turningOff && preview.canApply && preview.blockers.requiredBy.length > 0 && (
          <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <ArrowRight size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              <span className="font-semibold">
                {listSentence(preview.blockers.requiredBy.map((dependent) => nameOf(dependent.moduleId)))}
              </span>{' '}
              will be turned off too — {preview.blockers.requiredBy.length === 1 ? 'it needs' : 'they need'} {copy.name} to work.
            </p>
          </div>
        )}

        {preview.additions.length > 0 && (
          <div className="flex gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground">
            <ArrowRight size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            <p>
              <span className="font-semibold">{listSentence(preview.additions.map(({ moduleId }) => nameOf(moduleId)))}</span> will be
              turned on too — {copy.name} needs {preview.additions.length === 1 ? 'it' : 'them'} to work.
            </p>
          </div>
        )}

        <section aria-labelledby="module-change-what">
          <h3 id="module-change-what" className="text-label uppercase text-muted-foreground">
            What changes
          </h3>
          <ul className="mt-2 space-y-2">
            {lines.map(({ icon: LineIcon, text }, index) => (
              <motion.li
                key={text}
                initial={reduceMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.05 + index * 0.05, duration: 0.3, ease: EASE }}
                className="flex items-start gap-3 text-sm text-foreground"
              >
                <span className="mt-px flex size-6 shrink-0 items-center justify-center rounded-md bg-band text-muted-foreground">
                  <LineIcon size={13} aria-hidden="true" />
                </span>
                <span className="pt-0.5">{text}</span>
              </motion.li>
            ))}
          </ul>
        </section>

        {turningOff && (
          <div className="flex gap-3 rounded-lg border border-success/30 bg-success-highlight px-4 py-3 text-sm text-foreground">
            <ShieldCheck size={17} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
            <p>
              <span className="font-semibold">Your data is kept.</span> Nothing is deleted — turn it back on any time and everything is
              still there.
            </p>
          </div>
        )}

        <div>
          <p className="text-label uppercase text-muted-foreground">
            Why? <span className="normal-case tracking-normal">(for your records)</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((suggestion) => {
              const active = reason === suggestion;
              return (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => setReason(suggestion)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                    active ? 'border-primary bg-primary text-primary-foreground' : 'border-rule/60 bg-field text-foreground hover:bg-band',
                  )}
                >
                  {active && <CheckCircle2 size={14} aria-hidden="true" />}
                  {suggestion}
                </button>
              );
            })}
          </div>
          <input
            type="text"
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            aria-label="Reason"
            placeholder="Or write your own"
            className="mt-2 h-9 w-full rounded-md border border-input bg-control px-3 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        {permissions.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setShowDetails((open) => !open)}
              aria-expanded={showDetails}
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Technical details
              <ChevronDown size={14} className={cn('transition-transform', showDetails && 'rotate-180')} aria-hidden="true" />
            </button>
            <AnimatePresence initial={false}>
              {showDetails && (
                <motion.div
                  initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.25, ease: EASE }}
                  className="overflow-hidden"
                >
                  <p className="mt-2 text-xs text-muted-foreground">
                    Staff permissions {turningOff ? 'paused' : 'enabled'}: {listSentence(permissions.map((item) => item.toLowerCase()))}.
                    {turningOff && ` History kept in ${preview.blastRadius.historicalData.tables.length} tables.`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </Modal>
  );
}
