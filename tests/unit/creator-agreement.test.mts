import assert from 'node:assert/strict';
import test from 'node:test';

import { agreementDocument, agreementReady, emptyAgreement, type Agreement } from '../../lib/marketplace/creator-agreement.ts';

const complete: Agreement = {
  ...emptyAgreement,
  law: 'england-wales',
  campaign: 'Autumn menu',
  advertiser: 'Example Brand Ltd, London',
  creator: 'Example Creator, Cardiff',
  deliverables: 'One Instagram reel',
  draftDate: '2026-11-26',
  publishDate: '2026-11-30',
  approval: 'One revision. Live for 30 days.',
  fee: '1250,50',
  payment: 'Pay within 14 days of invoice. VAT included.',
  usage: 'Organic repost on Instagram, UK, 30 days.',
  cancellation: '50% of the fee due after draft delivery.',
};

test('blocks export for missing commercial terms, invalid fees and invalid deadlines', () => {
  assert.equal(agreementReady(complete), true);
  assert.equal(agreementReady({ ...complete, usage: ' ' }), false);
  assert.equal(agreementReady({ ...complete, law: '' }), false);
  assert.equal(agreementReady({ ...complete, fee: '0' }), false);
  assert.equal(agreementReady({ ...complete, fee: '12.345' }), false);
  assert.equal(agreementReady({ ...complete, publishDate: '2026-11-25' }), false);
  assert.equal(agreementReady({ ...complete, publishDate: '2026-11-31' }), false);
});

test('localises clauses while retaining agreed currency, dates, jurisdiction and user-entered terms', () => {
  const english = agreementDocument(complete);
  assert.match(english.sections[1].body, /30 November 2026/);
  assert.match(english.sections[2].body, /GBP\s1,250\.50/);
  assert.match(english.sections.at(-2)!.body, /law of England and Wales/);

  const ukrainian = agreementDocument({ ...complete, language: 'uk', law: 'ukraine', additional: 'Узгоджена умова' });
  assert.match(ukrainian.sections[1].body, /30 листопада 2026/);
  assert.match(ukrainian.sections[1].body, /One Instagram reel/);
  assert.match(ukrainian.sections[2].body, /1\s250,50\sGBP/);
  assert.match(ukrainian.sections.at(-3)!.body, /Узгоджена умова/);
  assert.match(ukrainian.sections.at(-2)!.body, /право України/);
});
