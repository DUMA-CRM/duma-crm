import type { AgentCard, AgentListRow } from './agent-types';

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;
const PRESENTATIONAL_INTRO = /^(?:here (?:are|is)|below (?:are|is)|these are|the following (?:are|is)|i found)\b/i;

function normalize(value: string) {
  return value
    .toLocaleLowerCase('en-GB')
    .replace(/[*_`()[\]{}]/g, ' ')
    .replace(/[^\p{L}\p{N}£$€%]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function includesSignal(line: string, signal: string | undefined) {
  if (!signal) return false;
  const normal = normalize(signal);
  return normal.length >= 2 && line.includes(normal);
}

function repeatsRow(line: string, row: AgentListRow) {
  const normal = normalize(line);
  if (includesSignal(normal, row.label)) return true;
  if (!includesSignal(normal, row.value)) return false;

  // A figure alone is not enough: a recommendation can legitimately repeat a
  // total. One descriptive part from the card ties the line back to the row.
  const metaParts = (row.meta ?? '')
    .split('·')
    .map((part) => part.trim())
    .filter(Boolean);
  return metaParts.some((part) => includesSignal(normal, part));
}

/**
 * Structured cards already carry the records. Models sometimes narrate the
 * same rows immediately above them, so remove only list blocks demonstrably
 * copied from a card and preserve conclusions, caveats and recommendations.
 */
export function removeRepeatedCardRows(content: string, cards: AgentCard[]) {
  const rows = cards.flatMap((card) => (card.kind === 'list' ? card.rows : []));
  if (!content.trim() || rows.length === 0) return content.trim();

  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const kept: string[] = [];
  let removedBlock = false;

  for (let index = 0; index < lines.length; ) {
    if (!LIST_ITEM.test(lines[index])) {
      kept.push(lines[index]);
      index += 1;
      continue;
    }

    const block: string[] = [];
    while (index < lines.length && LIST_ITEM.test(lines[index])) block.push(lines[index++]);
    const repeated = block.filter((line) => rows.some((row) => repeatsRow(line, row))).length;
    // Two matching records establish that this is the card transcribed into
    // prose. For a one-row card, the single matching row is sufficient.
    if (repeated >= Math.min(2, block.length, rows.length)) removedBlock = true;
    else kept.push(...block);
  }

  let cleaned = kept
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (removedBlock && cleaned.length < 220 && PRESENTATIONAL_INTRO.test(cleaned.replace(/^#+\s*/, ''))) cleaned = '';
  return cleaned;
}
