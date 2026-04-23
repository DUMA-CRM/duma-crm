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
    <div className={cn('flex gap-0.5 bg-muted w-fit px-1 py-0.75 rounded-xl border border-border', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-lg text-xs font-bold tracking-widest uppercase px-4 h-8 transition-colors',
            value === opt.value ? 'bg-card text-primary shadow-sm' : 'bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
