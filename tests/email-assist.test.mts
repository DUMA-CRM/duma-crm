import assert from 'node:assert/strict';
import test from 'node:test';

const { cleanPlainText, emailHtmlForModel, mergeTokens, missingMergeTokens, plainTextMessages } = await import('../lib/ai/email-assist.ts');

test('the model gets the words, not the styles, scripts or comments', () => {
  const html =
    '<html><head><title>x</title><style>p{color:red}</style></head><body><!-- tracking --><p>Hello   {{customer.firstName}}</p><script>alert(1)</script></body></html>';
  const cleaned = emailHtmlForModel(html);
  assert.ok(!cleaned.includes('color:red'));
  assert.ok(!cleaned.includes('tracking'));
  assert.ok(!cleaned.includes('alert'));
  assert.ok(cleaned.includes('<p>Hello {{customer.firstName}}</p>'));
  const [system, user] = plainTextMessages(html);
  assert.equal(system!.role, 'system');
  assert.ok(user!.content.includes('Hello {{customer.firstName}}'));
});

test('merge fields are found once each, whitespace inside the braces ignored', () => {
  assert.deepEqual(mergeTokens('Hi {{ customer.firstName }}, {{order.number}} — {{customer.firstName}}'), [
    '{{customer.firstName}}',
    '{{order.number}}',
  ]);
});

test('a merge field the plain text dropped is reported', () => {
  const html = '<p>Hi {{customer.firstName}}</p><p>Order {{order.number}} is ready.</p>';
  assert.deepEqual(missingMergeTokens(html, 'Hi {{customer.firstName}}\n\nYour order is ready.'), ['{{order.number}}']);
  assert.deepEqual(missingMergeTokens(html, 'Hi {{customer.firstName}}\n\nOrder {{order.number}} is ready.'), []);
});

test('replies lose fences, labels, trailing spaces and extra blank lines', () => {
  assert.equal(cleanPlainText('```text\nPlain text: Hello  \n\n\n\nOrder now (https://x.co)\n```'), 'Hello\n\nOrder now (https://x.co)');
});

test('preview text asks with the subject, and comes back as one line inside the limit', async () => {
  const { cleanPreheader, preheaderMessages, PREHEADER_MAX } = await import('../lib/ai/email-assist.ts');
  const [, user] = preheaderMessages({ html: '<p>Two-for-one flat whites</p>', subject: 'This week only' });
  assert.ok(user!.content.includes('Subject: This week only'));
  assert.ok(user!.content.includes('Two-for-one flat whites'));
  // Written in the email's own language, never translated to English.
  const [system] = preheaderMessages({ html: '<p>Deux cafés pour le prix d’un</p>' });
  assert.match(system!.content, /same language the email is written in/);
  assert.match(user!.content, /in the email's own language/);

  assert.equal(
    cleanPreheader('Preview text: "Bring a friend — the second coffee is on us."'),
    'Bring a friend — the second coffee is on us.',
  );
  const long = cleanPreheader(`${'Fresh pastries every morning and '.repeat(5)}more`);
  assert.ok(long.length <= PREHEADER_MAX, `${long.length} characters`);
  assert.ok(long.endsWith('…'));
  assert.ok(!/\s…$/.test(long));
});
