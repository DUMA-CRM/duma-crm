export interface PriorityBriefItem {
  rank: number;
  title: string;
  evidence: string;
  next?: string;
}

export interface PriorityBrief {
  items: PriorityBriefItem[];
  remainder: string;
}

const PRIORITY_LINE = /^\s*(\d+)\.\s+(?:\*\*)?(.+?)(?:\*\*)?\s*(?::|—|-)\s+(.+)\s*$/;

/**
 * Recognise the compact ranked brief Ask DUMA uses for operational priorities.
 *
 * This stays deliberately narrow: ordinary numbered instructions remain
 * ordinary Markdown. A priority brief needs two or three consecutively ranked
 * findings with a short title and evidence after a separator.
 */
export function parsePriorityBrief(content: string): PriorityBrief | undefined {
  const items: PriorityBriefItem[] = [];
  const remainder: string[] = [];

  for (const line of content.replace(/\r\n/g, '\n').split('\n')) {
    const match = line.match(PRIORITY_LINE);
    if (!match) {
      if (line.trim()) remainder.push(line);
      continue;
    }
    const rank = Number(match[1]);
    if (rank !== items.length + 1 || rank > 3) return undefined;
    const title = match[2].replace(/^\*\*|\*\*$/g, '').trim();
    const detail = match[3].trim();
    const nextMatch = detail.match(/\s+(?:\*\*)?Next:(?:\*\*)?\s+/i);
    const evidence = (nextMatch ? detail.slice(0, nextMatch.index) : detail).trim();
    const next = nextMatch ? detail.slice((nextMatch.index ?? 0) + nextMatch[0].length).trim() : undefined;
    if (!title || !evidence) return undefined;
    items.push({ rank, title, evidence, ...(next ? { next } : {}) });
  }

  if (items.length < 2) return undefined;
  return { items, remainder: remainder.join('\n') };
}
