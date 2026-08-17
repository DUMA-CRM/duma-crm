import assert from 'node:assert/strict';
import test from 'node:test';

import { dateToIso, formatDate, formatIsoForInput, maskDateInput, parseDisplayDate } from '../lib/utils/date.ts';

test('formats app dates as DD/MM/YYYY without shifting date-only values', () => {
  assert.equal(formatDate('2026-08-02'), '02/08/2026');
  assert.equal(formatIsoForInput('2026-01-09'), '09/01/2026');
});

test('parses valid DD/MM/YYYY input into the API date contract', () => {
  assert.equal(parseDisplayDate('2/8/2026'), '2026-08-02');
  assert.equal(parseDisplayDate('29/02/2028'), '2028-02-29');
});

test('rejects impossible and ambiguous date input', () => {
  assert.equal(parseDisplayDate('29/02/2027'), null);
  assert.equal(parseDisplayDate('08-02-2026'), null);
  assert.equal(parseDisplayDate('02/08/26'), null);
});

test('keeps the date mask separators in place while digits are entered', () => {
  assert.equal(maskDateInput(''), '__/__/____');
  assert.equal(maskDateInput('2'), '2_/__/____');
  assert.equal(maskDateInput('0208'), '02/08/____');
  assert.equal(maskDateInput('02/08/2026'), '02/08/2026');
});

test('serialises local calendar selections without UTC drift', () => {
  assert.equal(dateToIso(new Date(2026, 7, 2)), '2026-08-02');
});

// ── Agent card periods ───────────────────────────────────────────────────────
// Cards used to print `2026-08-14 → 2026-08-14`: a database value standing in
// for a period, and a range where there was only ever one day.

const { calendarLabel, rangeLabel } = await import('../lib/ai/agent-format.ts');

const IN_2026 = new Date('2026-06-01T00:00:00Z');

test('a single-day range reads as a day, not as a range', () => {
  assert.equal(rangeLabel('2026-08-14', '2026-08-14', IN_2026), '14 Aug');
});

test('a range inside one month states the month once', () => {
  assert.equal(rangeLabel('2026-08-09', '2026-08-14', IN_2026), '9–14 Aug');
});

test('a range crossing months names both ends', () => {
  assert.equal(rangeLabel('2026-07-28', '2026-08-04', IN_2026), '28 Jul – 4 Aug');
});

test('the year appears only when the range leaves the current one', () => {
  assert.equal(rangeLabel('2025-12-30', '2025-12-30', IN_2026), '30 Dec 2025');
  assert.equal(rangeLabel('2025-12-30', '2026-01-02', IN_2026), '30 Dec 2025 – 2 Jan 2026');
  assert.equal(calendarLabel('2026-08-14'), '14 Aug');
});

// ── Follow-up voice ──────────────────────────────────────────────────────────
// A suggestion chip sends its own text as the next message, so a follow-up
// written as the assistant's question used to send that question back to it.

const { asOperatorRequest } = await import('../lib/ai/agent-format.ts');

test('an assistant-voice suggestion becomes the request underneath it', () => {
  assert.equal(asOperatorRequest('Would you like to check the failed entries?'), 'Check the failed entries');
  assert.equal(asOperatorRequest('Would you like me to compare with last week?'), 'Compare with last week');
  assert.equal(asOperatorRequest('Shall I open the audit log?'), 'Open the audit log');
  assert.equal(asOperatorRequest('Do you want me to draft the order?'), 'Draft the order');
  assert.equal(asOperatorRequest('Should we review yesterday’s refunds?'), 'Review yesterday’s refunds');
});

test("a question in the operator's own voice is already sendable and is left alone", () => {
  assert.equal(asOperatorRequest('What needs attention today?'), 'What needs attention today?');
  assert.equal(asOperatorRequest('Check stock risk'), 'Check stock risk');
  assert.equal(asOperatorRequest('Why is the variance so high?'), 'Why is the variance so high?');
});

test('the opener is only stripped when a real request follows it', () => {
  assert.equal(asOperatorRequest('Would you like to?'), 'Would you like to?');
  assert.equal(asOperatorRequest('  Shall I,  export the report? '), 'Export the report');
});
