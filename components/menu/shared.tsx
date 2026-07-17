// Shared constants and small helpers for menu components.
import { cn } from '@/lib/utils/cn';
import { MenuCategory } from '@/types/menu';

export const CATEGORY_COLORS: Record<MenuCategory, string> = {
  coffee: 'bg-warning/10 text-warning',
  'other-hot-drinks': 'bg-info/10 text-info',
  'coffee-over-ice': 'bg-primary/10 text-primary',
  tea: 'bg-success/10 text-success',
  snacks: 'bg-muted text-muted-foreground',
};

export const CATEGORY_LABELS: Record<MenuCategory, string> = {
  coffee: 'Coffee',
  'other-hot-drinks': 'Hot Drinks',
  'coffee-over-ice': 'Iced',
  tea: 'Tea',
  snacks: 'Snacks',
};

export const CATEGORY_OPTIONS = Object.entries(CATEGORY_LABELS) as [MenuCategory, string][];

export const inputClass =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

export const selectClass =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150 cursor-pointer';

export const labelClass = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

/**
 * Status pill that doubles as a one-tap availability toggle — hiding a
 * sold-out item shouldn't require opening the edit modal.
 */
export function AvailabilityToggle({ on, pending, onToggle }: { on: boolean; pending?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={pending}
      aria-pressed={on}
      title={on ? 'Tap to hide from the POS' : 'Tap to make available'}
      className={cn(
        'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-bold uppercase tracking-wide transition-all active:translate-y-px disabled:opacity-50',
        on
          ? 'bg-success/10 text-success border-success/30 hover:bg-success/20'
          : 'bg-muted text-muted-foreground border-border hover:text-foreground',
      )}
    >
      <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', on ? 'bg-success' : 'bg-muted-foreground')} />
      {on ? 'Available' : 'Hidden'}
    </button>
  );
}

export function FormActions({ onClose, isPending, isEdit }: { onClose: () => void; isPending: boolean; isEdit?: boolean }) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onClose}
        className="flex-1 h-10 border border-border rounded-xl text-sm font-medium text-muted-foreground hover:bg-surface-offset transition-colors"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="flex-1 h-10 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? 'Saving…' : isEdit ? 'Update' : 'Create'}
      </button>
    </div>
  );
}
