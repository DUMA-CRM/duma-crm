import assert from 'node:assert/strict';
import test from 'node:test';

const { assistMessages, cleanAssistText, parseTranslation } = await import('../lib/ai/cms-assist.ts');

test('alt text sends the image beside the instruction', () => {
  const [, user] = assistMessages('alt-text', { imageDataUrl: 'data:image/webp;base64,AAA', title: 'Autumn menu' });
  assert.ok(Array.isArray(user!.content));
  const parts = user!.content as Array<{ type: string }>;
  assert.deepEqual(
    parts.map((part) => part.type),
    ['text', 'image_url'],
  );
});

test('model replies are cleaned of labels, quotes, fences and "Image of"', () => {
  assert.equal(
    cleanAssistText('alt-text', '"Image of a latte with leaf art on a wooden table"'),
    'A latte with leaf art on a wooden table',
  );
  assert.equal(cleanAssistText('meta-description', 'Description: Our autumn menu\n is back.'), 'Our autumn menu is back.');
  assert.equal(cleanAssistText('summary', '```\nTwo lines.\nKept.\n```'), 'Two lines.\nKept.');
});

test('a translation keeps only the keys asked for', () => {
  assert.deepEqual(parseTranslation('Sure! {"title":"Menú de otoño","body":"Hola","extra":"x"}', ['title', 'body']), {
    title: 'Menú de otoño',
    body: 'Hola',
  });
  assert.equal(parseTranslation('no json here', ['title']), null);
  assert.equal(parseTranslation('{"title": 3}', ['title']), null);
});

test('the SEO reply is read from JSON, cleaned, and refused when incomplete', async () => {
  const { parseSeoSuggestion } = await import('../lib/ai/cms-assist.ts');
  const reply =
    'Here you go: {"focusKeyword":"Autumn Menu","relatedKeywords":["Pumpkin Latte","seasonal drinks"],"metaTitle":" \\"Autumn menu at Duma\\" ","metaDescription":"Pumpkin lattes are back.","socialTitle":"It’s back","socialDescription":"Come try it.","schemaType":"Recipe"}';
  assert.deepEqual(parseSeoSuggestion(reply, ['Article', 'Menu']), {
    focusKeyword: 'autumn menu',
    relatedKeywords: ['pumpkin latte', 'seasonal drinks'],
    metaTitle: 'Autumn menu at Duma',
    metaDescription: 'Pumpkin lattes are back.',
    socialTitle: 'It’s back',
    socialDescription: 'Come try it.',
    schemaType: '',
  });
  assert.equal(parseSeoSuggestion('{"metaTitle":"Only a title"}'), null);
  assert.equal(parseSeoSuggestion('no json'), null);
});
