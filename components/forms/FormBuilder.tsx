'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';

import { RowTile } from '@/components/cms/rows';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Copy,
  Eye,
  GripVertical,
  Monitor,
  Pencil,
  Plus,
  Route,
  Smartphone,
  Star,
  Trash2,
} from '@/components/icons';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Tooltip } from '@/components/shared/Tooltip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

import { dropIndex, moveItem } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import {
  FIELD_GROUPS,
  FIELD_TYPES,
  type FormField,
  type FormFieldType,
  type Problem,
  duplicateField,
  fieldTypeLabel,
  formPages,
  isChoiceField,
  isInputField,
  logicSummary,
  newField,
  problemFieldIndex,
  ratingMax,
  removeField,
  scaleRange,
} from '@/lib/utils/forms';

import { FieldInspector } from './FieldInspector';
import type { FormDraft } from './FormEditor';
import { FormRenderer } from './FormRenderer';
import { FIELD_ICONS } from './field-icons';

/** Private drag types, so a drop from elsewhere (a file, a link) is never read as a question. */
const DRAG_FIELD = 'application/x-duma-form-field';
const DRAG_TYPE = 'application/x-duma-form-type';

type Mode = 'edit' | 'preview';
type Device = 'desktop' | 'phone';

/**
 * The builder: the question types on the left, the form itself in the middle
 * — edited where it stands, on paper that looks like what respondents get —
 * and the chosen question's settings on the right.
 *
 * Add a question by clicking a type (it lands after the selected one) or
 * dragging it to a place. Drag the handle to reorder, or Alt+↑/↓. Preview
 * swaps the paper for the real form, logic and all; nothing is sent.
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
  const selected = fields.find((field) => field.id === selectedId) ?? null;

  // A problem elsewhere (Publish refused) picks the question it's about.
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
  const updateField = (id: string, patch: Partial<FormField>) =>
    onChange((current) => ({
      ...current,
      definition: {
        ...current.definition,
        fields: current.definition.fields.map((field) => (field.id === id ? { ...field, ...patch } : field)),
      },
    }));

  const insert = (type: FormFieldType, at?: number) => {
    const field = newField(type, fields);
    const selectedIndex = fields.findIndex((entry) => entry.id === selectedId);
    const index = at ?? (selectedIndex >= 0 ? selectedIndex + 1 : fields.length);
    setFields([...fields.slice(0, index), field, ...fields.slice(index)]);
    setSelectedId(field.id);
    setMode('edit');
    requestAnimationFrame(() =>
      document.getElementById(`card-${field.id}`)?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' }),
    );
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
  const remove = (id: string) => {
    const index = fields.findIndex((field) => field.id === id);
    onChange((current) => ({ ...current, definition: removeField(current.definition, id) }));
    const neighbour = fields[index + 1] ?? fields[index - 1];
    setSelectedId(neighbour && neighbour.id !== id ? neighbour.id : null);
  };

  // Keyboard on the selected question: Alt+↑/↓ moves it, ⌘D duplicates, Delete removes (outside a text box).
  useEffect(() => {
    if (readOnly || mode !== 'edit' || !selectedId) return;
    const onKey = (event: KeyboardEvent) => {
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
      } else if (!typing && event.key === 'Escape') {
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  /** Where a drop over the card at `index` lands: before it in its top half, after it in its bottom half. */
  const overCard = (event: React.DragEvent, index: number) => {
    if (!event.dataTransfer.types.includes(DRAG_FIELD) && !event.dataTransfer.types.includes(DRAG_TYPE)) return;
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    setDropAt(event.clientY > box.top + box.height / 2 ? index + 1 : index);
  };
  const drop = (event: React.DragEvent) => {
    event.preventDefault();
    const at = dropAt ?? fields.length;
    const type = event.dataTransfer.getData(DRAG_TYPE) as FormFieldType;
    const id = event.dataTransfer.getData(DRAG_FIELD);
    if (type) insert(type, at);
    else if (id) {
      const from = fields.findIndex((field) => field.id === id);
      if (from >= 0) setFields(moveItem(fields, from, at > from ? dropIndex(from, at - 1, true) : dropIndex(from, at, false)));
    }
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
  const pageCount = formPages(fields).length;
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
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem] xl:grid-cols-[13.5rem_minmax(0,1fr)_22rem]">
      {/* The palette: a column on wide screens, a popover from the toolbar below that. */}
      <aside className="hidden xl:sticky xl:top-5 xl:block" aria-label="Question types">
        <Palette onPick={insert} disabled={readOnly || mode === 'preview'} />
      </aside>

      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-center gap-2">
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
          <span className="ml-auto flex items-center gap-2">
            {problems.length > 0 && (
              <ProblemsButton problems={problems} fields={fields} onPick={(id) => (setSelectedId(id), setMode('edit'))} />
            )}
            {!readOnly && mode === 'edit' && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="h-9 gap-1.5 xl:hidden">
                    <Plus size={14} aria-hidden="true" />
                    Add question
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="max-h-[70vh] w-72 overflow-y-auto p-2">
                  <Palette onPick={insert} compact />
                </PopoverContent>
              </Popover>
            )}
          </span>
        </div>

        {mode === 'preview' ? (
          <div
            className={cn(
              'mx-auto rounded-xl border border-rule/60 bg-field p-6 shadow-sm transition-[max-width] sm:p-8',
              device === 'phone' ? 'max-w-[390px]' : 'max-w-2xl',
            )}
          >
            <p className="mb-5 rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              A preview of the draft — logic works, nothing is sent.
            </p>
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
            className="mx-auto max-w-2xl rounded-xl border border-rule/60 bg-field shadow-sm"
            style={{ '--form-accent': accent } as React.CSSProperties}
            onDragOver={(event) => {
              if (fields.length === 0 && event.dataTransfer.types.includes(DRAG_TYPE)) {
                event.preventDefault();
                setDropAt(0);
              }
            }}
            onDrop={drop}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDropAt(null);
            }}
          >
            <div className="border-b border-rule/40 px-6 pt-6 pb-5 sm:px-8">
              <input
                aria-label="Form name"
                value={draft.name}
                disabled={readOnly}
                onChange={(event) => onChange((current) => ({ ...current, name: event.target.value }))}
                placeholder="Untitled form"
                maxLength={120}
                className="w-full bg-transparent text-2xl font-semibold tracking-title text-foreground outline-none placeholder:text-muted-foreground/60"
              />
              <textarea
                aria-label="Form description"
                value={draft.description}
                disabled={readOnly}
                onChange={(event) => onChange((current) => ({ ...current, description: event.target.value }))}
                placeholder="Add a description — what it’s for, how long it takes"
                maxLength={500}
                rows={1}
                className="mt-1 field-sizing-content w-full resize-none bg-transparent text-sm leading-relaxed text-muted-foreground outline-none placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="px-3 py-4 sm:px-5" onClick={(event) => event.target === event.currentTarget && setSelectedId(null)}>
              {fields.length === 0 ? (
                <div
                  className={cn(
                    'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition-colors',
                    dropAt === 0 ? 'border-(--form-accent) bg-(--form-accent)/5' : 'border-rule/70',
                  )}
                >
                  <Plus size={22} className="text-muted-foreground" aria-hidden="true" />
                  <p className="mt-2 text-sm font-semibold text-foreground">Add your first question</p>
                  <p className="mt-1 max-w-xs text-xs text-muted-foreground">Pick a type from the left, or drag one here.</p>
                  {!readOnly && (
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      {(['short_text', 'email', 'radio', 'rating'] as FormFieldType[]).map((type) => {
                        const Icon = FIELD_ICONS[type];
                        return (
                          <Button key={type} variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => insert(type)}>
                            <Icon size={13} aria-hidden="true" />
                            {fieldTypeLabel(type)}
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <ol className="flex flex-col gap-1">
                  {pageCount > 1 && <PageMarker page={1} />}
                  <AnimatePresence initial={false}>
                    {fields.map((field, index) => (
                      <motion.li
                        key={field.id}
                        layout={!reduceMotion && !dragging}
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98, transition: { duration: 0.12 } }}
                        onDragOver={(event) => overCard(event, index)}
                        className="relative"
                      >
                        {dropAt === index && <DropLine />}
                        <FieldCard
                          field={field}
                          fields={fields}
                          page={pageOf.get(field.id) ?? 1}
                          selected={field.id === selectedId}
                          dragging={dragging === field.id}
                          problems={problemsOf.get(field.id)}
                          readOnly={readOnly}
                          first={index === 0}
                          last={index === fields.length - 1}
                          onSelect={() => setSelectedId(field.id)}
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

              {fields.length > 0 && (
                <div className="mt-5 px-3">
                  <span className="inline-flex h-11 items-center rounded-md bg-(--form-accent) px-5 text-sm font-semibold text-white opacity-90">
                    {draft.definition.submitLabel || 'Submit'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0 lg:sticky lg:top-5">
        <FieldInspector
          field={mode === 'edit' ? selected : null}
          fields={fields}
          definition={draft.definition}
          readOnly={readOnly}
          problems={problems}
          onChange={(patch) => selected && updateField(selected.id, patch)}
          onDuplicate={() => selected && duplicate(selected.id)}
          onRemove={() => selected && remove(selected.id)}
          onSelect={(id) => {
            setSelectedId(id);
            setMode('edit');
          }}
        />
      </div>
    </div>
  );
}

/** The question types, grouped; each one clicks in or drags to a place. */
function Palette({
  onPick,
  disabled = false,
  compact = false,
}: {
  onPick: (type: FormFieldType) => void;
  disabled?: boolean;
  compact?: boolean;
}) {
  return (
    <div className={cn(!compact && 'rounded-lg border border-rule/60 bg-field p-3')}>
      {!compact && <p className="px-1 pb-2 text-sm font-semibold tracking-title text-foreground">Add a question</p>}
      <div className="space-y-3">
        {FIELD_GROUPS.map((group) => (
          <div key={group}>
            <p className="px-1 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{group}</p>
            <ul className="flex flex-col gap-px">
              {FIELD_TYPES.filter((entry) => entry.group === group).map((entry) => {
                const Icon = FIELD_ICONS[entry.type];
                return (
                  <li key={entry.type}>
                    <Tooltip label={entry.hint} side="right">
                      <button
                        type="button"
                        disabled={disabled}
                        draggable={!disabled}
                        onDragStart={(event) => {
                          event.dataTransfer.setData(DRAG_TYPE, entry.type);
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => onPick(entry.type)}
                        className="group flex w-full items-center gap-2.5 rounded-md px-1.5 py-1 text-left text-sm text-foreground transition-colors hover:bg-band/60 disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-ring active:cursor-grabbing"
                      >
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background text-muted-foreground transition-colors group-hover:text-foreground">
                          <Icon size={14} aria-hidden="true" />
                        </span>
                        <span className="truncate">{entry.label}</span>
                        <Plus
                          size={13}
                          className="ml-auto shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                          aria-hidden="true"
                        />
                      </button>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function DropLine({ after = false }: { after?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-x-2 z-10 h-0.5 rounded-full bg-(--form-accent)', after ? '-bottom-1' : '-top-1')}
    />
  );
}

function PageMarker({ page }: { page: number }) {
  return (
    <li aria-hidden="true" className="px-3 pb-1 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
      Page {page}
    </li>
  );
}

/** One question on the paper: how it will look, its badges, and on hover or selection its tools. */
function FieldCard({
  field,
  fields,
  page,
  selected,
  dragging,
  problems,
  readOnly,
  first,
  last,
  onSelect,
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
  readOnly: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onMove: (by: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onDragStart: (event: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const logic = logicSummary(field, fields);
  const Icon = FIELD_ICONS[field.type];

  if (field.type === 'page_break') {
    return (
      <div
        id={`card-${field.id}`}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(event) => (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), onSelect())}
        draggable={!readOnly}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={cn(
          'group my-2 flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 outline-none',
          selected
            ? 'bg-(--form-accent)/6 ring-2 ring-(--form-accent)/50'
            : 'hover:bg-band/40 focus-visible:ring-2 focus-visible:ring-ring',
          dragging && 'opacity-40',
        )}
      >
        <span className="h-px flex-1 border-t-2 border-dashed border-rule" />
        <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Page {page}</span>
        <span className="h-px flex-1 border-t-2 border-dashed border-rule" />
        {!readOnly && (
          <CardTools first={first} last={last} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} visible={selected} />
        )}
      </div>
    );
  }

  return (
    <div
      id={`card-${field.id}`}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${fieldTypeLabel(field.type)}: ${field.label || 'untitled'}`}
      onClick={onSelect}
      onKeyDown={(event) =>
        event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ') && (event.preventDefault(), onSelect())
      }
      className={cn(
        'group relative cursor-pointer rounded-lg border px-3 py-3 pl-8 outline-none transition-[border-color,background-color,box-shadow]',
        selected
          ? 'border-(--form-accent)/60 bg-background shadow-sm ring-2 ring-(--form-accent)/25'
          : problems
            ? 'border-exception/40 hover:bg-band/30'
            : 'border-transparent hover:border-rule/60 hover:bg-band/30 focus-visible:ring-2 focus-visible:ring-ring',
        dragging && 'opacity-40',
        field.width === 'half' && isInputField(field) && 'sm:mr-[50%]',
      )}
    >
      {!readOnly && (
        <span
          draggable
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          aria-hidden="true"
          className={cn(
            'absolute top-3 left-1.5 flex h-6 w-5 cursor-grab items-center justify-center rounded text-muted-foreground transition-opacity hover:bg-band active:cursor-grabbing',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
          )}
        >
          <GripVertical size={14} />
        </span>
      )}

      {field.type === 'heading' ? (
        <p className="text-lg font-semibold tracking-title text-foreground">
          {field.label || <span className="text-muted-foreground">Heading</span>}
        </p>
      ) : field.type === 'paragraph' ? (
        <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{field.label || 'Text'}</p>
      ) : field.type === 'hidden' ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon size={14} aria-hidden="true" />
          <span className="font-medium text-foreground">{field.label || 'Hidden field'}</span>
          <span className="truncate font-mono text-xs">?{field.key}=…</span>
          {field.defaultValue && <span className="truncate text-xs">· else “{field.defaultValue}”</span>}
        </p>
      ) : (
        <>
          <p className="pr-24 text-sm font-semibold text-foreground">
            {field.type !== 'consent' && (field.label || <span className="text-muted-foreground">Untitled question</span>)}
            {field.type !== 'consent' && field.required && <span className="text-exception"> *</span>}
          </p>
          {field.description && field.type !== 'consent' && <p className="mt-0.5 text-xs text-muted-foreground">{field.description}</p>}
          <div className={cn(field.type !== 'consent' && 'mt-2')}>
            <FieldGhost field={field} />
          </div>
        </>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-1.5 empty:hidden">
        {(selected || logic || problems) && (
          <Badge variant="outline" className="gap-1">
            <Icon size={11} aria-hidden="true" />
            {fieldTypeLabel(field.type)}
          </Badge>
        )}
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

      {!readOnly && (
        <span className="absolute top-2 right-2">
          <CardTools first={first} last={last} onMove={onMove} onDuplicate={onDuplicate} onRemove={onRemove} visible={selected} />
        </span>
      )}
    </div>
  );
}

function CardTools({
  first,
  last,
  onMove,
  onDuplicate,
  onRemove,
  visible,
}: {
  first: boolean;
  last: boolean;
  onMove: (by: number) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  visible: boolean;
}) {
  const tool = (label: string, icon: React.ReactNode, onClick: () => void, disabled = false, danger = false) => (
    <Tooltip label={label} side="top">
      <button
        type="button"
        aria-label={label}
        disabled={disabled}
        onClick={(event) => {
          event.stopPropagation();
          onClick();
        }}
        className={cn(
          'flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-ring',
          danger ? 'hover:bg-exception/8 hover:text-exception' : 'hover:bg-band hover:text-foreground',
        )}
      >
        {icon}
      </button>
    </Tooltip>
  );
  return (
    <span
      className={cn(
        'flex items-center gap-0.5 rounded-md border border-rule/50 bg-background/95 p-0.5 shadow-xs transition-opacity',
        visible
          ? 'opacity-100'
          : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100',
      )}
    >
      {tool('Move up (Alt+↑)', <ArrowUp size={14} aria-hidden="true" />, () => onMove(-1), first)}
      {tool('Move down (Alt+↓)', <ArrowDown size={14} aria-hidden="true" />, () => onMove(1), last)}
      {tool('Duplicate (⌘D)', <Copy size={14} aria-hidden="true" />, onDuplicate)}
      {tool('Delete', <Trash2 size={14} aria-hidden="true" />, onRemove, false, true)}
    </span>
  );
}

/** What the control will look like — drawn, not live, so a click selects the card instead of typing in it. */
function FieldGhost({ field }: { field: FormField }) {
  const box = 'flex h-10 items-center rounded-md border border-input bg-control px-3 text-sm text-muted-foreground/70';
  switch (field.type) {
    case 'long_text':
      return <div className={cn(box, 'h-20 items-start pt-2')}>{field.placeholder || ''}</div>;
    case 'select':
      return (
        <div className={cn(box, 'justify-between')}>
          {field.placeholder || 'Choose…'}
          <span aria-hidden="true">▾</span>
        </div>
      );
    case 'radio':
    case 'checkboxes':
      return (
        <div className="grid gap-1.5 sm:grid-cols-2">
          {(field.options ?? []).slice(0, 6).map((option) => (
            <div
              key={option.id}
              className="flex h-9 items-center gap-2 rounded-md border border-input bg-control px-3 text-sm text-foreground"
            >
              <span className={cn('size-3.5 shrink-0 border border-rule', field.type === 'radio' ? 'rounded-full' : 'rounded-[4px]')} />
              <span className="truncate">{option.label}</span>
            </div>
          ))}
          {(field.options?.length ?? 0) > 6 && <p className="text-xs text-muted-foreground">+{field.options!.length - 6} more</p>}
        </div>
      );
    case 'yes_no':
      return (
        <div className="flex gap-2">
          {['Yes', 'No'].map((label) => (
            <span
              key={label}
              className="flex h-9 min-w-20 items-center justify-center rounded-md border border-input bg-control text-sm text-foreground"
            >
              {label}
            </span>
          ))}
        </div>
      );
    case 'consent':
      return (
        <div className="flex items-start gap-2.5 rounded-md border border-input bg-control px-3 py-2.5 text-sm text-foreground">
          <span className="mt-0.5 size-4 shrink-0 rounded-[4px] border border-rule" />
          <span>
            {field.label || 'I agree'}
            {field.required && <span className="text-exception"> *</span>}
          </span>
        </div>
      );
    case 'rating':
      return (
        <div className="flex gap-1 text-rule">
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
                className="flex h-8 min-w-0 flex-1 items-center justify-center rounded-md border border-input bg-control text-xs text-foreground tabular-nums"
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
      return <div className={box}>{field.placeholder || (isChoiceField(field) ? '' : '')}</div>;
  }
}

/** "3 things to fix" — each one takes you to its question. */
function ProblemsButton({ problems, fields, onPick }: { problems: Problem[]; fields: FormField[]; onPick: (id: string) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1.5 rounded-md bg-measured/10 px-3 text-xs font-medium text-measured transition-colors hover:bg-measured/15"
        >
          <AlertTriangle size={14} aria-hidden="true" />
          {problems.length} {problems.length === 1 ? 'thing' : 'things'} to fix before publishing
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
