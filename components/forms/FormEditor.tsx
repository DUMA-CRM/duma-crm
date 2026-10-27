'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';

import { RowMenu } from '@/components/cms/rows';
import {
  Archive,
  BarChart3,
  ClipboardList,
  Copy,
  ExternalLink,
  ListChecks,
  Lock,
  Pencil,
  Play,
  RotateCcw,
  Send,
  Settings,
  Share2,
  Trash2,
} from '@/components/icons';
import { SaveBar } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { SectionTabs } from '@/components/shared/SectionTabs';
import { Bone } from '@/components/shared/Skeleton';
import { ActionButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { ApiError } from '@/lib/api/client';
import { hasCapability } from '@/lib/auth/capabilities';
import { type FormDetail, deleteForm, duplicateForm, getForm, publishForm, setFormStatus, updateForm } from '@/lib/modules/forms/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import {
  type FormDefinition,
  STANDING_LABELS,
  definitionProblems,
  formStanding,
  hostedFormUrl,
  problemFieldIndex,
} from '@/lib/utils/forms';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { FormBuilder } from './FormBuilder';
import { FormSettingsPanel } from './FormSettingsPanel';
import { STANDING_BADGE } from './FormsList';
import { ResponsesPanel } from './ResponsesPanel';
import { SharePanel } from './SharePanel';
import { SummaryPanel } from './SummaryPanel';

export type EditorTab = 'build' | 'settings' | 'share' | 'responses' | 'summary';

/** What the builder and the settings tab edit together, saved as one. */
export interface FormDraft {
  name: string;
  description: string;
  definition: FormDefinition;
  closesAt: string | null;
  responseLimit: number | null;
}

const draftOf = (form: FormDetail): FormDraft => ({
  name: form.name,
  description: form.description ?? '',
  definition: form.definition,
  closesAt: form.closesAt,
  responseLimit: form.responseLimit,
});

/**
 * One form, full page: Build (the questions), Settings (closing, the thank-you,
 * customers, look), Share (link, QR, embed, API), Responses and Summary.
 * Build and Settings edit one draft, saved together from the SaveBar (or ⌘S);
 * Publish saves first, then makes the draft what respondents see.
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

  if (query.isPending)
    return (
      <EditorShell title="Loading form" onClose={onClose} icon={<ClipboardList size={20} aria-hidden="true" />}>
        <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)_22rem]">
          <Bone className="h-96 rounded-lg" />
          <Bone className="h-[32rem] rounded-lg" />
          <Bone className="h-80 rounded-lg" />
        </div>
      </EditorShell>
    );
  if (query.isError || !query.data)
    return (
      <EditorShell title="Form not found" onClose={onClose} icon={<ClipboardList size={20} aria-hidden="true" />}>
        <EmptyState
          className="flex-1"
          icon={ClipboardList}
          kind="gone"
          title="This form couldn’t be loaded"
          description="It may have been deleted, belong to another workspace, or the connection dropped."
          action={{ label: 'Try again', onClick: () => void query.refetch() }}
        />
      </EditorShell>
    );

  return <LoadedEditor form={query.data} tab={tab} onTab={onTab} onClose={onClose} onOpen={onOpen} />;
}

function LoadedEditor({
  form,
  tab,
  onTab,
  onClose,
  onOpen,
}: {
  form: FormDetail;
  tab: EditorTab;
  onTab: (tab: EditorTab) => void;
  onClose: () => void;
  onOpen: (id: string, tab?: EditorTab) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const capabilities = useAuthStore((state) => state.capabilities);
  const canWrite = hasCapability(capabilities, 'forms:write');
  const canReadResponses = hasCapability(capabilities, 'forms.responses:read');
  const queryClient = useQueryClient();

  // The draft remembers the version it was read at, so a save from another tab drops it.
  const saved = useMemo(() => draftOf(form), [form]);
  const [draftState, setDraftState] = useState<{ version: number; updatedAt: string; value: FormDraft } | null>(null);
  const draft = draftState && draftState.version === form.version && draftState.updatedAt === form.updatedAt ? draftState.value : saved;
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const setDraft = (next: FormDraft | ((current: FormDraft) => FormDraft)) =>
    setDraftState((current) => {
      const base = current && current.version === form.version && current.updatedAt === form.updatedAt ? current.value : saved;
      return { version: form.version, updatedAt: form.updatedAt, value: typeof next === 'function' ? next(base) : next };
    });
  const [focusFieldId, setFocusFieldId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'archive' | null>(null);

  const readOnly = !canWrite || form.status === 'archived';
  const problems = useMemo(() => definitionProblems(draft.definition), [draft.definition]);
  const standing = formStanding({ ...form, responseCount: form.storedResponses ?? form.responseCount });
  const publicUrl = typeof window === 'undefined' ? '' : hostedFormUrl(window.location.origin, form.publicId);
  const unpublished = form.status !== 'draft' && (form.hasUnpublishedChanges || dirty);

  const settle = async (next: FormDetail) => {
    setDraftState(null);
    queryClient.setQueryData(moduleQueryKeys.forms.key('detail', form.id, tenantId), (current: FormDetail | undefined) => ({
      ...current,
      ...next,
    }));
    await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.all });
  };
  const conflict = (error: Error) => {
    if (error instanceof ApiError && error.status === 409) {
      toast('error', error.message);
      void queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.key('detail', form.id) });
      return true;
    }
    return false;
  };

  const saveDraft = () =>
    updateForm(
      form.id,
      {
        name: draft.name.trim() || 'Untitled form',
        description: draft.description.trim() || null,
        closesAt: draft.closesAt,
        responseLimit: draft.responseLimit,
        // Only a changed definition is sent: it bumps the version.
        ...(JSON.stringify(draft.definition) !== JSON.stringify(saved.definition) && {
          definition: draft.definition,
          expectedVersion: form.version,
        }),
      },
      tenantId,
    );

  const save = useMutation({
    mutationFn: saveDraft,
    onSuccess: async (next) => {
      await settle(next);
      toast('success', next.status === 'draft' ? 'Draft saved.' : 'Saved — publish to show the changes to respondents.');
    },
    onError: (error) => conflict(error) || toast('error', error.message),
  });

  const publish = useMutation({
    mutationFn: async () => {
      if (dirty) await settle(await saveDraft());
      return publishForm(form.id, tenantId);
    },
    onSuccess: async (next) => {
      await settle(next);
      toast('success', form.publishedAt ? 'Changes published — respondents see them now.' : 'Published — your form is live.');
      if (!form.publishedAt) onTab('share');
    },
    onError: (error) => {
      if (conflict(error)) return;
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
    mutationFn: () => duplicateForm(form.id, tenantId),
    onSuccess: async (copy) => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.all });
      toast('success', 'Duplicated — this is the copy, as a draft.');
      onOpen(copy.id);
    },
    onError: (error) => toast('error', error.message),
  });

  const remove = useMutation({
    mutationFn: () => deleteForm(form.id, tenantId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.forms.all });
      toast('success', 'Form deleted.');
      onClose();
    },
    onError: (error) => toast('error', error.message),
  });

  /** Take the builder to the question a problem is about. */
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

  // ⌘S / Ctrl+S saves, as in the Content and Promotions editors.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if (!readOnly && dirty && !save.isPending) save.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const busy = save.isPending || publish.isPending;
  const tabs = [
    { value: 'build' as const, label: 'Build', icon: Pencil },
    { value: 'settings' as const, label: 'Settings', icon: Settings },
    { value: 'share' as const, label: 'Share', icon: Share2 },
    ...(canReadResponses
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

  return (
    <EditorShell
      eyebrow="Forms"
      title={draft.name.trim() || 'Untitled form'}
      icon={<ClipboardList size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty}
      meta={
        <span className="flex items-center gap-1.5">
          <Badge variant={STANDING_BADGE[standing]}>{STANDING_LABELS[standing]}</Badge>
          {unpublished && <Badge variant="outline">Unpublished changes</Badge>}
        </span>
      }
      actions={
        <div className="flex items-center gap-1.5">
          {canWrite && form.status !== 'archived' && (form.status === 'draft' || unpublished) && (
            <ActionButton className="h-9 gap-1.5" pending={publish.isPending} disabled={busy} onClick={attemptPublish}>
              <Send size={14} aria-hidden="true" />
              {form.publishedAt ? 'Publish changes' : 'Publish'}
            </ActionButton>
          )}
          {form.publishedAt && !unpublished && form.status !== 'archived' && (
            <Button variant="outline" className="h-9 gap-1.5" onClick={() => onTab('share')}>
              <Share2 size={14} aria-hidden="true" />
              <span className="hidden md:inline">Share</span>
            </Button>
          )}
          {menu.length > 0 && <RowMenu label="More actions" items={menu} pending={status.isPending || duplicate.isPending} />}
        </div>
      }
      subheader={
        <SectionTabs<EditorTab> tabs={tabs} value={tab} onChange={onTab} ariaLabel="Form sections" animationId="form-editor-tabs" />
      }
    >
      {tab === 'build' && (
        <FormBuilder
          draft={draft}
          onChange={setDraft}
          readOnly={readOnly}
          problems={problems}
          focusFieldId={focusFieldId}
          onFocused={() => setFocusFieldId(null)}
        />
      )}
      {tab === 'settings' && <FormSettingsPanel form={form} draft={draft} onChange={setDraft} readOnly={readOnly} problems={problems} />}
      {tab === 'share' && (
        <SharePanel form={form} publicUrl={publicUrl} onPublish={canWrite ? attemptPublish : undefined} publishing={publish.isPending} />
      )}
      {tab === 'responses' && canReadResponses && <ResponsesPanel form={form} />}
      {tab === 'summary' && canReadResponses && <SummaryPanel form={form} />}

      {(tab === 'build' || tab === 'settings') && !readOnly && (
        <SaveBar
          dirty={dirty}
          saving={save.isPending}
          onSave={() => save.mutate()}
          onDiscard={() => setDraftState(null)}
          saveLabel={form.status === 'draft' ? 'Save draft' : 'Save'}
          message={form.status === 'draft' ? 'Unsaved changes' : 'Unsaved changes — respondents see them once published'}
          extra={
            form.status !== 'archived' ? (
              <Button variant="outline" size="lg" className="h-11 px-4" disabled={busy} onClick={attemptPublish}>
                Save &amp; publish
              </Button>
            ) : undefined
          }
        />
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
