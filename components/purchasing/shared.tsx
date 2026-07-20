// Shared constants and small helpers for purchasing components.
import type { PurchaseOrderLine, PurchaseOrderStatus } from '@/lib/api/purchasing.service';

export const inputClass =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150';

export const selectClass =
  'w-full h-9 bg-background border border-border rounded-lg px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150 cursor-pointer';

export const labelClass = 'block text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1.5';

export const thClass = 'px-3 md:px-5 py-3.5 text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest';

export const STATUS_META: Record<
  PurchaseOrderStatus,
  { label: string; variant: 'muted' | 'primary' | 'warning' | 'success' }
> = {
  draft: { label: 'Draft', variant: 'muted' },
  submitted: { label: 'Submitted', variant: 'primary' },
  partially_received: { label: 'Partially Received', variant: 'warning' },
  received: { label: 'Received', variant: 'success' },
  cancelled: { label: 'Cancelled', variant: 'muted' },
};

/** Pounds and pence, e.g. "£4.20". */
export const money = (n: number) => `£${n.toFixed(2)}`;

/** Unit costs can carry 4 decimal places — show 2, extending to 3–4 only when needed. */
export const unitMoney = (raw: string | number) => {
  const n = typeof raw === 'number' ? raw : Number.parseFloat(raw || '0');
  const s4 = n.toFixed(4);
  const s = s4.endsWith('00') ? n.toFixed(2) : s4.endsWith('0') ? n.toFixed(3) : s4;
  return `£${s}`;
};

/** Decimal-string quantity without trailing zeros, e.g. "12.5" / "3". */
export const fmtQty = (raw: string) => String(Number.parseFloat(raw || '0'));

export const lineTotal = (line: Pick<PurchaseOrderLine, 'quantityOrdered' | 'unitCost'>) =>
  Number.parseFloat(line.quantityOrdered || '0') * Number.parseFloat(line.unitCost || '0');

export const linesTotal = (lines?: PurchaseOrderLine[]) => (lines ?? []).reduce((sum, line) => sum + lineTotal(line), 0);

export function FormActions({
  onClose,
  isPending,
  submitLabel = 'Create',
  pendingLabel = 'Saving…',
  disabled,
}: {
  onClose: () => void;
  isPending: boolean;
  submitLabel?: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
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
        disabled={isPending || disabled}
        className="flex-1 h-10 bg-primary hover:bg-primary-hover active:translate-y-px text-white text-sm font-semibold rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {isPending ? pendingLabel : submitLabel}
      </button>
    </div>
  );
}
