import { cn } from '@/lib/utils/cn';

export interface SegmentedOption<T extends string = string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string = string> {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function SegmentedControl<T extends string>({ options, value, onChange, className }: SegmentedControlProps<T>) {
  return (
    <div className={cn('flex items-center gap-0.5 bg-muted w-fit max-w-full min-w-0 px-1 h-9 rounded-xl border border-border overflow-x-auto', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'shrink-0 rounded-lg text-xs font-bold tracking-widest uppercase px-4 h-7 transition-colors',
            value === opt.value ? 'bg-card text-primary shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
