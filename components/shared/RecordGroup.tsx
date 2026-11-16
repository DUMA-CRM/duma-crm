'use client';

import { motion } from 'motion/react';

import { SECTION_RISE } from '@/components/settings/SettingsSection';

/**
 * A titled list as the audit log draws one: the heading on the page, the rows
 * (a `RecordList`) as the only card beneath it — not a card around a card.
 * The footnote, when there is one, sits under the list.
 */
export function RecordGroup({
  id,
  title,
  actions,
  footnote,
  card = false,
  children,
}: {
  id: string;
  title: string;
  actions?: React.ReactNode;
  footnote?: React.ReactNode;
  /** Wrap rows that aren't a list (settings rows) in the one card, padded like a settings section. */
  card?: boolean;
  children: React.ReactNode;
}) {
  return (
    <motion.section variants={SECTION_RISE} aria-labelledby={`${id}-title`} id={id} className="min-w-0 scroll-mt-6">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-3 px-1">
        <h2 id={`${id}-title`} className="text-base font-semibold tracking-title text-heading">
          {title}
        </h2>
        {actions}
      </div>
      {card ? <div className="rounded-lg border border-border bg-card px-5 py-4 shadow-sm">{children}</div> : children}
      {footnote && <p className="mt-2 px-1 text-xs leading-relaxed text-muted-foreground">{footnote}</p>}
    </motion.section>
  );
}
