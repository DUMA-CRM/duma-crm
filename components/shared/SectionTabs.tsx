'use client';

import type { IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

export interface SectionTab<T extends string> {
  value: T;
  label: string;
  icon?: IconComponent;
  /** Count pill after the label — hidden when 0 or undefined. */
  count?: number;
  /** Tint for the count pill. Use `danger` for counts that need attention (failures). */
  countTone?: 'default' | 'danger';
  /** Spoken/hover description of the count, e.g. "2 failed emails". */
  countLabel?: string;
}

/**
 * Underline tab bar for the section nav of a full-page view. Pass it to
 * `EditorShell`'s `subheader` so it pins below the header and above the body.
 */
export function SectionTabs<T extends string>({
  tabs,
  value,
  onChange,
  ariaLabel,
}: {
  tabs: SectionTab<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    // px matches the app header's px-3 md:px-6 so tabs, masthead and body all
    // sit on one left edge.
    <nav className="border-b border-rule/70 bg-band/70 px-3 pt-2 md:px-6 overflow-x-auto shrink-0" aria-label={ariaLabel}>
      <div className="flex min-w-max gap-1" role="tablist">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = value === tab.value;
          return (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.value)}
              className={cn(
                'h-10 px-3 md:px-4 -mb-px rounded-t-md border border-transparent flex items-center gap-2 text-sm font-semibold transition-colors',
                active
                  ? 'border-rule/70 border-b-card bg-card text-foreground'
                  : 'text-muted-foreground hover:bg-card/45 hover:text-foreground',
              )}
            >
              {Icon && <Icon size={15} aria-hidden="true" />}
              {tab.label}
              {!!tab.count && (
                <span
                  title={tab.countLabel}
                  aria-label={tab.countLabel}
                  className={cn(
                    'h-5 min-w-5 px-1.5 rounded-sm flex items-center justify-center text-label font-semibold tabular-nums',
                    tab.countTone === 'danger'
                      ? 'bg-destructive/6 text-destructive'
                      : active
                        ? 'bg-band text-primary'
                        : 'bg-muted text-muted-foreground',
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
