import type { Look } from '@/lib/mascot/engine/engine';

/**
 * Where the mascot looks when something outside it is steering — the pointer,
 * today.
 *
 * Kept apart from the engine and from the component for the same reason the
 * upstream project keeps it apart: the rule is pure, so both signs in it can be
 * checked without a DOM, and they are the two things that are easy to get wrong.
 *
 * This is the one file of the port that is *not* vendored verbatim. Upstream
 * aims the head permanently to the left, because its avatar sits beside a
 * settings panel and should face it. Ours sits in a chat panel and is looked at
 * head-on, so the rest direction is straight ahead and the pointer moves it
 * from there.
 */

/**
 * Head yaw and pitch swing, in degrees. Chosen, not measured: the reference
 * video shows no pointer tracking at all.
 *
 * **These are bounded by how small they make the eye, not by how far it can
 * travel.** The eyes are painted on a sphere and projected orthographically, so an
 * eye's apparent AREA is the z of its own normal: swing the gaze and the far eye
 * foreshortens. Swing it far enough and the mascot reads as having small eyes,
 * which is the defect, not the effect.
 *
 * Measured over the whole tracking range — every mood the panel uses, both eyes,
 * the pointer at each screen corner, and the resting drift at its extremes — the
 * worst eye comes to:
 *
 * | yaw/pitch | worst eye area | linear |
 * |---|---|---|
 * | 26/19 | 61% | 78% |
 * | 22/16 | 67% | 82% |
 * | **18/14** | **73%** | **85%** |
 * | 16/13 (upstream) | 75% | 87% |
 *
 * 26/19 was the first attempt, on the reasoning that a 22px ball needs a wide
 * swing to react visibly. The arithmetic behind that was wrong: at 18° an eye
 * travels `sin 18° = 0.31` of the ball's radius, which on a 28px ball is three
 * times the eye's own width — plainly legible. It bought nothing and cost a fifth
 * of the eye.
 *
 * The binding case is always the *inner* eye of a wide-set mood (`excite` and
 * `surpris` carry a 19–19.5° half-split against the standard 15.46°) with the
 * pointer in a corner. So a new expression with a wider split lowers this table,
 * and the number to re-measure is that one.
 */
export const YAW_MAX = 18;
export const PITCH_MAX = 14;

/**
 * The height the gaze holds at when the pointer is dead centre. Slightly above
 * the equator, which reads as attentive rather than vacant.
 *
 * Absolute, and that is the whole point: relative to each expression, eye
 * height followed the expression's own pitch, and since `neutre` looks 28.6°
 * higher than the moods, the eyes dropped all at once on the first mood change.
 */
export const PITCH = 8;

/**
 * A full turn taken *on the way in*, in degrees.
 *
 * Free on a sphere: past 90° of yaw the eyes cross the limb, the engine drops
 * them, and they reappear on the other side. So the spin is not an effect laid
 * over the render, it is the same orthographic projection pushed round once —
 * and it lands true by construction, -360° being the same angle as 0.
 *
 * **Only on a circular body.** Anything anchored to the outline is refitted to the
 * real radius in its own direction (`radiusAtAngle`), so on a hexagon the eyes
 * follow the profile as they go round: they step in and out over the flats and
 * corners instead of gliding. Callers therefore ask for the spin rather than
 * getting it — see `Aim.spin`.
 *
 * **And nothing asks.** DUMA's body was a hexagon, which made the question moot;
 * it is a ball now, so the spin became available and was deliberately left off.
 * The header launcher starts tracking on every pointer entry, several times a
 * minute, and sending the eyes the whole way round the back of the head each time
 * is a trick rather than a reaction. The entrance turn that runs alongside it —
 * `turn`, on an ease-out over `TURN_TIME` — is the part that reads as looking up
 * at you, and it survives on its own. Kept here because it is the engine's
 * behaviour and a one-off greeting is a fair use of it; not because it is unused
 * by accident.
 */
export const SPIN = 360;

/** How long that turn takes. Short enough to read as a greeting, not a loop. */
export const TURN_TIME = 0.9;

/*
 * There was a `TRACKING_MOODS` allow-list here — the eight moods with zero roll,
 * the ones safe to wear while tracking the pointer, because tracking neutralised
 * yaw and pitch but not roll, and roll tips the head and so moves the eyes
 * vertically. A mood at -15° followed by one at -4° slid them while they were
 * supposed to be pinned to the cursor.
 *
 * It is gone because it was never enforceable. Nothing imported it, and the
 * resting mood the whole product wears — `attentif`, roll -4° — was not on it, so
 * the defect it described was live on every screen. `Look.roll` in the engine
 * fixes it at the layer that can: the target is zero, so tracking straightens the
 * head and a change of mood cannot move the eyes at all. Every mood is now safe to
 * track in, and what separates them while it does is the *shape* of the eyes,
 * which is what the original note said was doing the reading anyway.
 */

export interface Aim {
  /** Pointer offset from the mascot's centre, -1 to 1, right positive. */
  nx: number;
  /** The same vertically, in screen sense, down positive. */
  ny: number;
  /** How far the entrance has got, 0 to 1. */
  turn: number;
  /**
   * Degrees of spin to travel on the way in, melting to zero as `turn` completes.
   * Pass `SPIN` for the full turn, or 0 — which any non-circular body must, since
   * the eyes would step over its profile rather than glide round it.
   */
  spin: number;
  /** false = no pointer known: the head stays put, but it comes back to life. */
  pointer: boolean;
}

/**
 * The gaze target.
 *
 * `turn` drives everything: it raises the hold on the state's own pose (`mix`)
 * and melts the spin away at the same time. At 0 the pose commands alone; at 1
 * the mascot is tracking.
 *
 * Nothing here compensates for the expression on screen — the engine does that
 * mixing, because only it knows the pose *at instant t*. Doing it here would
 * mean reading the expression's arrival yaw while the engine was still morphing
 * towards it, and the eyes jumped on every mood change.
 */
export function lookTarget({ nx, ny, turn, pointer, spin }: Aim): Look {
  return {
    yaw: nx * YAW_MAX,
    // positive pitch looks up, whereas screen y grows downwards
    pitch: PITCH - ny * PITCH_MAX,
    // Zero, so tracking STRAIGHTENS the head rather than rolling it with the
    // cursor. The mood's own tilt is what the mascot wears at rest; while it is
    // looking at you, a change of mood must not move the eyes off the pointer.
    roll: 0,
    mix: turn,
    spin: spin * (1 - turn),
    // With no pointer the head holds its direction but gets its drift back:
    // otherwise the mascot stares at a dead point, and arriving by keyboard or
    // by touch gave a completely motionless avatar.
    wander: pointer ? 0 : 1,
  };
}

/**
 * A scripted gaze: evaluated every frame with the time since it was set, in
 * seconds. The script carries its own clock, so it can chain several movements
 * and the component has no duration to know about.
 *
 * The rule that makes a script maintenance-free: it must **end at `mix: 0`**,
 * where the state's pose commands alone. There is then never anything to
 * release, and that release — which would show as one last slide of the eyes,
 * exactly when everything should have settled — does not exist.
 */
export type GazeScript = (t: number) => Look;
