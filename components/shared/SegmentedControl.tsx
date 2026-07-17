import { cn } from '@/lib/utils/cn';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** 'lg' bumps the touch targets — for touch-first screens like the POS. */
  size?: 'default' | 'lg';
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, size = 'default', className }: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        'flex items-center gap-0.5 bg-muted w-fit max-w-full min-w-0 px-1 rounded-xl border border-border overflow-x-auto',
        size === 'lg' ? 'h-11' : 'h-9',
        className,
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'shrink-0 rounded-lg text-xs font-bold tracking-widest uppercase px-4 transition-colors',
            size === 'lg' ? 'h-9' : 'h-7',
            value === opt.value ? 'bg-card text-primary shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
