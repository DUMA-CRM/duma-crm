import { X } from 'lucide-react';
import Image from 'next/image';

import { OptionBtn, OptionGroup } from '@/components/pos/Option';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';

import { groupByCategory } from '@/lib/utils/modifiers';
import type { MenuItem, MenuOption } from '@/types/pos';

interface ItemCustomiserProps {
  item: MenuItem;
  pending: MenuOption[];
  setPending: React.Dispatch<React.SetStateAction<MenuOption[]>>;
  onAdd: () => void;
  onCancel: () => void;
}

/**
 * Full-panel customiser — takes over the whole order panel while an item is
 * selected, so the options get the full height and the add button is always
 * visible without scrolling.
 */
export function ItemCustomiser({ item, pending, setPending, onAdd, onCancel }: ItemCustomiserProps) {
  const optionsTotal = pending.reduce((sum, opt) => sum + opt.price, 0);
  const price = item.price + optionsTotal;

  // Categorised modifiers are single-select (picking one replaces any other in the
  // same category); uncategorised add-ons stay multi-select. Clicking an active
  // option always deselects it.
  const select = (opt: MenuOption) =>
    setPending((prev) => {
      if (prev.some((o) => o.id === opt.id)) return prev.filter((o) => o.id !== opt.id);
      if (opt.category) return [...prev.filter((o) => o.category !== opt.category), opt];
      return [...prev, opt];
    });

  const groups = groupByCategory(item.modifiers, (o) => o.category ?? null);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Item header */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-border shrink-0">
        <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
          {item.image ? (
            <Image width={48} height={48} src={item.image} alt={item.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground opacity-30 select-none">
              {item.name[0]?.toUpperCase()}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">£{(item.price / 100).toFixed(2)} base</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onCancel} aria-label="Cancel customising" className="size-11">
          <X size={18} />
        </Button>
      </div>

      {/* Options — full height of the panel */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-5 space-y-5">
          {!item.modifiersLoaded ? (
            <div className="space-y-2.5">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />
              ))}
            </div>
          ) : (
            groups.map((group) => (
              <OptionGroup key={group.category} label={group.category}>
                {[...group.items]
                  .sort((a, b) => a.price - b.price)
                  .map((opt) => (
                    <OptionBtn
                      key={opt.id}
                      label={opt.price > 0 ? `${opt.label} (+£${(opt.price / 100).toFixed(2)})` : opt.label}
                      active={pending.some((o) => o.id === opt.id)}
                      onClick={() => select(opt)}
                    />
                  ))}
              </OptionGroup>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Always-visible add button */}
      <div className="border-t border-border p-5 shrink-0">
        <Button size="lg" onClick={onAdd} className="w-full h-14 text-base">
          Add to Order — £{(price / 100).toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
