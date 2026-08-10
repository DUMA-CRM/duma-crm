import type { IconComponent } from '@/components/icons';

interface EmptyStateProps {
  icon: IconComponent;
  title: string;
  description?: string;
}

/* An empty region on a plot: a boxed glyph and a plain statement. Deliberately
   quiet — an empty order list at 6am is a normal reading, not an error.

   The description used to be `text-muted-foreground/60`, which measured 2.00:1
   and was the worst contrast pair in the application. It is full-strength now;
   the tier below the secondary ink does not exist in this system. */
export function EmptyState({ icon: Icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-md bg-band text-muted-foreground">
        <Icon size={22} />
      </div>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {description && <p className="mt-1.5 max-w-[60ch] text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>
  );
}
