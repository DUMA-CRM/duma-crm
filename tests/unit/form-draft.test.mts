import assert from 'node:assert/strict';
import test from 'node:test';

import { type FormDraft, applyPatch, draftPatch, heldPatch, normalizeDraft } from '../../lib/utils/form-draft.ts';
import type { FormDefinition } from '../../lib/utils/forms.ts';

const definition: FormDefinition = {
  fields: [{ id: 'f_1', key: 'size', type: 'radio', label: 'Size', options: [{ id: 'o_1', label: 'Small' }] }],
};
const draft = (patch: Partial<FormDraft> = {}): FormDraft => ({
  name: 'Bookings',
  description: '',
  definition,
  closesAt: null,
  responseLimit: null,
  ...patch,
});

test('a blank name saves as "Untitled form" and a blank description as none', () => {
  const saved = normalizeDraft(draft({ name: '  ', description: '  ' }));
  assert.equal(saved.name, 'Untitled form');
  assert.equal(saved.description, null);
});

test('an option with no words is left out of what is saved, not the draft', () => {
  const editing = draft({
    definition: {
      fields: [
        {
          ...definition.fields[0]!,
          options: [
            { id: 'o_1', label: 'Small' },
            { id: 'o_2', label: ' ' },
          ],
        },
      ],
    },
  });
  assert.deepEqual(
    normalizeDraft(editing).definition.fields[0]!.options!.map((option) => option.id),
    ['o_1'],
  );
  assert.equal(editing.definition.fields[0]!.options!.length, 2);
});

test('nothing changed, nothing sent', () => {
  const saved = normalizeDraft(draft());
  assert.deepEqual(draftPatch(saved, normalizeDraft(draft()), { live: false }), { patch: {}, held: [] });
});

test('a form never published saves everything as you go', () => {
  const saved = normalizeDraft(draft());
  const next = normalizeDraft(draft({ name: 'Table bookings', responseLimit: 40, definition: { ...definition, submitLabel: 'Book' } }));
  const { patch, held } = draftPatch(saved, next, { live: false });
  assert.deepEqual(held, []);
  assert.equal(patch.name, 'Table bookings');
  assert.equal(patch.responseLimit, 40);
  assert.equal(patch.definition?.submitLabel, 'Book');
});

test('on a live form the questions save, but what respondents read at once is held for Publish', () => {
  const saved = normalizeDraft(draft());
  const next = normalizeDraft(
    draft({
      name: 'Renamed',
      description: 'New words',
      closesAt: '2026-12-01T00:00:00.000Z',
      definition: { ...definition, submitLabel: 'Go' },
    }),
  );
  const { patch, held } = draftPatch(saved, next, { live: true });
  assert.deepEqual(Object.keys(patch), ['definition']);
  assert.deepEqual(held, ['name', 'description', 'closesAt']);
  assert.deepEqual(heldPatch(next, held), { name: 'Renamed', description: 'New words', closesAt: '2026-12-01T00:00:00.000Z' });
});

test('what has landed becomes the new saved draft', () => {
  const saved = normalizeDraft(draft());
  const next = normalizeDraft(draft({ name: 'Renamed' }));
  const { patch } = draftPatch(saved, next, { live: false });
  assert.deepEqual(draftPatch(applyPatch(saved, patch), next, { live: false }).patch, {});
});
