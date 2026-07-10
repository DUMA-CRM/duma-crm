import { X } from 'lucide-react';
import Image from 'next/image';

import { OptionBtn, OptionGroup } from '@/components/pos/Option';
import { Button } from '@/components/ui/button';

import { groupByCategory } from '@/lib/utils/modifiers';
import type { MenuItem, MenuOption } from '@/types/pos';

interface InlineCustomiserProps {
  item: MenuItem;
  pending: MenuOption[];
  setPending: React.Dispatch<React.SetStateAction<MenuOption[]>>;
  onAdd: () => void;
  onCancel: () => void;
}

export function InlineCustomiser({ item, pending, setPending, onAdd, onCancel }: InlineCustomiserProps) {
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
    <div className="px-5 pt-5">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        {/* Item header */}
        <div className="flex gap-3 mb-4 items-center">
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
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground">{item.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">£{(item.price / 100).toFixed(2)} base</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onCancel}>
                <X size={13} />
              </Button>
            </div>
          </div>
        </div>

        {/* Modifiers grouped by category: categorised = pick one, uncategorised = multi-select */}
        {groups.length > 0 && (
          <div className="border-t border-border/60 pt-3 space-y-3">
            {groups.map((group) => (
              <OptionGroup key={group.category} label={group.category}>
                {[...group.items].sort((a, b) => a.price - b.price).map((opt) => (
                  <OptionBtn
                    key={opt.id}
                    label={opt.price > 0 ? `${opt.label} (+£${(opt.price / 100).toFixed(2)})` : opt.label}
                    active={pending.some((o) => o.id === opt.id)}
                    onClick={() => select(opt)}
                  />
                ))}
              </OptionGroup>
            ))}
          </div>
        )}

        <Button size="lg" onClick={onAdd} className="mt-3 w-full">
          Add to Order — £{(price / 100).toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
