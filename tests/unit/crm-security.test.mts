import assert from 'node:assert/strict';
import test from 'node:test';

import { allowedAssetUrl, readCappedBody, requestWorkspaceId } from '../../app/api/_lib/request-guards.ts';
import { ApprovalError, assertSealBinding, resolveSealedSubmission, sealAction } from '../../lib/ai/action-seal.ts';
import type { AgentPendingAction } from '../../lib/ai/agent-types';
import { safeHref, safeImageSrc } from '../../lib/utils/cms.ts';
import { isFortnightStart, isoWeekNumber, periodContaining } from '../../lib/utils/payroll-periods.ts';

process.env.AI_AGENT_APPROVAL_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';

const draft: AgentPendingAction = {
  kind: 'stock_adjustment',
  title: 'Adjust stock',
  summary: 'Milk −2',
  confirmLabel: 'Adjust',
  fields: [{ key: 'quantity', label: 'Quantity', type: 'number', value: 2, min: 0, max: 10 } as AgentPendingAction['fields'][number]],
};
const here = { uid: 'user-a', tid: '11111111-1111-4111-8111-111111111111', lid: 'loc-1' };

test('an approval confirms only for the user, workspace and location that drafted it', () => {
  const token = sealAction(draft, here).approvalToken!;
  assert.doesNotThrow(() => assertSealBinding(token, here));
  assert.equal(resolveSealedSubmission({ approvalToken: token, fields: { quantity: 3 } }, here).fields.quantity, 3);

  for (const other of [
    { ...here, uid: 'user-b' },
    { ...here, tid: '22222222-2222-4222-8222-222222222222' },
    { ...here, lid: 'loc-2' },
    { ...here, lid: null },
  ]) {
    assert.throws(() => assertSealBinding(token, other), ApprovalError);
    assert.throws(() => resolveSealedSubmission({ approvalToken: token, fields: {} }, other), ApprovalError);
  }
});

test('a seal drafted with no location still refuses one confirmed at a location', () => {
  const token = sealAction(draft, { ...here, lid: null }).approvalToken!;
  assert.doesNotThrow(() => assertSealBinding(token, { ...here, lid: null }));
  assert.throws(() => assertSealBinding(token, here), ApprovalError);
});

const local = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day);
};

test('fortnights around the 53-week year end do not overlap', () => {
  const yearEnd = periodContaining('fortnightly', local('2026-12-21'));
  assert.equal(yearEnd.from, '2026-12-21');
  assert.equal(yearEnd.to, '2027-01-03');
  assert.equal(periodContaining('fortnightly', local('2026-12-28')).from, '2026-12-21');
  assert.equal(periodContaining('fortnightly', local('2027-01-04')).from, '2027-01-04');
  assert.equal(periodContaining('fortnightly', local('2027-01-04')).to, '2027-01-17');
});

test('fortnights before the anchor use a true modulo', () => {
  assert.equal(isFortnightStart(local('2026-01-05')), true);
  assert.equal(isFortnightStart(local('2025-12-29')), false);
  assert.equal(isFortnightStart(local('2025-12-22')), true);
  assert.equal(periodContaining('fortnightly', local('2025-12-28')).from, '2025-12-22');
  // 2024-01-01 is 105 weeks before the anchor: odd, so its fortnight began a week earlier.
  assert.equal(isFortnightStart(local('2024-01-01')), false);
  assert.equal(periodContaining('fortnightly', local('2024-01-03')).from, '2023-12-25');
});

test('every 2026 fortnight is unchanged from the old even-ISO-week rule', () => {
  for (let day = 5; day < 365; day += 7) {
    const monday = new Date(2026, 0, day);
    assert.equal(isFortnightStart(monday), isoWeekNumber(monday) % 2 === 0, monday.toDateString());
  }
});

test('protocol-relative links and images are refused, same-origin paths kept', () => {
  for (const href of ['//evil.com', '/\\evil.com', ' //evil.com']) {
    assert.equal(safeHref(href), null);
    assert.equal(safeImageSrc(href), null);
  }
  assert.equal(safeHref('/blog/post'), '/blog/post');
  assert.equal(safeImageSrc('/images/a.png'), '/images/a.png');
  assert.equal(safeHref('javascript:alert(1)'), null);
});

const streamOf = (...chunks: number[]) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const size of chunks) controller.enqueue(new Uint8Array(size));
      controller.close();
    },
  });

test('an upload body is cut off at the cap even without a Content-Length', async () => {
  const noLength = new Headers();
  assert.deepEqual(await readCappedBody({ headers: noLength, body: streamOf(600, 600) }, 1000), { ok: false, reason: 'too-large' });
  const fits = await readCappedBody({ headers: noLength, body: streamOf(400, 600) }, 1000);
  assert.equal(fits.ok && fits.bytes.byteLength, 1000);
  assert.deepEqual(await readCappedBody({ headers: noLength, body: null }, 1000), { ok: false, reason: 'empty' });
  // A declared length over the cap is refused before anything is read.
  assert.deepEqual(await readCappedBody({ headers: new Headers({ 'content-length': '5000' }), body: streamOf(1) }, 1000), {
    ok: false,
    reason: 'too-large',
  });
  // A false (small) Content-Length does not let a large body through.
  assert.deepEqual(await readCappedBody({ headers: new Headers({ 'content-length': '10' }), body: streamOf(2000) }, 1000), {
    ok: false,
    reason: 'too-large',
  });
});

test('the server fetches assets only from the API or Vercel Blob', () => {
  const api = 'https://api.duma-business.com';
  assert.ok(allowedAssetUrl('https://api.duma-business.com/v1/cms/delivery/assets/x/renditions/y', api));
  assert.equal(allowedAssetUrl('/v1/cms/delivery/assets/x/file/a.jpg', api)?.origin, api);
  assert.ok(allowedAssetUrl('https://abc123.public.blob.vercel-storage.com/a.webp', api));
  for (const url of [
    'http://169.254.169.254/latest/meta-data',
    'http://localhost:7777/v1/cms/delivery/assets/x',
    'https://public.blob.vercel-storage.com.evil.io/a',
    'http://abc.public.blob.vercel-storage.com/a',
    'https://user:pw@api.duma-business.com/v1/x',
    'file:///etc/passwd',
    'not a url',
  ]) {
    assert.equal(allowedAssetUrl(url, api), null, url);
  }
});

test('an /api request names its workspace by header, then body, then home — UUIDs only', () => {
  const a = '11111111-1111-4111-8111-111111111111';
  const b = '22222222-2222-4222-8222-222222222222';
  assert.equal(requestWorkspaceId(new Headers({ 'X-Duma-Workspace': a }), b), a);
  assert.equal(requestWorkspaceId(new Headers({ 'X-Duma-Workspace': 'nope' }), 'also-nope', b), b);
  assert.equal(requestWorkspaceId(new Headers(), null, undefined), null);
});
