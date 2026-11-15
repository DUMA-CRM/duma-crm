import assert from 'node:assert/strict';
import test from 'node:test';

import type { PublicQrMenu } from '../../lib/api/public-ordering.service';
import { type QrPreviewDraft, applyQrPreview } from '../../lib/utils/qr-preview.ts';

const menu = {
  brand: { name: 'Duma' },
  location: { name: 'Duma #1', address: '1 High St', phone: null, timeZone: 'Europe/London' },
  content: {
    schemaVersion: 1,
    welcomeMessage: 'Old',
    collectionInstructions: '',
    coverImageUrl: null,
    featuredItemIds: [],
    categoryOrder: [],
  },
  ordering: {
    paused: false,
    isOpenNow: true,
    canCheckout: true,
    cardEnabled: true,
    cashEnabled: false,
    minimumOrderAmount: '0.00',
    slots: [],
  },
  categories: [
    { id: 'c1', name: 'Coffee', description: null, imageUrl: null, items: [{ id: 'latte' }, { id: 'mocha' }] },
    { id: 'c2', name: 'Cakes', description: null, imageUrl: null, items: [{ id: 'brownie' }] },
  ],
  publishedAt: '2026-11-01T10:00:00Z',
} as unknown as PublicQrMenu;

const draft = (changes: Partial<QrPreviewDraft> = {}): QrPreviewDraft => ({
  isEnabled: true,
  isPaused: false,
  cardEnabled: true,
  cashEnabled: false,
  minimumOrderAmount: '0.00',
  content: { ...menu.content, welcomeMessage: 'New' },
  visibility: {},
  ...changes,
});

test('the preview shows the draft’s welcome screen and hides what the draft hides', () => {
  const shown = applyQrPreview(menu, draft({ visibility: { mocha: false, brownie: false } }));
  assert.equal(shown.content.welcomeMessage, 'New');
  assert.deepEqual(
    shown.categories.map((category) => [category.id, category.items.map((item) => item.id)]),
    [['c1', ['latte']]],
  );
});

test('checkout in the preview follows the draft’s switches — off, paused or no way to pay closes it', () => {
  assert.equal(applyQrPreview(menu, draft()).ordering.canCheckout, true);
  assert.equal(applyQrPreview(menu, draft({ isPaused: true })).ordering.canCheckout, false);
  assert.equal(applyQrPreview(menu, draft({ isEnabled: false })).ordering.paused, true);
  assert.equal(applyQrPreview(menu, draft({ cardEnabled: false, cashEnabled: false })).ordering.canCheckout, false);
});
