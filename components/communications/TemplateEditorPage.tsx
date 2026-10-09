'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { Mascot } from '@/components/ai/Mascot';
import { RowTile } from '@/components/cms/rows';
import {
  ArrowDown,
  Code,
  Eye,
  FileText,
  Globe,
  ImagePlus,
  Link2,
  ListView,
  Mail,
  Minus,
  PlugZap,
  Send,
  TriangleAlert,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { Modal } from '@/components/shared/Modal';
import { NeedsAttention, type NeedsAttentionItem } from '@/components/shared/NeedsAttention';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';
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
import { TokenTextarea } from './TokenTextarea';
import { DEFAULT_TEMPLATE_CATEGORY, TEMPLATE_CATEGORIES } from './shared';
import {
  COLUMN_LAYOUTS,
  type TemplateBlock,
  type TemplateDesign,
  type TemplateLeafBlock,
  defaultTemplateDesign,
  findTemplateBlock,
  htmlToDesign,
  insertTemplateBlock,
  isTemplateDesign,
  normalizeTemplateDesign,
  readHtmlPreheader,
  renderTemplateDesign,
  setHtmlPreheader,
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

const BLOCKS: Array<{ type: TemplateLeafBlock['type']; label: string; icon: IconComponent }> = [
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
    mode === 'visual' ? templateChecks(design, subject, variables) : templateChecks(design, subject, variables, { htmlBody, textBody });

  // "Show me" for a bad merge field in the HTML editor: select it where it first appears.
  const htmlRef = useRef<HTMLTextAreaElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const revealToken = (token: string) => {
    const pattern = new RegExp(`{{\\s*${token.replace(/\./g, '\\.')}\\s*}}`);
    for (const [field, text] of [
      [htmlRef.current, htmlBody],
      [textRef.current, textBody],
    ] as const) {
      const match = pattern.exec(text);
      if (!field || !match) continue;
      field.focus();
      field.setSelectionRange(match.index, match.index + match[0].length);
      // Put the selection mid-box: line position × line height, near enough for a textarea.
      const line = text.slice(0, match.index).split('\n').length - 1;
      const lineHeight = parseFloat(getComputedStyle(field).lineHeight) || 16;
      field.scrollTop = Math.max(0, line * lineHeight - field.clientHeight / 2);
      field.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return;
    }
  };

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
  /** Ask DUMA, through the CRM's own route (the provider keys live there); returns the suggestion. */
  const askDuma = async (body: Record<string, unknown>) => {
    const response = await fetch('/api/communications/assist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!response.ok || !json.text) throw new Error(json.error ?? 'Ask DUMA is unavailable right now.');
    return json.text;
  };

  /** One preview text, wherever it's set from: the design, and in the HTML view the HTML that gets sent. */
  const changePreheader = (preheader: string) => {
    setDesign((current) => ({ ...current, preheader }));
    if (mode === 'html') setHtmlBody((current) => setHtmlPreheader(current, preheader));
  };

  // Ask DUMA: the plain-text version, written from the HTML as it stands now.
  // It replaces the field outright — the plain text is meant to mirror the HTML.
  const [plainTextCheer, setPlainTextCheer] = useState(0);
  const writePlainText = useMutation({
    mutationFn: () => askDuma({ task: 'plain-text', html: htmlBody }),
    onSuccess: (text) => {
      setTextBody(text);
      setPlainTextCheer((count) => count + 1);
      toast('success', 'Plain text written from the HTML — check it, then save.');
    },
    onError: (error) => toast('error', error.message),
  });

  // Ask DUMA: the preview line, from the subject and the email without its current preview line.
  const [preheaderCheer, setPreheaderCheer] = useState(0);
  const writePreheader = useMutation({
    mutationFn: () => askDuma({ task: 'preheader', subject, html: setHtmlPreheader(compiledHtml, '') }),
    onSuccess: (text) => {
      changePreheader(text);
      setPreheaderCheer((count) => count + 1);
      toast('success', 'Preview text written — check it, then save.');
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
      fix: check.blockId
        ? { label: 'Show me', run: () => setSelectedId(check.blockId!) }
        : check.token && mode === 'html'
          ? { label: 'Show me', run: () => revealToken(check.token!) }
          : undefined,
    })),
  ];
  const blocking = checks.filter((check) => check.tone === 'exception').length;
  const categoryLabel = categoryOptions.find((option) => option.value === category)?.label ?? category;

  /** Back to the last save — the snapshot holds every field the editor owns. */
  const discard = () => {
    const saved = JSON.parse(initialSnapshot) as {
      name: string;
      category: string;
      subject: string;
      design: TemplateDesign;
      htmlBody: string;
      textBody: string;
      mode: 'visual' | 'html';
    };
    setName(saved.name);
    setCategory(saved.category);
    setSubject(saved.subject);
    setDesign(saved.design);
    setHtmlBody(saved.htmlBody);
    setTextBody(saved.textBody);
    setMode(saved.mode);
    setSelectedId('');
  };

  // ⌘S / Ctrl+S saves, as in the Content editors.
  const saveShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘S' : 'Ctrl+S';
  const canSubmit = access.canWrite && canSave && (dirty || !savedId) && !save.isPending;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (canSubmit) save.mutate(undefined, { onSuccess: flashSaved });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [canSubmit, save, flashSaved]);

  return (
    <EditorShell
      eyebrow="Email template"
      title={name || 'New template'}
      icon={<Mail size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      flush
      meta={
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{categoryLabel}</span>
          {(dirty || !savedId) && access.canWrite && (
            <span className="inline-flex items-center gap-1 font-medium text-measured">
              <span className="size-1.5 rounded-full bg-measured" aria-hidden="true" />
              {savedId ? 'Unsaved changes' : 'Not created yet'}
            </span>
          )}
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => setPreviewing(true)}>
            <Eye aria-hidden="true" /> <span className="hidden md:inline">Preview</span>
          </Button>
          {access.canSend && (
            <Tooltip side="top" label={blocking ? 'Fix the problems first' : 'Saves, then sends it to you'}>
              <Button variant="outline" className="h-9 gap-1.5" onClick={() => setTestOpen(true)} disabled={!canSave || blocking > 0}>
                <Send aria-hidden="true" />
                <span className="hidden md:inline">Send test</span>
              </Button>
            </Tooltip>
          )}
          {access.canWrite && dirty && (
            <Button variant="ghost" className="h-9" disabled={save.isPending} onClick={savedId ? discard : onClose}>
              Discard
            </Button>
          )}
          {access.canWrite && (
            <Tooltip side="top" align="end" label={`${savedId ? 'Save' : 'Create'} (${saveShortcut})`}>
              <ActionButton
                type="submit"
                form={FORM_ID}
                disabled={!canSave || (!dirty && Boolean(savedId))}
                pending={save.isPending}
                done={justSaved}
                className="h-9 min-w-24 px-5"
              >
                {!dirty && savedId ? 'Saved' : savedId ? 'Save' : 'Create template'}
              </ActionButton>
            </Tooltip>
          )}
        </div>
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
          <aside className="overflow-auto border-b border-divider bg-card p-4 lg:border-b-0 lg:border-r">
            <h2 className="text-base font-semibold tracking-title text-foreground">Content</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Drag onto the email, or click to add at the end.</p>
            <div className="-mx-2 mt-3 flex flex-col gap-0.5">
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
                  className="flex w-full cursor-grab items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-band/50 focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <RowTile icon={Icon} />
                  {label}
                </button>
              ))}
            </div>

            {/* Layouts come second: pick the shape of a row, then fill its cells. */}
            <h2 className="mt-6 border-t border-rule/50 pt-5 text-base font-semibold tracking-title text-foreground">Columns</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Pick a row’s shape, then fill each cell.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
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
                  className="flex h-11 cursor-grab items-stretch gap-1 rounded-md border border-rule/60 bg-field p-2 transition-colors hover:border-primary/50 hover:bg-primary/6 focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-50"
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
          <div className="mx-auto max-w-3xl space-y-4">
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
            <div className="flex items-center justify-between gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3">
              <div className="flex min-w-0 items-center gap-3">
                <RowTile icon={Mail} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {subject || <span className="text-muted-foreground">No subject yet</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {design.preheader?.trim() || 'No preview text — the inbox shows the first words of the email'}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {!readOnly && (
                  <SegmentedControl
                    options={MODES}
                    value={mode}
                    onChange={(next) => {
                      if (next === 'html') {
                        setHtmlBody(renderTemplateDesign(design));
                        setTextBody(templateDesignToPlainText(design));
                      } else if (setHtmlPreheader(htmlBody, '') !== renderTemplateDesign({ ...design, preheader: '' })) {
                        // The HTML was edited: bring it back rather than redraw the old blocks over it.
                        setDesign(htmlToDesign(htmlBody, design));
                        setSelectedId('');
                      } else {
                        // Only the preview text changed — keep the blocks, take the text.
                        setDesign((current) => ({ ...current, preheader: readHtmlPreheader(htmlBody) ?? '' }));
                      }
                      setMode(next);
                    }}
                    ariaLabel="Editor"
                    className="shrink-0"
                  />
                )}
              </div>
            </div>

            {readOnly ? (
              // Reading, not building: the email as it renders.
              <div className="overflow-hidden rounded-lg border border-rule/60 bg-white">
                <iframe title="Email" sandbox="" srcDoc={compiledHtml} className="h-[calc(100dvh-16rem)] min-h-96 w-full border-0" />
              </div>
            ) : mode === 'html' ? (
              <div className="space-y-4 rounded-lg border border-rule/60 bg-field p-5">
                <div className="space-y-1.5">
                  <p className="text-label uppercase text-muted-foreground">HTML</p>
                  <TokenTextarea
                    ref={htmlRef}
                    value={htmlBody}
                    onChange={(next) => {
                      setHtmlBody(next);
                      // Edited in the HTML itself: the Preview text field follows.
                      const read = readHtmlPreheader(next) ?? '';
                      if (read !== (design.preheader ?? '').trim()) setDesign((current) => ({ ...current, preheader: read }));
                    }}
                    variables={variables}
                    aria-label="HTML body"
                    className="min-h-96 font-mono text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-label uppercase text-muted-foreground">Plain-text version</p>
                    <Tooltip
                      side="top"
                      align="end"
                      label={
                        textBody.trim() ? 'Replaces what’s here with a plain-text copy of the HTML above' : 'Writes it from the HTML above'
                      }
                    >
                      {/* A standard outline button, with the mascot as its icon: it thinks while it writes and cheers when it's done. */}
                      <Button
                        type="button"
                        variant="outline"
                        disabled={!htmlBody.trim() || writePlainText.isPending}
                        onClick={() => writePlainText.mutate()}
                        className="h-9 gap-2 pl-1.5"
                      >
                        <Mascot
                          size={28}
                          state={writePlainText.isPending ? 'thinking' : undefined}
                          feeling={writePlainText.isError ? 'sad' : plainTextCheer ? 'happy' : 'curious'}
                          gesture={plainTextCheer ? 'celebrate' : undefined}
                          gestureKey={plainTextCheer}
                          fps={24}
                          className="shrink-0"
                        />
                        <span aria-live="polite">
                          {writePlainText.isPending ? 'Writing it…' : textBody.trim() ? 'Ask DUMA to rewrite it' : 'Ask DUMA to write it'}
                        </span>
                      </Button>
                    </Tooltip>
                  </div>
                  <div className={cn('transition-opacity', writePlainText.isPending && 'opacity-50')}>
                    <TokenTextarea
                      ref={textRef}
                      value={textBody}
                      onChange={setTextBody}
                      variables={variables}
                      readOnly={writePlainText.isPending}
                      aria-busy={writePlainText.isPending}
                      aria-label="Plain-text fallback"
                      className="min-h-32 text-sm"
                    />
                  </div>
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

        <aside className="min-h-0 overflow-auto border-t border-divider bg-background lg:border-l lg:border-t-0">
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
            onPreheader={changePreheader}
            onSuggestPreheader={readOnly ? undefined : () => writePreheader.mutate()}
            preheaderAsk={{ busy: writePreheader.isPending, failed: writePreheader.isError, cheer: preheaderCheer }}
            design={design}
            onStyles={(patch) => setDesign((current) => ({ ...current, styles: { ...current.styles, ...patch } }))}
            variables={variables}
            usedBy={usedBy}
            canDelete={Boolean(savedId) && access.canWrite}
            onDelete={() => setDeleting(true)}
            onPreview={() => setPreviewing(true)}
            onSendTest={access.canSend ? () => setTestOpen(true) : undefined}
            sendTestBlocked={!canSave || blocking > 0}
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
