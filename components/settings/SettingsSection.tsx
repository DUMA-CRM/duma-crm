'use client';

import { motion } from 'motion/react';

import { cn } from '@/lib/utils/cn';

/** Shared with the tab body so sections rise in one after another. */
export const SECTION_RISE = {
  hidden: { opacity: 0, y: 10 },
  shown: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] as const } },
};

/**
 * A settings panel: title and the reason it exists at the top, the controls
 * below, and an optional caveat at the foot. Same porcelain field and hairline
 * as the onboarding cards, so the two read as one product.
 *
 * It carries the rise variant but no initial/animate of its own: inside a
 * SettingsTabBody it staggers in with its siblings, anywhere else it simply
 * renders.
 */
export function SettingsSection({
  title,
  description,
  actions,
  footnote,
  children,
  className,
  bodyClassName,
}: {
  /** Omit for a panel whose content introduces itself (the profile card). */
  title?: string;
  /** Why the controls exist / what they affect. */
  description?: React.ReactNode;
  /** Controls pinned to the right of the title (e.g. a New button). */
  actions?: React.ReactNode;
  /** A closing caveat — scope, storage, or a limitation. */
  footnote?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <motion.section variants={SECTION_RISE} className={cn('rounded-lg border border-rule/60 bg-field', className)}>
      {(title || description || actions) && (
        <header className="flex items-start gap-4 px-5 pt-5">
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-base font-semibold tracking-title text-foreground">{title}</h2>}
            {description && <p className="mt-1 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}

      <div className={cn('px-5 pb-5', title || description || actions ? 'pt-4' : 'pt-5', bodyClassName)}>{children}</div>

      {footnote && <p className="border-t border-rule/40 px-5 py-3 text-xs leading-relaxed text-muted-foreground">{footnote}</p>}
    </motion.section>
  );
}
