'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { AppleHelloEffectEnglish } from '@/components/apple-hello-effect-english';
import { ArrowRight } from '@/components/icons';
import { Button } from '@/components/ui/button';

const EASE = [0.16, 1, 0.3, 1] as const;
/** Only a backstop: the hello hands over through onAnimationComplete. */
const BACKSTOP_MS = 5000;

const rise = { hidden: { opacity: 0, y: 12 }, shown: { opacity: 1, y: 0, transition: { duration: 0.5, ease: EASE } } };

/**
 * The handwritten "hello" plays on its own, then gives way: AnimatePresence
 * waits for its exit before the pitch arrives in the same spot. Any key or click
 * skips ahead, because nobody should have to sit through an animation to begin.
 */
export function WelcomeStep({ resuming, onStart }: { resuming: boolean; onStart: () => void }) {
  const reduceMotion = useReducedMotion();
  const [greeted, setGreeted] = useState(false);
  // Returning owners have already seen it; reduced motion asked not to.
  const ready = greeted || resuming || reduceMotion === true;

  useEffect(() => {
    if (ready) return;
    const skip = () => setGreeted(true);
    const timer = window.setTimeout(skip, BACKSTOP_MS);
    window.addEventListener('keydown', skip, { once: true });
    window.addEventListener('pointerdown', skip, { once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('keydown', skip);
      window.removeEventListener('pointerdown', skip);
    };
  }, [ready]);

  return (
    <div className="flex min-h-88 flex-col items-center justify-center text-center">
      <AnimatePresence mode="wait">
        {!ready ? (
          <AppleHelloEffectEnglish
            key="hello"
            className="h-20 text-primary sm:h-28"
            onAnimationComplete={() => setGreeted(true)}
            aria-hidden="true"
          />
        ) : (
          <motion.div
            key="pitch"
            className="flex flex-col items-center"
            initial="hidden"
            animate="shown"
            variants={{ shown: { transition: { staggerChildren: 0.08 } } }}
          >
            <motion.h1
              variants={rise}
              className="max-w-[20ch] text-3xl font-semibold leading-[1.1] tracking-display text-foreground sm:text-4xl"
            >
              {resuming ? 'Welcome back. Let’s pick up where you left off.' : 'Let’s set up your business.'}
            </motion.h1>
            <motion.p variants={rise} className="mt-4 max-w-[46ch] text-sm leading-6 text-muted-foreground">
              A few questions about how you trade, one at a time. We’ll suggest the tools that fit, then open your workspace.
              Your answers are saved on this device as you go.
            </motion.p>
            <motion.div variants={rise} className="mt-8 flex flex-col items-center gap-4">
              <Button size="lg" onClick={onStart} autoFocus className="h-11 min-w-44 gap-2 px-5">
                {resuming ? 'Continue' : 'Get started'}
                <ArrowRight aria-hidden="true" />
              </Button>
              <p className="text-xs text-muted-foreground">
                Already use DUMA?{' '}
                <Link href="/sign-in" className="font-semibold text-primary transition-colors hover:text-primary-hover">
                  Sign in
                </Link>
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
