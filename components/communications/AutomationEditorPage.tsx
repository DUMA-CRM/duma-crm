'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { CheckCircle2, Eye, Loader2, Play, Plus, Trash2, TriangleAlert } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { TimezoneSelect } from '@/components/shared/TimezoneSelect';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type EmailAutomation,
  type EmailWorkflowDefinition,
  type EmailWorkflowNode,
  createEmailAutomation,
  getEmailAutomationRuns,
  getEmailConnection,
  getEmailTemplates,
  publishEmailAutomation,
  updateEmailAutomation,
} from '@/lib/api/email.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { EmailPreviewDrawer } from './EmailPreviewDrawer';
import { WorkflowRunDrawer } from './WorkflowRunDrawer';
import { TRIGGER_HELP, TRIGGER_OPTIONS } from './shared';
import {
  defaultWorkflow,
  insertWorkflowNode,
  removeWorkflowNode,
  updateWorkflowNode,
  workflowErrors,
  workflowForAutomation,
  workflowSummary,
} from './workflowModel';
import { DOT_GRID_STYLE, NODE_META, nodeDetail } from './workflowNodes';

/**
 * The two branch columns under a condition. Shared by the columns themselves and
 * by BranchConnector, which mirrors this geometry to draw the join — if the gap
 * changes here, the connector's half-gap bridge (`-right-4` / `-left-4`) has to
 * change with it.
 */
const BRANCH_GRID = 'grid w-full grid-cols-2 gap-8';

const CONDITION_FIELDS = [
  { value: 'customer.marketingOptIn', label: 'Customer · marketing opt-in' },
  { value: 'customer.tier', label: 'Customer · loyalty tier' },
  { value: 'customer.pointsBalance', label: 'Customer · points balance' },
  { value: 'order.status', label: 'Order · status' },
  { value: 'order.totalAmount', label: 'Order · total amount' },
  { value: 'order.paymentMethod', label: 'Order · payment method' },
];
const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'not_equals', label: 'Does not equal' },
  { value: 'greater_than', label: 'Greater than' },
  { value: 'greater_than_or_equal', label: 'At least' },
  { value: 'less_than', label: 'Less than' },
  { value: 'less_than_or_equal', label: 'At most' },
  { value: 'contains', label: 'Contains' },
];

export function AutomationEditorPage({
  automation,
  onClose,
  onSaved,
  onOpenTemplates,
  onOpenConnection,
}: {
  automation?: EmailAutomation;
  onClose: () => void;
  onSaved?: (saved: EmailAutomation) => void;
  onOpenTemplates?: () => void;
  onOpenConnection?: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const [name, setName] = useState(automation?.name ?? '');
  const [definition, setDefinition] = useState<EmailWorkflowDefinition>(() =>
    automation ? workflowForAutomation(automation) : defaultWorkflow(),
  );
  const [selectedId, setSelectedId] = useState(definition.nodes[0]?.id ?? '');
  const [savedId, setSavedId] = useState(automation?.id ?? null);
  const [previewing, setPreviewing] = useState(false);
  const [openedRunId, setOpenedRunId] = useState<string | null>(null);
  const snapshot = JSON.stringify({ name, definition });
  const [initialSnapshot, setInitialSnapshot] = useState(snapshot);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId ?? ''),
    enabled: !!tenantId,
  });
  const { data: connection } = useQuery({
    queryKey: ['email-connection', tenantId],
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });
  const { data: runs = [] } = useQuery({
    queryKey: ['email-automation-runs', savedId, tenantId],
    queryFn: () => getEmailAutomationRuns(savedId ?? '', tenantId ?? undefined),
    enabled: !!savedId && !!tenantId,
    refetchInterval: 30_000,
  });
  const usableTemplates = templates.filter((template) => template.isActive);

  const selected = definition.nodes.find((node) => node.id === selectedId);
  const errors = workflowErrors(definition);
  const selectedTemplate =
    selected?.type === 'send_email' ? templates.find((template) => template.id === selected.config.templateId) : undefined;
  const summary = workflowSummary(definition, (id) => templates.find((template) => template.id === id)?.name ?? 'an email');
  const dirty = snapshot !== initialSnapshot;
  const emailReady = connection?.isEnabled && connection.lastTestSucceeded;

  const persist = async (publish: boolean) => {
    if (errors.length) throw new Error(errors[0]);
    const common = { tenantId: tenantId ?? undefined, name: name.trim(), definition };
    const saved = savedId ? await updateEmailAutomation(savedId, common) : await createEmailAutomation({ ...common, isEnabled: false });
    setSavedId(saved.id);
    const result = publish ? await publishEmailAutomation(saved.id, tenantId ?? undefined) : saved;
    setInitialSnapshot(snapshot);
    await queryClient.invalidateQueries({ queryKey: ['email-automations'] });
    onSaved?.(result);
    return result;
  };
  const save = useMutation({
    mutationFn: (publish: boolean) => persist(publish),
    onSuccess: (saved, published) => toast('success', published ? `“${saved.name}” is live.` : 'Workflow draft saved.'),
    onError: (error) => toast('error', error.message),
  });

  const updateNode = (node: EmailWorkflowNode) => setDefinition((current) => updateWorkflowNode(current, node));
  const addNode = (edgeId: string, type: 'send_email' | 'delay' | 'condition') => {
    const next = insertWorkflowNode(definition, edgeId, type, usableTemplates[0]?.id ?? '');
    const added = next.nodes.find((node) => !definition.nodes.some((current) => current.id === node.id) && node.type !== 'end');
    setDefinition(next);
    if (added) setSelectedId(added.id);
  };
  const removeNode = () => {
    if (!selected || selected.type === 'trigger' || selected.type === 'end') return;
    const next = removeWorkflowNode(definition, selected.id);
    setDefinition(next);
    setSelectedId(next.nodes.find((node) => node.type === 'trigger')?.id ?? next.nodes[0]?.id ?? '');
  };

  return (
    <EditorShell
      eyebrow="Email workflow"
      title={name || 'New workflow'}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      flush
      actions={
        <>
          <Button
            variant="outline"
            className="h-9 gap-2"
            onClick={() => (errors.length ? toast('error', errors[0]) : toast('success', 'Workflow is valid and ready to publish.'))}
          >
            <Play size={15} />
            <span className="hidden sm:inline">Check</span>
          </Button>
          <Button variant="outline" className="h-9" disabled={!name.trim() || save.isPending} onClick={() => save.mutate(false)}>
            Save draft
          </Button>
          <Button
            className="h-9 gap-2 px-5"
            disabled={!name.trim() || !!errors.length || save.isPending}
            onClick={() => save.mutate(true)}
          >
            {save.isPending && <Loader2 size={14} className="animate-spin" />}Publish
          </Button>
        </>
      }
    >
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(36rem,1fr)_22rem]">
        <main className="min-h-0 overflow-auto bg-band p-4 md:p-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-rule bg-card px-4 py-3 shadow-sm">
              <div>
                <p className="text-sm font-semibold">{summary}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Select a step to configure it. Use + on a connection to insert another step.
                </p>
              </div>
              <Badge variant={automation?.isEnabled ? 'success' : 'muted'}>
                {automation?.isEnabled ? `Live · v${automation.publishedVersion}` : savedId ? 'Draft' : 'New'}
              </Badge>
            </div>
            {!usableTemplates.length && !templatesLoading && (
              <div className="mb-4 flex items-center gap-3 rounded-sm border border-warning/40 bg-warning/6 p-4 text-sm text-warning">
                <TriangleAlert size={16} />
                Create a ready-to-use template before publishing.
                <Button variant="outline" size="sm" onClick={onOpenTemplates}>
                  Open templates
                </Button>
              </div>
            )}
            <div
              className="min-h-150 overflow-auto rounded-sm border border-rule bg-card p-5 shadow-sm"
              style={DOT_GRID_STYLE}
            >
              <WorkflowCanvas definition={definition} selectedId={selectedId} onSelect={setSelectedId} onAdd={addNode} />
            </div>
          </div>
        </main>

        <aside className="min-h-0 overflow-auto border-t border-rule bg-card p-5 lg:border-l lg:border-t-0">
          <Input
            label="Workflow name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            hint="Only your team sees this."
          />
          <div className="mt-5 border-t border-rule pt-5">
            {selected ? (
              <NodeSettings
                node={selected}
                templates={usableTemplates}
                locations={locations}
                onChange={updateNode}
                onPreview={() => setPreviewing(true)}
                onRemove={removeNode}
              />
            ) : (
              <p className="text-sm text-muted-foreground">Select a workflow step.</p>
            )}
          </div>
          {errors.length > 0 && (
            <div className="mt-5 rounded-sm border border-warning/40 bg-warning/6 p-3">
              <p className="text-xs font-bold text-warning">Before publishing</p>
              <ul className="mt-2 space-y-1 text-xs text-warning">
                {errors.map((error) => (
                  <li key={error}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
          {!emailReady && (
            <div className="mt-5 flex gap-2 rounded-sm border border-warning/40 bg-warning/6 p-3 text-xs text-warning">
              <TriangleAlert size={15} className="shrink-0" />
              <span>
                Email sending is not verified.{' '}
                {onOpenConnection && (
                  <button type="button" onClick={onOpenConnection} className="font-semibold underline">
                    Set it up
                  </button>
                )}
              </span>
            </div>
          )}
          {runs.length > 0 && (
            <div className="mt-6 border-t border-rule pt-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Recent runs</p>
              <div className="mt-3 space-y-2">
                {runs.slice(0, 8).map((run) => (
                  <button
                    type="button"
                    key={run.id}
                    onClick={() => setOpenedRunId(run.id)}
                    className="flex w-full items-center justify-between rounded-sm bg-muted px-3 py-2 text-left text-xs transition hover:bg-band"
                  >
                    <span className="flex items-center gap-2">
                      {run.status === 'completed' ? (
                        <CheckCircle2 size={13} className="text-success" />
                      ) : run.status === 'failed' ? (
                        <TriangleAlert size={13} className="text-destructive" />
                      ) : (
                        <Loader2 size={13} className="animate-spin text-primary" />
                      )}
                      {run.status}
                    </span>
                    <span className="text-muted-foreground">{run.stepCount} steps</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
      {previewing && selectedTemplate && (
        <EmailPreviewDrawer
          description="Workflow email"
          title={selectedTemplate.name}
          subject={selectedTemplate.subject}
          recipient={<span className="font-mono text-primary">{'{{customer.email}}'}</span>}
          htmlBody={selectedTemplate.htmlBody}
          textBody={selectedTemplate.textBody}
          onClose={() => setPreviewing(false)}
        />
      )}
      {openedRunId && <WorkflowRunDrawer runId={openedRunId} onClose={() => setOpenedRunId(null)} />}
    </EditorShell>
  );
}

function WorkflowCanvas({
  definition,
  selectedId,
  onSelect,
  onAdd,
}: {
  definition: EmailWorkflowDefinition;
  selectedId: string;
  onSelect: (id: string) => void;
  onAdd: (edgeId: string, type: 'send_email' | 'delay' | 'condition') => void;
}) {
  const trigger = definition.nodes.find((node) => node.type === 'trigger');
  if (!trigger) return <p className="text-sm text-destructive">Add a trigger to continue.</p>;
  const render = (node: EmailWorkflowNode, visited: Set<string>): React.ReactNode => {
    if (visited.has(node.id)) return null;
    const nextVisited = new Set(visited).add(node.id);
    const edges = definition.edges.filter((edge) => edge.source === node.id);
    return (
      <div className="flex min-w-60 flex-col items-center">
        <WorkflowNodeCard node={node} selected={node.id === selectedId} onClick={() => onSelect(node.id)} />
        {node.type === 'condition' ? (
          <>
            <BranchConnector />
            <div className={BRANCH_GRID}>
              {(['yes', 'no'] as const).map((branch) => {
                const edge = edges.find((candidate) => candidate.branch === branch);
                const target = edge && definition.nodes.find((candidate) => candidate.id === edge.target);
                return (
                  <div key={branch} className="flex flex-col items-center">
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-micro font-semibold uppercase',
                        branch === 'yes' ? 'bg-success/6 text-success' : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {branch}
                    </span>
                    {edge && <EdgeAdder onAdd={(type) => onAdd(edge.id, type)} />}
                    {target && render(target, nextVisited)}
                  </div>
                );
              })}
            </div>
          </>
        ) : edges[0] ? (
          <>
            <EdgeAdder onAdd={(type) => onAdd(edges[0].id, type)} />
            {(() => {
              const target = definition.nodes.find((candidate) => candidate.id === edges[0].target);
              return target ? render(target, nextVisited) : null;
            })()}
          </>
        ) : null}
      </div>
    );
  };
  return <div className="flex min-w-max justify-center">{render(trigger, new Set())}</div>;
}

/**
 * Joins a condition card to its yes/no columns: a stem down from the card, a rail
 * across to each branch, and a drop into it. Without this the branches read as
 * floating, unconnected to the step that produced them.
 *
 * The rail repeats BRANCH_GRID, so each half ends at its own column's centre and
 * each drop lands where that column centres its label. Equal columns sit
 * symmetrically either side of the middle whatever the gap is, and the middle is
 * where the stem lands — so the join is exact rather than eyeballed. Each half
 * also reaches `-4` (half of the grid's `gap-8`) past its cell, or the gap would
 * leave the rail split in two right under the stem.
 */
function BranchConnector() {
  return (
    <div className="flex w-full flex-col items-center" aria-hidden="true">
      <span className="h-4 w-px bg-border" />
      <div className={BRANCH_GRID}>
        {(['left', 'right'] as const).map((side) => (
          <div key={side} className="relative h-4">
            <span className={cn('absolute top-0 h-px bg-border', side === 'left' ? 'left-1/2 -right-4' : '-left-4 right-1/2')} />
            <span className="absolute left-1/2 top-0 h-full w-px bg-border" />
          </div>
        ))}
      </div>
    </div>
  );
}

function WorkflowNodeCard({ node, selected, onClick }: { node: EmailWorkflowNode; selected: boolean; onClick: () => void }) {
  // Icon and colour come from the shared step language, so a step looks the same
  // here as it does on its automation card in the list.
  const { icon: Icon, chip } = NODE_META[node.type];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-64 items-center gap-3 rounded-sm border bg-card p-3 text-left shadow-sm transition',
        selected ? 'border-primary ring-2 ring-primary/15' : 'border-rule hover:border-primary/40',
      )}
    >
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-sm', chip)}>
        <Icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{node.name}</span>
        <span className="block truncate text-label capitalize text-muted-foreground">{nodeDetail(node)}</span>
      </span>
    </button>
  );
}

function EdgeAdder({ onAdd }: { onAdd: (type: 'send_email' | 'delay' | 'condition') => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative flex h-15 flex-col items-center">
      <span className="h-5 w-px bg-border" />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex size-6 items-center justify-center rounded-full border border-rule bg-card text-primary shadow-sm hover:border-primary"
        aria-label="Insert workflow step"
      >
        <Plus size={13} />
      </button>
      <span className="h-4 w-px bg-border" />
      {open && (
        <div className="absolute left-8 top-3 z-20 flex w-40 flex-col rounded-sm border border-rule bg-card p-1 shadow-lg">
          {(
            [
              ['send_email', 'Send email'],
              ['delay', 'Wait'],
              ['condition', 'Condition'],
            ] as const
          ).map(([type, label]) => (
            <button
              key={type}
              type="button"
              onClick={() => {
                onAdd(type);
                setOpen(false);
              }}
              className="rounded-sm px-3 py-2 text-left text-xs font-semibold hover:bg-muted"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NodeSettings({
  node,
  templates,
  locations,
  onChange,
  onPreview,
  onRemove,
}: {
  node: EmailWorkflowNode;
  templates: Array<{ id: string; name: string; subject: string }>;
  locations: Array<{ id: string; name: string }>;
  onChange: (node: EmailWorkflowNode) => void;
  onPreview: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-primary">Step settings</p>
        <Input label="Step name" value={node.name} onChange={(event) => onChange({ ...node, name: event.target.value })} />
      </div>
      {node.type === 'trigger' && (
        <>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Event</label>
            <Select
              value={node.config.event}
              onValueChange={(value) =>
                onChange({
                  ...node,
                  config: {
                    ...node.config,
                    event: value as typeof node.config.event,
                    offsetDays: value === 'customer_inactive' ? 30 : 0,
                    locationId: value.startsWith('order_') ? node.config.locationId : null,
                  },
                })
              }
              options={TRIGGER_OPTIONS}
              ariaLabel="Workflow trigger"
              className="mt-1.5 w-full"
            />
            <p className="mt-1 text-xs text-muted-foreground">{TRIGGER_HELP[node.config.event]}</p>
          </div>
          {node.config.event.startsWith('order_') && (
            <div>
              <label className="text-xs font-bold text-muted-foreground">Location</label>
              <Select
                value={node.config.locationId ?? ''}
                onValueChange={(value) => onChange({ ...node, config: { ...node.config, locationId: value || null } })}
                options={[
                  { value: '', label: 'All locations' },
                  ...locations.map((location) => ({ value: location.id, label: location.name })),
                ]}
                ariaLabel="Workflow location"
                className="mt-1.5 w-full"
              />
            </div>
          )}
          {(node.config.event === 'customer_birthday' || node.config.event === 'customer_inactive') && (
            <>
              <Input
                label={node.config.event === 'customer_birthday' ? 'Days before birthday' : 'Days without a visit'}
                type="number"
                min={0}
                value={Math.abs(node.config.offsetDays ?? 0)}
                onChange={(event) =>
                  onChange({
                    ...node,
                    config: {
                      ...node.config,
                      offsetDays:
                        node.config.event === 'customer_birthday'
                          ? -Math.abs(Number(event.target.value))
                          : Math.max(1, Number(event.target.value)),
                    },
                  })
                }
              />
              <div>
                <label className="text-xs font-bold text-muted-foreground">Timezone</label>
                <TimezoneSelect
                  value={node.config.timezone ?? 'Europe/London'}
                  onChange={(timezone) => onChange({ ...node, config: { ...node.config, timezone } })}
                />
              </div>
            </>
          )}
        </>
      )}
      {node.type === 'send_email' && (
        <>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Template</label>
            <Select
              value={node.config.templateId}
              onValueChange={(templateId) => onChange({ ...node, config: { templateId } })}
              options={templates.map((template) => ({ value: template.id, label: template.name }))}
              ariaLabel="Email template"
              className="mt-1.5 w-full"
            />
          </div>
          <Button variant="outline" className="w-full gap-2" onClick={onPreview} disabled={!node.config.templateId}>
            <Eye />
            Preview email
          </Button>
        </>
      )}
      {node.type === 'delay' && (
        <div className="grid grid-cols-2 gap-2">
          <Input
            label="Amount"
            type="number"
            min={1}
            value={node.config.amount}
            onChange={(event) => onChange({ ...node, config: { ...node.config, amount: Math.max(1, Number(event.target.value)) } })}
          />
          <div>
            <label className="text-xs font-bold text-muted-foreground">Unit</label>
            <Select
              value={node.config.unit}
              onValueChange={(unit) => onChange({ ...node, config: { ...node.config, unit: unit as typeof node.config.unit } })}
              options={[
                { value: 'minutes', label: 'Minutes' },
                { value: 'hours', label: 'Hours' },
                { value: 'days', label: 'Days' },
              ]}
              ariaLabel="Delay unit"
              className="mt-1.5 w-full"
            />
          </div>
        </div>
      )}
      {node.type === 'condition' && (
        <>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Field</label>
            <Select
              value={node.config.field}
              onValueChange={(field) => onChange({ ...node, config: { ...node.config, field: field as typeof node.config.field } })}
              options={CONDITION_FIELDS}
              ariaLabel="Condition field"
              className="mt-1.5 w-full"
            />
          </div>
          <div>
            <label className="text-xs font-bold text-muted-foreground">Operator</label>
            <Select
              value={node.config.operator}
              onValueChange={(operator) =>
                onChange({ ...node, config: { ...node.config, operator: operator as typeof node.config.operator } })
              }
              options={CONDITION_OPERATORS}
              ariaLabel="Condition operator"
              className="mt-1.5 w-full"
            />
          </div>
          <Input
            label="Value"
            value={String(node.config.value)}
            onChange={(event) => onChange({ ...node, config: { ...node.config, value: event.target.value } })}
          />
        </>
      )}
      {node.type === 'end' && (
        <p className="rounded-sm bg-muted p-3 text-xs text-muted-foreground">
          This branch finishes here. Insert new steps on the connection above it.
        </p>
      )}
      {node.type !== 'trigger' && node.type !== 'end' && (
        <Button variant="destructive" className="w-full gap-2" onClick={onRemove}>
          <Trash2 />
          Remove step
        </Button>
      )}
    </div>
  );
}
