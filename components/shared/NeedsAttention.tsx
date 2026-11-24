'use client';

import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { ArrowRight } from '@/components/icons';
import type { IconComponent } from '@/components/icons';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { CARD_SURFACE } from '@/components/shared/surface';

import { cn } from '@/lib/utils/cn';

/*
 * What needs someone, on any workspace, shown the same way everywhere.
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

/** The icon tile carries the urgency — a problem, a warning, or something worth knowing — as on Fact tiles. */
const TILE: Record<NeedsAttentionTone, string> = {
  exception: 'bg-exception/12 text-exception',
  measured: 'bg-measured/14 text-measured',
  info: 'bg-primary/10 text-primary',
};

/** Rows shown before "Show N more": enough to act on, short enough to scan. */
const VISIBLE = 4;

const fixClass =
  'inline-flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-sm font-semibold text-primary pointer-coarse:h-11 pointer-coarse:px-3 transition-colors hover:bg-primary/8 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring';

/**
 * A compact stack of strips, one per thing that needs someone: the icon on a
 * tile in its urgency colour, one line saying what (title · detail), and the
 * fix as a quiet button on the right. A hairline between strips, no heading —
 * the strips say it.
 */
export function NeedsAttention({
  items,
  label = 'Needs attention',
  className,
}: {
  items: NeedsAttentionItem[];
  /** Accessible name of the block. */
  label?: string;
  /** Kept for callers; the strips speak for themselves, so no heading is drawn. */
  summary?: string;
  icon?: IconComponent;
  className?: string;
}) {
  const [showAll, setShowAll] = useState(false);

  // Attention is only shown when there is something to act on.
  if (items.length === 0) return null;

  const shown = showAll ? items : items.slice(0, VISIBLE);
  const hidden = items.length - VISIBLE;

  return (
    <motion.section
      variants={SECTION_RISE}
      aria-label={label}
      className={cn(CARD_SURFACE, className)}
    >
      <ul className="divide-y divide-border">
        {shown.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.key} className="flex min-h-14 items-center gap-3 py-2.5 pr-2.5 pl-3">
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt="" className="size-9 shrink-0 rounded-md bg-band object-cover" />
              ) : (
                <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', TILE[item.tone])}>
                  <Icon size={18} aria-hidden="true" />
                </span>
              )}
              <p className="min-w-0 flex-1 line-clamp-2 text-sm sm:line-clamp-none sm:truncate" title={item.detail ? `${item.title} · ${item.detail}` : item.title}>
                <span className="font-medium text-heading">{item.title}</span>
                {item.detail && <span className="text-muted-foreground"> · {item.detail}</span>}
              </p>
              {item.fix &&
                (item.fix.href ? (
                  <Link href={item.fix.href} className={fixClass}>
                    {item.fix.label}
                    <ArrowRight size={14} aria-hidden="true" />
                  </Link>
                ) : (
                  <button type="button" onClick={item.fix.run} className={fixClass}>
                    {item.fix.label}
                    <ArrowRight size={14} aria-hidden="true" />
                  </button>
                ))}
            </li>
          );
        })}
      </ul>

      {hidden > 0 && (
        <button
          type="button"
          onClick={() => setShowAll((current) => !current)}
          aria-expanded={showAll}
          className="w-full border-t border-border px-4 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-band/40 hover:text-foreground focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          {showAll ? 'Show less' : `Show ${hidden} more`}
        </button>
      )}
    </motion.section>
  );
}
