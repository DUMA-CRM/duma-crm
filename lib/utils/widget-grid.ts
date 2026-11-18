export interface GridSize {
  w: number;
  h: number;
}

export interface Cell extends GridSize {
  key: string;
  x: number;
  y: number;
}

export interface GridSpec {
  columns: number;
  sizes: (key: string) => readonly GridSize[];
}

export interface GridMetrics {
  column: number;
  row: number;
  gap: number;
}

export const readingOrder = (a: Cell, b: Cell) => a.y - b.y || a.x - b.x;
const bottom = (cell: Cell) => cell.y + cell.h;
const overlapsColumns = (a: Cell, b: Cell) => a.x < b.x + b.w && b.x < a.x + a.w;

export function collides(a: Cell, b: Cell): boolean {
  return overlapsColumns(a, b) && a.y < bottom(b) && b.y < bottom(a);
}

function pack(ordered: readonly Cell[]): Cell[] {
  const packed: Cell[] = [];
  for (const cell of ordered) {
    // Earlier widgets keep precedence in their columns. A later widget never
    // jumps across an earlier one that it would have to pass through.
    const y = packed.reduce((row, placed) => (overlapsColumns(cell, placed) ? Math.max(row, bottom(placed)) : row), 1);
    packed.push({ ...cell, y });
  }
  return packed.sort(readingOrder);
}

export const compact = (layout: readonly Cell[]): Cell[] => pack([...layout].sort(readingOrder));

function place(layout: readonly Cell[], target: Cell): Cell[] {
  const ordered = layout.filter((cell) => cell.key !== target.key).sort(readingOrder);
  const next = ordered.findIndex((cell) => collides(cell, target) || readingOrder(cell, target) >= 0);
  ordered.splice(next === -1 ? ordered.length : next, 0, target);
  return pack(ordered);
}

const clampX = (x: number, w: number, columns: number) => Math.max(1, Math.min(x, columns - w + 1));

export function move(layout: readonly Cell[], key: string, x: number, y: number, columns: number): Cell[] {
  const cell = layout.find((item) => item.key === key);
  if (!cell) return [...layout];
  const target = { ...cell, x: clampX(x, cell.w, columns), y: Math.max(1, y) };
  return target.x === cell.x && target.y === cell.y ? [...layout] : place(layout, target);
}

export function resize(layout: readonly Cell[], key: string, size: GridSize, columns: number): Cell[] {
  const cell = layout.find((item) => item.key === key);
  if (!cell || size.w > columns || (cell.w === size.w && cell.h === size.h)) return [...layout];
  return place(layout, { ...cell, ...size, x: clampX(cell.x, size.w, columns) });
}

export function nearestSize(sizes: readonly GridSize[], w: number, h: number): GridSize | undefined {
  const distance = (size: GridSize) => (size.w - w) ** 2 + (size.h - h) ** 2;
  return sizes.reduce<GridSize | undefined>((best, size) => (!best || distance(size) < distance(best) ? size : best), undefined);
}

export function firstFreeSlot(layout: readonly Cell[], size: GridSize, columns: number): Pick<Cell, 'x' | 'y'> {
  const lastRow = layout.reduce((row, cell) => Math.max(row, cell.y), 1);
  for (let x = 1; x <= columns - size.w + 1; x++) {
    if (!layout.some((cell) => collides(cell, { key: '', x, y: lastRow, ...size }))) return { x, y: lastRow };
  }
  return { x: 1, y: layout.reduce((row, cell) => Math.max(row, bottom(cell)), 1) };
}

export function normalize(saved: readonly Cell[], spec: GridSpec): Cell[] {
  const seen = new Set<string>();
  const layout: Cell[] = [];
  for (const cell of [...saved].sort(readingOrder)) {
    const size = nearestSize(
      spec.sizes(cell.key).filter(({ w }) => w <= spec.columns),
      cell.w,
      cell.h,
    );
    if (!size || seen.has(cell.key)) continue;
    seen.add(cell.key);
    layout.push({
      key: cell.key,
      x: clampX(Math.round(cell.x) || 1, size.w, spec.columns),
      y: Math.max(1, Math.round(cell.y) || 1),
      ...size,
    });
  }
  return pack(layout);
}

export function reflow(layout: readonly Cell[], spec: GridSpec): Cell[] {
  let x = 1;
  let y = 1;
  let rowHeight = 0;
  return [...layout].sort(readingOrder).map((cell) => {
    const widths = spec
      .sizes(cell.key)
      .filter((size) => size.w <= Math.min(cell.w, spec.columns))
      .map((size) => size.w);
    const w = widths.length ? Math.max(...widths) : spec.columns;
    if (x + w - 1 > spec.columns) {
      x = 1;
      y += rowHeight;
      rowHeight = 0;
    }
    const placed = { ...cell, x, y, w };
    x += w;
    rowHeight = Math.max(rowHeight, cell.h);
    return placed;
  });
}

export function pointToCell(px: number, py: number, { column, row, gap }: GridMetrics): Pick<Cell, 'x' | 'y'> {
  return { x: Math.round(px / (column + gap)) + 1, y: Math.round(py / (row + gap)) + 1 };
}

export function isValidLayout(layout: readonly Cell[], columns: number): boolean {
  const keys = new Set(layout.map(({ key }) => key));
  return (
    keys.size === layout.length &&
    layout.every(
      (cell, index) =>
        [cell.x, cell.y, cell.w, cell.h].every((value) => Number.isInteger(value) && value >= 1) &&
        cell.x + cell.w - 1 <= columns &&
        !layout.slice(0, index).some((other) => collides(cell, other)),
    )
  );
}
