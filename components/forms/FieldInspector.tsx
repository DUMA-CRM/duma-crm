'use client';

import { useState } from 'react';

import { ActionRow, ActionRows, FieldRow, InfoRow, PickerRow, RowTile } from '@/components/cms/rows';
import {
  AlertTriangle,
  AlignLeft,
  CircleAlert,
  Columns2,
  Copy,
  GripVertical,
  Hash,
  Info,
  KeyRound,
  ListChecks,
  Pencil,
  Plus,
  Route,
  SlidersHorizontal,
  Star,
  Trash2,
  Type,
  X,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { Switch } from '@/components/settings/controls';
import { NumberStepper } from '@/components/shared/FormParts';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { dropIndex, moveItem } from '@/lib/utils/cms';
import { cn } from '@/lib/utils/cn';
import {
  type ConditionOperator,
  type FormCondition,
  type FormDefinition,
  type FormField,
  OPERATOR_LABELS,
  type Problem,
  conditionChoices,
  fieldTypeLabel,
  isChoiceField,
  isInputField,
  needsValue,
  operatorsFor,
  problemFieldIndex,
  ratingMax,
  scaleRange,
  shortId,
} from '@/lib/utils/forms';

import { FIELD_ICONS } from './field-icons';

const textarea =
  'w-full rounded-md border border-input bg-control px-3 py-2 text-sm text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus-visible:border-measured focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-measured disabled:opacity-60';

type Row = 'description' | 'placeholder' | 'limits' | 'key' | 'default';

/**
 * The chosen question's settings, in the Booking rules row style: the words
 * first (question, help), then how it's answered (required, width, options,
 * limits), when it shows (logic), and its API key. With nothing chosen, the
 * form at a glance and what stops it being published.
 */
export function FieldInspector({
  field,
  fields,
  definition,
  readOnly,
  problems,
  onChange,
  onDuplicate,
  onRemove,
  onSelect,
}: {
  field: FormField | null;
  fields: FormField[];
  definition: FormDefinition;
  readOnly: boolean;
  problems: Problem[];
  onChange: (patch: Partial<FormField>) => void;
  onDuplicate: () => void;
  onRemove: () => void;
  onSelect: (id: string) => void;
}) {
  // One row open at a time; reset when another question is chosen.
  const [open, setOpen] = useState<{ fieldId: string | null; row: Row | null }>({ fieldId: null, row: null });
  const openRow = open.fieldId === field?.id ? open.row : null;
  const toggle = (row: Row) => setOpen({ fieldId: field?.id ?? null, row: openRow === row ? null : row });

  if (!field) return <FormOverview fields={fields} definition={definition} problems={problems} onSelect={onSelect} />;

  const Icon = FIELD_ICONS[field.type];
  const input = isInputField(field);
  const index = fields.findIndex((entry) => entry.id === field.id);
  const own = problems.filter((problem) => problemFieldIndex(problem) === index);
  const textLike = ['short_text', 'long_text', 'email', 'phone', 'number', 'url', 'select'].includes(field.type);
  const hasLimits = ['short_text', 'long_text', 'number', 'checkboxes', 'rating', 'scale'].includes(field.type);

  return (
    <div className="flex flex-col gap-5">
      <SettingsSection
        title={fieldTypeLabel(field.type)}
        icon={Icon}
        actions={
          field.type !== 'page_break' && input ? <span className="font-mono text-xs text-muted-foreground">{field.key}</span> : undefined
        }
      >
        <fieldset disabled={readOnly} className="min-w-0 space-y-3">
          {field.type === 'page_break' ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              Everything below starts a new step, with Back and Next buttons and a progress bar. A step whose questions are all hidden by
              logic is skipped.
            </p>
          ) : (
            <FieldRow
              icon={field.type === 'heading' ? Type : field.type === 'paragraph' ? AlignLeft : Pencil}
              title={
                field.type === 'paragraph'
                  ? 'Text'
                  : field.type === 'heading'
                    ? 'Heading'
                    : field.type === 'consent'
                      ? 'What they agree to'
                      : 'Question'
              }
              htmlFor="inspector-label"
            >
              <textarea
                id="inspector-label"
                value={field.label}
                rows={field.type === 'paragraph' ? 4 : 2}
                maxLength={field.type === 'paragraph' ? 2000 : 500}
                onChange={(event) => onChange({ label: event.target.value })}
                placeholder={field.type === 'hidden' ? 'Source' : 'What do you want to ask?'}
                className={cn(textarea, 'field-sizing-content min-h-10 resize-none')}
              />
            </FieldRow>
          )}

          {input && field.type !== 'hidden' && field.type !== 'consent' && (
            <PickerRow
              icon={Info}
              title="Help text"
              value={field.description?.trim() || 'None'}
              muted={!field.description?.trim()}
              open={openRow === 'description'}
              onToggle={() => toggle('description')}
            >
              <Input
                aria-label="Help text"
                value={field.description ?? ''}
                maxLength={2000}
                autoFocus
                onChange={(event) => onChange({ description: event.target.value || undefined })}
                placeholder="e.g. We’ll only use this to reply"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">A line under the question, in smaller text.</p>
            </PickerRow>
          )}

          {textLike && (
            <PickerRow
              icon={Type}
              title="Placeholder"
              value={field.placeholder?.trim() || 'None'}
              muted={!field.placeholder?.trim()}
              open={openRow === 'placeholder'}
              onToggle={() => toggle('placeholder')}
            >
              <Input
                aria-label="Placeholder"
                value={field.placeholder ?? ''}
                maxLength={200}
                autoFocus
                onChange={(event) => onChange({ placeholder: event.target.value || undefined })}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">Shown faintly in the empty box.</p>
            </PickerRow>
          )}

          {input && field.type !== 'hidden' && (
            <InfoRow icon={CircleAlert} title="Required">
              <Switch
                checked={Boolean(field.required)}
                onChange={(required) => onChange({ required })}
                label="Required"
                disabled={readOnly}
              />
            </InfoRow>
          )}

          {input &&
            field.type !== 'hidden' &&
            !isChoiceField(field) &&
            !['rating', 'scale', 'consent', 'long_text'].includes(field.type) && (
              <InfoRow icon={Columns2} title="Width">
                <SegmentedControl<'full' | 'half'>
                  value={field.width ?? 'full'}
                  onChange={(width) => onChange({ width: width === 'full' ? undefined : width })}
                  ariaLabel="Width"
                  options={[
                    { value: 'full', label: 'Full' },
                    { value: 'half', label: 'Half' },
                  ]}
                />
              </InfoRow>
            )}

          {hasLimits && <LimitsRow field={field} open={openRow === 'limits'} onToggle={() => toggle('limits')} onChange={onChange} />}

          {field.type === 'hidden' && (
            <PickerRow
              icon={Hash}
              title="If the link has none"
              value={field.defaultValue?.trim() || 'Left empty'}
              muted={!field.defaultValue?.trim()}
              open={openRow === 'default'}
              onToggle={() => toggle('default')}
            >
              <Input
                aria-label="Default value"
                value={field.defaultValue ?? ''}
                maxLength={500}
                autoFocus
                onChange={(event) => onChange({ defaultValue: event.target.value || undefined })}
                placeholder="website"
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                Filled from <span className="font-mono">?{field.key}=…</span> on the link — a campaign, a table number. Never shown.
              </p>
            </PickerRow>
          )}

          {input && (
            <PickerRow
              icon={KeyRound}
              title="API key"
              value={field.key || 'Missing'}
              tone={/^[a-z][a-z0-9_]{0,59}$/.test(field.key) ? undefined : 'warning'}
              open={openRow === 'key'}
              onToggle={() => toggle('key')}
            >
              <Input
                aria-label="API key"
                value={field.key}
                maxLength={60}
                autoFocus
                className="font-mono"
                onChange={(event) => onChange({ key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
              />
              <p className="mt-1.5 text-xs text-muted-foreground">
                The name of this answer in the API, exports and pre-filled links. Changing it on a live form breaks integrations that use
                the old one.
              </p>
            </PickerRow>
          )}
        </fieldset>

        {own.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {own.map((problem) => (
              <p
                key={problem.field + problem.message}
                className="flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured"
              >
                <AlertTriangle size={14} className="mt-px shrink-0" aria-hidden="true" />
                <span>{problem.message}</span>
              </p>
            ))}
          </div>
        )}
      </SettingsSection>

      {isChoiceField(field) && <OptionsSection field={field} readOnly={readOnly} onChange={onChange} />}

      {field.type !== 'page_break' && <LogicSection field={field} fields={fields} readOnly={readOnly} onChange={onChange} />}

      {!readOnly && (
        <SettingsSection title="Actions">
          <ActionRows danger={<ActionRow icon={Trash2} label="Delete question" danger onClick={onRemove} />}>
            <ActionRow icon={Copy} label="Duplicate" onClick={onDuplicate} />
          </ActionRows>
        </SettingsSection>
      )}
    </div>
  );
}

/** Min and max, in the field's own words: characters, a range, how many to tick, stars, points. */
function LimitsRow({
  field,
  open,
  onToggle,
  onChange,
}: {
  field: FormField;
  open: boolean;
  onToggle: () => void;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const number = (value: string) => (value.trim() === '' ? null : Number(value));
  if (field.type === 'rating') {
    const max = ratingMax(field);
    return (
      <PickerRow icon={Star} title="Stars" value={`${max} stars`} open={open} onToggle={onToggle}>
        <NumberStepper label="Stars" value={max} min={3} max={10} unit="stars" onChange={(next) => onChange({ max: next })} />
      </PickerRow>
    );
  }
  if (field.type === 'scale') {
    const { min, max } = scaleRange(field);
    return (
      <PickerRow icon={SlidersHorizontal} title="Scale" value={`${min} to ${max}`} open={open} onToggle={onToggle}>
        <div className="grid grid-cols-2 gap-2">
          <NumberStepper label="From" value={min} min={0} max={1} onChange={(next) => onChange({ min: next })} />
          <NumberStepper label="To" value={max} min={min + 1} max={min + 10} onChange={(next) => onChange({ max: next })} />
          <Input
            aria-label="Label for the low end"
            placeholder="Not likely"
            value={field.minLabel ?? ''}
            maxLength={60}
            onChange={(event) => onChange({ minLabel: event.target.value || undefined })}
          />
          <Input
            aria-label="Label for the high end"
            placeholder="Very likely"
            value={field.maxLabel ?? ''}
            maxLength={60}
            onChange={(event) => onChange({ maxLabel: event.target.value || undefined })}
          />
        </div>
        <p className="mt-1.5 text-xs text-muted-foreground">0 to 10 is the usual “would you recommend us” question.</p>
      </PickerRow>
    );
  }
  const unit = field.type === 'checkboxes' ? 'choices' : field.type === 'number' ? '' : 'characters';
  const shown =
    field.min == null && field.max == null
      ? 'Any'
      : field.min != null && field.max != null
        ? `${field.min}–${field.max}${unit ? ` ${unit}` : ''}`
        : field.min != null
          ? `At least ${field.min}`
          : `At most ${field.max}`;
  return (
    <PickerRow
      icon={field.type === 'checkboxes' ? ListChecks : Hash}
      title={field.type === 'number' ? 'Allowed range' : field.type === 'checkboxes' ? 'How many to tick' : 'Length'}
      value={shown}
      muted={shown === 'Any'}
      open={open}
      onToggle={onToggle}
    >
      <div className="grid grid-cols-2 gap-2">
        <Input
          aria-label="Minimum"
          type="number"
          placeholder="No minimum"
          value={field.min ?? ''}
          onChange={(event) => onChange({ min: number(event.target.value) })}
        />
        <Input
          aria-label="Maximum"
          type="number"
          placeholder="No maximum"
          value={field.max ?? ''}
          onChange={(event) => onChange({ max: number(event.target.value) })}
        />
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {field.type === 'number'
          ? 'A party size of 1 to 20, say.'
          : field.type === 'checkboxes'
            ? 'Leave empty for any number.'
            : 'Leave empty for no limit.'}
      </p>
    </PickerRow>
  );
}

/** The choices: rename in place, drag to reorder, paste a list to add many. */
function OptionsSection({
  field,
  readOnly,
  onChange,
}: {
  field: FormField;
  readOnly: boolean;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const options = field.options ?? [];
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const set = (next: typeof options) => onChange({ options: next });
  const add = (labels: string[]) => {
    const taken = new Set(options.map((option) => option.label.trim().toLowerCase()));
    const fresh = labels
      .map((label) => label.trim())
      .filter((label) => label && !taken.has(label.toLowerCase()) && (taken.add(label.toLowerCase()), true))
      .map((label) => ({ id: shortId('o'), label }));
    set([...options, ...fresh]);
    return fresh;
  };

  return (
    <SettingsSection title="Options" actions={<span className="text-xs tabular-nums text-muted-foreground">{options.length}</span>}>
      <fieldset disabled={readOnly} className="min-w-0">
        <ul className="flex flex-col gap-1.5">
          {options.map((option, index) => (
            <li
              key={option.id}
              onDragOver={(event) => drag !== null && event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (drag === null) return;
                const box = event.currentTarget.getBoundingClientRect();
                set(moveItem(options, drag, dropIndex(drag, index, event.clientY > box.top + box.height / 2)));
                setDrag(null);
              }}
              className={cn('flex items-center gap-1.5', drag === index && 'opacity-40')}
            >
              <span
                draggable={!readOnly}
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', option.label);
                  setDrag(index);
                }}
                onDragEnd={() => setDrag(null)}
                aria-hidden="true"
                className="flex h-9 w-4 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
              >
                <GripVertical size={13} />
              </span>
              <Input
                aria-label={`Option ${index + 1}`}
                value={option.label}
                maxLength={200}
                onChange={(event) =>
                  set(options.map((entry) => (entry.id === option.id ? { ...entry, label: event.target.value } : entry)))
                }
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  // Enter adds the next option and moves to it, as in a list.
                  const [fresh] = add([`Option ${options.length + 1}`]);
                  if (fresh)
                    requestAnimationFrame(() =>
                      document.querySelector<HTMLInputElement>(`input[aria-label="Option ${options.length + 1}"]`)?.select(),
                    );
                }}
                className="h-9"
              />
              <button
                type="button"
                aria-label={`Remove ${option.label || 'option'}`}
                disabled={options.length <= 1}
                onClick={() => set(options.filter((entry) => entry.id !== option.id))}
                className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-exception/8 hover:text-exception disabled:opacity-30"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        {!readOnly && (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => add([`Option ${options.length + 1}`])}>
              <Plus size={13} aria-hidden="true" />
              Add option
            </Button>
            <Button variant="ghost" className="h-8 text-xs" onClick={() => setPasting((current) => !current)}>
              Paste a list
            </Button>
          </div>
        )}
        {pasting && (
          <div className="mt-3">
            <textarea
              aria-label="Options, one per line"
              rows={5}
              autoFocus
              value={pasted}
              onChange={(event) => setPasted(event.target.value)}
              placeholder={'Vegetarian\nVegan\nGluten-free'}
              className={textarea}
            />
            <div className="mt-2 flex justify-end gap-2">
              <Button variant="ghost" className="h-8 text-xs" onClick={() => setPasting(false)}>
                Cancel
              </Button>
              <Button
                className="h-8 text-xs"
                disabled={!pasted.trim()}
                onClick={() => {
                  add(pasted.split(/\r?\n|,/));
                  setPasted('');
                  setPasting(false);
                }}
              >
                Add {pasted.split(/\r?\n|,/).filter((line) => line.trim()).length || ''} options
              </Button>
            </div>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Enter adds the next one. Answers keep the wording they were given in, so renaming an option doesn’t change past responses.
        </p>
      </fieldset>
    </SettingsSection>
  );
}

/** "Show this question: always / only when …" — conditions on the questions above it. */
function LogicSection({
  field,
  fields,
  readOnly,
  onChange,
}: {
  field: FormField;
  fields: FormField[];
  readOnly: boolean;
  onChange: (patch: Partial<FormField>) => void;
}) {
  const index = fields.findIndex((entry) => entry.id === field.id);
  const sources = fields.slice(0, index).filter((entry) => isInputField(entry));
  const logic = field.logic && field.logic.conditions.length ? field.logic : null;
  const conditions = logic?.conditions ?? [];

  const setConditions = (next: FormCondition[], match = logic?.match ?? 'all') =>
    onChange({ logic: next.length ? { match, conditions: next } : null });
  const blank = (): FormCondition | null => {
    const source = sources.at(-1);
    if (!source) return null;
    const operator = operatorsFor(source.type)[0]!;
    return { fieldId: source.id, operator, value: conditionChoices(source)?.[0] ?? '' };
  };

  return (
    <SettingsSection title="When it shows" icon={Route}>
      <fieldset disabled={readOnly} className="min-w-0 space-y-3">
        <SegmentedControl<'always' | 'when'>
          value={logic ? 'when' : 'always'}
          onChange={(next) => {
            if (next === 'always') setConditions([]);
            else {
              const first = blank();
              if (first) setConditions([first]);
            }
          }}
          ariaLabel="When this question shows"
          className="w-full"
          options={[
            { value: 'always', label: 'Always' },
            { value: 'when', label: 'Only when…' },
          ]}
        />
        {sources.length === 0 && !logic && (
          <p className="text-xs text-muted-foreground">Logic reads the answers above a question — this one is first, so it always shows.</p>
        )}

        {logic && (
          <>
            {conditions.length > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Show when
                <SegmentedControl<'all' | 'any'>
                  value={logic.match}
                  onChange={(match) => setConditions(conditions, match)}
                  ariaLabel="Match"
                  options={[
                    { value: 'all', label: 'all' },
                    { value: 'any', label: 'any' },
                  ]}
                />
                of these are true
              </div>
            )}
            <ul className="space-y-2">
              {conditions.map((condition, conditionIndex) => {
                const source = fields.find((entry) => entry.id === condition.fieldId);
                const operators = source ? operatorsFor(source.type) : (['is_answered'] as ConditionOperator[]);
                const choices = source ? conditionChoices(source) : null;
                const update = (patch: Partial<FormCondition>) =>
                  setConditions(conditions.map((entry, at) => (at === conditionIndex ? { ...entry, ...patch } : entry)));
                return (
                  <li key={conditionIndex} className="space-y-1.5 rounded-md border border-rule/50 bg-background p-2.5">
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={condition.fieldId}
                        ariaLabel="Question"
                        className="min-w-0 flex-1"
                        options={[
                          ...(source && !sources.includes(source)
                            ? [{ value: source.id, label: `${source.label} (below — move it up)`, disabled: true }]
                            : []),
                          ...(!source ? [{ value: condition.fieldId, label: 'A removed question', disabled: true }] : []),
                          ...sources.map((entry) => ({
                            value: entry.id,
                            label: entry.label || entry.key,
                            icon: (() => {
                              const SourceIcon = FIELD_ICONS[entry.type];
                              return <SourceIcon size={13} aria-hidden="true" />;
                            })(),
                          })),
                        ]}
                        onValueChange={(fieldId) => {
                          const next = fields.find((entry) => entry.id === fieldId)!;
                          update({ fieldId, operator: operatorsFor(next.type)[0]!, value: conditionChoices(next)?.[0] ?? '' });
                        }}
                      />
                      <button
                        type="button"
                        aria-label="Remove condition"
                        onClick={() => setConditions(conditions.filter((_, at) => at !== conditionIndex))}
                        className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-exception/8 hover:text-exception"
                      >
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Select
                        value={condition.operator}
                        ariaLabel="Comparison"
                        className="w-36 shrink-0"
                        options={operators.map((operator) => ({ value: operator, label: OPERATOR_LABELS[operator] }))}
                        onValueChange={(operator) => update({ operator: operator as ConditionOperator })}
                      />
                      {needsValue(condition.operator) &&
                        (choices ? (
                          <Select
                            value={condition.value ?? ''}
                            ariaLabel="Answer"
                            className="min-w-0 flex-1"
                            options={choices.map((choice) => ({ value: choice, label: choice }))}
                            onValueChange={(value) => update({ value })}
                          />
                        ) : (
                          <Input
                            aria-label="Answer"
                            className="h-9 min-w-0 flex-1"
                            value={condition.value ?? ''}
                            maxLength={200}
                            onChange={(event) => update({ value: event.target.value })}
                          />
                        ))}
                    </div>
                  </li>
                );
              })}
            </ul>
            {!readOnly && (
              <Button
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  const next = blank();
                  if (next) setConditions([...conditions, next]);
                }}
              >
                <Plus size={13} aria-hidden="true" />
                Add condition
              </Button>
            )}
            <p className="text-xs text-muted-foreground">A hidden question’s answer isn’t kept, and it isn’t required while hidden.</p>
          </>
        )}
      </fieldset>
    </SettingsSection>
  );
}

/** Nothing chosen: the form at a glance, what stops it publishing, and the shortcuts. */
function FormOverview({
  fields,
  definition,
  problems,
  onSelect,
}: {
  fields: FormField[];
  definition: FormDefinition;
  problems: Problem[];
  onSelect: (id: string) => void;
}) {
  const questions = fields.filter((field) => isInputField(field) && field.type !== 'hidden');
  const required = questions.filter((field) => field.required).length;
  const pages = fields.filter((field) => field.type === 'page_break').length + 1;
  const withLogic = fields.filter((field) => field.logic?.conditions.length).length;
  const figure = (value: number) => <span className="text-sm tabular-nums text-muted-foreground">{value}</span>;
  return (
    <div className="flex flex-col gap-5">
      <SettingsSection title="This form">
        <div className="space-y-3">
          <InfoRow icon={Pencil} title="Questions">
            {figure(questions.length)}
          </InfoRow>
          <InfoRow icon={CircleAlert} title="Required">
            {figure(required)}
          </InfoRow>
          <InfoRow icon={Columns2} title="Steps">
            {figure(pages)}
          </InfoRow>
          <InfoRow icon={Route} title="With logic">
            {figure(withLogic)}
          </InfoRow>
          {definition.customerLink?.enabled && (
            <p className="rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground">
              Respondents are saved as customers, matched by email.
            </p>
          )}
        </div>
      </SettingsSection>
      {problems.length > 0 ? (
        <SettingsSection title="Before you publish">
          <ul className="-mx-2 flex flex-col gap-0.5">
            {problems.map((problem, index) => {
              const at = problemFieldIndex(problem);
              const field = at === null ? undefined : fields[at];
              return (
                <li key={`${problem.field}-${index}`}>
                  <button
                    type="button"
                    disabled={!field}
                    onClick={() => field && onSelect(field.id)}
                    className="flex w-full items-start gap-3 rounded-md px-2 py-1.5 text-left hover:bg-band/50 disabled:hover:bg-transparent"
                  >
                    <RowTile icon={field ? FIELD_ICONS[field.type] : AlertTriangle} tone="warning" />
                    <span className="pt-1.5 text-xs leading-relaxed text-foreground">{problem.message}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </SettingsSection>
      ) : (
        <SettingsSection title="Shortcuts">
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {[
              ['Click', 'Edit a question'],
              ['Alt ↑ / ↓', 'Move it'],
              ['⌘ D', 'Duplicate it'],
              ['Delete', 'Remove it'],
              ['⌘ S', 'Save'],
            ].map(([keys, what]) => (
              <li key={keys} className="flex items-center justify-between gap-3">
                <span>{what}</span>
                <kbd className="rounded border border-rule/60 bg-background px-1.5 py-0.5 font-mono text-[11px] text-foreground">
                  {keys}
                </kbd>
              </li>
            ))}
          </ul>
        </SettingsSection>
      )}
    </div>
  );
}
