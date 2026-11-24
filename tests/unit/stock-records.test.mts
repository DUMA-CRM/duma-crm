// Calendar helpers here read the runtime's local zone; pin it before any Date is made.
process.env.TZ = 'Europe/London';

import assert from 'node:assert/strict';
import test from 'node:test';

import { groupByDay, inLedgerView, movementTitle, netChange } from '../../lib/utils/ledger.ts';
import { periodFrom, readLoss, summariseLosses } from '../../lib/utils/losses.ts';
import {
  draftOrderTotal,
  dueLabel,
  invoiceDifference,
  isOverdue,
  lineValue,
  orderTotal,
  outstandingQuantity,
  receivedShare,
  sendableLines,
  summaryReceivedShare,
} from '../../lib/utils/purchase-orders.ts';
import { expiryLabel, itemAttention } from '../../lib/utils/stock-item.ts';
import { direction, itemLine, otherSide, quantityError, signedChange } from '../../lib/utils/transfers.ts';
import { setWorkspaceTimeZone } from '../../lib/utils/workspace-time.ts';

setWorkspaceTimeZone('Europe/London');

// ── Purchase orders ──────────────────────────────────────────────────────────

test('a purchase order totals each line to the penny, with no float artefacts', () => {
  const lines = [
    { quantityOrdered: '3', quantityReceived: '0', unitCost: '0.10' },
    { quantityOrdered: '12.5', quantityReceived: '0', unitCost: '1.333' },
    { quantityOrdered: 'x', quantityReceived: '0', unitCost: '4' },
  ];
  // 0.30 + 16.66 (16.6625 to the penny) + nothing for the unreadable line.
  assert.equal(orderTotal(lines), 16.96);
  assert.equal(orderTotal(), 0);
  assert.equal(lineValue('3', '0.10'), 0.3);
  assert.equal(lineValue('', '5'), 0);
});

test('the new-order form sends only complete lines and totals just those', () => {
  const lines = [
    { stockItemId: 'milk', quantity: '6', unitCost: '1.10' },
    { stockItemId: '', quantity: '2', unitCost: '3' },
    { stockItemId: 'beans', quantity: '0', unitCost: '9' },
    { stockItemId: 'cups', quantity: '100', unitCost: '-1' },
    { stockItemId: 'lids', quantity: '3', unitCost: '0.1' },
  ];
  assert.deepEqual(
    sendableLines(lines).map((line) => line.stockItemId),
    ['milk', 'lids'],
  );
  assert.equal(draftOrderTotal(lines), 6.9);
});

test('what is still to arrive is never negative and never a float artefact', () => {
  assert.equal(outstandingQuantity({ quantityOrdered: '2.3', quantityReceived: '1.1' }), 1.2);
  assert.equal(outstandingQuantity({ quantityOrdered: '5', quantityReceived: '7' }), 0);
  assert.equal(outstandingQuantity({ quantityOrdered: '5', quantityReceived: '0' }), 5);
});

test('received share caps each line, so an over-delivery cannot hide a short one', () => {
  const lines = [
    { quantityOrdered: '10', quantityReceived: '15', unitCost: '1' },
    { quantityOrdered: '10', quantityReceived: '0', unitCost: '1' },
  ];
  assert.equal(receivedShare(lines), 0.5);
  assert.equal(receivedShare([]), 0);
  assert.equal(summaryReceivedShare({ quantityOrdered: '4', quantityReceived: '1' }), 0.25);
  assert.equal(summaryReceivedShare({ quantityOrdered: '0', quantityReceived: '0' }), null);
  assert.equal(summaryReceivedShare(undefined), null);
});

test('an invoice is compared with the order total to the penny', () => {
  assert.equal(invoiceDifference('16.97', 16.96), 0.01);
  assert.equal(invoiceDifference('16.96', 16.96), 0);
  assert.equal(invoiceDifference(15, 16.96), -1.96);
  assert.equal(invoiceDifference('', 16.96), null);
  assert.equal(invoiceDifference(null, 16.96), null);
});

test('a delivery is due or late by the workspace calendar, not UTC', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  const open = (expectedAt: string) => ({ status: 'submitted', expectedAt });
  assert.equal(dueLabel(open('2026-11-24'), now), 'Due today');
  assert.equal(dueLabel(open('2026-11-25'), now), 'Due tomorrow');
  assert.equal(dueLabel(open('2026-11-23'), now), '1 day late');
  assert.equal(dueLabel(open('2026-11-21'), now), '3 days late');
  assert.match(dueLabel(open('2026-11-30'), now) ?? '', /^Due Mon 30 Nov/);
  assert.equal(dueLabel({ status: 'draft', expectedAt: '2026-11-21' }, now), null);
  assert.equal(dueLabel({ status: 'submitted', expectedAt: null }, now), null);
  // 23:30 UTC on 1 July is already 2 July in London: a 1 July delivery is late there.
  assert.equal(isOverdue(open('2026-07-01'), new Date('2026-07-01T23:30:00Z')), true);
  assert.equal(isOverdue({ status: 'received', expectedAt: '2026-01-01' }, now), false);
});

// ── Stock item ───────────────────────────────────────────────────────────────

const healthy = {
  isAvailable: true,
  onHand: 10,
  threshold: 4,
  unit: 'kg',
  daysLeft: 12,
  earliestExpiry: null,
  cost: '2.50',
  now: new Date('2026-11-24T10:00:00Z'),
};

test('a healthy stock item needs nothing', () => {
  assert.deepEqual(itemAttention(healthy), []);
});

test('stock item attention: out, below par, running out and expiry, worst first', () => {
  assert.deepEqual(
    itemAttention({ ...healthy, onHand: 0, cost: null }).map((item) => [item.id, item.severity]),
    [
      ['out', 'blocking'],
      ['no-cost', 'info'],
    ],
  );
  const low = itemAttention({ ...healthy, onHand: 1.5, daysLeft: 1 });
  assert.equal(low[0]!.id, 'low');
  // At or under half of par is blocking; above it is attention.
  assert.equal(low[0]!.severity, 'blocking');
  assert.equal(itemAttention({ ...healthy, onHand: 3 })[0]!.severity, 'attention');
  assert.equal(itemAttention({ ...healthy, daysLeft: 2 })[0]!.id, 'running-out');

  const expired = itemAttention({ ...healthy, earliestExpiry: '2026-11-23', isAvailable: false, threshold: 0 });
  assert.deepEqual(
    expired.map((item) => item.id),
    ['expired', 'unavailable', 'no-threshold'],
  );
  assert.equal(itemAttention({ ...healthy, earliestExpiry: '2026-11-25' })[0]!.title, 'A container expires tomorrow');
  // Nothing on hand: an expiry date on an empty shelf is not a warning.
  assert.equal(
    itemAttention({ ...healthy, onHand: 0, earliestExpiry: '2026-11-01' }).some((item) => item.id === 'expired'),
    false,
  );
});

test('expiry reads as days, then the date', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  assert.equal(expiryLabel(null, now), null);
  assert.equal(expiryLabel('2026-11-23', now), 'Expired');
  assert.equal(expiryLabel('2026-11-24', now), 'Today');
  assert.equal(expiryLabel('2026-11-25', now), 'Tomorrow');
  assert.equal(expiryLabel('2026-12-08', now), 'In 14 days');
  assert.equal(expiryLabel('2026-12-09', now), '9 Dec 2026');
});

// ── Transfers ────────────────────────────────────────────────────────────────

const transfer = {
  fromLocationId: 'soho',
  toLocationId: 'camden',
  status: 'pending' as const,
  lines: [
    { stockItemId: 'milk', quantity: '6.50' },
    { stockItemId: 'beans', quantity: '2' },
  ],
  fromLocation: { name: 'Soho' },
  toLocation: { name: 'Camden' },
};

test('a transfer moves stock out of one site and into the other', () => {
  assert.equal(direction(transfer, 'soho'), 'out');
  assert.equal(direction(transfer, 'camden'), 'in');
  assert.equal(otherSide(transfer, 'soho'), 'Camden');
  assert.equal(otherSide({ ...transfer, fromLocation: undefined }, 'camden'), 'another location');
  assert.deepEqual(itemLine(transfer, 'milk'), { quantity: 6.5, others: 1 });
  assert.deepEqual(itemLine(transfer, 'cups'), { quantity: null, others: 2 });
  assert.equal(signedChange(transfer, 'milk', 'soho'), -6.5);
  assert.equal(signedChange(transfer, 'milk', 'camden'), 6.5);
  assert.equal(signedChange(transfer, 'cups', 'soho'), null);
});

test('a transfer quantity has up to two decimals and no more than is held', () => {
  assert.equal(quantityError('', 5), 'Enter how much to send.');
  assert.equal(quantityError('1,5', 5), null);
  assert.equal(quantityError('1.555', 5), 'A number with up to two decimals.');
  assert.equal(quantityError('-1', 5), 'A number with up to two decimals.');
  assert.equal(quantityError('0', 5), 'More than 0.');
  assert.equal(quantityError('6', 5.555), 'Only 5.56 available.');
  assert.equal(quantityError('5', 5), null);
});

// ── Ledger and losses ────────────────────────────────────────────────────────

test('ledger movements read as sentences and filter by direction', () => {
  assert.deepEqual(movementTitle({ type: 'consume', quantity: '-1', sourceType: 'POS_ORDER', createdAt: '' }), {
    title: 'Used in an order',
    tone: 'out',
  });
  assert.equal(movementTitle({ type: 'waste', quantity: '-1', reason: 'SPILL', createdAt: '' }).title, 'Wasted · spilt');
  assert.equal(movementTitle({ type: 'adjust', quantity: '-2', createdAt: '' }).title, 'Adjusted down');
  assert.equal(movementTitle({ type: 'adjust', quantity: '2', sourceType: 'STOCKTAKE', createdAt: '' }).title, 'Stocktake correction');
  assert.equal(movementTitle({ type: 'transfer', quantity: '3', createdAt: '' }).title, 'Transferred in');
  assert.equal(movementTitle({ type: 'receive', quantity: '1', sourceType: 'CUSTOMER_RETURN', createdAt: '' }).title, 'Returned by a customer');
  assert.equal(inLedgerView('out', { type: 'consume', quantity: '-1', createdAt: '' }), true);
  assert.equal(inLedgerView('in', { type: 'consume', quantity: '-1', createdAt: '' }), false);
  assert.equal(inLedgerView('waste', { type: 'waste', quantity: '-1', createdAt: '' }), true);
});

test('net change across movements is exact to the thousandth', () => {
  const movements = [
    { type: 'receive', quantity: '0.1', createdAt: '' },
    { type: 'receive', quantity: '0.2', createdAt: '' },
    { type: 'consume', quantity: '-0.3', createdAt: '' },
    { type: 'receive', quantity: '1.005', createdAt: '' },
  ];
  assert.equal(netChange(movements), 1.005);
});

test('ledger day groups keep the order given and split on the local day', () => {
  const now = new Date('2026-11-24T12:00:00Z');
  const days = groupByDay(
    [
      { id: 'a', createdAt: '2026-11-24T09:00:00Z' },
      { id: 'b', createdAt: '2026-11-24T00:30:00Z' },
      // 23:30 UTC on 30 June is 1 July in London (BST).
      { id: 'c', createdAt: '2026-06-30T23:30:00Z' },
      { id: 'd', createdAt: '2026-07-01T08:00:00Z' },
    ],
    now,
  );
  assert.deepEqual(
    days.map((day) => day.items.map((item) => item.id)),
    [['a', 'b'], ['c', 'd']],
  );
});

test('losses read one reason vocabulary from all three shapes the data carries', () => {
  assert.deepEqual(readLoss({ quantity: 1, reason: 'EXPIRY', notes: ' binned ', createdAt: '' }), { kind: 'expired', note: 'binned' });
  assert.deepEqual(readLoss({ quantity: 1, reason: 'SPILL', createdAt: '' }), { kind: 'spilt', note: null });
  assert.deepEqual(readLoss({ quantity: 1, notes: 'Damage: dropped crate', createdAt: '' }), { kind: 'damaged', note: 'dropped crate' });
  assert.deepEqual(readLoss({ quantity: 1, notes: 'Note: something', createdAt: '' }), { kind: 'other', note: 'Note: something' });
  assert.deepEqual(readLoss({ quantity: 1, reason: 'MYSTERY', createdAt: '' }), { kind: 'other', note: null });
});

test('a loss is valued at the cost it was written off at, else the item’s, else unknown', () => {
  const losses = [
    { quantity: '-1.5', reason: 'EXPIRY', unitCost: '2.00', createdAt: '' },
    { quantity: 0.25, notes: 'Spill: knocked over', unitCost: null, createdAt: '' },
  ];
  assert.deepEqual(summariseLosses(losses, 4), { quantity: 1.75, count: 2, valuePence: 400, topKind: 'expired' });
  assert.equal(summariseLosses(losses, null).valuePence, null);
  assert.deepEqual(summariseLosses([], 4), { quantity: 0, count: 0, valuePence: 0, topKind: null });
});

test('loss periods start at local midnight, across a clock change', () => {
  const now = new Date('2026-11-24T10:00:00Z');
  assert.equal(periodFrom('all', now), undefined);
  // 25 October 2026 is the day the clocks go back: its midnight is still BST.
  assert.equal(periodFrom('30d', now), '2026-10-24T23:00:00.000Z');
  assert.equal(periodFrom('90d', now), '2026-08-25T23:00:00.000Z');
  assert.equal(periodFrom('12m', now), '2025-11-24T00:00:00.000Z');
});
