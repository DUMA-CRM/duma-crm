'use client';

import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Globe,
  Hash,
  History,
  Layers,
  Link2,
  MessageSquarePlus,
  RotateCcw,
  Search,
  Send,
  Trash2,
  Undo,
  Users,
  X,
} from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { SaveBar } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { Modal } from '@/components/shared/Modal';
import { RelativeTime } from '@/components/shared/RelativeTime';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { CopyButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import {
  type CmsEntry,
  archiveCmsEntry,
  clearCmsReview,
  createCmsEntry,
  deleteCmsEntry,
  duplicateCmsEntry,
  getCmsEntry,
  getCmsEntryVersion,
  getCmsEntryVersions,
  getCmsLocales,
  publishCmsEntry,
  requestCmsChanges,
  requestCmsReview,
  restoreCmsEntry,
  restoreCmsEntryVersion,
  saveCmsEntry,
  scheduleCmsEntry,
  unpublishCmsEntry,
} from '@/lib/modules/cms/client';
import { toast } from '@/lib/toast';
import {
  cleanEntryData,
  entryStatusMeta,
  issuesByField,
  lastTextChange,
  previewUrlFor,
  requiredMissing,
  sameEntryData,
  savedMessage,
  translationDrift,
} from '@/lib/utils/cms';
import { draftStorageKey, parseStoredDraft, recoveryFor } from '@/lib/utils/cms-draft';
import { SEO_FIELD_KEY } from '@/lib/utils/cms-seo';
import { cn } from '@/lib/utils/cn';
import { formatInstant, resolvedTimeZone, workspaceDateKey } from '@/lib/utils/workspace-time';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { AssistSection } from './AssistSection';
import { DateTimeField } from './DateTimeField';
import { FieldSet } from './FieldInput';
import { FieldRows } from './FieldRows';
import { SeoFieldRows } from './SeoFieldRows';
import { SeoPanel, SharePreviewDialog, goToField, useSeoChecks } from './SeoPanel';
import { ActionRow, ActionRows, InfoRow, InfoRows, RowMenu, type RowMenuItem, RowTile, SectionInfo } from './rows';
import { EntryStatusBadge, PanelError, TEXTAREA_CLASS, cmsKeys, copyText, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

type Issue = { field: string; message: string };

export function EntryEditor({
  entryId,
  onClose,
  onOpenEntry,
  onOpenModel,
}: {
  entryId: string;
  onClose: () => void;
  onOpenEntry: (id: string) => void;
  onOpenModel: (id: string) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // Bumped by Discard: remounting the form is the simplest exact reset.
  const [resetCount, setResetCount] = useState(0);
  const entryQuery = useQuery({
    queryKey: cmsKeys.entry(entryId),
    queryFn: () => getCmsEntry(entryId, tenantId ?? undefined),
    enabled: !!tenantId,
  });

  if (entryQuery.isError) {
    const missing = entryQuery.error instanceof ApiError && entryQuery.error.status === 404;
    return (
      <EditorShell title={missing ? 'Entry not found' : 'Entry'} onClose={onClose} icon={<FileText size={20} aria-hidden="true" />}>
        {missing ? (
          <EmptyState
            className="flex-1"
            kind="gone"
            icon={FileText}
            title="This entry no longer exists"
            description="It may have been deleted, or it belongs to another workspace."
          />
        ) : (
          <PanelError title="The entry couldn’t be loaded" onRetry={() => void entryQuery.refetch()} />
        )}
      </EditorShell>
    );
  }
  if (entryQuery.isPending) {
    return (
      <EditorShell title="Loading entry" onClose={onClose} icon={<FileText size={20} aria-hidden="true" />}>
        <LoadingState label="Loading the entry" />
      </EditorShell>
    );
  }
  // Keyed on the version so a reload after someone else's save resets the form.
  return (
    <LoadedEntryEditor
      key={`${entryQuery.data.id}:${entryQuery.data.version}:${resetCount}`}
      entry={entryQuery.data}
      onClose={onClose}
      onOpenEntry={onOpenEntry}
      onOpenModel={onOpenModel}
      onDiscard={() => setResetCount((count) => count + 1)}
    />
  );
}

function LoadedEntryEditor({
  entry,
  onClose,
  onOpenEntry,
  onOpenModel,
  onDiscard,
}: {
  entry: CmsEntry;
  onClose: () => void;
  onOpenEntry: (id: string) => void;
  onOpenModel: (id: string) => void;
  onDiscard: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const reduceMotion = useReducedMotion();
  const type = entry.contentType;
  const fields = type.fields;
  const archived = entry.status === 'archived';
  const editable = access.canWrite && !archived;

  const [data, setData] = useState<Record<string, unknown>>(entry.draftData);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [confirm, setConfirm] = useState<null | { kind: 'delete' | 'force-delete' | 'archive' | 'unpublish'; message?: string }>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [focusKeyword, setFocusKeyword] = useState('');
  // Bumped by a Fix in Search & sharing; Ask DUMA runs Fill SEO so the mascot shows it working.
  const [fillSeoRequest, setFillSeoRequest] = useState(0);
  // The SEO block lives in its own folded section below Content.
  const seoField = fields.find((field) => field.key === SEO_FIELD_KEY && field.type === 'group');
  const contentFields = seoField ? fields.filter((field) => field !== seoField) : fields;
  const [seoOpen, setSeoOpen] = useState(false);
  // Which SEO row is open — here, so a Fix in Search & sharing can open the right one.
  const [seoRow, setSeoRow] = useState<string | null>(null);
  // The open Content row; a failed save opens the first field it names.
  const [contentRow, setContentRow] = useState<string | null>(null);
  const headlineField = type.titleField ? contentFields.find((field) => field.key === type.titleField && field.type === 'text') : undefined;
  const rowFields = headlineField ? contentFields.filter((field) => field !== headlineField) : contentFields;
  const seoData = (
    data[SEO_FIELD_KEY] && typeof data[SEO_FIELD_KEY] === 'object' && !Array.isArray(data[SEO_FIELD_KEY]) ? data[SEO_FIELD_KEY] : {}
  ) as Record<string, unknown>;
  // The same checks the Search & sharing panel shows — one calculation, so the badge and the panel agree.
  const { checks: seoChecks, snapshot: seoView } = useSeoChecks(fields, type.titleField, data, focusKeyword);
  const seoSummary = (() => {
    if (!seoField) return null;
    const seo = (data[SEO_FIELD_KEY] && typeof data[SEO_FIELD_KEY] === 'object' ? data[SEO_FIELD_KEY] : {}) as Record<string, unknown>;
    const empty = (seoField.fields ?? []).filter(
      (sub) => sub.type !== 'boolean' && (seo[sub.key] === undefined || seo[sub.key] === null || seo[sub.key] === ''),
    ).length;
    return { passed: seoChecks.filter((check) => check.ok).length, total: seoChecks.length, empty };
  })();
  // What each blank SEO field falls back to — the same reading the checks and the previews use.
  const seoPlaceholders = seoField
    ? {
        metaTitle: seoView.title,
        metaDescription: seoView.description,
        socialTitle: seoView.title,
        socialDescription: seoView.description,
      }
    : undefined;
  // What still stands between this draft and publishing, counted as you type.
  const missing = requiredMissing(contentFields, data);
  const requiredCount = contentFields.filter((field) => field.required && field.type !== 'boolean').length;
  const dirty = !sameEntryData(fields, data, entry.draftData);
  const draftKey = draftStorageKey(entry.id);
  const [reviewDialog, setReviewDialog] = useState<null | 'submit' | 'changes'>(null);
  // A language version opened from the Status card while edits are unsaved — waiting for the confirm.
  const [leavingFor, setLeavingFor] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState('');

  // Unsaved edits kept on this device come straight back on reload — they show
  // as ordinary unsaved changes (Save or Discard). Read after mount: storage is
  // per device and absent on the server render.
  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = window.localStorage.getItem(draftKey);
    } catch {
      return;
    }
    const found = recoveryFor(parseStoredDraft(raw), entry, (a, b) => sameEntryData(fields, a, b));
    if (found.kind !== 'offer') return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one read of device storage after mount
    setData(found.draft.data);
    if (found.outdated) {
      // Restoring is still right — they are your words — but saving now would replace a newer save.
      toast(
        'info',
        'Your unsaved edits are back, but someone saved this entry since. Saving replaces their changes; Discard shows theirs.',
      );
    }
  }, [draftKey, entry, fields]);

  // Mirror unsaved edits to this device as you type (debounced). Saving or discarding clears it.
  useEffect(() => {
    if (!dirty) return;
    const timer = setTimeout(() => {
      try {
        window.localStorage.setItem(draftKey, JSON.stringify({ data, baseVersion: entry.version, savedAt: new Date().toISOString() }));
      } catch {
        // Storage full or blocked: recovery is a convenience, the save button is the record.
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [data, dirty, draftKey, entry.version]);
  const forgetDraft = () => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Nothing to forget.
    }
  };
  const issueMap = useMemo(() => issuesByField(issues), [issues]);
  // An error inside the SEO fields must never be hidden by the fold.
  const seoShown = seoOpen || issueMap.has(SEO_FIELD_KEY);
  const otherLanguages = (entry.localizations ?? []).filter((version) => version.id !== entry.id).length;

  const fail = (error: Error) => {
    if (error instanceof ApiError && error.issues.length > 0) {
      setIssues(error.issues);
      const first = error.issues.map((issue) => issue.field.split(/[.[]/)[0]).find((key) => rowFields.some((field) => field.key === key));
      if (first) setContentRow(first);
    }
    toast('error', error.message);
  };

  const save = useMutation({
    mutationFn: () => saveCmsEntry(entry.id, cleanEntryData(fields, data), entry.version, tenantId),
    onSuccess: (saved) => {
      forgetDraft();
      setIssues([]);
      invalidateCms(queryClient);
      toast('success', savedMessage('Draft saved.', saved.sharedLocales));
    },
    onError: fail,
  });

  // Publishing always publishes what is on screen: unsaved edits are saved
  // first, so "Publish" can never ship an older draft than the one you see.
  const publish = useMutation({
    mutationFn: async () => {
      const saved = dirty ? await saveCmsEntry(entry.id, cleanEntryData(fields, data), entry.version, tenantId) : null;
      await publishCmsEntry(entry.id, tenantId);
      return saved?.sharedLocales;
    },
    onSuccess: (sharedLocales) => {
      forgetDraft();
      setIssues([]);
      invalidateCms(queryClient);
      toast(
        'success',
        savedMessage(`Published${otherLanguages > 0 ? ` in ${entry.locale}` : ''}. It is live on the delivery API.`, sharedLocales),
      );
    },
    onError: (error) => {
      // A failed publish after a successful save still changed the draft.
      invalidateCms(queryClient);
      fail(error);
    },
  });

  const review = useMutation({
    mutationFn: async (kind: 'submit' | 'changes' | 'clear') => {
      if (kind === 'submit') {
        // Submit what is on screen, as publishing does.
        if (dirty) await saveCmsEntry(entry.id, cleanEntryData(fields, data), entry.version, tenantId);
        return requestCmsReview(entry.id, reviewNote.trim() || undefined, tenantId);
      }
      if (kind === 'changes') return requestCmsChanges(entry.id, reviewNote.trim(), tenantId);
      return clearCmsReview(entry.id, tenantId);
    },
    onSuccess: (_, kind) => {
      if (kind === 'submit') forgetDraft();
      setReviewDialog(null);
      setReviewNote('');
      invalidateCms(queryClient);
      toast('success', kind === 'submit' ? 'Sent for review.' : kind === 'changes' ? 'Sent back with your note.' : 'Review cleared.');
    },
    onError: fail,
  });

  const action = useMutation({
    mutationFn: async (kind: 'unpublish' | 'archive' | 'restore' | 'duplicate') => {
      if (kind === 'unpublish') return unpublishCmsEntry(entry.id, tenantId);
      if (kind === 'archive') return archiveCmsEntry(entry.id, tenantId);
      if (kind === 'restore') return restoreCmsEntry(entry.id, tenantId);
      return duplicateCmsEntry(entry.id, tenantId);
    },
    onSuccess: (result, kind) => {
      setConfirm(null);
      invalidateCms(queryClient);
      if (kind === 'duplicate') {
        toast('success', 'Copy created — opening it now.');
        onOpenEntry(result.id);
        return;
      }
      toast('success', kind === 'unpublish' ? 'Unpublished.' : kind === 'archive' ? 'Archived.' : 'Restored to draft.');
    },
    onError: (error) => {
      setConfirm(null);
      fail(error);
    },
  });

  const remove = useMutation({
    mutationFn: (force: boolean) => deleteCmsEntry(entry.id, force, tenantId),
    onSuccess: () => {
      setConfirm(null);
      invalidateCms(queryClient);
      const sibling = (entry.localizations ?? []).find((version) => version.id !== entry.id);
      toast('success', sibling ? `${entry.locale} version deleted.` : 'Entry deleted.');
      // Deleting one language keeps you on the entry, in another language.
      if (sibling) onOpenEntry(sibling.id);
      else onClose();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setConfirm({ kind: 'force-delete', message: `${error.message}. Deleting it leaves those links empty on your website.` });
        return;
      }
      setConfirm(null);
      fail(error);
    },
  });

  const previewUrl = previewUrlFor(type.previewUrl, { slug: entry.slug, documentId: entry.documentId, locale: entry.locale, id: entry.id });
  const busy = save.isPending || publish.isPending || action.isPending;
  const title =
    (type.titleField && typeof data[type.titleField] === 'string' && (data[type.titleField] as string)) || entry.title || 'Untitled';
  const canPublishNow = access.canPublish && !archived && entry.status !== 'published';
  const saveShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘S' : 'Ctrl+S';

  /** Everything else about the entry — Contentful's ⋯ pattern — so the sidebar keeps to what it is and where it stands. */
  const entryActions: RowMenuItem[] = [
    ...(access.canWrite && !archived ? [{ icon: Link2, label: 'Share draft preview', onClick: () => setSharing(true) }] : []),
    ...(access.canWrite && type.kind === 'collection'
      ? [{ icon: Copy, label: 'Duplicate', disabled: busy, onClick: () => action.mutate('duplicate') }]
      : []),
    ...(access.canPublish && entry.publishedData
      ? [{ icon: EyeOff, label: 'Unpublish', disabled: busy, onClick: () => setConfirm({ kind: 'unpublish' }) }]
      : []),
    ...(access.canPublish && !archived
      ? [{ icon: Archive, label: 'Archive', disabled: busy, onClick: () => setConfirm({ kind: 'archive' }) }]
      : []),
    ...(access.canWrite && archived
      ? [{ icon: RotateCcw, label: 'Restore to draft', disabled: busy, onClick: () => action.mutate('restore') }]
      : []),
    ...(access.canModel ? [{ icon: Layers, label: `Edit the ${type.name} model`, onClick: () => onOpenModel(type.id) }] : []),
    ...(access.canPublish
      ? [
          {
            icon: Trash2,
            label: otherLanguages > 0 ? `Delete the ${entry.locale} version` : 'Delete entry',
            danger: true,
            disabled: busy,
            onClick: () => setConfirm({ kind: 'delete' }),
          },
        ]
      : []),
  ];

  // ⌘S / Ctrl+S saves the draft, as the SaveBar's Save draft does.
  useEffect(() => {
    if (!editable) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (dirty && !save.isPending && !publish.isPending) save.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, dirty, save, publish.isPending]);

  return (
    <EditorShell
      eyebrow={type.name}
      title={title}
      icon={<FileText size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty}
      meta={
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <EntryStatusBadge status={entry.status} />
          <span>v{entry.version}</span>
        </span>
      }
      actions={
        <div className="flex items-center gap-2">
          <LanguageSwitcher entry={entry} dirty={dirty} onOpenEntry={onOpenEntry} />
          {previewUrl && (
            <Button asChild variant="ghost" size="sm" className="gap-1.5">
              <a href={previewUrl} target="_blank" rel="noopener noreferrer">
                <Eye aria-hidden="true" /> <span className="hidden md:inline">Preview</span>
              </a>
            </Button>
          )}
          {!dirty && access.canWrite && !access.canPublish && !archived && !entry.reviewRequestedAt && entry.status !== 'published' && (
            <Button className="h-9 gap-1.5" disabled={busy || review.isPending} onClick={() => setReviewDialog('submit')}>
              <Users aria-hidden="true" /> Submit for review
            </Button>
          )}
          {!dirty && canPublishNow && (
            <Button className="h-9 gap-1.5" disabled={busy} onClick={() => publish.mutate()}>
              <Send aria-hidden="true" />
              {publish.isPending ? 'Publishing…' : entry.status === 'draft' ? 'Publish' : 'Publish changes'}
            </Button>
          )}
          {/* Everything else about the entry, one place — the sidebar keeps to what it is and where it stands. */}
          {entryActions.length > 0 && <RowMenu label="Entry actions" pending={action.isPending} items={entryActions} />}
        </div>
      }
    >
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
      >
        <SettingsTabBody
          narrowAside
          aside={
            <>
              <StatusSection
                entry={entry}
                onHistory={() => setHistoryOpen(true)}
                // Another language: through the same "Leave without saving?" as the language switcher.
                onOpenVersion={(id) => (dirty ? setLeavingFor(id) : onOpenEntry(id))}
              />
              {(entry.reviewRequestedAt || entry.reviewNote) && (
                <SettingsSection title="Review">
                  <ReviewState entry={entry} />
                  <div className="mt-3">
                    <ActionRows>
                      {entry.reviewRequestedAt && access.canPublish && (
                        <ActionRow
                          icon={MessageSquarePlus}
                          label="Request changes"
                          disabled={review.isPending}
                          onClick={() => setReviewDialog('changes')}
                        />
                      )}
                      <ActionRow
                        icon={entry.reviewRequestedAt ? Undo : X}
                        label={entry.reviewRequestedAt ? 'Withdraw request' : 'Dismiss note'}
                        disabled={review.isPending}
                        onClick={() => review.mutate('clear')}
                      />
                    </ActionRows>
                  </div>
                </SettingsSection>
              )}
              {access.canPublish && !archived && (
                <ScheduleSection key={`${entry.scheduledPublishAt}|${entry.scheduledUnpublishAt}`} entry={entry} />
              )}
              {seoField && (
                <SeoPanel
                  fields={fields}
                  titleField={type.titleField}
                  data={data}
                  pageUrl={previewUrl}
                  keyword={focusKeyword}
                  canModel={access.canModel}
                  canFix={editable}
                  onOpenModel={() => onOpenModel(type.id)}
                  onFillSeo={() => setFillSeoRequest((count) => count + 1)}
                  onRevealField={(key) => {
                    setSeoOpen(true);
                    setSeoRow(key);
                    // After the section and the row have opened and rendered the field.
                    requestAnimationFrame(() => requestAnimationFrame(() => goToField(key)));
                  }}
                />
              )}
              {editable && fields.length > 0 && (
                <SettingsSection title="Ask DUMA">
                  <AssistSection
                    entry={entry}
                    fields={fields}
                    titleField={type.titleField}
                    data={data}
                    pageUrl={previewUrl}
                    onChange={setData}
                    onKeyword={setFocusKeyword}
                    fillSeoRequest={fillSeoRequest}
                  />
                </SettingsSection>
              )}
            </>
          }
        >
          {archived && (
            <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              This entry is archived and read-only. Restore it from the ⋯ menu to edit or publish again.
            </p>
          )}
          {issues.length > 0 && (
            <p role="alert" className="flex items-start gap-2 rounded-md bg-exception/6 px-3 py-2 text-xs font-medium text-exception">
              <AlertCircle size={14} className="mt-px shrink-0" aria-hidden="true" />
              <span>
                {issues.length === 1 ? 'One field needs attention' : `${issues.length} fields need attention`} before this can be saved or
                published — each is marked below.
              </span>
            </p>
          )}
          {fields.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="This content type has no fields"
              description="Add fields to the model to start writing."
              action={access.canModel ? { label: 'Open the model', onClick: () => onOpenModel(type.id) } : undefined}
            />
          ) : (
            <>
              <SettingsSection
                title="Content"
                description={type.description ?? undefined}
                actions={
                  editable && requiredCount > 0 ? (
                    missing.length > 0 ? (
                      <Tooltip side="top" align="end" wrap label={`Still empty: ${missing.map((field) => field.label).join(', ')}`}>
                        <Badge variant="warning">{missing.length} required left</Badge>
                      </Tooltip>
                    ) : (
                      <Badge variant="success">Required filled</Badge>
                    )
                  ) : undefined
                }
              >
                {/* The title stays the page's headline, typed in place; every other field is a row, as in SEO & sharing. */}
                {headlineField && (
                  <div className="mb-5">
                    <FieldSet
                      fields={[headlineField]}
                      value={data}
                      onChange={setData}
                      issues={issueMap}
                      disabled={!editable}
                      locale={entry.locale}
                      headlineKey={headlineField.key}
                    />
                  </div>
                )}
                <FieldRows
                  fields={rowFields}
                  value={data}
                  onChange={setData}
                  issues={issueMap}
                  disabled={!editable}
                  locale={entry.locale}
                  open={contentRow}
                  onOpenChange={setContentRow}
                  otherLanguages={otherLanguages}
                />
              </SettingsSection>
              {seoField && (
                // Metadata, not writing: folded under the content, summarised in its header.
                <SettingsSection
                  title="SEO & sharing"
                  icon={Search}
                  // Folded, the header is the whole card: title and controls on one centred line, equal space above and below.
                  alignActionsToTitle
                  bodyClassName={seoShown ? undefined : 'hidden'}
                  className={seoShown ? undefined : 'pb-5'}
                  actions={
                    <div className="flex items-center gap-2">
                      {seoSummary && (
                        <Tooltip
                          side="top"
                          align="end"
                          wrap
                          label={`${seoSummary.passed} of ${seoSummary.total} search checks pass${seoSummary.empty > 0 ? `; ${seoSummary.empty} fields are empty and use the entry’s own text` : ''}. Details in Search & sharing.`}
                        >
                          <Badge variant={seoSummary.passed === seoSummary.total ? 'success' : 'warning'}>
                            {seoSummary.passed}/{seoSummary.total} checks
                          </Badge>
                        </Tooltip>
                      )}
                      <Button size="sm" variant="ghost" className="gap-1" aria-expanded={seoShown} onClick={() => setSeoOpen(!seoShown)}>
                        {seoShown ? 'Hide fields' : 'Edit'}
                        <ChevronDown size={14} className={cn('transition-transform', seoShown && 'rotate-180')} aria-hidden="true" />
                      </Button>
                    </div>
                  }
                >
                  {/* The group's own fields, straight in the section — its title is this section's title. */}
                  {issueMap.get(SEO_FIELD_KEY)?.length ? (
                    <ul role="alert" className="mb-4 space-y-0.5 rounded-md bg-exception/6 px-3 py-2 text-xs font-medium text-exception">
                      {issueMap.get(SEO_FIELD_KEY)!.map((issue) => (
                        <li key={issue}>{issue}</li>
                      ))}
                    </ul>
                  ) : null}
                  {/* Rows as on the settings pages: value in words (or its fallback, muted), tap to edit. */}
                  <SeoFieldRows
                    fields={seoField.fields ?? []}
                    value={seoData}
                    onChange={(next) => setData({ ...data, [SEO_FIELD_KEY]: next })}
                    disabled={!editable}
                    locale={entry.locale}
                    placeholders={seoPlaceholders}
                    open={seoRow}
                    onOpenChange={setSeoRow}
                  />
                </SettingsSection>
              )}
            </>
          )}

          {editable && (
            <SaveBar
              dirty={dirty}
              saving={save.isPending}
              saveLabel="Save draft"
              disabled={busy}
              message={`Unsaved changes${otherLanguages > 0 ? ` in ${entry.locale}` : ''} · ${saveShortcut} saves`}
              onSave={() => save.mutate()}
              onDiscard={() => {
                // Forget the kept copy too, or the next load would bring the edits back.
                forgetDraft();
                onDiscard();
              }}
              extra={
                access.canPublish ? (
                  <Button className="gap-1.5" disabled={busy} onClick={() => publish.mutate()}>
                    <Send aria-hidden="true" />
                    {publish.isPending ? 'Publishing…' : 'Save & publish'}
                  </Button>
                ) : !entry.reviewRequestedAt ? (
                  <Button className="gap-1.5" disabled={busy || review.isPending} onClick={() => setReviewDialog('submit')}>
                    <Users aria-hidden="true" /> Save & submit
                  </Button>
                ) : undefined
              }
            />
          )}
        </SettingsTabBody>
      </motion.div>

      {sharing && <SharePreviewDialog entryId={entry.id} onClose={() => setSharing(false)} />}
      {historyOpen && (
        <HistoryDrawer
          entry={entry}
          canRestore={editable}
          onClose={() => setHistoryOpen(false)}
          onRestored={() => {
            setHistoryOpen(false);
            invalidateCms(queryClient);
            toast('success', 'Version restored into the draft. Publish to make it live.');
          }}
        />
      )}

      {reviewDialog && (
        <Modal
          title={reviewDialog === 'submit' ? 'Submit for review' : 'Request changes'}
          description={
            reviewDialog === 'submit'
              ? 'Someone who can publish will see it waiting. Your edits are saved first.'
              : 'It goes back to the writer with your note. Publishing instead approves it.'
          }
          size="md"
          onClose={() => setReviewDialog(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setReviewDialog(null)}>
                Cancel
              </Button>
              <Button
                disabled={review.isPending || (reviewDialog === 'changes' && !reviewNote.trim())}
                onClick={() => review.mutate(reviewDialog)}
              >
                {review.isPending ? 'Sending…' : reviewDialog === 'submit' ? 'Submit' : 'Send back'}
              </Button>
            </div>
          }
        >
          <FieldLabel htmlFor="review-note">
            {reviewDialog === 'submit' ? 'Note for the reviewer (optional)' : 'What needs changing'}
          </FieldLabel>
          <textarea
            id="review-note"
            rows={4}
            maxLength={480}
            autoFocus
            className={cn(TEXTAREA_CLASS, 'mt-1')}
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
          />
        </Modal>
      )}
      {leavingFor && (
        <ConfirmModal
          title="Leave without saving?"
          message={`Your changes to the ${entry.locale} version have not been saved. Opening another language discards them.`}
          confirmLabel="Discard and open"
          pendingLabel="Opening…"
          onConfirm={() => {
            const id = leavingFor;
            setLeavingFor(null);
            forgetDraft();
            onOpenEntry(id);
          }}
          onClose={() => setLeavingFor(null)}
        />
      )}
      {confirm?.kind === 'unpublish' && (
        <ConfirmModal
          title={`Unpublish the ${entry.locale} version?`}
          message="It disappears from the delivery API straight away. The draft and its history are kept."
          confirmLabel="Unpublish"
          pendingLabel="Unpublishing…"
          isPending={action.isPending}
          onConfirm={() => action.mutate('unpublish')}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'archive' && (
        <ConfirmModal
          title={`Archive the ${entry.locale} version?`}
          message={
            entry.publishedData
              ? 'It is unpublished first, then hidden and made read-only. You can restore it later.'
              : 'It is hidden and made read-only. You can restore it later.'
          }
          confirmLabel="Archive"
          pendingLabel="Archiving…"
          isPending={action.isPending}
          onConfirm={() => action.mutate('archive')}
          onClose={() => setConfirm(null)}
        />
      )}
      {(confirm?.kind === 'delete' || confirm?.kind === 'force-delete') && (
        <ConfirmModal
          title={
            confirm.kind === 'force-delete'
              ? 'Other entries link here'
              : otherLanguages > 0
                ? `Delete the ${entry.locale} version?`
                : 'Delete this entry?'
          }
          message={
            confirm.message ??
            (otherLanguages > 0
              ? `Removes the ${entry.locale} text and its history. The entry stays, in its other ${otherLanguages === 1 ? 'language' : 'languages'}.`
              : 'This removes the entry and its history. If it is live, it disappears from your website. This cannot be undone.')
          }
          confirmLabel={confirm.kind === 'force-delete' ? 'Delete anyway' : 'Delete'}
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(confirm.kind === 'force-delete')}
          onClose={() => setConfirm(null)}
        />
      )}
    </EditorShell>
  );
}

// ─── Language ────────────────────────────────────────────────────────────────

const ADD_PREFIX = 'add:';

/**
 * One entry, many languages: each language is a version of the same entry,
 * switched here rather than listed separately. Missing languages can be added
 * in place — the new version starts as a copy of the default language.
 */
function LanguageSwitcher({ entry, dirty, onOpenEntry }: { entry: CmsEntry; dirty: boolean; onOpenEntry: (id: string) => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const [pending, setPending] = useState<string | null>(null);
  const localesQuery = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId,
  });
  const locales = localesQuery.data ?? [];
  const versions = new Map((entry.localizations ?? []).map((version) => [version.locale, version]));

  const translate = useMutation({
    mutationFn: (locale: string) =>
      createCmsEntry({ contentTypeId: entry.contentTypeId, documentId: entry.documentId, locale }, tenantId ?? undefined),
    onSuccess: (created) => {
      invalidateCms(queryClient);
      toast('success', `${created.locale} version created from the default language.`);
      onOpenEntry(created.id);
    },
    onError: (error) => toast('error', error.message),
  });

  const go = (value: string) => {
    if (value.startsWith(ADD_PREFIX)) translate.mutate(value.slice(ADD_PREFIX.length));
    else if (value !== entry.id) onOpenEntry(value);
  };

  // A single-language workspace has nothing to switch.
  if (locales.length <= 1) return null;

  const options = [
    ...locales
      .filter((locale) => versions.has(locale.code))
      .map((locale) => {
        const version = versions.get(locale.code)!;
        return { value: version.id, label: `${locale.name} · ${entryStatusMeta(version.status).label}` };
      }),
    ...(access.canWrite
      ? locales
          .filter((locale) => !versions.has(locale.code))
          .map((locale) => ({ value: `${ADD_PREFIX}${locale.code}`, label: `+ Add ${locale.name}` }))
      : []),
  ];

  return (
    <>
      <Select
        ariaLabel="Language"
        className={cn('h-9 w-52', translate.isPending && 'opacity-60')}
        disabled={translate.isPending}
        value={entry.id}
        onValueChange={(value) => (dirty ? setPending(value) : go(value))}
        options={options}
      />
      {pending && (
        <ConfirmModal
          title="Leave without saving?"
          message={`Your changes to the ${entry.locale} version have not been saved. Switching language discards them.`}
          confirmLabel="Discard and switch"
          pendingLabel="Switching…"
          onConfirm={() => {
            const value = pending;
            setPending(null);
            go(value);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}

// ─── Aside ───────────────────────────────────────────────────────────────────

function StatusSection({
  entry,
  onHistory,
  onOpenVersion,
}: {
  entry: CmsEntry;
  onHistory: () => void;
  onOpenVersion: (id: string) => void;
}) {
  const meta = entryStatusMeta(entry.status);
  return (
    <SettingsSection title="Status" actions={<EntryStatusBadge status={entry.status} />}>
      <p className="mb-3 text-xs text-muted-foreground">{meta.description}</p>
      <InfoRows>
        {entry.publishedAt && (
          <InfoRow icon={Globe} title="Published">
            <span className="text-sm text-foreground">
              <RelativeTime iso={entry.publishedAt} />
              {entry.publishedVersion !== null && <span className="tabular-nums text-muted-foreground"> · v{entry.publishedVersion}</span>}
            </span>
          </InfoRow>
        )}
        <InfoRow icon={Clock} title="Last saved">
          <span className="text-sm text-foreground">
            <RelativeTime iso={entry.updatedAt} />
            <span className="tabular-nums text-muted-foreground"> · v{entry.version}</span>
          </span>
        </InfoRow>
        {entry.slug && (
          <InfoRow icon={Link2} title="Slug">
            <Tooltip side="top" label={`/${entry.slug}`} className="min-w-0">
              <span className="max-w-36 truncate font-mono text-xs text-foreground">/{entry.slug}</span>
            </Tooltip>
          </InfoRow>
        )}
        <InfoRow icon={Hash} title="Entry ID">
          <Tooltip side="top" label={entry.documentId}>
            <span className="font-mono text-xs text-muted-foreground">{entry.documentId.slice(0, 8)}</span>
          </Tooltip>
          <CopyButton
            iconOnly
            size="icon-sm"
            label="Copy entry ID"
            copiedLabel="Entry ID copied"
            onCopy={async () => {
              const copied = await copyText(entry.documentId);
              if (!copied) toast('error', 'Copy failed — select the ID instead.');
              return copied;
            }}
          />
        </InfoRow>
      </InfoRows>
      <TranslationNotice entry={entry} onOpenVersion={onOpenVersion} />
      <div className="mt-3">
        <ActionRows>
          <ActionRow icon={History} label="Version history" onClick={onHistory} />
        </ActionRows>
      </div>
    </SettingsSection>
  );
}

/**
 * A small warning when this entry's languages have drifted apart: on the
 * default language, the translations whose text is older; on a translation,
 * when the default language changed after it. "Changed" is the last save or
 * restore in each version's history — publishing alone doesn't count.
 */
function TranslationNotice({ entry, onOpenVersion }: { entry: CmsEntry; onOpenVersion: (id: string) => void }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  const versions = entry.localizations ?? [];
  const several = versions.length > 1;
  const locales = useQuery({
    queryKey: cmsKeys.locales(tenantId),
    queryFn: () => getCmsLocales(tenantId ?? undefined),
    enabled: !!tenantId && several,
  });
  const histories = useQueries({
    queries: versions.map((version) => ({
      queryKey: cmsKeys.versions(version.id),
      queryFn: () => getCmsEntryVersions(version.id, tenantId ?? undefined),
      enabled: !!tenantId && several,
      select: lastTextChange,
    })),
  });
  if (!several) return null;
  const nameOf = (code: string) => locales.data?.find((locale) => locale.code === code)?.name ?? code;
  const defaultLocale = locales.data?.find((locale) => locale.isDefault)?.code ?? null;
  const drift = translationDrift(
    entry.id,
    versions.map((version, index) => ({ ...version, changedAt: histories[index]?.data ?? null })),
    defaultLocale,
  );
  if (!drift) return null;

  const link = (id: string, locale: string) => (
    <button key={id} type="button" className="underline underline-offset-2 hover:no-underline" onClick={() => onOpenVersion(id)}>
      Open {nameOf(locale)}
    </button>
  );
  return (
    <div className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured" role="status">
      <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
      <div className="min-w-0 space-y-1">
        {drift.kind === 'source-newer' ? (
          <>
            <p>{nameOf(drift.source.locale)} changed after this version was last edited — check this one is still current.</p>
            <p>{link(drift.source.id, drift.source.locale)}</p>
          </>
        ) : (
          <>
            <p>
              {drift.behind.map((version) => nameOf(version.locale)).join(', ')} {drift.behind.length === 1 ? 'was' : 'were'} last edited
              before this {nameOf(entry.locale)} version — {drift.behind.length === 1 ? 'it' : 'they'} may be out of date.
            </p>
            <p className="flex flex-wrap gap-x-3">{drift.behind.map((version) => link(version.id, version.locale))}</p>
          </>
        )}
      </div>
    </div>
  );
}

function ScheduleSection({ entry }: { entry: CmsEntry }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  // Keyed by the saved schedule (see the call site), so these reset when it changes.
  const [publishAt, setPublishAt] = useState(entry.scheduledPublishAt ?? '');
  const [unpublishAt, setUnpublishAt] = useState(entry.scheduledUnpublishAt ?? '');
  // Today and the times below are the business's — the workspace zone, wherever the editor is.
  const minDay = workspaceDateKey();
  const zoneHint = `Times are in ${resolvedTimeZone()}.`;

  const schedule = useMutation({
    mutationFn: () => scheduleCmsEntry(entry.id, { publishAt: publishAt || null, unpublishAt: unpublishAt || null }, tenantId),
    onSuccess: () => {
      invalidateCms(queryClient);
      toast('success', publishAt || unpublishAt ? 'Schedule saved.' : 'Schedule cleared.');
    },
    onError: (error) => toast('error', error.message),
  });
  const changed = publishAt !== (entry.scheduledPublishAt ?? '') || unpublishAt !== (entry.scheduledUnpublishAt ?? '');
  const order = publishAt && unpublishAt && new Date(unpublishAt) <= new Date(publishAt) ? 'Unpublish must come after publish' : undefined;

  return (
    <SettingsSection
      title="Schedule"
      actions={<SectionInfo label={`A scheduled publish uses the draft as it is saved at that moment. ${zoneHint}`} />}
    >
      <div className="space-y-4">
        <ScheduleRow icon={Send} title="Publish" value={publishAt} saved={entry.scheduledPublishAt} onClear={() => setPublishAt('')}>
          <DateTimeField
            label={<span className="sr-only">Publish at</span>}
            value={publishAt}
            min={minDay}
            hint={zoneHint}
            onChange={setPublishAt}
          />
        </ScheduleRow>
        <ScheduleRow
          icon={EyeOff}
          title="Unpublish"
          value={unpublishAt}
          saved={entry.scheduledUnpublishAt}
          onClear={() => setUnpublishAt('')}
          error={order}
        >
          <DateTimeField
            label={<span className="sr-only">Unpublish at</span>}
            value={unpublishAt}
            min={minDay}
            hint={zoneHint}
            onChange={setUnpublishAt}
            error={order}
          />
        </ScheduleRow>
        {changed && (
          <Button className="w-full" disabled={Boolean(order) || schedule.isPending} onClick={() => schedule.mutate()}>
            {schedule.isPending ? 'Saving…' : 'Save schedule'}
          </Button>
        )}
      </div>
    </SettingsSection>
  );
}

/**
 * One schedule line in the Status card's shape — outlined icon tile, title,
 * where it stands on the right — with its date and time underneath, since a
 * picker pair is too wide to sit beside the title in the aside.
 */
const scheduleLabel = (iso: string) => formatInstant(iso, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * One schedule line: the time (or "Not set") is the button that opens its
 * date and time pickers underneath — the card stays two quiet lines until
 * someone schedules something.
 */
function ScheduleRow({
  icon,
  title,
  value,
  saved,
  error,
  onClear,
  children,
}: {
  icon: IconComponent;
  title: string;
  /** The time as edited now; '' when none. */
  value: string;
  saved: string | null;
  error?: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  const changed = value !== (saved ?? '');
  // Open while editing: a change, or an error, keeps the pickers in view.
  const [open, setOpen] = useState(false);
  const expanded = open || changed || Boolean(error);
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        {/* The same outlined tile as the Status card's rows. */}
        <div className="flex min-w-0 items-center gap-3">
          <RowTile icon={icon} />
          <p className="text-sm font-semibold text-foreground">{title}</p>
        </div>
        <button
          type="button"
          aria-expanded={expanded}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-band/60',
            changed ? 'font-medium text-measured' : value ? 'font-medium text-foreground' : 'text-muted-foreground',
          )}
        >
          {value ? scheduleLabel(value) : 'Not set'}
          <ChevronDown size={14} className={cn('transition-transform', expanded && 'rotate-180')} aria-hidden="true" />
        </button>
      </div>
      {expanded && (
        <div className="mt-3 space-y-1.5">
          {children}
          {value && (
            <button type="button" className="text-xs font-medium text-muted-foreground hover:text-foreground" onClick={onClear}>
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────

const ACTION_LABEL = {
  saved: 'Saved',
  published: 'Published',
  unpublished: 'Unpublished',
  restored: 'Restored',
  archived: 'Archived',
} as const;

function HistoryDrawer({
  entry,
  canRestore,
  onClose,
  onRestored,
}: {
  entry: CmsEntry;
  canRestore: boolean;
  onClose: () => void;
  onRestored: () => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const [selected, setSelected] = useState<string | null>(null);
  const versionsQuery = useQuery({ queryKey: cmsKeys.versions(entry.id), queryFn: () => getCmsEntryVersions(entry.id, tenantId) });
  const snapshotQuery = useQuery({
    queryKey: [...cmsKeys.versions(entry.id), selected],
    queryFn: () => getCmsEntryVersion(entry.id, selected!, tenantId),
    enabled: !!selected,
  });
  const restore = useMutation({
    mutationFn: (versionId: string) => restoreCmsEntryVersion(entry.id, versionId, tenantId),
    onSuccess: onRestored,
    onError: (error) => toast('error', error.message),
  });

  return (
    <Drawer
      icon={History}
      title="Version history"
      description={`Every save, publish and restore of the ${entry.locale} version, newest first.`}
      onClose={onClose}
    >
      {versionsQuery.isError ? (
        <PanelError title="History couldn’t be loaded" onRetry={() => void versionsQuery.refetch()} />
      ) : versionsQuery.isPending ? (
        <LoadingState label="Loading history" compact />
      ) : (
        <ol className="space-y-2">
          {versionsQuery.data.map((version) => (
            <li key={version.id} className="rounded-lg border border-rule/50 bg-field">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left text-sm hover:bg-band/50"
                aria-expanded={selected === version.id}
                onClick={() => setSelected(selected === version.id ? null : version.id)}
              >
                <span>
                  <span className="font-semibold">{ACTION_LABEL[version.action]}</span>{' '}
                  <span className="text-muted-foreground">v{version.version}</span>
                </span>
                <RelativeTime iso={version.createdAt} className="text-xs text-muted-foreground" />
              </button>
              {selected === version.id && (
                <div className="border-t border-rule/40 p-3.5">
                  {snapshotQuery.isPending ? (
                    <LoadingState label="Loading snapshot" compact />
                  ) : (
                    <pre className="max-h-64 overflow-auto rounded-md bg-band/60 p-2.5 font-mono text-xs leading-5">
                      {JSON.stringify(snapshotQuery.data?.data ?? {}, null, 2)}
                    </pre>
                  )}
                  {canRestore && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2.5 gap-1.5"
                      disabled={restore.isPending}
                      onClick={() => restore.mutate(version.id)}
                    >
                      <RotateCcw aria-hidden="true" /> Restore into draft
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
    </Drawer>
  );
}

/** Where review stands: waiting (and since when), or sent back with a note. */
function ReviewState({ entry }: { entry: CmsEntry }) {
  if (entry.reviewRequestedAt) {
    return (
      <div className="flex items-start gap-3 rounded-lg border border-reference/40 bg-reference/6 px-3.5 py-3">
        <Users size={18} className="mt-0.5 shrink-0 text-reference" aria-hidden="true" />
        <div className="min-w-0 text-sm">
          <p className="font-semibold text-foreground">Waiting for review</p>
          <p className="text-xs text-muted-foreground">
            Submitted <RelativeTime iso={entry.reviewRequestedAt} />. Publishing approves it.
          </p>
          {entry.reviewNote && <p className="mt-2 whitespace-pre-wrap text-foreground">{entry.reviewNote}</p>}
        </div>
      </div>
    );
  }
  const changes = entry.reviewNote?.startsWith('Changes requested:');
  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-lg border px-3.5 py-3',
        changes ? 'border-measured/40 bg-measured/6' : 'border-rule/50 bg-background/60',
      )}
    >
      {changes ? (
        <AlertCircle size={18} className="mt-0.5 shrink-0 text-measured" aria-hidden="true" />
      ) : (
        <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-momentum" aria-hidden="true" />
      )}
      <p className="min-w-0 whitespace-pre-wrap text-sm text-foreground">{entry.reviewNote}</p>
    </div>
  );
}
