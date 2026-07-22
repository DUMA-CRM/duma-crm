'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';

import { Modal } from '@/components/shared/Modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import {
  type Allergen,
  FSA_ALLERGENS,
  type LocationStock,
  type LocationStockPayload,
  NUTRITION_FIELDS,
  type NutritionBasis,
  type NutritionFacts,
  type StockItem,
  addLocationStock,
  createStockItem,
  getLocationStock,
  getStockItems,
  updateLocationStock,
  updateStockItem,
} from '@/lib/api/inventory.service';
import { type CreateLossPayload, type LossCreateReason, createLossEntry } from '@/lib/api/loss.service';
import { type CreateRestockRequestPayload, createRestockRequest } from '@/lib/api/restock.service';
import { getLocationsByTenant } from '@/lib/api/workspace.service';
import { cn } from '@/lib/utils/cn';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { REASON_OPTIONS, selectClass } from './shared';

// ── Nutrition fields (shared by create + edit item forms) ─────────────────────

const NUTRITION_BASES: { value: NutritionBasis; label: string }[] = [
  { value: 'per_100g', label: 'per 100 g' },
  { value: 'per_100ml', label: 'per 100 ml' },
  { value: 'per_piece', label: 'per piece' },
];

export interface NutritionDraft {
  basis: NutritionBasis | '';
  values: Record<keyof NutritionFacts, string>;
}

export const emptyNutritionDraft = (): NutritionDraft => ({
  basis: '',
  values: { kcal: '', fat: '', saturates: '', carbs: '', sugars: '', fibre: '', protein: '', salt: '' },
});

export function nutritionDraftFrom(basis?: NutritionBasis | null, facts?: NutritionFacts | null): NutritionDraft {
  const d = emptyNutritionDraft();
  d.basis = basis ?? '';
  for (const { key } of NUTRITION_FIELDS) if (facts?.[key] != null) d.values[key] = String(facts[key]);
  return d;
}

/** Draft → payload pieces. Nutrition is only sent when a basis and ≥1 value are set. */
export function nutritionPayload(d: NutritionDraft): { nutritionBasis: NutritionBasis | null; nutrition: NutritionFacts | null } {
  const facts: NutritionFacts = {};
  for (const { key } of NUTRITION_FIELDS) {
    const v = d.values[key].trim();
    if (v !== '' && !Number.isNaN(Number(v))) facts[key] = Number(v);
  }
  if (!d.basis || Object.keys(facts).length === 0) return { nutritionBasis: null, nutrition: null };
  return { nutritionBasis: d.basis, nutrition: facts };
}

function NutritionFields({
  draft,
  onChange,
  allergens,
  onAllergensChange,
}: {
  draft: NutritionDraft;
  onChange: (d: NutritionDraft) => void;
  allergens: Allergen[];
  onAllergensChange: (v: Allergen[]) => void;
}) {
  const toggle = (a: Allergen) => onAllergensChange(allergens.includes(a) ? allergens.filter((x) => x !== a) : [...allergens, a]);
  const setValue = (key: keyof NutritionFacts, v: string) => onChange({ ...draft, values: { ...draft.values, [key]: v } });

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label uppercase>Nutrition per</Label>
        <div className="flex gap-1.5">
          {NUTRITION_BASES.map((b) => (
            <button
              key={b.value}
              type="button"
              onClick={() => onChange({ ...draft, basis: draft.basis === b.value ? '' : b.value })}
              aria-pressed={draft.basis === b.value}
              className={cn(
                'flex-1 h-9 rounded-lg border text-xs font-medium transition-colors',
                draft.basis === b.value
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          As printed on the food label. Recipe amounts in kg/l convert automatically; “per piece” suits countable items.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {NUTRITION_FIELDS.map((f) => (
          <Input
            key={f.key}
            label={`${f.label} (${f.unit})`}
            value={draft.values[f.key]}
            onChange={(e) => setValue(f.key, e.target.value)}
            inputMode="decimal"
            placeholder="—"
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <Label uppercase>Allergens</Label>
        <div className="flex flex-wrap gap-1.5">
          {FSA_ALLERGENS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => toggle(a)}
              aria-pressed={allergens.includes(a)}
              className={cn(
                'px-2.5 h-8 rounded-lg border text-xs font-medium capitalize transition-colors',
                allergens.includes(a)
                  ? 'border-warning bg-warning/10 text-warning'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// ── Add Stock Item ────────────────────────────────────────────────────────────

const NEW_ITEM = '__new__';

export function AddItemModal({
  locationId,
  existingIds,
  onClose,
  onSuccess,
}: {
  locationId: string;
  existingIds: Set<string>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { tenantId } = useWorkspaceStore();
  const qc = useQueryClient();
  const [stockItemId, setStockItemId] = useState('');
  const [newName, setNewName] = useState('');
  const [newUnit, setNewUnit] = useState('');
  const [newCategory, setNewCategory] = useState<StockItem['category']>('SUPPLY');
  const [newPerishable, setNewPerishable] = useState(false);
  const [newShelfLife, setNewShelfLife] = useState('');
  const [newContainerQty, setNewContainerQty] = useState('');
  const [newNutrition, setNewNutrition] = useState<NutritionDraft>(emptyNutritionDraft);
  const [newAllergens, setNewAllergens] = useState<Allergen[]>([]);
  const [lowThreshold, setLowThreshold] = useState('');
  const [reorderQuantity, setReorderQuantity] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: allItems = [] } = useQuery({ queryKey: ['stock-items'], queryFn: getStockItems });
  const available = allItems.filter((i) => !existingIds.has(i.id));
  const creatingNew = stockItemId === NEW_ITEM;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      let itemId = stockItemId;
      if (creatingNew) {
        const created = await createStockItem({
          tenantId: tenantId!,
          name: newName.trim(),
          unit: newUnit.trim(),
          category: newCategory,
          isPerishable: newPerishable,
          defaultShelfLifeDays: newShelfLife ? Number(newShelfLife) : null,
          defaultContainerQuantity: newContainerQty ? Number(newContainerQty) : null,
          defaultReorderLevel: Number(lowThreshold),
          defaultReorderQuantity: reorderQuantity ? Number(reorderQuantity) : null,
          ...nutritionPayload(newNutrition),
          allergens: newAllergens.length > 0 ? newAllergens : null,
        });
        itemId = created.id;
      }
      const payload: LocationStockPayload = { locationId, stockItemId: itemId, lowThreshold, reorderQuantity: reorderQuantity || undefined, isAvailable: true };
      return addLocationStock(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['stock-items'] });
      onSuccess();
      onClose();
    },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!stockItemId) errs.item = 'Select or create an item.';
    if (creatingNew) {
      if (!newName.trim()) errs.name = 'Item name is required.';
      if (!newUnit.trim()) errs.unit = 'Unit is required (e.g. kg, ml, units).';
    }
    if (!lowThreshold || parseFloat(lowThreshold) < 0) errs.threshold = 'Enter a valid threshold.';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    mutate();
  }

  return (
    <Modal title="Add Item" onClose={onClose} className={cn(creatingNew ? 'max-w-lg' : 'max-w-sm')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Item</Label>
          <div className="relative">
            <select value={stockItemId} onChange={(e) => { setStockItemId(e.target.value); setErrors((p) => ({ ...p, item: '' })); }} className={cn(selectClass, errors.item && 'border-destructive/60')}>
              <option value="">Select item…</option>
              {available.map((i) => <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}
              <option value={NEW_ITEM}>＋ Create new item…</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {errors.item && <p className="text-xs text-destructive">{errors.item}</p>}
        </div>

        {creatingNew && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                label="NAME"
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setErrors((p) => ({ ...p, name: '' })); }}
                placeholder="e.g. Oat Milk"
                error={errors.name}
                autoFocus
              />
            </div>
            <div className="w-24">
              <Input
                label="UNIT"
                value={newUnit}
                onChange={(e) => { setNewUnit(e.target.value); setErrors((p) => ({ ...p, unit: '' })); }}
                placeholder="litre"
                error={errors.unit}
              />
            </div>
          </div>
        )}

        {creatingNew && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Category</Label>
              <select value={newCategory} onChange={(e) => setNewCategory(e.target.value as StockItem['category'])} className={selectClass}>
                <option value="FOOD">Food</option><option value="BEVERAGE">Beverage</option><option value="SUPPLY">Supply</option><option value="MERCH">Merchandise</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end h-9 rounded-lg bg-surface-offset px-3 text-sm text-foreground">
              <input type="checkbox" checked={newPerishable} onChange={(e) => setNewPerishable(e.target.checked)} /> Perishable
            </label>
            <Input label="CONTAINER QUANTITY" value={newContainerQty} onChange={(e) => setNewContainerQty(e.target.value)} placeholder="e.g. 1000" type="number" min={0} />
            {newPerishable && <Input label="SHELF LIFE (DAYS)" value={newShelfLife} onChange={(e) => setNewShelfLife(e.target.value)} placeholder="e.g. 7" type="number" min={1} />}
          </div>
        )}

        {creatingNew && (
          <NutritionFields draft={newNutrition} onChange={setNewNutrition} allergens={newAllergens} onAllergensChange={setNewAllergens} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label uppercase>Reorder qty</Label>
            <input type="number" min={0} step="any" placeholder="e.g. 500" value={reorderQuantity} onChange={(e) => setReorderQuantity(e.target.value)} className={selectClass} />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Label uppercase>Low threshold</Label>
            <input type="number" min={0} step="any" placeholder="e.g. 100" value={lowThreshold} onChange={(e) => { setLowThreshold(e.target.value); setErrors((p) => ({ ...p, threshold: '' })); }} className={cn(selectClass, errors.threshold && 'border-destructive/60')} />
            {errors.threshold && <p className="text-xs text-destructive">{errors.threshold}</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Adding…' : 'Add Item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit Threshold ────────────────────────────────────────────────────────────

export function EditThresholdModal({
  item,
  onClose,
  onSuccess,
}: {
  item: LocationStock;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [threshold, setThreshold] = useState(item.lowThreshold);
  const [reorderQuantity, setReorderQuantity] = useState(item.reorderQuantity ?? item.stockItem?.defaultReorderQuantity ?? '');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (val: string) => updateLocationStock(item.id, { lowThreshold: val, reorderQuantity: reorderQuantity || null }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    if (parseFloat(threshold) < 0 || isNaN(parseFloat(threshold))) { setError('Enter a valid threshold.'); return; }
    mutate(threshold);
  }

  return (
    <Modal title={`Edit Threshold — ${item.stockItem?.name ?? 'Stock'}`} onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Low stock threshold ({item.stockItem?.unit ?? 'units'})</Label>
          <input
            type="number"
            min={0}
            step="any"
            value={threshold}
            onChange={(e) => { setThreshold(e.target.value); setError(''); }}
            className={cn(selectClass, error && 'border-destructive/60')}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <p className="text-xs text-muted-foreground">Alert triggers when stock falls to or below this value.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Reorder quantity ({item.stockItem?.unit ?? 'units'})</Label>
          <input type="number" min={0} step="any" value={reorderQuantity} onChange={(e) => setReorderQuantity(e.target.value)} className={selectClass} />
          <p className="text-xs text-muted-foreground">Suggested purchase amount when stock reaches the threshold.</p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>{isPending ? 'Saving…' : 'Save'}</Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Request Restock ─────────────────────────────────────────────────────────

export function RestockModal({
  item,
  onClose,
  onSuccess,
}: {
  item: LocationStock;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [qty, setQty] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: CreateRestockRequestPayload) => createRestockRequest(payload),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const n = parseFloat(qty);
    if (!n || n <= 0) { setError('Enter a valid quantity.'); return; }
    mutate({ stockItemId: item.stockItemId, locationId: item.locationId, requestedQty: n, notes: notes || undefined });
  }

  const itemName = item.stockItem?.name ?? item.stockItemId.slice(0, 8);
  const unit = item.stockItem?.unit ?? '';

  return (
    <Modal title="Request Restock" onClose={onClose} className="max-w-sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl bg-surface-offset px-4 py-3 text-sm">
          <p className="font-medium text-foreground">{itemName}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Current: <span className="font-semibold text-foreground">{parseFloat(item.quantity)} {unit}</span>
            {' · '}Threshold: <span className="font-semibold text-foreground">{parseFloat(item.lowThreshold)} {unit}</span>
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label uppercase>Quantity to request ({unit || 'units'})</Label>
          <input
            type="number"
            min={0.01}
            step="any"
            placeholder="e.g. 50"
            value={qty}
            onChange={(e) => { setQty(e.target.value); setError(''); }}
            className={cn(selectClass, error && 'border-destructive/60')}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <Label uppercase>Notes</Label>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Urgency, supplier preference…"
            rows={2}
            className={cn(
              'w-full bg-surface-offset border border-transparent rounded-lg px-3 py-2 text-sm text-foreground',
              'placeholder:text-muted-foreground outline-none resize-none',
              'focus:border-primary focus:ring-2 focus:ring-primary/15 transition-[border-color,box-shadow] duration-150',
            )}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Requesting…' : 'Submit Request'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Log Loss ──────────────────────────────────────────────────────────────────

export function LogLossModal({
  defaultLocationId,
  defaultStockItemId,
  onClose,
  onSuccess,
}: {
  defaultLocationId?: string;
  defaultStockItemId?: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { tenantId } = useWorkspaceStore();

  const [locationId, setLocationId] = useState(defaultLocationId ?? '');
  const [stockItemId, setStockItemId] = useState(defaultStockItemId ?? '');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<LossCreateReason>('expiry');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: locations = [] } = useQuery({
    queryKey: ['locations', tenantId],
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId,
  });

  const { data: locationStock = [], isLoading: loadingStock } = useQuery({
    queryKey: ['location-stock', locationId],
    queryFn: () => getLocationStock(locationId),
    enabled: !!locationId,
  });

  const availableItems = locationStock.filter((ls) => ls.isAvailable && ls.stockItem && parseFloat(ls.quantity) > 0);
  const selectedItem = availableItems.find((ls) => ls.stockItemId === stockItemId);
  const currentQty = selectedItem ? parseFloat(selectedItem.quantity) : 0;

  const { mutate: submit, isPending } = useMutation({
    mutationFn: (data: CreateLossPayload) => createLossEntry(data),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!locationId) errs.location = 'Select a location.';
    if (!stockItemId) errs.item = 'Select an item.';
    const qtyNum = parseFloat(qty);
    if (!qty || isNaN(qtyNum) || qtyNum <= 0) errs.qty = 'Enter a valid quantity.';
    else if (qtyNum > currentQty) errs.qty = `Max available: ${currentQty}`;
    if (Object.keys(errs).length) { setErrors(errs); return; }
    submit({ stockItemId, locationId, quantity: qtyNum, reason, notes: notes.trim() || undefined });
  }

  return (
    <Modal title="Log Loss" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Location</Label>
          <div className="relative">
            <select
              value={locationId}
              onChange={(e) => { setLocationId(e.target.value); setStockItemId(''); setErrors((p) => ({ ...p, location: '' })); }}
              className={cn(selectClass, errors.location && 'border-destructive/60')}
            >
              <option value="">Select location…</option>
              {locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label uppercase>Item</Label>
          <div className="relative">
            <select
              value={stockItemId}
              onChange={(e) => { setStockItemId(e.target.value); setErrors((p) => ({ ...p, item: '' })); }}
              disabled={!locationId || loadingStock}
              className={cn(selectClass, errors.item && 'border-destructive/60')}
            >
              <option value="">
                {loadingStock ? 'Loading…' : !locationId ? 'Select a location first' : availableItems.length === 0 ? 'No items available' : 'Select item…'}
              </option>
              {availableItems.map((ls) => (
                <option key={ls.stockItemId} value={ls.stockItemId}>
                  {ls.stockItem!.name} — {parseFloat(ls.quantity)} {ls.stockItem!.unit} available
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
          {errors.item && <p className="text-xs text-destructive">{errors.item}</p>}
        </div>

        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Input
              label="QUANTITY LOST"
              type="number"
              min={0.01}
              step="any"
              value={qty}
              onChange={(e) => { setQty(e.target.value); setErrors((p) => ({ ...p, qty: '' })); }}
              placeholder="0"
              error={errors.qty}
              hint={selectedItem ? `Available: ${currentQty} ${selectedItem.stockItem?.unit ?? ''}` : undefined}
            />
          </div>
          <div className={cn(
            'h-9 px-3 bg-surface-offset rounded-lg flex items-center text-sm font-medium shrink-0 border border-transparent',
            selectedItem?.stockItem?.unit ? 'text-foreground' : 'text-muted-foreground',
          )}>
            {selectedItem?.stockItem?.unit ?? 'unit'}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label uppercase>Reason</Label>
          <div className="relative">
            <select value={reason} onChange={(e) => setReason(e.target.value as LossCreateReason)} className={selectClass}>
              {REASON_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline gap-1.5">
            <Label uppercase>Notes</Label>
            <span className="text-xs text-muted-foreground">(optional)</span>
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Additional details about this loss…"
            maxLength={500}
            rows={3}
            className={cn(
              'w-full bg-surface-offset border border-transparent rounded-lg px-3 py-2 text-sm text-foreground',
              'placeholder:text-muted-foreground outline-none resize-none',
              'focus:border-primary focus:ring-2 focus:ring-primary/15',
              'transition-[border-color,box-shadow] duration-150',
            )}
          />
        </div>

        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending}>
            {isPending ? 'Logging…' : 'Log Loss'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

// ── Edit catalogue item (name / unit) ─────────────────────────────────────────

export function EditStockItemModal({
  item,
  onClose,
  onSuccess,
}: {
  item: Pick<StockItem, 'id' | 'name' | 'unit' | 'category' | 'isPerishable' | 'defaultShelfLifeDays' | 'defaultContainerQuantity' | 'defaultReorderLevel' | 'defaultReorderQuantity' | 'nutritionBasis' | 'nutrition' | 'allergens'>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [unit, setUnit] = useState(item.unit);
  const [category, setCategory] = useState(item.category);
  const [isPerishable, setIsPerishable] = useState(item.isPerishable);
  const [shelfLife, setShelfLife] = useState(item.defaultShelfLifeDays ? String(item.defaultShelfLifeDays) : '');
  const [containerQuantity, setContainerQuantity] = useState(item.defaultContainerQuantity ?? '');
  const [reorderLevel, setReorderLevel] = useState(item.defaultReorderLevel ?? '');
  const [reorderQuantity, setReorderQuantity] = useState(item.defaultReorderQuantity ?? '');
  const [nutrition, setNutrition] = useState<NutritionDraft>(() => nutritionDraftFrom(item.nutritionBasis, item.nutrition));
  const [allergens, setAllergens] = useState<Allergen[]>((item.allergens ?? []) as Allergen[]);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateStockItem(item.id, {
        name: name.trim(),
        unit: unit.trim(),
        category,
        isPerishable,
        defaultShelfLifeDays: shelfLife ? Number(shelfLife) : null,
        defaultContainerQuantity: containerQuantity ? Number(containerQuantity) : null,
        defaultReorderLevel: reorderLevel ? Number(reorderLevel) : null,
        defaultReorderQuantity: reorderQuantity ? Number(reorderQuantity) : null,
        ...nutritionPayload(nutrition),
        allergens: allergens.length > 0 ? allergens : null,
      }),
    onSuccess: () => { onSuccess(); onClose(); },
  });

  return (
    <Modal title={`Edit "${item.name}"`} onClose={onClose} className="max-w-lg">
      <form onSubmit={(e) => { e.preventDefault(); mutate(); }} className="space-y-4">
        <Input label="NAME" value={name} onChange={(e) => setName(e.target.value)} required autoFocus />
        <Input
          label="UNIT"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="ml, g, kg, units…"
          required
          hint="Changing the unit affects every location tracking this item."
        />
        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5"><Label uppercase>Category</Label><select value={category} onChange={(e) => setCategory(e.target.value as StockItem['category'])} className={selectClass}><option value="FOOD">Food</option><option value="BEVERAGE">Beverage</option><option value="SUPPLY">Supply</option><option value="MERCH">Merchandise</option></select></div>
          <label className="flex items-center gap-2 self-end h-9 rounded-lg bg-surface-offset px-3 text-sm"><input type="checkbox" checked={isPerishable} onChange={(e) => setIsPerishable(e.target.checked)} /> Perishable</label>
          <Input label="CONTAINER QUANTITY" value={containerQuantity} onChange={(e) => setContainerQuantity(e.target.value)} type="number" min={0} />
          {isPerishable && <Input label="SHELF LIFE (DAYS)" value={shelfLife} onChange={(e) => setShelfLife(e.target.value)} type="number" min={1} />}
          <Input label="DEFAULT REORDER LEVEL" value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)} type="number" min={0} />
          <Input label="DEFAULT REORDER QUANTITY" value={reorderQuantity} onChange={(e) => setReorderQuantity(e.target.value)} type="number" min={0} />
        </div>
        <NutritionFields draft={nutrition} onChange={setNutrition} allergens={allergens} onAllergensChange={setAllergens} />
        <div className="flex gap-2 pt-1">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button type="submit" className="flex-1" disabled={isPending || !name.trim() || !unit.trim()}>
            {isPending ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
