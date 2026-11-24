'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import { RowMenu } from '@/components/shared/rows';
import { copyText } from '@/components/cms/shared';
import {
  Archive,
  BarChart3,
  Check,
  ClipboardList,
  Copy,
  ExternalLink,
  ListChecks,
  Loader2,
  Lock,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Settings,
  Share2,
  Trash2,
} from '@/components/icons';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { Drawer } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { SectionTabs } from '@/components/shared/SectionTabs';
import { Bone, FactsSkeleton, ListSkeleton } from '@/components/shared/Skeleton';
import { ActionButton, CopyButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import { type FormDetail, deleteForm, duplicateForm, getForm, publishForm, setFormStatus, updateForm } from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { type AutosaveStatus, type Autosaver, createAutosaver } from '@/lib/utils/autosave';
import { type FormDraft, type SavedDraft, applyPatch, draftPatch, heldPatch, isEmptyPatch, normalizeDraft } from '@/lib/utils/form-draft';
import { STANDING_LABELS, definitionProblems, formStanding, hostedFormUrl, problemFieldIndex } from '@/lib/utils/forms';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { FormBuilder } from './FormBuilder';
import { FormSettingsPanel } from './FormSettingsPanel';
import { STANDING_BADGE } from './FormsList';
import { ResponsesPanel } from './ResponsesPanel';
import { SharePanel } from './SharePanel';
import { SummaryPanel } from './SummaryPanel';
import { takeFreshForm } from './TemplateGallery';

/** `settings` and `share` are sheets over Build now; the old links still open them. */
export type EditorTab = 'build' | 'settings' | 'share' | 'responses' | 'summary';

export type { FormDraft } from '@/lib/utils/form-draft';

/** How long after the last change the draft saves. */
const AUTOSAVE_DELAY = 1000;

const draftOf = (form: FormDetail): FormDraft => ({
  name: form.name,
  description: form.description ?? '',
  definition: form.definition,
  closesAt: form.closesAt,
  responseLimit: form.responseLimit,
});

/**
 * One form, full page: the builder, and — once it has been live — its
 * Responses and Summary. Settings and Share are sheets over the builder.
 *
 * The draft saves itself a second after each change (see `form-draft.ts` for
 * what is held back on a live form). Publish is the one primary action; the
 * first publish opens the Share sheet.
 */
export function FormEditor({
  formId,
  tab,
  onTab,
  onClose,
  onOpen,
}: {
  formId: string;
  tab: EditorTab;
  onTab: (tab: EditorTab) => void;
  onClose: () => void;
  onOpen: (id: string, tab?: EditorTab) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const query = useQuery({
    queryKey: moduleQueryKeys.forms.key('detail', formId, tenantId),
    queryFn: () => getForm(formId, tenantId),
    enabled: Boolean(tenantId),
  });
  // Bumped by Reload after a conflict: the editor starts again from what's stored.
  const [generation, setGeneration] = useState(0);

  if (query.isPending)
    return (
      <EditorShell title="Loading form" onClose={onClose} icon={<ClipboardList size={20} aria-hidden="true" />}>
        <EditorSkeleton tab={tab} />
      </EditorShell>
    );
  if (query.isError || !query.data)
    return (
      <EditorShell title="Form" onClose={onClose} icon={<ClipboardList size={20} aria-hidden="true" />}>
        <ErrorState
          className="flex-1"
          icon={ClipboardList}
          title="This form couldn’t be loaded"
          description="It may have been deleted or belong to another workspace, or the connection dropped."
          onRetry={() => void query.refetch()}
        />
      </EditorShell>
    );

  return (
    <LoadedEditor
      key={generation}
      form={query.data}
      tab={tab}
      onTab={onTab}
      onClose={onClose}
      onOpen={onOpen}
      onReload={async () => {
        await query.refetch();
        setGeneration((current) => current + 1);
      }}
    />
  );
}

/** The tab's shape while the form loads: the builder's canvas and inspector, a list, or two stacks of cards. */
function EditorSkeleton({ tab }: { tab: EditorTab }) {
  if (tab === 'responses') return <ListSkeleton rows={6} label="Loading the responses" />;
  if (tab === 'summary')
    return (
      <div className="flex flex-col gap-5" aria-busy="true">
        <FactsSkeleton count={3} className="gap-3 sm:grid-cols-3" />
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Bone className="h-72 rounded-lg" />
          <Bone className="h-56 rounded-lg" />
        </div>
      </div>
    );
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-3" aria-busy="true">
      <Bone className="mb-2 h-9 w-48" />
      <Bone className="h-10 w-2/3" />
      <Bone className="h-28 rounded-lg" />
      <Bone className="h-28 rounded-lg" />
    </div>
  );
}

function LoadedEditor({
  form,
  tab,
  onTab,
  onClose,
  onOpen,
  onReload,
}: {
  form: FormDetail;
  tab: EditorTab;
  onTab: (tab: EditorTab) => void;
  onClose: () => void;
  onOpen: (id: string, tab?: EditorTab) => void;
  onReload: () => Promise<void>;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'forms:write');
  const canReadResponses = hasCapability(capabilities, 'forms.responses:read');
  const queryClient = useQueryClient();
  const detailKey = moduleQueryKeys.forms.key('detail', form.id, tenantId);

  const readOnly = !canWrite || form.status === 'archived';
  /** Published at least once: respondents read the name, description, closing date and limit straight off the form. */
  const live = form.publishedDefinition !== null;

  // The draft is local; `saved` is what the API last accepted. Neither is touched by a refetch.
  const [draft, setDraft] = useState<FormDraft>(() => draftOf(form));
  const [saved, setSaved] = useState<SavedDraft>(() => normalizeDraft(draftOf(form)));
  const [saveState, setSaveState] = useState<AutosaveStatus>('idle');
  const normalized = useMemo(() => normalizeDraft(draft), [draft]);
  const { patch, held } = draftPatch(saved, normalized, { live });

  // What the save, which runs outside render, reads.
  const savedRef = useRef(saved);
  const versionRef = useRef(form.version);
  const liveRef = useRef(live);
  const normalizedRef = useRef(normalized);
  useEffect(() => {
    liveRef.current = live;
    normalizedRef.current = normalized;
  });

  /** Put the API's answer in the cache (the badges read it) and mark every forms query stale. */
  const settle = async (next: FormDetail) => {
    queryClient.setQueryData(detailKey, (current: FormDetail | undefined) => ({ ...current, ...next }));
    await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.all });
  };
  const settleRef = useRef(settle);
  useEffect(() => {
    settleRef.current = settle;
  });

  // Made in an effect — it holds refs — and reached only from effects and handlers.
  const saverRef = useRef<Autosaver<SavedDraft> | null>(null);
  useEffect(() => {
    const autosaver = createAutosaver<SavedDraft>({
      delay: AUTOSAVE_DELAY,
      save: async (next) => {
        const { patch: changes } = draftPatch(savedRef.current, next, { live: liveRef.current });
        if (isEmptyPatch(changes)) return;
        const result = await updateForm(
          form.id,
          // Only a changed definition is sent: it bumps the version, and needs the one it was read at.
          { ...changes, ...(changes.definition && { expectedVersion: versionRef.current }) },
          tenantId,
        );
        versionRef.current = result.version;
        savedRef.current = applyPatch(savedRef.current, changes);
        setSaved(savedRef.current);
        await settleRef.current(result);
      },
      isConflict: (error) => error instanceof ApiError && error.status === 409,
      onStatus: (status, error) => {
        setSaveState(status);
        if (status === 'conflict' && error instanceof Error) {
          // The existing conflict handling: say so, and refresh what's stored.
          toast('error', error.message);
          void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.key('detail', form.id) });
        }
      },
    });
    saverRef.current = autosaver;
    // Leaving — closing the editor, another page, another form — sends what's waiting.
    return () => void autosaver.flush();
  }, [form.id, tenantId, queryClient]);
  /** The saver, from a handler or an effect (never during render). */
  const autosaver = {
    schedule: (value: SavedDraft) => saverRef.current?.schedule(value),
    flush: async () => (saverRef.current ? saverRef.current.flush() : true),
    retry: async () => (saverRef.current ? saverRef.current.retry() : true),
    dispose: () => saverRef.current?.dispose(),
    status: (): AutosaveStatus => saverRef.current?.status() ?? 'idle',
    busy: () => saverRef.current?.busy() ?? false,
  };

  // Each change is queued; the saver sends the latest a second after the last one.
  const unsaved = !isEmptyPatch(patch);
  useEffect(() => {
    if (readOnly) return;
    const saver = saverRef.current;
    if (saver && (unsaved || saver.busy())) saver.schedule(normalized);
  }, [normalized, unsaved, readOnly]);

  const pendingSave = saveState === 'pending' || saveState === 'saving';
  useEffect(() => {
    if (!pendingSave) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      void saverRef.current?.flush();
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [pendingSave]);

  // A form just made from Blank or a pasted list opens with its name ready to type over.
  useEffect(() => {
    if (!takeFreshForm(form.id)) return;
    requestAnimationFrame(() => {
      const name = document.getElementById('form-name') as HTMLTextAreaElement | null;
      name?.focus();
      name?.select();
    });
  }, [form.id]);

  const [focusFieldId, setFocusFieldId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'archive' | null>(null);

  const problems = useMemo(() => definitionProblems(draft.definition), [draft.definition]);
  const standing = formStanding({ ...form, responseCount: form.storedResponses ?? form.responseCount });
  const publicUrl = typeof window === 'undefined' ? '' : hostedFormUrl(window.location.origin, form.publicId);
  const unpublished = live && form.status !== 'archived' && (form.hasUnpublishedChanges || Boolean(patch.definition) || held.length > 0);
  // Work that can't be saved by waiting: a failed save, a conflict, or a live form's held name/settings.
  const atRisk = !readOnly && (saveState === 'error' || saveState === 'conflict' || held.length > 0);

  const close = async () => {
    if (!readOnly && !(await autosaver.flush()) && autosaver.status() !== 'conflict') {
      toast('error', 'Your latest changes couldn’t be saved. Try again, or leave without them.');
      return;
    }
    onClose();
  };

  const publish = useMutation({
    mutationFn: async () => {
      if (!(await autosaver.flush())) {
        throw new Error(
          autosaver.status() === 'conflict'
            ? 'Someone else changed this form. Reload to see their changes.'
            : 'Your changes couldn’t be saved, so nothing was published. Try again.',
        );
      }
      let next = await publishForm(form.id, tenantId);
      // Now the questions are live, the held name and settings go with them.
      const rows = draftPatch(savedRef.current, normalizedRef.current, { live: true }).held;
      if (rows.length) {
        const changes = heldPatch(normalizedRef.current, rows);
        next = await updateForm(form.id, changes, tenantId);
        savedRef.current = applyPatch(savedRef.current, changes);
        setSaved(savedRef.current);
      }
      versionRef.current = next.version;
      return next;
    },
    onSuccess: async (next) => {
      await settle(next);
      toast('success', form.publishedAt ? 'Changes published.' : 'Published — your form is live.');
      if (!form.publishedAt) onTab('share');
    },
    onError: (error) => {
      toast('error', error.message);
      if (error instanceof ApiError && error.issues.length) showProblem({ field: error.issues[0]!.field, message: error.message });
    },
  });

  const status = useMutation({
    mutationFn: (next: 'published' | 'closed' | 'archived' | 'restore') => setFormStatus(form.id, next, tenantId),
    onSuccess: async (next) => {
      setConfirm(null);
      await settle(next);
      toast(
        'success',
        next.status === 'closed'
          ? 'Closed — the form no longer takes responses.'
          : next.status === 'published'
            ? 'Reopened — the form takes responses again.'
            : next.status === 'archived'
              ? 'Archived. Its responses are kept.'
              : 'Restored.',
      );
    },
    onError: (error) => toast('error', error.message),
  });

  const duplicate = useMutation({
    mutationFn: async () => {
      await autosaver.flush();
      return duplicateForm(form.id, tenantId);
    },
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.all });
      toast('success', 'Duplicated — this is the copy, as a draft.');
      onOpen(copy.id);
    },
    onError: (error) => toast('error', error.message),
  });

  const remove = useMutation({
    mutationFn: () => {
      autosaver.dispose();
      return deleteForm(form.id, tenantId);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.all });
      toast('success', 'Form deleted.');
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  /** Take the builder (or the settings) to what a problem is about. */
  const showProblem = (problem: { field: string; message: string }) => {
    const index = problemFieldIndex(problem);
    if (index !== null) setFocusFieldId(draft.definition.fields[index]?.id ?? null);
    onTab(problem.field.startsWith('customerLink') || problem.field === 'redirectUrl' ? 'settings' : 'build');
  };

  const attemptPublish = () => {
    if (problems.length) {
      toast('error', problems[0]!.message);
      showProblem(problems[0]!);
      return;
    }
    publish.mutate();
  };

  // ⌘S / Ctrl+S saves now instead of in a second.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!readOnly) void saverRef.current?.flush();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [readOnly]);

  // Responses and Summary only once there can be some.
  const hasResults = canReadResponses && (live || (form.storedResponses ?? form.responseCount) > 0);
  const view: 'build' | 'responses' | 'summary' = (tab === 'responses' || tab === 'summary') && hasResults ? tab : 'build';
  const tabs = [
    { value: 'build' as const, label: 'Build', icon: Pencil },
    ...(hasResults
      ? [
          {
            value: 'responses' as const,
            label: 'Responses',
            icon: ListChecks,
            count: form.newResponses ?? 0,
            countLabel: `${form.newResponses ?? 0} new responses`,
          },
          { value: 'summary' as const, label: 'Summary', icon: BarChart3 },
        ]
      : []),
  ];

  const menu = [
    ...(form.publishedAt
      ? [{ icon: ExternalLink, label: 'Open the live form', onClick: () => window.open(publicUrl, '_blank', 'noopener') }]
      : []),
    ...(canWrite
      ? [
          { icon: Copy, label: 'Duplicate', onClick: () => duplicate.mutate(), disabled: duplicate.isPending },
          ...(form.status === 'published' ? [{ icon: Lock, label: 'Stop taking responses', onClick: () => status.mutate('closed') }] : []),
          ...(form.status === 'closed' ? [{ icon: Play, label: 'Take responses again', onClick: () => status.mutate('published') }] : []),
          form.status === 'archived'
            ? { icon: RotateCcw, label: 'Restore', onClick: () => status.mutate('restore') }
            : { icon: Archive, label: 'Archive', onClick: () => setConfirm('archive') },
          { icon: Trash2, label: 'Delete', onClick: () => setConfirm('delete'), danger: true },
        ]
      : []),
  ];

  const canPublish = canWrite && form.status !== 'archived' && (form.status === 'draft' || unpublished);

  return (
    <EditorShell
      eyebrow="Forms"
      title={draft.name.trim() || 'Untitled form'}
      icon={<ClipboardList size={20} aria-hidden="true" />}
      onClose={() => void close()}
      dirty={atRisk}
      discardMessage={
        held.length > 0
          ? 'The name and settings you changed reach respondents when you publish. Leaving now discards them.'
          : 'Your latest changes haven’t been saved. Leaving now discards them.'
      }
      meta={
        <span className="flex items-center gap-1.5">
          <Badge variant={STANDING_BADGE[standing]}>{STANDING_LABELS[standing]}</Badge>
          {unpublished && <Badge variant="outline">Unpublished changes</Badge>}
        </span>
      }
      actions={
        <div className="flex items-center gap-1.5">
          {!readOnly && <SaveState state={saveState} onRetry={() => void autosaver.retry()} onReload={() => void onReload()} />}
          <Button variant="outline" className="h-9 gap-1.5" onClick={() => onTab('settings')} aria-label="Settings">
            <Settings size={14} aria-hidden="true" />
            <span className="hidden md:inline">Settings</span>
          </Button>
          {live && form.status !== 'archived' && (
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => onTab('share')} aria-label="Share">
              <Share2 size={14} aria-hidden="true" />
              <span className="hidden md:inline">Share</span>
            </Button>
          )}
          {canPublish && (
            <ActionButton
              className="h-9 gap-1.5"
              pending={publish.isPending}
              pendingLabel="Publishing…"
              disabled={publish.isPending || saveState === 'conflict'}
              onClick={attemptPublish}
            >
              <Send size={14} aria-hidden="true" />
              {form.publishedAt ? (
                <>
                  Publish<span className="hidden sm:inline">&nbsp;changes</span>
                </>
              ) : (
                'Publish'
              )}
            </ActionButton>
          )}
          {menu.length > 0 && <RowMenu label="More actions" items={menu} pending={status.isPending || duplicate.isPending} />}
        </div>
      }
      subheader={
        tabs.length > 1 ? (
          <SectionTabs<EditorTab> tabs={tabs} value={view} onChange={onTab} ariaLabel="Form sections" animationId="form-editor-tabs" />
        ) : undefined
      }
    >
      {view === 'build' && (
        <FormBuilder
          draft={draft}
          onChange={setDraft}
          readOnly={readOnly}
          problems={problems}
          focusFieldId={focusFieldId}
          onFocused={() => setFocusFieldId(null)}
        />
      )}
      {view === 'responses' && <ResponsesPanel form={form} />}
      {view === 'summary' && <SummaryPanel form={form} />}

      {tab === 'settings' && (
        <Drawer title="Settings" icon={Settings} onClose={() => onTab('build')}>
          <FormSettingsPanel form={form} draft={draft} onChange={setDraft} readOnly={readOnly} problems={problems} live={live} stacked />
        </Drawer>
      )}
      {tab === 'share' && (
        <Drawer
          title={live ? 'Share your form' : 'Share'}
          icon={Share2}
          onClose={() => onTab('build')}
          footer={
            live ? (
              <div className="flex flex-wrap justify-end gap-2">
                <Button asChild variant="outline" className="pointer-coarse:h-11">
                  <a href={publicUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink aria-hidden="true" />
                    Open as a guest
                  </a>
                </Button>
                <CopyButton onCopy={() => copyText(publicUrl)} label="Copy link" variant="default" className="pointer-coarse:h-11" />
              </div>
            ) : undefined
          }
        >
          <SharePanel
            form={form}
            publicUrl={publicUrl}
            onPublish={canWrite ? attemptPublish : undefined}
            publishing={publish.isPending}
            stacked
          />
        </Drawer>
      )}

      {confirm === 'archive' && (
        <ConfirmModal
          title="Archive this form?"
          message="It stops taking responses and moves to Archived. Its responses are kept, and you can restore it."
          confirmLabel="Archive"
          pendingLabel="Archiving…"
          isPending={status.isPending}
          onConfirm={() => status.mutate('archived')}
          onClose={() => setConfirm(null)}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmModal
          title={`Delete “${form.name}”?`}
          message={
            (form.storedResponses ?? 0) > 0
              ? `Its ${form.storedResponses} ${form.storedResponses === 1 ? 'response goes' : 'responses go'} with it, and its link stops working. This can’t be undone — archive it instead to keep them.`
              : 'Its link stops working. This can’t be undone.'
          }
          confirmLabel="Delete form"
          pendingLabel="Deleting…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirm(null)}
        />
      )}
    </EditorShell>
  );
}

/** "Saving…", "Saved", or what went wrong and the way out — quiet, beside the header buttons. */
function SaveState({ state, onRetry, onReload }: { state: AutosaveStatus; onRetry: () => void; onReload: () => void }) {
  if (state === 'error' || state === 'conflict') {
    return (
      <span role="status" className="flex items-center gap-1 text-xs text-exception">
        <span className="hidden sm:inline">{state === 'conflict' ? 'Changed elsewhere' : 'Couldn’t save'}</span>
        <Button variant="ghost" size="sm" className="h-9 px-2 text-exception" onClick={state === 'conflict' ? onReload : onRetry}>
          {state === 'conflict' ? 'Reload' : 'Retry'}
        </Button>
      </span>
    );
  }
  if (state === 'idle') return null;
  const saving = state === 'pending' || state === 'saving';
  return (
    <span role="status" className="hidden items-center gap-1 px-1 text-xs text-muted-foreground sm:flex">
      {saving ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
      {saving ? 'Saving…' : 'Saved'}
    </span>
  );
}
