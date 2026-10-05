'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { FileText, Loader2, Play, PlugZap, TriangleAlert } from '@/components/icons';
import { EditorShell } from '@/components/shared/EditorShell';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Button } from '@/components/ui/button';

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
import { cn } from '@/lib/utils/cn';
import { connectionState, hasUnpublishedChanges } from '@/lib/utils/communications';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { AutomationSidebar, type SidebarTab } from './AutomationSidebar';
import { EmailPreviewDrawer } from './EmailPreviewDrawer';
import { PublishDialog } from './PublishDialog';
import { WorkflowRunDrawer } from './WorkflowRunDrawer';
import { type InsertType, WorkflowTree } from './WorkflowTree';
import { useEmailAccess } from './useEmailAccess';
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
  const access = useEmailAccess();
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
  const [panel, setPanel] = useState<SidebarTab>('step');
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
  // Gated like the page masthead: without email.connections:read the state is unknown, not "not set up".
  const { data: connection } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId && access.canReadConnection,
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
  const connectionStatus = connectionState(connection, access.canReadConnection);
  // Only warn about what we know is wrong.
  const emailReady = connectionStatus !== 'missing' && connectionStatus !== 'unverified';
  const readOnly = !access.canWrite;
  const [now] = useState(() => Date.now());
  const triggerNode = definition.nodes.find((node) => node.type === 'trigger');
  const staffAudience = triggerNode?.type === 'trigger' && triggerNode.config.event.startsWith('staff_');

  const persist = async (publish: boolean) => {
    if (errors.length) throw new Error(errors[0]);
    const common = {
      tenantId: tenantId ?? undefined,
      name: name.trim(),
      definition,
      audience: staffAudience ? ('staff' as const) : ('customer' as const),
    };
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

  const updateNode = (node: EmailWorkflowNode) =>
    setDefinition((current) => {
      const updated = updateWorkflowNode(current, node);
      if (node.type !== 'trigger') return updated;
      const staff = node.config.event.startsWith('staff_');
      return {
        ...updated,
        nodes: updated.nodes.map((candidate) =>
          candidate.type === 'condition' && candidate.config.field.startsWith(staff ? 'customer.' : 'staff.')
            ? {
                ...candidate,
                config: { ...candidate.config, field: staff ? 'staff.employmentType' : 'customer.marketingOptIn' },
              }
            : candidate,
        ),
      };
    });

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
  const unpublished = automation ? hasUnpublishedChanges({ ...automation, definition }) : false;

  // What stands between this workflow and publishing, in the shared card.
  const attention: NeedsAttentionItem[] = [
    ...(!usableTemplates.length && !templatesLoading
      ? [
          {
            key: 'no-template',
            tone: 'measured' as const,
            icon: FileText,
            title: 'There’s no template to send',
            detail: 'Create a ready-to-use template first.',
            fix: onOpenTemplates ? { label: 'Open templates', run: onOpenTemplates } : undefined,
          },
        ]
      : []),
    ...(connectionStatus === 'missing' || connectionStatus === 'unverified'
      ? [
          {
            key: 'connection',
            tone: 'exception' as const,
            icon: PlugZap,
            title: connectionStatus === 'missing' ? 'Email isn’t set up — nothing will send' : 'The email connection hasn’t passed a test',
            detail: onOpenConnection ? undefined : 'Ask an owner to check the email connector in Settings.',
            fix: onOpenConnection ? { label: 'Open connector', run: onOpenConnection } : undefined,
          },
        ]
      : []),
    ...errors.map((error) => ({ key: `error-${error}`, tone: 'measured' as const, icon: TriangleAlert, title: error })),
  ];

  return (
    <EditorShell
      eyebrow="Email workflow"
      title={name || 'New workflow'}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      flush
      actions={
        <>
          {!readOnly && (
            <Button
              variant="outline"
              className="h-9 gap-2"
              onClick={() => (errors.length ? toast('error', errors[0]) : toast('success', 'Workflow is valid and ready to publish.'))}
            >
              <Play size={15} />
              <span className="hidden sm:inline">Check</span>
            </Button>
          )}
          {access.canWrite && (
            <Button variant="outline" className="h-9" disabled={!name.trim() || save.isPending} onClick={() => save.mutate(false)}>
              Save draft
            </Button>
          )}
          {/* Publishing goes through the blast-radius dialog rather than firing
              straight from the button — see PublishDialog. */}
          {/* Publishing saves first, so it needs both. */}
          {access.canWrite && access.canPublish && (
            <Button
              className="h-9 gap-2 px-5"
              disabled={!name.trim() || !!errors.length || save.isPending}
              onClick={() => setConfirmingPublish(true)}
            >
              {save.isPending && <Loader2 size={14} className="animate-spin" />}Publish
            </Button>
          )}
        </>
      }
    >
      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(36rem,1fr)_22rem]">
        <main className="min-h-0 overflow-auto bg-band p-4 md:p-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rule/60 bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{summary}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {readOnly
                    ? 'You can read this workflow but not change it. Select a step to see its settings.'
                    : 'Select a step to change it. Drag a step by its handle to reorder, or use + on a line to insert one.'}
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1.5">
                {unpublished && (
                  <span className="rounded-sm bg-measured/10 px-1.5 py-0.5 text-micro font-semibold text-measured">
                    Unpublished changes
                  </span>
                )}
                <span
                  className={cn(
                    'rounded-sm px-1.5 py-0.5 text-micro font-semibold',
                    automation?.isEnabled ? 'bg-momentum/10 text-momentum' : 'bg-band text-muted-foreground',
                  )}
                >
                  {automation?.isEnabled
                    ? `Live · v${automation.publishedVersion}`
                    : automation?.publishedVersion
                      ? `Off · v${automation.publishedVersion}`
                      : savedId
                        ? 'Draft'
                        : 'New'}
                </span>
              </span>
            </div>
            {!readOnly && (
              <NeedsAttention
                items={attention}
                summary={`${attention.length} ${attention.length === 1 ? 'thing' : 'things'} to fix before publishing`}
                className="mb-4"
              />
            )}
            <div className="min-h-150 overflow-auto rounded-lg border border-rule/60 bg-card p-5" style={DOT_GRID_STYLE}>
              <WorkflowTree
                definition={definition}
                selectedId={selectedId}
                onSelect={(id) => {
                  setSelectedId(id);
                  setPanel('step');
                }}
                onInsert={addNode}
                onMove={moveNode}
                onDuplicate={duplicateNode}
                onRemove={removeNode}
                templateName={templateNameFor}
                readOnly={readOnly}
              />
            </div>
          </div>
        </main>

        <AutomationSidebar
          tab={panel}
          onTab={setPanel}
          node={selected}
          automation={automation}
          name={name}
          onName={setName}
          templates={usableTemplates}
          locations={locations}
          segments={segments}
          staffAudience={staffAudience}
          runs={runs.slice(0, 20)}
          now={now}
          readOnly={readOnly}
          templateName={templateNameFor}
          onChange={updateNode}
          onDuplicate={duplicateNode}
          onRemove={removeNode}
          onPreview={() => setPreviewing(true)}
          onOpenRun={setOpenedRunId}
        />
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
