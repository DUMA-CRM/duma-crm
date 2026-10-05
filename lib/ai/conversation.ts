/** Keep a bounded context, starting at a question rather than an orphaned answer. */
export function conversationWindow(messages: Array<{ role: 'user' | 'assistant'; content: string }>, budget = 24000) {
  const kept: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let remaining = budget;
  for (const message of [...messages].reverse()) {
    const content = message.content.trim().slice(0, 4000);
    if (!content) continue;
    if (content.length > remaining) break;
    kept.unshift({ role: message.role, content });
    remaining -= content.length;
  }
  while (kept[0]?.role === 'assistant') kept.shift();
  return kept;
}

/** Hold back the suggestion protocol, including a marker split across network chunks. */
export function visibleAnswer(text: string) {
  const marker = 'FOLLOW_UPS:';
  const index = text.indexOf(marker);
  if (index >= 0) return text.slice(0, index).trimEnd();
  for (let length = marker.length - 1; length > 0; length--) {
    if (text.endsWith(marker.slice(0, length))) return text.slice(0, -length).trimEnd();
  }
  return text;
}

/** Exact duplicates only: do not merge different periods, scopes or tool arguments. */
export function stableToolKey(name: string, args: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object')
      return Object.fromEntries(
        Object.entries(value)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([key, item]) => [key, canonical(item)]),
      );
    return value;
  };
  return `${name}:${JSON.stringify(canonical(args))}`;
}
