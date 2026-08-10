import { cn } from '@/lib/utils/cn';

/**
 * A settings plate: a labelled band strip over a porcelain field of controls.
 *
 * The strip is the same Board Band the tables and the context workbench use, so
 * a settings page reads as a stack of labelled plates on the board — not as a
 * grid of cards with a tinted glyph and a sentence in the header. The
 * explanation belongs with the controls it explains, so it sits at the top of
 * the body rather than in the label.
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
  title: string;
  /** Why the controls exist / what they affect. Rendered above them, not in the label strip. */
  description?: React.ReactNode;
  /** Controls pinned to the right of the label strip (e.g. a New button). */
  actions?: React.ReactNode;
  /** A closing caveat — scope, storage, or a limitation. Rendered as a foot rule. */
  footnote?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn('overflow-hidden rounded-lg border border-rule/65 bg-card', className)}>
      <div className="flex min-h-11 items-center gap-3 border-b border-rule/55 bg-band/55 px-4 py-2">
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold tracking-title text-foreground">{title}</h2>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      <div className={cn('px-4 py-4 md:px-5', bodyClassName)}>
        {description && <p className="mb-4 max-w-[68ch] text-sm leading-relaxed text-muted-foreground">{description}</p>}
        {children}
      </div>

      {footnote && (
        <p className="border-t border-rule/45 bg-band/55 px-4 py-2 text-xs leading-relaxed text-muted-foreground md:px-5">{footnote}</p>
      )}
    </section>
  );
}
