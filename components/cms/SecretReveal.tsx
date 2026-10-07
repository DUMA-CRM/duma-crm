'use client';

import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useState } from 'react';

import { type IconComponent, TriangleAlert } from '@/components/icons';
import { Modal } from '@/components/shared/Modal';
import { CopyButton, DrawnCheck } from '@/components/ui/action-button';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { scrambleFrame } from '@/lib/utils/motion-feedback';
import { toast } from '@/stores/toastStore';

import { copyText } from './shared';

const SPARKS = 8;
const DECODE_MS = 900;
const DECODE_DELAY_MS = 280;

/**
 * The tile a new secret is minted from: it springs in, two rings ripple out,
 * sparks scatter, and a success badge lands on its corner.
 */
function SecretSeal({ icon: Icon }: { icon: IconComponent }) {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) {
    return (
      <span className="relative flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon size={24} aria-hidden="true" />
        <span className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card">
          <DrawnCheck className="size-3.5" />
        </span>
      </span>
    );
  }

  return (
    <span className="relative flex size-14 items-center justify-center" aria-hidden="true">
      {[0, 0.18].map((delay) => (
        <motion.span
          key={delay}
          className="absolute inset-0 rounded-xl border-2 border-primary/50"
          initial={{ scale: 0.8, opacity: 0.8 }}
          animate={{ scale: 2.1, opacity: 0 }}
          transition={{ duration: 0.9, delay: 0.12 + delay, ease: [0.16, 1, 0.3, 1] }}
        />
      ))}
      {Array.from({ length: SPARKS }, (_, index) => {
        const angle = (index / SPARKS) * Math.PI * 2 + Math.PI / SPARKS;
        return (
          <motion.span
            key={index}
            className="absolute size-1.5 rounded-full bg-primary"
            initial={{ x: 0, y: 0, opacity: 0, scale: 0.4 }}
            animate={{ x: Math.cos(angle) * 46, y: Math.sin(angle) * 46, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
            transition={{ duration: 0.7, delay: 0.16, ease: 'easeOut' }}
          />
        );
      })}
      <motion.span
        className="relative flex size-14 items-center justify-center rounded-xl bg-primary/10 text-primary"
        initial={{ scale: 0.5, rotate: -12, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 17 }}
      >
        <Icon size={24} />
      </motion.span>
      <motion.span
        className="absolute -right-1.5 -bottom-1.5 flex size-6 items-center justify-center rounded-full bg-success text-success-foreground ring-2 ring-card"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 520, damping: 15, delay: 0.38 }}
      >
        <DrawnCheck className="size-3.5" delay={0.5} />
      </motion.span>
    </span>
  );
}

/** Decodes `secret` into place left to right; settles on the real value. */
function useDecodedSecret(secret: string) {
  const reduceMotion = useReducedMotion();
  const [frame, setFrame] = useState(() => scrambleFrame(secret, 0));
  const [decoding, setDecoding] = useState(true);

  useEffect(() => {
    if (reduceMotion) return;
    let raf = 0;
    const start = performance.now() + DECODE_DELAY_MS;
    const tick = (now: number) => {
      const progress = (now - start) / DECODE_MS;
      setFrame(scrambleFrame(secret, progress));
      if (progress < 1) raf = requestAnimationFrame(tick);
      else setDecoding(false);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [secret, reduceMotion]);

  // Reduced motion skips the decode entirely: the secret is simply there.
  return reduceMotion ? { frame: secret, decoding: false } : { frame, decoding };
}

/**
 * Shows a just-minted secret, once. The secret decodes into the field and the
 * copy button answers in place, so the moment of creation feels like one.
 */
export function SecretReveal({
  title,
  label,
  secret,
  warning,
  icon,
  onClose,
}: {
  title: string;
  label: string;
  secret: string;
  warning: string;
  icon: IconComponent;
  onClose: () => void;
}) {
  const { frame, decoding } = useDecodedSecret(secret);

  return (
    <Modal
      title={title}
      onClose={onClose}
      illustration={<SecretSeal icon={icon} />}
      footer={
        <div className="flex justify-end">
          <Button onClick={onClose}>I’ve stored it</Button>
        </div>
      }
    >
      <motion.div
        className="space-y-3"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <p className="flex gap-2 text-sm text-measured">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
        <div className="flex gap-2">
          <Input
            aria-label={label}
            aria-busy={decoding}
            readOnly
            value={frame}
            className={decoding ? 'font-mono text-xs text-muted-foreground' : 'font-mono text-xs'}
            onFocus={(event) => event.target.select()}
          />
          <CopyButton
            onCopy={async () => {
              const copied = await copyText(secret);
              if (!copied) toast('error', 'Copy failed — select the text instead.');
              return copied;
            }}
          />
        </div>
      </motion.div>
    </Modal>
  );
}
