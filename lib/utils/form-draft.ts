import type { FormDefinition } from './forms.ts';

/**
 * What the form editor saves as you go, and what it holds back.
 *
 * The API keeps a form's questions twice — the draft (`definition`) and the
 * live snapshot (`publishedDefinition`) — so saving the questions never changes
 * what respondents see. The name, the description, the closing date and the
 * response limit are different: they live on the form itself, and the public
 * page reads them straight away. So on a form that has been published those
 * four are held here until Publish; on a form that never has, everything saves.
 */

/** What the builder and the settings edit together. */
export interface FormDraft {
  name: string;
  description: string;
  definition: FormDefinition;
  closesAt: string | null;
  responseLimit: number | null;
}

/** The draft as the API stores it. */
export interface SavedDraft {
  name: string;
  description: string | null;
  definition: FormDefinition;
  closesAt: string | null;
  responseLimit: number | null;
}

export type RowField = 'name' | 'description' | 'closesAt' | 'responseLimit';
const ROW_FIELDS: readonly RowField[] = ['name', 'description', 'closesAt', 'responseLimit'];

export interface DraftPatch {
  name?: string;
  description?: string | null;
  definition?: FormDefinition;
  closesAt?: string | null;
  responseLimit?: number | null;
}

/**
 * The draft as it would be stored: a blank name is "Untitled form", a blank
 * description is none, and an option with no words is left out — the API
 * refuses one, and a half-typed option shouldn't stop the rest saving.
 */
export function normalizeDraft(draft: FormDraft): SavedDraft {
  return {
    name: draft.name.trim() || 'Untitled form',
    description: draft.description.trim() || null,
    definition: {
      ...draft.definition,
      fields: draft.definition.fields.map((field) =>
        field.options && field.options.some((option) => !option.label.trim())
          ? { ...field, options: field.options.filter((option) => option.label.trim()) }
          : field,
      ),
    },
    closesAt: draft.closesAt,
    responseLimit: draft.responseLimit,
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * What to send to bring `saved` up to `next`, and what to hold back.
 *
 * `live` is whether the form has ever been published: then the name,
 * description, closing date and limit are `held` (they'd reach respondents at
 * once) and go with Publish instead.
 */
export function draftPatch(saved: SavedDraft, next: SavedDraft, { live }: { live: boolean }): { patch: DraftPatch; held: RowField[] } {
  const patch: DraftPatch = {};
  const held: RowField[] = [];
  if (!same(saved.definition, next.definition)) patch.definition = next.definition;
  for (const key of ROW_FIELDS) {
    if (same(saved[key], next[key])) continue;
    if (live) held.push(key);
    else Object.assign(patch, { [key]: next[key] });
  }
  return { patch, held };
}

/** The held fields, ready to send once the form is published. */
export function heldPatch(next: SavedDraft, held: readonly RowField[]): DraftPatch {
  return Object.fromEntries(held.map((key) => [key, next[key]])) as DraftPatch;
}

/** `saved` once `patch` has landed. */
export const applyPatch = (saved: SavedDraft, patch: DraftPatch): SavedDraft => ({ ...saved, ...patch });

export const isEmptyPatch = (patch: DraftPatch) => Object.keys(patch).length === 0;
