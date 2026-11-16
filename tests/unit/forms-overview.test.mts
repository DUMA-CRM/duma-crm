import assert from 'node:assert/strict';
import test from 'node:test';

import { type FormsListRow, fillResponseDays, filterForms, formsOverview } from '../../lib/utils/forms-overview.ts';

const NOW = Date.parse('2026-11-16T12:00:00Z');

const form = (name: string, patch: Partial<FormsListRow> = {}): FormsListRow => ({
  name,
  status: 'published',
  closesAt: null,
  responseLimit: null,
  responseCount: 0,
  newResponses: 0,
  lastResponseAt: null,
  ...patch,
});

const forms = [
  form('Contact us', { responseCount: 12, newResponses: 3, lastResponseAt: '2026-11-15T09:00:00Z' }),
  form('Tasting night', { closesAt: '2026-11-20T18:00:00Z', responseLimit: 40, responseCount: 40 }),
  form('Christmas party', { closesAt: '2026-11-01T00:00:00Z', responseCount: 5, lastResponseAt: '2026-10-30T10:00:00Z' }),
  form('Feedback', { closesAt: '2026-12-31T00:00:00Z', responseCount: 2, newResponses: 2, lastResponseAt: '2026-11-16T08:00:00Z' }),
  form('Job application', { status: 'draft' }),
  form('Old newsletter', { status: 'archived', responseCount: 300, newResponses: 7, lastResponseAt: '2026-11-16T11:00:00Z' }),
];
const names = (rows: FormsListRow[]) => rows.map((row) => row.name);

test('a form closing on a date is live; one past its date or full is closed', () => {
  assert.deepEqual(names(filterForms(forms, { view: 'live', onlyNew: false, search: '' }, NOW)), ['Contact us', 'Feedback']);
  assert.deepEqual(names(filterForms(forms, { view: 'closed', onlyNew: false, search: '' }, NOW)), ['Tasting night', 'Christmas party']);
});

test('current leaves only the archive out; search and "new only" narrow it', () => {
  assert.equal(filterForms(forms, { view: 'current', onlyNew: false, search: '' }, NOW).length, 5);
  assert.deepEqual(names(filterForms(forms, { view: 'archived', onlyNew: false, search: '' }, NOW)), ['Old newsletter']);
  assert.deepEqual(names(filterForms(forms, { view: 'current', onlyNew: true, search: '' }, NOW)), ['Contact us', 'Feedback']);
  assert.deepEqual(names(filterForms(forms, { view: 'current', onlyNew: false, search: '  PARTY ' }, NOW)), ['Christmas party']);
});

test('the figures leave archived forms out', () => {
  assert.deepEqual(formsOverview(forms, NOW), {
    current: 5,
    live: 2,
    fresh: 5,
    waiting: 2,
    total: 59,
    lastResponseAt: '2026-11-16T08:00:00Z',
  });
  assert.deepEqual(formsOverview([], NOW), { current: 0, live: 0, fresh: 0, waiting: 0, total: 0, lastResponseAt: null });
});

test('response days are filled in between, and capped to the last span', () => {
  assert.deepEqual(
    fillResponseDays([
      { date: '2026-11-01', total: 2 },
      { date: '2026-11-04', total: 1 },
    ]),
    [
      { date: '2026-11-01', total: 2 },
      { date: '2026-11-02', total: 0 },
      { date: '2026-11-03', total: 0 },
      { date: '2026-11-04', total: 1 },
    ],
  );
  const capped = fillResponseDays(
    [
      { date: '2026-01-01', total: 1 },
      { date: '2026-11-16', total: 4 },
    ],
    60,
  );
  assert.equal(capped.length, 60);
  assert.equal(capped[0]!.date, '2026-09-18');
  assert.deepEqual(capped.at(-1), { date: '2026-11-16', total: 4 });
  assert.deepEqual(fillResponseDays([]), []);
});
