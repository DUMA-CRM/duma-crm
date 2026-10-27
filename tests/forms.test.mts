import assert from 'node:assert/strict';
import test from 'node:test';

const {
  FORM_TEMPLATES,
  apiSnippets,
  answerText,
  checkAnswer,
  definitionProblems,
  duplicateField,
  embedSnippet,
  formPages,
  formStanding,
  keyFromLabel,
  logicSummary,
  newField,
  pageProblems,
  prefillAnswers,
  prefillUrl,
  removeField,
  responseMetadata,
  responseTitle,
  submissionAnswers,
  visibleFieldIds,
} = await import('../lib/utils/forms.ts');

type Field = Parameters<typeof checkAnswer>[0];
type Definition = Parameters<typeof definitionProblems>[0];

const field = (overrides: Partial<Field> & Pick<Field, 'id' | 'type'>): Field => ({ key: overrides.id, label: overrides.id, ...overrides });

// The same form duma-api's form-rules.test.ts checks, so the two copies agree.
const enquiry: Definition = {
  fields: [
    field({ id: 'name', type: 'short_text', required: true }),
    field({ id: 'email', type: 'email', required: true }),
    field({
      id: 'occasion',
      type: 'radio',
      options: [
        { id: 'o1', label: 'Birthday' },
        { id: 'o2', label: 'Corporate' },
      ],
    }),
    field({ id: 'p2', type: 'page_break' }),
    field({
      id: 'company',
      type: 'short_text',
      required: true,
      logic: { match: 'all', conditions: [{ fieldId: 'occasion', operator: 'equals', value: 'Corporate' }] },
    }),
    field({ id: 'invoice', type: 'yes_no', logic: { match: 'all', conditions: [{ fieldId: 'company', operator: 'is_answered' }] } }),
    field({ id: 'guests', type: 'number', min: 1, max: 40 }),
    field({ id: 'source', type: 'hidden', defaultValue: 'website' }),
  ],
  customerLink: { enabled: true, emailFieldId: 'email', nameFieldId: 'name' },
};

let seed = 0;
const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;

test('the rules match the API’s: a sound definition, and its problems', () => {
  assert.deepEqual(definitionProblems(enquiry), []);
  const problems = definitionProblems({
    fields: [
      field({ id: 'a', key: 'same', type: 'short_text', logic: { match: 'all', conditions: [{ fieldId: 'b', operator: 'is_answered' }] } }),
      field({ id: 'b', key: 'same', type: 'select', options: [] }),
      field({ id: 'c', key: 'Bad Key', type: 'short_text' }),
    ],
  }).map((problem) => problem.message);
  assert.ok(problems.some((message) => message.includes('isn’t above it')));
  assert.ok(problems.some((message) => message.includes('Two fields use the API key')));
  assert.ok(problems.some((message) => message.includes('at least one option')));
  assert.deepEqual(
    definitionProblems({ ...enquiry, customerLink: { enabled: true, emailFieldId: 'name' } }).map((problem) => problem.field),
    ['customerLink.emailFieldId'],
  );
});

test('pages split at breaks; logic chains collapse', () => {
  assert.deepEqual(
    formPages(enquiry.fields).map((page) => page.length),
    [3, 4],
  );
  assert.ok(visibleFieldIds(enquiry.fields, { occasion: 'Corporate', company: 'Acme' }).has('invoice'));
  const birthday = visibleFieldIds(enquiry.fields, { occasion: 'Birthday', company: 'Acme' });
  assert.ok(!birthday.has('company') && !birthday.has('invoice'));
});

test('a page checks only what the respondent can see', () => {
  const [, second] = formPages(enquiry.fields);
  assert.deepEqual(pageProblems(second!, enquiry.fields, { occasion: 'Birthday' }), {});
  assert.deepEqual(pageProblems(second!, enquiry.fields, { occasion: 'Corporate', guests: 50 }), {
    company: 'company is required',
    guests: 'guests is at most 40',
  });
});

test('each type checks and normalises its answer, as the API does', () => {
  assert.equal(checkAnswer(field({ id: 'e', type: 'email' }), 'nope').problem, 'That email doesn’t look right');
  assert.deepEqual(checkAnswer(field({ id: 'e', type: 'email' }), ' A@B.co '), { value: 'a@b.co' });
  assert.deepEqual(checkAnswer(field({ id: 'r', type: 'rating' }), '4'), { value: 4 });
  assert.deepEqual(checkAnswer(field({ id: 's', type: 'scale' }), 0), { value: 0 });
  assert.equal(checkAnswer(field({ id: 'c', type: 'consent', required: true }), false).problem, 'Please tick “c” to continue');
  assert.ok(checkAnswer(field({ id: 'u', type: 'url' }), 'javascript:alert(1)').problem);
  const boxes = field({
    id: 'b',
    type: 'checkboxes',
    max: 2,
    options: ['Vegan', 'Nut-free', 'Halal'].map((label, i) => ({ id: `o${i}`, label })),
  });
  assert.deepEqual(checkAnswer(boxes, ['vegan', 'o1', 'Vegan']), { value: ['Vegan', 'Nut-free'] });
});

test('what’s sent: visible answers only, keyed by API key', () => {
  assert.deepEqual(
    submissionAnswers(enquiry.fields, { name: 'Sam', email: 'sam@example.com', occasion: 'Birthday', company: 'Acme', source: 'website' }),
    {
      name: 'Sam',
      email: 'sam@example.com',
      occasion: 'Birthday',
      source: 'website',
    },
  );
});

test('a link fills answers by key; hidden fields fall back to their default; bad values are ignored', () => {
  const params = new URLSearchParams('email=SAM@example.com&guests=abc&occasion=corporate');
  assert.deepEqual(prefillAnswers(enquiry.fields, params), { email: 'sam@example.com', occasion: 'Corporate', source: 'website' });
  assert.equal(prefillUrl('https://x.test/f/abc', { email: 'a@b.co', table: ' ' }), 'https://x.test/f/abc?email=a%40b.co');
  assert.deepEqual(responseMetadata(new URLSearchParams('utm_source=insta&other=1'), 'https://site.test/'), {
    utm_source: 'insta',
    referrer: 'https://site.test/',
  });
});

test('keys come from labels and stay unique', () => {
  assert.equal(keyFromLabel('Your e-mail address?', new Set()), 'your_e_mail_address');
  assert.equal(keyFromLabel('Café name', new Set(['cafe_name'])), 'cafe_name_2');
  assert.equal(keyFromLabel('2nd choice', new Set()), 'q_2nd_choice');
  assert.equal(keyFromLabel('!!!', new Set()), 'question');
});

test('new, duplicated and removed fields keep the definition sound', () => {
  seed = 1;
  const email = newField('email', enquiry.fields, random);
  assert.equal(email.key, 'email_2', 'the key is unique among the form’s');
  assert.equal(newField('radio', [], random).options?.length, 2);
  assert.equal(newField('page_break', [], random).key, '');

  const { fields, copyId } = duplicateField(enquiry.fields, 'occasion', random);
  const copy = fields.find((entry) => entry.id === copyId)!;
  assert.equal(fields.indexOf(copy), 3, 'placed after the original');
  assert.equal(copy.key, 'occasion_2');
  assert.notEqual(copy.options![0]!.id, 'o1');

  const without = removeField(enquiry, 'occasion');
  assert.equal(without.fields.find((entry) => entry.id === 'company')!.logic, null, 'conditions on it go too');
  const unlinked = removeField(enquiry, 'email');
  assert.equal(unlinked.customerLink?.emailFieldId, null);
});

test('logic reads as a sentence', () => {
  assert.equal(logicSummary(enquiry.fields[4]!, enquiry.fields), 'Shown when occasion is Corporate');
  assert.equal(logicSummary(enquiry.fields[0]!, enquiry.fields), null);
});

test('where a form stands', () => {
  const now = Date.parse('2026-10-25T12:00:00Z');
  const live = { status: 'published' as const, closesAt: null, responseLimit: null, responseCount: 2 };
  assert.equal(formStanding(live, now), 'live');
  assert.equal(formStanding({ ...live, responseLimit: 2 }, now), 'full');
  assert.equal(formStanding({ ...live, closesAt: '2026-10-25T11:00:00Z' }, now), 'ended');
  assert.equal(formStanding({ ...live, closesAt: '2026-10-26T11:00:00Z' }, now), 'scheduled_close');
  assert.equal(formStanding({ ...live, status: 'draft' }, now), 'draft');
});

test('answers read as words; a response is titled by its name', () => {
  assert.equal(answerText(['A', 'B']), 'A, B');
  assert.equal(answerText(true), 'Yes');
  assert.equal(answerText(''), '—');
  assert.equal(responseTitle(enquiry.fields, { email: 'sam@example.com', name: 'Sam' }), 'Sam');
});

test('every template is publishable as it stands', () => {
  for (const template of FORM_TEMPLATES) {
    if (template.id === 'blank') continue;
    assert.deepEqual(definitionProblems(template.definition()), [], template.name);
  }
});

test('share snippets: an iframe that resizes, and a curl with an example for each question', () => {
  const embed = embedSnippet('https://app.test/f/abc123', 'abc123', 'Say "hi"');
  assert.match(embed, /src="https:\/\/app\.test\/f\/abc123\?embed=1"/);
  assert.match(embed, /title="Say &quot;hi&quot;"/);
  const { read, submit, body } = apiSnippets('https://api.test/', 'abc123', enquiry.fields);
  assert.equal(read, 'curl https://api.test/v1/forms/public/abc123');
  assert.match(submit, /POST https:\/\/api\.test\/v1\/forms\/public\/abc123\/responses/);
  assert.deepEqual(Object.keys(body.answers as object), ['name', 'email', 'occasion', 'company', 'invoice', 'guests', 'source']);
});
