import assert from 'node:assert/strict';
import test from 'node:test';

import { GLOSSARY, glossaryByLetter, glossaryLinks, glossaryTerm } from '../../lib/marketing/glossary.ts';
import { publishedPage } from '../../lib/marketing/site.ts';

// A broken internal link is a 404 the sitemap never lists and search engines still follow.
test('every glossary slug is unique and every link between terms resolves', () => {
  const slugs = GLOSSARY.map((term) => term.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  for (const term of GLOSSARY) {
    for (const slug of [...term.related, ...glossaryLinks(term.body)]) {
      assert.ok(glossaryTerm(slug), `${term.slug} links to missing term ${slug}`);
    }
    assert.ok(!term.related.includes(term.slug), `${term.slug} lists itself as related`);
  }
});

test('the A–Z index lists every term once, in order', () => {
  const groups = glossaryByLetter();
  const listed = groups.flatMap((group) => group.terms.map((term) => term.slug));
  assert.equal(listed.length, GLOSSARY.length);
  assert.deepEqual(groups.map((group) => group.letter), [...groups.map((group) => group.letter)].sort());
  assert.ok(groups.every((group) => group.terms.every((term) => term.term[0]!.toUpperCase() === group.letter)));
});

// "See it in DUMA" is a link from every term; one pointing at an unpublished page would only drop out silently.
test('every glossary term links to a published audience page', () => {
  for (const term of GLOSSARY) {
    assert.ok(publishedPage(term.seeIt.path), `${term.slug} links to unpublished ${term.seeIt.path}`);
  }
});
