import assert from 'node:assert/strict';
import test from 'node:test';

const { plainText, truncate, seoSnapshot, hasSeoBlock, SEO_FIELD } = await import('../lib/utils/cms-seo.ts');

test('markdown becomes the plain text a result shows', () => {
  assert.equal(
    plainText('## Our **autumn** menu\n\n- [x] [Pumpkin](/p) latte\n> [!TIP]\n> ![cup](/c.png) Hot `now`'),
    'Our autumn menu Pumpkin latte Hot now',
  );
});

test('long text is cut at a word with an ellipsis', () => {
  assert.equal(truncate('one two three four', 12), 'one two…');
  assert.equal(truncate('short', 12), 'short');
});

test('empty SEO fields fall back to the title and the opening of the text', () => {
  const fields = [{ key: 'title', label: 'Title', type: 'text' }, { key: 'body', label: 'Body', type: 'richText' }, SEO_FIELD];
  const snapshot = seoSnapshot(fields as never, 'title', {
    title: 'Autumn menu',
    body: 'Pumpkin lattes are **back** for the season, with oat milk at no extra cost.',
  });
  assert.equal(snapshot.title, 'Autumn menu');
  assert.equal(snapshot.titleFromFallback, true);
  assert.match(snapshot.description, /^Pumpkin lattes are back/);
  assert.ok(snapshot.warnings.some((warning) => warning.startsWith('No image')));
  assert.equal(hasSeoBlock(fields as never), true);
});

test('own SEO values win, and lengths are checked', () => {
  const snapshot = seoSnapshot([SEO_FIELD] as never, null, {
    seo: { metaTitle: 'x'.repeat(70), metaDescription: 'Too short.', ogImage: 'asset-1', noIndex: true },
  });
  assert.equal(snapshot.imageId, 'asset-1');
  assert.equal(snapshot.noIndex, true);
  assert.ok(snapshot.warnings.some((warning) => warning.includes('70 characters')));
  assert.ok(snapshot.warnings.some((warning) => warning.includes('short')));
});

const { seoChecklist, fitTitle, fitDescription } = await import('../lib/utils/cms-seo.ts');

const snap = (over: Record<string, unknown>) =>
  ({
    title: '',
    titleFromFallback: false,
    description: '',
    descriptionFromFallback: false,
    imageId: null,
    canonicalUrl: null,
    noIndex: false,
    warnings: [],
    ...over,
  }) as never;

test('the checklist passes a page that follows the guidance', () => {
  const checks = seoChecklist(
    snap({
      title: 'Autumn menu: pumpkin lattes and oat milk at no extra cost',
      description:
        'Our autumn menu is here: pumpkin lattes, cinnamon buns and oat milk at no extra cost, every day until the end of November in all our shops.',
      imageId: 'a1',
      canonicalUrl: 'https://cafe.example/menu/autumn',
    }),
    { keyword: 'autumn menu', imageAlt: 'A pumpkin latte' },
  );
  assert.deepEqual(
    checks.filter((check) => !check.ok).map((check) => check.id),
    [],
  );
});

test('the checklist names what is wrong and how to fix it', () => {
  const checks = seoChecklist(snap({ title: 'Menu', description: 'Lattes and', imageId: 'a1', canonicalUrl: '/menu', noIndex: true }), {
    keyword: 'autumn',
    imageAlt: '',
  });
  const failing = Object.fromEntries(checks.filter((check) => !check.ok).map((check) => [check.id, check.fix]));
  assert.deepEqual(Object.keys(failing).sort(), [
    'canonical',
    'description-keyword',
    'description-length',
    'description-sentence',
    'image-alt',
    'indexable',
    'title-keyword',
    'title-length',
  ]);
  assert.match(failing['title-length']!, /descriptive/);
});

test('titles and descriptions are fitted without cutting words or sentences', () => {
  assert.equal(fitTitle('Autumn menu at the café — pumpkin lattes, cinnamon buns and more', 40), 'Autumn menu at the café — pumpkin');
  const long =
    'Pumpkin lattes are back for autumn. Oat milk costs nothing extra this season. Cinnamon buns are baked every morning in each of our shops across the city.';
  assert.equal(fitDescription(long, 100), 'Pumpkin lattes are back for autumn. Oat milk costs nothing extra this season.');
  assert.match(fitDescription('word '.repeat(60), 50), /\.$/);
});

const { missingSeoFields, withFullSeoBlock, SEO_FIELD: FULL } = await import('../lib/utils/cms-seo.ts');

test('an older SEO block is brought up to date without losing what it had', () => {
  const old = [
    { key: 'title', label: 'Title', type: 'text' },
    {
      key: 'seo',
      label: 'SEO',
      type: 'group',
      fields: [
        { key: 'metaTitle', label: 'My title label', type: 'text', maxLength: 65 },
        { key: 'campaign', label: 'Campaign', type: 'text' },
      ],
    },
  ];
  assert.ok(missingSeoFields(old as never).some((field) => field.key === 'focusKeyword'));
  const updated = withFullSeoBlock(old as never);
  const seo = updated.find((field) => field.key === 'seo')!;
  assert.equal(seo.fields!.length, FULL.fields!.length + 1);
  assert.equal(seo.fields!.find((field) => field.key === 'metaTitle')!.label, 'My title label');
  assert.equal(seo.fields!.at(-1)!.key, 'campaign');
  assert.deepEqual(missingSeoFields(updated), []);
});

test('a stored focus keyword drives the keyword checks; content type is asked for', () => {
  const snapshot = seoSnapshot([FULL] as never, null, {
    seo: { focusKeyword: 'autumn menu', metaTitle: 'Our autumn menu: pumpkin lattes and cinnamon buns', metaDescription: 'Lattes.' },
  });
  const checks = seoChecklist(snapshot);
  assert.equal(checks[0]!.id, 'focus-keyword');
  assert.equal(checks.find((check) => check.id === 'title-keyword')!.ok, true);
  assert.equal(checks.find((check) => check.id === 'structured-data')!.ok, false);
});
