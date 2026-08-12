import type { AgentShortcut } from './agent-types';

const NAVIGATION_INTENT =
  /\b(open|show|take me|go to|navigate|link|page|where (?:is|can i find)|find (?:the )?(?:guide|docs|documentation)|guide me|walk me through)\b/i;

function words(value: string) {
  const ignored = new Set(['duma', 'open', 'page', 'show', 'take', 'there', 'this', 'that', 'with', 'from', 'into']);
  return new Set(
    (value.toLocaleLowerCase('en-GB').match(/[a-z0-9]{3,}/g) ?? [])
      .filter((word) => !ignored.has(word))
      .map((word) => (word.length > 4 && word.endsWith('s') ? word.slice(0, -1) : word)),
  );
}

/**
 * Tool calls often touch several workspaces to answer one question. Those
 * supporting reads should not become a menu of loosely related destinations.
 */
export function selectRelevantShortcuts(request: string, answer: string, shortcuts: readonly AgentShortcut[]): AgentShortcut[] {
  if (shortcuts.length === 0) return [];

  const requestWords = words(request);
  const answerWords = words(answer);
  const hasNavigationIntent = NAVIGATION_INTENT.test(request);
  const ranked = shortcuts
    .map((shortcut, index) => {
      const destinationWords = words(`${shortcut.label} ${shortcut.description ?? ''} ${shortcut.href.replaceAll('/', ' ')}`);
      const requestScore = [...requestWords].filter((word) => destinationWords.has(word)).length;
      const answerScore = hasNavigationIntent ? [...answerWords].filter((word) => destinationWords.has(word)).length : 0;
      return { shortcut, score: requestScore * 3 + answerScore, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index);

  return ranked[0]?.score ? [ranked[0].shortcut] : [];
}
