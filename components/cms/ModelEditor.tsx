'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import {
  AlertCircle,
  AlignLeft,
  ArrowDown,
  ArrowUp,
  Box,
  Check,
  Copy,
  EyeOff,
  FileText,
  Fingerprint,
  Globe,
  Hash,
  type IconComponent,
  Languages,
  Layers,
  ListOrdered,
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
import { ChangeRow, SaveBar, Switch, ValueAside, ValueMissing } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { ListRow, ListRowGroup } from '@/components/shared/ListRow';
import { Modal } from '@/components/shared/Modal';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone, LoadingState } from '@/components/shared/Skeleton';
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
import { toast } from '@/lib/toast';
import {
  FIELD_TYPES,
  canHoldList,
  duplicateField,
  fieldKeyFromLabel,
  canShareField,
  fieldListProblems,
  fieldRules,
  fieldTypeLabel,
  moveItem,
  newField,
  relabelField,
  resolvedTitleKey,
  typeKeyFromName,
  uniqueKey,
} from '@/lib/utils/cms';
import { type ModelDraft, mergeDraftFields, uniqueModelName } from '@/lib/utils/cms-model-draft';
import { SEO_FIELD, hasSeoBlock, missingSeoFields, withFullSeoBlock } from '@/lib/utils/cms-seo';
import { cn } from '@/lib/utils/cn';
import { useCmsTenantId } from '@/components/cms/ContentScope';

import { ModelAssist } from './ModelAssist';
import { FIELD_ICONS } from './fieldIcons';
import { InfoRow, InfoRows, RowMenu, RowTile, RowWarning, SectionInfo } from './rows';
import { FIELD_LABEL_CLASS, PanelError, TEXTAREA_CLASS, cmsKeys, copyText, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

type DetailRow = 'name' | 'key' | 'kind' | 'description' | 'title' | 'preview';

/** The model's own values, as they were when a row opened — Cancel puts that row's back. */
interface DetailSnapshot {
  name: string;
  key: string;
  keyTouched: boolean;
  kind: CmsContentTypeKind;
  description: string;
  titleField: string;
  previewUrl: string;
}

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
  const tenantId = useCmsTenantId();
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

/**
 * A model in the Settings → Account layout: a bento of Details · Display |
 * Ask DUMA · Who can edit, the field list under it as the page's one titled
 * list, and the entry form editors will get as a live preview in the rail.
 * One draft, saved through the SaveBar; Who can edit saves on its own.
 */
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
  const tenantId = useCmsTenantId() ?? undefined;
  const queryClient = useQueryClient();
  const access = useCmsAccess();
  const editable = access.canModel;
  const reduceMotion = useReducedMotion();
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
  // One row open at a time; a new model starts with its name open.
  const [open, setOpen] = useState<DetailRow | null>(model ? null : 'name');
  const [before, setBefore] = useState<DetailSnapshot | null>(null);
  /** Change opens a row; Cancel closes it and puts its value back as it was when it opened. */
  const toggle = (row: DetailRow) => {
    if (open === row) {
      if (before) {
        if (row === 'name') {
          setName(before.name);
          setKey(before.key);
          setKeyTouched(before.keyTouched);
        }
        if (row === 'key') {
          setKey(before.key);
          setKeyTouched(before.keyTouched);
        }
        if (row === 'kind') setKind(before.kind);
        if (row === 'description') setDescription(before.description);
        if (row === 'title') setTitleField(before.titleField);
        if (row === 'preview') setPreviewUrl(before.previewUrl);
      }
      setOpen(null);
      return;
    }
    setBefore({ name, key, keyTouched, kind, description, titleField, previewUrl });
    setOpen(row);
  };
  /** Enter in a row's field closes it, keeping what was typed. */
  const closeOnEnter = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      setOpen(null);
    }
  };

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

  // ⌘S / Ctrl+S saves, as on the entry page.
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

  const titleKey = resolvedTitleKey(fields, titleField);
  const titleFieldLabel = fields.find((field) => field.key === titleKey)?.label;

  const details = (
    <SettingsSection title="Details">
      <div className="min-w-0">
        <ChangeRow
          icon={Type}
          label="Name"
          value={name.trim() ? <span className="truncate">{name.trim()}</span> : <ValueMissing>Not named</ValueMissing>}
          open={open === 'name'}
          onToggle={editable ? () => toggle('name') : undefined}
        >
          <Input
            id="cms-model-name"
            aria-label="Name"
            value={name}
            placeholder="Blog post"
            autoFocus
            onKeyDown={closeOnEnter}
            onChange={(event) => {
              setName(event.target.value);
              if (!keyTouched) setKey(keyFromName(event.target.value));
            }}
          />
        </ChangeRow>
        {model ? (
          // Fixed once created: shown quietly, with a copy.
          <ChangeRow
            icon={Hash}
            label="API key"
            value={
              <>
                <span className="truncate font-mono text-[13px] font-medium">{model.key}</span>
                <ValueAside>· can’t change</ValueAside>
              </>
            }
            trailing={
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
            }
          />
        ) : (
          <ChangeRow
            icon={Hash}
            label="API key"
            value={
              key ? (
                <>
                  <span className="truncate font-mono text-[13px] font-medium">{key}</span>
                  {!keyTouched && <ValueAside>· from the name</ValueAside>}
                </>
              ) : (
                <ValueMissing>Not set</ValueMissing>
              )
            }
            open={open === 'key'}
            onToggle={editable ? () => toggle('key') : undefined}
          >
            <Input
              id="cms-model-key"
              aria-label="API key"
              className="font-mono"
              value={key}
              autoFocus
              onKeyDown={closeOnEnter}
              error={keyHolder ? `Already used by “${keyHolder.name}” — try ${uniqueKey(key, takenKeys)}` : undefined}
              hint={keyHolder ? undefined : 'Used in the delivery URL; it can’t change once created.'}
              onChange={(event) => {
                setKeyTouched(true);
                setKey(event.target.value.toLowerCase());
              }}
            />
          </ChangeRow>
        )}
        <ChangeRow
          icon={KindIcon}
          label="Kind"
          value={
            <>
              {kind === 'singleton' ? 'Singleton' : 'Collection'}
              <ValueAside>· {kind === 'singleton' ? 'exactly one entry' : 'many entries'}</ValueAside>
            </>
          }
          open={open === 'kind'}
          onToggle={editable ? () => toggle('kind') : undefined}
        >
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
        </ChangeRow>
        <ChangeRow
          icon={AlignLeft}
          label="Description"
          value={description.trim() ? <span className="truncate">{description.trim()}</span> : <ValueMissing>None</ValueMissing>}
          open={open === 'description'}
          onToggle={editable ? () => toggle('description') : undefined}
        >
          <textarea
            id="cms-model-description"
            aria-label="Description"
            rows={3}
            className={TEXTAREA_CLASS}
            value={description}
            autoFocus
            placeholder="What this is for, for the people writing it"
            onChange={(event) => setDescription(event.target.value)}
          />
        </ChangeRow>
      </div>
      {keyHolder && open !== 'key' && (
        <RowWarning className="mt-3">
          “{key}” is already used by {keyHolder.name}. Change the API key — {uniqueKey(key, takenKeys)} is free.
        </RowWarning>
      )}
    </SettingsSection>
  );

  const display = (
    <SettingsSection title="Display">
      <div className="min-w-0">
        <ChangeRow
          icon={Type}
          label="Entry title"
          value={
            titleFieldLabel ? (
              <>
                <span className="truncate">{titleFieldLabel}</span>
                {!titleField && <ValueAside>· first text field</ValueAside>}
              </>
            ) : (
              <ValueMissing>No text field</ValueMissing>
            )
          }
          open={open === 'title'}
          onToggle={editable ? () => toggle('title') : undefined}
        >
          {/* Straight to the list; choosing or dismissing folds the row back up. */}
          <Select
            className="w-full"
            ariaLabel="Entry title field"
            value={titleField}
            onValueChange={setTitleField}
            defaultOpen
            onOpenChange={(next) => !next && setOpen(null)}
            options={[
              { value: '', label: 'First text field' },
              ...titleCandidates.map((field) => ({ value: field.key, label: field.label })),
            ]}
          />
        </ChangeRow>
        <ChangeRow
          icon={Globe}
          label="Preview URL"
          value={
            previewUrl.trim() ? <span className="truncate">{shortUrl(previewUrl.trim())}</span> : <ValueMissing>Not set</ValueMissing>
          }
          open={open === 'preview'}
          onToggle={editable ? () => toggle('preview') : undefined}
        >
          <Input
            aria-label="Preview URL"
            value={previewUrl}
            autoFocus
            onKeyDown={closeOnEnter}
            placeholder="https://www.example.com/blog/{slug}"
            hint={`${'{slug}'}, ${'{id}'} and ${'{locale}'} are filled in per entry.`}
            onChange={(event) => setPreviewUrl(event.target.value)}
          />
        </ChangeRow>
      </div>
    </SettingsSection>
  );

  const assistSection = editable && (
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
  );
  const rolesSection = model && <TypeRolesSection typeId={model.id} typeName={model.name} editable={editable} />;

  return (
    <EditorShell
      eyebrow="Content model"
      title={model ? model.name : name.trim() || 'New content model'}
      icon={<KindIcon size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty && editable}
      actions={
        model && (onBrowseEntries || editable) ? (
          <>
            {onBrowseEntries && (
              <Button variant="outline" className="gap-1.5" onClick={() => onBrowseEntries(model.id)} aria-label={`${model.name} entries`}>
                <FileText aria-hidden="true" />
                Entries
                {typeof model.entryCount === 'number' && (
                  <span className="tabular-nums text-muted-foreground">{model.entryCount}</span>
                )}
              </Button>
            )}
            {editable && (
              <RowMenu
                label={`${model.name} actions`}
                items={[{ icon: Trash2, label: `Delete ${model.name}`, danger: true, onClick: () => setDeleting({ force: false }) }]}
              />
            )}
          </>
        ) : undefined
      }
    >
      <motion.div
        initial={reduceMotion ? false : 'hidden'}
        animate="shown"
        variants={{ shown: { transition: { staggerChildren: reduceMotion ? 0 : 0.06 } } }}
      >
        <SettingsTabBody>
          {/* Fields are the work, so they take the main column; the model's settings stack in the sidebar. */}
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="min-w-0">
              <FieldList
                fields={fields}
                onChange={setFields}
                disabled={!editable}
                depth={0}
                referenceTypes={referenceTypes}
                saved={model?.fields ?? []}
                titleKey={titleKey}
                issues={[...problems, ...serverIssues]}
                guarded={Boolean(model)}
              />
            </div>
            {/* Stacked (below lg) the settings come first, so a new model starts on its name. */}
            <div className="flex min-w-0 flex-col gap-5 max-lg:order-first">
              {details}
              {display}
              {assistSection}
              {rolesSection}
            </div>
          </div>

          {editable && (
            <SaveBar
              dirty={dirty || !model}
              saving={busy}
              saveLabel={model ? 'Save model' : 'Create model'}
              disabled={blocked}
              message={blockedReason || (model ? `Unsaved changes · ${saveShortcut} saves` : `Not created yet · ${saveShortcut} creates`)}
              onSave={() => checkThenSave.mutate()}
              onDiscard={() => {
                setOpen(null);
                if (model) onDiscard();
                else onClose();
              }}
            />
          )}
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

/**
 * A model's fields as one compact ordered list: each row a type tile, the
 * label, its type, key and rules on one quiet line, and the entry-title and
 * language marks. A tap opens the field's settings underneath, one at a time;
 * move, duplicate and remove live in its ⋯ menu. Groups nest the same list.
 */
function FieldList({
  fields,
  onChange,
  disabled,
  depth,
  referenceTypes,
  saved,
  titleKey,
  issues = [],
  guarded = false,
}: {
  fields: CmsFieldDefinition[];
  onChange: (fields: CmsFieldDefinition[]) => void;
  disabled: boolean;
  depth: number;
  referenceTypes: Array<{ key: string; name: string }>;
  /** The same list as last saved — its keys are ones entries already use. */
  saved: readonly CmsFieldDefinition[];
  /** The field entries are named by (top level only). */
  titleKey?: string | null;
  /** What stops the model saving (top level only). */
  issues?: string[];
  /** The model exists, so saving a risky change asks first (top level only). */
  guarded?: boolean;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const savedKeys = useMemo(() => new Set(saved.map((field) => field.key)), [saved]);

  const update = (index: number, next: CmsFieldDefinition) =>
    onChange(fields.map((field, position) => (position === index ? next : field)));
  const move = (from: number, to: number) => {
    onChange(moveItem(fields, from, to));
    if (open === from) setOpen(to);
    else if (open !== null && open >= Math.min(from, to) && open <= Math.max(from, to)) setOpen(open + (from < to ? -1 : 1));
  };
  const add = (type: CmsFieldType, label: string) => {
    onChange([...fields, newField(type, label, fields, depth)]);
    setAdding(false);
    setOpen(fields.length);
  };
  const top = depth === 0;

  const rows =
    fields.length === 0 ? (
      <div className="rounded-lg border border-dashed border-border px-4 py-5 text-center text-sm text-muted-foreground">
        {top ? 'No fields yet — a title is a good start.' : 'No nested fields yet.'}
      </div>
    ) : (
      <ListRowGroup aria-label={top ? 'Fields' : 'Nested fields'} className={cn(!top && 'bg-background shadow-none')}>
        {fields.map((field, index) => {
          const expanded = open === index;
          const rules = fieldRules(field);
          const isTitle = top && titleKey === field.key;
          const label = field.label || 'Untitled field';
          return (
            // Keyed by position, not by key: editing the API key must not remount the row (and drop focus).
            <ListRow
              key={index}
              icon={FIELD_ICONS[field.type]}
              iconLabel={fieldTypeLabel(field.type)}
              tone="muted"
              title={label}
              titleExtra={
                <>
                  {isTitle && (
                    <Tooltip side="top" label="Entries are named by this field — change it under Display">
                      <Badge variant="muted">Entry title</Badge>
                    </Tooltip>
                  )}
                  {field.shared && (
                    <Tooltip side="top" label="Same in every language">
                      <Languages size={13} className="shrink-0 text-muted-foreground" aria-label="Same in every language" />
                    </Tooltip>
                  )}
                </>
              }
              meta={
                <>
                  {fieldTypeLabel(field.type)}
                  {field.type === 'group' ? ` of ${(field.fields ?? []).length}` : ''} · <span className="font-mono">{field.key}</span>
                  {rules.length > 0 && <> · {rules.join(' · ')}</>}
                </>
              }
              onClick={() => setOpen(expanded ? null : index)}
              expanded={expanded}
              selected={expanded}
              control={
                disabled ? undefined : (
                  <RowMenu
                    label={`${label} actions`}
                    items={[
                      { icon: ArrowUp, label: 'Move up', disabled: index === 0, onClick: () => move(index, index - 1) },
                      {
                        icon: ArrowDown,
                        label: 'Move down',
                        disabled: index === fields.length - 1,
                        onClick: () => move(index, index + 1),
                      },
                      {
                        icon: Copy,
                        label: 'Duplicate',
                        onClick: () => {
                          const next = [...fields];
                          next.splice(index + 1, 0, duplicateField(field, fields));
                          onChange(next);
                          setOpen(index + 1);
                        },
                      },
                      {
                        icon: Trash2,
                        label: `Remove ${label}`,
                        danger: true,
                        onClick: () => {
                          onChange(fields.filter((_, position) => position !== index));
                          setOpen(null);
                          toast(
                            'success',
                            savedKeys.has(field.key)
                              ? `${label} removed — saving asks first if live entries use it. Discard brings it back.`
                              : `${label} removed.`,
                          );
                        },
                      },
                    ]}
                  />
                )
              }
              details={
                <AnimatePresence initial={false}>
                  {expanded && (
                    <motion.div
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0 }}
                      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      {/* Lined up under the row's text, past its tile. */}
                      <div className="px-3.5 pt-2 pb-4 sm:pl-[3.875rem]">
                        <FieldSettings
                          field={field}
                          siblings={fields}
                          disabled={disabled}
                          depth={depth}
                          referenceTypes={referenceTypes}
                          saved={saved.find((entry) => entry.key === field.key)}
                          savedKeys={savedKeys}
                          onChange={(next) => update(index, next)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              }
            />
          );
        })}
      </ListRowGroup>
    );

  const dialog = adding && <AddFieldDialog depth={depth} onClose={() => setAdding(false)} onAdd={add} />;

  if (!top)
    return (
      <div className="space-y-2">
        {rows}
        {!disabled && (
          <Button variant="outline" size="sm" className="gap-1.5 border-dashed" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> Add a nested field
          </Button>
        )}
        {dialog}
      </div>
    );

  const missingSeo = missingSeoFields(fields);
  return (
    <RecordGroup
      id="model-fields"
      title="Fields"
      actions={
        <div className="flex items-center gap-3">
          <span className="text-xs tabular-nums text-muted-foreground">
            {fields.length} {fields.length === 1 ? 'field' : 'fields'}
          </span>
          {!disabled && (
            <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" /> Add field
            </Button>
          )}
        </div>
      }
      footnote={guarded ? 'Changing a field live entries use shows what it affects before it saves.' : undefined}
    >
      {issues.length > 0 && (
        <div
          role="alert"
          className="mb-2 flex items-start gap-2 rounded-md bg-exception/6 px-3 py-2 text-xs font-medium text-exception"
        >
          <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
          <ul className="space-y-0.5">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      )}
      {rows}
      {!disabled && (!hasSeoBlock(fields) || missingSeo.length > 0) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {/* One click for the fields every page needs for search and sharing. */}
          {!hasSeoBlock(fields) && (
            <Tooltip side="top" label="Focus keyword, meta and social title and description, image, content type, canonical URL, indexing">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
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
          {missingSeo.length > 0 && (
            <Tooltip side="top" label={`Adds ${missingSeo.map((field) => field.label.toLowerCase()).join(', ')}`}>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={() => onChange(withFullSeoBlock(fields))}>
                <Search aria-hidden="true" /> Update SEO block ({missingSeo.length} new)
              </Button>
            </Tooltip>
          )}
        </div>
      )}
      {dialog}
    </RecordGroup>
  );
}

/**
 * Adding a field, type first: a grid of types (search narrows it), then a
 * name — or double-click a type to add it under its own name. The API key
 * is made from the name and shown as it will be.
 */
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
  const [search, setSearch] = useState('');
  // Slugs live at the top level, and groups nest at most two deep.
  const available = FIELD_TYPES.filter((entry) => !(depth > 0 && entry.type === 'slug') && !(depth >= 1 && entry.type === 'group'));
  const needle = search.trim().toLowerCase();
  const matches = needle
    ? available.filter((entry) => `${entry.label} ${entry.description} ${entry.group}`.toLowerCase().includes(needle))
    : available;
  const groups = [...new Set(matches.map((entry) => entry.group))];
  const chosen = available.find((entry) => entry.type === type);
  const name = label.trim() || chosen?.label || '';

  return (
    <Modal
      title={depth > 0 ? 'Add a nested field' : 'Add a field'}
      onClose={onClose}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="add-field" disabled={!type}>
            Add {chosen ? chosen.label.toLowerCase() : 'field'}
          </Button>
        </div>
      }
    >
      <form
        id="add-field"
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (type) onAdd(type, label);
        }}
      >
        <Input
          aria-label="Find a field type"
          placeholder="Find a type — text, image, date…"
          value={search}
          autoFocus
          leftIcon={<Search size={14} aria-hidden="true" />}
          onChange={(event) => setSearch(event.target.value)}
        />
        {groups.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No type matches “{search.trim()}”.</p>}
        {groups.map((group) => (
          <div key={group}>
            <p className="mb-1.5 text-label uppercase text-muted-foreground">{group}</p>
            <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label={group}>
              {matches
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
                      onDoubleClick={() => onAdd(entry.type, label)}
                      className={cn(
                        'flex items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        on ? 'border-primary/40 bg-primary/5' : 'border-border hover:bg-band/50',
                      )}
                    >
                      <RowTile icon={Icon} tone={on ? 'success' : 'default'} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-foreground">{entry.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{entry.description}</span>
                      </span>
                      {on && <Check size={14} className="shrink-0 text-primary" aria-hidden="true" />}
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
        {chosen && (
          <Input
            label="Name"
            value={label}
            placeholder={chosen.label}
            onChange={(event) => setLabel(event.target.value)}
            hint={`API key: ${fieldKeyFromLabel(name) || chosen.type}`}
          />
        )}
      </form>
    </Modal>
  );
}

const optionalNumber = (raw: string) => (raw.trim() === '' || !Number.isFinite(Number(raw)) ? undefined : Number(raw));

/**
 * One field's set-up, in the order people decide it: what it's called, its
 * type's own options, then what it must hold beside who sees it. Switches are
 * rows; ranges are a min–max pair on one row. No lines between the parts.
 */
function FieldSettings({
  field,
  siblings,
  disabled,
  depth,
  referenceTypes,
  saved,
  savedKeys,
  onChange,
}: {
  field: CmsFieldDefinition;
  siblings: CmsFieldDefinition[];
  disabled: boolean;
  depth: number;
  referenceTypes: Array<{ key: string; name: string }>;
  /** This field as last saved, if it was. */
  saved?: CmsFieldDefinition;
  savedKeys: ReadonlySet<string>;
  onChange: (next: CmsFieldDefinition) => void;
}) {
  const set = <K extends keyof CmsFieldDefinition>(key: K, value: CmsFieldDefinition[K]) => {
    const next = { ...field, [key]: value };
    if (value === undefined || value === false || (Array.isArray(value) && value.length === 0 && key !== 'options')) delete next[key];
    onChange(next);
  };
  const textual = ['text', 'longText', 'richText', 'slug', 'email', 'url'].includes(field.type);
  const isSaved = savedKeys.has(field.key);
  const switchRow = (key: 'required' | 'unique' | 'private' | 'multiple' | 'integer' | 'shared', icon: IconComponent, title: string, hint: string) => (
    <InfoRow icon={icon} title={title} description={hint} wrap>
      <Switch checked={Boolean(field[key])} disabled={disabled} label={title} onChange={(checked) => set(key, checked || undefined)} />
    </InfoRow>
  );
  const range = (
    title: string,
    minKey: 'minLength' | 'min' | 'minItems',
    maxKey: 'maxLength' | 'max' | 'maxItems',
    icon: IconComponent,
    floor?: number,
  ) => (
    <InfoRow icon={icon} title={title}>
      <div className="grid w-40 grid-cols-2 gap-1.5">
        <Input
          aria-label={`${title}: minimum`}
          type="number"
          min={floor}
          placeholder="Min"
          value={field[minKey] ?? ''}
          disabled={disabled}
          onChange={(event) => set(minKey, optionalNumber(event.target.value))}
        />
        <Input
          aria-label={`${title}: maximum`}
          type="number"
          min={floor === undefined ? undefined : Math.max(1, floor)}
          placeholder="Max"
          value={field[maxKey] ?? ''}
          disabled={disabled}
          onChange={(event) => set(maxKey, optionalNumber(event.target.value))}
        />
      </div>
    </InfoRow>
  );
  const heading = (text: string) => <h4 className="text-label uppercase text-muted-foreground">{text}</h4>;

  const typeOptions =
    field.type === 'slug' || field.type === 'select' || field.type === 'media' || field.type === 'reference' || field.type === 'group';

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Label"
            value={field.label}
            disabled={disabled}
            onChange={(event) => onChange(relabelField(field, event.target.value, siblings, savedKeys))}
          />
          <Input
            label="API key"
            className="font-mono"
            value={field.key}
            disabled={disabled}
            hint={isSaved ? undefined : 'Follows the label until you change it'}
            onChange={(event) => set('key', event.target.value.replace(/[^A-Za-z0-9_]/g, ''))}
          />
        </div>
        {saved && saved.key !== field.key && <RowWarning>Renaming the key loses what entries stored under “{saved.key}”.</RowWarning>}
        <Input
          label="Help text"
          value={field.description ?? ''}
          disabled={disabled}
          placeholder="Shown under the field while editing"
          onChange={(event) => set('description', event.target.value || undefined)}
        />
      </div>

      {typeOptions && (
        <div className="space-y-3">
          {heading(fieldTypeLabel(field.type))}
          {field.type === 'slug' && (
            <InfoRow icon={Type} title="Made from">
              <Select
                className="w-48"
                ariaLabel="Generate slug from"
                value={field.slugSource ?? ''}
                disabled={disabled}
                onValueChange={(value) => set('slugSource', value || undefined)}
                options={[
                  { value: '', label: 'Typed by hand' },
                  ...siblings.filter((sibling) => sibling.type === 'text').map((sibling) => ({ value: sibling.key, label: sibling.label })),
                ]}
              />
            </InfoRow>
          )}
          {field.type === 'select' && (
            <div>
              <label htmlFor={`options-${field.key}`} className={FIELD_LABEL_CLASS}>
                Choices, one per line
              </label>
              <textarea
                id={`options-${field.key}`}
                rows={4}
                className={cn(TEXTAREA_CLASS, 'mt-1.5')}
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
            <FieldList
              fields={field.fields ?? []}
              onChange={(next) => set('fields', next)}
              disabled={disabled}
              depth={depth + 1}
              referenceTypes={referenceTypes}
              saved={saved?.fields ?? []}
            />
          )}
        </div>
      )}

      <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          {heading('Rules')}
          <InfoRows>
            {switchRow('required', AlertCircle, 'Required', 'Must be filled in to publish')}
            {['text', 'slug', 'email', 'url', 'number'].includes(field.type) &&
              depth === 0 &&
              switchRow('unique', Fingerprint, 'Unique', 'No two entries in a language share the value')}
            {canHoldList(field.type) &&
              switchRow('multiple', ListOrdered, field.type === 'group' ? 'Repeatable' : 'Allow several', 'Holds a list instead of one value')}
            {field.type === 'number' && switchRow('integer', Hash, 'Whole numbers only', 'Rejects decimals')}
            {textual && range('Characters', 'minLength', 'maxLength', Type, 0)}
            {field.type === 'number' && range('Value', 'min', 'max', Hash)}
            {field.multiple && canHoldList(field.type) && range('Items', 'minItems', 'maxItems', ListOrdered, 0)}
          </InfoRows>
          {field.type === 'text' && (
            <div className="grid gap-2">
              <Input
                aria-label="Pattern (regular expression)"
                className="font-mono"
                value={field.pattern ?? ''}
                disabled={disabled}
                placeholder="Pattern, e.g. ^[A-Z]{3}$"
                onChange={(event) => set('pattern', event.target.value || undefined)}
              />
              {field.pattern && (
                <Input
                  aria-label="Message when it doesn’t match"
                  value={field.patternMessage ?? ''}
                  disabled={disabled}
                  placeholder="Message when it doesn’t match"
                  onChange={(event) => set('patternMessage', event.target.value || undefined)}
                />
              )}
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3">
          {heading('Visibility')}
          <InfoRows>
            {switchRow('private', EyeOff, 'Private', 'Editors see it; your website never receives it')}
            {(canShareField(field, depth) || field.shared) &&
              switchRow('shared', Languages, 'Same in every language', 'Changing it in one language changes it in all. Leave off for text you translate')}
          </InfoRows>
        </div>
      </div>
    </div>
  );
}

/** A pick-several choice as small labels; none picked means anything goes. */
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
      <legend className={FIELD_LABEL_CLASS}>
        {label}
        {value.length === 0 && <span className="font-normal text-muted-foreground"> · {emptyHint}</span>}
      </legend>
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
                'inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium capitalize transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60',
                on
                  ? 'border-primary/40 bg-primary/8 text-primary'
                  : 'border-border bg-control text-muted-foreground hover:text-foreground',
              )}
            >
              {on && <Check size={12} aria-hidden="true" />}
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** "https://www.example.com/blog/{slug}" → "example.com/blog/{slug}", short enough for a row. */
const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');

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
  const tenantId = useCmsTenantId() ?? undefined;
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
      actions={<SectionInfo label={`Narrows who can edit ${typeName} entries; a role still needs permission to edit content.`} />}
    >
      {rolesQuery.isPending ? (
        <div role="status" aria-busy="true" aria-label="Loading who can edit" className="space-y-5">
          {[0, 1].map((row) => (
            <div key={row} className="flex items-center gap-3" aria-hidden="true">
              <Bone className="size-10 shrink-0" />
              <span className="min-w-0 flex-1 space-y-1.5">
                <Bone className="h-2.5 w-20" />
                <Bone className="h-3.5 w-40 max-w-full" />
              </span>
            </div>
          ))}
        </div>
      ) : rolesQuery.isError ? (
        <ErrorState title="Couldn’t load this model’s roles" onRetry={() => void rolesQuery.refetch()} className="py-6" />
      ) : (
        <div>
          <ChangeRow
            icon={Users}
            label="Editors"
            value={
              everyone ? (
                'Everyone who can edit content'
              ) : (
                <>
                  {roles!.length} {roles!.length === 1 ? 'role' : 'roles'}
                  <ValueAside>· of {options.length}</ValueAside>
                </>
              )
            }
            trailing={
              <Switch
                label="Everyone who can edit content"
                checked={everyone}
                disabled={busy}
                // Off starts from every role, so nothing changes until one is switched off.
                onChange={(on) => save.mutate(on ? [] : options.map((option) => option.value))}
              />
            }
          />
          {!everyone &&
            options.map((option) => {
              const on = roles!.includes(option.value);
              const last = on && roles!.length === 1;
              const control = (
                <Switch label={option.label} checked={on} disabled={busy || last} onChange={(next) => toggle(option.value, next)} />
              );
              return (
                <ChangeRow
                  key={option.value}
                  icon={UserRound}
                  label={option.label}
                  value={on ? 'Can edit' : <ValueMissing>Can’t edit</ValueMissing>}
                  trailing={
                    last ? (
                      <Tooltip side="top" align="end" wrap label="At least one role must be able to edit — or switch Everyone back on.">
                        {control}
                      </Tooltip>
                    ) : (
                      control
                    )
                  }
                />
              );
            })}
          <ChangeRow icon={ShieldCheck} label="Owner" value="Always can edit" />
        </div>
      )}
    </SettingsSection>
  );
}
