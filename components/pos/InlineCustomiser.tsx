import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { OptionBtn } from './OptionBtn';
import type { MenuItem, PendingOptions } from '@/types/pos';

interface InlineCustomiserProps {
  item: MenuItem;
  pending: PendingOptions;
  setPending: React.Dispatch<React.SetStateAction<PendingOptions>>;
  onAdd: () => void;
  onCancel: () => void;
}

export function InlineCustomiser({ item, pending, setPending, onAdd, onCancel }: InlineCustomiserProps) {
  const price = item.price + (pending.size?.price ?? 0) + (pending.milk?.price ?? 0) + (pending.syrup?.price ?? 0);

  return (
    <div className="px-5 pt-5">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        {/* Item header */}
        <div className="flex gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{item.name}</p>
              <button
                onClick={onCancel}
                className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
              >
                <X size={13} />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">₴{item.price} base</p>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-3 border-t border-border/60 pt-3">
          {item.sizes && (
            <OptionGroup label="Size">
              {item.sizes.map((opt) => (
                <OptionBtn
                  key={opt.label}
                  label={opt.price > 0 ? `${opt.label} (+₴${opt.price})` : opt.label}
                  active={pending.size?.label === opt.label}
                  onClick={() => setPending((p) => ({ ...p, size: opt }))}
                />
              ))}
            </OptionGroup>
          )}

          {item.milk && (
            <OptionGroup label="Milk Choice">
              {item.milk.map((opt) => (
                <OptionBtn
                  key={opt.label}
                  label={opt.price > 0 ? `${opt.label} (+₴${opt.price})` : opt.label}
                  active={pending.milk?.label === opt.label}
                  onClick={() => setPending((p) => ({ ...p, milk: opt }))}
                />
              ))}
            </OptionGroup>
          )}

          {item.syrups && (
            <OptionGroup label="Syrups">
              {item.syrups.map((opt) => (
                <OptionBtn
                  key={opt.label}
                  label={opt.price > 0 ? `${opt.label} (+₴${opt.price})` : opt.label}
                  active={pending.syrup?.label === opt.label}
                  onClick={() => setPending((p) => ({ ...p, syrup: opt }))}
                />
              ))}
            </OptionGroup>
          )}

          <Button className="w-full bg-primary hover:bg-primary/90 text-white font-semibold h-12" onClick={onAdd}>
            Add to Order — ₴{price}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Small helper — avoids repeating label + flex-wrap wrapper
function OptionGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1.5">{label}</p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
