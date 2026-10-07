// Where a shift's planned and worked stretches sit on one small bar, so a rota
// row can show "planned 09:00–17:00, worked 09:12–16:50" as two overlapping
// bands instead of two columns of times.

export interface BarSpan {
  /** 0–100, from the left of the bar. */
  left: number;
  /** 0–100. */
  width: number;
}

const span = (start: number, end: number, from: number, length: number): BarSpan => {
  const left = ((start - from) / length) * 100;
  const width = ((end - start) / length) * 100;
  return { left: Math.max(0, Math.min(100, left)), width: Math.max(0, Math.min(100 - Math.max(0, left), width)) };
};

/**
 * The bar's window runs from the earliest to the latest of the planned and
 * worked times. A shift still running is drawn up to `now`. Returns null for
 * a row with nothing to draw.
 */
export function shiftBarGeometry(input: {
  plannedStart?: string | null;
  plannedEnd?: string | null;
  workedStart?: string | null;
  /** Null while still clocked in. */
  workedEnd?: string | null;
  now: number;
}): { planned: BarSpan | null; worked: BarSpan | null } | null {
  const ps = input.plannedStart ? Date.parse(input.plannedStart) : NaN;
  const pe = input.plannedEnd ? Date.parse(input.plannedEnd) : NaN;
  const ws = input.workedStart ? Date.parse(input.workedStart) : NaN;
  const we = input.workedStart ? (input.workedEnd ? Date.parse(input.workedEnd) : input.now) : NaN;
  const hasPlanned = Number.isFinite(ps) && Number.isFinite(pe) && pe > ps;
  const hasWorked = Number.isFinite(ws) && Number.isFinite(we) && we >= ws;
  if (!hasPlanned && !hasWorked) return null;

  const points = [...(hasPlanned ? [ps, pe] : []), ...(hasWorked ? [ws, we] : [])];
  const from = Math.min(...points);
  const to = Math.max(...points);
  const length = Math.max(to - from, 60_000);

  return {
    planned: hasPlanned ? span(ps, pe, from, length) : null,
    worked: hasWorked ? span(ws, Math.max(we, ws + length * 0.02), from, length) : null,
  };
}
