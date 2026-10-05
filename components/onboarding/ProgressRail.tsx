'use client';

import { motion, useReducedMotion } from 'motion/react';

import { type FlowProgress, SECTIONS } from '@/lib/onboarding/flow';

/**
 * One segment per section rather than a dot per question: the question count
 * changes with the answers, and a row of 20 dots that grows and shrinks reads
 * as the finish line moving. The section name sits above each question instead.
 */
export function ProgressRail({ progress }: { progress: FlowProgress }) {
  const reduceMotion = useReducedMotion();
  return (
    <div className="w-full">
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress.overall * 100)}
        aria-valuetext={`${SECTIONS.find((section) => section.id === progress.activeSection)?.label ?? 'Setup'}, ${Math.round(progress.overall * 100)}% complete, about ${progress.minutesLeft} minute${progress.minutesLeft === 1 ? '' : 's'} left`}
        className="grid grid-cols-4 gap-1.5"
      >
        {SECTIONS.map((section, index) => (
          <div key={section.id} className="h-1 overflow-hidden rounded-full bg-band">
            <motion.div
              className="h-full rounded-full bg-primary"
              initial={false}
              animate={{ width: `${progress.sections[index] * 100}%` }}
              transition={reduceMotion ? { duration: 0 } : { duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
