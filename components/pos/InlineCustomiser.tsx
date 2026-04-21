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
  const optionsTotal = Object.values(pending).reduce((sum, opt) => sum + (opt?.price ?? 0), 0);
  const price = item.price + optionsTotal;

  return (
    <div className="px-5 pt-5">
      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
        {/* Item header */}
        <div className="flex gap-3 mb-4">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
            {item.image ? (
              <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg font-bold text-muted-foreground opacity-30 select-none">
                {item.name[0]?.toUpperCase()}
              </div>
            )}
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
            <p className="text-xs text-muted-foreground mt-0.5">£{(item.price / 100).toFixed(2)} base</p>
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

        <button
          onClick={onAdd}
          className="w-full h-10 rounded-lg bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold transition-colors mt-3"
        >
          Add to Order — £{(price / 100).toFixed(2)}
        </button>
      </div>
    </div>
  );
}

function OptionGroup({ label, required, children }: { label: string; required: boolean; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1.5">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        {required && (
          <span className="text-[9px] font-bold uppercase tracking-widest px-1 py-0.5 rounded bg-warning/10 text-warning">Required</span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
