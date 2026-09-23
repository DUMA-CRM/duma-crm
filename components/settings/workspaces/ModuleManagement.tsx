'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { AlertTriangle, Boxes, CheckCircle2, Loader2, ShieldCheck } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Modal } from '@/components/shared/Modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { type ModuleChangePreview, changeTenantModule, getTenantModules, previewTenantModuleChange } from '@/lib/api/modules.service';
import { CRM_MODULE_MANIFESTS, type ModuleId } from '@/lib/modules/manifest';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const FOUNDATION_MODULES = new Set<ModuleId>(['core', 'identity', 'organization']);

const MODULE_COPY: Record<ModuleId, { name: string; description: string }> = {
  core: { name: 'Core platform', description: 'The shared runtime every workspace needs.' },
  identity: { name: 'Identity & access', description: 'Sign-in, staff access and invitations.' },
  organization: { name: 'Organisation', description: 'Workspaces, locations and business settings.' },
  customers: { name: 'Customers', description: 'Customer records, loyalty and segments.' },
  catalog: { name: 'Products', description: 'Products, categories, modifiers and recipes.' },
  ordering: { name: 'Ordering', description: 'POS, fulfilment, orders and QR ordering.' },
  payments: { name: 'Payments', description: 'Payment connections, checkout and cash-up.' },
  inventory: { name: 'Inventory', description: 'Stock, stocktakes, transfers and forecasting.' },
  purchasing: { name: 'Purchasing', description: 'Suppliers and purchase orders.' },
  workforce: { name: 'Workforce', description: 'Rotas, shifts and attendance.' },
  people: { name: 'People & payroll', description: 'HR records, leave, documents and payroll.' },
  communications: { name: 'Communications', description: 'Customer email, templates and automations.' },
  compliance: { name: 'Compliance', description: 'Privacy operations and audit history.' },
  analytics: { name: 'Analytics', description: 'Dashboard, reports and comparisons.' },
  agent: { name: 'Ask DUMA', description: 'The in-product operational assistant.' },
  support: { name: 'Support', description: 'Help centre and staff helpdesk.' },
};

function nameOf(moduleId: ModuleId) {
  return MODULE_COPY[moduleId].name;
}

function readable(value: string) {
  return value.replaceAll(/[._:-]+/g, ' ').replaceAll(/\b\w/g, (letter) => letter.toUpperCase());
}

function ImpactList({ title, values, empty }: { title: string; values: readonly string[]; empty: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-label text-muted-foreground">{title}</h4>
      {values.length > 0 ? (
        <ul className="mt-2 space-y-1 text-sm text-foreground">
          {values.map((value) => (
            <li key={value}>• {readable(value)}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function ModuleChangeDialog({ preview, onClose }: { preview: ModuleChangePreview; onClose: () => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId)!;
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('');
  const isDisabling = preview.proposed.status === 'disabled';
  const manifest = CRM_MODULE_MANIFESTS.find((item) => item.id === preview.moduleId)!;
  const workflows = [
    ...preview.blastRadius.workflows.backgroundWorkers,
    ...preview.blastRadius.workflows.publishedEvents,
    ...preview.blastRadius.workflows.consumedEvents,
  ];
  const surfaces = [...manifest.navigation, ...manifest.routes, ...manifest.widgets];

  const apply = useMutation({
    mutationFn: () => changeTenantModule(tenantId, preview, reason.trim()),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['tenant-modules', tenantId] }),
        queryClient.invalidateQueries({ queryKey: ['current-tenant-modules', tenantId] }),
      ]);
      toast('success', `${nameOf(preview.moduleId)} ${isDisabling ? 'disabled' : 'enabled'}.`);
      onClose();
    },
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The module was not changed. Preview it again.'),
  });

  return (
    <Modal
      title={`Review ${isDisabling ? 'disabling' : 'enabling'} ${nameOf(preview.moduleId)}`}
      description="Nothing changes until you confirm this preview."
      size="lg"
      onClose={onClose}
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant={isDisabling ? 'destructive' : 'default'}
            disabled={!preview.canApply || reason.trim().length < 3 || apply.isPending}
            onClick={() => apply.mutate()}
          >
            {apply.isPending && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            {apply.isPending ? 'Applying…' : `Confirm ${isDisabling ? 'disable' : 'enable'}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-md border border-rule/65 bg-band/45 px-4 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Current</p>
            <p className="mt-0.5 text-sm font-semibold capitalize text-foreground">{preview.current.status}</p>
          </div>
          <span className="text-muted-foreground" aria-hidden="true">
            →
          </span>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">After confirmation</p>
            <p className="mt-0.5 text-sm font-semibold capitalize text-foreground">{preview.proposed.status}</p>
          </div>
        </div>

        {!preview.canApply && (
          <div className="flex gap-3 rounded-md border border-exception/45 bg-exception/6 p-3 text-sm text-exception">
            <AlertTriangle size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              {preview.blockers.foundation
                ? 'This is a foundation module and cannot be disabled.'
                : `Disable ${preview.blockers.requiredBy.map(nameOf).join(', ')} first because they depend on this module.`}
            </p>
          </div>
        )}

        {preview.changes.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-foreground">Proposed changes</h3>
            <ul className="mt-2 divide-y divide-rule/45 rounded-md border border-rule/65">
              {preview.changes.map((change) => (
                <li key={change.moduleId} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <span className="font-medium text-foreground">{nameOf(change.moduleId)}</span>
                  <Badge variant={change.status === 'enabled' ? 'success' : 'destructive'}>{change.status}</Badge>
                </li>
              ))}
            </ul>
            {preview.additions.length > 0 && (
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {preview.additions.map(nameOf).join(', ')} will be enabled automatically because {nameOf(preview.moduleId)} depends on{' '}
                {preview.additions.length === 1 ? 'it' : 'them'}.
              </p>
            )}
          </div>
        )}

        {isDisabling && (
          <div>
            <h3 className="text-sm font-semibold text-foreground">What this affects</h3>
            <div className="mt-3 grid gap-4 border-y border-rule/55 py-4 sm:grid-cols-2">
              <ImpactList title="Pages & widgets" values={surfaces} empty="No visible CRM surfaces are registered." />
              <ImpactList title="Automated workflows" values={workflows} empty="No background workflows are registered." />
              <ImpactList
                title="Integrations"
                values={preview.blastRadius.integrations}
                empty="No integration setup checks are registered."
              />
              <ImpactList
                title="Access rules"
                values={preview.blastRadius.capabilities}
                empty="No staff access rules are owned by this module."
              />
            </div>
            <div className="mt-3 flex gap-3 rounded-md bg-success-highlight px-3 py-3 text-sm text-success">
              <ShieldCheck size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
              <p>
                Historical data is preserved across {preview.blastRadius.historicalData.tables.length}{' '}
                {preview.blastRadius.historicalData.tables.length === 1 ? 'table' : 'tables'}. Disabling only stops access and execution; it
                does not delete records.
              </p>
            </div>
          </div>
        )}

        <label className="block">
          <span className="text-sm font-semibold text-foreground">Reason for this change</span>
          <textarea
            rows={3}
            maxLength={500}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 w-full resize-y rounded-md border border-input bg-field px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:border-primary focus:outline-2 focus:outline-primary/25"
            placeholder="For example: preparing this workspace for stock management"
          />
          <span className="mt-1 block text-xs text-muted-foreground">
            Saved with the actor and before/after state in the audit history.
          </span>
        </label>
      </div>
    </Modal>
  );
}

export function ModuleManagement() {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const [preview, setPreview] = useState<ModuleChangePreview | null>(null);
  const previewMutation = useMutation({
    mutationFn: ({ moduleId, status }: { moduleId: ModuleId; status: 'enabled' | 'disabled' }) =>
      previewTenantModuleChange(tenantId!, moduleId, status),
    onSuccess: setPreview,
    onError: (error) => toast('error', error instanceof Error ? error.message : 'The change preview could not be loaded.'),
  });
  const modules = useQuery({
    queryKey: ['tenant-modules', tenantId],
    queryFn: () => getTenantModules(tenantId!),
    enabled: Boolean(tenantId),
  });

  return (
    <SettingsSection
      title="Product modules"
      description="Control which parts of DUMA this workspace can use. Every change is previewed first and recorded in the audit history."
      footnote="Disabling a module never deletes its historical data."
    >
      {!tenantId ? (
        <p className="text-sm text-muted-foreground">Choose a workspace to manage its modules.</p>
      ) : modules.isLoading ? (
        <div className="space-y-2" aria-label="Loading product modules">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      ) : modules.error ? (
        <div className="flex items-center gap-3 text-sm text-exception">
          <AlertTriangle size={17} aria-hidden="true" />
          <span>{modules.error.message}</span>
        </div>
      ) : (
        <ul className="divide-y divide-rule/45">
          {(modules.data ?? []).map((module) => {
            const copy = MODULE_COPY[module.moduleId];
            const locked = FOUNDATION_MODULES.has(module.moduleId);
            const isPreviewing = previewMutation.isPending && previewMutation.variables?.moduleId === module.moduleId;
            return (
              <li key={module.moduleId} className="flex min-h-16 items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md',
                    module.status === 'enabled' ? 'bg-success-highlight text-success' : 'bg-band text-muted-foreground',
                  )}
                >
                  {locked ? (
                    <ShieldCheck size={16} aria-hidden="true" />
                  ) : module.status === 'enabled' ? (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  ) : (
                    <Boxes size={16} aria-hidden="true" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">{copy.name}</p>
                    <Badge variant={module.status === 'enabled' ? 'success' : 'muted'}>{locked ? 'Required' : module.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{copy.description}</p>
                </div>
                {!locked && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={previewMutation.isPending}
                    onClick={() =>
                      previewMutation.mutate({
                        moduleId: module.moduleId,
                        status: module.status === 'enabled' ? 'disabled' : 'enabled',
                      })
                    }
                  >
                    {isPreviewing && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                    {isPreviewing ? 'Previewing…' : module.status === 'enabled' ? 'Review disable' : 'Review enable'}
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {preview && <ModuleChangeDialog preview={preview} onClose={() => setPreview(null)} />}
    </SettingsSection>
  );
}
