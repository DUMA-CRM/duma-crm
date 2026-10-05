export type AgentContentBlock = { kind: 'markdown'; content: string } | { kind: 'mermaid'; source: string };

const COMPLETE_MERMAID_FENCE = /```mermaid[^\S\r\n]*\r?\n([\s\S]*?)\r?\n```/gi;
const SUPPORTED_DIAGRAM = /^(?:flowchart|graph|sequenceDiagram|stateDiagram(?:-v2)?)\b/i;
const UNSAFE_DIRECTIVE = /%%\{|\bclick\s+|\bhref\s+|javascript:/i;

/**
 * Keep model diagrams deliberately small and inert. Unsupported or incomplete
 * fences stay as ordinary Markdown code, which is the readable fallback while
 * an answer is streaming and if a model picks syntax the UI does not support.
 */
export function isRenderableMermaid(source: string) {
  const trimmed = source.trim();
  if (!trimmed || trimmed.length > 4_000 || UNSAFE_DIRECTIVE.test(trimmed)) return false;
  const firstStatement = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line && !line.startsWith('%%'));
  return Boolean(firstStatement && SUPPORTED_DIAGRAM.test(firstStatement));
}

export function splitAgentContent(content: string): AgentContentBlock[] {
  const blocks: AgentContentBlock[] = [];
  let cursor = 0;

  for (const match of content.matchAll(COMPLETE_MERMAID_FENCE)) {
    const start = match.index ?? 0;
    const source = match[1].trim();
    if (!isRenderableMermaid(source)) continue;
    if (start > cursor) blocks.push({ kind: 'markdown', content: content.slice(cursor, start) });
    blocks.push({ kind: 'mermaid', source });
    cursor = start + match[0].length;
  }

  if (cursor < content.length) blocks.push({ kind: 'markdown', content: content.slice(cursor) });
  return blocks.length ? blocks : [{ kind: 'markdown', content }];
}
