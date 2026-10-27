// ---------------------------------------------------------------------------
// Forms, as the builder, the hosted page and the share panel shape them.
//
// The rules — which fields a respondent sees, whether an answer is acceptable,
// what stops a draft being published — are a copy of duma-api's
// `src/lib/form-rules.ts`, tested against the same cases, so a mistake is
// caught where it's typed and the hosted page agrees with the API. The API is
// still the one that decides: it checks every submission again.
//
// Answers are keyed by field id; a field's `key` is the name integrations use.
// ---------------------------------------------------------------------------

export type FormFieldType =
  | 'short_text'
  | 'long_text'
  | 'email'
  | 'phone'
  | 'number'
  | 'url'
  | 'date'
  | 'time'
  | 'select'
  | 'radio'
  | 'checkboxes'
  | 'yes_no'
  | 'consent'
  | 'rating'
  | 'scale'
  | 'hidden'
  | 'heading'
  | 'paragraph'
  | 'page_break';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'is_answered'
  | 'is_not_answered'
  | 'greater_than'
  | 'less_than';

export interface FormCondition {
  fieldId: string;
  operator: ConditionOperator;
  value?: string;
}

export interface FormLogic {
  match: 'all' | 'any';
  conditions: FormCondition[];
}

export interface FormOption {
  id: string;
  label: string;
}

export interface FormField {
  id: string;
  key: string;
  type: FormFieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  options?: FormOption[];
  min?: number | null;
  max?: number | null;
  minLabel?: string;
  maxLabel?: string;
  defaultValue?: string;
  width?: 'full' | 'half';
  logic?: FormLogic | null;
}

export interface CustomerLink {
  enabled: boolean;
  emailFieldId?: string | null;
  nameFieldId?: string | null;
  phoneFieldId?: string | null;
}

export interface FormDefinition {
  fields: FormField[];
  submitLabel?: string;
  successTitle?: string;
  successMessage?: string;
  redirectUrl?: string | null;
  closedMessage?: string;
  showProgress?: boolean;
  accentColor?: string | null;
  customerLink?: CustomerLink | null;
}

export type FormStatus = 'draft' | 'published' | 'closed' | 'archived';
export type FormResponseStatus = 'new' | 'reviewed' | 'archived';
export type FormResponseSource = 'hosted' | 'embed' | 'api';

export type Answer = string | number | boolean | string[];
export type Answers = Record<string, Answer>;

export interface Problem {
  field: string;
  message: string;
}

// ─── The field palette ────────────────────────────────────────────────────────

export type FieldGroup = 'Text' | 'Choice' | 'Rating' | 'Date and time' | 'Layout' | 'Behind the scenes';

export const FIELD_TYPES: readonly { type: FormFieldType; label: string; hint: string; group: FieldGroup }[] = [
  { type: 'short_text', label: 'Short answer', hint: 'A name, a company — one line', group: 'Text' },
  { type: 'long_text', label: 'Long answer', hint: 'A message or details — several lines', group: 'Text' },
  { type: 'email', label: 'Email', hint: 'Checked for a valid address', group: 'Text' },
  { type: 'phone', label: 'Phone', hint: 'A phone number', group: 'Text' },
  { type: 'number', label: 'Number', hint: 'A party size, a budget', group: 'Text' },
  { type: 'url', label: 'Web address', hint: 'A link — checked to start http(s)', group: 'Text' },
  { type: 'radio', label: 'Single choice', hint: 'Pick one, all options shown', group: 'Choice' },
  { type: 'select', label: 'Dropdown', hint: 'Pick one from a list', group: 'Choice' },
  { type: 'checkboxes', label: 'Multiple choice', hint: 'Pick any — dietary needs', group: 'Choice' },
  { type: 'yes_no', label: 'Yes / no', hint: 'Two buttons', group: 'Choice' },
  { type: 'consent', label: 'Consent', hint: 'A box to tick — terms, marketing', group: 'Choice' },
  { type: 'rating', label: 'Star rating', hint: '1 to 5 stars', group: 'Rating' },
  { type: 'scale', label: 'Scale', hint: '0 to 10 — how likely to recommend', group: 'Rating' },
  { type: 'date', label: 'Date', hint: 'A day — of an event, a visit', group: 'Date and time' },
  { type: 'time', label: 'Time', hint: 'A time of day', group: 'Date and time' },
  { type: 'heading', label: 'Heading', hint: 'A title between questions', group: 'Layout' },
  { type: 'paragraph', label: 'Text', hint: 'An explanation — no answer', group: 'Layout' },
  { type: 'page_break', label: 'Page break', hint: 'Starts a new step', group: 'Layout' },
  { type: 'hidden', label: 'Hidden field', hint: 'Filled from the link — a campaign, a table', group: 'Behind the scenes' },
];

export const FIELD_GROUPS: readonly FieldGroup[] = ['Text', 'Choice', 'Rating', 'Date and time', 'Layout', 'Behind the scenes'];

export const fieldTypeLabel = (type: FormFieldType) => FIELD_TYPES.find((entry) => entry.type === type)?.label ?? type;

const DISPLAY_TYPES: readonly FormFieldType[] = ['heading', 'paragraph', 'page_break'];
export const CHOICE_TYPES: readonly FormFieldType[] = ['select', 'radio', 'checkboxes'];

export const isInputField = (field: Pick<FormField, 'type'>) => !DISPLAY_TYPES.includes(field.type);
export const isChoiceField = (field: Pick<FormField, 'type'>) => CHOICE_TYPES.includes(field.type);

/** Types that may be compared in a condition, and how. */
export function operatorsFor(type: FormFieldType): ConditionOperator[] {
  if (type === 'checkboxes') return ['contains', 'not_contains', 'is_answered', 'is_not_answered'];
  if (type === 'radio' || type === 'select' || type === 'yes_no' || type === 'consent')
    return ['equals', 'not_equals', 'is_answered', 'is_not_answered'];
  if (type === 'number' || type === 'rating' || type === 'scale')
    return ['equals', 'not_equals', 'greater_than', 'less_than', 'is_answered', 'is_not_answered'];
  return ['equals', 'not_equals', 'contains', 'not_contains', 'is_answered', 'is_not_answered'];
}

export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'is',
  not_equals: 'is not',
  contains: 'contains',
  not_contains: 'doesn’t contain',
  is_answered: 'is answered',
  is_not_answered: 'isn’t answered',
  greater_than: 'is more than',
  less_than: 'is less than',
};

export const needsValue = (operator: ConditionOperator) => operator !== 'is_answered' && operator !== 'is_not_answered';

/** The values a condition on this field can take, when there's a fixed set. */
export function conditionChoices(field: FormField): string[] | null {
  if (isChoiceField(field)) return (field.options ?? []).map((option) => option.label);
  if (field.type === 'yes_no' || field.type === 'consent') return ['yes', 'no'];
  if (field.type === 'rating') return Array.from({ length: ratingMax(field) }, (_, index) => String(index + 1));
  return null;
}

/** "Shown when Occasion is Corporate" — or null when the field always shows. */
export function logicSummary(field: FormField, fields: readonly FormField[]): string | null {
  const conditions = field.logic?.conditions ?? [];
  if (conditions.length === 0) return null;
  const parts = conditions.map((condition) => {
    const source = fields.find((candidate) => candidate.id === condition.fieldId);
    const name = source?.label.trim() || 'a removed question';
    return `${name} ${OPERATOR_LABELS[condition.operator]}${needsValue(condition.operator) ? ` ${condition.value ?? ''}`.trimEnd() : ''}`;
  });
  return `Shown when ${parts.join(field.logic?.match === 'any' ? ' or ' : ' and ')}`;
}

// ─── Building ─────────────────────────────────────────────────────────────────

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
/** A short random id, unique enough within one form. */
export function shortId(prefix: string, random: () => number = Math.random): string {
  let id = '';
  for (let index = 0; index < 6; index++) id += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `${prefix}_${id}`;
}

/** An API key from a label: "Your email address" → your_email_address, made unique against `taken`. */
export function keyFromLabel(label: string, taken: ReadonlySet<string>): string {
  const base =
    label
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/^(\d)/, 'q_$1')
      .slice(0, 50) || 'question';
  if (!taken.has(base)) return base;
  for (let suffix = 2; ; suffix++) if (!taken.has(`${base}_${suffix}`)) return `${base}_${suffix}`;
}

export const FIELD_DEFAULT_LABEL: Partial<Record<FormFieldType, string>> = {
  email: 'Email',
  phone: 'Phone number',
  date: 'Date',
  time: 'Time',
  yes_no: 'Yes or no?',
  consent: 'I agree to the terms',
  rating: 'How would you rate us?',
  scale: 'How likely are you to recommend us?',
  heading: 'A new section',
  paragraph: 'Explain something here.',
  hidden: 'Source',
};

/** A new field of this type with sensible defaults, its id and key unique among `fields`. */
export function newField(type: FormFieldType, fields: readonly FormField[], random: () => number = Math.random): FormField {
  const ids = new Set(fields.map((field) => field.id));
  let id = shortId('f', random);
  while (ids.has(id)) id = shortId('f', random);
  const label = FIELD_DEFAULT_LABEL[type] ?? (type === 'page_break' ? '' : 'Untitled question');
  const field: FormField = { id, key: '', type, label };
  if (isInputField(field)) field.key = keyFromLabel(type === 'hidden' ? 'source' : label, new Set(fields.map((other) => other.key)));
  if (isChoiceField(field)) {
    field.options = ['Option 1', 'Option 2'].map((optionLabel) => ({ id: shortId('o', random), label: optionLabel }));
  }
  if (type === 'scale') Object.assign(field, { min: 0, max: 10, minLabel: 'Not likely', maxLabel: 'Very likely' });
  if (type === 'rating') field.max = 5;
  return field;
}

/** A copy of a field, placed after it, with a fresh id and key. */
export function duplicateField(
  fields: readonly FormField[],
  id: string,
  random: () => number = Math.random,
): { fields: FormField[]; copyId: string | null } {
  const index = fields.findIndex((field) => field.id === id);
  if (index < 0) return { fields: [...fields], copyId: null };
  const original = fields[index]!;
  const fresh = newField(original.type, fields, random);
  const copy: FormField = {
    ...structuredClone(original),
    id: fresh.id,
    key: isInputField(original) ? keyFromLabel(original.key || original.label, new Set(fields.map((field) => field.key))) : '',
    label: original.label ? `${original.label} (copy)` : original.label,
    options: original.options?.map((option) => ({ ...option, id: shortId('o', random) })),
  };
  return { fields: [...fields.slice(0, index + 1), copy, ...fields.slice(index + 1)], copyId: copy.id };
}

/**
 * Remove a field and everything that pointed at it: conditions on it, and the
 * customer link's reference. Saved answers keep their values under its id.
 */
export function removeField(definition: FormDefinition, id: string): FormDefinition {
  const fields = definition.fields
    .filter((field) => field.id !== id)
    .map((field) => {
      if (!field.logic?.conditions.some((condition) => condition.fieldId === id)) return field;
      const conditions = field.logic.conditions.filter((condition) => condition.fieldId !== id);
      return { ...field, logic: conditions.length ? { ...field.logic, conditions } : null };
    });
  const link = definition.customerLink;
  const unlink = (value: string | null | undefined) => (value === id ? null : value);
  return {
    ...definition,
    fields,
    customerLink: link
      ? { ...link, emailFieldId: unlink(link.emailFieldId), nameFieldId: unlink(link.nameFieldId), phoneFieldId: unlink(link.phoneFieldId) }
      : link,
  };
}

/** The answer an example request would send for a field — for the API snippet and the preview. */
export function exampleAnswer(field: FormField): Answer | undefined {
  switch (field.type) {
    case 'email':
      return 'sam@example.com';
    case 'phone':
      return '+44 7700 900123';
    case 'number':
      return field.min ?? 4;
    case 'url':
      return 'https://example.com';
    case 'date':
      return '2026-12-24';
    case 'time':
      return '19:30';
    case 'radio':
    case 'select':
      return field.options?.[0]?.label ?? '';
    case 'checkboxes':
      return (field.options ?? []).slice(0, 1).map((option) => option.label);
    case 'yes_no':
    case 'consent':
      return true;
    case 'rating':
      return ratingMax(field);
    case 'scale':
      return scaleRange(field).max;
    case 'hidden':
      return field.defaultValue || 'instagram';
    case 'long_text':
      return 'A table by the window, please.';
    case 'short_text':
      return 'Sam Lee';
    default:
      return undefined;
  }
}

// ─── The rules (mirror of duma-api src/lib/form-rules.ts) ─────────────────────

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,59}$/;
export const scaleRange = (field: Pick<FormField, 'min' | 'max'>) => ({ min: field.min ?? 0, max: field.max ?? 10 });
export const ratingMax = (field: Pick<FormField, 'max'>) => field.max ?? 5;

export const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
};

/** What stops a draft being published. A draft may be saved with these; the builder shows them. */
export function definitionProblems(definition: FormDefinition): Problem[] {
  const problems: Problem[] = [];
  const ids = new Set<string>();
  const keys = new Set<string>();
  const seen = new Map<string, FormField>();

  definition.fields.forEach((field, index) => {
    const at = `fields.${index}`;
    if (ids.has(field.id)) problems.push({ field: `${at}.id`, message: 'Two fields share an id' });
    ids.add(field.id);
    if (isInputField(field)) {
      if (!field.label.trim()) problems.push({ field: `${at}.label`, message: 'Every question needs a label' });
      if (!KEY_PATTERN.test(field.key)) {
        problems.push({
          field: `${at}.key`,
          message: `“${field.label || 'A field'}” needs an API key of lower-case letters, numbers and _`,
        });
      } else if (keys.has(field.key)) {
        problems.push({ field: `${at}.key`, message: `Two fields use the API key “${field.key}”` });
      }
      keys.add(field.key);
    }
    if (isChoiceField(field)) {
      const options = field.options ?? [];
      if (options.length === 0)
        problems.push({ field: `${at}.options`, message: `“${field.label || 'A choice'}” needs at least one option` });
      const labels = new Set(options.map((option) => option.label.trim().toLowerCase()));
      if (labels.size !== options.length)
        problems.push({ field: `${at}.options`, message: `“${field.label}” lists the same option twice` });
    }
    if (field.min != null && field.max != null && field.min > field.max) {
      problems.push({ field: `${at}.max`, message: `“${field.label}”: the maximum is below the minimum` });
    }
    if (field.type === 'rating' && field.max != null && (field.max < 3 || field.max > 10)) {
      problems.push({ field: `${at}.max`, message: 'A rating goes up to between 3 and 10' });
    }
    if (field.type === 'scale') {
      const { min, max } = scaleRange(field);
      if (max - min < 1 || max - min > 10) problems.push({ field: `${at}.max`, message: 'A scale has between 2 and 11 points' });
    }
    for (const [conditionIndex, condition] of (field.logic?.conditions ?? []).entries()) {
      const source = seen.get(condition.fieldId);
      const where = `${at}.logic.conditions.${conditionIndex}`;
      if (!source) {
        problems.push({ field: where, message: `“${field.label || 'A field'}” depends on a question that isn’t above it` });
      } else if (!isInputField(source)) {
        problems.push({ field: where, message: `“${field.label}” depends on something that has no answer` });
      } else if (needsValue(condition.operator) && !condition.value?.trim()) {
        problems.push({ field: where, message: `“${field.label}”: say what the answer is compared with` });
      }
    }
    seen.set(field.id, field);
  });

  if (definition.fields.filter(isInputField).length === 0) problems.push({ field: 'fields', message: 'Add at least one question' });
  if (definition.fields[0]?.type === 'page_break' || definition.fields.at(-1)?.type === 'page_break') {
    problems.push({ field: 'fields', message: 'A page break belongs between questions' });
  }
  if (definition.redirectUrl && !isHttpUrl(definition.redirectUrl)) {
    problems.push({ field: 'redirectUrl', message: 'The redirect must be an http(s) address' });
  }
  const link = definition.customerLink;
  if (link?.enabled) {
    const email = link.emailFieldId ? seen.get(link.emailFieldId) : undefined;
    if (!email || email.type !== 'email')
      problems.push({ field: 'customerLink.emailFieldId', message: 'Choose the email question that identifies the customer' });
    if (link.nameFieldId && !seen.has(link.nameFieldId))
      problems.push({ field: 'customerLink.nameFieldId', message: 'The name question no longer exists' });
    const phone = link.phoneFieldId ? seen.get(link.phoneFieldId) : undefined;
    if (link.phoneFieldId && phone?.type !== 'phone')
      problems.push({ field: 'customerLink.phoneFieldId', message: 'Choose a phone question for the phone number' });
  }
  return problems;
}

/** The index of the field a problem is about, so the builder can select it. */
export function problemFieldIndex(problem: Problem): number | null {
  const match = /^fields\.(\d+)/.exec(problem.field);
  return match ? Number(match[1]) : null;
}

const isEmpty = (value: unknown) => value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0);

const asText = (value: Answer | undefined): string =>
  value === undefined ? '' : Array.isArray(value) ? value.join(', ') : typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value);

function conditionHolds(condition: { operator: string; value?: string }, answer: Answer | undefined): boolean {
  const expected = (condition.value ?? '').trim().toLowerCase();
  const actual = asText(answer).trim().toLowerCase();
  const list = Array.isArray(answer) ? answer.map((entry) => entry.trim().toLowerCase()) : null;
  switch (condition.operator) {
    case 'is_answered':
      return !isEmpty(answer) && answer !== false;
    case 'is_not_answered':
      return isEmpty(answer) || answer === false;
    case 'equals':
      return list ? list.length === 1 && list[0] === expected : actual === expected;
    case 'not_equals':
      return list ? !(list.length === 1 && list[0] === expected) : actual !== expected;
    case 'contains':
      return list ? list.includes(expected) : actual.includes(expected);
    case 'not_contains':
      return list ? !list.includes(expected) : !actual.includes(expected);
    case 'greater_than':
    case 'less_than': {
      const left = Number(actual);
      const right = Number(expected);
      if (isEmpty(answer) || !Number.isFinite(left) || !Number.isFinite(right)) return false;
      return condition.operator === 'greater_than' ? left > right : left < right;
    }
    default:
      return false;
  }
}

/** The ids of the fields a respondent sees. A condition on a hidden question reads it as unanswered. */
export function visibleFieldIds(fields: readonly FormField[], answers: Answers): Set<string> {
  const visible = new Set<string>();
  for (const field of fields) {
    const logic = field.logic;
    if (!logic || logic.conditions.length === 0) {
      visible.add(field.id);
      continue;
    }
    const results = logic.conditions.map((condition) =>
      conditionHolds(condition, visible.has(condition.fieldId) ? answers[condition.fieldId] : undefined),
    );
    if (logic.match === 'any' ? results.some(Boolean) : results.every(Boolean)) visible.add(field.id);
  }
  return visible;
}

/** The fields split into pages at each page break; empty pages dropped. */
export function formPages<T extends Pick<FormField, 'type'>>(fields: readonly T[]): T[][] {
  const pages: T[][] = [[]];
  for (const field of fields) {
    if (field.type === 'page_break') pages.push([]);
    else pages[pages.length - 1]!.push(field);
  }
  return pages.filter((page) => page.length > 0);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE = /^\+?[0-9 ().-]{6,25}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

/** One field's answer, normalised — or the reason it's wrong. Undefined value: no answer. */
export function checkAnswer(field: FormField, raw: unknown): { value?: Answer; problem?: string } {
  const label = field.label || 'This question';
  const required = Boolean(field.required);
  const missing = () => (required ? { problem: `${label} is required` } : {});

  switch (field.type) {
    case 'short_text':
    case 'long_text':
    case 'email':
    case 'phone':
    case 'url':
    case 'hidden':
    case 'date':
    case 'time': {
      if (isEmpty(raw)) return field.type === 'hidden' ? {} : missing();
      if (typeof raw !== 'string' && typeof raw !== 'number') return { problem: `${label} must be text` };
      const value = String(raw).trim();
      if (!value) return field.type === 'hidden' ? {} : missing();
      const limit = field.type === 'long_text' ? 10_000 : field.type === 'hidden' ? 500 : 1000;
      if (value.length > limit) return { problem: `${label} is too long` };
      if (field.type === 'email' && !EMAIL.test(value)) return { problem: 'That email doesn’t look right' };
      if (field.type === 'phone' && !PHONE.test(value)) return { problem: 'That phone number doesn’t look right' };
      if (field.type === 'url' && !isHttpUrl(value)) return { problem: 'That web address doesn’t look right' };
      if (field.type === 'date' && (!DATE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))))
        return { problem: `${label} needs a date` };
      if (field.type === 'time' && !TIME.test(value)) return { problem: `${label} needs a time like 19:30` };
      if (field.type === 'short_text' || field.type === 'long_text') {
        if (field.min != null && value.length < field.min) return { problem: `${label} needs at least ${field.min} characters` };
        if (field.max != null && value.length > field.max) return { problem: `${label} takes at most ${field.max} characters` };
      }
      return { value: field.type === 'email' ? value.toLowerCase() : value };
    }
    case 'number': {
      if (isEmpty(raw)) return missing();
      const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;
      if (!Number.isFinite(value)) return { problem: `${label} needs a number` };
      if (field.min != null && value < field.min) return { problem: `${label} is at least ${field.min}` };
      if (field.max != null && value > field.max) return { problem: `${label} is at most ${field.max}` };
      return { value };
    }
    case 'rating':
    case 'scale': {
      if (isEmpty(raw)) return missing();
      const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw.trim()) : Number.NaN;
      const { min, max } = field.type === 'rating' ? { min: 1, max: ratingMax(field) } : scaleRange(field);
      if (!Number.isInteger(value) || value < min || value > max) return { problem: `${label} is a whole number from ${min} to ${max}` };
      return { value };
    }
    case 'select':
    case 'radio': {
      if (isEmpty(raw)) return missing();
      const option = matchOption(field, raw);
      return option ? { value: option } : { problem: `${label}: choose one of the options` };
    }
    case 'checkboxes': {
      if (isEmpty(raw)) return missing();
      const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [raw];
      const chosen: string[] = [];
      for (const entry of list) {
        const option = matchOption(field, entry);
        if (!option) return { problem: `${label}: choose from the options` };
        if (!chosen.includes(option)) chosen.push(option);
      }
      if (chosen.length === 0) return missing();
      if (field.min != null && chosen.length < field.min) return { problem: `${label}: choose at least ${field.min}` };
      if (field.max != null && chosen.length > field.max) return { problem: `${label}: choose at most ${field.max}` };
      return { value: chosen };
    }
    case 'yes_no': {
      if (isEmpty(raw)) return missing();
      const value = asBoolean(raw);
      return value === null ? { problem: `${label}: answer yes or no` } : { value };
    }
    case 'consent': {
      const value = isEmpty(raw) ? false : asBoolean(raw);
      if (value === null) return { problem: `${label}: tick the box or leave it` };
      if (required && !value) return { problem: `Please tick “${label}” to continue` };
      return { value };
    }
    default:
      return {};
  }
}

function matchOption(field: FormField, raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const wanted = raw.trim().toLowerCase();
  const option = (field.options ?? []).find((candidate) => candidate.id === raw || candidate.label.trim().toLowerCase() === wanted);
  return option?.label ?? null;
}

function asBoolean(raw: unknown): boolean | null {
  if (typeof raw === 'boolean') return raw;
  if (typeof raw === 'string') {
    const value = raw.trim().toLowerCase();
    if (['yes', 'true', 'on', '1'].includes(value)) return true;
    if (['no', 'false', 'off', '0'].includes(value)) return false;
  }
  if (raw === 1) return true;
  if (raw === 0) return false;
  return null;
}

/** The problems on one page of the hosted form, by field id — only for the questions the respondent can see. */
export function pageProblems(page: readonly FormField[], fields: readonly FormField[], answers: Answers): Record<string, string> {
  const visible = visibleFieldIds(fields, answers);
  const problems: Record<string, string> = {};
  for (const field of page) {
    if (!isInputField(field) || field.type === 'hidden' || !visible.has(field.id)) continue;
    const checked = checkAnswer(field, answers[field.id]);
    if (checked.problem) problems[field.id] = checked.problem;
  }
  return problems;
}

/** The answers to send: only the visible ones, keyed by API key, as the API documents. */
export function submissionAnswers(fields: readonly FormField[], answers: Answers): Record<string, Answer> {
  const visible = visibleFieldIds(fields, answers);
  const out: Record<string, Answer> = {};
  for (const field of fields) {
    if (!isInputField(field) || !visible.has(field.id)) continue;
    const value = answers[field.id];
    if (!isEmpty(value)) out[field.key] = value!;
  }
  return out;
}

/**
 * Answers filled from the link: `?email=sam@example.com&source=instagram`,
 * by API key. Hidden fields fall back to their default. Values that don't
 * suit the field are ignored, as the API would refuse them.
 */
export function prefillAnswers(fields: readonly FormField[], params: URLSearchParams): Answers {
  const answers: Answers = {};
  for (const field of fields) {
    if (!isInputField(field)) continue;
    const given = field.type === 'checkboxes' ? params.getAll(field.key).flatMap((value) => value.split(',')) : params.get(field.key);
    const raw = Array.isArray(given) ? (given.length ? given : null) : given;
    if (raw === null || raw === undefined) {
      if (field.type === 'hidden' && field.defaultValue) answers[field.id] = field.defaultValue;
      continue;
    }
    const checked = checkAnswer({ ...field, required: false }, raw);
    if (checked.value !== undefined) answers[field.id] = checked.value;
  }
  return answers;
}

/** Tracking parameters worth keeping with a response. */
export function responseMetadata(params: URLSearchParams, referrer: string): Record<string, string> {
  const metadata: Record<string, string> = {};
  for (const name of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const value = params.get(name);
    if (value) metadata[name] = value.slice(0, 200);
  }
  if (referrer) metadata.referrer = referrer.slice(0, 500);
  return metadata;
}

// ─── Showing answers ──────────────────────────────────────────────────────────

/** An answer as words: lists joined, booleans as Yes/No, nothing as a dash. */
export function answerText(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

/** The first answer that reads as a name or an email — the response's title in a list. */
export function responseTitle(fields: readonly FormField[], answers: Record<string, unknown>): string | null {
  const byType = (types: FormFieldType[]) =>
    fields.find((field) => types.includes(field.type) && typeof answers[field.id] === 'string' && answers[field.id]);
  const named = fields.find(
    (field) => field.type === 'short_text' && /name/i.test(`${field.key} ${field.label}`) && typeof answers[field.id] === 'string',
  );
  const pick = named ?? byType(['email']) ?? byType(['short_text']);
  return pick ? String(answers[pick.id]) : null;
}

// ─── Where a form stands ──────────────────────────────────────────────────────

export type FormStanding = 'draft' | 'live' | 'scheduled_close' | 'full' | 'ended' | 'closed' | 'archived';

export const STANDING_LABELS: Record<FormStanding, string> = {
  draft: 'Draft',
  live: 'Live',
  scheduled_close: 'Live',
  full: 'Full',
  ended: 'Ended',
  closed: 'Closed',
  archived: 'Archived',
};

export function formStanding(
  form: { status: FormStatus; closesAt: string | null; responseLimit: number | null; responseCount: number },
  now: number = Date.now(),
): FormStanding {
  if (form.status === 'archived') return 'archived';
  if (form.status === 'draft') return 'draft';
  if (form.status === 'closed') return 'closed';
  if (form.closesAt && Date.parse(form.closesAt) <= now) return 'ended';
  if (form.responseLimit != null && form.responseCount >= form.responseLimit) return 'full';
  return form.closesAt ? 'scheduled_close' : 'live';
}

export const responsesLabel = (count: number) => `${count.toLocaleString('en-GB')} ${count === 1 ? 'response' : 'responses'}`;

// ─── Sharing ──────────────────────────────────────────────────────────────────

export const hostedFormUrl = (origin: string, publicId: string) => `${origin.replace(/\/$/, '')}/f/${publicId}`;

/** A link that fills answers in (and hidden fields), by API key. */
export function prefillUrl(base: string, values: Record<string, string>): string {
  const params = new URLSearchParams(Object.entries(values).filter(([, value]) => value.trim() !== ''));
  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

/** An iframe that sizes itself to the form, through the height the page posts to its parent. */
export function embedSnippet(url: string, publicId: string, title: string): string {
  const safeTitle = title.replace(/"/g, '&quot;');
  return [
    `<iframe src="${url}?embed=1" data-duma-form="${publicId}" title="${safeTitle}" style="width:100%;border:0;min-height:480px" loading="lazy"></iframe>`,
    '<script>',
    'addEventListener("message", function (event) {',
    `  if (!event.data || event.data.type !== "duma-form:height" || event.data.form !== "${publicId}") return;`,
    `  var frame = document.querySelector('iframe[data-duma-form="${publicId}"]');`,
    '  if (frame) frame.style.height = event.data.height + "px";',
    '});',
    '</script>',
  ].join('\n');
}

/** curl commands for reading the form and submitting to it — with an example answer for every question. */
export function apiSnippets(
  apiBase: string,
  publicId: string,
  fields: readonly FormField[],
): { read: string; submit: string; body: Record<string, unknown> } {
  const answers: Record<string, unknown> = {};
  for (const field of fields) {
    if (!isInputField(field)) continue;
    const example = exampleAnswer(field);
    if (example !== undefined) answers[field.key] = example;
  }
  const body = { answers };
  const endpoint = `${apiBase.replace(/\/$/, '')}/v1/forms/public/${publicId}`;
  return {
    read: `curl ${endpoint}`,
    submit: [
      `curl -X POST ${endpoint}/responses \\`,
      `  -H "Content-Type: application/json" \\`,
      `  -d '${JSON.stringify(body, null, 2).replace(/'/g, "'\\''")}'`,
    ].join('\n'),
    body,
  };
}

// ─── Templates ────────────────────────────────────────────────────────────────

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  definition: () => FormDefinition;
}

type Spec = Omit<FormField, 'id' | 'key'> & { key?: string; options?: FormOption[] | undefined };

/** A definition from specs, with ids and keys filled in. */
export function definitionFrom(
  specs: readonly (Omit<Spec, 'options'> & { choices?: string[] })[],
  rest: Omit<FormDefinition, 'fields'> = {},
  random: () => number = Math.random,
): FormDefinition {
  const fields: FormField[] = [];
  for (const spec of specs) {
    const { choices, ...field } = spec;
    const base = newField(spec.type, fields, random);
    const key = spec.key ?? (isInputField(spec) ? keyFromLabel(spec.label, new Set(fields.map((other) => other.key))) : '');
    fields.push({
      ...base,
      ...field,
      key,
      ...(choices ? { options: choices.map((label) => ({ id: shortId('o', random), label })) } : {}),
    });
  }
  return {
    submitLabel: 'Submit',
    successTitle: 'Thank you!',
    successMessage: 'Your response has been received.',
    showProgress: true,
    ...rest,
    fields,
  };
}

const linkFrom = (definition: FormDefinition, keys: { email: string; name?: string; phone?: string }): FormDefinition => {
  const id = (key?: string) => (key ? (definition.fields.find((field) => field.key === key)?.id ?? null) : null);
  return {
    ...definition,
    customerLink: { enabled: true, emailFieldId: id(keys.email), nameFieldId: id(keys.name), phoneFieldId: id(keys.phone) },
  };
};

export const FORM_TEMPLATES: readonly FormTemplate[] = [
  {
    id: 'blank',
    name: 'Blank form',
    description: 'Start with nothing and add your own questions.',
    definition: () => definitionFrom([]),
  },
  {
    id: 'contact',
    name: 'Contact us',
    description: 'Name, email and a message — saved as a customer.',
    definition: () =>
      linkFrom(
        definitionFrom(
          [
            { type: 'short_text', label: 'Your name', key: 'name', required: true, width: 'half' },
            { type: 'email', label: 'Email', key: 'email', required: true, width: 'half' },
            { type: 'phone', label: 'Phone number', key: 'phone' },
            { type: 'long_text', label: 'How can we help?', key: 'message', required: true, placeholder: 'Tell us a little more' },
          ],
          { submitLabel: 'Send message', successTitle: 'Message sent', successMessage: 'Thanks — we’ll get back to you soon.' },
        ),
        { email: 'email', name: 'name', phone: 'phone' },
      ),
  },
  {
    id: 'private_event',
    name: 'Private event enquiry',
    description: 'Date, party size, occasion and budget — over two steps.',
    definition: () =>
      linkFrom(
        definitionFrom(
          [
            { type: 'heading', label: 'Tell us about your event' },
            { type: 'date', label: 'Date of the event', key: 'event_date', required: true, width: 'half' },
            { type: 'time', label: 'Start time', key: 'start_time', width: 'half' },
            { type: 'number', label: 'How many guests?', key: 'guests', required: true, min: 1, max: 500 },
            { type: 'radio', label: 'What’s the occasion?', key: 'occasion', choices: ['Birthday', 'Wedding', 'Corporate', 'Other'] },
            {
              type: 'checkboxes',
              label: 'Any dietary needs?',
              key: 'dietary',
              choices: ['Vegetarian', 'Vegan', 'Gluten-free', 'Nut allergy', 'Halal'],
            },
            { type: 'short_text', label: 'Budget per head', key: 'budget' },
            { type: 'page_break', label: '' },
            { type: 'short_text', label: 'Your name', key: 'name', required: true, width: 'half' },
            { type: 'email', label: 'Email', key: 'email', required: true, width: 'half' },
            { type: 'phone', label: 'Phone number', key: 'phone', required: true },
            { type: 'long_text', label: 'Anything else we should know?', key: 'notes' },
            { type: 'consent', label: 'Send me news and offers', key: 'marketing' },
          ],
          {
            submitLabel: 'Send enquiry',
            successTitle: 'Enquiry received',
            successMessage: 'Our events team will be in touch within a day.',
          },
        ),
        { email: 'email', name: 'name', phone: 'phone' },
      ),
  },
  {
    id: 'feedback',
    name: 'Feedback after a visit',
    description: 'A star rating, how likely they’d recommend, and what to improve.',
    definition: () => {
      const definition = definitionFrom(
        [
          { type: 'rating', label: 'How was your visit?', key: 'rating', required: true, max: 5 },
          {
            type: 'scale',
            label: 'How likely are you to recommend us to a friend?',
            key: 'nps',
            min: 0,
            max: 10,
            minLabel: 'Not likely',
            maxLabel: 'Very likely',
          },
          {
            type: 'checkboxes',
            label: 'What stood out?',
            key: 'highlights',
            choices: ['Food', 'Drinks', 'Service', 'Atmosphere', 'Value'],
          },
          { type: 'long_text', label: 'What could we do better?', key: 'improve' },
          { type: 'yes_no', label: 'May we contact you about your feedback?', key: 'contact_ok' },
          { type: 'email', label: 'Email', key: 'email', required: true },
          { type: 'hidden', label: 'Table', key: 'table' },
        ],
        { submitLabel: 'Send feedback', successTitle: 'Thank you!', successMessage: 'Your feedback helps us get better.' },
      );
      const ask = definition.fields.find((field) => field.key === 'contact_ok')!;
      const email = definition.fields.find((field) => field.key === 'email')!;
      email.logic = { match: 'all', conditions: [{ fieldId: ask.id, operator: 'equals', value: 'yes' }] };
      return definition;
    },
  },
  {
    id: 'job',
    name: 'Job application',
    description: 'Role, availability and experience.',
    definition: () =>
      definitionFrom(
        [
          { type: 'short_text', label: 'Full name', key: 'name', required: true, width: 'half' },
          { type: 'email', label: 'Email', key: 'email', required: true, width: 'half' },
          { type: 'phone', label: 'Phone number', key: 'phone', required: true },
          {
            type: 'select',
            label: 'Which role?',
            key: 'role',
            required: true,
            choices: ['Front of house', 'Kitchen', 'Bar', 'Barista', 'Management'],
          },
          {
            type: 'checkboxes',
            label: 'When can you work?',
            key: 'availability',
            choices: ['Weekday days', 'Weekday evenings', 'Weekends'],
          },
          { type: 'date', label: 'Earliest start date', key: 'start_date' },
          { type: 'long_text', label: 'Tell us about your experience', key: 'experience' },
          { type: 'url', label: 'Link to your CV or LinkedIn', key: 'cv_link' },
          { type: 'consent', label: 'I agree to my details being kept for this application', key: 'privacy', required: true },
        ],
        { submitLabel: 'Apply', successTitle: 'Application sent', successMessage: 'Thanks for applying — we’ll be in touch.' },
      ),
  },
  {
    id: 'newsletter',
    name: 'Newsletter sign-up',
    description: 'Just an email and a name — saved as a customer.',
    definition: () =>
      linkFrom(
        definitionFrom(
          [
            { type: 'short_text', label: 'First name', key: 'name', width: 'half' },
            { type: 'email', label: 'Email', key: 'email', required: true, width: 'half' },
            { type: 'consent', label: 'Yes, send me news and offers', key: 'marketing', required: true },
          ],
          {
            submitLabel: 'Sign up',
            successTitle: 'You’re on the list',
            successMessage: 'Look out for our next email.',
            showProgress: false,
          },
        ),
        { email: 'email', name: 'name' },
      ),
  },
];
