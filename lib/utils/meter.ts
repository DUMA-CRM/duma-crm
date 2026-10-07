// The arithmetic behind `MiniBar`: how full a bar is, and where a target tick
// sits, as percentages clamped to the track. Kept here so it can be tested.

export interface MeterGeometry {
  /** Fill width, 0–100. */
  fill: number;
  /** Where the target tick sits, 0–100, or null when there is no target. */
  mark: number | null;
  /** The value has passed the target. */
  over: boolean;
}

const clamp = (n: number) => Math.min(100, Math.max(0, n));

/**
 * A bar of `value` against `max`. When a `target` (a par level, a daily goal)
 * is given and `max` is not, the track is sized so the target sits at 2/3 —
 * room to show both "short of it" and "well past it".
 */
export function meterGeometry(value: number, max?: number | null, target?: number | null): MeterGeometry {
  const v = Number.isFinite(value) ? Math.max(0, value) : 0;
  const t = target != null && Number.isFinite(target) && target > 0 ? target : null;
  const track = max != null && Number.isFinite(max) && max > 0 ? max : t != null ? Math.max(t * 1.5, v) : v;
  if (track <= 0) return { fill: 0, mark: t == null ? null : 0, over: false };
  return {
    fill: clamp((v / track) * 100),
    mark: t == null ? null : clamp((t / track) * 100),
    over: t != null && v > t,
  };
}
