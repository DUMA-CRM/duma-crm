'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';

import { BotEngine, type BotFrame } from '@/lib/mascot/engine/engine';
import { EXPRESSION_BY_ID, type ExpressionId } from '@/lib/mascot/engine/expressions';
import { clamp, easings } from '@/lib/mascot/engine/math';
import { DEMI_VIEWBOX, RAYON } from '@/lib/mascot/engine/repere';
import { SHAPE_BY_ID, type ShapeId } from '@/lib/mascot/engine/skins';
import { POSES, STATE_BY_ID, type StateId } from '@/lib/mascot/engine/states';
import { type GazeScript, TURN_TIME, lookTarget } from '@/lib/mascot/gaze';
import { cn } from '@/lib/utils/cn';

/**
 * DUMA's mascot: one flat filled shape that morphs between poses, with two eyes
 * set into it.
 *
 * The engine underneath (`lib/mascot/engine/`) is vendored from the `bloub`
 * project and is framework-free and clock-free — `sample(t)` is a pure function
 * of time. This component is one *client* of it, and everything it adds is the
 * part a pure function cannot do: a clock, the pointer, the DOM.
 *
 * **Flat on purpose.** A shaded version of this was built — a body gradient lit
 * from the upper left, a specular blob, a bounce along the lower rim, a catchlight
 * in each eye — and it was rejected on the thing that actually matters here: the
 * mascot's working size is the 44px header launcher, and at that size every one of
 * those effects is fighting the two shapes a reader needs to resolve, which are
 * the silhouette and the eyes. Two flat colours and a hard edge read instantly at
 * any size, in either theme, on any plate. Do not reintroduce depth without a
 * reason that survives being looked at at 44px.
 *
 * Two consequences worth knowing before changing anything here:
 *
 *   - **Colours arrive as CSS colours, not hex, and they must go through
 *     `style`.** The engine only ever needed hex because upstream mixes particle
 *     fog itself; we hand that to `color-mix()` instead, so `ink` and `eye` can be
 *     design tokens and the mascot follows the theme with no JS reading computed
 *     styles and no re-render on a theme flip. The catch is that a presentation
 *     attribute is not a CSS declaration, so `fill="var(--mascot-ink)"` compiles,
 *     renders, and is silently black. Anything carrying one of these colours takes
 *     it as `style`, never as an attribute.
 *
 *   - **The eyes are wells, not holes.** They are still *punched* through the body
 *     by the mask — that is what clips them against the outline for free when they
 *     slide towards the edge — but what shows through is an opaque layer painted in
 *     `eye`, in the shape of the body. So the eyes are the same colour on any
 *     surface and callers no longer have to declare what is behind the mascot; and
 *     that same opaque layer is what stops the back half of the orbit rings — drawn
 *     under the body deliberately, to be occluded — from reappearing inside them.
 */
export interface MascotProps {
  /**
   * Rendered box, in px. The viewBox is fixed, so this is a pure scale.
   *
   * The box is wider than the mascot: it has to hold the orbit rings, which reach
   * 1.4× the body's radius, so the body itself is **63%** of `size`. Sizing a
   * mascot like an icon therefore lands it visibly smaller than the icons beside
   * it — to match a 22px glyph, pass about 35.
   */
  size?: number;
  /** Which pose to hold. Changing it morphs, it does not cut. */
  state?: StateId;
  /**
   * Resting mood. Only bites on states that carry the resting face — `idle`,
   * `swirl` and `pondering`; everywhere else the expression *is* the animation
   * being reproduced.
   *
   * Any mood is safe here, including while `follow` is on. That was not true until
   * the engine's `Look` grew a `roll`: a mood carries its own head tilt, tracking
   * used to leave it alone, and so changing mood slid the eyes vertically while they
   * were supposed to be pinned to the cursor. Tracking now straightens the head, and
   * what tells two moods apart while it does is the shape of the eyes.
   */
  expression?: ExpressionId;
  /**
   * Resting body outline. Only bites on states that carry the resting body — on
   * every other state the silhouette *is* the animation and must not be replaced.
   *
   * A **circle** by default, which is DUMA's mascot. It was a hexagon, and the
   * change carries most of the redraw: a ball is the friendlier silhouette at a
   * glance, it is what the engine's constants were measured against — upstream's
   * own note is that "the body is a true circle, not a squircle" — so the poses are
   * more faithful on it, the eye-fit corrective below becomes a no-op, and the gaze
   * can take the full turn `SPIN` describes instead of stepping over flats and
   * corners on the way round.
   *
   * The other shapes still work. Worth knowing what a non-circular body changes,
   * because the engine handles most of it and not all: the eyes and the
   * notification pastille are refitted to the real radius in their own direction,
   * and a per-shape corrective (`engine/eyefit.ts`, resolved once at import) keeps
   * the eyes off the edge. What it cannot fix is that spin — see `SPIN` in
   * `lib/mascot/gaze` — because eyes travelling round a profile step over its flats
   * and corners instead of gliding.
   */
  shape?: ShapeId;
  /** Body colour. Any CSS colour, so a `var(--token)` is fine. */
  ink?: string;
  /**
   * The eye material — an opaque well set into the body, not a hole through to
   * whatever is behind it. See above. Any CSS colour.
   */
  eye?: string;
  /** The notification pastille's colour. */
  accent?: string;
  /** The gaze tracks the pointer, with a turn on the way in. */
  follow?: boolean;
  /**
   * A scripted gaze, evaluated every frame with its own elapsed time.
   * Independent of `follow`, which aims at the pointer; here the script decides
   * everything, its duration included.
   */
  gaze?: GazeScript | null;
  /**
   * Freeze on this date, in seconds since the state began, and render one exact
   * frame with no animation loop. This is how a thumbnail or a reduced-motion
   * render is drawn.
   */
  frozenAt?: number;
  /**
   * Cap how often the loop samples, in frames per second. Omit for every frame.
   *
   * This is how a mascot that is only decorating is made cheap. A `paused` prop came
   * first, holding one still frame, and it was the wrong trade everywhere it was
   * used: a motionless character reads as a broken image rather than a calm one. If
   * a frozen frame really is what you want, `frozenAt` already does it and says
   * which frame.
   *
   * The clock still advances every frame, so nothing drifts and nothing desyncs —
   * `engine.sample(t)` is a pure function of time, so a frame skipped is a frame
   * *not drawn*, never a frame lost. What it saves is the two costs that matter: a
   * 64-point silhouette rebuilt into a path string, and a React commit.
   *
   * 15 is plenty for a resting mascot, which is worth stating because it sounds
   * too low. Everything it does at rest is slow or brief: the breath is a 0.5%
   * squash over 3.4s, the gaze drift has periods of 4–11s, and a blink lasts
   * 0.18s — which the reference video captured in one or two frames, because that
   * video was cut at 10fps. The measurements this engine reproduces were taken at
   * a lower rate than this cap.
   */
  fps?: number;
  /** Announced name. Omit and the mascot is hidden from assistive tech. */
  label?: string;
  className?: string;
}

/**
 * Longest frame step the scene clock will take, in seconds.
 *
 * A backgrounded tab suspends rAF, so the first frame back would otherwise
 * carry the whole absence as one step and fast-forward the animation. Capped at
 * roughly four frames.
 */
const MAX_STEP = 0.064;

/**
 * Catch-up applied to a scripted gaze, where pointer tracking takes the
 * engine's own.
 *
 * The script *is* the animation, and letting the engine smooth a second one over
 * the top would delay its start by a quarter second — a script that opens by
 * looking away would see its eyes leave the pose, come back, then leave again.
 *
 * Non-zero all the same: at zero, `lookAtTime` divides zero by zero on the frame
 * the target is set, and a `NaN` moves into the engine for good.
 */
const SCRIPT_MORPH = 1 / 60;

export function Mascot({
  size = 40,
  state = 'idle',
  expression = 'neutre',
  shape = 'cercle',
  ink = 'var(--mascot-ink)',
  eye = 'var(--mascot-eye)',
  accent = 'var(--mascot-accent)',
  follow = false,
  gaze = null,
  frozenAt,
  fps,
  label,
  className,
}: MascotProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const radii = SHAPE_BY_ID.get(shape)?.radii ?? null;
  const mood = EXPRESSION_BY_ID.get(expression) ?? null;

  /**
   * `useId` is SSR-safe where `Math.random()` would hydrate to a different id,
   * but it hands back a string with delimiters in it (`«r0»`), and those cannot
   * go in a `url(#…)` reference without escaping. Stripped rather than escaped:
   * the remainder is still unique per instance, which is all the id is for.
   */
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const maskId = `mascot-mask-${uid}`;

  /**
   * The engine is per-instance mutable state that must survive re-renders and
   * must *not* be rebuilt by one — it holds the timeline the animation is
   * blending along, so a fresh engine would restart every morph mid-flight.
   *
   * Held in `useState` rather than a ref because it is read during render, to
   * seed the first frame: a ref read at render time is what the refs rule is
   * there to catch, and it is right to — the value would be invisible to the
   * renderer. A lazy initial state is the same "build once, keep forever" with
   * none of that.
   */
  const [engine] = useState(() => new BotEngine(RAYON, state, radii, mood));

  /** Scene clock, in seconds. Only the loop advances it; effects only read it. */
  const clockRef = useRef(0);
  /** Last known pointer position, in client coordinates. */
  const pointerRef = useRef<{ x: number; y: number } | null>(null);
  /**
   * The mascot's box, and a flag saying the cached one may be wrong.
   *
   * `getBoundingClientRect` forces a synchronous layout of the whole document, and
   * this application's pages are large — so where it is called from matters far
   * more than how often it is *needed*. Measuring it straight from the pointermove
   * handler cost one full layout per mouse movement across the entire page, and
   * made the animation stutter exactly while the pointer was moving, which is the
   * one time anybody is looking at it.
   *
   * So the handlers only ever set the flag, which is free, and the measurement
   * happens at most once per frame from inside the rAF callback — before React has
   * written anything, so it never reads back a layout it just invalidated.
   */
  const boxRef = useRef<DOMRect | null>(null);
  const staleBoxRef = useRef(true);
  /** Clock date the entrance turn began. */
  const turnRef = useRef(0);
  /** true = a target is set on the engine, so there is something to release. */
  const aimingRef = useRef(false);
  /** Clock date the gaze script was set. */
  const gazeSinceRef = useRef(0);

  const [live, setLive] = useState<BotFrame>(() => engine.sample(frozenAt ?? 0));

  /**
   * Reduced motion and off-screen both come down to the same thing — don't run
   * a loop — so they are one flag. `null` until measured on the client, which
   * keeps the server render and the first client render identical.
   */
  const [animate, setAnimate] = useState(false);
  const frozen = frozenAt !== undefined || !animate;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || frozenAt !== undefined) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;

    const sync = () => setAnimate(visible && !motion.matches);

    // An off-screen mascot still costs a path rebuild and a React commit per
    // frame, and the launcher's lives in a header that scrolls away.
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    observer.observe(svg);
    motion.addEventListener('change', sync);
    sync();

    return () => {
      observer.disconnect();
      motion.removeEventListener('change', sync);
    };
  }, [frozenAt]);

  /**
   * A state change is dated on the engine, never applied by rebuilding it: the
   * engine keeps the state being left so it can blend out of it, and that blend
   * is the whole difference between a morph and a cut.
   */
  useEffect(() => {
    engine.setState(state, clockRef.current);
  }, [engine, state]);

  useEffect(() => {
    // Passing the clock is what makes the body morph towards the new outline
    // instead of snapping to it.
    engine.setShape(radii, clockRef.current);
  }, [engine, radii]);

  useEffect(() => {
    engine.setExpression(mood, clockRef.current);
  }, [engine, mood]);

  /**
   * A frozen mascot is drawn during render, from an engine built for that one
   * pose, and never from the animated one.
   *
   * It reads as the long way round and is the shorter one. A frozen frame is a
   * pure function of its inputs — there is no timeline to preserve, which is what
   * "frozen" means — so it belongs in render, where React can see it, rather than
   * in an effect syncing state after the fact. The animated engine meanwhile has
   * a history that would leak into the still: pause during a morph and it would
   * freeze mid-blend rather than on the pose asked for.
   *
   * The date defaults to the state's most legible instant rather than zero, which
   * is frame one of a morph — a poor still, and the one a reduced-motion reader
   * would be left with.
   */
  const still = useMemo(
    () => (frozen ? new BotEngine(RAYON, state, radii, mood).sample(frozenAt ?? POSES[state]) : null),
    [frozen, frozenAt, mood, radii, state],
  );

  /** Where the mascot is on screen, and therefore what "at the pointer" means. */
  useEffect(() => {
    if (frozen || !follow) return;
    const svg = svgRef.current;
    if (!svg) return;

    const invalidate = () => {
      staleBoxRef.current = true;
    };

    const onPointerMove = (event: PointerEvent) => {
      // Touch leaves no cursor behind: a lifted finger would strand the gaze on
      // the last point touched, which reads as a bug rather than as attention.
      if (event.pointerType === 'touch') return;
      pointerRef.current = { x: event.clientX, y: event.clientY };
      // The pointer moving does not move the mascot, but dragging the panel is a
      // pointermove, and so is the scroll a trackpad sends. One flag covers both,
      // and costs nothing to set on the ones it does not need to.
      invalidate();
    };
    const onPointerLeave = () => {
      pointerRef.current = null;
    };

    invalidate();
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('pointerleave', onPointerLeave);
    window.addEventListener('resize', invalidate);
    window.addEventListener('scroll', invalidate, { capture: true, passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', invalidate);
      window.removeEventListener('scroll', invalidate, { capture: true });
      // A target left set would hold the eyes wherever tracking stopped: the
      // engine keeps the last one it was given.
      if (aimingRef.current) {
        engine.setLook(null, clockRef.current, TURN_TIME);
        aimingRef.current = false;
      }
    };
  }, [engine, follow, frozen]);

  /**
   * The gaze script starts the frame it is handed over, not the one after.
   *
   * Its opening value is set dated one catch-up *earlier*, so it is already
   * fully applied on the first frame. Without that, the engine renders frame one
   * with the resting gaze and frame two with the script's, and the eyes jump
   * between them — unnoticeable for a script that opens at rest, spectacular for
   * one that opens looking away, which is exactly the defect these scripts fix.
   */
  useEffect(() => {
    if (frozen) return;
    if (gaze) {
      gazeSinceRef.current = clockRef.current;
      engine.setLook(gaze(0), clockRef.current - SCRIPT_MORPH, SCRIPT_MORPH);
      return;
    }
    engine.setLook(null, clockRef.current);
  }, [engine, frozen, gaze]);

  useEffect(() => {
    if (frozen) return;

    let raf = 0;
    let last = 0;
    /** Shortest gap between samples, in scene seconds. 0 = draw every frame. */
    const minStep = fps ? 1 / fps : 0;
    /** Clock date of the last sample. -Infinity so the first frame always draws. */
    let sampledAt = -Infinity;

    /*
     * The clock is deliberately NOT seeded to the frozen frame's date.
     *
     * Matching it would make the handover pixel-continuous, and it would also
     * skip every entrance: the engine dates a state change at the clock, so
     * starting late puts the morph already behind us. A mascot that has just been
     * allowed to move should morph into its pose — blink into a wink, grow the
     * three dots out of the ball — which is what starting at zero gives.
     *
     * The cut it costs is between two frames of the same pose, since a mascot that
     * was not allowed to move is already in the state it wakes up in. That is the
     * cheaper of the two, by a distance.
     */

    /**
     * Aim at the pointer. Does the DOM half of the work only — where the ball is
     * and where the cursor is — the gaze rule itself living in `lib/mascot/gaze`.
     */
    const aim = () => {
      // Only states carrying the resting face take direction from outside.
      // Elsewhere the gaze pose *is* the measured animation — `orbit` already
      // sends the eyes racing round the sphere — and overlaying tracking on it
      // would only muddy both.
      if (!STATE_BY_ID.get(engine.state)?.baseFace) {
        if (aimingRef.current) {
          engine.setLook(null, clockRef.current, TURN_TIME);
          aimingRef.current = false;
        }
        return;
      }

      // The one forced layout, taken at most once a frame and only when something
      // has said the cached box may be wrong.
      if (staleBoxRef.current && svgRef.current) {
        boxRef.current = svgRef.current.getBoundingClientRect();
        staleBoxRef.current = false;
      }

      const box = boxRef.current;
      /*
       * A box with no area: there is nothing to aim at, and the normalisation
       * below would be `0 / 0`, so `NaN`. The engine *keeps* the last target, so
       * a single NaN set once stays forever and the mascot never rests again.
       * It happens for real when the browser pane is hidden — then
       * `getBoundingClientRect` hands back zeros.
       */
      if (!box || box.width === 0 || box.height === 0) return;

      // the turn starts when tracking does
      if (!aimingRef.current) turnRef.current = clockRef.current;

      const pointer = pointerRef.current;
      // Normalised against the half-window rather than against the mascot: the
      // gaze should saturate when the cursor reaches the edge of the screen,
      // whatever space the ball itself takes up.
      const halfWidth = Math.max(1, window.innerWidth / 2);
      const halfHeight = Math.max(1, window.innerHeight / 2);
      engine.setLook(
        lookTarget({
          nx: pointer ? clamp((pointer.x - (box.left + box.width / 2)) / halfWidth, -1, 1) : 0,
          ny: pointer ? clamp((pointer.y - (box.top + box.height / 2)) / halfHeight, -1, 1) : 0,
          turn: easings.easeOutQuint(clamp((clockRef.current - turnRef.current) / TURN_TIME)),
          pointer: pointer !== null,
          // No spin, on a ball that could now take one — see `SPIN`. It was
          // unreachable while the body was a hexagon, and making the body round
          // would have switched a full 360° eye-spin on for every pointer entry
          // into the header button as a side effect of a silhouette change. The
          // entrance turn below is the reaction; the spin is a trick.
          spin: 0,
        }),
        clockRef.current,
      );
      aimingRef.current = true;
    };

    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick);
      const dt = last ? Math.min((ms - last) / 1000, MAX_STEP) : 0;
      last = ms;
      clockRef.current += dt;

      // Tracking wins: both write the same target, and an entrance script is
      // long finished before anyone reaches for the pointer.
      if (follow) aim();
      else if (gaze) engine.setLook(gaze(clockRef.current - gazeSinceRef.current), clockRef.current, SCRIPT_MORPH);

      // The gaze above is updated every frame regardless: it is arithmetic, and
      // holding a target stale would make tracking lag behind the pointer by the
      // sample interval rather than by the engine's own designed inertia.
      if (clockRef.current - sampledAt < minStep) return;
      sampledAt = clockRef.current;
      setLive(engine.sample(clockRef.current));
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [engine, follow, fps, frozen, gaze, shape]);

  /** What is on screen: the still if there is one, otherwise the loop's last frame. */
  const frame = still ?? live;

  /*
   * The three constant fills, hoisted out of the frame.
   *
   * An inline `style={{ fill: ink }}` is a fresh object on every one of sixty
   * renders a second, so React re-diffs a value that has not changed since the
   * theme was chosen. Cheap individually; this is the render path that runs
   * continuously, and the whole art of it is not doing work per frame that does
   * not belong to the frame.
   */
  const inkFill = useMemo(() => ({ fill: ink }), [ink]);
  const eyeFill = useMemo(() => ({ fill: eye }), [eye]);
  const accentFill = useMemo(() => ({ fill: accent }), [accent]);

  /**
   * Depth fog on the burst particles: 0 is gone, 1 is the body's full colour.
   * Handed to `color-mix()` rather than mixed in JS, which is what lets `ink` stay
   * a token.
   *
   * It used to fade towards the surface behind the mascot, which faked a particle
   * seen through it and needed that surface to be declared. Alpha does the same job
   * on any ground — the same reason the eyes stopped being holes.
   */
  const fog = (depth: number | undefined) =>
    depth === undefined ? ink : `color-mix(in srgb, ${ink} ${Math.round(clamp(depth) * 100)}%, transparent)`;

  const dots = (keyPrefix: string) =>
    frame.dots.map((dot, index) =>
      dot.d ? (
        <path
          key={`${keyPrefix}${index}`}
          d={dot.d}
          transform={`translate(${dot.x} ${dot.y}) rotate(${dot.rot ?? 0}) scale(${RAYON})`}
          opacity={dot.opacity}
          style={{ fill: dot.color ?? fog(dot.depth) }}
        />
      ) : (
        <circle
          key={`${keyPrefix}${index}`}
          cx={dot.x}
          cy={dot.y}
          r={dot.r}
          opacity={dot.opacity}
          style={{ fill: dot.color ?? fog(dot.depth) }}
        />
      ),
    );

  return (
    <svg
      ref={svgRef}
      width={size}
      height={size}
      /*
       * The size is also an inline style, and that is not belt-and-braces.
       *
       * `width`/`height` on an <svg> are attributes, and any CSS rule beats an
       * attribute. Button's base class carries
       * `[&_svg:not([class*='size-'])]:size-4`, so dropping a mascot into a button
       * rendered it at 16px however large it was asked to be — its own escape
       * hatch (a `size-*` class on the child) is one this component cannot rely on
       * callers to know about. An inline style outranks the class, so the mascot
       * is the size it was told to be wherever it lands.
       */
      style={{ width: size, height: size }}
      viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`}
      className={cn('shrink-0 overflow-visible', className)}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
        {/*
          The eyes are real holes punched through the body, not shapes laid on top,
          so they clip themselves against the silhouette when they slide towards
          the edge with no cropping code of ours. What shows through them is the
          opaque well below, not the page. The notification pastille's notch is the
          same mechanism.
        */}
        <mask id={maskId} maskUnits="userSpaceOnUse" x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={DEMI_VIEWBOX * 2} height={DEMI_VIEWBOX * 2}>
          <path d={frame.bodyPath} fill="#fff" />
          {frame.eyes.map((eye, index) => (
            <path key={index} d={eye.d} transform={eye.matrix} opacity={eye.alpha} fill="#000" />
          ))}
          {frame.notch && <circle cx={frame.notch.x} cy={frame.notch.y} r={frame.notch.r} fill="#000" />}
        </mask>

        {frame.arcs.map((arc) => (
          <linearGradient
            key={arc.id}
            id={`${uid}-${arc.id}`}
            gradientUnits="userSpaceOnUse"
            x1={arc.grad.x1}
            y1={arc.grad.y1}
            x2={arc.grad.x2}
            y2={arc.grad.y2}
          >
            {arc.grad.stops.map((color, index) => (
              <stop key={index} offset={index / (arc.grad.stops.length - 1)} stopColor={color} />
            ))}
          </linearGradient>
        ))}
      </defs>

      {/* back half of the orbits: drawn before the body, so the body occludes it */}
      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path key={arc.id} d={arc.back} stroke={`url(#${uid}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />
        ))}
      </g>

      {/* burst particles pass behind the core */}
      {frame.dotsBehind && <g>{dots('pb')}</g>}

      <g opacity={frame.bodyAlpha}>
        {/*
          The eye wells: one opaque layer in the exact shape of the body, under the
          body itself, and the eye holes above are what reveals it.

          It is doing two jobs at once and both are load-bearing. It is the eye
          material — which is why the eyes are the same colour whatever the mascot
          is sitting on — and it is the occluder: the back half of the rings above
          is drawn behind the body on purpose, and without something opaque here a
          ring passing behind the ball reappears *inside* the eyes.
        */}
        <path d={frame.bodyPath} style={eyeFill} />
        <g mask={`url(#${maskId})`}>
          <rect x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={DEMI_VIEWBOX * 2} height={DEMI_VIEWBOX * 2} style={inkFill} />
        </g>
      </g>

      {!frame.dotsBehind && <g>{dots('pf')}</g>}

      {frame.notif && <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} style={accentFill} />}

      {/* front half of the orbits */}
      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path key={arc.id} d={arc.front} stroke={`url(#${uid}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />
        ))}
      </g>
    </svg>
  );
}
