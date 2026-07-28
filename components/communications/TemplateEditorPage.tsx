'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, ChevronDown, ChevronUp, Eye, Loader2, Plus, Send, Trash2, TriangleAlert } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';

import { CategoryCombobox } from '@/components/shared/CategoryCombobox';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import {
  type EmailTemplate,
  type EmailTemplatePayload,
  archiveEmailTemplate,
  createEmailTemplate,
  getEmailAutomations,
  getEmailConnection,
  getEmailTemplates,
  getEmailVariables,
  sendEmail,
  updateEmailTemplate,
} from '@/lib/api/email.service';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { EmailPreviewPage } from './EmailPreviewPage';
import { VariablePalette } from './VariablePalette';
import { labelClass, panelClass, textareaClass } from './shared';
import { BLOCK_LABELS, type SimpleBlock, blocksToPlainText, htmlToBlocks, newBlock, readSimpleBody, renderSimpleBody } from './simpleBody';
import { useVariableInsert } from './useVariableInsert';

const FORM_ID = 'email-template-form';
const DEFAULT_BLOCKS: SimpleBlock[] = [newBlock('heading'), newBlock('text')];

const MODE_OPTIONS = [
  { value: 'simple' as const, label: 'Simple' },
  { value: 'html' as const, label: 'HTML' },
];

/**
 * Full-page template editor. Defaults to "Simple" mode — a short list of content
 * blocks that generates the email HTML — so a non-technical user never has to see
 * markup. The HTML tab stays available for anyone who wants full control.
 */
export function TemplateEditorPage({
  template,
  initial,
  onClose,
  onSaved,
  onOpenConnection,
}: {
  template?: EmailTemplate;
  /** Starting values, e.g. from a preset. */
  initial?: EmailTemplatePayload;
  onClose: () => void;
  /** Fires after each successful save (used to move the URL from "new" to the saved id). */
  onSaved?: (saved: EmailTemplate) => void;
  onOpenConnection?: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const user = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const source = template ?? initial;
  const startingHtml = source?.htmlBody ?? renderSimpleBody(DEFAULT_BLOCKS);
  const startingBlocks = readSimpleBody(startingHtml);

  const [form, setForm] = useState<EmailTemplatePayload>({
    name: source?.name ?? '',
    category: source?.category ?? 'general',
    subject: source?.subject ?? '',
    htmlBody: startingHtml,
    textBody: source?.textBody ?? (startingBlocks ? blocksToPlainText(startingBlocks) : ''),
    isActive: source?.isActive ?? true,
  });
  const [blocks, setBlocks] = useState<SimpleBlock[]>(startingBlocks ?? []);
  const [mode, setMode] = useState<'simple' | 'html'>(startingBlocks ? 'simple' : 'html');
  const [confirmImport, setConfirmImport] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState(user?.email ?? '');
  const [archiving, setArchiving] = useState(false);
  // Set once a new template has been created, so later saves patch it instead of
  // creating duplicates (e.g. "send test" on a brand-new template).
  const [savedId, setSavedId] = useState(template?.id ?? null);

  // Snapshot of the values this editor opened with — powers the discard guard.
  const initialSnapshot = useRef(JSON.stringify(form)).current;
  const dirty = JSON.stringify(form) !== initialSnapshot;

  const { data: variables = [] } = useQuery({ queryKey: ['email-variables'], queryFn: getEmailVariables });
  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates', tenantId],
    queryFn: () => getEmailTemplates(tenantId ?? undefined),
    enabled: !!tenantId,
  });
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

  const categories = useMemo(
    () => [...new Set(templates.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [templates],
  );
  const usedBy = automations.filter((automation) => automation.templateId === savedId);
  const emailReady = connection?.isEnabled && connection?.lastTestSucceeded;
  const { bind, insert } = useVariableInsert();

  const update = <K extends keyof EmailTemplatePayload>(key: K, value: EmailTemplatePayload[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  /** Simple mode keeps the HTML and plain-text bodies generated from the blocks. */
  const applyBlocks = (next: SimpleBlock[]) => {
    setBlocks(next);
    setForm((current) => ({ ...current, htmlBody: renderSimpleBody(next), textBody: blocksToPlainText(next) }));
  };

  const persist = async () => {
    const payload = { ...form, tenantId: tenantId ?? undefined };
    const saved = savedId ? await updateEmailTemplate(savedId, payload) : await createEmailTemplate(payload);
    setSavedId(saved.id);
    queryClient.invalidateQueries({ queryKey: ['email-templates'] });
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
      return sendEmail({
        tenantId: tenantId ?? undefined,
        templateId: saved.id,
        toEmail: testEmail,
        toName: user?.name ?? undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-deliveries'] });
      toast('success', `Test email queued to ${testEmail}. Check the History tab if it does not arrive.`);
      setTestOpen(false);
    },
    onError: (error) => toast('error', error.message || 'Could not send the test email.'),
  });

  const archive = useMutation({
    mutationFn: () => archiveEmailTemplate(savedId ?? '', tenantId ?? undefined),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      toast('success', 'Template archived.');
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  const canSave = Boolean(form.name && form.subject && form.htmlBody);

  if (previewing) {
    return (
      <EmailPreviewPage
        eyebrow="Template preview"
        title={form.name || 'Untitled template'}
        subject={form.subject}
        recipient={<span className="font-mono">{'{{brand.name}} · to {{customer.email}}'}</span>}
        htmlBody={form.htmlBody}
        textBody={form.textBody}
        note={
          <>
            Variables like <span className="font-mono">{'{{customer.firstName}}'}</span> are filled in when the email is sent.
          </>
        }
        actions={
          <Button type="button" variant="outline" onClick={() => setTestOpen(true)} className="gap-2">
            <Send size={15} /> Send test
          </Button>
        }
        onClose={() => setPreviewing(false)}
      />
    );
  }

  return (
    <EditorShell
      eyebrow="Email template"
      title={template ? template.name : form.name || 'New template'}
      onClose={onClose}
      dirty={dirty && !save.isPending}
      discardMessage="This template has changes that have not been saved. Leaving now discards them."
      actions={
        <>
          <Button type="button" variant="outline" onClick={() => setPreviewing(true)} className="h-11 gap-2 px-3 sm:px-4">
            <Eye size={16} />
            <span className="hidden sm:inline">Preview</span>
          </Button>
          <Button type="button" variant="outline" onClick={() => setTestOpen(true)} disabled={!canSave} className="h-11 gap-2 px-3 sm:px-4">
            <Send size={16} />
            <span className="hidden sm:inline">Send test</span>
          </Button>
          <Button type="submit" form={FORM_ID} disabled={!canSave || save.isPending} className="h-11 gap-2 px-6">
            {save.isPending && <Loader2 size={15} className="animate-spin" />}
            {save.isPending ? 'Saving…' : template ? 'Save' : 'Create'}
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
        className="grid items-start gap-6 lg:grid-cols-[1fr_20rem]"
      >
        <div className="min-w-0 space-y-4">
          {/* Basics */}
          <section className={panelClass}>
            <p className={labelClass}>Basics</p>
            <div className="mt-3 space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Input
                  label="Template name"
                  value={form.name}
                  onChange={(event) => update('name', event.target.value)}
                  required
                  autoFocus
                  hint="Only your team sees this."
                />
                <div className="flex w-full flex-col gap-1.5">
                  <label htmlFor="template-category" className="block text-xs font-bold tracking-widest text-muted-foreground">
                    Category
                  </label>
                  <CategoryCombobox
                    id="template-category"
                    value={form.category}
                    onChange={(value) => update('category', value)}
                    categories={categories}
                    allowEmpty={false}
                    placeholder="orders, birthday…"
                  />
                  <p className="text-xs text-muted-foreground">Groups templates in lists.</p>
                </div>
              </div>
              <Input
                label="Subject line"
                value={form.subject}
                onChange={(event) => update('subject', event.target.value)}
                required
                hint="What the customer sees in their inbox. Variables work here too."
                {...bind((value) => update('subject', value))}
              />
            </div>
          </section>

          {/* Body */}
          <section className={panelClass}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={labelClass}>Email content</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {mode === 'simple'
                    ? 'Build the email from blocks — we turn it into a tidy, mobile-friendly design.'
                    : 'Full control over the markup. Inline styles work best across email clients.'}
                </p>
              </div>
              <SegmentedControl
                options={MODE_OPTIONS}
                value={mode}
                onChange={(next) => {
                  if (next === 'simple' && !readSimpleBody(form.htmlBody)) {
                    setConfirmImport(true);
                    return;
                  }
                  if (next === 'simple') setBlocks(readSimpleBody(form.htmlBody) ?? blocks);
                  setMode(next);
                }}
              />
            </div>

            {mode === 'simple' ? (
              <div className="mt-4 space-y-3">
                {blocks.map((block, index) => (
                  <BlockCard
                    key={index}
                    block={block}
                    index={index}
                    total={blocks.length}
                    bind={bind}
                    onChange={(next) => applyBlocks(blocks.map((item, position) => (position === index ? next : item)))}
                    onMove={(direction) => {
                      const target = index + direction;
                      if (target < 0 || target >= blocks.length) return;
                      const next = [...blocks];
                      [next[index], next[target]] = [next[target], next[index]];
                      applyBlocks(next);
                    }}
                    onRemove={() => applyBlocks(blocks.filter((_, position) => position !== index))}
                  />
                ))}

                <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border p-3">
                  <span className="text-xs font-semibold text-muted-foreground">Add</span>
                  {(Object.keys(BLOCK_LABELS) as SimpleBlock['type'][]).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => applyBlocks([...blocks, newBlock(type)])}
                    >
                      <Plus size={14} /> {BLOCK_LABELS[type]}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">A plain-text version for older email apps is written for you automatically.</p>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="template-html" className={labelClass}>
                    HTML body
                  </label>
                  <textarea
                    id="template-html"
                    className={`${textareaClass} min-h-104 font-mono text-xs`}
                    value={form.htmlBody}
                    onChange={(event) => update('htmlBody', event.target.value)}
                    {...bind((value) => update('htmlBody', value))}
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="template-text" className={labelClass}>
                    Plain-text fallback
                  </label>
                  <textarea
                    id="template-text"
                    className={`${textareaClass} min-h-24`}
                    value={form.textBody ?? ''}
                    onChange={(event) => update('textBody', event.target.value)}
                    placeholder="Optional — generated from the HTML when left empty"
                    {...bind((value) => update('textBody', value))}
                  />
                </div>
              </div>
            )}
          </section>

          {/* Availability */}
          <section className={panelClass}>
            <label className="flex items-start gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => update('isActive', event.target.checked)}
                className="mt-0.5 size-4 rounded accent-primary"
              />
              <span>
                Ready to use
                <span className="block text-xs text-muted-foreground">
                  Active templates can be picked by automations and sent manually from a customer or order. Untick to park a draft.
                </span>
              </span>
            </label>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-5 lg:sticky lg:top-0">
          <div className={panelClass}>
            <p className={labelClass}>How templates work</p>
            <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-muted-foreground">
              <li>1. Write the email once, using variables for anything personal.</li>
              <li>2. Preview it, then send yourself a test.</li>
              <li>3. Connect it to an automation, or send it by hand from a customer.</li>
            </ol>
            <Button type="button" variant="outline" size="sm" className="mt-3 w-full gap-2" onClick={() => setPreviewing(true)}>
              <Eye size={15} /> Open full preview
            </Button>
          </div>

          <VariablePalette variables={variables} onInsert={insert} />

          {savedId && (
            <div className={panelClass}>
              <p className={labelClass}>Where it is used</p>
              {usedBy.length ? (
                <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                  {usedBy.map((automation) => (
                    <li key={automation.id}>
                      {automation.name}
                      {automation.isEnabled ? '' : ' (off)'}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs text-muted-foreground">No automation uses this template yet.</p>
              )}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-3 w-full gap-2 text-destructive hover:text-destructive"
                onClick={() => setArchiving(true)}
              >
                <Archive size={15} /> Archive template
              </Button>
            </div>
          )}
        </aside>
      </form>

      {/* Switching to simple mode from hand-written HTML */}
      {confirmImport && (
        <ConfirmModal
          title="Switch to simple mode?"
          message="Your custom HTML layout will be replaced by blocks built from its text. Styling and images will be lost."
          confirmLabel="Import as blocks"
          pendingLabel="Importing…"
          onConfirm={() => {
            applyBlocks(htmlToBlocks(form.htmlBody));
            setMode('simple');
            setConfirmImport(false);
          }}
          onClose={() => setConfirmImport(false)}
        />
      )}

      {/* Archive */}
      {archiving && (
        <ConfirmModal
          title="Archive this template?"
          message={
            <>
              Archived templates stop sending and cannot be picked by automations. Emails already sent stay in History.
              {usedBy.length > 0 && (
                <span className="mt-2 block font-medium text-destructive">
                  {usedBy.length} automation{usedBy.length === 1 ? '' : 's'} still use it: {usedBy.map((item) => item.name).join(', ')}.
                </span>
              )}
            </>
          }
          confirmLabel="Archive"
          pendingLabel="Archiving…"
          isPending={archive.isPending}
          onConfirm={() => archive.mutate()}
          onClose={() => setArchiving(false)}
        />
      )}

      {/* Test send */}
      {testOpen && (
        <Modal title="Send a test email" onClose={() => setTestOpen(false)} className="max-w-lg">
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We save your changes first, then send this template to one address so you can see it in a real inbox.
            </p>
            {!emailReady && (
              <div className="flex items-start gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3">
                <TriangleAlert size={15} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
                <div className="text-xs text-warning">
                  Email sending is not set up and verified yet, so this test will not arrive.
                  {onOpenConnection && (
                    <button type="button" onClick={onOpenConnection} className="ml-1 font-semibold underline">
                      Set up email
                    </button>
                  )}
                </div>
              </div>
            )}
            <Input
              label="Send to"
              type="email"
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="you@example.com"
              hint="Customer and order variables have no data in a test, so they arrive blank."
            />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTestOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={!testEmail.includes('@') || !canSave || sendTest.isPending}
                onClick={() => sendTest.mutate()}
                className="gap-2"
              >
                {sendTest.isPending && <Loader2 size={15} className="animate-spin" />}
                {sendTest.isPending ? 'Sending…' : 'Save and send'}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </EditorShell>
  );
}

/** One content block in simple mode. */
function BlockCard({
  block,
  index,
  total,
  bind,
  onChange,
  onMove,
  onRemove,
}: {
  block: SimpleBlock;
  index: number;
  total: number;
  bind: (setValue: (value: string) => void) => { onFocus: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => void };
  onChange: (block: SimpleBlock) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{BLOCK_LABELS[block.type]}</span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === 0}
            onClick={() => onMove(-1)}
            aria-label={`Move ${BLOCK_LABELS[block.type]} up`}
          >
            <ChevronUp size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
            aria-label={`Move ${BLOCK_LABELS[block.type]} down`}
          >
            <ChevronDown size={15} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onRemove}
            aria-label={`Remove ${BLOCK_LABELS[block.type]}`}
            className="text-muted-foreground/60 hover:text-destructive"
          >
            <Trash2 size={15} />
          </Button>
        </div>
      </div>

      {block.type === 'heading' && (
        <input
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
          placeholder="Hello {{customer.firstName}},"
          aria-label="Heading text"
          className="mt-2 w-full rounded-lg border border-transparent bg-surface-offset px-3 py-2 text-base font-semibold outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          {...bind((value) => onChange({ ...block, text: value }))}
        />
      )}

      {block.type === 'text' && (
        <textarea
          value={block.text}
          onChange={(event) => onChange({ ...block, text: event.target.value })}
          placeholder="Write your message…"
          aria-label="Paragraph text"
          className={`${textareaClass} mt-2 min-h-24`}
          {...bind((value) => onChange({ ...block, text: value }))}
        />
      )}

      {block.type === 'button' && (
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Input
            label="Button label"
            value={block.text}
            onChange={(event) => onChange({ ...block, text: event.target.value })}
            {...bind((value) => onChange({ ...block, text: value }))}
          />
          <Input
            label="Links to"
            type="url"
            value={block.url}
            onChange={(event) => onChange({ ...block, url: event.target.value })}
            placeholder="https://your-site.com/menu"
          />
        </div>
      )}

      {block.type === 'divider' && <p className="mt-2 text-xs text-muted-foreground">A thin line to separate sections.</p>}
    </div>
  );
}
