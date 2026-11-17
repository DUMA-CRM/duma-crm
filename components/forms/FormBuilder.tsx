'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { RowMenu, RowTile } from '@/components/cms/rows';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  Copy,
  Eye,
  FileText,
  GripVertical,
  Monitor,
  Pencil,
  Plus,
  Route,
  Search,
  Smartphone,
  Star,
  Trash2,
  X,
} from '@/components/icons';
import { Switch } from '@/components/settings/controls';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { dropIndex, moveItem } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import { accentInk } from '@/lib/utils/form-accent';
import type { FormDraft } from '@/lib/utils/form-draft';
import { blankQuestion, changeFieldType, guessFieldType, newOption } from '@/lib/utils/form-questions';
import {
  FIELD_TYPES,
  type FormField,
  type FormFieldType,
  type Problem,
  duplicateField,
  fieldTypeLabel,
  isChoiceField,
  isInputField,
  keyFromLabel,
  logicSummary,
  newField,
  problemFieldIndex,
  ratingMax,
  removeField,
  scaleRange,
} from '@/lib/utils/forms';

import { FieldSettings, logicSources, startLogic } from './FieldInspector';
import { FormRenderer } from './FormRenderer';
import { FIELD_ICONS } from './field-icons';

/** A private drag type, so a drop from elsewhere (a file, a link) is never read as a question. */
const DRAG_FIELD = 'application/x-duma-form-field';

/** The types the type menu shows before anything is typed; search finds the rest. */
const COMMON_TYPES: readonly FormFieldType[] = [
  'short_text',
  'long_text',
  'radio',
  'checkboxes',
  'email',
  'phone',
  'number',
  'date',
  'rating',
  'yes_no',
];

type Mode = 'edit' | 'preview';
type Device = 'desktop' | 'phone';

const focusLabel = (id: string, select = false) =>
  requestAnimationFrame(() => {
    const box = document.getElementById(`label-${id}`) as HTMLTextAreaElement | null;
    box?.focus();
    if (select) box?.select();
  });

/**
 * The builder: the form as one centred column, each question a card edited
 * where it stands. A card shows its question, type, Required and options;
 * choosing it opens the rest underneath (help text, limits, width, logic).
 * Everything else about the form is in Settings.
 *
 * Enter in a question adds the next one; "/" in an empty one picks its type;
 * a new question takes the type its words suggest until one is picked. Drag
 * the handle or Alt+↑/↓ to reorder. Preview swaps in the real form.
 */
export function FormBuilder({
  draft,
  onChange,
  readOnly,
  problems,
  focusFieldId,
  onFocused,
}: {
  draft: FormDraft;
  onChange: (next: FormDraft | ((current: FormDraft) => FormDraft)) => void;
  readOnly: boolean;
  problems: Problem[];
  focusFieldId: string | null;
  onFocused: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const fields = draft.definition.fields;
  const [selectedId, setSelectedId] = useState<string | null>(focusFieldId ?? null);
  const [mode, setMode] = useState<Mode>('edit');
  const [device, setDevice] = useState<Device>('desktop');
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropAt, setDropAt] = useState<number | null>(null);
  // Questions written this session (or still empty): their key follows their words,
  // and — until a type is picked (false) — so does their type.
  const [following, setFollowing] = useState<ReadonlyMap<string, boolean>>(
    () => new Map(fields.filter((field) => isInputField(field) && !field.label.trim()).map((field) => [field.id, true])),
  );

  // A problem elsewhere (Publish refused) opens the question it's about.
  const [lastFocus, setLastFocus] = useState(focusFieldId);
  if (focusFieldId !== lastFocus) {
    setLastFocus(focusFieldId);
    if (focusFieldId) {
      setSelectedId(focusFieldId);
      setMode('edit');
    }
  }
  useEffect(() => {
    if (!focusFieldId) return;
    document.getElementById(`card-${focusFieldId}`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' });
    onFocused();
  }, [focusFieldId, onFocused, reduceMotion]);

  const setFields = (next: FormField[]) => onChange((current) => ({ ...current, definition: { ...current.definition, fields: next } }));
  const mapField = (id: string, update: (field: FormField, all: FormField[]) => FormField) =>
    onChange((current) => ({
      ...current,
      definition: {
        ...current.definition,
        fields: current.definition.fields.map((field, _, all) => (field.id === id ? update(field, all) : field)),
      },
    }));
  const updateField = (id: string, patch: Partial<FormField>) => mapField(id, (field) => ({ ...field, ...patch }));

  /** Typing a question's words: a new question's key — and, until a type is picked, its type — follow them. */
  const setLabel = (id: string, label: string) => {
    const guessing = following.get(id);
    mapField(id, (field, all) => {
      if (guessing === undefined || !isInputField(field)) return { ...field, label };
      const taken = new Set(all.filter((other) => other.id !== id).map((other) => other.key));
      const next = { ...field, label, key: keyFromLabel(label || 'question', taken) };
      if (!guessing || isChoiceField(field) || field.type === 'hidden' || field.type === 'consent') return next;
      return changeFieldType(next, guessFieldType(label));
    });
  };
  const pickType = (id: string, type: FormFieldType) => {
    mapField(id, (field) => changeFieldType(field, type));
    setFollowing((current) => (current.has(id) ? new Map(current).set(id, false) : current));
    focusLabel(id);
  };

  const insertAt = (index: number) => {
    const field = blankQuestion(fields);
    setFields([...fields.slice(0, index), field, ...fields.slice(index)]);
    setFollowing((current) => new Map(current).set(field.id, true));
    setSelectedId(field.id);
    setMode('edit');
    focusLabel(field.id);
  };
  /** A new step: just the divider. Until a question follows it, Publish lists it as a thing to fix; drafts still save. */
  const insertPageAt = (index: number) => {
    const pageBreak = newField('page_break', fields);
    setFields([...fields.slice(0, index), pageBreak, ...fields.slice(index)]);
    setSelectedId(pageBreak.id);
    setMode('edit');
  };
  const move = (id: string, by: number) => {
    const from = fields.findIndex((field) => field.id === id);
    const to = from + by;
    if (from < 0 || to < 0 || to >= fields.length) return;
    setFields(moveItem(fields, from, to));
  };
  const duplicate = (id: string) => {
    const result = duplicateField(fields, id);
    setFields(result.fields);
    if (result.copyId) setSelectedId(result.copyId);
  };
  const remove = (id: string, focusPrevious = false) => {
    const index = fields.findIndex((field) => field.id === id);
    onChange((current) => ({ ...current, definition: removeField(current.definition, id) }));
    const neighbour = focusPrevious ? (fields[index - 1] ?? fields[index + 1]) : (fields[index + 1] ?? fields[index - 1]);
    const next = neighbour && neighbour.id !== id ? neighbour.id : null;
    setSelectedId(next);
    if (next && focusPrevious) focusLabel(next);
  };

  // Keyboard on the chosen question: Alt+↑/↓ moves it, ⌘D duplicates, Delete removes (outside a text box), Esc closes it.
  useEffect(() => {
    if (readOnly || mode !== 'edit' || !selectedId) return;
    const onKey = (event: KeyboardEvent) => {
      if (document.querySelector('[role="dialog"]')) return;
      const target = event.target as HTMLElement | null;
      const typing = target?.closest('input, textarea, select, [contenteditable="true"], [role="combobox"]');
      if (event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
        event.preventDefault();
        move(selectedId, event.key === 'ArrowUp' ? -1 : 1);
      } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'd') {
        event.preventDefault();
        duplicate(selectedId);
      } else if (!typing && (event.key === 'Delete' || event.key === 'Backspace')) {
        event.preventDefault();
        remove(selectedId);
      } else if (event.key === 'Escape') {
        // Closes the question, not the editor: stop it before the shell's Escape-to-go-back.
        event.stopPropagation();
        target?.blur?.();
        setSelectedId(null);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  });

  /** Where a drop over the card at `index` lands: before it in its top half, after it in its bottom half. */
  const overCard = (event: React.DragEvent, index: number) => {
    if (!event.dataTransfer.types.includes(DRAG_FIELD)) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    setDropAt(event.clientY > box.top + box.height / 2 ? index + 1 : index);
  };
  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    const id = event.dataTransfer.getData(DRAG_FIELD);
    const at = dropAt ?? fields.length;
    const from = fields.findIndex((field) => field.id === id);
    if (id && from >= 0) setFields(moveItem(fields, from, at > from ? dropIndex(from, at - 1, true) : dropIndex(from, at, false)));
    setDropAt(null);
    setDragging(null);
  };

  const pageOf = useMemo(() => {
    const pages = new Map<string, number>();
    let page = 1;
    for (const field of fields) {
      if (field.type === 'page_break') page += 1;
      pages.set(field.id, page);
    }
    return pages;
  }, [fields]);
  const problemsOf = useMemo(() => {
    const byId = new Map<string, string[]>();
    for (const problem of problems) {
      const index = problemFieldIndex(problem);
      const field = index === null ? undefined : fields[index];
      if (field) byId.set(field.id, [...(byId.get(field.id) ?? []), problem.message]);
    }
    return byId;
  }, [problems, fields]);
  const accent = draft.definition.accentColor || 'var(--primary)';

  return (
    <div className="mx-auto w-full max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SegmentedControl<Mode>
          value={mode}
          onChange={setMode}
          ariaLabel="Edit or preview"
          options={[
            { value: 'edit', label: 'Edit', icon: Pencil },
            { value: 'preview', label: 'Preview', icon: Eye },
          ]}
        />
        {mode === 'preview' && (
          <SegmentedControl<Device>
            value={device}
            onChange={setDevice}
            iconOnly
            ariaLabel="Preview size"
            options={[
              { value: 'desktop', label: 'Desktop', icon: Monitor },
              { value: 'phone', label: 'Phone', icon: Smartphone },
            ]}
          />
        )}
        {problems.length > 0 && (
          <span className="ml-auto">
            <ProblemsButton problems={problems} fields={fields} onPick={(id) => (setSelectedId(id), setMode('edit'))} />
          </span>
        )}
      </div>

      {mode === 'preview' ? (
        <div
          className={cn(
            'mx-auto rounded-lg border border-border bg-card px-5 py-7 shadow-sm transition-[max-width] sm:px-10 sm:py-9',
            device === 'phone' ? 'max-w-[390px] sm:px-5' : 'max-w-2xl',
          )}
        >
          <FormRenderer
            key={JSON.stringify(draft.definition)}
            preview
            form={{
              name: draft.name || 'Untitled form',
              description: draft.description,
              fields,
              submitLabel: draft.definition.submitLabel || 'Submit',
              successTitle: draft.definition.successTitle || 'Thank you!',
              successMessage: draft.definition.successMessage || 'Your response has been received.',
              redirectUrl: draft.definition.redirectUrl,
              showProgress: draft.definition.showProgress ?? true,
              accentColor: draft.definition.accentColor,
            }}
            onSubmit={async () => ({
              successTitle: draft.definition.successTitle || 'Thank you!',
              successMessage: draft.definition.successMessage || 'Your response has been received.',
              redirectUrl: draft.definition.redirectUrl || null,
            })}
          />
        </div>
      ) : (
        <div
          style={{ '--form-accent': accent, '--form-ink': accentInk(draft.definition.accentColor) } as React.CSSProperties}
          onDrop={drop}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null);
          }}
          onClick={(event) => event.target === event.currentTarget && setSelectedId(null)}
        >
          {/* The name and description, edited where respondents read them. */}
          <div className="px-1 pb-5">
            <textarea
              id="form-name"
              aria-label="Form name"
              rows={1}
              value={draft.name}
              readOnly={readOnly}
              onChange={(event) => onChange((current) => ({ ...current, name: event.target.value.replace(/\n/g, ' ') }))}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
                event.preventDefault();
                if (fields[0]) focusLabel(fields[0].id);
              }}
              onFocus={() => setSelectedId(null)}
              placeholder="Untitled form"
              maxLength={120}
              className="field-sizing-content w-full resize-none rounded-sm bg-transparent text-2xl font-semibold tracking-title text-heading outline-none placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring/40"
            />
            <textarea
              aria-label="Form description"
              value={draft.description}
              readOnly={readOnly}
              onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))}
              onFocus={() => setSelectedId(null)}
              placeholder="Add a description"
              maxLength={500}
              rows={1}
              className="mt-1 field-sizing-content w-full resize-none rounded-sm bg-transparent text-sm leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/60 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring/40"
            />
          </div>

          {fields.length > 0 && (
            <ol className="flex flex-col gap-3" aria-label="Questions">
              <AnimatePresence initial={false}>
                {fields.map((field, index) => (
                  <motion.li
                    key={field.id}
                    layout={!reduceMotion && !dragging ? 'position' : false}
                    initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={reduceMotion ? undefined : { opacity: 0, transition: { duration: 0.12 } }}
                    onDragOver={(event) => overCard(event, index)}
                    className="relative"
                  >
                    {dropAt === index && <DropLine />}
                    <QuestionCard
                      field={field}
                      fields={fields}
                      page={pageOf.get(field.id) ?? 1}
                      selected={field.id === selectedId}
                      dragging={dragging === field.id}
                      problems={problemsOf.get(field.id)}
                      allProblems={problems}
                      readOnly={readOnly}
                      first={index === 0}
                      last={index === fields.length - 1}
                      onSelect={() => setSelectedId(field.id)}
                      onLabel={(label) => setLabel(field.id, label)}
                      onChange={(patch) => updateField(field.id, patch)}
                      onType={(type) => pickType(field.id, type)}
                      onNext={() => insertAt(index + 1)}
                      onRemoveEmpty={() => following.has(field.id) && remove(field.id, true)}
                      onMove={(by) => move(field.id, by)}
                      onDuplicate={() => duplicate(field.id)}
                      onRemove={() => remove(field.id)}
                      onDragStart={(event) => {
                        event.dataTransfer.setData(DRAG_FIELD, field.id);
                        event.dataTransfer.effectAllowed = 'move';
                        setDragging(field.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setDropAt(null);
                      }}
                    />
                    {dropAt === index + 1 && index === fields.length - 1 && <DropLine after />}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ol>
          )}

          {!readOnly && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="outline" className="gap-1.5 border-dashed pointer-coarse:h-11" onClick={() => insertAt(fields.length)}>
                <Plus aria-hidden="true" />
                Add question
              </Button>
              <Button
                variant="outline"
                className="gap-1.5 border-dashed pointer-coarse:h-11"
                disabled={fields.length === 0}
                onClick={() => insertPageAt(fields.length)}
              >
                <FileText aria-hidden="true" />
                New page
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DropLine({ after = false }: { after?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-x-2 z-10 h-0.5 rounded-full bg-(--form-accent)', after ? '-bottom-2' : '-top-2')}
    />
  );
}

const labelBox =
  'field-sizing-content block w-full min-w-0 resize-none bg-transparent outline-none placeholder:text-muted-foreground/60 read-only:cursor-default';

/**
 * One question. At rest it reads as respondents will see it; chosen, it shows
 * its type, Required, its options to edit, ⋯, and its other settings under it.
 */
function QuestionCard({
  field,
  fields,
  page,
  selected,
  dragging,
  problems,
  allProblems,
  readOnly,
  first,
  last,
  onSelect,
  onLabel,
  onChange,
  onType,
  onNext,
  onRemoveEmpty,
  onMove,
  onDuplicate,
  onRemove,
  onDragStart,
  onDragEnd,
}: {
  field: FormField;
  fields: FormField[];
  page: number;
  selected: boolean;
  dragging: boolean;
  problems: string[] | undefined;
  allProblems: Problem[];
  readOnly: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onLabel: (label: string) => void;
  onChange: (patch: Partial<FormField>) => void;
  onType: (type: FormFieldType) => void;
  onNext: () => void;
  onRemoveEmpty: () => void;
  onMove: (by: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const [typeOpen, setTypeOpen] = useState(false);
  const logic = logicSummary(field, fields);
  const canLogic = !readOnly && !field.logic?.conditions.length && logicSources(field, fields).length > 0;
  const input = isInputField(field);

  const menu = readOnly ? null : (
    <span className="pointer-coarse:[&_button]:size-11">
      <RowMenu
        label="Question actions"
        items={[
          ...(canLogic ? [{ icon: Route, label: 'Show only if…', onClick: () => onChange({ logic: startLogic(field, fields) }) }] : []),
          { icon: Copy, label: 'Duplicate', onClick: onDuplicate },
          ...(!first ? [{ icon: ArrowUp, label: 'Move up', onClick: () => onMove(-1) }] : []),
          ...(!last ? [{ icon: ArrowDown, label: 'Move down', onClick: () => onMove(1) }] : []),
          { icon: Trash2, label: 'Delete', danger: true, onClick: onRemove },
        ]}
      />
    </span>
  );

  const labelKeys = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (readOnly || event.nativeEvent.isComposing) return;
    if (event.key === 'Enter' && !event.shiftKey && field.type !== 'paragraph') {
      event.preventDefault();
      onNext();
    } else if (event.key === '/' && !field.label && input) {
      event.preventDefault();
      setTypeOpen(true);
    } else if (event.key === 'Backspace' && !field.label) {
      event.preventDefault();
      onRemoveEmpty();
    }
  };

  const grip = !readOnly && (
    <span
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      aria-hidden="true"
      className={cn(
        'absolute top-3 left-0.5 hidden h-6 w-5 cursor-grab items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-band active:cursor-grabbing pointer-fine:flex',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}
    >
      <GripVertical size={14} />
    </span>
  );

  // "+" on the card's lower edge: a new question just below.
  const addBelow = !readOnly && (
    <button
      type="button"
      aria-label="Add a question below"
      onClick={(event) => {
        event.stopPropagation();
        onNext();
      }}
      className={cn(
        'absolute -bottom-3 left-1/2 z-10 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-opacity hover:text-foreground focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring',
        selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
      )}
    >
      <Plus size={13} aria-hidden="true" />
    </button>
  );

  const frame = cn(
    'group relative rounded-lg border bg-card px-4 py-3.5 shadow-sm transition-colors sm:px-6',
    selected ? 'border-(--form-accent)/45 ring-2 ring-(--form-accent)/10' : problems ? 'border-exception/30' : 'border-border',
    dragging && 'opacity-40',
  );

  if (field.type === 'page_break') {
    return (
      <div id={`card-${field.id}`} onClick={onSelect} onFocus={onSelect} className={cn(frame, 'flex items-center gap-3 py-2')}>
        {grip}
        <span className="h-px flex-1 border-t border-dashed border-border" />
        <span className="text-label text-muted-foreground uppercase">Page {page}</span>
        <span className="h-px flex-1 border-t border-dashed border-border" />
        {menu}
        {addBelow}
      </div>
    );
  }

  const Icon = FIELD_ICONS[field.type];
  const label =
    field.type === 'heading' ? (
      <textarea
        id={`label-${field.id}`}
        aria-label="Heading"
        rows={1}
        value={field.label}
        readOnly={readOnly}
        maxLength={500}
        onChange={(event) => onLabel(event.target.value)}
        onKeyDown={labelKeys}
        placeholder="Heading"
        className={cn(labelBox, 'text-lg font-semibold tracking-title text-heading')}
      />
    ) : field.type === 'paragraph' ? (
      <textarea
        id={`label-${field.id}`}
        aria-label="Text"
        rows={1}
        value={field.label}
        readOnly={readOnly}
        maxLength={2000}
        onChange={(event) => onLabel(event.target.value)}
        onKeyDown={labelKeys}
        placeholder="Some words for respondents"
        className={cn(labelBox, 'text-sm leading-relaxed text-muted-foreground')}
      />
    ) : (
      <div className="flex min-w-0 items-start gap-2.5">
        {field.type === 'consent' && <span className="mt-1 size-4 shrink-0 rounded-[4px] border border-rule" aria-hidden="true" />}
        {field.type === 'hidden' && <Icon size={14} aria-hidden="true" className="mt-1 shrink-0 text-muted-foreground" />}
        <textarea
          id={`label-${field.id}`}
          aria-label={field.type === 'consent' ? 'What they agree to' : 'Question'}
          rows={1}
          value={field.label}
          readOnly={readOnly}
          maxLength={500}
          onChange={(event) => onLabel(event.target.value)}
          onKeyDown={labelKeys}
          placeholder={field.type === 'consent' ? 'I agree to…' : 'Question'}
          className={cn(labelBox, 'text-[15px] font-semibold text-foreground sm:text-sm')}
        />
        {field.required && (
          <span className="mt-0.5 text-exception" aria-hidden="true">
            *
          </span>
        )}
      </div>
    );

  return (
    <div id={`card-${field.id}`} onClick={onSelect} onFocus={onSelect} className={frame}>
      {grip}
      {/* ⋯ sits on the question's own line, top right — shown on the open card, on hover elsewhere. */}
      <div className="flex min-w-0 items-start gap-2">
        <div className="min-w-0 flex-1">{label}</div>
        {menu && (
          <div
            className={cn(
              '-mt-1 -mr-2 shrink-0 transition-opacity',
              !selected && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100 pointer-coarse:opacity-100',
            )}
          >
            {menu}
          </div>
        )}
      </div>
      {field.type === 'hidden' ? (
        <p className="mt-1 truncate font-mono text-xs text-muted-foreground">
          Filled from ?{field.key}=… on the link{field.defaultValue && ` · else “${field.defaultValue}”`}
        </p>
      ) : (
        input &&
        field.type !== 'consent' && (
          <>
            {field.description && !selected && <p className="mt-0.5 text-xs text-muted-foreground">{field.description}</p>}
            <div className="mt-2.5">
              {selected && isChoiceField(field) && !readOnly ? (
                <OptionsEditor field={field} onChange={onChange} />
              ) : (
                <FieldGhost field={field} />
              )}
            </div>
          </>
        )
      )}

      {!selected && (logic || problems) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          {logic && (
            <Badge variant="reference" className="max-w-full gap-1">
              <Route size={11} aria-hidden="true" />
              <span className="truncate">{logic}</span>
            </Badge>
          )}
          {problems?.map((problem) => (
            <Badge key={problem} variant="destructive" className="max-w-full gap-1">
              <AlertTriangle size={11} aria-hidden="true" />
              <span className="truncate">{problem}</span>
            </Badge>
          ))}
        </div>
      )}

      {selected && !readOnly && (
        <>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TypeMenu field={field} open={typeOpen} onOpenChange={setTypeOpen} onPick={onType} />
            <span className="flex-1" />
            {input && field.type !== 'hidden' && (
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground pointer-coarse:min-h-11">
                Required
                <Switch checked={Boolean(field.required)} onChange={(required) => onChange({ required })} label="Required" />
              </label>
            )}
          </div>
          <FieldSettings field={field} fields={fields} readOnly={readOnly} problems={allProblems} onChange={onChange} />
        </>
      )}
      {selected && readOnly && <FieldSettings field={field} fields={fields} readOnly problems={allProblems} onChange={onChange} />}
      {addBelow}
    </div>
  );
}

/**
 * The type chip and its menu: the common types, and a search over the rest.
 * "/" in an empty question opens it too.
 */
function TypeMenu({
  field,
  open,
  onOpenChange,
  onPick,
}: {
  field: FormField;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (type: FormFieldType) => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const Icon = FIELD_ICONS[field.type];
  const search = query.trim().toLowerCase();
  const shown = search
    ? FIELD_TYPES.filter((entry) => `${entry.label} ${entry.hint} ${entry.group}`.toLowerCase().includes(search))
    : FIELD_TYPES.filter((entry) => COMMON_TYPES.includes(entry.type));
  const pick = (type: FormFieldType) => {
    onOpenChange(false);
    setQuery('');
    onPick(type);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setQuery('');
        setActive(0);
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 pointer-coarse:h-11" aria-label={`Type: ${fieldTypeLabel(field.type)}`}>
          <Icon aria-hidden="true" />
          {fieldTypeLabel(field.type)}
          <ChevronDown aria-hidden="true" className="text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(calc(100vw-2rem),17rem)] p-1.5">
        <div className="relative mb-1">
          <Search size={14} aria-hidden="true" className="absolute top-1/2 left-2.5 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            aria-label="Find a type"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                setActive((current) => (current + (event.key === 'ArrowDown' ? 1 : -1) + shown.length) % Math.max(shown.length, 1));
              } else if (event.key === 'Enter' && shown[active]) {
                event.preventDefault();
                pick(shown[active]!.type);
              }
            }}
            placeholder="Search types"
            className="h-9 w-full rounded-md bg-band/50 pr-2 pl-8 text-sm outline-none placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring/40"
          />
        </div>
        <ul role="listbox" aria-label="Question types" className="max-h-72 overflow-y-auto">
          {shown.map((entry, index) => {
            const EntryIcon = FIELD_ICONS[entry.type];
            return (
              <li key={entry.type} role="option" aria-selected={entry.type === field.type}>
                <button
                  type="button"
                  onClick={() => pick(entry.type)}
                  onMouseEnter={() => setActive(index)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground pointer-coarse:min-h-11',
                    index === active && 'bg-band/70',
                  )}
                >
                  <EntryIcon size={14} aria-hidden="true" className="shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{entry.label}</span>
                  {entry.type === field.type && <span className="text-xs text-muted-foreground">Current</span>}
                </button>
              </li>
            );
          })}
          {shown.length === 0 && <li className="px-2 py-3 text-center text-xs text-muted-foreground">No type matches.</li>}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** A choice's options, edited on the card: Enter adds the next, Backspace in an empty one removes it, a pasted list adds them all. */
function OptionsEditor({ field, onChange }: { field: FormField; onChange: (patch: Partial<FormField>) => void }) {
  const options = field.options ?? [];
  const focusOption = (id: string) =>
    requestAnimationFrame(() => (document.getElementById(`option-${id}`) as HTMLInputElement | null)?.select());
  const addAfter = (index: number, labels: string[]) => {
    const taken = new Set(options.map((option) => option.label.trim().toLowerCase()));
    const fresh = labels
      .map((label) => label.trim())
      .filter((label) => label && !taken.has(label.toLowerCase()) && (taken.add(label.toLowerCase()), true))
      .map((label) => newOption(label));
    if (fresh.length === 0) return;
    onChange({ options: [...options.slice(0, index + 1), ...fresh, ...options.slice(index + 1)] });
    focusOption(fresh.at(-1)!.id);
  };
  const marker = (index: number) =>
    field.type === 'select' ? (
      <span className="w-4 shrink-0 text-center text-xs text-muted-foreground tabular-nums">{index + 1}</span>
    ) : (
      <span className={cn('size-4 shrink-0 border border-rule', field.type === 'radio' ? 'rounded-full' : 'rounded-[4px]')} />
    );

  return (
    <div>
      <ul className="flex flex-col gap-1">
        {options.map((option, index) => (
          <li key={option.id} className="group/option flex items-center gap-2.5">
            {marker(index)}
            <input
              id={`option-${option.id}`}
              aria-label={`Option ${index + 1}`}
              value={option.label}
              maxLength={200}
              placeholder={`Option ${index + 1}`}
              onChange={(event) =>
                onChange({ options: options.map((entry) => (entry.id === option.id ? { ...entry, label: event.target.value } : entry)) })
              }
              onPaste={(event) => {
                const text = event.clipboardData.getData('text');
                if (!/[\r\n]/.test(text)) return;
                event.preventDefault();
                addAfter(index, text.split(/\r?\n/));
              }}
              onKeyDown={(event) => {
                if (event.nativeEvent.isComposing) return;
                if (event.key === 'Enter') {
                  event.preventDefault();
                  addAfter(index, [`Option ${options.length + 1}`]);
                } else if (event.key === 'Backspace' && !option.label && options.length > 1) {
                  event.preventDefault();
                  onChange({ options: options.filter((entry) => entry.id !== option.id) });
                  const previous = options[index - 1] ?? options[index + 1];
                  if (previous) focusOption(previous.id);
                }
              }}
              className="h-9 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-sm text-foreground outline-none hover:bg-band/40 focus-visible:bg-band/50 pointer-coarse:h-11"
            />
            <button
              type="button"
              aria-label={`Remove ${option.label || 'option'}`}
              disabled={options.length <= 1}
              onClick={() => onChange({ options: options.filter((entry) => entry.id !== option.id) })}
              className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/option:opacity-100 hover:text-exception focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-ring disabled:hidden pointer-coarse:size-11 pointer-coarse:opacity-100"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => addAfter(options.length - 1, [`Option ${options.length + 1}`])}
        className="mt-1 flex h-9 items-center gap-2.5 rounded-md px-0 text-sm text-muted-foreground hover:text-foreground pointer-coarse:h-11"
      >
        <span className="flex w-4 justify-center">
          <Plus size={14} aria-hidden="true" />
        </span>
        Add option
      </button>
    </div>
  );
}

/** What the control will look like — drawn, not live, so a click chooses the question instead of answering it. */
function FieldGhost({ field }: { field: FormField }) {
  const box = 'flex h-10 items-center rounded-md border border-input bg-control px-3 text-sm text-muted-foreground/70';
  switch (field.type) {
    case 'long_text':
      return <div className={cn(box, 'h-20 items-start pt-2')}>{field.placeholder || ''}</div>;
    case 'select':
      return (
        <div className={cn(box, 'justify-between')}>
          {field.placeholder || 'Choose…'}
          <ChevronDown size={14} aria-hidden="true" />
        </div>
      );
    case 'radio':
    case 'checkboxes':
      return (
        <div className="flex flex-col gap-1.5">
          {(field.options ?? []).slice(0, 8).map((option) => (
            <div key={option.id} className="flex items-center gap-2.5 text-sm text-foreground">
              <span className={cn('size-4 shrink-0 border border-rule', field.type === 'radio' ? 'rounded-full' : 'rounded-[4px]')} />
              <span className="truncate">{option.label}</span>
            </div>
          ))}
          {(field.options?.length ?? 0) > 8 && <p className="text-xs text-muted-foreground">+{field.options!.length - 8} more</p>}
        </div>
      );
    case 'yes_no':
      return (
        <div className="flex gap-2">
          {['Yes', 'No'].map((label) => (
            <span
              key={label}
              className="flex h-10 min-w-24 items-center justify-center rounded-md border border-input bg-control text-sm text-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      );
    case 'rating':
      return (
        <div className="flex flex-wrap gap-1 text-muted-foreground/70">
          {Array.from({ length: ratingMax(field) }, (_, index) => (
            <Star key={index} size={22} aria-hidden="true" />
          ))}
        </div>
      );
    case 'scale': {
      const { min, max } = scaleRange(field);
      return (
        <div>
          <div className="flex gap-1">
            {Array.from({ length: Math.max(0, max - min + 1) }, (_, index) => (
              <span
                key={index}
                className="flex h-9 min-w-0 flex-1 items-center justify-center rounded-md border border-input bg-control text-xs text-foreground tabular-nums"
              >
                {min + index}
              </span>
            ))}
          </div>
          {(field.minLabel || field.maxLabel) && (
            <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
              <span>{field.minLabel}</span>
              <span>{field.maxLabel}</span>
            </div>
          )}
        </div>
      );
    }
    case 'date':
      return <div className={box}>dd / mm / yyyy</div>;
    case 'time':
      return <div className={box}>--:--</div>;
    default:
      return <div className={box}>{field.placeholder || ''}</div>;
  }
}

/** "3 things to fix" — each one opens its question. */
function ProblemsButton({ problems, fields, onPick }: { problems: Problem[]; fields: FormField[]; onPick: (id: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-md bg-measured/10 px-3 text-xs font-medium text-measured transition-colors hover:bg-measured/15 focus-visible:outline-2 focus-visible:outline-ring pointer-coarse:h-11"
        >
          <AlertTriangle size={14} aria-hidden="true" />
          {problems.length} {problems.length === 1 ? 'thing' : 'things'} to fix
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        <ul className="flex flex-col gap-0.5">
          {problems.map((problem, index) => {
            const at = problemFieldIndex(problem);
            const field = at === null ? undefined : fields[at];
            return (
              <li key={`${problem.field}-${index}`}>
                <button
                  type="button"
                  disabled={!field}
                  onClick={() => field && onPick(field.id)}
                  className="flex w-full items-start gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-band/50 disabled:cursor-default disabled:hover:bg-transparent"
                >
                  <RowTile icon={field ? FIELD_ICONS[field.type] : AlertTriangle} tone="warning" />
                  <span className="min-w-0 pt-1.5 text-xs leading-relaxed text-foreground">{problem.message}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
