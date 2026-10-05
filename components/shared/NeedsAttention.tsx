'use client';

import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { AlertTriangle, CheckCircle2, ChevronDown } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils/cn';

/*
 * The folded "needs you" card from Inventory → Stock and Menu → Items: one line
 * saying how many things and which, opening to a bordered row per thing, each
 * with its own fix. Lifted here so every workspace shows it the same way.
 */

/** `info` is for something worth knowing that nothing depends on — the staff overview's third severity. */
export type NeedsAttentionTone = 'exception' | 'measured' | 'info';

export interface NeedsAttentionItem {
  key: string;
  tone: NeedsAttentionTone;
  icon: IconComponent;
  /** Replaces the icon tile with the thing itself (a menu item's photo). */
  image?: string | null;
  title: string;
  detail?: string;
  /** The fix for this row — a link or an in-place action. */
  fix?: { label: string; href?: string; run?: () => void };
}

const TILE: Record<NeedsAttentionTone, string> = {
  exception: 'bg-exception/8 text-exception',
  measured: 'bg-measured/10 text-measured',
  info: 'bg-primary/8 text-primary',
};

export function NeedsAttention({
  items,
  label = 'Needs attention',
  summary,
  icon: SummaryIcon = AlertTriangle,
  clear,
  className,
}: {
  items: NeedsAttentionItem[];
  /** Accessible name of the card. */
  label?: string;
  /** The folded line; defaults to "N things need you". */
  summary?: string;
  icon?: IconComponent;
  /** Shown when nothing needs anyone. Omit to render nothing instead. */
  clear?: { title: string; detail?: string };
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const [open, setOpen] = useState(false);

  if (items.length === 0) {
    if (!clear) return null;
    return (
      <motion.section
        variants={SECTION_RISE}
        className={cn('flex items-center gap-3 rounded-lg border border-rule/60 bg-field px-4 py-3.5', className)}
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-momentum/10 text-momentum">
          <CheckCircle2 size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-foreground">{clear.title}</span>
          {clear.detail && <span className="block text-xs text-muted-foreground">{clear.detail}</span>}
        </span>
      </motion.section>
    );
  }

  const worst: NeedsAttentionTone = items.some((item) => item.tone === 'exception')
    ? 'exception'
    : items.some((item) => item.tone === 'measured')
      ? 'measured'
      : 'info';
  return (
    <motion.section
      variants={SECTION_RISE}
      aria-label={label}
      className={cn('overflow-hidden rounded-lg border border-rule/60 bg-field', className)}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-band/40"
      >
        <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', TILE[worst])}>
          <SummaryIcon size={18} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-foreground">
            {summary ?? `${items.length} ${items.length === 1 ? 'thing needs' : 'things need'} you`}
          </span>
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">{items.map((item) => item.title).join(' · ')}</span>
        </span>
        <span className="shrink-0 text-xs font-semibold text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
        <ChevronDown
          size={15}
          aria-hidden="true"
          className={cn('shrink-0 text-muted-foreground transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            animate={reduceMotion ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: 0.26, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden border-t border-rule/50"
          >
            <ul className="space-y-2 p-2">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.key}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border bg-background/60 px-3.5 py-3',
                      item.tone === 'exception' ? 'border-exception/35' : 'border-rule/60',
                    )}
                  >
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt="" className="size-10 shrink-0 rounded-md bg-band object-cover" />
                    ) : (
                      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-md', TILE[item.tone])}>
                        <Icon size={18} aria-hidden="true" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                      {item.detail && <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">{item.detail}</span>}
                    </span>
                    {item.fix &&
                      (item.fix.href ? (
                        <Button asChild variant="outline" size="sm">
                          <Link href={item.fix.href}>{item.fix.label}</Link>
                        </Button>
                      ) : (
                        <Button variant="outline" size="sm" onClick={item.fix.run}>
                          {item.fix.label}
                        </Button>
                      ))}
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}
