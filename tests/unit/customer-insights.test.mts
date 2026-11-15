import assert from 'node:assert/strict';
import test from 'node:test';

import { favouriteItems } from '../../lib/utils/customer-insights.ts';

test('favourites rank by units, then by how many orders had them, and skip cancelled orders', () => {
  const favourites = favouriteItems([
    {
      status: 'done',
      items: [
        { name: 'Flat white', quantity: 2 },
        { name: 'Croissant', quantity: 1 },
      ],
    },
    {
      status: 'done',
      items: [
        { name: 'Flat white', quantity: 1 },
        { name: 'Flat white', quantity: 1 },
      ],
    },
    { status: 'done', items: [{ name: 'Croissant', quantity: 1 }] },
    { status: 'done', items: [{ name: 'Brownie', quantity: 2 }] },
    { status: 'cancelled', items: [{ name: 'Brownie', quantity: 10 }] },
  ]);
  assert.deepEqual(favourites, [
    { name: 'Flat white', quantity: 4, orders: 2 },
    { name: 'Croissant', quantity: 2, orders: 2 },
    { name: 'Brownie', quantity: 2, orders: 1 },
  ]);
});
