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
