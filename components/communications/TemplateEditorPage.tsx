'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import {
  ArrowDown,
  Code,
  Eye,
  FileText,
  Globe,
  ImagePlus,
  Link2,
  ListView,
  Minus,
  Monitor,
  PlugZap,
  Send,
  Smartphone,
  TriangleAlert,
} from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { Modal } from '@/components/shared/Modal';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { ActionButton, useDoneBeat } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type EmailTemplate,
  type EmailTemplatePayload,
  archiveEmailTemplate,
  createEmailTemplate,
  getEmailAutomations,
  getEmailConnection,
  getEmailVariables,
  sendEmail,
  updateEmailTemplate,
} from '@/lib/modules/communications/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { connectionState } from '@/lib/utils/communications';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { EmailPreviewDrawer } from './EmailPreviewDrawer';
import { type CanvasDnd, type DragPayload, TemplateCanvas, blockFromPayload } from './TemplateCanvas';
import { TemplateSettingsPanel } from './TemplateSettingsPanel';
import { DEFAULT_TEMPLATE_CATEGORY, TEMPLATE_CATEGORIES } from './shared';
import {
  COLUMN_LAYOUTS,
  type TemplateBlock,
  type TemplateDesign,
  type TemplateLeafBlock,
  defaultTemplateDesign,
  findTemplateBlock,
  insertTemplateBlock,
  isTemplateDesign,
  htmlToDesign,
  normalizeTemplateDesign,
  renderTemplateDesign,
  templateChecks,
  templateDesignToPlainText,
  updateTemplateBlock,
} from './templateDesign';
import { useEmailAccess } from './useEmailAccess';
import { workflowForAutomation } from './workflowModel';

const FORM_ID = 'email-template-form';
const MODES = [
  { value: 'visual' as const, label: 'Design' },
  { value: 'html' as const, label: 'HTML' },
];
const DEVICES = [
  { value: 'desktop' as const, label: 'Desktop', icon: Monitor },
  { value: 'mobile' as const, label: 'Mobile', icon: Smartphone },
];

const BLOCKS: Array<{ type: TemplateLeafBlock['type']; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { type: 'heading', label: 'Heading', icon: FileText },
  { type: 'text', label: 'Text', icon: ListView },
  { type: 'button', label: 'Button', icon: Link2 },
  { type: 'image', label: 'Image', icon: ImagePlus },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'spacer', label: 'Spacer', icon: ArrowDown },
  { type: 'social', label: 'Social', icon: Globe },
  { type: 'html', label: 'HTML', icon: Code },
];

export function TemplateEditorPage({
  template,
  onClose,
  onSaved,
  onOpenConnection,
}: {
  template?: EmailTemplate;
  onClose: () => void;
  onSaved?: (saved: EmailTemplate) => void;
  onOpenConnection?: () => void;
}) {
  const access = useEmailAccess();
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const source = template;
  // Stored designs may predate column rows, so everything is read through the
  // normaliser before it reaches the canvas.
  const initialDesign = isTemplateDesign(source?.design)
    ? normalizeTemplateDesign(source.design)
    : source?.htmlBody
      ? htmlToDesign(source.htmlBody)
      : defaultTemplateDesign();
  const [name, setName] = useState(source?.name ?? '');
  const [category, setCategory] = useState(source?.category ?? DEFAULT_TEMPLATE_CATEGORY);
  const [subject, setSubject] = useState(source?.subject ?? '');
  const [design, setDesign] = useState<TemplateDesign>(initialDesign);
  const [htmlBody, setHtmlBody] = useState(source?.htmlBody ?? renderTemplateDesign(initialDesign));
  const [textBody, setTextBody] = useState(source?.textBody ?? templateDesignToPlainText(initialDesign));
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  // Nothing selected on open: the panel starts on the email's own settings.
  const [selectedId, setSelectedId] = useState('');
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [lastField, setLastField] = useState<'subject' | 'preheader'>('subject');
  const [previewing, setPreviewing] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email ?? '');
  const [deleting, setDeleting] = useState(false);
  const [savedId, setSavedId] = useState(template?.id ?? null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Which image block the file picker is filling — the picker outlives selection.
  const imageTargetRef = useRef<string | null>(null);

  // Drag state lives here because a drag starts in the palette and ends on the canvas.
  const dragPayload = useRef<DragPayload | null>(null);
  const [dragging, setDragging] = useState(false);
  const dnd: CanvasDnd = {
    payload: dragPayload,
    dragging,
    start: (payload) => {
      dragPayload.current = payload;
      setDragging(true);
    },
    end: () => {
      dragPayload.current = null;
      setDragging(false);
    },
  };

  const snapshot = JSON.stringify({ name, category, subject, design, htmlBody, textBody, mode });
  const [initialSnapshot, setInitialSnapshot] = useState(snapshot);
  const dirty = snapshot !== initialSnapshot;

  const { data: variables = [] } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-variables'),
    queryFn: getEmailVariables,
  });
  const { data: automations = [] } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-automations', tenantId),
    queryFn: () => getEmailAutomations(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: connection } = useQuery({
    queryKey: moduleQueryKeys.communications.key('email-connection', tenantId),
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    // Without email.connections:read the state is unknown — never reported as "not set up".
    enabled: !!tenantId && access.canReadConnection,
    retry: false,
  });
  // A template saved under an older free-text category keeps its own entry, so
  // it stays selectable instead of silently jumping to another bucket on save.
  const categoryOptions = useMemo(() => {
    const known = TEMPLATE_CATEGORIES.map(({ value, label }) => ({ value, label }));
    return known.some((option) => option.value === category) ? known : [...known, { value: category, label: `${category} (old category)` }];
  }, [category]);
  const categoryHint = TEMPLATE_CATEGORIES.find((option) => option.value === category)?.hint ?? 'Kept from an earlier category.';

  const usedBy = automations.filter((automation) =>
    workflowForAutomation(automation).nodes.some((node) => node.type === 'send_email' && node.config.templateId === savedId),
  );
  const selected = findTemplateBlock(design, selectedId);
  const compiledHtml = mode === 'visual' ? renderTemplateDesign(design) : htmlBody;
  const compiledText = mode === 'visual' ? templateDesignToPlainText(design) : textBody;
  const canSave = Boolean(name.trim() && subject.trim() && compiledHtml.trim());
  const connectionStatus = connectionState(connection, access.canReadConnection);
  const readOnly = !access.canWrite;
  const checks =
    mode === 'visual'
      ? templateChecks(design, subject, variables)
      : templateChecks({ ...design, blocks: [], preheader: 'x' }, subject, variables);

  const persist = async () => {
    const payload: EmailTemplatePayload = {
      tenantId: tenantId ?? undefined,
      name: name.trim(),
      category: category.trim() || DEFAULT_TEMPLATE_CATEGORY,
      subject,
      htmlBody: compiledHtml,
      textBody: compiledText,
      design: mode === 'visual' ? (design as unknown as Record<string, unknown>) : null,
      // Saving always keeps the template live; "Delete" is what takes it away.
      isActive: true,
    };
    const saved = savedId ? await updateEmailTemplate(savedId, payload) : await createEmailTemplate(payload);
    setSavedId(saved.id);
    setInitialSnapshot(snapshot);
    await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-templates') });
    onSaved?.(saved);
    return saved;
  };

  const [justSaved, flashSaved] = useDoneBeat();
  const save = useMutation({
    mutationFn: persist,
    // Stays in the editor, as every builder does — Close is one click away.
    onSuccess: () => toast('success', savedId ? 'Template saved.' : 'Template created.'),
    onError: (error) => toast('error', error.message),
  });
  const sendTest = useMutation({
    mutationFn: async () => {
      const saved = await persist();
      return sendEmail({ tenantId: tenantId ?? undefined, templateId: saved.id, toEmail: testEmail, toName: user?.name ?? undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-deliveries') });
      setTestOpen(false);
      toast('success', `Test email queued to ${testEmail}.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const destroy = useMutation({
    mutationFn: () => archiveEmailTemplate(savedId ?? '', tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: moduleQueryKeys.communications.key('email-templates') });
      onClose();
      toast('success', 'Template deleted.');
    },
    onError: (error) => toast('error', error.message),
  });

  /** Palette click — same result as dragging it to the very end of the email. */
  const addBlock = (payload: Extract<DragPayload, { kind: 'new' }>) => {
    const block = blockFromPayload(payload);
    setDesign((current) => insertTemplateBlock(current, block, { kind: 'root' }, current.blocks.length));
    setSelectedId(block.id);
  };
  const updateBlock = (next: TemplateBlock) => setDesign((current) => updateTemplateBlock(current, next));

  const uploadImage = async (file: File) => {
    const blockId = imageTargetRef.current;
    if (!tenantId || !blockId) return;
    try {
      const query = new URLSearchParams({ tenantId, filename: file.name });
      const response = await fetch(`/api/communications/images?${query}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type },
        body: file,
      });
      const result = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error ?? 'Upload failed.');
      setDesign((current) => {
        const target = findTemplateBlock(current, blockId);
        return target?.type === 'image' ? updateTemplateBlock(current, { ...target, url: result.url! }) : current;
      });
      toast('success', 'Image uploaded.');
    } catch (error) {
      toast('error', error instanceof Error ? error.message : 'Image upload failed.');
    }
  };
  const requestImage = (blockId: string) => {
    imageTargetRef.current = blockId;
    fileRef.current?.click();
  };

  const insertVariable = (token: string) => {
    if (selected?.type === 'heading' || selected?.type === 'text') {
      updateBlock({ ...selected, text: `${selected.text}${selected.text ? ' ' : ''}${token}` });
      return true;
    }
    if (lastField === 'preheader' && mode === 'visual') {
      setDesign((current) => ({ ...current, preheader: `${current.preheader ?? ''}${current.preheader ? ' ' : ''}${token}` }));
      return true;
    }
    setSubject((value) => `${value}${value ? ' ' : ''}${token}`);
    return true;
  };

  // The checklist, plus the connection — the one problem that isn't in the email itself.
  const attention: NeedsAttentionItem[] = [
    ...(connectionStatus === 'missing' || connectionStatus === 'unverified'
      ? [
          {
            key: 'connection',
            tone: 'exception' as const,
            icon: PlugZap,
            title: connectionStatus === 'missing' ? 'Email isn’t set up — nothing will send' : 'The email connection hasn’t passed a test',
            fix: onOpenConnection ? { label: 'Open connector', run: onOpenConnection } : undefined,
          },
        ]
      : []),
    ...checks.map((check) => ({
      key: check.key,
      tone: check.tone,
      icon: TriangleAlert,
      title: check.title,
      detail: check.detail,
      fix: check.blockId ? { label: 'Show me', run: () => setSelectedId(check.blockId!) } : undefined,
    })),
  ];
  const blocking = checks.filter((check) => check.tone === 'exception').length;

  return (
    <EditorShell
      eyebrow="Email template"
      title={name || 'New template'}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      flush
      actions={
        <>
          <SegmentedControl
            options={DEVICES}
            value={device}
            onChange={setDevice}
            ariaLabel="Preview size"
            iconOnly
            className="hidden md:flex"
          />
          <Button variant="outline" onClick={() => setPreviewing(true)} className="h-9 gap-2">
            <Eye size={15} />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          {access.canSend && (
            <Button
              variant="outline"
              onClick={() => setTestOpen(true)}
              disabled={!canSave || blocking > 0}
              title={blocking ? 'Fix the problems first' : undefined}
              className="h-9 gap-2"
            >
              <Send size={15} />
              <span className="hidden sm:inline">Send test</span>
            </Button>
          )}
          {access.canWrite && (
            <ActionButton
              type="submit"
              form={FORM_ID}
              disabled={!canSave || (!dirty && Boolean(savedId))}
              pending={save.isPending}
              done={justSaved}
              className="h-9 min-w-24 px-5"
            >
              {!dirty && savedId ? 'Saved' : 'Save'}
            </ActionButton>
          )}
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate(undefined, { onSuccess: flashSaved });
        }}
        className={cn('grid min-h-0 flex-1', readOnly ? 'lg:grid-cols-[minmax(0,1fr)_24rem]' : 'lg:grid-cols-[13rem_minmax(0,1fr)_24rem]')}
      >
        {!readOnly && (
          <aside className="overflow-auto border-b border-rule/60 bg-card p-3 lg:border-b-0 lg:border-r">
            <p className="px-1 text-label uppercase text-muted-foreground">Add</p>
            <p className="mt-1 px-1 text-xs leading-relaxed text-muted-foreground">Drag onto the email, or click to add at the end.</p>
            <div className="mt-3 space-y-1">
              {BLOCKS.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  type="button"
                  draggable={mode === 'visual'}
                  disabled={mode !== 'visual'}
                  onDragStart={(event) => {
                    dnd.start({ kind: 'new', type });
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('text/plain', type);
                  }}
                  onDragEnd={dnd.end}
                  onClick={() => addBlock({ kind: 'new', type })}
                  className="flex h-10 w-full cursor-grab items-center gap-3 rounded-md px-2 text-sm font-medium text-foreground transition-colors hover:bg-band active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span
                    className="flex size-7 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground"
                    aria-hidden="true"
                  >
                    <Icon size={15} />
                  </span>
                  {label}
                </button>
              ))}
            </div>

            {/* Layouts come second: pick the shape of a row, then fill its cells. */}
            <p className="mt-6 px-1 text-label uppercase text-muted-foreground">Columns</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {COLUMN_LAYOUTS.map(({ value, label, widths }) => (
                <button
                  key={value}
                  type="button"
                  draggable={mode === 'visual'}
                  disabled={mode !== 'visual'}
                  onDragStart={(event) => {
                    dnd.start({ kind: 'new', type: 'columns', layout: value });
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('text/plain', value);
                  }}
                  onDragEnd={dnd.end}
                  onClick={() => addBlock({ kind: 'new', type: 'columns', layout: value })}
                  title={label}
                  aria-label={`Add a ${label} row`}
                  className="flex h-11 cursor-grab items-stretch gap-1 rounded-md border border-rule/60 bg-background p-2 transition-colors hover:border-primary/50 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {widths.map((width, index) => (
                    <span key={index} style={{ width: `${width}%` }} className="rounded-sm bg-band" aria-hidden="true" />
                  ))}
                </button>
              ))}
            </div>
          </aside>
        )}

        <main className="min-h-0 overflow-auto bg-band/60 p-4 md:p-6">
          <div className={cn('mx-auto space-y-4 transition-[max-width] duration-300', device === 'mobile' ? 'max-w-sm' : 'max-w-3xl')}>
            {!readOnly && (
              <NeedsAttention
                items={attention}
                summary={
                  blocking
                    ? `${attention.length} to fix before sending`
                    : `${attention.length} ${attention.length === 1 ? 'suggestion' : 'suggestions'}`
                }
              />
            )}

            {/* How it lands in the inbox — the subject and preview text are the first thing anyone reads. */}
            <div className="flex items-start justify-between gap-3 rounded-lg border border-rule/60 bg-card px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {subject || <span className="text-muted-foreground">No subject yet</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {design.preheader?.trim() || 'No preview text — the inbox shows the first words of the email'}
                </p>
              </div>
              {!readOnly && (
                <SegmentedControl
                  options={MODES}
                  value={mode}
                  onChange={(next) => {
                    if (next === 'html') {
                      setHtmlBody(renderTemplateDesign(design));
                      setTextBody(templateDesignToPlainText(design));
                    } else if (htmlBody !== renderTemplateDesign(design)) {
                      // The HTML was edited: bring it back rather than redraw the old blocks over it.
                      setDesign(htmlToDesign(htmlBody, design));
                      setSelectedId('');
                    }
                    setMode(next);
                  }}
                  ariaLabel="Editor"
                  className="shrink-0"
                />
              )}
            </div>

            {readOnly ? (
              // Reading, not building: the email as it renders.
              <div className="overflow-hidden rounded-lg border border-rule/60 bg-white">
                <iframe title="Email" sandbox="" srcDoc={compiledHtml} className="h-[calc(100dvh-16rem)] min-h-96 w-full border-0" />
              </div>
            ) : mode === 'html' ? (
              <div className="space-y-4 rounded-lg border border-rule/60 bg-card p-5">
                <div className="space-y-1.5">
                  <p className="text-label uppercase text-muted-foreground">HTML</p>
                  <textarea
                    value={htmlBody}
                    onChange={(event) => setHtmlBody(event.target.value)}
                    aria-label="HTML body"
                    className="min-h-96 w-full rounded-md border border-rule/60 bg-background p-3 font-mono text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="space-y-1.5">
                  <p className="text-label uppercase text-muted-foreground">Plain-text version</p>
                  <textarea
                    value={textBody}
                    onChange={(event) => setTextBody(event.target.value)}
                    aria-label="Plain-text fallback"
                    className="min-h-32 w-full rounded-md border border-rule/60 bg-background p-3 text-sm outline-none focus:border-primary"
                  />
                </div>
              </div>
            ) : (
              <TemplateCanvas
                design={design}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={setDesign}
                dnd={dnd}
                onRequestImage={requestImage}
              />
            )}
          </div>
        </main>

        <aside className="min-h-0 overflow-auto border-t border-rule/60 bg-background lg:border-l lg:border-t-0">
          <TemplateSettingsPanel
            selected={readOnly ? undefined : selected}
            onDeselect={() => setSelectedId('')}
            onBlockChange={updateBlock}
            onChooseImage={requestImage}
            name={name}
            onName={setName}
            category={category}
            onCategory={setCategory}
            categoryOptions={categoryOptions}
            categoryHint={categoryHint}
            subject={subject}
            onSubject={setSubject}
            preheader={design.preheader ?? ''}
            onPreheader={(preheader) => setDesign((current) => ({ ...current, preheader }))}
            onFocusField={setLastField}
            design={design}
            onStyles={(patch) => setDesign((current) => ({ ...current, styles: { ...current.styles, ...patch } }))}
            variables={variables}
            onInsertVariable={insertVariable}
            usedBy={usedBy}
            canDelete={Boolean(savedId) && access.canWrite}
            onDelete={() => setDeleting(true)}
            readOnly={readOnly}
            htmlMode={mode === 'html'}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadImage(file);
              event.currentTarget.value = '';
            }}
          />
        </aside>
      </form>

      {previewing && (
        <EmailPreviewDrawer
          description="How it looks in an inbox"
          title={name || 'Untitled template'}
          subject={subject}
          recipient={<span className="font-mono text-primary">{'{{customer.email}}'}</span>}
          htmlBody={compiledHtml}
          textBody={compiledText}
          onClose={() => setPreviewing(false)}
        />
      )}
      {testOpen && (
        <Modal
          title="Send a test email"
          description="Saves the template, then sends it. There’s no customer behind a test, so customer and order details come through blank."
          onClose={() => setTestOpen(false)}
          className="max-w-lg"
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTestOpen(false)}>
                Cancel
              </Button>
              <Button
                disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim()) || sendTest.isPending}
                onClick={() => sendTest.mutate()}
              >
                {sendTest.isPending ? 'Sending…' : 'Send test'}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            {(connectionStatus === 'missing' || connectionStatus === 'unverified') && (
              <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/6 p-3 text-xs text-foreground">
                <TriangleAlert size={15} className="mt-px shrink-0 text-warning" />
                <span>
                  Email sending isn’t verified, so this may not arrive.{' '}
                  {onOpenConnection && (
                    <button type="button" onClick={onOpenConnection} className="font-semibold underline">
                      Set it up
                    </button>
                  )}
                </span>
              </div>
            )}
            <Input label="Send to" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} autoFocus />
          </div>
        </Modal>
      )}
      {deleting && (
        <ConfirmModal
          title="Delete this template?"
          message={
            usedBy.length
              ? `“${name}” is used by ${usedBy.length} automation${usedBy.length === 1 ? '' : 's'} (${usedBy
                  .map((item) => item.name)
                  .join(', ')}). Those steps will stop sending. Emails already sent stay in History.`
              : `“${name}” will be removed from your templates. Emails already sent stay in History.`
          }
          confirmLabel="Delete template"
          pendingLabel="Deleting…"
          isPending={destroy.isPending}
          onConfirm={() => destroy.mutate()}
          onClose={() => setDeleting(false)}
        />
      )}
    </EditorShell>
  );
}
