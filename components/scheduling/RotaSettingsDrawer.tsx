'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { useState } from 'react';

import { Archive, Banknote, Gauge, Plus, RotateCcw, Settings, Target } from '@/components/icons';
import { invalidateRota } from '@/components/scheduling/rota-queries';
import { inp } from '@/components/scheduling/shared';
import { ChangeRow, Switch, ValueMissing } from '@/components/settings/controls';
import { Drawer } from '@/components/shared/Drawer';
import { ErrorState } from '@/components/shared/ErrorState';
import { RecordGroup } from '@/components/shared/RecordGroup';
import { Bone } from '@/components/shared/Skeleton';
import { Button } from '@/components/ui/button';
import { MultiSelect } from '@/components/ui/multi-select';
import { Select } from '@/components/ui/select';

import {
  type LabourTargets,
  type PlannerStaff,
  type PositionWithStaff,
  type WorkingTimeRules,
  createPosition,
  getPositions,
  setLabourTargets,
  setPositionStaff,
  updatePosition,
} from '@/lib/api/rota.service';
import { moduleQueryKeys } from '@/lib/modules/query-keys';
import { toast } from '@/lib/toast';
import { cn } from '@/lib/utils/cn';
import { parseAmount } from '@/lib/utils/margin-calculator';
import { POSITION_COLORS, positionSwatch } from '@/lib/utils/rota-planner';
import { UK_RULES, rulesFor } from '@/lib/utils/rota-rules';

const STAGGER = { hidden: {}, shown: { transition: { staggerChildren: 0.05 } } };

/** One working-time rule: which limit it switches, the unit it's edited in, and an optional break length beside it. */
type RuleSpec = {
  key: keyof WorkingTimeRules;
  label: string;
  unit: 'h' | 'min';
  breakKey?: 'minBreakMinutes' | 'minorMinBreakMinutes';
};

const RULES: { title: string; rules: RuleSpec[] }[] = [
  {
    title: 'Adults',
    rules: [
      { key: 'breakAfterMinutes', label: 'Break after', unit: 'h', breakKey: 'minBreakMinutes' },
      { key: 'restMinutes', label: 'Rest between shifts', unit: 'h' },
      { key: 'weeklyMinutes', label: 'Weekly limit', unit: 'h' },
    ],
  },
  {
    title: 'Under 18',
    rules: [
      { key: 'minorBreakAfterMinutes', label: 'Break after', unit: 'h', breakKey: 'minorMinBreakMinutes' },
      { key: 'minorRestMinutes', label: 'Rest between shifts', unit: 'h' },
      { key: 'minorDailyMinutes', label: 'Daily limit', unit: 'h' },
      { key: 'minorWeeklyMinutes', label: 'Weekly limit', unit: 'h' },
    ],
  },
];

const shown = (minutes: number, unit: 'h' | 'min') => String(unit === 'h' ? Math.round((minutes / 60) * 100) / 100 : minutes);
const fromInput = (value: string, unit: 'h' | 'min') => {
  const n = parseAmount(value);
  return n === null ? null : Math.round(unit === 'h' ? n * 60 : n);
};

/**
 * The location's rota settings: labour targets, working-time rules (UK law by
 * default) and positions with who is trained for each. Targets and rules need
 * `scheduling:publish`; positions `scheduling:write`. Everyone else reads.
 */
export function RotaSettingsDrawer({
  locationId,
  locationName,
  targets,
  staff,
  canPublish,
  canWrite,
  onClose,
}: {
  locationId: string;
  locationName: string;
  targets: LabourTargets;
  staff: PlannerStaff[];
  canPublish: boolean;
  canWrite: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [targetPct, setTargetPct] = useState(targets.targetLabourPct ?? '');
  const [budget, setBudget] = useState(targets.weeklyBudget ?? '');
  const [onCost, setOnCost] = useState(targets.onCostPct ?? '0');
  const [rules, setRules] = useState<WorkingTimeRules>(() => rulesFor(targets.rules));
  const [openRow, setOpenRow] = useState<string | null>(null);

  const original = rulesFor(targets.rules);
  const dirty =
    targetPct !== (targets.targetLabourPct ?? '') ||
    budget !== (targets.weeklyBudget ?? '') ||
    onCost !== (targets.onCostPct ?? '0') ||
    JSON.stringify(rules) !== JSON.stringify(original);
  const invalid =
    (targetPct.trim() !== '' && parseAmount(targetPct) === null) ||
    (budget.trim() !== '' && parseAmount(budget) === null) ||
    parseAmount(onCost) === null;

  const save = useMutation({
    mutationFn: () =>
      setLabourTargets(locationId, {
        targetLabourPct: targetPct.trim() ? String(parseAmount(targetPct)) : null,
        weeklyBudget: budget.trim() ? String(parseAmount(budget)) : null,
        onCostPct: String(parseAmount(onCost) ?? 0),
        rules,
      }),
    onSuccess: () => {
      invalidateRota(qc);
      toast('success', 'Rota settings saved.');
      setOpenRow(null);
    },
  });

  const discard = () => {
    setTargetPct(targets.targetLabourPct ?? '');
    setBudget(targets.weeklyBudget ?? '');
    setOnCost(targets.onCostPct ?? '0');
    setRules(original);
  };

  const toggle = (row: string) => setOpenRow((current) => (current === row ? null : row));
  const money = (value: string) => (value ? `£${value}` : null);

  return (
    <Drawer
      icon={Settings}
      title="Rota settings"
      description={locationName}
      onClose={onClose}
      footer={
        canPublish && dirty ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-heading">Unsaved changes</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={discard} disabled={save.isPending}>
                Discard
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || invalid}>
                {save.isPending ? 'Saving…' : 'Save'}
              </Button>
            </div>
          </div>
        ) : undefined
      }
    >
      <motion.div className="space-y-6" initial="hidden" animate="shown" variants={STAGGER}>
        <RecordGroup id="rota-targets" title="Labour targets">
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <ChangeRow
              icon={Target}
              label="Target labour"
              value={targetPct ? `${targetPct}% of sales` : <ValueMissing>None</ValueMissing>}
              open={openRow === 'pct'}
              onToggle={canPublish ? () => toggle('pct') : undefined}
            >
              <NumberInput value={targetPct} onChange={setTargetPct} suffix="%" label="Target labour percentage" placeholder="28" />
            </ChangeRow>
            <ChangeRow
              icon={Banknote}
              label="Weekly budget"
              value={money(budget) ?? <ValueMissing>None</ValueMissing>}
              open={openRow === 'budget'}
              onToggle={canPublish ? () => toggle('budget') : undefined}
            >
              <NumberInput value={budget} onChange={setBudget} prefix="£" label="Weekly labour budget" placeholder="2500" />
            </ChangeRow>
            <ChangeRow
              icon={Gauge}
              label="On-cost"
              value={`${onCost || '0'}% on top of pay`}
              open={openRow === 'oncost'}
              onToggle={canPublish ? () => toggle('oncost') : undefined}
            >
              <NumberInput value={onCost} onChange={setOnCost} suffix="%" label="Employer on-cost percentage" placeholder="13.8" />
              <p className="mt-1.5 text-xs text-muted-foreground">Employer NI and pension, added to every labour cost.</p>
            </ChangeRow>
          </div>
        </RecordGroup>

        <RecordGroup
          id="rota-rules"
          title="Working-time rules"
          actions={
            canPublish && JSON.stringify(rules) !== JSON.stringify(UK_RULES) ? (
              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setRules(UK_RULES)}>
                <RotateCcw size={13} /> UK defaults
              </Button>
            ) : undefined
          }
          footnote="Shifts that break a rule are flagged, never blocked."
        >
          <div className="space-y-4 rounded-lg border border-border bg-card px-4 py-3">
            {RULES.map((group) => (
              <div key={group.title}>
                <p className="mb-1 text-label text-muted-foreground uppercase">{group.title}</p>
                {group.rules.map((spec) => (
                  <RuleRow key={spec.key} spec={spec} rules={rules} onChange={setRules} disabled={!canPublish} />
                ))}
              </div>
            ))}
          </div>
        </RecordGroup>

        <PositionsGroup locationId={locationId} staff={staff} canWrite={canWrite} />

        {save.error && (
          <p role="alert" className="text-sm text-destructive">
            {(save.error as Error).message}
          </p>
        )}
      </motion.div>
    </Drawer>
  );
}

function NumberInput({
  value,
  onChange,
  label,
  placeholder,
  prefix,
  suffix,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <span className="flex items-center gap-2">
      {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
      <input
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
        placeholder={placeholder}
        className={cn(inp, 'w-28 tabular-nums')}
      />
      {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
    </span>
  );
}

function RuleRow({
  spec,
  rules,
  onChange,
  disabled,
}: {
  spec: RuleSpec;
  rules: WorkingTimeRules;
  onChange: (rules: WorkingTimeRules) => void;
  disabled: boolean;
}) {
  const value = rules[spec.key];
  const on = value !== null;
  const set = (patch: Partial<WorkingTimeRules>) => onChange({ ...rules, ...patch });
  return (
    <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1.5 py-1">
      <Switch
        checked={on}
        onChange={(checked) => set({ [spec.key]: checked ? UK_RULES[spec.key] : null })}
        label={spec.label}
        disabled={disabled}
      />
      <span className="min-w-36 flex-1 text-sm text-foreground">{spec.label}</span>
      {on && (
        <span className="flex items-center gap-2 text-sm text-muted-foreground">
          <RuleNumber
            minutes={value as number}
            unit={spec.unit}
            onChange={(m) => set({ [spec.key]: m })}
            disabled={disabled}
            label={spec.label}
          />
          {spec.unit}
          {spec.breakKey && (
            <>
              <span>·</span>
              <RuleNumber
                minutes={rules[spec.breakKey]}
                unit="min"
                onChange={(m) => set({ [spec.breakKey!]: m })}
                disabled={disabled}
                label={`${spec.label}: break length`}
              />
              min break
            </>
          )}
        </span>
      )}
    </div>
  );
}

/** Edits a minutes value in hours or minutes; holds its own text so "4." can be typed on the way to "4.5". */
function RuleNumber({
  minutes,
  unit,
  onChange,
  disabled,
  label,
}: {
  minutes: number;
  unit: 'h' | 'min';
  onChange: (minutes: number) => void;
  disabled: boolean;
  label: string;
}) {
  const [text, setText] = useState(shown(minutes, unit));
  const [seen, setSeen] = useState(minutes);
  if (seen !== minutes) {
    setSeen(minutes);
    if (fromInput(text, unit) !== minutes) setText(shown(minutes, unit));
  }
  return (
    <input
      inputMode="decimal"
      value={text}
      disabled={disabled}
      aria-label={label}
      onChange={(e) => {
        setText(e.target.value);
        const next = fromInput(e.target.value, unit);
        if (next !== null && next > 0) onChange(next);
      }}
      className={cn(inp, 'w-16 px-2 text-right tabular-nums')}
    />
  );
}

// ── Positions ───────────────────────────────────────────────────────────────

function PositionsGroup({ locationId, staff, canWrite }: { locationId: string; staff: PlannerStaff[]; canWrite: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState('');
  const positions = useQuery({
    queryKey: moduleQueryKeys.workforce.key('rota-positions', locationId),
    queryFn: () => getPositions(locationId),
  });
  const create = useMutation({
    mutationFn: () => createPosition({ name: name.trim(), locationId, color: 'slate' }),
    onSuccess: () => {
      setName('');
      invalidateRota(qc);
    },
  });

  const list = positions.data ?? [];
  const active = list.filter((p) => p.isActive).sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  const archived = list.filter((p) => !p.isActive);

  return (
    <RecordGroup
      id="rota-positions"
      title="Positions"
      footnote={canWrite ? 'A shift in a position someone isn’t trained for is flagged.' : undefined}
    >
      {positions.isPending ? (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading positions"
          className="space-y-2 rounded-lg border border-border bg-card p-4"
        >
          <Bone className="h-9 w-full" />
          <Bone className="h-9 w-full" />
        </div>
      ) : positions.isError ? (
        <div className="rounded-lg border border-border bg-card">
          <ErrorState title="Positions couldn’t be loaded" onRetry={() => void positions.refetch()} />
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-3">
          {active.length === 0 && <p className="py-2 text-sm text-muted-foreground">No positions yet — Barista, Kitchen, Floor…</p>}
          {active.map((position) => (
            <PositionRow key={position.id} position={position} staff={staff} canWrite={canWrite} />
          ))}
          {canWrite && (
            <form
              className="flex items-center gap-2 pt-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) create.mutate();
              }}
            >
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                placeholder="New position"
                aria-label="New position name"
                className={inp}
              />
              <Button type="submit" variant="outline" className="gap-1.5" disabled={!name.trim() || create.isPending}>
                <Plus size={14} /> Add
              </Button>
            </form>
          )}
          {create.error && <p className="mt-1.5 text-xs text-destructive">{(create.error as Error).message}</p>}
          {archived.length > 0 && (
            <p className="mt-3 text-xs text-muted-foreground">
              Archived:{' '}
              {archived.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ', '}
                  {canWrite ? <RestoreButton position={p} /> : p.name}
                </span>
              ))}
            </p>
          )}
        </div>
      )}
    </RecordGroup>
  );
}

function RestoreButton({ position }: { position: PositionWithStaff }) {
  const qc = useQueryClient();
  const restore = useMutation({
    mutationFn: () => updatePosition(position.id, { isActive: true }),
    onSuccess: () => invalidateRota(qc),
  });
  return (
    <button
      type="button"
      className="font-semibold underline-offset-2 hover:underline"
      onClick={() => restore.mutate()}
      disabled={restore.isPending}
      title="Restore"
    >
      {position.name}
    </button>
  );
}

function PositionRow({ position, staff, canWrite }: { position: PositionWithStaff; staff: PlannerStaff[]; canWrite: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState(position.name);
  const [people, setPeople] = useState(position.staffIds);
  const [seen, setSeen] = useState(position);
  if (seen !== position) {
    setSeen(position);
    setName(position.name);
    setPeople(position.staffIds);
  }
  const swatch = positionSwatch(position.color);

  const update = useMutation({
    mutationFn: (patch: Parameters<typeof updatePosition>[1]) => updatePosition(position.id, patch),
    onSuccess: () => invalidateRota(qc),
  });
  const assign = useMutation({
    mutationFn: () => setPositionStaff(position.id, people),
    onSuccess: () => {
      invalidateRota(qc);
      toast('success', `${position.name}: ${people.length} trained.`);
    },
  });
  const peopleDirty = [...people].sort().join() !== [...position.staffIds].sort().join();
  const error = (update.error ?? assign.error) as Error | null;

  if (!canWrite)
    return (
      <div className="flex items-center gap-2.5 py-2 text-sm">
        <span className={cn('size-2.5 shrink-0 rounded-full', swatch.dot)} aria-hidden="true" />
        <span className="font-semibold text-foreground">{position.name}</span>
        <span className="text-muted-foreground">· {position.staffIds.length} trained</span>
      </div>
    );

  return (
    <div className="space-y-2 py-2">
      <div className="flex items-center gap-2">
        <span className={cn('size-2.5 shrink-0 rounded-full', swatch.dot)} aria-hidden="true" />
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name.trim() !== position.name && update.mutate({ name: name.trim() })}
          maxLength={50}
          aria-label="Position name"
          className={cn(inp, 'flex-1')}
        />
        <Select
          value={position.color}
          onValueChange={(color) => update.mutate({ color })}
          options={POSITION_COLORS.map((c) => ({
            value: c.value,
            label: c.label,
            icon: <span className={cn('size-2.5 rounded-full', positionSwatch(c.value).dot)} aria-hidden="true" />,
          }))}
          ariaLabel={`${position.name} colour`}
          className="w-32"
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Archive ${position.name}`}
          title="Archive"
          onClick={() => update.mutate({ isActive: false })}
        >
          <Archive size={15} />
        </Button>
      </div>
      <div className="flex items-center gap-2 pl-4.5">
        <MultiSelect
          value={people}
          onChange={setPeople}
          options={staff.map((member) => ({ value: member.userId, label: member.name }))}
          placeholder="Nobody trained yet"
          ariaLabel={`Trained for ${position.name}`}
          className="flex-1"
        />
        {peopleDirty && (
          <Button size="sm" onClick={() => assign.mutate()} disabled={assign.isPending}>
            {assign.isPending ? 'Saving…' : 'Save'}
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error.message}</p>}
    </div>
  );
}
