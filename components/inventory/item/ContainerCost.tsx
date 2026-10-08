'use client';

import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import { Coins, Loader2 } from '@/components/icons';
import { fmtQty } from '@/components/inventory/stock/shared';
import { Drawer } from '@/components/shared/Drawer';
import { ChoiceCards, FormSection } from '@/components/shared/FormParts';
import { useCurrencySymbol, useWorkspaceCurrency, useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { type StockItem, type StockUnit, setStockUnitCost } from '@/lib/modules/inventory/client';
import { formatCurrency } from '@/lib/utils/currencies';
import { containerPrice, unitCostFromPrice } from '@/lib/utils/stock-cost';
import { toast } from '@/stores/toastStore';

/**
 * Cost per unit of measure in the workspace currency. A per-ml cost is a
 * fraction of a penny, so below one it shows the four places the database
 * keeps (£0.0030) instead of rounding to £0.00.
 */
export function useFormatUnitCost() {
  const currency = useWorkspaceCurrency();
  return (cost: number) => formatCurrency(cost, currency, cost !== 0 && Math.abs(cost) < 1 ? 4 : 2);
}

/**
 * What one container cost, as people know it — the price on the invoice for
 * the bottle or bag — with what that means per unit beneath. Blank means the
 * container follows the item's cost, which the hint names.
 */
export function ContainerPriceInput({
  label = 'Price per container',
  price,
  onChange,
  quantity,
  unit,
  itemCost,
  error,
}: {
  label?: string;
  price: string;
  onChange: (price: string) => void;
  /** What one container holds, in the item's unit. */
  quantity: number;
  unit: string;
  itemCost?: string | null;
  error?: string;
}) {
  const symbol = useCurrencySymbol();
  const unitCost = useFormatUnitCost();
  const perUnit = unitCostFromPrice(price, quantity);
  const fallback = itemCost != null && itemCost !== '' ? Number(itemCost) : null;
  const hint =
    perUnit !== null
      ? `= ${unitCost(perUnit)} per ${unit}`
      : fallback !== null
        ? `Blank uses the item’s cost — ${unitCost(fallback)} per ${unit}`
        : 'Blank leaves it without a cost until the item has one';
  return (
    <Input
      label={label}
      value={price}
      onChange={(event) => onChange(event.target.value)}
      inputMode="decimal"
      placeholder={fallback !== null && quantity > 0 ? (fallback * quantity).toFixed(2) : '0.00'}
      leftIcon={<span className="text-xs">{symbol}</span>}
      hint={hint}
      error={error}
    />
  );
}

/** A price that is blank (follow the item) or a valid amount; anything else is an error. */
export const priceError = (price: string, quantity: number) =>
  price.trim() !== '' && unitCostFromPrice(price, quantity) === null ? 'A price of 0 or more, e.g. 3.50.' : null;

/**
 * Set what one or more containers cost. Priced per container when they're all
 * the same size (how an invoice reads), else per unit of measure. Stock already
 * used keeps the cost it was used at — only what's drawn from now on changes.
 */
export function SetContainerCostDrawer({
  units,
  item,
  onClose,
  onDone,
}: {
  units: StockUnit[];
  item: Pick<StockItem, 'unit' | 'costPerUnit'>;
  onClose: () => void;
  onDone: () => void;
}) {
  const money = useWorkspaceMoney();
  const sizes = new Set(units.map((unit) => Number(unit.initialQuantity)));
  const sameSize = sizes.size === 1;
  const size = sameSize ? [...sizes][0]! : 1;
  const [mode, setMode] = useState<'container' | 'unit'>(sameSize ? 'container' : 'unit');
  const quantity = mode === 'container' ? size : 1;
  // Start from the cost they share, if they share one.
  const shared = new Set(units.map((unit) => unit.unitCost ?? ''));
  const start = shared.size === 1 ? [...shared][0] : '';
  const [price, setPrice] = useState(() => {
    const value = start ? containerPrice(start, quantity) : null;
    return value === null ? '' : String(Number(value.toFixed(4)));
  });
  const [submitted, setSubmitted] = useState(false);
  const error = priceError(price, quantity);

  const save = useMutation({
    mutationFn: async () => {
      const cost = price.trim() === '' ? null : unitCostFromPrice(price, quantity);
      // One request each — the API sets a container at a time. Sequential, so a failure stops the rest.
      for (const unit of units) await setStockUnitCost(unit.id, cost);
    },
    onSuccess: () => {
      toast('success', units.length === 1 ? 'Container cost saved.' : `Cost saved on ${units.length} containers.`);
      onDone();
    },
    onError: (err) => toast('error', err.message || 'The cost wasn’t saved. Try again.'),
  });

  const title = units.length === 1 ? `Cost of ${units[0]!.label}` : `Cost of ${units.length} containers`;
  return (
    <Drawer
      title={title}
      description="What it was bought for. Stock already used keeps the cost it was used at."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={save.isPending}>
            Cancel
          </Button>
          <Button type="submit" form="container-cost" size="lg" className="flex-1" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save cost
          </Button>
        </div>
      }
    >
      <form
        id="container-cost"
        noValidate
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (!error) save.mutate();
        }}
      >
        <FormSection icon={Coins} title="Cost">
          {sameSize && (
            <ChoiceCards
              columns={2}
              value={mode}
              onChange={(next) => {
                setMode(next as 'container' | 'unit');
                setPrice('');
              }}
              options={[
                { value: 'container', label: `Per container (${fmtQty(size)} ${item.unit})` },
                { value: 'unit', label: `Per ${item.unit}` },
              ]}
            />
          )}
          <ContainerPriceInput
            label={mode === 'container' ? 'Price per container' : `Cost per ${item.unit}`}
            price={price}
            onChange={setPrice}
            quantity={quantity}
            unit={item.unit}
            itemCost={item.costPerUnit}
            error={submitted ? (error ?? undefined) : undefined}
          />
          {!sameSize && (
            <p className="text-xs text-muted-foreground">These containers are different sizes, so the cost is per {item.unit}.</p>
          )}
          {units.length > 1 && price.trim() !== '' && !error && (
            <p className="rounded-md bg-band/60 px-3 py-2 text-xs tabular-nums text-muted-foreground">
              Applies to all {units.length} — {fmtQty(units.reduce((sum, unit) => sum + Number(unit.remainingQuantity), 0))} {item.unit} left, worth{' '}
              <span className="font-semibold text-foreground">
                {money(units.reduce((sum, unit) => sum + Number(unit.remainingQuantity), 0) * (unitCostFromPrice(price, quantity) ?? 0))}
              </span>
            </p>
          )}
        </FormSection>
      </form>
    </Drawer>
  );
}
