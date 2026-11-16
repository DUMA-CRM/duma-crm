import assert from 'node:assert/strict';
import test from 'node:test';

import { changeFieldType, definitionFromQuestions, guessFieldType, questionsFromText } from '../../lib/utils/form-questions.ts';
import { FORM_TEMPLATES, definitionProblems, newField } from '../../lib/utils/forms.ts';

/** A fixed sequence of "random" numbers, so ids are the same on every run. */
const seeded = () => {
  let seed = 7;
  return () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
};

test('the wording of a question suggests its type', () => {
  const cases: [string, string][] = [
    ['Your email address', 'email'],
    ['E-mail', 'email'],
    ['Phone number', 'phone'],
    ['Mobile', 'phone'],
    ['Tel', 'phone'],
    ['Date of the event', 'date'],
    ['When would you like to visit?', 'date'],
    ['Which day?', 'date'],
    ['Arrival time', 'time'],
    ['How many guests?', 'number'],
    ['Party size', 'number'],
    ['Quantity', 'number'],
    ['Age', 'number'],
    ['How would you rate the food?', 'rating'],
    ['How was your visit?', 'rating'],
    ['Stars', 'rating'],
    ['Do you have any allergies?', 'yes_no'],
    ['Are you over 18?', 'yes_no'],
    ['Would you like a high chair?', 'yes_no'],
    ['Have you visited before?', 'yes_no'],
    ['Message', 'long_text'],
    ['Any comments?', 'long_text'],
    ['Tell us about yourself', 'long_text'],
    ['Describe the problem', 'long_text'],
    ['Anything else we should know?', 'long_text'],
    ['Your name', 'short_text'],
    ['Company', 'short_text'],
    ['', 'short_text'],
  ];
  for (const [label, type] of cases) assert.equal(guessFieldType(label), type, label);
});

test('a phone number is a phone, not a number; a message is not an age', () => {
  assert.equal(guessFieldType('Phone number'), 'phone');
  assert.equal(guessFieldType('Your message'), 'long_text');
  assert.equal(guessFieldType('Page title'), 'short_text');
});

test('each line becomes a question; numbering, bullets and blank lines go', () => {
  const questions = questionsFromText('1. Your name\n\n2) Email\n- Phone\n• How many guests?\nQ5: Any comments?\n   \n');
  assert.deepEqual(
    questions.map((question) => [question.label, question.type]),
    [
      ['Your name', 'short_text'],
      ['Email', 'email'],
      ['Phone', 'phone'],
      ['How many guests?', 'number'],
      ['Any comments?', 'long_text'],
    ],
  );
});

test('a trailing * or "(required)" makes a question required, and is taken off the words', () => {
  const [name, email, notes, size] = questionsFromText('Name *\nEmail (required)\nNotes (optional)\nSize: S, M, L *');
  assert.deepEqual(name, { label: 'Name', type: 'short_text', required: true });
  assert.deepEqual(email, { label: 'Email', type: 'email', required: true });
  assert.deepEqual(notes, { label: 'Notes', type: 'long_text', required: false });
  assert.equal(size!.required, true);
  assert.deepEqual(size!.options, ['S', 'M', 'L']);
});

test('"Label: a, b, c" is a choice with those options', () => {
  const [size] = questionsFromText('Size: Small, Medium, Large');
  assert.deepEqual(size, { label: 'Size', type: 'radio', required: false, options: ['Small', 'Medium', 'Large'] });
});

test('a colon without a list stays part of the question', () => {
  const [question] = questionsFromText('Note: we close at 10pm');
  assert.equal(question!.label, 'Note: we close at 10pm');
  assert.equal(question!.options, undefined);
});

test('indented lines under a question are its options, with or without bullets', () => {
  const questions = questionsFromText('Which role?\n  - Barista\n  - Kitchen\n    Front of house\nYour name');
  assert.equal(questions.length, 2);
  assert.deepEqual(questions[0], {
    label: 'Which role?',
    type: 'radio',
    required: false,
    options: ['Barista', 'Kitchen', 'Front of house'],
  });
  assert.equal(questions[1]!.label, 'Your name');
});

test('"Label:" on its own takes the bullet lines under it as options', () => {
  const [milk, name] = questionsFromText('Milk:\n- Whole\n- Oat\n- Soy\nName');
  assert.deepEqual(milk, { label: 'Milk', type: 'radio', required: false, options: ['Whole', 'Oat', 'Soy'] });
  assert.equal(name!.label, 'Name');
});

test('a bullet list with no question above it is a list of questions', () => {
  assert.deepEqual(
    questionsFromText('- Name\n- Email').map((question) => question.label),
    ['Name', 'Email'],
  );
});

test('text indented as a whole is read from its own margin', () => {
  assert.deepEqual(
    questionsFromText('    Name\n    Email\n      - work\n      - home').map((question) => [question.label, question.options]),
    [
      ['Name', undefined],
      ['Email', ['work', 'home']],
    ],
  );
});

test('yes and no as the options make a yes/no question', () => {
  const [question] = questionsFromText('Need a high chair: Yes, No');
  assert.deepEqual(question, { label: 'Need a high chair', type: 'yes_no', required: false });
});

test('"tick all that apply" makes a multiple choice; a long list a dropdown; repeats are dropped', () => {
  const [dietary, table] = questionsFromText('Dietary needs (tick all that apply): Vegan, Vegetarian, vegan\nTable: 1, 2, 3, 4, 5, 6, 7');
  assert.equal(dietary!.type, 'checkboxes');
  assert.deepEqual(dietary!.options, ['Vegan', 'Vegetarian']);
  assert.equal(table!.type, 'select');
});

test('a list in brackets at the end is the options', () => {
  const [question] = questionsFromText('Which milk? (Whole, Oat, Soy)');
  assert.deepEqual(question, { label: 'Which milk?', type: 'radio', required: false, options: ['Whole', 'Oat', 'Soy'] });
});

test('nothing but blank lines and bullets makes no questions', () => {
  assert.deepEqual(questionsFromText(''), []);
  assert.deepEqual(questionsFromText('\n  \n-\n*\n'), []);
});

test('pasted questions make a draft with no problems: keys from the words, unique', () => {
  const definition = definitionFromQuestions(
    questionsFromText('Name *\nEmail *\nName\nHow many guests?\nSize: Small, Medium, Large'),
    seeded(),
  );
  assert.deepEqual(
    definition.fields.map((field) => [field.key, field.type, Boolean(field.required)]),
    [
      ['name', 'short_text', true],
      ['email', 'email', true],
      ['name_2', 'short_text', false],
      ['how_many_guests', 'number', false],
      ['size', 'radio', false],
    ],
  );
  assert.deepEqual(definitionProblems(definition), []);
});

test('changing a question’s type keeps its id, key, words, required and logic', () => {
  const random = seeded();
  const field = { ...newField('short_text', [], random), label: 'Size', key: 'size', required: true, placeholder: 'e.g. M', max: 20 };
  const radio = changeFieldType(field, 'radio', random);
  assert.equal(radio.id, field.id);
  assert.equal(radio.key, 'size');
  assert.equal(radio.label, 'Size');
  assert.equal(radio.required, true);
  assert.equal(radio.placeholder, undefined);
  assert.equal(radio.max, undefined);
  assert.equal(radio.options?.length, 2);

  // Options carry between kinds of choice.
  const ticks = changeFieldType({ ...radio, options: [{ id: 'o_1', label: 'S' }] }, 'checkboxes', random);
  assert.deepEqual(ticks.options, [{ id: 'o_1', label: 'S' }]);

  // A rating gets its stars; a heading has no key and nothing to require.
  assert.equal(changeFieldType(field, 'rating', random).max, 5);
  const heading = changeFieldType(field, 'heading', random);
  assert.equal(heading.key, '');
  assert.equal(heading.required, undefined);
});

test('every template is ready to publish', () => {
  for (const template of FORM_TEMPLATES) {
    if (template.id === 'blank') continue;
    assert.deepEqual(definitionProblems(template.definition()), [], template.name);
  }
});
