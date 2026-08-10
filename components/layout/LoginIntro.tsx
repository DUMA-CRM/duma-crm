'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils/cn';
import { useLoginIntroStore } from '@/stores/loginIntroStore';

/** Size of the mark while it plays centre-screen, in px. */
const MARK_SIZE = 128;
/** The animated SVG's own timeline — keep in step with public/icon-animated.svg. */
const TIMELINE_MS = 2000;
/**
 * Hand over at 76%, not 100%. The SVG's last keyframe (markAbsorb) settles
 * there and the remaining 24% is the mark holding still — dead air that reads as
 * a stall before the flight.
 */
const PLAY_MS = TIMELINE_MS * 0.76;
/** Flight from centre to the sidebar's brand slot. */
const FLIGHT_MS = 1000;
/** The green clears over a slightly longer, gentler curve than the flight. */
const FADE_MS = 820;

/**
 * Post-sign-in intro. A forest curtain fills the viewport, the animated mark
 * plays its reveal centre-screen, then flies into the sidebar's brand slot as
 * the curtain lifts.
 *
 * It works because the animated mark is the same white-plate/green artwork the
 * sidebar uses: the curtain matches --sidebar, so on lg+ the left column simply
 * stays put while the rest of the page fades in, and the flight lands on a
 * pixel-identical static logo — the handover has nothing to see.
 *
 * Split in two so every sign-in gets a fresh Curtain: the outer component stays
 * mounted in the CRM layout, and mounting the inner one resets its timers and
 * flight state (otherwise a second sign-in in the same tab would replay with
 * stale values).
 */
export function LoginIntro() {
  const pending = useLoginIntroStore((s) => s.pending);
  return pending ? <Curtain /> : null;
}

interface Flight {
  dx: number;
  dy: number;
  scale: number;
}

function Curtain() {
  const finish = useLoginIntroStore((s) => s.finish);

  // Measured once: the curtain is fixed and full-screen, and a resize mid-intro
  // isn't worth re-flowing an animation that's about to end.
  const [origin] = useState(() => ({
    left: (window.innerWidth - MARK_SIZE) / 2,
    top: (window.innerHeight - MARK_SIZE) / 2,
  }));
  const [flight, setFlight] = useState<Flight | null>(null);
  const [leaving, setLeaving] = useState(false);
  const landedRef = useRef(false);
  const timers = useRef<number[]>([]);

  /**
   * A fresh URL per intro, because the animation plays exactly once per image
   * *resource* — not per <img> element. Reuse the same URL and the browser hands
   * back the cached instance, which is already parked on its final frame: the
   * mark appears, static, and the reveal never runs. Signing out and back in is
   * enough to hit this. The nonce forces a new SVG document, and with it a new
   * animation from t=0.
   */
  const [nonce] = useState(() => Date.now());

  const land = useCallback(() => {
    if (landedRef.current) return;
    landedRef.current = true;
    setLeaving(true);

    const target = document.querySelector('[data-brand-mark]')?.getBoundingClientRect();
    // Below lg the sidebar is translated off-canvas, so there's no on-screen
    // slot to fly to — the mark just fades where it stands.
    if (target && target.width > 0 && target.left >= 0) {
      setFlight({
        dx: target.left - origin.left,
        dy: target.top - origin.top,
        scale: target.width / MARK_SIZE,
      });
    }

    timers.current.push(window.setTimeout(finish, Math.max(FLIGHT_MS, FADE_MS)));
  }, [finish, origin]);

  useEffect(() => {
    // Reduced motion: no curtain at all. Seconds of blocking animation between
    // someone and their dashboard is exactly what this preference asks us not to do.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    // Any key skips ahead — a full-screen curtain with no way out is a trap if
    // the artwork ever fails to load or paint.
    const onKeyDown = () => land();
    window.addEventListener('keydown', onKeyDown);

    // Backstop in case the image's load event never arrives (cached decodes can
    // skip it): never strand someone behind the curtain.
    timers.current.push(window.setTimeout(land, PLAY_MS + 900));

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      timers.current.forEach((id) => clearTimeout(id));
      timers.current = [];
    };
  }, [finish, land]);

  // Start the clock when the artwork is actually on screen, so the reveal the
  // user sees is the reveal we time against.
  const startClock = () => {
    timers.current.push(window.setTimeout(land, PLAY_MS));
  };

  return (
    // Above the tooltip layer (z-60), the highest thing the app itself draws.
    <div onClick={land} className={cn('fixed inset-0 z-80', leaving && 'pointer-events-none')}>
      {/* Only the green fades. The mark is a sibling, not a child, so it stays
          fully opaque all the way through its flight and lands crisp.
          No delay, and a symmetric ease rather than ease-out: an out-curve dumps
          most of the opacity in the first third, which reads as a snap. */}
      <div
        className={cn('absolute inset-0 bg-sidebar transition-opacity', leaving && 'opacity-0')}
        style={{ transitionDuration: `${FADE_MS}ms`, transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.5, 1)' }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- an <img> keeps the
          SVG's own <style> scoped to it; inlining would leak .mark/.plate/.dot
          and a bare `svg {}` rule into the document. */}
      <img
        src={`/icon-animated.svg?play=${nonce}`}
        alt=""
        width={MARK_SIZE}
        height={MARK_SIZE}
        onLoad={startClock}
        className="fixed will-change-transform"
        style={{
          left: origin.left,
          top: origin.top,
          width: MARK_SIZE,
          height: MARK_SIZE,
          // Origin at the top-left so translate-then-scale puts the mark's
          // corner exactly on the target's corner.
          transformOrigin: '0 0',
          transform: flight ? `translate(${flight.dx}px, ${flight.dy}px) scale(${flight.scale})` : undefined,
          transition: flight ? `transform ${FLIGHT_MS}ms cubic-bezier(0.16, 1, 0.3, 1)` : undefined,
        }}
      />
      <p role="status" className="sr-only">
        Signed in. Opening your workspace.
      </p>
    </div>
  );
}
