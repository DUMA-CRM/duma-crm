'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo, useRef, useState } from 'react';

import {
  ArrowDown,
  Eye,
  FileText,
  Globe,
  ImagePlus,
  Link2,
  ListView,
  Loader2,
  Minus,
  Plus,
  Send,
  Trash2,
  TriangleAlert,
} from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

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
} from '@/lib/api/email.service';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { EmailPreviewDrawer } from './EmailPreviewDrawer';
import { type CanvasDnd, type DragPayload, TemplateCanvas, blockFromPayload } from './TemplateCanvas';
import { VariablePalette } from './VariablePalette';
import {
  COLUMN_LAYOUTS,
  type TemplateBlock,
  type TemplateDesign,
  type TemplateLeafBlock,
  defaultTemplateDesign,
  insertTemplateBlock,
  isColumnsBlock,
  isTemplateDesign,
  findTemplateBlock,
  legacyHtmlToDesign,
  normalizeTemplateDesign,
  relayoutColumns,
  renderTemplateDesign,
  templateDesignToPlainText,
  updateTemplateBlock,
} from './templateDesign';
import { DEFAULT_TEMPLATE_CATEGORY, TEMPLATE_CATEGORIES } from './shared';
import { workflowForAutomation } from './workflowModel';

const FORM_ID = 'email-template-form';
const MODES = [
  { value: 'visual' as const, label: 'Design' },
  { value: 'html' as const, label: 'HTML' },
];

const BLOCKS: Array<{ type: TemplateLeafBlock['type']; label: string; icon: React.ComponentType<{ size?: number }> }> = [
  { type: 'heading', label: 'Heading', icon: FileText },
  { type: 'text', label: 'Text', icon: ListView },
  { type: 'button', label: 'Button', icon: Link2 },
  { type: 'image', label: 'Image', icon: ImagePlus },
  { type: 'divider', label: 'Divider', icon: Minus },
  { type: 'spacer', label: 'Spacer', icon: ArrowDown },
  { type: 'social', label: 'Social', icon: Globe },
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
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();
  const source = template;
  // Stored designs may predate column rows, so everything is read through the
  // normaliser before it reaches the canvas.
  const initialDesign = isTemplateDesign(source?.design)
    ? normalizeTemplateDesign(source.design)
    : source?.htmlBody
      ? legacyHtmlToDesign(source.htmlBody)
      : defaultTemplateDesign();
  const [name, setName] = useState(source?.name ?? '');
  const [category, setCategory] = useState(source?.category ?? DEFAULT_TEMPLATE_CATEGORY);
  const [subject, setSubject] = useState(source?.subject ?? '');
  const [design, setDesign] = useState<TemplateDesign>(initialDesign);
  const [htmlBody, setHtmlBody] = useState(source?.htmlBody ?? renderTemplateDesign(initialDesign));
  const [textBody, setTextBody] = useState(source?.textBody ?? templateDesignToPlainText(initialDesign));
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [selectedId, setSelectedId] = useState(initialDesign.blocks[0]?.id ?? '');
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

  const { data: variables = [] } = useQuery({ queryKey: ['email-variables'], queryFn: getEmailVariables });
  const { data: automations = [] } = useQuery({
    queryKey: ['email-automations', tenantId],
    queryFn: () => getEmailAutomations(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const { data: connection } = useQuery({
    queryKey: ['email-connection', tenantId],
    queryFn: () => getEmailConnection(tenantId ?? undefined),
    enabled: !!tenantId,
    retry: false,
  });
  // A template saved under an older free-text category keeps its own entry, so
  // it stays selectable instead of silently jumping to another bucket on save.
  const categoryOptions = useMemo(() => {
    const known = TEMPLATE_CATEGORIES.map(({ value, label }) => ({ value, label }));
    return known.some((option) => option.value === category)
      ? known
      : [...known, { value: category, label: `${category} (old category)` }];
  }, [category]);
  const categoryHint = TEMPLATE_CATEGORIES.find((option) => option.value === category)?.hint ?? 'Kept from an earlier category.';

  const usedBy = automations.filter((automation) =>
    workflowForAutomation(automation).nodes.some((node) => node.type === 'send_email' && node.config.templateId === savedId),
  );
  const selected = findTemplateBlock(design, selectedId);
  const compiledHtml = mode === 'visual' ? renderTemplateDesign(design) : htmlBody;
  const compiledText = mode === 'visual' ? templateDesignToPlainText(design) : textBody;
  const canSave = Boolean(name.trim() && subject.trim() && compiledHtml.trim());
  const emailReady = connection?.isEnabled && connection.lastTestSucceeded;

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
    await queryClient.invalidateQueries({ queryKey: ['email-templates'] });
    onSaved?.(saved);
    return saved;
  };

  const save = useMutation({
    mutationFn: persist,
    onSuccess: () => {
      toast('success', savedId ? 'Template saved.' : 'Template created.');
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });
  const sendTest = useMutation({
    mutationFn: async () => {
      const saved = await persist();
      return sendEmail({ tenantId: tenantId ?? undefined, templateId: saved.id, toEmail: testEmail, toName: user?.name ?? undefined });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-deliveries'] });
      setTestOpen(false);
      toast('success', `Test email queued to ${testEmail}.`);
    },
    onError: (error) => toast('error', error.message),
  });
  const destroy = useMutation({
    mutationFn: () => archiveEmailTemplate(savedId ?? '', tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
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
    setSubject((value) => `${value}${value ? ' ' : ''}${token}`);
    return true;
  };

  return (
    <EditorShell
      eyebrow="Email template"
      title={name || 'New template'}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      flush
      actions={
        <>
          <Button variant="outline" onClick={() => setPreviewing(true)} className="h-9 gap-2">
            <Eye size={15} />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button variant="outline" onClick={() => setTestOpen(true)} disabled={!canSave} className="h-9 gap-2">
            <Send size={15} />
            <span className="hidden sm:inline">Send test</span>
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!canSave || save.isPending} className="h-9 gap-2 px-5">
            {save.isPending && <Loader2 size={14} className="animate-spin" />}
            {save.isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        id={FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();
          save.mutate();
        }}
        className="grid min-h-0 flex-1 lg:grid-cols-[15rem_minmax(32rem,1fr)_21rem]"
      >
        <aside className="overflow-auto border-b border-rule bg-card p-4 lg:border-b-0 lg:border-r">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Content</p>
          <p className="mt-1.5 text-label leading-relaxed text-muted-foreground">Drag onto the email, or click to add at the end.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {BLOCKS.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                draggable
                onDragStart={(event) => {
                  dnd.start({ kind: 'new', type });
                  event.dataTransfer.effectAllowed = 'copy';
                  event.dataTransfer.setData('text/plain', type);
                }}
                onDragEnd={dnd.end}
                onClick={() => addBlock({ kind: 'new', type })}
                className="flex min-h-20 cursor-grab flex-col items-center justify-center gap-2 rounded-sm border border-rule bg-background text-xs font-semibold transition hover:border-primary/50 hover:bg-band active:cursor-grabbing"
              >
                <Icon size={19} />
                {label}
              </button>
            ))}
          </div>

          {/* Layouts come second: pick the shape of a row, then fill its cells. */}
          <div className="mt-6 border-t border-rule pt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Layouts</p>
            <p className="mt-1.5 text-label leading-relaxed text-muted-foreground">
              Drop a row in, then drag content into each column.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {COLUMN_LAYOUTS.map(({ value, label, widths }) => (
                <button
                  key={value}
                  type="button"
                  draggable
                  onDragStart={(event) => {
                    dnd.start({ kind: 'new', type: 'columns', layout: value });
                    event.dataTransfer.effectAllowed = 'copy';
                    event.dataTransfer.setData('text/plain', value);
                  }}
                  onDragEnd={dnd.end}
                  onClick={() => addBlock({ kind: 'new', type: 'columns', layout: value })}
                  title={label}
                  aria-label={`Add a ${label} row`}
                  className="flex cursor-grab flex-col items-center gap-2 rounded-sm border border-rule bg-background p-2.5 transition hover:border-primary/50 hover:bg-band active:cursor-grabbing"
                >
                  <span className="flex h-7 w-full items-stretch gap-1" aria-hidden="true">
                    {widths.map((width, index) => (
                      <span key={index} style={{ width: `${width}%` }} className="rounded bg-muted" />
                    ))}
                  </span>
                  <span className="text-label font-semibold">{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-6 space-y-3 border-t border-rule pt-4">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Template</p>
            <Input label="Name" value={name} onChange={(event) => setName(event.target.value)} required />
            <div className="space-y-1.5">
              <label htmlFor="template-category" className="text-xs font-bold text-muted-foreground">
                Category
              </label>
              <Select
                id="template-category"
                value={category}
                onValueChange={setCategory}
                options={categoryOptions}
                ariaLabel="Template category"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground">{categoryHint}</p>
            </div>
          </div>
        </aside>

        <main className="min-h-0 overflow-auto bg-band p-4 md:p-6">
          <div className="mx-auto max-w-3xl">
            <div className="mb-4 rounded-sm border border-rule bg-card p-3 shadow-sm">
              <Input
                label="Subject line"
                value={subject}
                onChange={(event) => setSubject(event.target.value)}
                required
                placeholder="What customers see in their inbox"
              />
              <div className="mt-3 flex justify-end">
                <SegmentedControl
                  options={MODES}
                  value={mode}
                  onChange={(next) => {
                    if (next === 'html') {
                      setHtmlBody(renderTemplateDesign(design));
                      setTextBody(templateDesignToPlainText(design));
                    }
                    setMode(next);
                  }}
                />
              </div>
            </div>
            {mode === 'html' ? (
              <div className="space-y-4 rounded-sm border border-rule bg-card p-5 shadow-sm">
                <div>
                  <label className="text-xs font-bold text-muted-foreground">HTML body</label>
                  <textarea
                    value={htmlBody}
                    onChange={(event) => setHtmlBody(event.target.value)}
                    className="mt-2 min-h-96 w-full rounded-sm border border-rule bg-background p-3 font-mono text-xs outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-muted-foreground">Plain-text fallback</label>
                  <textarea
                    value={textBody}
                    onChange={(event) => setTextBody(event.target.value)}
                    className="mt-2 min-h-32 w-full rounded-sm border border-rule bg-background p-3 text-sm outline-none focus:border-primary"
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

        <aside className="overflow-auto border-t border-rule bg-card p-4 lg:border-l lg:border-t-0">
          {/* Text and layout are handled on the email itself; this panel is for the
              settings a block cannot show inline — links, sizes, alignment. */}
          {mode === 'visual' && selected ? (
            <>
              <p className="text-xs font-bold uppercase tracking-widest text-primary">Selected block</p>
              <p className="mt-1 font-semibold capitalize">{isColumnsBlock(selected) ? 'Column row' : selected.type}</p>
              <div className="mt-4">
                <BlockSettings block={selected} onChange={updateBlock} onChooseImage={() => requestImage(selected.id)} />
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              {mode === 'visual'
                ? 'Click a block on the email to change its settings. Text can be edited straight on the page.'
                : 'Editing raw HTML — switch back to Design to use the builder.'}
            </p>
          )}
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
          <div className="mt-6 border-t border-rule pt-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Brand styles</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(['backgroundColor', 'contentColor', 'textColor', 'accentColor'] as const).map((key) => (
                <label key={key} className="text-label capitalize text-muted-foreground">
                  {key.replace('Color', '')}
                  <input
                    type="color"
                    value={design.styles[key]}
                    onChange={(event) => setDesign((current) => ({ ...current, styles: { ...current.styles, [key]: event.target.value } }))}
                    className="mt-1 h-9 w-full rounded border border-rule bg-background"
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="mt-6 border-t border-rule pt-5">
            <VariablePalette variables={variables} onInsert={insertVariable} />
          </div>
          {savedId && (
            <div className="mt-6 border-t border-rule pt-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Used by</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {usedBy.length ? usedBy.map((item) => item.name).join(', ') : 'No workflows yet.'}
              </p>
              <Button type="button" variant="destructive" size="sm" onClick={() => setDeleting(true)} className="mt-4 w-full gap-2">
                <Trash2 />
                Delete template
              </Button>
            </div>
          )}
        </aside>
      </form>

      {previewing && (
        <EmailPreviewDrawer
          description="Responsive email preview"
          title={name || 'Untitled template'}
          subject={subject}
          recipient={<span className="font-mono text-primary">{'{{customer.email}}'}</span>}
          htmlBody={compiledHtml}
          textBody={compiledText}
          onClose={() => setPreviewing(false)}
        />
      )}
      {testOpen && (
        <Modal title="Send a test email" onClose={() => setTestOpen(false)} className="max-w-lg">
          <div className="space-y-4">
            {!emailReady && (
              <div className="flex gap-2 rounded-sm border border-warning/40 bg-warning/6 p-3 text-xs text-warning">
                <TriangleAlert size={15} />
                Email sending is not verified.
                {onOpenConnection && (
                  <button type="button" onClick={onOpenConnection} className="font-semibold underline">
                    Set it up
                  </button>
                )}
              </div>
            )}
            <Input label="Send to" type="email" value={testEmail} onChange={(event) => setTestEmail(event.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setTestOpen(false)}>
                Cancel
              </Button>
              <Button disabled={!testEmail || sendTest.isPending} onClick={() => sendTest.mutate()}>
                {sendTest.isPending ? 'Sending…' : 'Send test'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
      {deleting && (
        <ConfirmModal
          title="Delete this template?"
          message={
            usedBy.length
              ? `“${name}” is used by ${usedBy.length} workflow${usedBy.length === 1 ? '' : 's'} (${usedBy
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

function BlockSettings({
  block,
  onChange,
  onChooseImage,
}: {
  block: TemplateBlock;
  onChange: (block: TemplateBlock) => void;
  onChooseImage: () => void;
}) {
  if (block.type === 'heading' || block.type === 'text')
    return (
      <div className="space-y-3">
        <p className="rounded-sm bg-muted p-2.5 text-label leading-relaxed text-muted-foreground">
          Click the text on the email to edit it in place.
        </p>
        <Alignment value={block.align} onChange={(align) => onChange({ ...block, align })} />
      </div>
    );
  if (block.type === 'button')
    return (
      <div className="space-y-3">
        <p className="rounded-sm bg-muted p-2.5 text-label leading-relaxed text-muted-foreground">
          The label is edited on the button itself.
        </p>
        <Input label="Destination URL" value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} />
        <Alignment value={block.align} onChange={(align) => onChange({ ...block, align })} />
      </div>
    );
  if (block.type === 'image')
    return (
      <div className="space-y-3">
        <Button type="button" variant="outline" className="w-full gap-2" onClick={onChooseImage}>
          <ImagePlus />
          Upload image
        </Button>
        <Input label="Image URL" value={block.url} onChange={(event) => onChange({ ...block, url: event.target.value })} />
        <Input label="Alt text" value={block.alt} onChange={(event) => onChange({ ...block, alt: event.target.value })} />
        <Input label="Link URL" value={block.href} onChange={(event) => onChange({ ...block, href: event.target.value })} />
        <Input
          label="Width (%)"
          type="number"
          min={10}
          max={100}
          value={block.width}
          onChange={(event) => onChange({ ...block, width: Number(event.target.value) })}
        />
        <Alignment value={block.align} onChange={(align) => onChange({ ...block, align })} />
      </div>
    );
  if (block.type === 'spacer')
    return (
      <Input
        label="Height (px)"
        type="number"
        min={8}
        max={120}
        value={block.height}
        onChange={(event) => onChange({ ...block, height: Number(event.target.value) })}
      />
    );
  if (block.type === 'columns')
    return (
      <div className="space-y-3">
        <p className="rounded-sm bg-muted p-2.5 text-label leading-relaxed text-muted-foreground">
          Drag content from the left panel into a column. Change the split below — content is kept.
        </p>
        <p className="text-xs font-bold tracking-widest text-muted-foreground">Split</p>
        <div className="grid grid-cols-2 gap-2">
          {COLUMN_LAYOUTS.map(({ value, label, widths }) => (
            <button
              key={value}
              type="button"
              onClick={() => onChange(relayoutColumns(block, value))}
              aria-pressed={block.layout === value}
              title={label}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-sm border p-2 transition',
                block.layout === value ? 'border-primary bg-band' : 'border-rule hover:border-primary/40',
              )}
            >
              <span className="flex h-6 w-full items-stretch gap-1" aria-hidden="true">
                {widths.map((width, index) => (
                  <span key={index} style={{ width: `${width}%` }} className="rounded bg-muted" />
                ))}
              </span>
              <span className="text-micro font-semibold">{label}</span>
            </button>
          ))}
        </div>
      </div>
    );
  if (block.type === 'social')
    return (
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Add links customers can use to find your brand.</p>
        {block.links.map((link, index) => (
          <div key={index} className="rounded-sm border border-rule p-2">
            <Input
              label="Label"
              value={link.label}
              onChange={(event) =>
                onChange({
                  ...block,
                  links: block.links.map((item, position) => (position === index ? { ...item, label: event.target.value } : item)),
                })
              }
            />
            <Input
              label="URL"
              value={link.url}
              onChange={(event) =>
                onChange({
                  ...block,
                  links: block.links.map((item, position) => (position === index ? { ...item, url: event.target.value } : item)),
                })
              }
            />
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full"
          onClick={() => onChange({ ...block, links: [...block.links, { label: 'Website', url: 'https://' }] })}
        >
          <Plus />
          Add link
        </Button>
      </div>
    );
  return <p className="text-xs text-muted-foreground">This divider has no additional settings.</p>;
}

function Alignment({ value, onChange }: { value: 'left' | 'center' | 'right'; onChange: (value: 'left' | 'center' | 'right') => void }) {
  return (
    <div>
      <p className="text-xs font-bold text-muted-foreground">Alignment</p>
      <div className="mt-2 grid grid-cols-3 gap-1">
        {(['left', 'center', 'right'] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            className={cn(
              'rounded-sm border px-2 py-2 text-xs capitalize',
              value === option ? 'border-primary bg-band text-primary' : 'border-rule',
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}
