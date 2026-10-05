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

import styles from './Mascot.module.css';

export type MascotFeeling = 'neutral' | 'happy' | 'angry' | 'curious' | 'sad';

export interface MascotProps {
  feeling?: MascotFeeling;
  gesture?: 'wave' | 'celebrate';
  gestureKey?: string | number;

  size?: number;

  state?: StateId;

  expression?: ExpressionId;

  shape?: ShapeId;

  ink?: string;

  eye?: string;

  accent?: string;

  follow?: boolean;

  gaze?: GazeScript | null;

  frozenAt?: number;

  fps?: number;

  label?: string;
  className?: string;
}

const MAX_STEP = 0.064;

const SCRIPT_MORPH = 1 / 60;

export function Mascot({
  size = 40,
  state = 'idle',
  expression = 'neutre',
  shape = 'hexagone',
  feeling = 'neutral',
  gesture,
  gestureKey,
  ink = 'var(--mascot-ink)',
  eye = 'var(--mascot-eye)',
  accent = 'var(--mascot-accent)',
  follow: followPointer = false,
  gaze = null,
  frozenAt,
  fps = 30,
  label,
  className,
}: MascotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const follow = followPointer;

  const radii = useMemo(() => {
    const profile = SHAPE_BY_ID.get(shape)?.radii;
    // Blend a little circle into the polygon: six soft corners, never a rigid badge.
    return profile ? (shape === 'hexagone' ? profile.map((radius) => radius * 0.78 + 0.22) : profile) : null;
  }, [shape]);
  const mood = useMemo(() => {
    const base = EXPRESSION_BY_ID.get(expression);
    return base ?? null;
  }, [expression]);

  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const maskId = `mascot-mask-${uid}`;

  const [engine] = useState(() => new BotEngine(RAYON, state, radii, mood));

  const clockRef = useRef(0);

  const pointerRef = useRef<{ x: number; y: number } | null>(null);

  const boxRef = useRef<DOMRect | null>(null);
  const staleBoxRef = useRef(true);

  const turnRef = useRef(0);

  const aimingRef = useRef(false);

  const gazeSinceRef = useRef(0);

  const [live, setLive] = useState<BotFrame>(() => engine.sample(frozenAt ?? 0));

  const [animate, setAnimate] = useState(false);
  const frozen = frozenAt !== undefined || !animate;

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || frozenAt !== undefined) return;

    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let visible = true;

    const sync = () => setAnimate(visible && !motion.matches && !document.hidden);

    // An off-screen mascot still costs a path rebuild and a React commit per
    // frame, and the launcher's lives in a header that scrolls away.
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    observer.observe(svg);
    motion.addEventListener('change', sync);
    document.addEventListener('visibilitychange', sync);
    sync();

    return () => {
      observer.disconnect();
      motion.removeEventListener('change', sync);
      document.removeEventListener('visibilitychange', sync);
    };
  }, [frozenAt]);

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

  const still = useMemo(
    () => (frozen ? new BotEngine(RAYON, state, radii, mood).sample(frozenAt ?? POSES[state]) : null),
    [frozen, frozenAt, mood, radii, state],
  );

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

    const minStep = fps ? 1 / fps : 0;

    let sampledAt = -Infinity;

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

  const frame = still ?? live;

  const tint =
    feeling === 'happy'
      ? 'var(--momentum)'
      : feeling === 'angry'
        ? 'var(--exception)'
        : feeling === 'curious'
          ? 'var(--reference)'
          : feeling === 'sad'
            ? 'var(--ink-2)'
            : ink;
  const bodyInk = feeling === 'neutral' ? ink : `color-mix(in srgb, ${ink} ${feeling === 'angry' ? 35 : 64}%, ${tint})`;
  const inkFill = useMemo(() => ({ fill: bodyInk, transition: 'fill 600ms ease' }), [bodyInk]);
  const eyeFill = useMemo(() => ({ fill: eye }), [eye]);
  const accentFill = useMemo(() => ({ fill: accent }), [accent]);

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
      style={{ width: size, height: size }}
      viewBox={`${-DEMI_VIEWBOX} ${-DEMI_VIEWBOX} ${DEMI_VIEWBOX * 2} ${DEMI_VIEWBOX * 2}`}
      className={cn('shrink-0 overflow-visible', styles.mascot, className)}
      data-feeling={feeling}
      data-paused={frozen ? 'true' : undefined}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <defs>
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

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path key={arc.id} d={arc.back} stroke={`url(#${uid}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />
        ))}
      </g>

      {frame.dotsBehind && <g>{dots('pb')}</g>}

      <g opacity={frame.bodyAlpha}>
        <path d={frame.bodyPath} style={eyeFill} />
        <g mask={`url(#${maskId})`}>
          <rect x={-DEMI_VIEWBOX} y={-DEMI_VIEWBOX} width={DEMI_VIEWBOX * 2} height={DEMI_VIEWBOX * 2} style={inkFill} />
        </g>
      </g>

      {!frame.dotsBehind && <g>{dots('pf')}</g>}

      {frame.notif && <circle cx={frame.notif.x} cy={frame.notif.y} r={frame.notif.r} style={accentFill} />}

      <g fill="none" strokeLinecap="round">
        {frame.arcs.map((arc) => (
          <path key={arc.id} d={arc.front} stroke={`url(#${uid}-${arc.id})`} strokeWidth={arc.width} opacity={arc.opacity} />
        ))}
      </g>
      {gesture && (
        <g
          key={gestureKey}
          className={styles.gesture}
          data-gesture={gesture}
          style={{ color: bodyInk }}
          fill="none"
          stroke="currentColor"
          strokeWidth="9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path className={styles.arm} d="M94 39 C111 42 126 26 129 6" />
          <g className={styles.fingers}>
            <path d="M129 6 L116 -14 M129 6 L129 -22 M129 6 L146 -13" />
          </g>
        </g>
      )}
    </svg>
  );
}
