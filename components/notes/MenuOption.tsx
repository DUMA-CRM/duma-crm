import { Check, type IconComponent } from '@/components/icons';

import { cn } from '@/lib/utils/cn';

/** Clicking an option leaves the focus where it was — in the editor, or on the canvas. */
const keepFocus = (event: React.MouseEvent) => event.preventDefault();

/** One choice in a note's small menus: an icon, a label, an optional hint and tick. */
export function MenuOption({
  icon: Icon,
  label,
  hint,
  selected,
  onSelect,
  className,
}: {
  icon: IconComponent;
  label: string;
  hint?: string;
  selected?: boolean;
  onSelect: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onMouseDown={keepFocus}
      onClick={onSelect}
      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm text-foreground transition-colors hover:bg-band focus-visible:outline-2 focus-visible:outline-ring"
    >
      <Icon size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate', className)}>{label}</span>
        {hint && <span className="block truncate text-xs text-muted-foreground">{hint}</span>}
      </span>
      {selected && <Check size={14} className="shrink-0 text-primary" aria-hidden="true" />}
    </button>
  );
}
