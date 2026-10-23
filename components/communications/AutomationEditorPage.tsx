'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { FileText, Loader2, PlugZap, TriangleAlert } from '@/components/icons';
import { SaveBar } from '@/components/settings/controls';
import { EditorShell } from '@/components/shared/EditorShell';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { Button } from '@/components/ui/button';

import {
  type EmailAutomation,
  type EmailWorkflowDefinition,
  type EmailWorkflowNode,
  createEmailAutomation,
  getEmailConnection,
  getEmailTemplates,
  publishEmailAutomation,
  updateEmailAutomation,
} from '@/lib/modules/communications/client';
import { getSegments } from '@/lib/modules/customers/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { connectionState, hasUnpublishedChanges } from '@/lib/utils/communications';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { AutomationSidebar } from './AutomationSidebar';
import { EmailPreviewDrawer } from './EmailPreviewDrawer';
import { PanCanvas } from './PanCanvas';
import { PublishDialog } from './PublishDialog';
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
  workflowIssues,
} from './workflowModel';

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
  // A new workflow opens on its trigger step, the event list open in the rail — one page, no pre-screens.
  const [hasChosenTrigger, setHasChosenTrigger] = useState(!!automation);
  const [previewing, setPreviewing] = useState(false);
  const [confirmingPublish, setConfirmingPublish] = useState(false);
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
    queryKey: moduleQueryKeys.customers.key('customer-segments', tenantId),
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
  const hasEmail = definition.nodes.some((node) => node.type === 'send_email');
  const usableTemplates = templates.filter((template) => template.isActive);

  const selected = definition.nodes.find((node) => node.id === selectedId);
  // Checked on every change — no Check button: problems show in the "needs you" card and on their steps.
  const issues = workflowIssues(definition);
  const errors = workflowErrors(definition);
  const stepIssues = new Map<string, string[]>();
  for (const issue of issues) if (issue.nodeId) stepIssues.set(issue.nodeId, [...(stepIssues.get(issue.nodeId) ?? []), issue.message]);
  if (definition.nodes.some((node) => node.type === 'create_task') && !access.canManageTasks)
    errors.push('Creating task workflows requires helpdesk management permission.');
  const selectedTemplate =
    selected?.type === 'send_email' ? templates.find((template) => template.id === selected.config.templateId) : undefined;
  const dirty = snapshot !== initialSnapshot;
  const connectionStatus = connectionState(connection, access.canReadConnection);
  // Only warn about what we know is wrong.
  const emailReady = connectionStatus !== 'missing' && connectionStatus !== 'unverified';
  const readOnly = !access.canWrite;
  const [now] = useState(() => Date.now());
  const triggerNode = definition.nodes.find((node) => node.type === 'trigger');
  const staffAudience = triggerNode?.type === 'trigger' && triggerNode.config.event.startsWith('staff_');
  const bookingAudience = triggerNode?.type === 'trigger' && triggerNode.config.event.startsWith('reservation_');

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
    await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.automation.key('email-automations') });
    onSaved?.(result);
    return result;
  };
  const save = useMutation({
    mutationFn: (publish: boolean) => persist(publish),
    onSuccess: (saved, published) =>
      toast('success', published ? `“${saved.name}” is live.` : 'Workflow draft saved.', { critical: published }),
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
  const unpublished = automation ? hasUnpublishedChanges({ ...automation, definition }) : false;

  // What stands between this workflow and publishing, in the shared card.
  const attention: NeedsAttentionItem[] = [
    ...(!hasChosenTrigger && triggerNode
      ? [
          {
            key: 'trigger',
            tone: 'measured' as const,
            icon: TriangleAlert,
            title: 'Choose what starts this workflow',
            detail: 'Pick an event in the panel on the right.',
            fix: { label: 'Choose', run: () => setSelectedId(triggerNode.id) },
          },
        ]
      : []),
    ...(hasEmail && !usableTemplates.length && !templatesLoading
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
    ...(hasEmail && (connectionStatus === 'missing' || connectionStatus === 'unverified')
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
    // Each problem, with a Show that selects the step it's about.
    ...issues.map((issue) => ({
      key: `error-${issue.nodeId ?? ''}-${issue.message}`,
      tone: 'measured' as const,
      icon: TriangleAlert,
      title: issue.message,
      fix: issue.nodeId ? { label: 'Show', run: () => setSelectedId(issue.nodeId!) } : undefined,
    })),
    ...(definition.nodes.some((node) => node.type === 'create_task') && !access.canManageTasks
      ? [
          {
            key: 'task-permission',
            tone: 'measured' as const,
            icon: TriangleAlert,
            title: 'Creating task workflows requires helpdesk management permission.',
          },
        ]
      : []),
  ];

  const discard = () => {
    if (!automation) return onClose();
    setName(automation.name);
    setDefinition(workflowForAutomation(automation));
  };

  return (
    <EditorShell
      title={name || 'New workflow'}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      flush
      actions={
        <>
          {/* Publishing goes through the blast-radius dialog rather than firing
              straight from the button — see PublishDialog. */}
          {/* Publishing saves first, so it needs both. */}
          {access.canWrite && access.canPublish && (
            <Button
              className="h-9 gap-2 px-3 sm:px-5"
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
        {/* The canvas takes the whole main area; the "needs you" card above it, the SaveBar below. */}
        <main className="relative flex min-h-0 flex-col bg-band p-4 md:p-6">
          <div className="flex min-h-0 flex-1 flex-col">
            {/* What stands between this workflow and publishing — the shared "needs you" card, each item with its fix. */}
            {!readOnly && (
              <NeedsAttention
                items={attention}
                summary={`${attention.length} ${attention.length === 1 ? 'thing' : 'things'} to fix before publishing`}
                className="mb-4"
              />
            )}
            <PanCanvas>
              <div className="p-5">
                <WorkflowTree
                  definition={definition}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                  onInsert={addNode}
                  onMove={moveNode}
                  onDuplicate={duplicateNode}
                  onRemove={removeNode}
                  templateName={templateNameFor}
                  triggerNames={{
                    location: (id) => locations.find((location) => location.id === id)?.name,
                    segment: (id) => segments.find((segment) => segment.id === id)?.name,
                  }}
                  triggerPending={!hasChosenTrigger}
                  issues={readOnly ? undefined : stepIssues}
                  readOnly={readOnly}
                />
              </div>
            </PanCanvas>
            {/* Floats over the foot of the canvas, clear of the zoom controls — the canvas keeps its full height. */}
            {access.canWrite && (
              <div className="pointer-events-none absolute inset-x-4 bottom-4 flex justify-center md:inset-x-6 md:bottom-6">
                <div className="pointer-events-auto w-full max-w-xl sm:mr-40">
                  <SaveBar
                    dirty={dirty || !savedId}
                    saving={save.isPending}
                    saveLabel="Save draft"
                    disabled={!name.trim()}
                    message={
                      !name.trim() ? 'Give the workflow a name' : savedId ? 'Unsaved changes — not live until you publish' : 'Not saved yet'
                    }
                    onSave={() => save.mutate(false)}
                    onDiscard={discard}
                  />
                </div>
              </div>
            )}
          </div>
        </main>

        <AutomationSidebar
          node={selected}
          automation={automation}
          name={name}
          onName={setName}
          templates={usableTemplates}
          locations={locations}
          segments={segments}
          staffAudience={staffAudience}
          bookingAudience={bookingAudience}
          triggerEvent={triggerNode?.type === 'trigger' ? triggerNode.config.event : ''}
          now={now}
          readOnly={readOnly}
          templateName={templateNameFor}
          onChange={updateNode}
          onDuplicate={duplicateNode}
          onRemove={removeNode}
          onPreview={() => setPreviewing(true)}
          unpublished={unpublished}
          stepIssues={selected && !readOnly ? stepIssues.get(selected.id) : undefined}
          chooseTrigger={!hasChosenTrigger}
          onTriggerChosen={() => {
            if (hasChosenTrigger) return;
            setHasChosenTrigger(true);
            // As the old flow did, go on to the first action: what should happen.
            const firstAction = definition.nodes.find((node) => node.type === 'send_email' || node.type === 'create_task');
            if (firstAction) setSelectedId(firstAction.id);
          }}
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
    </EditorShell>
  );
}
