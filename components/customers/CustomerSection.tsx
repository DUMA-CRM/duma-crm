'use client';

import { ChevronDown } from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';

import { cn } from '@/lib/utils/cn';

/** A compact disclosure that keeps its content mounted, including unfinished notes. */
export function CustomerSection({
  collapsible,
  defaultOpen = false,
  ...props
}: React.ComponentProps<typeof SettingsSection> & { collapsible?: boolean; defaultOpen?: boolean }) {
  if (!collapsible) return <SettingsSection {...props} />;
  const { title, description, actions, children, footnote, className, bodyClassName } = props;
  return (
    <details open={defaultOpen} className={cn('group/customer-section min-w-0 rounded-lg border border-rule/60 bg-field', className)}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">{title}</span>
        {actions}
        <ChevronDown
          size={15}
          aria-hidden="true"
          className="shrink-0 text-muted-foreground transition-transform group-open/customer-section:rotate-180"
        />
      </summary>
      {description && <p className="px-4 pb-3 text-xs leading-relaxed text-muted-foreground">{description}</p>}
      <div className={cn('px-4 pb-4', bodyClassName)}>{children}</div>
      {footnote && <p className="px-4 pb-4 text-xs leading-relaxed text-muted-foreground">{footnote}</p>}
    </details>
  );
}

/** Groups existing cards without putting another card around them. */
export function CustomerDisclosure({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="group/customer-disclosure">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-md px-1 text-sm font-semibold text-foreground focus-visible:outline-2 focus-visible:outline-ring [&::-webkit-details-marker]:hidden">
        {title}
        <ChevronDown
          size={15}
          aria-hidden="true"
          className="text-muted-foreground transition-transform group-open/customer-disclosure:rotate-180"
        />
      </summary>
      <div className="space-y-3 pt-2">{children}</div>
    </details>
  );
}
