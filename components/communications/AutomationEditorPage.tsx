'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { CheckCircle2, Eye, Loader2, Play, Trash2, TriangleAlert } from '@/components/icons';
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
} from '@/lib/modules/communications/client';
import { getSegments } from '@/lib/modules/customers/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { EmailPreviewDrawer } from './EmailPreviewDrawer';
import { PublishDialog } from './PublishDialog';
import { WorkflowRunDrawer } from './WorkflowRunDrawer';
import { type InsertType, WorkflowTree } from './WorkflowTree';
import { TRIGGER_HELP, TRIGGER_OPTIONS } from './shared';
import {
  defaultWorkflow,
  duplicateWorkflowNode,
  insertWorkflowNode,
  moveWorkflowNode,
  removeWorkflowNode,
  updateWorkflowNode,
  workflowErrors,
  workflowForAutomation,
  workflowSummary,
} from './workflowModel';
import { DOT_GRID_STYLE } from './workflowNodes';

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
  const [confirmingPublish, setConfirmingPublish] = useState(false);
  const [openedRunId, setOpenedRunId] = useState<string | null>(null);
  const snapshot = JSON.stringify({ name, definition });
  const [initialSnapshot, setInitialSnapshot] = useState(snapshot);

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-templates', tenantId),
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId ?? ''),
    enabled: !!tenantId,
  });
  const { data: segmentsData } = useQuery({
    queryKey: moduleQueryKeys.customers.key('customer-segments'),
    queryFn: getSegments,
    enabled: !!tenantId,
  });
  const segments = segmentsData?.data ?? [];
  const { data: connection } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });
  const { data: runs = [] } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-automation-runs', savedId, tenantId),
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
    await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-automations') });
    onSaved?.(result);
    return result;
  };
  const save = useMutation({
    mutationFn: (publish: boolean) => persist(publish),
    onSuccess: (saved, published) => toast('success', published ? `“${saved.name}” is live.` : 'Workflow draft saved.'),
    onError: (error) => toast('error', error.message),
  });

  const updateNode = (node: EmailWorkflowNode) => setDefinition((current) => updateWorkflowNode(current, node));

  /** Insert on the connection leaving `afterNodeId` down `branch`. */
  const addNode = (afterNodeId: string, branch: string, type: InsertType) => {
    const edge = definition.edges.find((candidate) => candidate.source === afterNodeId && (candidate.branch ?? 'next') === branch);
    if (!edge) return;
    const next = insertWorkflowNode(definition, edge.id, type, usableTemplates[0]?.id ?? '');
    const added = next.nodes.find((node) => !definition.nodes.some((current) => current.id === node.id) && node.type !== 'end');
    setDefinition(next);
    if (added) setSelectedId(added.id);
  };

  const removeNode = (nodeId: string) => {
    const node = definition.nodes.find((candidate) => candidate.id === nodeId);
    if (!node || node.type === 'trigger' || node.type === 'end') return;
    const next = removeWorkflowNode(definition, nodeId);
    setDefinition(next);
    // Selection has to land somewhere real — the removed step's id is gone.
    if (!next.nodes.some((candidate) => candidate.id === selectedId)) {
      setSelectedId(next.nodes.find((candidate) => candidate.type === 'trigger')?.id ?? next.nodes[0]?.id ?? '');
    }
  };

  const moveNode = (nodeId: string, afterNodeId: string, branch: string) =>
    setDefinition((current) => moveWorkflowNode(current, nodeId, afterNodeId, branch));

  const duplicateNode = (nodeId: string) => {
    const next = duplicateWorkflowNode(definition, nodeId);
    const added = next.nodes.find((node) => !definition.nodes.some((current) => current.id === node.id));
    setDefinition(next);
    if (added) setSelectedId(added.id);
  };

  const templateNameFor = (id: string) => templates.find((template) => template.id === id)?.name ?? 'an email';

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
          {/* Publishing goes through the blast-radius dialog rather than firing
              straight from the button — see PublishDialog. */}
          <Button
            className="h-9 gap-2 px-5"
            disabled={!name.trim() || !!errors.length || save.isPending}
            onClick={() => setConfirmingPublish(true)}
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
                  Select a step to configure it. Drag a step by its handle to reorder, or use + on a connection to insert one.
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
            <div className="min-h-150 overflow-auto rounded-sm border border-rule bg-card p-5 shadow-sm" style={DOT_GRID_STYLE}>
              <WorkflowTree
                definition={definition}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onInsert={addNode}
                onMove={moveNode}
                onDuplicate={duplicateNode}
                onRemove={removeNode}
                templateName={templateNameFor}
              />
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
                segments={segments}
                onChange={updateNode}
                onPreview={() => setPreviewing(true)}
                onRemove={() => removeNode(selected.id)}
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
      {confirmingPublish && (
        <PublishDialog
          name={name.trim() || 'Untitled workflow'}
          definition={definition}
          isRepublish={Boolean(automation?.isEnabled)}
          publishedVersion={automation?.publishedVersion}
          emailReady={Boolean(emailReady)}
          isPending={save.isPending}
          templateName={templateNameFor}
          onConfirm={() =>
            save.mutate(true, {
              onSuccess: () => setConfirmingPublish(false),
            })
          }
          onClose={() => setConfirmingPublish(false)}
        />
      )}
      {openedRunId && <WorkflowRunDrawer runId={openedRunId} onClose={() => setOpenedRunId(null)} />}
    </EditorShell>
  );
}

function NodeSettings({
  node,
  templates,
  locations,
  segments,
  onChange,
  onPreview,
  onRemove,
}: {
  node: EmailWorkflowNode;
  templates: Array<{ id: string; name: string; subject: string }>;
  locations: Array<{ id: string; name: string }>;
  segments: Array<{ id: string; name: string }>;
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
                    // Dropped when the trigger stops being segment-driven, so a
                    // leftover id cannot silently scope a different trigger.
                    segmentId: value === 'segment_entered' ? node.config.segmentId : null,
                  },
                })
              }
              options={TRIGGER_OPTIONS}
              ariaLabel="Workflow trigger"
              className="mt-1.5 w-full"
            />
            <p className="mt-1 text-xs text-muted-foreground">{TRIGGER_HELP[node.config.event]}</p>
          </div>
          {node.config.event === 'segment_entered' && (
            <div>
              <label className="text-xs font-bold text-muted-foreground">Segment</label>
              <Select
                value={node.config.segmentId ?? ''}
                onValueChange={(value) => onChange({ ...node, config: { ...node.config, segmentId: value || null } })}
                options={[
                  { value: '', label: segments.length ? 'Choose a segment…' : 'No saved segments' },
                  ...segments.map((segment) => ({ value: segment.id, label: segment.name })),
                ]}
                ariaLabel="Segment to watch"
                className="mt-1.5 w-full"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {segments.length
                  ? 'Save a filtered customer list as a segment to use it here.'
                  : 'Filter the customer list, then save it as a segment — it will appear here.'}
              </p>
            </div>
          )}
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
