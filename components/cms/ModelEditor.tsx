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
  ChevronDown,
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
import { SaveBar, Switch } from '@/components/settings/controls';
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
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ModelAssist } from './ModelAssist';
import { FIELD_ICONS } from './fieldIcons';
import { ActionRow, ActionRows, FieldRow, InfoRow, InfoRows, PickerRow, RowMenu, RowTile, SectionInfo } from './rows';
import { FIELD_LABEL_CLASS, PanelError, TEXTAREA_CLASS, cmsKeys, copyText, invalidateCms } from './shared';
import { useCmsAccess } from './useCmsAccess';

type DetailRow = 'name' | 'key' | 'kind' | 'description' | 'title' | 'preview';

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
  // One detail open at a time; a new model starts with its name open.
  const [open, setOpen] = useState<DetailRow | null>(model ? null : 'name');
  const toggle = (row: DetailRow) => setOpen((current) => (current === row ? null : row));

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

  const titleLabel = titleCandidates.find((field) => field.key === titleField)?.label ?? 'First text field';

  return (
    <EditorShell
      eyebrow="Content model"
      title={model ? model.name : name.trim() || 'New content model'}
      icon={<KindIcon size={20} aria-hidden="true" />}
      onClose={onClose}
      dirty={dirty && editable}
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
              <SettingsSection title="Model" actions={model ? undefined : <Badge variant="muted">Not created yet</Badge>}>
                {model ? (
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
                        <span className="text-sm font-semibold tabular-nums text-foreground">{model.entryCount}</span>
                      </InfoRow>
                    )}
                    <InfoRow icon={Layers} title="Schema version">
                      <span className="text-sm tabular-nums text-muted-foreground">v{model.schemaVersion}</span>
                    </InfoRow>
                  </InfoRows>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Name it and add its fields, then create it. Its API key — <span className="font-mono">{key || '…'}</span> — is fixed
                    from then on.
                  </p>
                )}
              </SettingsSection>

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

              {model && (onBrowseEntries || editable) && (
                <SettingsSection title="Actions">
                  <ActionRows>
                    {onBrowseEntries && <ActionRow icon={FileText} label="Browse entries" onClick={() => onBrowseEntries(model.id)} />}
                    {editable && (
                      <ActionRow icon={Trash2} label={`Delete ${model.name}`} danger onClick={() => setDeleting({ force: false })} />
                    )}
                  </ActionRows>
                </SettingsSection>
              )}
            </>
          }
        >
          <SettingsSection title="Details">
            <fieldset disabled={!editable} className="min-w-0 space-y-3">
              <PickerRow
                icon={Type}
                title="Name"
                value={name.trim() || 'Not named'}
                muted={!name.trim()}
                open={open === 'name'}
                onToggle={() => toggle('name')}
              >
                <Input
                  id="cms-model-name"
                  aria-label="Name"
                  value={name}
                  placeholder="Blog post"
                  autoFocus
                  onChange={(event) => {
                    setName(event.target.value);
                    if (!keyTouched) setKey(keyFromName(event.target.value));
                  }}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">What editors see in Content — “Blog post”, “Menu special”, “Footer”.</p>
              </PickerRow>
              {/* Fixed once created — the Model card shows it from then on. */}
              {!model && (
                <PickerRow
                  icon={Hash}
                  title="API key"
                  value={key || 'Not set'}
                  muted={!key}
                  open={open === 'key'}
                  onToggle={() => toggle('key')}
                >
                  <Input
                    id="cms-model-key"
                    aria-label="API key"
                    className="font-mono"
                    value={key}
                    autoFocus
                    error={keyHolder ? `Already used by “${keyHolder.name}” — try ${uniqueKey(key, takenKeys)}` : undefined}
                    onChange={(event) => {
                      setKeyTouched(true);
                      setKey(event.target.value.toLowerCase());
                    }}
                  />
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Used in the delivery URL. Filled in from the name; can’t change once created.
                  </p>
                </PickerRow>
              )}
              <PickerRow
                icon={KindIcon}
                title="Kind"
                value={kind === 'singleton' ? 'Singleton' : 'Collection'}
                open={open === 'kind'}
                onToggle={() => toggle('kind')}
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
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {kind === 'singleton'
                    ? 'Exactly one entry — the site banner, the footer, opening hours.'
                    : 'Many entries of one shape — blog posts, menu sections.'}
                </p>
              </PickerRow>
              <PickerRow
                icon={AlignLeft}
                title="Description"
                value={description.trim() || 'None'}
                muted={!description.trim()}
                open={open === 'description'}
                onToggle={() => toggle('description')}
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
                <p className="mt-1.5 text-xs text-muted-foreground">Shown to editors when they create an entry of this model.</p>
              </PickerRow>
            </fieldset>
            {keyHolder && open !== 'key' && (
              <p className="mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
                <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
                <span>
                  “{key}” is already used by {keyHolder.name}. Open API key and choose another — {uniqueKey(key, takenKeys)} is free.
                </span>
              </p>
            )}
          </SettingsSection>

          <SettingsSection
            title="Fields"
            actions={
              <div className="flex items-center gap-2">
                <Badge variant="muted">{fields.length}</Badge>
                <SectionInfo
                  label={`The shape of every entry, in the order editors see it. Open a field to set its rules.${model ? ' Changing a field live entries use asks first, and shows how many it affects.' : ''}`}
                />
              </div>
            }
          >
            {(problems.length > 0 || serverIssues.length > 0) && (
              <div
                role="alert"
                className="mb-4 flex items-start gap-2 rounded-md bg-exception/6 px-3 py-2 text-xs font-medium text-exception"
              >
                <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
                <ul className="space-y-0.5">
                  {[...problems, ...serverIssues].map((problem) => (
                    <li key={problem}>{problem}</li>
                  ))}
                </ul>
              </div>
            )}
            <FieldList
              fields={fields}
              onChange={setFields}
              disabled={!editable}
              depth={0}
              referenceTypes={referenceTypes}
              saved={model?.fields ?? []}
              titleKey={resolvedTitleKey(fields, titleField)}
            />
          </SettingsSection>

          <SettingsSection
            title="Display"
            actions={<SectionInfo label="How entries of this model are named in lists, and where their page lives on your site." />}
          >
            <fieldset disabled={!editable} className="min-w-0 space-y-3">
              <PickerRow
                icon={Type}
                title="Entry title"
                value={titleLabel}
                muted={!titleField}
                open={open === 'title'}
                onToggle={() => toggle('title')}
              >
                <Select
                  className="w-full"
                  ariaLabel="Entry title field"
                  value={titleField}
                  onValueChange={setTitleField}
                  options={[
                    { value: '', label: 'First text field' },
                    ...titleCandidates.map((field) => ({ value: field.key, label: field.label })),
                  ]}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">Names each entry in lists and search.</p>
              </PickerRow>
              <PickerRow
                icon={Globe}
                title="Preview URL"
                value={previewUrl.trim() ? shortUrl(previewUrl.trim()) : 'Not set'}
                muted={!previewUrl.trim()}
                open={open === 'preview'}
                onToggle={() => toggle('preview')}
              >
                <Input
                  aria-label="Preview URL"
                  value={previewUrl}
                  autoFocus
                  placeholder="https://www.example.com/blog/{slug}"
                  onChange={(event) => setPreviewUrl(event.target.value)}
                />
                <p className="mt-1.5 text-xs text-muted-foreground">
                  Where an entry’s page lives — {'{slug}'}, {'{id}'} and {'{locale}'} are filled in per entry.
                </p>
              </PickerRow>
            </fieldset>
          </SettingsSection>

          {model && <TypeRolesSection typeId={model.id} typeName={model.name} editable={editable} />}

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
 * A model's fields as rows: what each is, its key and rules in words, and the
 * entry-title marker — tap a row to set it up underneath, one at a time; move,
 * duplicate and remove live in its ⋯ menu. Groups nest the same list.
 */
function FieldList({
  fields,
  onChange,
  disabled,
  depth,
  referenceTypes,
  saved,
  titleKey,
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
  const noun = depth > 0 ? 'nested field' : 'field';

  return (
    <div>
      {fields.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-rule px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">
            {depth > 0 ? 'No nested fields yet.' : 'No fields yet — every entry is made of them. A title is a good start.'}
          </p>
          {!disabled && (
            <Button size="sm" className="gap-1.5" onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" /> Add a {noun}
            </Button>
          )}
        </div>
      ) : (
        <ol className="-mx-2 space-y-1">
          {fields.map((field, index) => {
            const expanded = open === index;
            const Icon = FIELD_ICONS[field.type];
            const rules = fieldRules(field);
            const isTitle = depth === 0 && titleKey === field.key;
            const label = field.label || 'Untitled field';
            return (
              // Keyed by position, not by key: editing the API key must not remount the row (and drop focus).
              <li
                key={index}
                className={cn('rounded-lg transition-colors', expanded ? 'bg-band/40 ring-1 ring-rule/70' : 'hover:bg-band/40')}
              >
                <div className="flex items-center gap-2 px-2 py-1.5">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
                    aria-expanded={expanded}
                    onClick={() => setOpen(expanded ? null : index)}
                  >
                    <RowTile icon={Icon} />
                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate text-sm font-semibold text-foreground">{label}</span>
                        {isTitle && (
                          <Tooltip side="top" label="Entries are named by this field in lists and search — change it under Display">
                            <Badge variant="muted">Entry title</Badge>
                          </Tooltip>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {fieldTypeLabel(field.type)}
                        {field.type === 'group' ? ` of ${(field.fields ?? []).length}` : ''} ·{' '}
                        <span className="font-mono">{field.key}</span>
                        {rules.length > 0 && <> · {rules.join(' · ')}</>}
                      </span>
                    </span>
                    <ChevronDown
                      size={14}
                      className={cn('shrink-0 text-muted-foreground transition-transform', expanded && 'rotate-180')}
                      aria-hidden="true"
                    />
                  </button>
                  {!disabled && (
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
                      <div className="px-2 pb-3 pt-1 sm:pl-13">
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
              </li>
            );
          })}
        </ol>
      )}
      {!disabled && fields.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 border-dashed" onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" /> Add a {noun}
          </Button>
          {/* One click for the fields every page needs for search and sharing. */}
          {depth === 0 && !hasSeoBlock(fields) && (
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
          {depth === 0 && missingSeoFields(fields).length > 0 && (
            <Tooltip
              side="top"
              label={`Adds ${missingSeoFields(fields)
                .map((field) => field.label.toLowerCase())
                .join(', ')}`}
            >
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 text-muted-foreground"
                onClick={() => onChange(withFullSeoBlock(fields))}
              >
                <Search aria-hidden="true" /> Update SEO block ({missingSeoFields(fields).length} new)
              </Button>
            </Tooltip>
          )}
        </div>
      )}
      {adding && <AddFieldDialog depth={depth} onClose={() => setAdding(false)} onAdd={add} />}
    </div>
  );
}

/**
 * Adding a field, type first: find it (search narrows the grouped list), then
 * name it — or double-click a type to add it under its own name. The API key
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
      description="Pick what it holds, then name it."
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
                        'flex items-start gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
                        on ? 'border-primary bg-primary/6' : 'border-rule/60 hover:bg-band/50',
                      )}
                    >
                      <RowTile icon={Icon} tone={on ? 'success' : 'default'} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground">{entry.label}</span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">{entry.description}</span>
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        ))}
        {chosen && (
          <div className="rounded-md bg-band/50 p-3">
            <Input
              label="Name"
              value={label}
              placeholder={chosen.label}
              onChange={(event) => setLabel(event.target.value)}
              hint={`What editors see. API key: ${fieldKeyFromLabel(name) || chosen.type}`}
            />
          </div>
        )}
      </form>
    </Modal>
  );
}

const optionalNumber = (raw: string) => (raw.trim() === '' || !Number.isFinite(Number(raw)) ? undefined : Number(raw));

/**
 * One field's set-up, in the order people decide it: what it's called, what
 * it must hold (rules), what kind of value it takes (its type's own options),
 * and who sees it. Switches are rows; ranges are a min–max pair on one row.
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
    <InfoRow icon={icon} title={title} description={hint}>
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
    <FieldRow icon={icon} title={title} note="Leave empty for no limit">
      <div className="grid grid-cols-2 gap-2">
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
    </FieldRow>
  );
  /** A group's title, with what it decides behind the ⓘ — so a long panel reads as four short ones. */
  const heading = (text: string, hint: string) => (
    <div className="flex items-center justify-between gap-3">
      <h4 className="text-sm font-semibold tracking-title text-foreground">{text}</h4>
      <SectionInfo label={hint} />
    </div>
  );

  const typeOptions =
    field.type === 'slug' || field.type === 'select' || field.type === 'media' || field.type === 'reference' || field.type === 'group';

  return (
    <div className="divide-y divide-rule/40 [&>*]:py-4 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">
      <div className="space-y-3">
        {heading('Name', 'What editors see, and the key your website reads')}
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
        {saved && saved.key !== field.key && (
          <p className="flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured">
            <TriangleAlert size={14} className="mt-px shrink-0" aria-hidden="true" />
            <span>Renaming the key loses what entries stored under “{saved.key}”.</span>
          </p>
        )}
        <Input
          label="Help text"
          value={field.description ?? ''}
          disabled={disabled}
          placeholder="Shown under the field while editing"
          onChange={(event) => set('description', event.target.value || undefined)}
        />
      </div>

      <div className="space-y-3">
        {heading('Rules', 'What an entry must hold before it can be published')}
        {switchRow('required', AlertCircle, 'Required', 'Must be filled in to publish')}
        {['text', 'slug', 'email', 'url', 'number'].includes(field.type) &&
          depth === 0 &&
          switchRow('unique', Fingerprint, 'Unique', 'No two entries in a language share the value')}
        {canHoldList(field.type) &&
          switchRow('multiple', ListOrdered, field.type === 'group' ? 'Repeatable' : 'Allow several', 'Holds a list instead of one value')}
        {field.type === 'number' && switchRow('integer', Hash, 'Whole numbers only', 'Rejects decimals')}
        {textual && range('Length (characters)', 'minLength', 'maxLength', Type, 0)}
        {field.type === 'number' && range('Value', 'min', 'max', Hash)}
        {field.multiple && canHoldList(field.type) && range('Items', 'minItems', 'maxItems', ListOrdered, 0)}
        {field.type === 'text' && (
          <FieldRow icon={Fingerprint} title="Pattern" note="Optional">
            <div className="grid gap-2 sm:grid-cols-2">
              <Input
                aria-label="Pattern (regular expression)"
                className="font-mono"
                value={field.pattern ?? ''}
                disabled={disabled}
                placeholder="^[A-Z]{3}$"
                onChange={(event) => set('pattern', event.target.value || undefined)}
              />
              <Input
                aria-label="Message when it doesn’t match"
                value={field.patternMessage ?? ''}
                disabled={disabled}
                placeholder="Message when it doesn’t match"
                onChange={(event) => set('patternMessage', event.target.value || undefined)}
              />
            </div>
          </FieldRow>
        )}
      </div>

      {typeOptions && (
        <div className="space-y-3">
          {heading(fieldTypeLabel(field.type), `Settings only a ${fieldTypeLabel(field.type).toLowerCase()} field has`)}
          {field.type === 'slug' && (
            <FieldRow icon={Type} title="Made from">
              <Select
                className="w-full"
                ariaLabel="Generate slug from"
                value={field.slugSource ?? ''}
                disabled={disabled}
                onValueChange={(value) => set('slugSource', value || undefined)}
                options={[
                  { value: '', label: 'Typed by hand' },
                  ...siblings.filter((sibling) => sibling.type === 'text').map((sibling) => ({ value: sibling.key, label: sibling.label })),
                ]}
              />
            </FieldRow>
          )}
          {field.type === 'select' && (
            <FieldRow icon={ListOrdered} title="Choices" htmlFor={`options-${field.key}`} note="One per line">
              <textarea
                id={`options-${field.key}`}
                rows={4}
                className={TEXTAREA_CLASS}
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
            </FieldRow>
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
            <div className="rounded-lg border border-rule/50 bg-field px-3 py-1.5">
              <FieldList
                fields={field.fields ?? []}
                onChange={(next) => set('fields', next)}
                disabled={disabled}
                depth={depth + 1}
                referenceTypes={referenceTypes}
                saved={saved?.fields ?? []}
              />
            </div>
          )}
        </div>
      )}

      <div className="space-y-3">
        {heading('Visibility', 'Where its value goes')}
        {switchRow('private', EyeOff, 'Private', 'Editors see it; your website never receives it')}
        {(canShareField(field, depth) || field.shared) &&
          switchRow(
            'shared',
            Languages,
            'Same in every language',
            'Change it in one language and every other language changes too. Leave off for text you translate',
          )}
      </div>
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
