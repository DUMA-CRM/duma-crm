import { cn } from '@/lib/utils/cn';

interface OptionBtnProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function OptionBtn({ label, active, onClick }: OptionBtnProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-4 py-1.5 rounded-md text-sm font-semibold border transition-colors',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
