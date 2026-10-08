'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  AlertTriangle,
  Barcode,
  Check,
  FileText,
  Flame,
  Gauge,
  Loader2,
  Package,
  PackageMinus,
  PackagePlus,
  Timer,
  TriangleAlert,
} from '@/components/icons';
import { StockItemPhotoField } from '@/components/inventory/item/StockItemPhoto';
import { SettingRow, SettingRows, Switch } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { ChoiceCards, FormSection, NumberStepper } from '@/components/shared/FormParts';
import { Pill } from '@/components/shared/Pill';
import { TONE_TINT } from '@/components/shared/tone';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

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
} from '@/lib/modules/inventory/client';
import { type CreateLossPayload, type LossCreateReason, createLossEntry } from '@/lib/modules/inventory/client';
import { type CreateRestockRequestPayload, createRestockRequest } from '@/lib/modules/inventory/client';
import { getLocationsByTenant } from '@/lib/modules/organization/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { toast } from '@/stores/toastStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

import { ParMeter, STATUS_LABEL, STATUS_TONE, type StockStatus, fmtQty, getStatus, selectClass, statusGlyph } from './shared';

// ── Nutrition fields (shared by create + edit item forms) ─────────────────────

const NUTRITION_BASES: { value: NutritionBasis; label: string }[] = [
  { value: 'per_100g', label: 'Per 100 g' },
  { value: 'per_100ml', label: 'Per 100 ml' },
  { value: 'per_piece', label: 'Per piece' },
];

const STOCK_CATEGORY_OPTIONS = [
  { value: 'FOOD', label: 'Food' },
  { value: 'BEVERAGE', label: 'Drinks' },
  { value: 'SUPPLY', label: 'Supplies' },
  { value: 'MERCH', label: 'Retail' },
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
  const hasValues = NUTRITION_FIELDS.some((f) => draft.values[f.key].trim() !== '');

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label uppercase>Values per</Label>
        <ChoiceCards
          columns={3}
          value={draft.basis}
          onChange={(basis) => onChange({ ...draft, basis: draft.basis === basis ? '' : basis })}
          options={NUTRITION_BASES}
        />
        <p className="text-xs text-muted-foreground">
          As printed on the label. Recipe amounts in kg or l convert automatically; “per piece” suits countable items.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        {NUTRITION_FIELDS.map((f) => (
          <Input
            key={f.key}
            label={f.label}
            value={draft.values[f.key]}
            onChange={(e) => setValue(f.key, e.target.value)}
            inputMode="decimal"
            placeholder="—"
            rightIcon={<span className="text-xs">{f.unit}</span>}
          />
        ))}
      </div>
      {hasValues && !draft.basis && (
        <p className="rounded-md bg-measured/10 px-3 py-2 text-xs text-measured">Choose what the values are per, or they won’t be saved.</p>
      )}

      <div className="flex flex-col gap-1.5">
        <Label uppercase>Allergens it contains</Label>
        <div className="flex flex-wrap gap-1.5">
          {FSA_ALLERGENS.map((a) => {
            const on = allergens.includes(a);
            return (
              <button
                key={a}
                type="button"
                onClick={() => toggle(a)}
                aria-pressed={on}
                className={cn(
                  'inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-semibold capitalize transition-colors',
                  on
                    ? 'border-measured/50 bg-measured/10 text-measured'
                    : 'border-rule/60 bg-background/60 text-muted-foreground hover:bg-band/40 hover:text-foreground',
                )}
              >
                {on && <Check size={12} aria-hidden="true" />}
                {a}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Add Stock Item ────────────────────────────────────────────────────────────

const NEW_ITEM = '__new__';

// Each drawer's form carries an id so the pinned footer can submit it from outside.
const ADD_ITEM_FORM = 'add-stock-item-form';
const THRESHOLD_FORM = 'edit-stock-threshold-form';
const RESTOCK_FORM = 'request-restock-form';
const LOG_LOSS_FORM = 'log-stock-loss-form';
const EDIT_ITEM_FORM = 'edit-stock-item-form';

export function AddItemDrawer({
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
  const [newBarcode, setNewBarcode] = useState('');
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

  const { data: allItems = [] } = useQuery({ queryKey: moduleQueryKeys.inventory.key('stock-items'), queryFn: getStockItems });
  const available = allItems.filter((i) => !existingIds.has(i.id));
  const creatingNew = stockItemId === NEW_ITEM;

  const { mutate, isPending } = useMutation({
    mutationFn: async () => {
      let itemId = stockItemId;
      if (creatingNew) {
        const created = await createStockItem({
          tenantId: tenantId!,
          name: newName.trim(),
          barcode: newBarcode.trim() || null,
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
      const payload: LocationStockPayload = {
        locationId,
        stockItemId: itemId,
        lowThreshold,
        reorderQuantity: reorderQuantity || undefined,
        isAvailable: true,
      };
      return addLocationStock(payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-items') });
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
    if (!lowThreshold || parseFloat(lowThreshold) < 0) errs.threshold = 'Enter a valid par.';
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }
    mutate();
  }

  return (
    <Drawer
      title="Add Item"
      description="Track an existing catalogue item at this location, or create a new one as you go."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form={ADD_ITEM_FORM} className="flex-1" disabled={isPending}>
            {isPending ? 'Adding…' : 'Add Item'}
          </Button>
        </div>
      }
    >
      <form id={ADD_ITEM_FORM} onSubmit={handleSubmit} className="space-y-4">
        <div className="flex flex-col gap-1.5">
          <Label uppercase>Item</Label>
          <Select
            value={stockItemId}
            onValueChange={(value) => {
              setStockItemId(value);
              setErrors((previous) => ({ ...previous, item: '' }));
            }}
            options={[
              { value: '', label: 'Select item…' },
              ...available.map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` })),
              { value: NEW_ITEM, label: '＋ Create new item…' },
            ]}
            ariaLabel="Item"
            ariaInvalid={Boolean(errors.item)}
            className={selectClass}
          />
          {errors.item && <p className="text-xs text-destructive">{errors.item}</p>}
        </div>

        {creatingNew && (
          <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
            <div className="min-w-0">
              <Input
                label="NAME"
                value={newName}
                onChange={(e) => {
                  setNewName(e.target.value);
                  setErrors((p) => ({ ...p, name: '' }));
                }}
                placeholder="e.g. Oat Milk"
                error={errors.name}
                autoFocus
              />
            </div>
            <div className="w-24">
              <Input
                label="UNIT"
                value={newUnit}
                onChange={(e) => {
                  setNewUnit(e.target.value);
                  setErrors((p) => ({ ...p, unit: '' }));
                }}
                placeholder="litre"
                error={errors.unit}
              />
            </div>
            <div className="col-span-2">
              <Input
                label="BARCODE"
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                placeholder="Scan or enter a product barcode"
                maxLength={255}
                inputMode="numeric"
                autoComplete="off"
                hint="Optional. Must be unique in this workspace."
              />
            </div>
          </div>
        )}

        {creatingNew && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Category</Label>
              <Select
                value={newCategory}
                onValueChange={(value) => setNewCategory(value as StockItem['category'])}
                options={STOCK_CATEGORY_OPTIONS}
                ariaLabel="Category"
                className={selectClass}
              />
            </div>
            <label className="flex items-center gap-2 self-end h-9 rounded-sm bg-band px-3 text-sm text-foreground">
              <input type="checkbox" checked={newPerishable} onChange={(e) => setNewPerishable(e.target.checked)} /> Perishable
            </label>
            <Input
              label="CONTAINER QUANTITY"
              value={newContainerQty}
              onChange={(e) => setNewContainerQty(e.target.value)}
              placeholder="e.g. 1000"
              type="number"
              min={0}
            />
            {newPerishable && (
              <Input
                label="SHELF LIFE (DAYS)"
                value={newShelfLife}
                onChange={(e) => setNewShelfLife(e.target.value)}
                placeholder="e.g. 7"
                type="number"
                min={1}
              />
            )}
          </div>
        )}

        {creatingNew && (
          <NutritionFields draft={newNutrition} onChange={setNewNutrition} allergens={newAllergens} onAllergensChange={setNewAllergens} />
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1.5">
            <Label uppercase>Reorder qty</Label>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 500"
              value={reorderQuantity}
              onChange={(e) => setReorderQuantity(e.target.value)}
              className={selectClass}
            />
          </div>
          <div className="flex flex-col gap-1.5 flex-1">
            <Label uppercase>Par</Label>
            <input
              type="number"
              min={0}
              step="any"
              placeholder="e.g. 100"
              value={lowThreshold}
              onChange={(e) => {
                setLowThreshold(e.target.value);
                setErrors((p) => ({ ...p, threshold: '' }));
              }}
              className={cn(selectClass, errors.threshold && 'border-destructive/60')}
            />
            {errors.threshold && <p className="text-xs text-destructive">{errors.threshold}</p>}
          </div>
        </div>
      </form>
    </Drawer>
  );
}

// ── Edit Threshold ────────────────────────────────────────────────────────────

export function EditThresholdDrawer({ item, onClose, onSuccess }: { item: LocationStock; onClose: () => void; onSuccess: () => void }) {
  const unit = item.stockItem?.unit ?? 'units';
  const [threshold, setThreshold] = useState(item.lowThreshold ? String(Number(item.lowThreshold)) : '');
  const [reorderQuantity, setReorderQuantity] = useState(() => {
    const value = item.reorderQuantity ?? item.stockItem?.defaultReorderQuantity;
    return value ? String(Number(value)) : '';
  });
  const [submitted, setSubmitted] = useState(false);

  const thresholdNumber = Number(threshold);
  const thresholdError = threshold.trim() === '' || !Number.isFinite(thresholdNumber) || thresholdNumber < 0 ? 'Enter 0 or more.' : null;
  const reorderError =
    reorderQuantity.trim() !== '' && (!Number.isFinite(Number(reorderQuantity)) || Number(reorderQuantity) <= 0)
      ? 'Enter more than 0, or leave it blank.'
      : null;
  // What the item would read as with this threshold — the reason to change it.
  const preview = thresholdError ? null : getStatus({ ...item, lowThreshold: String(thresholdNumber) });
  const onHand = Number(item.quantity);

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateLocationStock(item.id, {
        lowThreshold: String(thresholdNumber),
        reorderQuantity: reorderQuantity.trim() ? String(Number(reorderQuantity)) : null,
      }),
    onSuccess: () => {
      onSuccess();
      toast('success', 'Reorder settings saved.');
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The par wasn’t saved. Try again.'),
  });

  return (
    <Drawer
      title="Par level"
      description={
        item.stockItem?.name
          ? `${item.stockItem.name} — when it counts as low here, and how much to order.`
          : 'When it counts as low here, and how much to order.'
      }
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form={THRESHOLD_FORM} size="lg" className="flex-1" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save
          </Button>
        </div>
      }
    >
      <form
        id={THRESHOLD_FORM}
        noValidate
        className="space-y-7"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (!thresholdError && !reorderError) mutate();
        }}
      >
        <div className="flex items-center gap-3 rounded-lg border border-rule/60 bg-card px-4 py-3.5">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary" aria-hidden="true">
            <Gauge size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground">
              {fmtQty(onHand)} {unit} on hand
            </p>
            <p className="text-xs text-muted-foreground">
              {preview ? `Reads as ${STATUS_LABEL[preview].toLowerCase()} with this par` : 'Enter a par to see how it reads'}
            </p>
          </div>
          {preview && <Pill tone={STATUS_TONE[preview]}>{STATUS_LABEL[preview]}</Pill>}
        </div>

        <FormSection
          icon={Gauge}
          title="Low at"
          note="At or below this it shows as low, joins the suggested order and raises the low-stock alert. Half of it counts as critical."
        >
          <Input
            label="Par"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            inputMode="decimal"
            autoFocus
            rightIcon={<span className="text-xs">{unit}</span>}
            error={submitted ? (thresholdError ?? undefined) : undefined}
            hint={thresholdNumber === 0 && !thresholdError ? 'At 0 it never shows as low.' : undefined}
          />
        </FormSection>

        <FormSection
          icon={PackagePlus}
          title="Order"
          note="What the suggested order proposes when it runs low. Leave blank to let the forecast decide."
        >
          <Input
            label="Reorder quantity"
            value={reorderQuantity}
            onChange={(e) => setReorderQuantity(e.target.value)}
            inputMode="decimal"
            placeholder="From the forecast"
            rightIcon={<span className="text-xs">{unit}</span>}
            error={submitted ? (reorderError ?? undefined) : undefined}
          />
        </FormSection>
      </form>
    </Drawer>
  );
}

// ── Request Restock ─────────────────────────────────────────────────────────

export function RestockDrawer({
  item,
  suggested,
  onClose,
  onSuccess,
}: {
  item: LocationStock;
  /** The forecast's suggested reorder, when there is one — pre-filled, rounded up to whole units. */
  suggested?: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const qc = useQueryClient();
  const unit = item.stockItem?.unit ?? 'units';
  const itemName = item.stockItem?.name ?? 'This item';
  const onHand = Number(item.quantity);
  const threshold = Number(item.lowThreshold);
  const usual = item.reorderQuantity ? Math.ceil(Number(item.reorderQuantity)) : null;
  const forecast = suggested && suggested > 0 ? Math.ceil(suggested) : null;
  // The API takes whole units only (`requestedQty: z.number().int()`).
  const [qty, setQty] = useState(forecast ?? usual ?? 1);
  const [notes, setNotes] = useState('');
  const status = getStatus(item);
  const qtyError =
    !Number.isInteger(qty) || qty < 1 ? 'Whole units, 1 or more.' : qty > 999_999 ? 'That’s more than can be requested at once.' : null;

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: CreateRestockRequestPayload) => createRestockRequest(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('restock-requests') });
      onSuccess();
      toast('success', `Requested ${qty} ${unit} of ${itemName} — it’s in Restock demand for approval.`);
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The request wasn’t sent. Try again.'),
  });

  const chips = [
    forecast ? { label: `Suggested · ${forecast}`, value: forecast } : null,
    usual && usual !== forecast ? { label: `Usual order · ${usual}`, value: usual } : null,
  ].filter((chip): chip is { label: string; value: number } => chip !== null);

  return (
    <Drawer
      title="Request restock"
      description="Ask for more — a manager approves it in Restock demand before it’s ordered."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form={RESTOCK_FORM} size="lg" className="flex-1" disabled={isPending || !!qtyError}>
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PackagePlus aria-hidden="true" />}
            Request {qtyError ? '' : `${qty} ${unit}`}
          </Button>
        </div>
      }
    >
      <form
        id={RESTOCK_FORM}
        noValidate
        className="space-y-7"
        onSubmit={(e) => {
          e.preventDefault();
          if (!qtyError)
            mutate({ stockItemId: item.stockItemId, locationId: item.locationId, requestedQty: qty, notes: notes.trim() || undefined });
        }}
      >
        <ItemCard name={itemName} status={status} qty={onHand} par={threshold} unit={unit} category={item.stockItem?.category} />

        <FormSection icon={PackagePlus} title="How much">
          <NumberStepper value={qty} onChange={setQty} min={1} max={999_999} unit={unit} label="Quantity" />
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => setQty(chip.value)}
                  aria-pressed={qty === chip.value}
                  className={cn(
                    'h-8 rounded-md border px-2.5 text-xs font-semibold transition-colors',
                    qty === chip.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-rule/60 bg-background/60 text-muted-foreground hover:bg-band/40 hover:text-foreground',
                  )}
                >
                  {chip.label}
                </button>
              ))}
            </div>
          )}
          {qtyError ? (
            <p className="text-xs text-destructive">{qtyError}</p>
          ) : (
            <p className="text-xs text-muted-foreground">
              Brings it to about{' '}
              <span className="font-semibold text-foreground">
                {fmtQty(onHand + qty)} {unit}
              </span>{' '}
              once delivered. Requests are in whole units.
            </p>
          )}
        </FormSection>

        <FormSection icon={FileText} title="Note">
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — how urgent, or a preferred supplier"
            maxLength={1000}
            rows={3}
            aria-label="Note"
            className={TEXTAREA}
          />
        </FormSection>
      </form>
    </Drawer>
  );
}

// ── Log Loss ──────────────────────────────────────────────────────────────────

const LOSS_REASONS: { value: LossCreateReason; label: string }[] = [
  { value: 'expiry', label: 'Expired' },
  { value: 'damage', label: 'Damaged' },
  { value: 'theft', label: 'Theft' },
  { value: 'other', label: 'Other' },
];

export function LogLossDrawer({
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
  const qc = useQueryClient();
  const money = useWorkspaceMoney();
  const { tenantId } = useWorkspaceStore();
  // Opened from an item, the item and place are known — no pickers, just the loss.
  const fixed = Boolean(defaultLocationId && defaultStockItemId);

  const [locationId, setLocationId] = useState(defaultLocationId ?? '');
  const [stockItemId, setStockItemId] = useState(defaultStockItemId ?? '');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<LossCreateReason>('expiry');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const { data: locations = [] } = useQuery({
    queryKey: moduleQueryKeys.organization.key('locations', tenantId),
    queryFn: () => getLocationsByTenant(tenantId!),
    enabled: !!tenantId && !fixed,
  });
  const { data: locationStock = [], isLoading: loadingStock } = useQuery({
    queryKey: moduleQueryKeys.inventory.key('location-stock', locationId),
    queryFn: () => getLocationStock(locationId),
    enabled: !!locationId,
  });

  const availableItems = locationStock.filter((ls) => ls.isAvailable && ls.stockItem && parseFloat(ls.quantity) > 0);
  const selected = locationStock.find((ls) => ls.stockItemId === stockItemId);
  const unit = selected?.stockItem?.unit ?? 'units';
  const onHand = selected ? Number(selected.quantity) : 0;
  const cost = selected?.stockItem?.costPerUnit != null ? Number(selected.stockItem.costPerUnit) : null;
  const n = Number(qty.replace(',', '.'));

  const errors = {
    location: !locationId ? 'Choose a location.' : null,
    item: !stockItemId ? 'Choose an item.' : null,
    qty:
      qty.trim() === '' || !Number.isFinite(n) || n <= 0
        ? 'Enter how much was lost.'
        : n > onHand
          ? `Only ${fmtQty(onHand)} ${unit} on hand.`
          : null,
  };
  const valid = Object.values(errors).every((e) => e === null);

  const { mutate: submit, isPending } = useMutation({
    mutationFn: (data: CreateLossPayload) => createLossEntry(data),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('loss-log') });
      void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-movements') });
      onSuccess();
      toast('success', `${fmtQty(n)} ${unit} written off.`);
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The loss wasn’t logged. Try again.'),
  });

  return (
    <Drawer
      title="Log waste"
      description="Write off stock that expired, broke or went missing — it comes off what’s on hand straight away."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form={LOG_LOSS_FORM} variant="destructive" size="lg" className="flex-1" disabled={isPending}>
            {isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <PackageMinus aria-hidden="true" />}
            Write off{!errors.qty && selected ? ` ${fmtQty(n)} ${unit}` : ''}
          </Button>
        </div>
      }
    >
      <form
        id={LOG_LOSS_FORM}
        noValidate
        className="space-y-7"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (valid) submit({ stockItemId, locationId, quantity: n, reason, notes: notes.trim() || undefined });
        }}
      >
        {fixed && selected ? (
          <ItemCard
            name={selected.stockItem?.name ?? 'Item'}
            status={getStatus(selected)}
            qty={onHand}
            par={Number(selected.lowThreshold) || 0}
            unit={unit}
            category={selected.stockItem?.category}
          />
        ) : (
          <FormSection icon={Package} title="What">
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Location</Label>
              <Select
                value={locationId}
                onValueChange={(value) => {
                  setLocationId(value);
                  setStockItemId('');
                }}
                options={[
                  { value: '', label: 'Choose a location' },
                  ...locations.map((location) => ({ value: location.id, label: location.name })),
                ]}
                ariaLabel="Location"
                ariaInvalid={submitted && !!errors.location}
                className="w-full"
              />
              {submitted && errors.location && <p className="text-xs text-destructive">{errors.location}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label uppercase>Item</Label>
              <Select
                value={stockItemId}
                onValueChange={setStockItemId}
                options={[
                  {
                    value: '',
                    label: loadingStock
                      ? 'Loading…'
                      : !locationId
                        ? 'Choose a location first'
                        : availableItems.length === 0
                          ? 'Nothing in stock here'
                          : 'Choose an item',
                  },
                  ...availableItems.map((row) => ({ value: row.stockItemId, label: row.stockItem!.name })),
                ]}
                ariaLabel="Item"
                ariaInvalid={submitted && !!errors.item}
                disabled={!locationId || loadingStock}
                className="w-full"
              />
              {submitted && errors.item && <p className="text-xs text-destructive">{errors.item}</p>}
            </div>
          </FormSection>
        )}

        <FormSection icon={PackageMinus} title="How much">
          <Input
            label="Quantity lost"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputMode="decimal"
            placeholder="0"
            autoFocus={fixed}
            rightIcon={<span className="text-xs">{unit}</span>}
            error={submitted ? (errors.qty ?? undefined) : undefined}
          />
          {selected && (
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {!errors.qty ? (
                  <>
                    Leaves{' '}
                    <span className="font-semibold text-foreground">
                      {fmtQty(onHand - n)} {unit}
                    </span>
                    {cost != null && (
                      <>
                        {' '}
                        · costs <span className="font-semibold text-exception">{money(n * cost)}</span> at last cost
                      </>
                    )}
                  </>
                ) : (
                  `${fmtQty(onHand)} ${unit} on hand`
                )}
              </span>
              <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setQty(String(onHand))}>
                All of it
              </button>
            </div>
          )}
        </FormSection>

        <FormSection icon={TriangleAlert} title="Why">
          <ChoiceCards columns={4} value={reason} onChange={setReason} options={LOSS_REASONS} />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional — what happened, e.g. found at the back of the fridge"
            maxLength={500}
            rows={2}
            aria-label="Note"
            className={TEXTAREA}
          />
        </FormSection>
      </form>
    </Drawer>
  );
}

const TEXTAREA =
  'w-full resize-none rounded-md border border-input bg-control px-3 py-2 text-base text-foreground shadow-sm outline-none placeholder:text-muted-foreground focus:border-measured focus:outline-2 focus:outline-measured sm:text-sm';

/** The item a drawer acts on, as a stock row shows it: a health-tinted tile, the level against par. */
function ItemCard({
  name,
  status,
  qty,
  par,
  unit,
  category,
}: {
  name: string;
  status: StockStatus;
  qty: number;
  par: number;
  unit: string;
  category?: string | null;
}) {
  const glyph = statusGlyph(status, category);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-rule/60 bg-card px-4 py-3.5">
      <span
        className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', TONE_TINT[STATUS_TONE[status]])}
        role="img"
        aria-label={glyph.label}
        title={glyph.label}
      >
        <glyph.icon size={18} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          {status !== 'ok' && <Pill tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Pill>}
        </p>
        <p className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
          <ParMeter qty={qty} par={par} unit={unit} status={status} className="w-20 shrink-0" />
          <span className="truncate">
            {fmtQty(qty)} {unit} on hand{par > 0 && ` · par ${fmtQty(par)}`}
          </span>
        </p>
      </div>
    </div>
  );
}

// ── Edit catalogue item (name / unit) ─────────────────────────────────────────

export function EditStockItemDrawer({
  item,
  onClose,
  onSuccess,
}: {
  item: Pick<
    StockItem,
    | 'id'
    | 'name'
    | 'barcode'
    | 'unit'
    | 'category'
    | 'isPerishable'
    | 'defaultShelfLifeDays'
    | 'defaultContainerQuantity'
    | 'defaultReorderLevel'
    | 'defaultReorderQuantity'
    | 'nutritionBasis'
    | 'nutrition'
    | 'allergens'
    | 'imageUrl'
  >;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(item.name);
  const [imageUrl, setImageUrl] = useState<string | null>(item.imageUrl ?? null);
  const [barcode, setBarcode] = useState(item.barcode ?? '');
  const [unit, setUnit] = useState(item.unit);
  const [category, setCategory] = useState(item.category);
  const [isPerishable, setIsPerishable] = useState(item.isPerishable);
  const [shelfLife, setShelfLife] = useState(item.defaultShelfLifeDays ? String(item.defaultShelfLifeDays) : '');
  const [containerQuantity, setContainerQuantity] = useState(
    item.defaultContainerQuantity ? String(Number(item.defaultContainerQuantity)) : '',
  );
  const [reorderLevel, setReorderLevel] = useState(item.defaultReorderLevel ? String(Number(item.defaultReorderLevel)) : '');
  const [reorderQuantity, setReorderQuantity] = useState(item.defaultReorderQuantity ? String(Number(item.defaultReorderQuantity)) : '');
  const [nutrition, setNutrition] = useState<NutritionDraft>(() => nutritionDraftFrom(item.nutritionBasis, item.nutrition));
  const [allergens, setAllergens] = useState<Allergen[]>((item.allergens ?? []) as Allergen[]);
  const [submitted, setSubmitted] = useState(false);

  const positive = (value: string, allowZero = true) =>
    value.trim() === '' || (Number.isFinite(Number(value)) && (allowZero ? Number(value) >= 0 : Number(value) > 0));
  const errors = {
    name: name.trim().length < 1 ? 'A name is needed.' : null,
    unit: unit.trim().length < 1 ? 'A unit is needed, e.g. kg, l or pcs.' : null,
    shelfLife: isPerishable && !positive(shelfLife, false) ? 'Whole days, 1 or more.' : null,
    containerQuantity: !positive(containerQuantity, false) ? 'More than 0, or leave blank.' : null,
    reorderLevel: !positive(reorderLevel) ? '0 or more.' : null,
    reorderQuantity: !positive(reorderQuantity, false) ? 'More than 0, or leave blank.' : null,
  };
  const valid = Object.values(errors).every((e) => e === null);
  const show = (key: keyof typeof errors) => (submitted ? (errors[key] ?? undefined) : undefined);
  const unitChanged = unit.trim() !== item.unit;

  const { mutate, isPending } = useMutation({
    mutationFn: () =>
      updateStockItem(item.id, {
        name: name.trim(),
        barcode: barcode.trim() || null,
        unit: unit.trim(),
        category,
        isPerishable,
        defaultShelfLifeDays: isPerishable && shelfLife ? Number(shelfLife) : null,
        defaultContainerQuantity: containerQuantity ? Number(containerQuantity) : null,
        defaultReorderLevel: reorderLevel ? Number(reorderLevel) : null,
        defaultReorderQuantity: reorderQuantity ? Number(reorderQuantity) : null,
        ...nutritionPayload(nutrition),
        allergens: allergens.length > 0 ? allergens : null,
        imageUrl,
      }),
    onSuccess: () => {
      onSuccess();
      toast('success', 'Item updated.');
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The item wasn’t saved. Check the fields and try again.'),
  });

  return (
    <Drawer
      title="Edit item"
      description="The catalogue record — shared by every location that stocks it."
      onClose={onClose}
      footer={
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="lg" className="flex-1" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form={EDIT_ITEM_FORM} size="lg" className="flex-1" disabled={isPending}>
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save changes
          </Button>
        </div>
      }
    >
      <form
        id={EDIT_ITEM_FORM}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
          if (valid) mutate();
        }}
        className="space-y-7"
      >
        <FormSection icon={Package} title="Item">
          <div className="flex flex-col gap-1.5">
            <Label uppercase>Photo</Label>
            <StockItemPhotoField value={imageUrl} onChange={setImageUrl} />
          </div>
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={255} error={show('name')} />
          <div className="flex flex-col gap-1.5">
            <Label uppercase>Category</Label>
            <ChoiceCards
              columns={4}
              value={category}
              onChange={(value) => setCategory(value as StockItem['category'])}
              options={STOCK_CATEGORY_OPTIONS}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="kg, l, pcs…"
              required
              error={show('unit')}
            />
            <Input
              label="Barcode"
              value={barcode}
              onChange={(e) => setBarcode(e.target.value)}
              placeholder="Scan or type"
              maxLength={255}
              inputMode="numeric"
              autoComplete="off"
              leftIcon={<Barcode size={14} />}
            />
          </div>
          {unitChanged && (
            <p className="flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs text-measured">
              <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
              Changing the unit relabels stock at every location — quantities aren’t converted. Only change it to fix a mistake.
            </p>
          )}
        </FormSection>

        <FormSection icon={Timer} title="Storage">
          <SettingRows>
            <SettingRow title="Perishable" description="Containers get a use-by date and expiring stock is flagged.">
              <Switch label="Perishable" checked={isPerishable} onChange={setIsPerishable} />
            </SettingRow>
          </SettingRows>
          <div className="grid gap-3 sm:grid-cols-2">
            {isPerishable && (
              <Input
                label="Shelf life"
                value={shelfLife}
                onChange={(e) => setShelfLife(e.target.value)}
                inputMode="numeric"
                placeholder="—"
                rightIcon={<span className="text-xs">days</span>}
                hint="Dates a container when no use-by is given."
                error={show('shelfLife')}
              />
            )}
            <Input
              label="Container size"
              value={containerQuantity}
              onChange={(e) => setContainerQuantity(e.target.value)}
              inputMode="decimal"
              placeholder="—"
              rightIcon={<span className="text-xs">{unit.trim() || 'units'}</span>}
              hint="How much one bottle, bag or box holds."
              error={show('containerQuantity')}
            />
          </div>
        </FormSection>

        <FormSection
          icon={PackagePlus}
          title="Reorder defaults"
          note="Used when a location starts stocking it. Each location can change its own par."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Par"
              value={reorderLevel}
              onChange={(e) => setReorderLevel(e.target.value)}
              inputMode="decimal"
              placeholder="—"
              rightIcon={<span className="text-xs">{unit.trim() || 'units'}</span>}
              error={show('reorderLevel')}
            />
            <Input
              label="Reorder quantity"
              value={reorderQuantity}
              onChange={(e) => setReorderQuantity(e.target.value)}
              inputMode="decimal"
              placeholder="—"
              rightIcon={<span className="text-xs">{unit.trim() || 'units'}</span>}
              error={show('reorderQuantity')}
            />
          </div>
        </FormSection>

        <FormSection icon={Flame} title="Nutrition & allergens" note="Feeds the menu’s nutrition and allergen labels through recipes.">
          <NutritionFields draft={nutrition} onChange={setNutrition} allergens={allergens} onAllergensChange={setAllergens} />
        </FormSection>
      </form>
    </Drawer>
  );
}
