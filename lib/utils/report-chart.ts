/**
 * Geometry for the report charts: rounded axis ticks and a smooth line. Pure,
 * so the shape of a chart is tested rather than eyeballed.
 */

/**
 * Axis ticks from zero to a round number at or above `max`: steps of 1, 2,
 * 2.5 or 5 × a power of ten, about `count` of them — so £0, £500, £1,000,
 * never £0, £437, £874.
 */
export function niceTicks(max: number, count = 4): number[] {
  if (!Number.isFinite(max) || max <= 0) return [0, 1];
  const rough = max / count;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((factor) => factor * power).find((candidate) => candidate >= rough) ?? 10 * power;
  const ticks: number[] = [];
  for (let value = 0; value < max + step * 0.999; value += step) ticks.push(Math.round(value * 1e6) / 1e6);
  return ticks.length > 1 ? ticks : [0, step];
}

export interface Point {
  x: number;
  y: number;
}

/**
 * A smooth path through points that never overshoots them (monotone cubic,
 * Fritsch–Carlson): a dip to zero stays at zero rather than swinging below the
 * axis, which a plain Bézier smoothing would draw as negative sales.
 */
export function monotonePath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M${points[0].x},${points[0].y}L${points[1].x},${points[1].y}`;

  const n = points.length;
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(points[i + 1].x - points[i].x);
    slope.push(dx[i] === 0 ? 0 : (points[i + 1].y - points[i].y) / dx[i]);
  }
  const tangent: number[] = [slope[0]];
  for (let i = 1; i < n - 1; i++) tangent.push(slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2);
  tangent.push(slope[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      tangent[i] = 0;
      tangent[i + 1] = 0;
      continue;
    }
    const a = tangent[i] / slope[i];
    const b = tangent[i + 1] / slope[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      tangent[i] = t * a * slope[i];
      tangent[i + 1] = t * b * slope[i];
    }
  }

  const f = (value: number) => Math.round(value * 100) / 100;
  let path = `M${f(points[0].x)},${f(points[0].y)}`;
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3;
    path += `C${f(points[i].x + third)},${f(points[i].y + tangent[i] * third)} ${f(points[i + 1].x - third)},${f(points[i + 1].y - tangent[i + 1] * third)} ${f(points[i + 1].x)},${f(points[i + 1].y)}`;
  }
  return path;
}

/**
 * Which points get an x-axis label: evenly spaced, at most `max` of them,
 * always the first and the last — and never one crowding the last.
 */
export function axisLabelIndexes(count: number, max: number): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  const limit = Math.max(2, Math.floor(max));
  if (count <= limit) return Array.from({ length: count }, (_, index) => index);
  const step = Math.ceil((count - 1) / (limit - 1));
  const indexes: number[] = [];
  for (let index = 0; index < count - 1; index += step) indexes.push(index);
  // Drop a label that would sit within half a step of the last one.
  if (count - 1 - indexes[indexes.length - 1] < step / 2) indexes.pop();
  indexes.push(count - 1);
  return indexes;
}

/** The point nearest a pointer `offset` pixels into a plot `width` wide with `count` evenly spaced points. */
export function nearestIndex(offset: number, count: number, width: number, centred = false): number {
  if (count <= 1 || width <= 0) return 0;
  const raw = centred ? (offset / width) * count - 0.5 : (offset / width) * (count - 1);
  return Math.min(count - 1, Math.max(0, Math.round(raw)));
}

/** "£1.2K" — money short enough for an axis, in the workspace's currency. */
export function compactMoney(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency,
      notation: 'compact',
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.abs(value) < 1000 ? 0 : 1,
    })
      .format(value)
      // Newer locale data (CLDR 47+, e.g. Node 22.23) writes en-GB thousands as
      // "k"; older data and most browsers write "K". One spelling everywhere.
      .replace(/(\d)k\b/, '$1K');
  } catch {
    return String(Math.round(value));
  }
}
