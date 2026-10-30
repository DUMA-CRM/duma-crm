import { cn } from '@/lib/utils/cn';

/**
 * The docs' one-of-several switch: a .mkt-card the height of the search box,
 * the chosen option filled with the .mkt-tag grey. Inner corners are the
 * card's 10px less its 4px padding, so the two radii nest.
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  label: string;
  options: readonly { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={cn('mkt-card flex min-h-11 w-fit max-w-full gap-0.5 overflow-x-auto p-1', className)}>
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={cn(
            'flex shrink-0 items-center gap-1.5 rounded-[6px] px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
            value === option.id
              ? 'bg-[color-mix(in_oklab,var(--ink)_7%,transparent)] text-[var(--mkt-heading)]'
              : 'text-[var(--mkt-ink-2)] hover:bg-[color-mix(in_oklab,var(--ink)_4%,transparent)] hover:text-[var(--mkt-heading)]',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
