/**
 * The dashboard as a gallery, not a table. Half-width cards (6 of 12) that
 * follow one another flow into columns, each card as tall as its content, so
 * a short card never leaves a hole beside a tall one. Every other width — the
 * full-width strips, the 8 + 4 chart row, quarters and thirds — stays a row.
 */
export type FlowSegment<T> = { kind: 'row'; items: T[] } | { kind: 'columns'; items: T[] };

export function flowSegments<T extends { width: number }>(placements: readonly T[]): FlowSegment<T>[] {
  const segments: FlowSegment<T>[] = [];
  for (const placement of placements) {
    const kind = placement.width === 6 ? 'columns' : 'row';
    const last = segments.at(-1);
    if (last && last.kind === kind) last.items.push(placement);
    else segments.push({ kind, items: [placement] } as FlowSegment<T>);
  }
  return segments;
}

/**
 * Cards dealt into columns left, right, left… so the configured order still
 * reads across, the way it did in the grid, while each column stacks on its own.
 */
export function dealColumns<T>(items: readonly T[], columns: number): T[][] {
  const count = Math.max(1, Math.floor(columns));
  const out: T[][] = Array.from({ length: count }, () => []);
  items.forEach((item, index) => out[index % count]!.push(item));
  return out;
}
