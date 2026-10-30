'use client';

import { useEffect, useState } from 'react';

import { Mascot, type MascotProps } from '@/components/ai/Mascot';

import type { ShapeId } from '@/lib/mascot/engine/skins';

/** The silhouettes it moves between, in order: circle, square, hexagon, triangle. */
const SHAPES: ShapeId[] = ['cercle', 'squircle', 'hexagone', 'triangle'];

const MIN_MS = 5000;
const MAX_MS = 10000;

/**
 * The marketing mascot, changing body shape every five to ten seconds. The
 * engine morphs between silhouettes itself when `shape` changes, so this only
 * picks the next one on a randomised timer. Used once, in the home page's
 * setup band. Holds still for visitors who ask for reduced motion.
 */
export function ShapeShiftingMascot(props: Omit<MascotProps, 'shape'>) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer: number;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          setIndex((current) => (current + 1) % SHAPES.length);
          schedule();
        },
        MIN_MS + Math.random() * (MAX_MS - MIN_MS),
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return <Mascot {...props} shape={SHAPES[index]} />;
}
