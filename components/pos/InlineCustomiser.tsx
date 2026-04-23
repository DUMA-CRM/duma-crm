import { X } from 'lucide-react';
import Image from 'next/image';

import { OptionBtn, OptionGroup } from '@/components/pos/Option';
import { Button } from '@/components/ui/button';

import type { MenuItem, PendingOptions } from '@/types/pos';

interface InlineCustomiserProps {
  item: MenuItem;
  pending: PendingOptions;
  setPending: React.Dispatch<React.SetStateAction<PendingOptions>>;
  onAdd: () => void;
  onCancel: () => void;
}

export function InlineCustomiser({ item, pending, setPending, onAdd, onCancel }: InlineCustomiserProps) {
  const optionsTotal = Object.values(pending).reduce((sum, opt) => sum + (opt?.price ?? 0), 0);
  const price = item.price + optionsTotal;

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

        {/* Dynamic modifier groups */}
        {item.modifierGroups.length > 0 && (
          <div className="space-y-3 border-t border-border/60 pt-3">
            {item.modifierGroups.map((group) => {
              const selected = pending[group.groupId];
              const selectOpt = (label: string | null) =>
                setPending((p) => ({
                  ...p,
                  [group.groupId]: label === null ? null : (group.options.find((o) => o.label === label) ?? null),
                }));

              return (
                <OptionGroup key={group.groupId} label={group.groupName} required={group.required}>
                  {!group.required && <OptionBtn label="None" active={selected === null} onClick={() => selectOpt(null)} />}
                  {group.options.map((opt) => (
                    <OptionBtn
                      key={opt.label}
                      label={opt.price > 0 ? `${opt.label} (+£${(opt.price / 100).toFixed(2)})` : opt.label}
                      active={selected?.label === opt.label}
                      onClick={() => selectOpt(opt.label)}
                    />
                  ))}
                </OptionGroup>
              );
            })}
          </div>
        )}

        <Button size="lg" onClick={onAdd} className="mt-3 w-full">
          Add to Order — £{(price / 100).toFixed(2)}
        </Button>
      </div>
    </div>
  );
}
