import { SUPPORT_ARTICLES, type SupportArticle } from '../content/support-articles.ts';

const STOP_WORDS = new Set([
  'a',
  'about',
  'and',
  'app',
  'can',
  'do',
  'does',
  'for',
  'from',
  'how',
  'i',
  'in',
  'is',
  'it',
  'me',
  'my',
  'of',
  'on',
  'the',
  'this',
  'to',
  'what',
  'when',
  'where',
  'why',
  'with',
  'work',
  'works',
  'you',
]);

function words(value: string) {
  return value
    .toLocaleLowerCase('en-GB')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

function excerpt(article: SupportArticle, terms: string[]) {
  const plain = article.body
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`|[\]()!-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const firstMatch =
    terms
      .map((term) => plain.toLocaleLowerCase('en-GB').indexOf(term))
      .filter((index) => index >= 0)
      .sort((a, b) => a - b)[0] ?? 0;
  const start = Math.max(0, firstMatch - 180);
  const clipped = plain.slice(start, start + 900).trim();
  return `${start > 0 ? '…' : ''}${clipped}${start + clipped.length < plain.length ? '…' : ''}`;
}

export function searchSupportArticles(query: string, limit = 3) {
  const terms = words(query);
  if (terms.length === 0) return [];

  return SUPPORT_ARTICLES.map((article) => {
    const title = article.title.toLocaleLowerCase('en-GB');
    const summary = article.summary.toLocaleLowerCase('en-GB');
    const body = article.body.toLocaleLowerCase('en-GB');
    const score = terms.reduce(
      (total, term) => total + (title.includes(term) ? 8 : 0) + (summary.includes(term) ? 4 : 0) + (body.includes(term) ? 1 : 0),
      0,
    );
    return { article, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.article.updated.localeCompare(a.article.updated))
    .slice(0, Math.max(1, Math.min(limit, 3)))
    .map(({ article }) => ({
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      category: article.category,
      updated: article.updated,
      excerpt: excerpt(article, terms),
    }));
}
