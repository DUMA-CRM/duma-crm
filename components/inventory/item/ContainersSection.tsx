'use client';

import { useMutation } from '@tanstack/react-query';
import { motion } from 'motion/react';
import Link from 'next/link';
import { useState } from 'react';

import { Box, ChevronRight, Combine, type IconComponent, Loader2, PackageOpen, Plus, Scissors, X } from '@/components/icons';
import { fmtQty, formatDate } from '@/components/inventory/stock/shared';
import { SECTION_RISE } from '@/components/settings/SettingsSection';
import { Drawer } from '@/components/shared/Drawer';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { FormSection, NumberStepper } from '@/components/shared/FormParts';
import { Pill } from '@/components/shared/Pill';
import { ListSkeleton } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

import { type StockItem, type StockUnit, combineStockUnits, receiveStockUnits, splitStockUnit } from '@/lib/modules/inventory/client';
import { cn } from '@/lib/utils/cn';
import {
  type ContainerStatus,
  type ContainerView,
  byUseFirst,
  inContainerView,
  isActive,
  nextToUse,
  splitParts,
  totalRemaining,
} from '@/lib/utils/containers';
import { daysUntil, expiryLabel } from '@/lib/utils/stock-item';
import { toast } from '@/stores/toastStore';

/*
 * An item's physical containers in the audit-log vocabulary: a view selector,
 * then one row per container in use-first order (open, then earliest expiry)
 * with the next one to reach for marked. Selecting containers raises a bar to
 * split or combine them; receiving is a drawer.
 */

/** Split parts are exact to the thousandth; one decimal would show 0.334 as 0.3. */
const preciseQty = (n: number) => String(Math.round(n * 1000) / 1000);

const STATUS: Record<ContainerStatus, { label: string; tile: string; icon: IconComponent }> = {
  IN_USE: { label: 'Open', tile: 'bg-measured/10 text-measured', icon: PackageOpen },
  AVAILABLE: { label: 'Sealed', tile: 'bg-primary/8 text-primary', icon: Box },
  EXPIRED: { label: 'Expired', tile: 'bg-exception/8 text-exception', icon: Box },
  EMPTY: { label: 'Empty', tile: 'bg-band text-muted-foreground', icon: Box },
  DISCARDED: { label: 'Discarded', tile: 'bg-band text-muted-foreground', icon: X },
};

export function ContainersSection({
  item,
  locationId,
  units,
  loading,
  error,
  onRetry,
  canWrite,
  onChanged,
}: {
  item: StockItem;
  locationId: string | null;
  units: StockUnit[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
  canWrite: boolean;
  onChanged: () => void;
}) {
  const [view, setView] = useState<ContainerView>('active');
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [drawer, setDrawer] = useState<'receive' | 'split' | 'combine' | null>(null);
  const [now] = useState(() => new Date());

  const ordered = byUseFirst(units);
  const shown = ordered.filter((u) => inContainerView(view, u));
  const next = nextToUse(units);
  const counts: Record<ContainerView, number> = {
    active: units.filter((u) => inContainerView('active', u)).length,
    expired: units.filter((u) => inContainerView('expired', u)).length,
    finished: units.filter((u) => inContainerView('finished', u)).length,
    all: units.length,
  };
  const selectedUnits = units.filter((u) => selected.has(u.id));
  const clear = () => setSelected(new Set());
  const toggle = (id: string) =>
    setSelected((current) => {
      const nextSet = new Set(current);
      if (nextSet.has(id)) nextSet.delete(id);
      else nextSet.add(id);
      return nextSet;
    });
  const done = () => {
    setDrawer(null);
    clear();
    onChanged();
  };

  if (!locationId) return null;

  return (
    <motion.div className="space-y-4" initial="hidden" animate="shown" variants={{ shown: { transition: { staggerChildren: 0.05 } } }}>
      <motion.div variants={SECTION_RISE} className="flex flex-wrap items-center gap-2">
        <Select
          value={view}
          onValueChange={(value) => {
            setView(value as ContainerView);
            clear();
          }}
          ariaLabel="Show"
          options={[
            { value: 'active', label: `In stock · ${counts.active}` },
            { value: 'expired', label: `Expired · ${counts.expired}` },
            { value: 'finished', label: `Empty or discarded · ${counts.finished}` },
            { value: 'all', label: `All containers · ${counts.all}` },
          ]}
          className="w-56"
        />
        <span className="text-xs text-muted-foreground">
          {view === 'active' && counts.active > 0
            ? `${fmtQty(totalRemaining(units.filter(isActive)))} ${item.unit} in ${counts.active} ${counts.active === 1 ? 'container' : 'containers'} · open first, then earliest expiry`
            : null}
        </span>
        {canWrite && (
          <Button className="ml-auto" onClick={() => setDrawer('receive')}>
            <Plus aria-hidden="true" /> Receive containers
          </Button>
        )}
      </motion.div>

      {counts.expired > 0 && view === 'active' && (
        <motion.button
          variants={SECTION_RISE}
          type="button"
          onClick={() => setView('expired')}
          className="flex w-full items-center gap-3 rounded-lg border border-exception/30 bg-exception/5 px-3.5 py-3 text-left transition-colors hover:bg-exception/8"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-exception/8 text-exception" aria-hidden="true">
            <Box size={16} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">
              {counts.expired} expired {counts.expired === 1 ? 'container' : 'containers'}
            </span>
            <span className="block text-xs text-muted-foreground">Not counted as stock. Open one to log it as waste or discard it.</span>
          </span>
          <ChevronRight size={14} className="text-muted-foreground" aria-hidden="true" />
        </motion.button>
      )}

      <motion.section variants={SECTION_RISE} aria-label="Containers">
        {error ? (
          <ErrorState title="Couldn’t load containers" onRetry={onRetry} />
        ) : loading ? (
          <ListSkeleton rows={3} label="Loading containers" />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Box}
            compact
            kind={view === 'expired' ? 'done' : 'start'}
            title={
              view === 'active'
                ? 'Nothing in stock'
                : view === 'expired'
                  ? 'Nothing expired'
                  : view === 'finished'
                    ? 'Nothing finished yet'
                    : 'No containers yet'
            }
            description={
              view === 'active' || view === 'all'
                ? 'Receive a delivery to start tracking containers — each gets its own balance and expiry.'
                : 'Containers move here as they’re used up, expire or are thrown away.'
            }
            action={
              canWrite && (view === 'active' || view === 'all')
                ? { label: 'Receive containers', icon: Plus, onClick: () => setDrawer('receive') }
                : undefined
            }
          />
        ) : (
          <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
            {shown.map((unit) => (
              <ContainerRow
                key={unit.id}
                unit={unit}
                now={now}
                isNext={next?.id === unit.id}
                selectable={canWrite && isActive(unit)}
                selected={selected.has(unit.id)}
                onToggle={() => toggle(unit.id)}
              />
            ))}
          </ul>
        )}
      </motion.section>

      {selectedUnits.length > 0 && (
        <div className="sticky bottom-3 z-10 flex flex-wrap items-center gap-2 rounded-lg border border-rule/60 bg-card/95 px-3 py-2.5 shadow-md backdrop-blur">
          <p className="flex-1 text-sm text-foreground">
            <span className="font-semibold">{selectedUnits.length} selected</span>
            <span className="text-muted-foreground">
              {' '}
              · {fmtQty(totalRemaining(selectedUnits))} {item.unit}
            </span>
          </p>
          <Button variant="ghost" onClick={clear}>
            Clear
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={selectedUnits.length !== 1}
            onClick={() => setDrawer('split')}
            title={selectedUnits.length !== 1 ? 'Select one container to split' : undefined}
          >
            <Scissors aria-hidden="true" /> Split
          </Button>
          <Button
            type="button"
            disabled={selectedUnits.length < 2}
            onClick={() => setDrawer('combine')}
            title={selectedUnits.length < 2 ? 'Select two or more to combine' : undefined}
          >
            <Combine aria-hidden="true" /> Combine
          </Button>
        </div>
      )}

      {drawer === 'receive' && (
        <ReceiveContainersDrawer item={item} locationId={locationId} onClose={() => setDrawer(null)} onDone={done} />
      )}
      {drawer === 'split' && selectedUnits.length === 1 && (
        <SplitContainerDrawer unit={selectedUnits[0]!} onClose={() => setDrawer(null)} onDone={done} />
      )}
      {drawer === 'combine' && selectedUnits.length >= 2 && (
        <CombineContainersDrawer units={selectedUnits} onClose={() => setDrawer(null)} onDone={done} />
      )}
    </motion.div>
  );
}

function ContainerRow({
  unit,
  now,
  isNext,
  selectable,
  selected,
  onToggle,
}: {
  unit: StockUnit;
  now: Date;
  isNext: boolean;
  selectable: boolean;
  selected: boolean;
  onToggle: () => void;
}) {
  const meta = STATUS[unit.status];
  const remaining = Number(unit.remainingQuantity);
  const initial = Number(unit.initialQuantity);
  const share = initial > 0 ? Math.min(1, remaining / initial) : 0;
  const expiry = expiryLabel(unit.expiryDate ?? null, now);
  const days = unit.expiryDate ? daysUntil(unit.expiryDate, now) : null;
  const finished = unit.status === 'EMPTY' || unit.status === 'DISCARDED';
  const detail = [
    unit.lotNumber ? `Lot ${unit.lotNumber}` : null,
    unit.status === 'IN_USE' && unit.openedAt ? `opened ${formatDate(unit.openedAt)}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className={cn('flex items-center gap-3 border-b border-rule/45 px-3.5 py-3 last:border-b-0', selected && 'bg-primary/5')}>
      {selectable ? (
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Select ${unit.label}`}
          className="size-4 shrink-0 accent-primary"
        />
      ) : (
        <span className="size-4 shrink-0" aria-hidden="true" />
      )}
      <Link
        href={`/inventory/units/${unit.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-md focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span
          className={cn('flex size-9 shrink-0 items-center justify-center rounded-md', meta.tile)}
          role="img"
          aria-label={meta.label}
          title={meta.label}
        >
          <meta.icon size={16} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-foreground">{unit.label}</span>
            {isNext && (
              <span className="shrink-0 rounded-sm bg-primary px-1.5 py-0.5 text-micro font-semibold text-primary-foreground">
                Use next
              </span>
            )}
          </span>
          <span className="block truncate text-xs text-muted-foreground">
            {finished ? (
              unit.status === 'DISCARDED' ? (
                'Thrown away'
              ) : (
                'Used up'
              )
            ) : expiry ? (
              <span
                className={cn(
                  days !== null && days < 0
                    ? 'font-semibold text-exception'
                    : days !== null && days <= 2
                      ? 'font-semibold text-measured'
                      : undefined,
                )}
              >
                {days !== null && days < 0
                  ? `Use by ${formatDate(unit.expiryDate!)}`
                  : `Use by ${expiry.toLowerCase().startsWith('in ') ? expiry.toLowerCase() : expiry}`}
              </span>
            ) : (
              'No use-by date'
            )}
            {detail && ` · ${detail}`}
          </span>
        </span>
        <span className="hidden w-32 shrink-0 sm:block">
          <span className="block text-right text-sm font-semibold tabular-nums text-foreground">
            {fmtQty(remaining)}{' '}
            <span className="font-normal text-muted-foreground">
              / {fmtQty(initial)} {unit.unitOfMeasure}
            </span>
          </span>
          <span className="mt-1 block h-1 overflow-hidden rounded-full bg-band">
            <span
              className={cn('block h-full rounded-full', isActive(unit) ? 'bg-primary' : 'bg-muted-foreground/40')}
              style={{ width: `${share * 100}%` }}
            />
          </span>
        </span>
        {(unit.status === 'EXPIRED' || (days !== null && days < 0 && !finished)) && <Pill tone="exception">Expired</Pill>}
        <ChevronRight size={14} className="shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>
  );
}

// ── Drawers ──────────────────────────────────────────────────────────────────

function DrawerFooter({
  pending,
  disabled,
  label,
  icon: Icon,
  onCancel,
  onSubmit,
  form,
}: {
  pending: boolean;
  disabled?: boolean;
  label: string;
  icon: IconComponent;
  onCancel: () => void;
  onSubmit?: () => void;
  form?: string;
}) {
  return (
    <div className="flex gap-2">
      <Button variant="outline" size="lg" className="flex-1" onClick={onCancel} disabled={pending}>
        Cancel
      </Button>
      <Button type={form ? 'submit' : 'button'} form={form} size="lg" className="flex-1" onClick={onSubmit} disabled={pending || disabled}>
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Icon aria-hidden="true" />}
        {label}
      </Button>
    </div>
  );
}

/** A delivery as containers: how many, how much each holds, and when they go off. */
function ReceiveContainersDrawer({
  item,
  locationId,
  onClose,
  onDone,
}: {
  item: StockItem;
  locationId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [perContainer, setPerContainer] = useState(item.defaultContainerQuantity ? String(Number(item.defaultContainerQuantity)) : '');
  const [count, setCount] = useState(1);
  // A perishable item with a shelf life gets its use-by pre-filled from today.
  const [expiryDate, setExpiryDate] = useState(() => {
    if (!item.isPerishable || !item.defaultShelfLifeDays) return '';
    const date = new Date();
    date.setDate(date.getDate() + item.defaultShelfLifeDays);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  });
  const [lotNumber, setLotNumber] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const quantity = Number(perContainer);
  const quantityError = !(Number.isFinite(quantity) && quantity > 0) ? 'How much one container holds — more than 0.' : null;
  const countError = !Number.isInteger(count) || count < 1 || count > 500 ? 'From 1 to 500 containers.' : null;
  const expiryError = item.isPerishable && !expiryDate ? 'Perishable stock needs a use-by date.' : null;
  const valid = !quantityError && !countError && !expiryError;

  const receive = useMutation({
    mutationFn: () =>
      receiveStockUnits({
        locationId,
        stockItemId: item.id,
        units: Array.from({ length: count }, () => ({
          initialQuantity: quantity,
          expiryDate: expiryDate || null,
          lotNumber: lotNumber.trim() || undefined,
        })),
      }),
    onSuccess: () => {
      toast('success', `${count} ${count === 1 ? 'container' : 'containers'} received — ${fmtQty(quantity * count)} ${item.unit} added.`);
      onDone();
    },
    onError: (err) => toast('error', err.message || 'The containers weren’t received. Check the fields and try again.'),
  });

  return (
    <Drawer
      title="Receive containers"
      description={`${item.name} — each container gets its own balance, use-by date and history.`}
      onClose={onClose}
      footer={
        <DrawerFooter
          form="receive-containers"
          pending={receive.isPending}
          label={valid ? `Receive ${fmtQty(quantity * count)} ${item.unit}` : 'Receive'}
          icon={Plus}
          onCancel={onClose}
        />
      }
    >
      <form
        id="receive-containers"
        noValidate
        className="space-y-7"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmitted(true);
          if (valid) receive.mutate();
        }}
      >
        <FormSection icon={Box} title="Containers">
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Each holds"
              value={perContainer}
              onChange={(event) => setPerContainer(event.target.value)}
              inputMode="decimal"
              autoFocus={!perContainer}
              rightIcon={<span className="text-xs">{item.unit}</span>}
              error={submitted ? (quantityError ?? undefined) : undefined}
            />
            <div className="flex flex-col gap-1.5">
              <span className="text-label uppercase text-muted-foreground">How many</span>
              <NumberStepper value={count} onChange={setCount} min={1} max={500} label="Containers" />
              {submitted && countError && <p className="text-xs text-destructive">{countError}</p>}
            </div>
          </div>
          {valid && (
            <p className="rounded-md bg-band/60 px-3 py-2 text-xs tabular-nums text-muted-foreground">
              {count} × {fmtQty(quantity)} {item.unit} ={' '}
              <span className="font-semibold text-foreground">
                {fmtQty(quantity * count)} {item.unit}
              </span>
            </p>
          )}
        </FormSection>

        <FormSection
          icon={PackageOpen}
          title="Batch"
          note={item.isPerishable ? 'Perishable — the use-by date drives expiry alerts and use-first order.' : undefined}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <DatePicker
              label={item.isPerishable ? 'Use by' : 'Use by (optional)'}
              value={expiryDate}
              onValueChange={setExpiryDate}
              required={item.isPerishable}
              error={submitted ? (expiryError ?? undefined) : undefined}
              hint={
                item.isPerishable && item.defaultShelfLifeDays
                  ? `Pre-filled from the ${item.defaultShelfLifeDays}-day shelf life.`
                  : undefined
              }
            />
            <Input
              label="Lot number"
              value={lotNumber}
              onChange={(event) => setLotNumber(event.target.value)}
              maxLength={100}
              placeholder="Optional"
            />
          </div>
        </FormSection>
      </form>
    </Drawer>
  );
}

function SplitContainerDrawer({ unit, onClose, onDone }: { unit: StockUnit; onClose: () => void; onDone: () => void }) {
  const [count, setCount] = useState(2);
  const total = Number(unit.remainingQuantity);
  const parts = splitParts(total, count);
  const max = Math.max(2, Math.min(100, Math.round(total * 1000)));

  const split = useMutation({
    mutationFn: () => splitStockUnit(unit.id, { parts: parts!.map((quantity) => ({ quantity })) }),
    onSuccess: () => {
      toast('success', `${unit.label} split into ${count} containers.`);
      onDone();
    },
    onError: (err) => toast('error', err.message || 'The container wasn’t split. Try again.'),
  });

  return (
    <Drawer
      title="Split container"
      description="Divide one container into smaller ones — for decanting or sending part to another location."
      onClose={onClose}
      footer={
        <DrawerFooter
          pending={split.isPending}
          disabled={!parts}
          label={`Split into ${count}`}
          icon={Scissors}
          onCancel={onClose}
          onSubmit={() => split.mutate()}
        />
      }
    >
      <div className="space-y-7">
        <SourceCard units={[unit]} />
        <FormSection icon={Scissors} title="Into">
          <NumberStepper value={count} onChange={setCount} min={2} max={max} label="New containers" unit="containers" />
          {parts ? (
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Each new container holds</p>
              <div className="flex flex-wrap gap-1.5">
                {parts.map((quantity, index) => (
                  <span
                    key={index}
                    className="rounded-md border border-rule/60 bg-card px-2.5 py-1 text-xs font-semibold tabular-nums text-foreground"
                  >
                    {preciseQty(quantity)} {unit.unitOfMeasure}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Use-by date and lot are copied to every part; the original is marked empty.
              </p>
            </div>
          ) : (
            <p className="text-xs text-destructive">This balance is too small to split that many ways.</p>
          )}
        </FormSection>
      </div>
    </Drawer>
  );
}

function CombineContainersDrawer({ units, onClose, onDone }: { units: StockUnit[]; onClose: () => void; onDone: () => void }) {
  const [label, setLabel] = useState('');
  const total = totalRemaining(units);
  const earliest = units
    .map((u) => u.expiryDate)
    .filter((value): value is string => Boolean(value))
    .sort()[0];
  const lots = new Set(units.map((u) => u.lotNumber ?? ''));
  const unitOfMeasure = units[0]?.unitOfMeasure ?? '';

  const combine = useMutation({
    mutationFn: () => combineStockUnits({ stockUnitIds: units.map((u) => u.id), label: label.trim() || undefined }),
    onSuccess: () => {
      toast('success', `${units.length} containers combined into one.`);
      onDone();
    },
    onError: (err) => toast('error', err.message || 'The containers weren’t combined. Try again.'),
  });

  return (
    <Drawer
      title="Combine containers"
      description="Pour part-used containers into one, so the shelf holds fewer, fuller ones."
      onClose={onClose}
      footer={
        <DrawerFooter
          pending={combine.isPending}
          label={`Combine into ${fmtQty(total)} ${unitOfMeasure}`}
          icon={Combine}
          onCancel={onClose}
          onSubmit={() => combine.mutate()}
        />
      }
    >
      <div className="space-y-7">
        <SourceCard units={units} />
        <FormSection icon={Combine} title="New container">
          <Input
            label="Label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            maxLength={100}
            placeholder="Generated if blank"
          />
          <ul className="space-y-1 text-xs text-muted-foreground">
            <li>
              Holds{' '}
              <span className="font-semibold text-foreground">
                {fmtQty(total)} {unitOfMeasure}
              </span>
              ; the {units.length} originals are marked empty.
            </li>
            <li>{earliest ? `Keeps the earliest use-by — ${expiryLabel(earliest, new Date())}.` : 'None of these has a use-by date.'}</li>
            <li>{lots.size === 1 && [...lots][0] ? `Keeps lot ${[...lots][0]}.` : 'Lots differ, so the new container has none.'}</li>
          </ul>
        </FormSection>
      </div>
    </Drawer>
  );
}

/** The containers a split or combine starts from, as the list shows them. */
function SourceCard({ units }: { units: StockUnit[] }) {
  return (
    <ul className="overflow-hidden rounded-lg border border-rule/60 bg-card">
      {units.map((unit) => {
        const meta = STATUS[unit.status];
        return (
          <li key={unit.id} className="flex items-center gap-3 border-b border-rule/45 px-3.5 py-2.5 last:border-b-0">
            <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-md', meta.tile)} aria-hidden="true">
              <meta.icon size={15} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{unit.label}</span>
            <span className="text-sm tabular-nums text-muted-foreground">
              {fmtQty(Number(unit.remainingQuantity))} {unit.unitOfMeasure}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
