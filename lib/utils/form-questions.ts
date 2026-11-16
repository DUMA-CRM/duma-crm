import {
  FIELD_TYPES,
  type FormDefinition,
  type FormField,
  type FormFieldType,
  definitionFrom,
  isChoiceField,
  isInputField,
  newField,
  shortId,
} from './forms.ts';

/**
 * Starting a form from words: the type a question's wording suggests, and a
 * pasted list of questions turned into a draft. Deterministic — no AI — so the
 * same text always makes the same form, and a test pins every rule.
 */

const exists = (type: FormFieldType) => FIELD_TYPES.some((entry) => entry.type === type);

/** Rules in order; the first that matches wins. Each maps only to a type the builder has. */
const GUESSES: readonly [RegExp, FormFieldType][] = [
  [/\be-?mail\b/, 'email'],
  [/\b(phone|mobile|tel|telephone)\b/, 'phone'],
  [/\b(rate|rating|how was|stars?)\b/, 'rating'],
  // A question that starts like a yes/no question.
  [/^(do|does|did|are|is|was|were|would|will|have|has|can|could|should)\s+(you|we|they|this|it|there|your)\b/, 'yes_no'],
  [/\b(date|when|day|birthday|dob)\b/, 'date'],
  [/\b(time|arrival)\b/, 'time'],
  [/\b(how many|party size|guests?|number|quantity|qty|age|how old|covers)\b/, 'number'],
  [/\b(website|web address|url|link)\b/, 'url'],
  [/\b(message|comments?|tell us|describe|anything else|notes?|details|feedback|requests?)\b/, 'long_text'],
];

/**
 * The type a question's wording suggests: "Your email" → email, "How many
 * guests?" → number, "Do you have a dog?" → yes/no. A name, or anything else,
 * is a short answer.
 */
export function guessFieldType(label: string): FormFieldType {
  const text = label.toLowerCase().replace(/[’']/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return 'short_text';
  for (const [pattern, type] of GUESSES) if (pattern.test(text) && exists(type)) return type;
  return 'short_text';
}

/** A question read from pasted text, before it has an id or a key. */
export interface ParsedQuestion {
  label: string;
  type: FormFieldType;
  required: boolean;
  options?: string[];
}

/** The most a pasted list makes — the API takes 150 fields; leave room to add. */
export const MAX_PASTED_QUESTIONS = 100;
const MAX_OPTIONS = 200;

const BULLET = /^[-*•·–—+>]\s*/;
const NUMBERED = /^\(?(?:q(?:uestion)?\s*)?\d{1,3}(?:[.):\]]|\s+-)\s*/i;
const LETTERED = /^\(?[a-z][.)]\s+/i;
const REQUIRED = /\s*(?:\((?:required|req)\)|\[(?:required|req)\]|\*+)\s*$/i;
const OPTIONAL = /\s*(?:\(optional\)|\[optional\])\s*$/i;
const MULTI = /\b(all that apply|tick all|select all|choose all|any that apply|tick any|choose any|select any|multiple)\b/i;
const YES_NO = new Set(['yes', 'no', 'y', 'n']);

/** "  2) Your name *" → "Your name *": bullets and numbering off the front. */
function stripMarker(line: string, option: boolean): string {
  let text = line.trim().replace(BULLET, '').replace(NUMBERED, '');
  if (option) text = text.replace(LETTERED, '');
  return text.trim();
}

/** "Small, Medium, Large" or "Small / Medium / Large" → the options, when there are at least two. */
function splitOptions(text: string): string[] | null {
  const separator = text.includes('|') ? '|' : text.includes(',') ? ',' : text.includes(' / ') ? ' / ' : null;
  if (!separator) return null;
  const options = text
    .split(separator)
    .map((option) => option.trim().replace(/[.;]$/, '').trim())
    .filter(Boolean);
  return options.length >= 2 ? options : null;
}

/** "Name *" → required; "(required)" too. "(optional)" is dropped. */
function readRequired(text: string): { text: string; required: boolean } {
  if (OPTIONAL.test(text)) return { text: text.replace(OPTIONAL, '').trim(), required: false };
  if (REQUIRED.test(text)) return { text: text.replace(REQUIRED, '').trim(), required: true };
  return { text, required: false };
}

/** One question line: its words, whether it's required, and options written on the same line. */
function readQuestion(line: string): ParsedQuestion | null {
  let { text, required } = readRequired(stripMarker(line, false));
  let options: string[] | null = null;

  // "Size: Small, Medium, Large" — the words after the colon are the options.
  const colon = text.indexOf(':');
  if (colon > 0) {
    const listed = splitOptions(text.slice(colon + 1));
    if (listed) {
      options = listed;
      text = text.slice(0, colon).trim();
    }
  }
  // "Dietary needs (Vegan, Vegetarian, Gluten-free)" — a list in brackets at the end.
  if (!options) {
    const bracket = /\(([^()]+)\)\s*[?]?$/.exec(text);
    const listed = bracket ? splitOptions(bracket[1]!) : null;
    if (bracket && listed) {
      options = listed;
      text = (text.slice(0, bracket.index).trim() + (text.trimEnd().endsWith('?') ? '?' : '')).trim();
    }
  }
  // A marker after the options ("Size: S, M, L *") was read with them; read it again.
  if (!required) ({ text, required } = readRequired(text));
  if (!text) return null;

  const question: ParsedQuestion = { label: text.slice(0, 500), type: guessFieldType(text), required };
  if (options) withOptions(question, options);
  return question;
}

/** Give a question its options, choosing the kind of choice they make. */
function withOptions(question: ParsedQuestion, options: string[]) {
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const option of options) {
    const label = option.trim().slice(0, 200);
    if (!label || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    unique.push(label);
  }
  if (unique.length === 2 && unique.every((option) => YES_NO.has(option.toLowerCase())) && exists('yes_no')) {
    question.type = 'yes_no';
    delete question.options;
    return;
  }
  question.options = unique.slice(0, MAX_OPTIONS);
  question.type = MULTI.test(question.label) ? 'checkboxes' : unique.length > 6 ? 'select' : 'radio';
}

/**
 * Each line of pasted text as a question.
 *
 * - Numbering ("1.", "2)", "Q3:") and bullets ("-", "*", "•") are dropped.
 * - A trailing `*` or "(required)" makes it required.
 * - `Size: Small, Medium, Large` — or indented lines under a question, with or
 *   without bullets — become a choice with those options. Two options that are
 *   yes and no make a yes/no question.
 * - Blank lines are ignored. Every other question gets the type its wording
 *   suggests (`guessFieldType`).
 */
export function questionsFromText(text: string): ParsedQuestion[] {
  const lines = text
    .replace(/\t/g, '  ')
    .split(/\r?\n/)
    .filter((line) => line.trim());
  // Text indented as a whole (copied from a document) counts from its own margin.
  const margin = Math.min(...lines.map((line) => /^\s*/.exec(line)![0].length));
  const questions: ParsedQuestion[] = [];
  let pendingOptions: string[] = [];
  // "Size:" on its own opens a list: the bullet lines under it are its options.
  let listOpen = false;
  const settle = () => {
    const last = questions.at(-1);
    if (last && pendingOptions.length) withOptions(last, [...(last.options ?? []), ...pendingOptions]);
    pendingOptions = [];
  };

  for (const raw of lines) {
    const indented = /^\s*/.exec(raw)![0].length > margin;
    if (questions.length > 0 && (indented || (listOpen && BULLET.test(raw.trim())))) {
      const option = stripMarker(raw, true);
      if (option) pendingOptions.push(option);
      continue;
    }
    settle();
    listOpen = false;
    if (questions.length >= MAX_PASTED_QUESTIONS) break;
    const question = readQuestion(raw);
    if (!question) continue;
    if (question.label.endsWith(':')) {
      question.label = question.label.replace(/:+$/, '').trim();
      question.type = guessFieldType(question.label);
      listOpen = !question.options;
    }
    if (question.label) questions.push(question);
  }
  settle();
  return questions;
}

/** A draft made from pasted questions — ids and keys filled in, ready to create. */
export function definitionFromQuestions(questions: readonly ParsedQuestion[], random: () => number = Math.random): FormDefinition {
  return definitionFrom(
    questions.map((question) => ({
      type: question.type,
      label: question.label,
      ...(question.required && { required: true }),
      ...(question.options && { choices: question.options }),
    })),
    {},
    random,
  );
}

/**
 * The same question as another type: its words, key, help text, required and
 * logic stay; options carry between kinds of choice; anything that only made
 * sense for the old type (limits, a placeholder, a default) goes.
 */
export function changeFieldType(field: FormField, type: FormFieldType, random: () => number = Math.random): FormField {
  if (field.type === type) return field;
  const fresh = newField(type, [], random);
  const next: FormField = {
    id: field.id,
    key: field.key,
    type,
    label: field.label,
    ...(field.description && { description: field.description }),
    ...(field.required && { required: true }),
    ...(field.logic && { logic: field.logic }),
    ...(field.width && { width: field.width }),
  };
  if (isChoiceField(next)) next.options = field.options?.length ? field.options : fresh.options;
  if (type === 'rating') next.max = fresh.max;
  if (type === 'scale') Object.assign(next, { min: fresh.min, max: fresh.max, minLabel: fresh.minLabel, maxLabel: fresh.maxLabel });
  if (type === 'hidden') delete next.required;
  if (!isInputField(next)) {
    next.key = '';
    delete next.required;
    delete next.width;
  } else if (!next.key) {
    next.key = fresh.key;
  }
  if (type === 'page_break') next.label = '';
  return next;
}

/** A new, empty question whose type follows its wording until one is chosen. */
export function blankQuestion(fields: readonly FormField[], random: () => number = Math.random): FormField {
  const field = newField('short_text', fields, random);
  return { ...field, label: '' };
}

/** An option with a fresh id. */
export const newOption = (label: string, random: () => number = Math.random) => ({ id: shortId('o', random), label });
