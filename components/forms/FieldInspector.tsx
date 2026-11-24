'use client';

import { RowWarning } from '@/components/shared/rows';
import { X } from '@/components/icons';
import { NumberStepper } from '@/components/shared/FormParts';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import {
  type ConditionOperator,
  type FormCondition,
  type FormField,
  type FormLogic,
  OPERATOR_LABELS,
  type Problem,
  conditionChoices,
  isChoiceField,
  isInputField,
  needsValue,
  operatorsFor,
  problemFieldIndex,
  ratingMax,
  scaleRange,
} from '@/lib/utils/forms';

import { FIELD_ICONS } from './field-icons';

/** The questions above this one whose answers can decide whether it shows. */
export const logicSources = (field: FormField, fields: readonly FormField[]) =>
  fields.slice(0, Math.max(0, fields.findIndex((entry) => entry.id === field.id))).filter(isInputField);

/** "Show only if…" to start with: the nearest question above, and its first answer. Null when nothing above can drive it. */
export function startLogic(field: FormField, fields: readonly FormField[]): FormLogic | null {
  const condition = blankCondition(logicSources(field, fields));
  return condition ? { match: 'all', conditions: [condition] } : null;
}

function blankCondition(sources: readonly FormField[]): FormCondition | null {
  const source = sources.at(-1);
  if (!source) return null;
  return { fieldId: source.id, operator: operatorsFor(source.type)[0]!, value: conditionChoices(source)?.[0] ?? '' };
}

/** A small label over its control. */
function Setting({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * The rest of a question, under it on its expanded card: help text and
 * placeholder, its limits, width, the default a hidden field takes, its API key,
 * and — once asked for from ⋯ — when it shows. Every control edits in place;
 * the draft saves itself.
 */
export function FieldSettings({
  field,
  fields,
  readOnly,
  problems,
  onChange,
}: {
  field: FormField;
  fields: FormField[];
  readOnly: boolean;
  problems: Problem[];
  onChange: (patch: Partial<FormField>) => void;
}) {
  const input = isInputField(field);
  const index = fields.findIndex((entry) => entry.id === field.id);
  // The missing-label problem is the empty box right above; say the others.
  const own = problems.filter((problem) => problemFieldIndex(problem) === index && !problem.field.endsWith('.label'));
  const id = (name: string) => `${field.id}-${name}`;
  const textLike = ['short_text', 'long_text', 'email', 'phone', 'number', 'url', 'select'].includes(field.type);
  const hasWidth =
    input && field.type !== 'hidden' && !isChoiceField(field) && !['rating', 'scale', 'consent', 'long_text'].includes(field.type);
  const hasLogic = Boolean(field.logic?.conditions.length);

  if (!input && !hasLogic && own.length === 0) return null;

  return (
    <fieldset disabled={readOnly} className="mt-3 min-w-0 space-y-3 rounded-md bg-band/40 px-3 py-3">
      {input && (
        <div className="grid gap-3 sm:grid-cols-2">
          {field.type !== 'hidden' && field.type !== 'consent' && (
            <Setting label="Help text" htmlFor={id('help')}>
              <Input
                id={id('help')}
                value={field.description ?? ''}
                maxLength={2000}
                onChange={(event) => onChange({ description: event.target.value || undefined })}
                placeholder="A line under the question"
                className="h-9 bg-card"
              />
            </Setting>
          )}
          {textLike && (
            <Setting label="Placeholder" htmlFor={id('placeholder')}>
              <Input
                id={id('placeholder')}
                value={field.placeholder ?? ''}
                maxLength={200}
                onChange={(event) => onChange({ placeholder: event.target.value || undefined })}
                placeholder="Faint text in the empty box"
                className="h-9 bg-card"
              />
            </Setting>
          )}
          {field.type === 'hidden' && (
            <Setting label="If the link has none" htmlFor={id('default')}>
              <Input
                id={id('default')}
                value={field.defaultValue ?? ''}
                maxLength={500}
                onChange={(event) => onChange({ defaultValue: event.target.value || undefined })}
                placeholder="website"
                className="h-9 bg-card"
              />
            </Setting>
          )}
          <Limits field={field} onChange={onChange} id={id} />
          {hasWidth && (
            <Setting label="Width">
              <SegmentedControl<'full' | 'half'>
                value={field.width ?? 'full'}
                onChange={(width) => onChange({ width: width === 'full' ? undefined : width })}
                ariaLabel="Width"
                options={[
                  { value: 'full', label: 'Full' },
                  { value: 'half', label: 'Half' },
                ]}
              />
            </Setting>
          )}
          <Setting label="API key" htmlFor={id('key')}>
            <Input
              id={id('key')}
              value={field.key}
              maxLength={60}
              className="h-9 bg-card font-mono text-xs"
              onChange={(event) => onChange({ key: event.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
            />
          </Setting>
        </div>
      )}

      {hasLogic && <LogicEditor field={field} fields={fields} onChange={onChange} />}

      {own.map((problem) => (
        <RowWarning key={problem.field + problem.message}>{problem.message}</RowWarning>
      ))}
    </fieldset>
  );
}

/** Min and max in the question's own words: characters, a range, how many to tick, stars, points. */
function Limits({ field, onChange, id }: { field: FormField; onChange: (patch: Partial<FormField>) => void; id: (name: string) => string }) {
  const number = (value: string) => (value.trim() === '' ? null : Number(value));
  if (field.type === 'rating')
    return (
      <Setting label="Stars">
        <NumberStepper label="Stars" value={ratingMax(field)} min={3} max={10} unit="stars" onChange={(max) => onChange({ max })} />
      </Setting>
    );
  if (field.type === 'scale') {
    const { min, max } = scaleRange(field);
    return (
      <>
        <Setting label="From – to">
          <div className="grid grid-cols-2 gap-2">
            <NumberStepper label="From" value={min} min={0} max={1} onChange={(next) => onChange({ min: next })} />
            <NumberStepper label="To" value={max} min={min + 1} max={min + 10} onChange={(next) => onChange({ max: next })} />
          </div>
        </Setting>
        <Setting label="End labels">
          <div className="grid grid-cols-2 gap-2">
            <Input
              aria-label="Label for the low end"
              placeholder="Not likely"
              value={field.minLabel ?? ''}
              maxLength={60}
              className="h-9 bg-card"
              onChange={(event) => onChange({ minLabel: event.target.value || undefined })}
            />
            <Input
              aria-label="Label for the high end"
              placeholder="Very likely"
              value={field.maxLabel ?? ''}
              maxLength={60}
              className="h-9 bg-card"
              onChange={(event) => onChange({ maxLabel: event.target.value || undefined })}
            />
          </div>
        </Setting>
      </>
    );
  }
  if (!['short_text', 'long_text', 'number', 'checkboxes'].includes(field.type)) return null;
  const label = field.type === 'number' ? 'Allowed range' : field.type === 'checkboxes' ? 'How many to tick' : 'Length (characters)';
  return (
    <Setting label={label} htmlFor={id('min')}>
      <div className="grid grid-cols-2 gap-2">
        <Input
          id={id('min')}
          aria-label="Minimum"
          type="number"
          placeholder="Min"
          value={field.min ?? ''}
          className="h-9 bg-card"
          onChange={(event) => onChange({ min: number(event.target.value) })}
        />
        <Input
          aria-label="Maximum"
          type="number"
          placeholder="Max"
          value={field.max ?? ''}
          className="h-9 bg-card"
          onChange={(event) => onChange({ max: number(event.target.value) })}
        />
      </div>
    </Setting>
  );
}

/** "Show only if" — conditions on the answers above. Removing the last one shows the question always again. */
function LogicEditor({
  field,
  fields,
  onChange,
}: {
  field: FormField;
  fields: FormField[];
  onChange: (patch: Partial<FormField>) => void;
}) {
  const sources = logicSources(field, fields);
  const logic = field.logic!;
  const conditions = logic.conditions;
  const setConditions = (next: FormCondition[], match = logic.match) => onChange({ logic: next.length ? { match, conditions: next } : null });

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
        Show only if
        {conditions.length > 1 && (
          <>
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
          </>
        )}
      </div>
      <ul className="space-y-2">
        {conditions.map((condition, conditionIndex) => {
          const source = fields.find((entry) => entry.id === condition.fieldId);
          const operators = source ? operatorsFor(source.type) : (['is_answered'] as ConditionOperator[]);
          const choices = source ? conditionChoices(source) : null;
          const update = (patch: Partial<FormCondition>) =>
            setConditions(conditions.map((entry, at) => (at === conditionIndex ? { ...entry, ...patch } : entry)));
          return (
            <li key={conditionIndex} className="flex flex-wrap items-center gap-1.5">
              <Select
                value={condition.fieldId}
                ariaLabel="Question"
                className="min-w-0 flex-1 basis-40"
                options={[
                  ...(source && !sources.includes(source)
                    ? [{ value: source.id, label: `${source.label} (below — move it up)`, disabled: true }]
                    : []),
                  ...(!source ? [{ value: condition.fieldId, label: 'A removed question', disabled: true }] : []),
                  ...sources.map((entry) => {
                    const SourceIcon = FIELD_ICONS[entry.type];
                    return { value: entry.id, label: entry.label || entry.key, icon: <SourceIcon size={13} aria-hidden="true" /> };
                  }),
                ]}
                onValueChange={(fieldId) => {
                  const next = fields.find((entry) => entry.id === fieldId)!;
                  update({ fieldId, operator: operatorsFor(next.type)[0]!, value: conditionChoices(next)?.[0] ?? '' });
                }}
              />
              <Select
                value={condition.operator}
                ariaLabel="Comparison"
                className="w-32 shrink-0"
                options={operators.map((operator) => ({ value: operator, label: OPERATOR_LABELS[operator] }))}
                onValueChange={(operator) => update({ operator: operator as ConditionOperator })}
              />
              {needsValue(condition.operator) &&
                (choices ? (
                  <Select
                    value={condition.value ?? ''}
                    ariaLabel="Answer"
                    className="min-w-0 flex-1 basis-28"
                    options={choices.map((choice) => ({ value: choice, label: choice }))}
                    onValueChange={(value) => update({ value })}
                  />
                ) : (
                  <Input
                    aria-label="Answer"
                    className="h-9 min-w-0 flex-1 basis-28 bg-card"
                    value={condition.value ?? ''}
                    maxLength={200}
                    onChange={(event) => update({ value: event.target.value })}
                  />
                ))}
              <button
                type="button"
                aria-label="Remove condition"
                onClick={() => setConditions(conditions.filter((_, at) => at !== conditionIndex))}
                className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-exception/8 hover:text-exception focus-visible:outline-2 focus-visible:outline-ring"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        onClick={() => {
          const next = blankCondition(sources);
          if (next) setConditions([...conditions, next]);
        }}
        className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
      >
        Add another condition
      </button>
    </div>
  );
}
