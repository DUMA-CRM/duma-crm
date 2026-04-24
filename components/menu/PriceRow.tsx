import { Save } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { cn } from '@/lib/utils';

export function PriceRow({
  name,
  sub,
  basePriceLabel,
  enabled,
  price,
  onEnabledChange,
  onPriceChange,
  onSave,
  isSaving,
  isDirty,
}: {
  name: string;
  sub: string;
  basePriceLabel: string;
  enabled: boolean;
  price: string;
  onEnabledChange: (v: boolean) => void;
  onPriceChange: (v: string) => void;
  onSave: () => void;
  isSaving: boolean;
  isDirty: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3 rounded-xl border transition-colors',
        enabled ? 'bg-card border-border' : 'bg-muted/30 border-border/50',
      )}
    >
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-semibold truncate', enabled ? 'text-foreground' : 'text-muted-foreground')}>{name}</p>
        <p className="text-xs text-muted-foreground">
          {sub} · base {basePriceLabel}
        </p>
      </div>
      {/* Toggle */}
      <label className="relative inline-flex items-center cursor-pointer shrink-0">
        <input type="checkbox" className="sr-only peer" checked={enabled} onChange={(e) => onEnabledChange(e.target.checked)} />
        <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-primary transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-4" />
      </label>
      <div>
        <Input
          leftIcon="£"
          type="text"
          value={price}
          onChange={(e) => onPriceChange(e.target.value)}
          disabled={!enabled}
          pattern="^-?\d+(\.\d{1,2})?$"
          className="w-28 shrink-0"
        />
      </div>
      <Button size="icon" onClick={onSave} disabled={!isDirty || isSaving} variant={isDirty ? 'default' : 'outline'} aria-label="Save">
        <Save size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}
