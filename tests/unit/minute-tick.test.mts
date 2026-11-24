import assert from 'node:assert/strict';
import test from 'node:test';

import { msUntilNextMinute } from '../../lib/utils/minute-tick.ts';

test('a minute clock waits exactly until the next minute starts', () => {
  const minute = Date.UTC(2026, 10, 24, 9, 30);
  assert.equal(msUntilNextMinute(minute), 60_000);
  assert.equal(msUntilNextMinute(minute + 1), 59_999);
  assert.equal(msUntilNextMinute(minute + 59_999), 1);
  assert.equal(msUntilNextMinute(minute + 45_250), 14_750);
});
