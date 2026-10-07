'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import {
  AlignLeft,
  Box,
  ChevronDown,
  ChevronUp,
  FileText,
  Globe,
  Hash,
  Layers,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  TriangleAlert,
  Type,
  UserRound,
  Users,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { LoadingState } from '@/components/shared/Skeleton';
import { Tooltip } from '@/components/shared/Tooltip';
import { CopyButton } from '@/components/ui/action-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { ApiError } from '@/lib/api/client';
import {
  type CmsContentType,
  type CmsContentTypeKind,
  type CmsFieldDefinition,
  type CmsFieldType,
  type CmsMediaGroup,
  type CmsSchemaImpact,
  createCmsContentType,
  deleteCmsContentType,
  getCmsContentType,
  getCmsContentTypes,
  getCmsTypeRoles,
  previewCmsSchemaImpact,
  setCmsTypeRoles,
  updateCmsContentType,
} from '@/lib/modules/cms/client';
import { getRoles } from '@/lib/modules/identity/client';
import {
  FIELD_TYPES,
  canHoldList,
  fieldKeyFromLabel,
  fieldListProblems,
  fieldTypeLabel,
  moveItem,
  newField,
  typeKeyFromName,
  uniqueKey,
} from '@/lib/utils/cms';
import { type ModelDraft, mergeDraftFields, uniqueModelName } from '@/lib/utils/cms-model-draft';
import { SEO_FIELD, hasSeoBlock, missingSeoFields, withFullSeoBlock } from '@/lib/utils/cms-seo';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ModelAssist } from './ModelAssist';
import { FIELD_ICONS } from './fieldIcons';
import { ActionRow, ActionRows, FieldRow, InfoRow, InfoRows, SectionInfo } from './rows';
import { FIELD_LABEL_CLASS, PanelError, TEXTAREA_CLASS, cmsKeys, copyText, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

const TITLE_TYPES = ['text', 'slug', 'email', 'url', 'number', 'date', 'dateTime', 'select'];

export function ModelEditor({
  modelId,
  onClose,
  onSaved,
  onDeleted,
  onBrowseEntries,
}: {
  modelId: string | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  /** Open the Entries tab filtered to this model. */
  onBrowseEntries?: (id: string) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId);
  // Bumped by Discard: remounting the form is the simplest exact reset.
  const [resetCount, setResetCount] = useState(0);
  const query = useQuery({
    queryKey: cmsKeys.contentType(modelId),
    queryFn: () => getCmsContentType(modelId!, tenantId ?? undefined),
    enabled: !!tenantId && !!modelId,
  });
  if (modelId && query.isError) {
    return (
      <EditorShell title="Content model" onClose={onClose} icon={<Layers size={20} aria-hidden="true" />}>
        <PanelError title="The content model couldn’t be loaded" onRetry={() => void query.refetch()} />
      </EditorShell>
    );
  }
  if (modelId && query.isPending) {
    return (
      <EditorShell title="Loading content model" onClose={onClose} icon={<Layers size={20} aria-hidden="true" />}>
        <LoadingState label="Loading the content model" />
      </EditorShell>
    );
  }
  return (
    <LoadedModelEditor
      key={`${modelId}:${query.data?.schemaVersion ?? 0}:${resetCount}`}
      model={query.data ?? null}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
      onBrowseEntries={onBrowseEntries}
      onDiscard={() => setResetCount((count) => count + 1)}
    />
  );
}

function LoadedModelEditor({
  model,
  onClose,
  onSaved,
  onDeleted,
  onDiscard,
  onBrowseEntries,
}: {
  model: CmsContentType | null;
  onClose: () => void;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  onDiscard: () => void;
  onBrowseEntries?: (id: string) => void;
}) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const editable = access.canModel;
  const [name, setName] = useState(model?.name ?? '');
  const [key, setKey] = useState(model?.key ?? '');
  const [keyTouched, setKeyTouched] = useState(Boolean(model));
  const [kind, setKind] = useState<CmsContentTypeKind>(model?.kind ?? 'collection');
  const [description, setDescription] = useState(model?.description ?? '');
  const [previewUrl, setPreviewUrl] = useState(model?.previewUrl ?? '');
  const [titleField, setTitleField] = useState(model?.titleField ?? '');
  const [fields, setFields] = useState<CmsFieldDefinition[]>(
    model?.fields ?? [{ key: 'title', label: 'Title', type: 'text', required: true }],
  );
  const [impact, setImpact] = useState<CmsSchemaImpact | null>(null);
  const [deleting, setDeleting] = useState<null | { force: boolean; message?: string }>(null);
  const [serverIssues, setServerIssues] = useState<string[]>([]);

  const typesQuery = useQuery({
    queryKey: cmsKeys.contentTypes(tenantId ?? null),
    queryFn: () => getCmsContentTypes(tenantId),
    enabled: !!tenantId,
  });
  const referenceTypes = (typesQuery.data ?? [])
    .filter((type) => type.id !== model?.id)
    .map((type) => ({ key: type.key, name: type.name }))
    .concat(model ? [{ key: model.key, name: `${model.name} (this model)` }] : []);
  // Keys are unique per workspace: a new model's derived key steps aside
  // ("blog_post2") instead of failing on Create.
  const otherTypes = (typesQuery.data ?? []).filter((type) => type.id !== model?.id);
  const takenKeys = otherTypes.map((type) => type.key);
  const keyFromName = (value: string) => uniqueKey(typeKeyFromName(value), takenKeys);
  const keyHolder = !model ? otherTypes.find((type) => type.key === key) : undefined;

  const payload = {
    name: name.trim(),
    description: description.trim() || null,
    kind,
    fields,
    titleField: titleField || null,
    previewUrl: previewUrl.trim() || null,
  };
  const dirty = model
    ? JSON.stringify(payload) !==
      JSON.stringify({
        name: model.name,
        description: model.description,
        kind: model.kind,
        fields: model.fields,
        titleField: model.titleField,
        previewUrl: model.previewUrl,
      })
    : Boolean(name.trim());
  const problems = useMemo(() => fieldListProblems(fields), [fields]);
  const titleCandidates = fields.filter((field) => TITLE_TYPES.includes(field.type) && !field.multiple);

  const save = useMutation({
    mutationFn: async () =>
      model
        ? updateCmsContentType(model.id, { ...payload, expectedSchemaVersion: model.schemaVersion }, tenantId)
        : createCmsContentType({ ...payload, key }, tenantId),
    onSuccess: (saved) => {
      setImpact(null);
      setServerIssues([]);
      invalidateCms(queryClient);
      toast('success', model ? 'Model saved.' : 'Model created.');
      onSaved(saved.id);
    },
    onError: (error) => {
      setImpact(null);
      if (error instanceof ApiError && error.issues.length > 0)
        setServerIssues(error.issues.map((issue) => `${issue.field}: ${issue.message}`));
      toast('error', error.message);
    },
  });

  // Changing the shape of a model a website already reads is the dangerous
  // edit: preview its blast radius first, and only interrupt when something
  // live is actually affected.
  const checkThenSave = useMutation({
    mutationFn: async () => (model ? previewCmsSchemaImpact(model.id, fields, tenantId) : null),
    onSuccess: (result) => {
      const risky =
        result && result.affectedEntries > 0 && (result.removed.length > 0 || result.retyped.length > 0 || result.newlyRequired.length > 0);
      if (risky) setImpact(result);
      else save.mutate();
    },
    onError: (error) => toast('error', error.message),
  });

  const remove = useMutation({
    mutationFn: (force: boolean) => deleteCmsContentType(model!.id, force, tenantId),
    onSuccess: () => {
      invalidateCms(queryClient);
      toast('success', 'Model deleted.');
      onDeleted();
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        setDeleting({
          force: true,
          message: `${error.message} Every entry of this model will be deleted, and any that are live disappear from your website.`,
        });
        return;
      }
      setDeleting(null);
      toast('error', error.message);
    },
  });

  const blocked = problems.length > 0 || !name.trim() || (!model && (!key || Boolean(keyHolder)));
  const KindIcon = kind === 'singleton' ? Box : Layers;

  // A new model still holding only its starter title has nothing to keep.
  const blank = !model && fields.length === 1 && fields[0]!.key === 'title' && fields[0]!.type === 'text';

  /**
   * Put an Ask DUMA draft into the form; returns how many fields it added.
   * `replace` (a blank model, or the person chose to start over) swaps the
   * fields and takes the draft's title field; `add` keeps what is there.
   */
  const applyDraft = (draft: ModelDraft, mode: 'add' | 'replace'): number => {
    const replacing = blank || mode === 'replace';
    const merged = mergeDraftFields(fields, draft, replacing ? 'replace' : 'add', SEO_FIELD);
    setFields(merged.fields);
    // The old title field may be gone; the draft knows the new one.
    if (replacing) setTitleField(draft.titleField ?? '');
    if (!model) {
      // Starting over renames a new model; otherwise only an empty name is filled.
      if (draft.name && (!name.trim() || (replacing && !blank))) {
        // "Blog post" exists already → "Blog post 2", so the two never read alike.
        const unique = uniqueModelName(
          draft.name,
          otherTypes.map((type) => type.name),
        );
        setName(unique);
        if (!keyTouched) setKey(keyFromName(unique));
      }
      if (draft.description && (!description.trim() || replacing)) setDescription(draft.description);
      if (replacing) setKind(draft.kind);
      else if (draft.titleField && !titleField) setTitleField(draft.titleField);
    }
    return merged.added;
  };

  const saveShortcut = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘S' : 'Ctrl+S';
  const busy = save.isPending || checkThenSave.isPending;
  const blockedReason =
    problems.length > 0
      ? 'Fix the highlighted fields first'
      : !name.trim()
        ? 'Give the model a name'
        : !model && !key
          ? 'Give the model an API key'
          : keyHolder
            ? `“${key}” is used by ${keyHolder.name} — choose another key`
            : '';

  // ⌘S / Ctrl+S saves, as on the entry page — the save button lives in the header.
  useEffect(() => {
    if (!editable) return;
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 's') {
        event.preventDefault();
        if ((dirty || !model) && !blocked && !busy) checkThenSave.mutate();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editable, dirty, model, blocked, busy, checkThenSave]);

  const saveButton = (
    <Button className="h-9" disabled={blocked || busy} onClick={() => checkThenSave.mutate()}>
      {busy ? 'Saving…' : model ? 'Save model' : 'Create model'}
    </Button>
  );

  return (
    <EditorShell
      eyebrow="Content model"
      title={model ? model.name : name.trim() || 'New content model'}
      icon={<KindIcon size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty && editable}
      meta={
        <span className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {model && <span className="tabular-nums">schema v{model.schemaVersion}</span>}
          {(dirty || !model) && editable && (
            <span className="inline-flex items-center gap-1 font-medium text-measured">
              <span className="size-1.5 rounded-full bg-measured" aria-hidden="true" />
              {model ? 'Unsaved changes' : 'Not created yet'}
            </span>
          )}
        </span>
      }
      actions={
        editable && (dirty || !model) ? (
          <div className="flex items-center gap-2">
            <Button variant="ghost" className="h-9" disabled={busy} onClick={model ? onDiscard : onClose}>
              Discard
            </Button>
            {blockedReason ? (
              <Tooltip side="top" align="end" label={blockedReason}>
                {saveButton}
              </Tooltip>
            ) : (
              <Tooltip side="top" align="end" label={`${model ? 'Save' : 'Create'} (${saveShortcut})`}>
                {saveButton}
              </Tooltip>
            )}
          </div>
        ) : undefined
      }
    >
      <motion.div initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
        <SettingsTabBody
          narrowAside
          aside={
            <>
              {editable && (
                <SettingsSection title="Ask DUMA">
                  <ModelAssist
                    isNew={!model}
                    blank={blank}
                    name={name}
                    fields={fields}
                    models={referenceTypes.map((type) => ({ key: type.key, name: type.name }))}
                    onApply={applyDraft}
                  />
                </SettingsSection>
              )}
              {model && (
                <SettingsSection title="Model">
                  <InfoRows>
                    <InfoRow icon={Hash} title="API key">
                      <Tooltip side="top" align="end" label="Websites query by this key; it cannot change">
                        <span className="max-w-32 truncate font-mono text-xs text-muted-foreground">{model.key}</span>
                      </Tooltip>
                      <CopyButton
                        iconOnly
                        size="icon-sm"
                        label="Copy API key"
                        copiedLabel="API key copied"
                        onCopy={async () => {
                          const copied = await copyText(model.key);
                          if (!copied) toast('error', 'Copy failed — select the key instead.');
                          return copied;
                        }}
                      />
                    </InfoRow>
                    {typeof model.entryCount === 'number' && (
                      <InfoRow icon={FileText} title="Entries">
                        <span className="text-sm tabular-nums text-muted-foreground">{model.entryCount}</span>
                      </InfoRow>
                    )}
                  </InfoRows>
                </SettingsSection>
              )}

              <SettingsSection title="Details">
                <div className="space-y-4">
                  <FieldRow icon={Type} title="Name" htmlFor="cms-model-name">
                    <Input
                      id="cms-model-name"
                      value={name}
                      disabled={!editable}
                      placeholder="Blog post"
                      autoFocus={!model}
                      onChange={(event) => {
                        setName(event.target.value);
                        if (!keyTouched) setKey(keyFromName(event.target.value));
                      }}
                    />
                  </FieldRow>
                  {/* Fixed once created — the Model card shows it from then on. */}
                  {!model && (
                    <FieldRow icon={Hash} title="API key" htmlFor="cms-model-key" note="Can’t change later">
                      <Input
                        id="cms-model-key"
                        className="font-mono"
                        value={key}
                        disabled={!editable}
                        hint="Used in the delivery URL"
                        error={keyHolder ? `Already used by “${keyHolder.name}” — try ${uniqueKey(key, takenKeys)}` : undefined}
                        onChange={(event) => {
                          setKeyTouched(true);
                          setKey(event.target.value.toLowerCase());
                        }}
                      />
                    </FieldRow>
                  )}
                  <FieldRow icon={KindIcon} title="Kind" note={kind === 'singleton' ? 'Exactly one entry' : 'Many entries'}>
                    <SegmentedControl<CmsContentTypeKind>
                      ariaLabel="Kind"
                      className="w-full [&>button]:flex-1"
                      value={kind}
                      onChange={(value) => editable && setKind(value)}
                      options={[
                        { value: 'collection', label: 'Collection', icon: Layers },
                        { value: 'singleton', label: 'Singleton', icon: Box },
                      ]}
                    />
                  </FieldRow>
                  <FieldRow icon={AlignLeft} title="Description" htmlFor="cms-model-description">
                    <textarea
                      id="cms-model-description"
                      rows={3}
                      className={TEXTAREA_CLASS}
                      value={description}
                      disabled={!editable}
                      placeholder="What this is for, for the people writing it"
                      onChange={(event) => setDescription(event.target.value)}
                    />
                  </FieldRow>
                </div>
              </SettingsSection>

              {model && <TypeRolesSection typeId={model.id} typeName={model.name} editable={editable} />}

              <SettingsSection
                title="Display"
                actions={<SectionInfo label="How entries of this model are named in lists, and where their page lives on your site." />}
              >
                <InfoRows>
                  <InfoRow icon={Type} title="Entry title">
                    <Select
                      className="w-40"
                      ariaLabel="Entry title field"
                      value={titleField}
                      disabled={!editable}
                      onValueChange={setTitleField}
                      options={[
                        { value: '', label: 'First text field' },
                        ...titleCandidates.map((field) => ({ value: field.key, label: field.label })),
                      ]}
                    />
                  </InfoRow>
                  <PreviewUrlRow value={previewUrl} disabled={!editable} onChange={setPreviewUrl} />
                </InfoRows>
              </SettingsSection>

              {model && (onBrowseEntries || editable) && (
                <SettingsSection title="Actions">
                  <ActionRows
                    danger={
                      editable ? (
                        <ActionRow icon={Trash2} label={`Delete ${model.name}`} danger onClick={() => setDeleting({ force: false })} />
                      ) : undefined
                    }
                  >
                    {onBrowseEntries && <ActionRow icon={FileText} label="Browse entries" onClick={() => onBrowseEntries(model.id)} />}
                  </ActionRows>
                </SettingsSection>
              )}
            </>
          }
        >
          <SettingsSection
            title="Fields"
            actions={
              <div className="flex items-center gap-1">
                <span className="text-xs tabular-nums text-muted-foreground">
                  {fields.length} {fields.length === 1 ? 'field' : 'fields'}
                </span>
                <SectionInfo
                  label={`The shape of every entry, in the order editors see it. Open a field to set its rules.${model ? ' Changing a field live entries use asks first, and shows how many it affects.' : ''}`}
                />
              </div>
            }
          >
            {(problems.length > 0 || serverIssues.length > 0) && (
              <div role="alert" className="mb-4 rounded-lg border border-exception/50 bg-exception/6 px-3.5 py-2.5 text-sm text-exception">
                <ul className="list-disc space-y-0.5 pl-4">
                  {[...problems, ...serverIssues].map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            )}
            <FieldList fields={fields} onChange={setFields} disabled={!editable} depth={0} referenceTypes={referenceTypes} />
          </SettingsSection>
        </SettingsTabBody>
      </motion.div>

      {impact && (
        <Modal
          title="This change affects live content"
          onClose={() => setImpact(null)}
          footer={
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setImpact(null)}>
                Keep editing
              </Button>
              <Button disabled={save.isPending} onClick={() => save.mutate()}>
                {save.isPending ? 'Saving…' : 'Save anyway'}
              </Button>
            </div>
          }
        >
          <div className="space-y-3 text-sm">
            <p className="flex gap-2 text-measured">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              {impact.affectedEntries} {impact.affectedEntries === 1 ? 'entry uses' : 'entries use'} this model, {impact.publishedEntries}{' '}
              of them live. Websites reading these fields may break.
            </p>
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              {impact.removed.length > 0 && (
                <li>Removed: {impact.removed.join(', ')} — published values stay until each entry is republished, then are dropped.</li>
              )}
              {impact.retyped.map((change) => (
                <li key={change.key}>
                  {change.key}: {fieldTypeLabel(change.from)} → {fieldTypeLabel(change.to)} — existing values may no longer validate.
                </li>
              ))}
              {impact.newlyRequired.length > 0 && (
                <li>Now required: {impact.newlyRequired.join(', ')} — entries missing them cannot be republished until filled in.</li>
              )}
            </ul>
          </div>
        </Modal>
      )}

      {deleting && model && (
        <ConfirmModal
          title={deleting.force ? 'Delete the model and all its entries?' : `Delete ${model.name}?`}
          message={deleting.message ?? 'The model is removed. This cannot be undone.'}
          confirmLabel={deleting.force ? 'Delete everything' : 'Delete'}
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(deleting.force)}
          onClose={() => setDeleting(null)}
        />
      )}
    </EditorShell>
  );
}

// ─── Field list (recursive, for groups) ──────────────────────────────────────

function FieldList({
  fields,
  onChange,
  disabled,
  depth,
  referenceTypes,
}: {
  fields: CmsFieldDefinition[];
  onChange: (fields: CmsFieldDefinition[]) => void;
  disabled: boolean;
  depth: number;
  referenceTypes: Array<{ key: string; name: string }>;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const update = (index: number, next: CmsFieldDefinition) =>
    onChange(fields.map((field, position) => (position === index ? next : field)));
  const move = (from: number, to: number) => {
    onChange(moveItem(fields, from, to));
    if (open === from) setOpen(to);
    else if (open === to) setOpen(from);
  };

  return (
    <div className="space-y-2">
      {fields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-rule px-4 py-6 text-center text-sm text-muted-foreground">
          No fields yet — add the first one. A title is a good start.
        </div>
      ) : (
        <ol className="space-y-2">
          {fields.map((field, index) => {
            const expanded = open === index;
            const Icon = FIELD_ICONS[field.type];
            return (
              // Keyed by position, not by key: editing the API key must not remount the row (and drop focus).
              <li
                key={index}
                className={cn(
                  'rounded-lg border bg-control transition-colors',
                  expanded ? 'border-primary/40' : 'border-rule/60 hover:border-rule',
                )}
              >
                <div className="flex items-center gap-3 py-2.5 pl-3 pr-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : index)}
                  >
                    <span
                      // The outlined tile of the entry page's rows; tinted while open.
                      className={cn(
                        'flex size-8 shrink-0 items-center justify-center rounded-md border',
                        expanded ? 'border-primary/40 bg-primary/10 text-primary' : 'border-rule/55 bg-background text-muted-foreground',
                      )}
                    >
                      <Icon size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-foreground">
                        <span className="truncate">{field.label || 'Untitled field'}</span>
                        {field.required && <Badge variant="outline">Required</Badge>}
                        {field.unique && <Badge variant="outline">Unique</Badge>}
                        {field.private && <Badge variant="warning">Private</Badge>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        <span className="font-mono">{field.key}</span> · {fieldTypeLabel(field.type)}
                        {field.multiple && canHoldList(field.type) ? (field.type === 'group' ? ', repeatable' : ', list') : ''}
                        {field.type === 'group' ? ` · ${(field.fields ?? []).length} nested` : ''}
                      </span>
                    </span>
                  </button>
                  {!disabled && (
                    <span className="flex shrink-0 items-center">
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="text-muted-foreground"
                        aria-label={`Move ${field.label} up`}
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ChevronUp aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="text-muted-foreground"
                        aria-label={`Move ${field.label} down`}
                        disabled={index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ChevronDown aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="text-muted-foreground"
                        aria-label={`Edit ${field.label}`}
                        onClick={() => setOpen(expanded ? null : index)}
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        className="text-muted-foreground hover:text-exception"
                        aria-label={`Remove ${field.label}`}
                        onClick={() => {
                          onChange(fields.filter((_, position) => position !== index));
                          setOpen(null);
                        }}
                      >
                        <Trash2 aria-hidden="true" />
                      </Button>
                    </span>
                  )}
                </div>
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-rule/40 p-4">
                        <FieldSettings
                          field={field}
                          siblings={fields}
                          disabled={disabled}
                          depth={depth}
                          referenceTypes={referenceTypes}
                          onChange={(next) => update(index, next)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ol>
      )}
      {!disabled && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1 gap-1.5 border-dashed" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> Add {depth > 0 ? 'a nested field' : 'a field'}
          </Button>
          {/* One click for the fields every page needs for search and sharing. */}
          {depth === 0 && !hasSeoBlock(fields) && (
            <Tooltip side="top" label="Focus keyword, meta and social title and description, image, content type, canonical URL, indexing">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 border-dashed"
                onClick={() => {
                  onChange([...fields, SEO_FIELD]);
                  setOpen(fields.length);
                }}
              >
                <Search aria-hidden="true" /> Add SEO block
              </Button>
            </Tooltip>
          )}
          {/* An older block gains the newer sub-fields in one click; what it has is kept. */}
          {depth === 0 && missingSeoFields(fields).length > 0 && (
            <Tooltip
              side="top"
              label={`Adds ${missingSeoFields(fields)
                .map((field) => field.label.toLowerCase())
                .join(', ')}`}
            >
              <Button variant="outline" size="sm" className="gap-1.5 border-dashed" onClick={() => onChange(withFullSeoBlock(fields))}>
                <Search aria-hidden="true" /> Update SEO block ({missingSeoFields(fields).length} new)
              </Button>
            </Tooltip>
          )}
        </div>
      )}
      {adding && (
        <AddFieldDialog
          depth={depth}
          onClose={() => setAdding(false)}
          onAdd={(type, label) => {
            onChange([...fields, newField(type, label, fields)]);
            setAdding(false);
            setOpen(fields.length);
          }}
        />
      )}
    </div>
  );
}

function AddFieldDialog({
  depth,
  onClose,
  onAdd,
}: {
  depth: number;
  onClose: () => void;
  onAdd: (type: CmsFieldType, label: string) => void;
}) {
  const [type, setType] = useState<CmsFieldType | null>(null);
  const [label, setLabel] = useState('');
  // Slugs live at the top level, and groups nest at most two deep.
  const available = FIELD_TYPES.filter((entry) => !(depth > 0 && entry.type === 'slug') && !(depth >= 1 && entry.type === 'group'));
  const groups = [...new Set(available.map((entry) => entry.group))];
  return (
    <Modal
      title="Add a field"
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!type || !label.trim()} onClick={() => type && onAdd(type, label)}>
            Add field
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Input
          label="Label"
          value={label}
          placeholder="Hero image"
          autoFocus
          onChange={(event) => setLabel(event.target.value)}
          hint={label ? `API key: ${fieldKeyFromLabel(label) || '—'}` : 'What editors see; the API key is made from it'}
        />
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-1.5 text-label uppercase text-muted-foreground">{group}</p>
            <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label={group}>
              {available
                .filter((entry) => entry.group === group)
                .map((entry) => {
                  const Icon = FIELD_ICONS[entry.type];
                  const on = type === entry.type;
                  return (
                    <button
                      key={entry.type}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      onClick={() => setType(entry.type)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        on ? 'border-primary bg-primary/6' : 'border-rule/60 hover:bg-band/50',
                      )}
                    >
                      <span
                        className={cn(
                          'flex size-8 shrink-0 items-center justify-center rounded-md',
                          on ? 'bg-primary text-primary-foreground' : 'bg-band text-muted-foreground',
                        )}
                      >
                        <Icon size={15} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-foreground">{entry.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{entry.description}</span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

const optionalNumber = (raw: string) => (raw.trim() === '' || !Number.isFinite(Number(raw)) ? undefined : Number(raw));

function FieldSettings({
  field,
  siblings,
  disabled,
  depth,
  referenceTypes,
  onChange,
}: {
  field: CmsFieldDefinition;
  siblings: CmsFieldDefinition[];
  disabled: boolean;
  depth: number;
  referenceTypes: Array<{ key: string; name: string }>;
  onChange: (next: CmsFieldDefinition) => void;
}) {
  const set = <K extends keyof CmsFieldDefinition>(key: K, value: CmsFieldDefinition[K]) => {
    const next = { ...field, [key]: value };
    if (value === undefined || value === false || (Array.isArray(value) && value.length === 0 && key !== 'options')) delete next[key];
    onChange(next);
  };
  const textual = ['text', 'longText', 'richText', 'slug', 'email', 'url'].includes(field.type);
  const toggle = (key: 'required' | 'unique' | 'private' | 'multiple' | 'integer', label: string, hint: string, show = true) =>
    show && (
      <div className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
        <span>
          <span className="block text-sm font-semibold text-foreground">{label}</span>
          <span className="block text-xs text-muted-foreground">{hint}</span>
        </span>
        <Switch checked={Boolean(field[key])} disabled={disabled} label={label} onChange={(checked) => set(key, checked || undefined)} />
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Input label="Label" value={field.label} disabled={disabled} onChange={(event) => set('label', event.target.value)} />
        <Input
          label="API key"
          className="font-mono"
          value={field.key}
          disabled={disabled}
          hint="Renaming loses existing values"
          onChange={(event) => set('key', event.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
        />
      </div>
      <Input
        label="Help text"
        value={field.description ?? ''}
        disabled={disabled}
        placeholder="Shown under the field in the editor"
        onChange={(event) => set('description', event.target.value || undefined)}
      />

      <div className="divide-y divide-rule/40">
        {toggle('required', 'Required', 'Must be filled in to publish')}
        {toggle(
          'unique',
          'Unique',
          'No two entries in a locale share the value',
          ['text', 'slug', 'email', 'url', 'number'].includes(field.type) && depth === 0,
        )}
        {toggle(
          'multiple',
          field.type === 'group' ? 'Repeatable' : 'Allow several',
          'Holds a list instead of one value',
          canHoldList(field.type),
        )}
        {toggle('integer', 'Whole numbers only', 'Rejects decimals', field.type === 'number')}
        {toggle('private', 'Private', 'Editors see it; the delivery API never sends it')}
      </div>

      {textual && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Min length"
            type="number"
            min={0}
            value={field.minLength ?? ''}
            disabled={disabled}
            onChange={(event) => set('minLength', optionalNumber(event.target.value))}
          />
          <Input
            label="Max length"
            type="number"
            min={1}
            value={field.maxLength ?? ''}
            disabled={disabled}
            onChange={(event) => set('maxLength', optionalNumber(event.target.value))}
          />
          {field.type === 'text' && (
            <>
              <Input
                label="Pattern (regex)"
                className="font-mono"
                value={field.pattern ?? ''}
                disabled={disabled}
                placeholder="^[A-Z]{3}$"
                onChange={(event) => set('pattern', event.target.value || undefined)}
              />
              <Input
                label="Pattern message"
                value={field.patternMessage ?? ''}
                disabled={disabled}
                onChange={(event) => set('patternMessage', event.target.value || undefined)}
              />
            </>
          )}
        </div>
      )}
      {field.type === 'number' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Minimum"
            type="number"
            value={field.min ?? ''}
            disabled={disabled}
            onChange={(event) => set('min', optionalNumber(event.target.value))}
          />
          <Input
            label="Maximum"
            type="number"
            value={field.max ?? ''}
            disabled={disabled}
            onChange={(event) => set('max', optionalNumber(event.target.value))}
          />
        </div>
      )}
      {field.multiple && canHoldList(field.type) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Min items"
            type="number"
            min={0}
            value={field.minItems ?? ''}
            disabled={disabled}
            onChange={(event) => set('minItems', optionalNumber(event.target.value))}
          />
          <Input
            label="Max items"
            type="number"
            min={1}
            value={field.maxItems ?? ''}
            disabled={disabled}
            onChange={(event) => set('maxItems', optionalNumber(event.target.value))}
          />
        </div>
      )}
      {field.type === 'slug' && (
        <Select
          ariaLabel="Generate slug from"
          value={field.slugSource ?? ''}
          disabled={disabled}
          onValueChange={(value) => set('slugSource', value || undefined)}
          options={[
            { value: '', label: 'No source field' },
            ...siblings
              .filter((sibling) => sibling.type === 'text')
              .map((sibling) => ({ value: sibling.key, label: `Generate from ${sibling.label}` })),
          ]}
        />
      )}
      {field.type === 'select' && (
        <div>
          <label htmlFor={`options-${field.key}`} className={FIELD_LABEL_CLASS}>
            Choices, one per line
          </label>
          <textarea
            id={`options-${field.key}`}
            rows={4}
            className={cn(TEXTAREA_CLASS, 'mt-1')}
            disabled={disabled}
            value={(field.options ?? []).join('\n')}
            onChange={(event) =>
              set(
                'options',
                event.target.value
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
      )}
      {field.type === 'media' && (
        <ChipChoice
          label="Allowed files"
          options={(['image', 'video', 'audio', 'document'] as CmsMediaGroup[]).map((group) => ({ value: group, label: group }))}
          value={field.mediaGroups ?? []}
          disabled={disabled}
          emptyHint="Any file"
          onChange={(next) => set('mediaGroups', next as CmsMediaGroup[])}
        />
      )}
      {field.type === 'reference' && (
        <ChipChoice
          label="Can link to"
          options={referenceTypes.map((type) => ({ value: type.key, label: type.name }))}
          value={field.referenceTypes ?? []}
          disabled={disabled}
          emptyHint="Any content type"
          onChange={(next) => set('referenceTypes', next)}
        />
      )}
      {field.type === 'group' && (
        <div>
          <p className={cn(FIELD_LABEL_CLASS, 'mb-1.5')}>Nested fields</p>
          <div className="rounded-lg border border-rule/50 bg-field p-3">
            <FieldList
              fields={field.fields ?? []}
              onChange={(next) => set('fields', next)}
              disabled={disabled}
              depth={depth + 1}
              referenceTypes={referenceTypes}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ChipChoice({
  label,
  options,
  value,
  disabled,
  emptyHint,
  onChange,
}: {
  label: string;
  options: Array<{ value: string; label: string }>;
  value: string[];
  disabled: boolean;
  emptyHint: string;
  onChange: (next: string[]) => void;
}) {
  return (
    <fieldset>
      <legend className={FIELD_LABEL_CLASS}>{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {options.map((option) => {
          const on = value.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(on ? value.filter((item) => item !== option.value) : [...value, option.value])}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs capitalize',
                on ? 'border-primary bg-primary text-primary-foreground' : 'border-rule hover:bg-band',
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {value.length === 0 && <p className="mt-1 text-xs text-muted-foreground">{emptyHint}</p>}
    </fieldset>
  );
}

/** "https://www.example.com/blog/{slug}" → "example.com/blog/{slug}", short enough for a row. */
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

/**
 * The preview URL as a row: the template, shortened, is the button that opens
 * its input underneath — the Schedule card's pattern, so the aside stays quiet.
 */
function PreviewUrlRow({ value, disabled, onChange }: { value: string; disabled: boolean; onChange: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <InfoRow icon={Globe} title="Preview URL">
        <button
          type="button"
          aria-expanded={open}
          disabled={disabled && !value}
          onClick={() => setOpen((current) => !current)}
          className={cn(
            'inline-flex min-w-0 items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors hover:bg-band/60',
            value ? 'text-foreground' : 'text-muted-foreground',
          )}
        >
          <span className="max-w-36 truncate font-mono text-xs">{value ? shortUrl(value) : 'Not set'}</span>
          <ChevronDown size={14} className={cn('shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
        </button>
      </InfoRow>
      {open && (
        <div className="mt-3">
          <Input
            aria-label="Preview URL"
            value={value}
            disabled={disabled}
            autoFocus
            placeholder="https://www.example.com/blog/{slug}"
            hint="{slug}, {id} and {locale} are filled in per entry"
            onChange={(event) => onChange(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}

/** The roles that can write content, when the full catalogue cannot be read. */
const FALLBACK_ROLES = [
  { key: 'store_manager', name: 'Store manager' },
  { key: 'marketing_manager', name: 'Marketing manager' },
  { key: 'hr_manager', name: 'HR manager' },
  { key: 'barista', name: 'Barista' },
];

/**
 * Who may edit this model's entries. Empty is everyone who can edit content;
 * choosing roles narrows it (the owner always can). It never grants a
 * permission a role lacks — the API checks both. Saved on its own, at once.
 */
function TypeRolesSection({ typeId, typeName, editable }: { typeId: string; typeName: string; editable: boolean }) {
  const tenantId = useWorkspaceStore((state) => state.tenantId) ?? undefined;
  const queryClient = useQueryClient();
  const rolesQuery = useQuery({ queryKey: [...cmsKeys.contentType(typeId), 'roles'], queryFn: () => getCmsTypeRoles(typeId, tenantId) });
  // The catalogue needs a roles permission a model editor may not hold; fall back to the built-in names.
  const catalog = useQuery({
    queryKey: ['cms-role-catalog', tenantId],
    queryFn: () => getRoles(tenantId),
    retry: false,
    staleTime: 300_000,
  });
  const options = (
    catalog.data?.roles
      .filter((role) => role.key !== 'franchise_owner' && role.capabilities.includes('cms:write'))
      .map((role) => ({ key: role.key, name: role.name })) ?? FALLBACK_ROLES
  ).map((role) => ({ value: role.key, label: role.name }));
  const save = useMutation({
    mutationFn: (roles: string[]) => setCmsTypeRoles(typeId, roles, tenantId),
    onSuccess: () => {
      invalidateCms(queryClient);
      toast('success', 'Saved.');
    },
    onError: (error) => toast('error', error.message),
  });
  const roles = rolesQuery.data;
  const everyone = roles !== undefined && roles.length === 0;
  const busy = !editable || roles === undefined || save.isPending;
  const toggle = (key: string, on: boolean) => {
    if (!roles) return;
    save.mutate(on ? [...new Set([...roles, key])] : roles.filter((role) => role !== key));
  };

  return (
    <SettingsSection
      title="Who can edit"
      actions={
        <SectionInfo
          label={`Limit who can edit ${typeName} entries. Roles still need permission to edit content; this only narrows it. The owner always can.`}
        />
      }
    >
      {rolesQuery.isError ? (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-exception">Couldn’t load this model’s roles.</span>
          <Button size="sm" variant="ghost" onClick={() => void rolesQuery.refetch()}>
            Retry
          </Button>
        </div>
      ) : (
        <InfoRows>
          <InfoRow icon={Users} title="Everyone who can edit content">
            <Switch
              label="Everyone who can edit content"
              checked={everyone}
              disabled={busy}
              // Off starts from every role, so nothing changes until one is switched off.
              onChange={(on) => save.mutate(on ? [] : options.map((option) => option.value))}
            />
          </InfoRow>
          {roles !== undefined &&
            !everyone &&
            options.map((option) => {
              const on = roles.includes(option.value);
              const last = on && roles.length === 1;
              const control = (
                <Switch label={option.label} checked={on} disabled={busy || last} onChange={(next) => toggle(option.value, next)} />
              );
              return (
                <InfoRow key={option.value} icon={UserRound} title={option.label}>
                  {last ? (
                    <Tooltip side="top" align="end" wrap label="At least one role must be able to edit — or switch Everyone back on.">
                      {control}
                    </Tooltip>
                  ) : (
                    control
                  )}
                </InfoRow>
              );
            })}
          <InfoRow icon={ShieldCheck} title="Owner">
            <span className="text-sm text-muted-foreground">Always</span>
          </InfoRow>
        </InfoRows>
      )}
    </SettingsSection>
  );
}
