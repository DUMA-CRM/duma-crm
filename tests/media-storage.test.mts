import assert from 'node:assert/strict';
import test from 'node:test';

const {
  bytesToQuota,
  isConvertibleImage,
  parseBucketUrl,
  preferConverted,
  quotaToBytes,
  renameForType,
  sizeChange,
  storageMeter,
  targetSize,
} = await import('../lib/utils/media-storage.ts');

const MB = 1024 * 1024;
const kinds = (image: number, video = 0, audio = 0, document = 0) => ({ image, video, audio, document });

test('the meter splits used space by kind against the limit', () => {
  const meter = storageMeter(kinds(10 * MB, 0, 0, 5 * MB), 50 * MB);
  assert.equal(meter.usedBytes, 15 * MB);
  assert.equal(meter.freeBytes, 35 * MB);
  assert.equal(meter.percentUsed, 30);
  assert.equal(meter.state, 'ok');
  assert.deepEqual(
    meter.segments.map((s) => [s.kind, s.percent]),
    [
      ['image', 20],
      ['document', 10],
    ],
  );
});

test('nearly full at 90%, full at the limit, and an overrun never draws past the bar', () => {
  assert.equal(storageMeter(kinds(45 * MB), 50 * MB).state, 'nearly');
  assert.equal(storageMeter(kinds(50 * MB), 50 * MB).state, 'full');
  const over = storageMeter(kinds(60 * MB, 40 * MB), 50 * MB);
  assert.equal(over.freeBytes, 0);
  assert.equal(over.percentUsed, 100);
  assert.equal(
    over.segments.reduce((sum, s) => sum + s.percent, 0),
    100,
  );
});

test('without a limit the bar is the used total and there is no "free"', () => {
  const meter = storageMeter(kinds(3 * MB, 1 * MB), null);
  assert.equal(meter.freeBytes, null);
  assert.equal(meter.percentUsed, null);
  assert.deepEqual(
    meter.segments.map((s) => s.percent),
    [75, 25],
  );
  assert.deepEqual(storageMeter(kinds(0), null).segments, []);
});

test('quota input: blank is no limit, junk is refused, units round-trip', () => {
  assert.equal(quotaToBytes('', 'GB'), null);
  assert.equal(quotaToBytes('-1', 'GB'), undefined);
  assert.equal(quotaToBytes('abc', 'GB'), undefined);
  assert.equal(quotaToBytes('10', 'GB'), 10 * 1024 ** 3);
  assert.deepEqual(bytesToQuota(10 * 1024 ** 3), { value: '10', unit: 'GB' });
  assert.deepEqual(bytesToQuota(50 * MB), { value: '50', unit: 'MB' });
  assert.deepEqual(bytesToQuota(null), { value: '', unit: 'GB' });
});

test('a pasted R2 URL becomes an endpoint and a bucket', () => {
  assert.deepEqual(parseBucketUrl('https://3a59.r2.cloudflarestorage.com/duma'), {
    endpoint: 'https://3a59.r2.cloudflarestorage.com',
    bucket: 'duma',
    preset: 'r2',
  });
  assert.equal(parseBucketUrl('https://s3.eu-west-2.amazonaws.com/site')?.preset, 'aws');
  assert.equal(parseBucketUrl('not a url'), null);
  assert.equal(parseBucketUrl('ftp://x/y'), null);
});

test('images shrink to fit the width, never grow', () => {
  assert.deepEqual(targetSize(4000, 3000, 2000), { width: 2000, height: 1500 });
  assert.deepEqual(targetSize(800, 600, 2000), { width: 800, height: 600 });
  assert.deepEqual(targetSize(4000, 1, 100), { width: 100, height: 1 });
  assert.deepEqual(targetSize(4000, 3000, null), { width: 4000, height: 3000 });
});

test('renaming follows the new type; GIF and SVG are left alone', () => {
  assert.equal(renameForType('holiday.PNG', 'image/webp'), 'holiday.webp');
  assert.equal(renameForType('menu.final.jpeg', 'image/jpeg'), 'menu.final.jpg');
  assert.equal(renameForType('noext', 'image/avif'), 'noext.avif');
  assert.equal(isConvertibleImage('image/gif'), false);
  assert.equal(isConvertibleImage('image/svg+xml'), false);
  assert.equal(isConvertibleImage('image/png'), true);
});

test('a bigger re-encode is kept only when the format or size was asked to change', () => {
  const original = { size: 100, type: 'image/jpeg', width: 1000 };
  assert.equal(preferConverted(original, { size: 80, type: 'image/jpeg', width: 1000 }), true);
  assert.equal(preferConverted(original, { size: 120, type: 'image/jpeg', width: 1000 }), false);
  assert.equal(preferConverted(original, { size: 120, type: 'image/png', width: 1000 }), true);
  assert.equal(sizeChange(100, 36), '−64%');
  assert.equal(sizeChange(100, 112), '+12%');
  assert.equal(sizeChange(100, 100), 'same');
});

const { aspectRatioOf, centeredCrop, dragCrop, isFullCrop, MIN_CROP } = await import('../lib/utils/media-storage.ts');

test('a preset crop is the largest centred rectangle of that shape', () => {
  assert.deepEqual(centeredCrop(4000, 3000, 1), { x: 500, y: 0, width: 3000, height: 3000 });
  assert.deepEqual(centeredCrop(1000, 1000, 16 / 9), { x: 0, y: 219, width: 1000, height: 563 });
  assert.deepEqual(centeredCrop(800, 600, null), { x: 0, y: 0, width: 800, height: 600 });
  assert.equal(aspectRatioOf('original', 800, 600), 800 / 600);
  assert.equal(aspectRatioOf('free', 800, 600), null);
  assert.equal(isFullCrop({ x: 0, y: 0, width: 800, height: 600 }, 800, 600), true);
});

test('moving a crop keeps its size and stops at the edges', () => {
  const bounds = { width: 1000, height: 800 };
  const start = { x: 100, y: 100, width: 400, height: 300 };
  assert.deepEqual(dragCrop(start, 'move', 50, -20, bounds, null), { x: 150, y: 80, width: 400, height: 300 });
  assert.deepEqual(dragCrop(start, 'move', 5000, 5000, bounds, null), { x: 600, y: 500, width: 400, height: 300 });
  assert.deepEqual(dragCrop(start, 'move', -5000, 0, bounds, null), { x: 0, y: 100, width: 400, height: 300 });
});

test('a corner resizes from the opposite corner, within the image, above the minimum', () => {
  const bounds = { width: 1000, height: 800 };
  const start = { x: 100, y: 100, width: 400, height: 300 };
  assert.deepEqual(dragCrop(start, 'se', 100, 50, bounds, null), { x: 100, y: 100, width: 500, height: 350 });
  assert.deepEqual(dragCrop(start, 'nw', -500, -500, bounds, null), { x: 0, y: 0, width: 500, height: 400 });
  const tiny = dragCrop(start, 'se', -1000, -1000, bounds, null);
  assert.equal(tiny.width, MIN_CROP);
  assert.equal(tiny.height, MIN_CROP);
});

test('a locked ratio holds while resizing, even against an edge', () => {
  const bounds = { width: 1000, height: 800 };
  const square = dragCrop({ x: 100, y: 100, width: 300, height: 300 }, 'se', 200, 50, bounds, 1);
  assert.equal(square.width, square.height);
  const capped = dragCrop({ x: 600, y: 100, width: 300, height: 300 }, 'se', 900, 900, bounds, 1);
  assert.deepEqual(capped, { x: 600, y: 100, width: 400, height: 400 });
});

const { renditionWidths, focalFromClick, focalAfterCrop } = await import('../lib/utils/media-storage.ts');

test('responsive copies are only made where they save something', () => {
  assert.deepEqual(renditionWidths(4000), [480, 960, 1600]);
  assert.deepEqual(renditionWidths(1000), [480]);
  assert.deepEqual(renditionWidths(500), []);
  assert.deepEqual(renditionWidths(null), []);
});

test('a focal point comes from where the image was clicked, inside 0–1', () => {
  const rect = { left: 100, top: 50, width: 400, height: 200 };
  assert.deepEqual(focalFromClick(300, 150, rect), { x: 0.5, y: 0.5 });
  assert.deepEqual(focalFromClick(0, 400, rect), { x: 0, y: 1 });
});

test('a focal point follows the crop, and one cut away moves to the nearest kept edge', () => {
  const natural = { width: 1000, height: 500 };
  assert.deepEqual(focalAfterCrop({ x: 0.5, y: 0.5 }, null, natural), { x: 0.5, y: 0.5 });
  assert.deepEqual(focalAfterCrop({ x: 0.5, y: 0.5 }, { x: 250, y: 0, width: 500, height: 500 }, natural), { x: 0.5, y: 0.5 });
  assert.deepEqual(focalAfterCrop({ x: 0.3, y: 0.2 }, { x: 250, y: 0, width: 500, height: 500 }, natural), { x: 0.1, y: 0.2 });
  assert.deepEqual(focalAfterCrop({ x: 0.1, y: 0.9 }, { x: 250, y: 0, width: 500, height: 250 }, natural), { x: 0, y: 1 });
});
