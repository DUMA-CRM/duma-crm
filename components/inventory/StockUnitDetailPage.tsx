'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  Coins,
  Barcode,
  Box,
  CalendarClock,
  CalendarDays,
  FileText,
  Gauge,
  History,
  type IconComponent,
  Loader2,
  MapPin,
  Package,
  PackageMinus,
  PackageOpen,
  Scale,
  Tag,
  Trash2,
  X,
} from '@/components/icons';
import { SetContainerCostDrawer, useFormatUnitCost } from '@/components/inventory/item/ContainerCost';
import { LedgerRow } from '@/components/inventory/item/LedgerSection';
import { fmtQty } from '@/components/inventory/stock/shared';
import { CopyButton, RecordBlock, RecordList, RecordListRow } from '@/components/people/record/shared';
import { SECTION_RISE, SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Fact, SettingRow, SettingRows } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { EditorShell } from '@/components/shared/EditorShell';
import { ErrorState } from '@/components/shared/ErrorState';
import { ChoiceCards, FormSection } from '@/components/shared/FormParts';
import { Bone, LoadingState, RowSkeleton } from '@/components/shared/Skeleton';
import { useWorkspaceMoney } from '@/components/shared/useWorkspaceMoney';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

import { hasCapability } from '@/lib/auth/capabilities';
import {
  type StockUnit,
  adjustStockUnit,
  discardStockUnit,
  getStockUnit,
  getStockUnitLedger,
  wasteStockUnit,
} from '@/lib/modules/inventory/client';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { cn } from '@/lib/utils/cn';
import { type ContainerStatus, isActive } from '@/lib/utils/containers';
import { groupByDay } from '@/lib/utils/ledger';
import { containerPrice } from '@/lib/utils/stock-cost';
import { daysUntil, expiryLabel } from '@/lib/utils/stock-item';
import { useAuthStore } from '@/stores/authStore';
import { toast } from '@/stores/toastStore';

/*
 * One physical container, laid out as the item page is: a profile panel with
 * its balance, use-by, opened and received; its history by day; and beside it
 * the details and the three things you can do to it — correct the balance, log
 * some as waste, or throw the rest away. Each opens a drawer.
 */

type WasteReason = 'EXPIRED' | 'SPILL' | 'DAMAGED' | 'QUALITY' | 'OTHER';

const WASTE_REASONS: { value: WasteReason; label: string }[] = [
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'SPILL', label: 'Spilt' },
  { value: 'DAMAGED', label: 'Damaged' },
  { value: 'QUALITY', label: 'Quality' },
  { value: 'OTHER', label: 'Other' },
];

const STATUS: Record<ContainerStatus, { label: string; tile: string; pill: string; icon: IconComponent }> = {
  IN_USE: { label: 'Open', tile: 'bg-measured/10 text-measured', pill: 'bg-measured/10 text-measured', icon: PackageOpen },
  AVAILABLE: { label: 'Sealed', tile: 'bg-primary/8 text-primary', pill: 'bg-momentum/8 text-momentum', icon: Box },
  EXPIRED: { label: 'Expired', tile: 'bg-exception/8 text-exception', pill: 'bg-exception/8 text-exception', icon: Box },
  EMPTY: { label: 'Empty', tile: 'bg-band text-muted-foreground', pill: 'bg-band text-muted-foreground', icon: Box },
  DISCARDED: { label: 'Discarded', tile: 'bg-band text-muted-foreground', pill: 'bg-band text-muted-foreground', icon: X },
};

const EXPIRY_SOURCE: Record<StockUnit['expirySource'], string> = {
  SUPPLIER: 'from the supplier',
  MANUAL: 'entered by hand',
  DEFAULT_SHELF_LIFE: 'from the shelf life',
  NOT_APPLICABLE: 'doesn’t expire',
};

const day = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const precise = (n: number) => String(Math.round(n * 1000) / 1000);

export function StockUnitDetailPage({ stockUnitId }: { stockUnitId: string }) {
  const router = useRouter();
  const capabilities = useAuthStore((state) => state.capabilities);
  const canAdjust = hasCapability(capabilities, 'inventory:write');
  const canWaste = hasCapability(capabilities, 'inventory:waste');
  const [drawer, setDrawer] = useState<'adjust' | 'waste' | 'discard' | 'cost' | null>(null);
  const [now] = useState(() => new Date());

  const unitQuery = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stock-unit', stockUnitId),
    queryFn: () => getStockUnit(stockUnitId),
  });
  const ledgerQuery = useQuery({
    queryKey: moduleQueryKeys.inventory.key('stock-unit-ledger', stockUnitId),
    queryFn: () => getStockUnitLedger(stockUnitId),
  });
  const unit = unitQuery.data;
  const backHref = unit ? `/inventory/items/${unit.stockItemId}` : '/inventory';

  return (
    <EditorShell
      eyebrow="Container"
      title={unit?.label ?? (unitQuery.isPending ? 'Loading…' : 'Container')}
      icon={<PackageOpen size={20} aria-hidden="true" />}
      onClose={() => router.push(backHref)}
    >
      {unitQuery.isError ? (
        <ErrorState title="Couldn’t load this container" onRetry={() => void unitQuery.refetch()} />
      ) : !unit ? (
        <LoadingState label="Loading the container" />
      ) : (
        <UnitBody
          unit={unit}
          ledger={ledgerQuery.data}
          ledgerError={ledgerQuery.isError}
          onRetryLedger={() => void ledgerQuery.refetch()}
          now={now}
          canAdjust={canAdjust}
          canWaste={canWaste}
          onAction={setDrawer}
        />
      )}

      {unit && drawer === 'adjust' && <AdjustDrawer unit={unit} onClose={() => setDrawer(null)} />}
      {unit && drawer === 'waste' && <WasteDrawer unit={unit} onClose={() => setDrawer(null)} />}
      {unit && drawer === 'discard' && <DiscardDrawer unit={unit} onClose={() => setDrawer(null)} />}
      {unit && drawer === 'cost' && <CostDrawer unit={unit} onClose={() => setDrawer(null)} />}
    </EditorShell>
  );
}

function UnitBody({
  unit,
  ledger,
  ledgerError,
  onRetryLedger,
  now,
  canAdjust,
  canWaste,
  onAction,
}: {
  unit: StockUnit;
  ledger?: Awaited<ReturnType<typeof getStockUnitLedger>>;
  ledgerError: boolean;
  onRetryLedger: () => void;
  now: Date;
  canAdjust: boolean;
  canWaste: boolean;
  onAction: (action: 'adjust' | 'waste' | 'discard' | 'cost') => void;
}) {
  const money = useWorkspaceMoney();
  const unitCost = useFormatUnitCost();
  const meta = STATUS[unit.status];
  const remaining = Number(unit.remainingQuantity);
  const initial = Number(unit.initialQuantity);
  const itemCost = unit.stockItem?.costPerUnit;
  const ownPrice = containerPrice(unit.unitCost, initial);
  const share = initial > 0 ? Math.min(1, remaining / initial) : 0;
  const days = unit.expiryDate ? daysUntil(unit.expiryDate, now) : null;
  const expiry = expiryLabel(unit.expiryDate ?? null, now);
  const active = isActive(unit) || unit.status === 'EXPIRED';
  const itemName = unit.stockItem?.name;
  const history = groupByDay(ledger ?? [], now);
  const actionable = active && remaining > 0 && (canAdjust || canWaste);

  return (
    <motion.div className="space-y-5" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.06 } } }}>
      {unit.status === 'EXPIRED' && remaining > 0 && (
        <motion.div
          variants={SECTION_RISE}
          className="flex items-center gap-3 rounded-lg border border-exception/30 bg-exception/5 px-3.5 py-3"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-exception/8 text-exception" aria-hidden="true">
            <CalendarClock size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Past its use-by date</span>
            <span className="block text-xs text-muted-foreground">
              {fmtQty(remaining)} {unit.unitOfMeasure} still recorded. Throw it away so stock stays true.
            </span>
          </span>
          {canWaste && (
            <Button variant="outline" size="sm" onClick={() => onAction('discard')}>
              Discard
            </Button>
          )}
        </motion.div>
      )}

      <SettingsTabBody
        aside={
          <>
            <RecordBlock id="unit-details" label="Details">
              <RecordList>
                {itemName && (
                  <RecordListRow
                    icon={Package}
                    tone="reference"
                    label="Item"
                    value={itemName}
                    href={`/inventory/items/${unit.stockItemId}`}
                  />
                )}
                {unit.location?.name && <RecordListRow icon={MapPin} tone="reference" label="Location" value={unit.location.name} />}
                <RecordListRow icon={Tag} tone="reference" label="Lot" value={unit.lotNumber} placeholder="No lot number" />
                <RecordListRow icon={Barcode} tone="reference" label="Barcode" value={unit.barcode} placeholder="No barcode" />
                {unit.notes && <RecordListRow icon={FileText} tone="muted" label="Note" value={unit.notes} />}
                {/* What this container was bought for; without its own, it follows the item's cost. */}
                <RecordListRow
                  icon={Coins}
                  tone="money"
                  label="Cost"
                  value={ownPrice !== null ? `${money(ownPrice)} a container` : undefined}
                  detail={
                    unit.unitCost != null
                      ? `${unitCost(Number(unit.unitCost))} per ${unit.unitOfMeasure}`
                      : itemCost
                        ? `Follows the item — ${unitCost(Number(itemCost))} per ${unit.unitOfMeasure}`
                        : undefined
                  }
                  placeholder={itemCost ? 'Item’s cost' : 'No cost yet'}
                  trailing={
                    canAdjust && (
                      <Button variant="outline" size="sm" onClick={() => onAction('cost')}>
                        {unit.unitCost != null ? 'Change' : 'Set'}
                      </Button>
                    )
                  }
                />
                <RecordListRow
                  icon={Tag}
                  tone="muted"
                  label="Container ID"
                  value={`#${unit.id.slice(0, 8).toUpperCase()}`}
                  trailing={<CopyButton value={unit.id} label="container ID" />}
                />
              </RecordList>
            </RecordBlock>

            {actionable ? (
              <SettingsSection title="Actions">
                <SettingRows>
                  {canAdjust && (
                    <SettingRow
                      icon={Scale}
                      title="Correct the balance"
                      description="After a count — set what’s really in it. The difference goes in the history."
                    >
                      <Button variant="outline" size="sm" onClick={() => onAction('adjust')}>
                        Correct
                      </Button>
                    </SettingRow>
                  )}
                  {canWaste && (
                    <SettingRow
                      icon={PackageMinus}
                      title="Log waste"
                      description="Some was spilt, damaged or went off. The rest stays in use."
                    >
                      <Button variant="outline" size="sm" onClick={() => onAction('waste')}>
                        Log waste
                      </Button>
                    </SettingRow>
                  )}
                  {canWaste && (
                    <SettingRow
                      icon={Trash2}
                      title="Discard container"
                      description="Throw the rest away. The container is closed and what’s left is written off."
                    >
                      <Button variant="destructive" size="sm" onClick={() => onAction('discard')}>
                        Discard
                      </Button>
                    </SettingRow>
                  )}
                </SettingRows>
              </SettingsSection>
            ) : (
              !active && (
                <p className="rounded-lg border border-rule/60 bg-card px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  {unit.status === 'DISCARDED' ? 'This container was thrown away' : 'This container is used up'}
                  {unit.discardedAt ? ` on ${day(unit.discardedAt)}` : ''}. Its history stays here for the record.
                </p>
              )
            )}
          </>
        }
      >
        <SettingsSection>
          <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
            <span className={cn('flex size-20 shrink-0 items-center justify-center rounded-xl shadow-sm', meta.tile)} aria-hidden="true">
              <meta.icon size={34} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-2xl font-semibold tracking-headline text-foreground">{unit.label}</p>
              <p className="mt-2 flex justify-center sm:justify-start">
                <span className={cn('rounded-sm px-1.5 py-0.5 text-micro font-semibold', meta.pill)}>{meta.label}</span>
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <Fact
              icon={Scale}
              label="Remaining"
              value={`${precise(remaining)} / ${precise(initial)} ${unit.unitOfMeasure}`}
              hint={`${Math.round(share * 100)}% left`}
              tone={active && remaining > 0 && share <= 0.2 ? 'warning' : 'default'}
            />
            <Fact
              icon={CalendarClock}
              label="Use-by"
              value={expiry ?? '—'}
              tone={days === null || !active ? 'default' : days < 0 ? 'danger' : days <= 2 ? 'warning' : 'default'}
              hint={unit.expiryDate ? `${day(unit.expiryDate)} · ${EXPIRY_SOURCE[unit.expirySource]}` : 'Doesn’t expire'}
            />
            <Fact
              icon={PackageOpen}
              label="Opened"
              value={unit.openedAt ? day(unit.openedAt) : 'Sealed'}
              hint={unit.openedAt ? undefined : 'Not opened yet'}
            />
            <Fact
              icon={CalendarDays}
              label="Received"
              value={day(unit.createdAt)}
              hint={unit.createdByUser?.name ? `by ${unit.createdByUser.name}` : undefined}
            />
          </dl>

          <div className="mt-5">
            <div className="h-2 overflow-hidden rounded-full bg-band">
              <motion.div
                className={cn(
                  'h-full rounded-full',
                  !active
                    ? 'bg-muted-foreground/40'
                    : unit.status === 'EXPIRED'
                      ? 'bg-exception/70'
                      : share <= 0.2
                        ? 'bg-measured'
                        : 'bg-primary',
                )}
                initial={{ width: 0 }}
                animate={{ width: `${share * 100}%` }}
                transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </div>
        </SettingsSection>

        <motion.section variants={SECTION_RISE} aria-labelledby="unit-history" className="space-y-4">
          <h2 id="unit-history" className="text-base font-semibold tracking-title text-foreground">
            History
          </h2>
          {ledgerError ? (
            <ErrorState title="Couldn’t load the history" onRetry={onRetryLedger} />
          ) : !ledger ? (
            // A day: its label, then the card of movements.
            <div role="status" aria-busy="true" aria-label="Loading the history">
              <Bone className="mb-2 h-3 w-24" />
              <div className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                {Array.from({ length: 2 }, (_, index) => (
                  <RowSkeleton key={index} index={index} />
                ))}
              </div>
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-rule/60 bg-card px-4 py-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/8 text-primary" aria-hidden="true">
                <History size={18} />
              </span>
              <p className="text-sm text-muted-foreground">Nothing has happened to this container since it was received.</p>
            </div>
          ) : (
            history.map((group) => (
              <section key={group.key} aria-label={group.label}>
                <h3 className="mb-2 text-label uppercase text-muted-foreground">{group.label}</h3>
                <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
                  {group.items.map((movement) => (
                    <LedgerRow key={movement.id} movement={movement} fallbackUnit={unit.unitOfMeasure} showContainer={false} />
                  ))}
                </ul>
              </section>
            ))
          )}
        </motion.section>
      </SettingsTabBody>
    </motion.div>
  );
}

// ── Drawers ──────────────────────────────────────────────────────────────────

function CostDrawer({ unit, onClose }: { unit: StockUnit; onClose: () => void }) {
  const refresh = useRefresh(unit);
  return (
    <SetContainerCostDrawer
      units={[unit]}
      item={{ unit: unit.unitOfMeasure, costPerUnit: unit.stockItem?.costPerUnit ?? null }}
      onClose={onClose}
      onDone={() => {
        refresh();
        onClose();
      }}
    />
  );
}

function useRefresh(unit: StockUnit) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-unit', unit.id) });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-unit-ledger', unit.id) });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-units') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('stock-movements') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('inventory-overview') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('location-stock') });
    void qc.invalidateQueries({ queryKey: moduleQueryKeys.inventory.key('loss-log') });
  };
}

function Footer({
  pending,
  label,
  icon: Icon,
  destructive,
  form,
  onCancel,
}: {
  pending: boolean;
  label: string;
  icon: IconComponent;
  destructive?: boolean;
  form: string;
  onCancel: () => void;
}) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="lg" className="flex-1" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type="submit" form={form} variant={destructive ? 'destructive' : 'default'} size="lg" className="flex-1" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
        {label}
      </Button>
    </div>
  );
}

function UnitCard({ unit }: { unit: StockUnit }) {
  const meta = STATUS[unit.status];
  return (
    <div className="flex items-center gap-3 rounded-lg border border-rule/60 bg-card px-4 py-3.5">
      <span className={cn('flex size-10 shrink-0 items-center justify-center rounded-lg', meta.tile)} aria-hidden="true">
        <meta.icon size={18} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-foreground">{unit.label}</p>
        <p className="truncate text-xs text-muted-foreground">
          {precise(Number(unit.remainingQuantity))} of {precise(Number(unit.initialQuantity))} {unit.unitOfMeasure} left
        </p>
      </div>
      <span className={cn('shrink-0 rounded-sm px-1.5 py-0.5 text-micro font-semibold', meta.pill)}>{meta.label}</span>
    </div>
  );
}

const readQty = (value: string) => Number(value.trim().replace(',', '.'));

function AdjustDrawer({ unit, onClose }: { unit: StockUnit; onClose: () => void }) {
  const refresh = useRefresh(unit);
  const current = Number(unit.remainingQuantity);
  const [value, setValue] = useState(precise(current));
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const n = readQty(value);
  const error = value.trim() === '' || !Number.isFinite(n) || n < 0 ? 'Enter 0 or more.' : null;
  const delta = error ? 0 : Math.round((n - current) * 1000) / 1000;

  const adjust = useMutation({
    mutationFn: () => adjustStockUnit(unit.id, { quantity: n, reason: 'COUNT_CORRECTION', notes: notes.trim() || undefined }),
    onSuccess: () => {
      refresh();
      toast('success', `Balance set to ${precise(n)} ${unit.unitOfMeasure}.`);
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The balance wasn’t corrected. Try again.'),
  });

  return (
    <Drawer
      title="Correct the balance"
      description="Set what’s really in the container after a count."
      onClose={onClose}
      footer={<Footer form="unit-adjust" pending={adjust.isPending} label="Save balance" icon={Scale} onCancel={onClose} />}
    >
      <form
        id="unit-adjust"
        noValidate
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (!error && delta !== 0) adjust.mutate();
          else if (!error) onClose();
        }}
      >
        <UnitCard unit={unit} />
        <FormSection icon={Gauge} title="Counted">
          <Input
            label="What’s in it now"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="decimal"
            autoFocus
            rightIcon={<span className="text-xs">{unit.unitOfMeasure}</span>}
            error={submitted ? (error ?? undefined) : undefined}
          />
          {!error && (
            <p className={cn('text-xs', delta === 0 ? 'text-muted-foreground' : delta < 0 ? 'text-exception' : 'text-primary')}>
              {delta === 0
                ? 'No change from the recorded balance.'
                : `${delta > 0 ? '+' : '−'}${precise(Math.abs(delta))} ${unit.unitOfMeasure} against the recorded ${precise(current)}.`}
            </p>
          )}
        </FormSection>
        <FormSection icon={FileText} title="Note">
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            placeholder="Optional — e.g. weekly count"
            aria-label="Note"
          />
        </FormSection>
      </form>
    </Drawer>
  );
}

function WasteDrawer({ unit, onClose }: { unit: StockUnit; onClose: () => void }) {
  const refresh = useRefresh(unit);
  const remaining = Number(unit.remainingQuantity);
  const [value, setValue] = useState('');
  const [reason, setReason] = useState<WasteReason>(unit.status === 'EXPIRED' ? 'EXPIRED' : 'SPILL');
  const [notes, setNotes] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const n = readQty(value);
  const error =
    value.trim() === '' || !Number.isFinite(n) || n <= 0
      ? 'Enter how much was wasted.'
      : n > remaining
        ? `Only ${precise(remaining)} ${unit.unitOfMeasure} left in it.`
        : null;

  const waste = useMutation({
    mutationFn: () => wasteStockUnit(unit.id, { quantity: n, reason, notes: notes.trim() || undefined }),
    onSuccess: () => {
      refresh();
      toast('success', `${precise(n)} ${unit.unitOfMeasure} written off.`);
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The waste wasn’t recorded. Try again.'),
  });

  return (
    <Drawer
      title="Log waste"
      description="Write off part of this container. The rest stays in use."
      onClose={onClose}
      footer={
        <Footer
          form="unit-waste"
          pending={waste.isPending}
          label={error ? 'Write off' : `Write off ${precise(n)} ${unit.unitOfMeasure}`}
          icon={PackageMinus}
          destructive
          onCancel={onClose}
        />
      }
    >
      <form
        id="unit-waste"
        noValidate
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (!error) waste.mutate();
        }}
      >
        <UnitCard unit={unit} />
        <FormSection icon={PackageMinus} title="How much">
          <Input
            label="Wasted"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            inputMode="decimal"
            autoFocus
            placeholder="0"
            rightIcon={<span className="text-xs">{unit.unitOfMeasure}</span>}
            error={submitted ? (error ?? undefined) : undefined}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {!error ? `Leaves ${precise(remaining - n)} ${unit.unitOfMeasure} in it` : `${precise(remaining)} ${unit.unitOfMeasure} left`}
            </span>
            <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setValue(precise(remaining))}>
              All of it
            </button>
          </div>
        </FormSection>
        <FormSection icon={FileText} title="Why">
          <ChoiceCards columns={3} value={reason} onChange={setReason} options={WASTE_REASONS} />
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            placeholder="Optional — what happened"
            aria-label="Note"
          />
        </FormSection>
      </form>
    </Drawer>
  );
}

function DiscardDrawer({ unit, onClose }: { unit: StockUnit; onClose: () => void }) {
  const refresh = useRefresh(unit);
  const remaining = Number(unit.remainingQuantity);
  const [reason, setReason] = useState<WasteReason>(unit.status === 'EXPIRED' ? 'EXPIRED' : 'QUALITY');
  const [notes, setNotes] = useState('');

  const discard = useMutation({
    mutationFn: () => discardStockUnit(unit.id, { reason, notes: notes.trim() || undefined }),
    onSuccess: () => {
      refresh();
      toast('success', `${unit.label} discarded — ${precise(remaining)} ${unit.unitOfMeasure} written off.`);
      onClose();
    },
    onError: (err) => toast('error', err.message || 'The container wasn’t discarded. Try again.'),
  });

  return (
    <Drawer
      title="Discard container"
      description="Throw away what’s left. This can’t be undone."
      onClose={onClose}
      footer={
        <Footer
          form="unit-discard"
          pending={discard.isPending}
          label={`Discard ${precise(remaining)} ${unit.unitOfMeasure}`}
          icon={Trash2}
          destructive
          onCancel={onClose}
        />
      }
    >
      <form
        id="unit-discard"
        noValidate
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          discard.mutate();
        }}
      >
        <UnitCard unit={unit} />
        <p className="rounded-md bg-exception/6 px-3 py-2 text-xs leading-relaxed text-exception">
          The remaining {precise(remaining)} {unit.unitOfMeasure} is written off as waste and the container is closed. Its history is kept.
        </p>
        <FormSection icon={FileText} title="Why">
          <ChoiceCards columns={3} value={reason} onChange={setReason} options={WASTE_REASONS} />
          <Input
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            placeholder="Optional — what happened"
            aria-label="Note"
          />
        </FormSection>
      </form>
    </Drawer>
  );
}
