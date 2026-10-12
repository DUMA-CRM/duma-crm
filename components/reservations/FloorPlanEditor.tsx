'use client';

import { type UseQueryResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { InfoRow, InfoRows } from '@/components/cms/rows';
import {
  ArrowLeftRight,
  ChevronDown,
  Grid2X2,
  Layers,
  LayoutGrid,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Tag,
  Trash2,
  Users,
  UsersRound,
  X,
} from '@/components/icons';
import { SettingsSection } from '@/components/settings/SettingsSection';
import { SettingsTabBody } from '@/components/settings/SettingsShell';
import { Switch } from '@/components/settings/controls';
import { ConfirmModal } from '@/components/shared/ConfirmModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { ErrorState } from '@/components/shared/ErrorState';
import { NumberStepper } from '@/components/shared/FormParts';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Modal } from '@/components/shared/Modal';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type DiningArea,
  type DiningTableShape,
  createArea,
  createTable,
  deleteArea,
  removeTable,
  saveLayout,
  updateArea,
  updateTable,
} from '@/lib/modules/reservations/client';
import { type FloorTable, SHAPE_SIZE, freeSpot, movedTables, nextTableLabel, placeOnCanvas } from '@/lib/utils/reservations';
import { toast } from '@/stores/toastStore';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

import { FloorCanvas } from './FloorCanvas';
import { PickerRow } from './PickerRow';

type Position = Pick<FloorTable, 'x' | 'y' | 'width' | 'height' | 'rotation'>;
/** What the table panel changes that isn't where the table sits. */
type Edit = Partial<Pick<FloorTable, 'label' | 'minCovers' | 'maxCovers' | 'shape'>>;
const GEOMETRY = ['x', 'y', 'width', 'height', 'rotation'] as const;

const withoutKey = <T,>(record: Record<string, T>, key: string) => Object.fromEntries(Object.entries(record).filter(([id]) => id !== key));

const SHAPES: { value: DiningTableShape; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'round', label: 'Round' },
  { value: 'rectangle', label: 'Long' },
];

/** Chairs a new table starts with, by shape. */
const STARTING_CHAIRS: Record<DiningTableShape, number> = { square: 2, round: 4, rectangle: 6 };

/** The shape's outline, as the map draws it. */
function ShapeGlyph({ shape }: { shape: DiningTableShape }) {
  return (
    <svg viewBox="0 0 20 14" className="h-3.5 w-5 shrink-0 text-muted-foreground" aria-hidden="true">
      {shape === 'round' ? (
        <circle cx={10} cy={7} r={5.5} className="fill-none stroke-current" strokeWidth={1.5} />
      ) : shape === 'square' ? (
        <rect x={4.25} y={1.25} width={11.5} height={11.5} rx={2} className="fill-none stroke-current" strokeWidth={1.5} />
      ) : (
        <rect x={0.75} y={2.75} width={18.5} height={8.5} rx={2} className="fill-none stroke-current" strokeWidth={1.5} />
      )}
    </svg>
  );
}

/**
 * Draw the floor: rooms (areas) and the tables in them. Drag a table, or nudge
 * it with the arrow keys; moves stay local until Save layout writes them in
 * one go. The table panel edits the map live — name, chairs, shape, width,
 * depth and turn all show as they change — and Save table writes that table.
 * Removing a table keeps its history — past bookings still point at it.
 */
export function FloorPlanEditor({ locationId, floor }: { locationId: string; floor: UseQueryResult<DiningArea[]> }) {
  const queryClient = useQueryClient();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Unsaved moves, by table — survive a refetch of the floor.
  const [moves, setMoves] = useState<Record<string, Position>>({});
  // Unsaved panel edits, by table — shown on the map until Save table.
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const showChairs = useUiSettingsStore((state) => state.showChairs);
  const setShowChairs = useUiSettingsStore((state) => state.setShowChairs);
  // The new-area or rename dialog, when open.
  const [areaDialog, setAreaDialog] = useState<'new' | 'rename' | null>(null);
  const [confirmDeleteArea, setConfirmDeleteArea] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
  const fail = (error: Error) => toast('error', error.message);

  const addArea = useMutation({
    mutationFn: (name: string) => createArea(locationId, name),
    onSuccess: async (area) => {
      setAreaDialog(null);
      setAreaId(area.id);
      await invalidate();
    },
    onError: fail,
  });
  const rename = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateArea(id, { name }),
    onSuccess: async () => {
      setAreaDialog(null);
      await invalidate();
    },
    onError: fail,
  });
  const dropArea = useMutation({
    mutationFn: (id: string) => deleteArea(id),
    onSuccess: async () => {
      setConfirmDeleteArea(false);
      setAreaId(null);
      toast('success', 'Area deleted.');
      await invalidate();
    },
    onError: (error) => {
      setConfirmDeleteArea(false);
      fail(error);
    },
  });
  const addTable = useMutation({
    mutationFn: ({ area, shape }: { area: DiningArea; shape: DiningTableShape }) => {
      const size = SHAPE_SIZE[shape];
      const allLabels = (floor.data ?? []).flatMap((candidate) => candidate.tables.map((table) => table.label));
      return createTable({
        areaId: area.id,
        label: nextTableLabel(allLabels),
        minCovers: 1,
        maxCovers: STARTING_CHAIRS[shape],
        shape,
        rotation: 0,
        ...size,
        ...freeSpot(
          area.tables.map((table) => ({ ...table, ...moves[table.id] })),
          size,
        ),
      });
    },
    onSuccess: async (table) => {
      setSelectedId(table.id);
      await invalidate();
    },
    onError: fail,
  });
  const save = useMutation({
    mutationFn: (tables: FloorTable[]) =>
      saveLayout(
        locationId,
        tables.map(({ id, x, y, width, height, rotation }) => ({ id, x, y, width, height, rotation })),
      ),
    onSuccess: async () => {
      toast('success', 'Floor plan saved.');
      await invalidate();
      setMoves({});
    },
    onError: fail,
  });

  if (floor.isPending) return <Bone className="aspect-[3/2] w-full rounded-lg" />;
  if (floor.isError) return <ErrorState title="Couldn’t load the floor plan" onRetry={() => void floor.refetch()} />;

  const newAreaDialog = areaDialog === 'new' && (
    <AreaDialog
      title="New area"
      description="A room or space with its own tables — the main room, a terrace, the bar."
      confirmLabel="Add area"
      isPending={addArea.isPending}
      onSave={(name) => addArea.mutate(name)}
      onClose={() => setAreaDialog(null)}
    />
  );

  if (floor.data.length === 0) {
    return (
      <>
        <EmptyState
          className="flex-1"
          icon={LayoutGrid}
          title="Start with a room"
          description="A floor plan is one or more areas — the main room, a terrace — each with its tables. Add the first area, then place its tables."
          action={{ label: 'Add an area', onClick: () => setAreaDialog('new'), icon: Plus }}
        />
        {newAreaDialog}
      </>
    );
  }

  const area = floor.data.find((candidate) => candidate.id === areaId) ?? floor.data[0]!;
  const saved = floor.data.flatMap((candidate) => candidate.tables);
  const current = saved.map((table) => ({ ...table, ...edits[table.id], ...moves[table.id] }));
  const changed = movedTables(saved, current);
  const shown = current.filter((table) => table.areaId === area.id);
  const selected = shown.find((table) => table.id === selectedId) ?? null;
  const savedSelected = saved.find((table) => table.id === selectedId);
  const selectedDirty = Boolean(
    selected && savedSelected && (Object.keys(edits[selected.id] ?? {}).length > 0 || movedTables([savedSelected], [selected]).length > 0),
  );

  const positionOf = (table: FloorTable): Position => ({ x: table.x, y: table.y, width: table.width, height: table.height, rotation: table.rotation });
  const move = (id: string, x: number, y: number) => {
    const table = current.find((candidate) => candidate.id === id);
    if (!table) return;
    const placed = placeOnCanvas(table, x, y);
    setMoves((all) => ({ ...all, [id]: { ...positionOf(table), x: placed.x, y: placed.y } }));
  };
  /** A panel change: where it sits goes with the layout, the rest waits for Save table. */
  const change = (table: FloorTable, patch: Partial<FloorTable>) => {
    const geometry = Object.fromEntries(Object.entries(patch).filter(([key]) => (GEOMETRY as readonly string[]).includes(key)));
    const rest = Object.fromEntries(Object.entries(patch).filter(([key]) => !(GEOMETRY as readonly string[]).includes(key))) as Edit;
    if (Object.keys(geometry).length > 0) {
      const next = { ...table, ...geometry };
      // A wider or deeper table near the edge is nudged back onto the floor.
      const placed = placeOnCanvas(next, next.x, next.y);
      setMoves((all) => ({ ...all, [table.id]: { ...positionOf(next), x: placed.x, y: placed.y } }));
    }
    if (Object.keys(rest).length > 0) setEdits((all) => ({ ...all, [table.id]: { ...all[table.id], ...rest } }));
  };
  const forget = (id: string) => {
    setMoves((all) => withoutKey(all, id));
    setEdits((all) => withoutKey(all, id));
  };

  const aside = selected ? (
    <TableInspector
      key={selected.id}
      table={selected}
      dirty={selectedDirty}
      areas={floor.data}
      onChange={(patch) => change(selected, patch)}
      onClose={() => setSelectedId(null)}
      onSaved={async () => {
        await invalidate();
        forget(selected.id);
      }}
      onRemoved={async () => {
        setSelectedId(null);
        forget(selected.id);
        await invalidate();
      }}
    />
  ) : (
    <SettingsSection
      title="Floor plan"
    >
      <InfoRows>
        <InfoRow icon={Layers} title="Areas">
          <span className="text-sm font-semibold tabular-nums">{floor.data.length}</span>
        </InfoRow>
        <InfoRow icon={LayoutGrid} title={`Tables in ${area.name}`}>
          <span className="text-sm font-semibold tabular-nums">{shown.length}</span>
        </InfoRow>
        <InfoRow icon={Users} title="Chairs">
          <span className="text-sm font-semibold tabular-nums">{shown.reduce((sum, table) => sum + table.maxCovers, 0)}</span>
        </InfoRow>
        <InfoRow icon={Users} title="Show chairs">
          <Switch checked={showChairs} onChange={setShowChairs} label="Show chairs" />
        </InfoRow>
      </InfoRows>
    </SettingsSection>
  );

  return (
    <SettingsTabBody narrowAside aside={aside}>
      <SettingsSection>
        <div className="space-y-4">
          {/* Everything on one line: which area, then what you can do to it. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {floor.data.length > 1 ? (
              <SegmentedControl<string>
                value={area.id}
                onChange={(value) => {
                  setAreaId(value);
                  setSelectedId(null);
                }}
                ariaLabel="Area"
                options={floor.data.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              />
            ) : (
              <h2 className="text-base font-semibold tracking-title text-foreground">{area.name}</h2>
            )}
            <div className="flex items-center gap-2">
              <AddTableMenu disabled={addTable.isPending} onAdd={(shape) => addTable.mutate({ area, shape })} />
              <Button variant="outline" className="h-9" onClick={() => setAreaDialog('new')}>
                <Plus size={14} aria-hidden="true" />
                Area
              </Button>
              <Button variant="outline" size="icon" className="size-9" aria-label={`Rename ${area.name}`} title="Rename area" onClick={() => setAreaDialog('rename')}>
                <Pencil size={15} aria-hidden="true" />
              </Button>
              <Button variant="outline" size="icon" className="size-9" aria-label={`Delete ${area.name}`} title="Delete area" onClick={() => setConfirmDeleteArea(true)}>
                <Trash2 size={15} aria-hidden="true" />
              </Button>
            </div>
          </div>

          <FloorCanvas
            tables={shown}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onMove={move}
            showChairs={showChairs}
            ariaLabel={`${area.name} floor plan editor`}
            className="bg-background"
          />

          <div className="flex flex-wrap items-center justify-end gap-2">
            {changed.length > 0 && (
              <Button variant="ghost" className="h-9" onClick={() => setMoves({})} disabled={save.isPending}>
                <RotateCcw size={14} aria-hidden="true" />
                Undo moves
              </Button>
            )}
            <Button className="h-9 min-w-32" disabled={changed.length === 0 || save.isPending} onClick={() => save.mutate(changed)}>
              {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
              {changed.length > 0 ? `Save layout (${changed.length})` : 'Layout saved'}
            </Button>
          </div>
        </div>
      </SettingsSection>

      {newAreaDialog}
      {areaDialog === 'rename' && (
        <AreaDialog
          title={`Rename ${area.name}`}
          initial={area.name}
          confirmLabel="Save"
          isPending={rename.isPending}
          onSave={(name) => rename.mutate({ id: area.id, name })}
          onClose={() => setAreaDialog(null)}
        />
      )}
      {confirmDeleteArea && (
        <ConfirmModal
          title={`Delete ${area.name}?`}
          message={
            area.tables.length > 0
              ? 'Remove the tables in this area first — an area with tables can’t be deleted.'
              : 'The area is removed from the floor plan.'
          }
          confirmLabel="Delete area"
          isPending={dropArea.isPending}
          onConfirm={() => dropArea.mutate(area.id)}
          onClose={() => setConfirmDeleteArea(false)}
        />
      )}
    </SettingsTabBody>
  );
}

/** Name an area — a new one, or a new name for this one. */
function AreaDialog({
  title,
  description,
  initial = '',
  confirmLabel,
  isPending,
  onSave,
  onClose,
}: {
  title: string;
  description?: string;
  initial?: string;
  confirmLabel: string;
  isPending: boolean;
  onSave: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial);
  const ready = name.trim().length > 0 && name.trim() !== initial;
  return (
    <Modal
      title={title}
      description={description}
      size="sm"
      onClose={onClose}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" form="area-dialog" disabled={!ready || isPending}>
            {isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            {confirmLabel}
          </Button>
        </div>
      }
    >
      <form
        id="area-dialog"
        onSubmit={(event) => {
          event.preventDefault();
          if (ready) onSave(name.trim());
        }}
      >
        <Input label="Name" value={name} maxLength={80} placeholder="Main room, Terrace, Bar…" autoFocus onChange={(event) => setName(event.target.value)} />
      </form>
    </Modal>
  );
}

/** Add a table: one button, the shapes in its menu with the outline each draws and the chairs it starts with. */
function AddTableMenu({ disabled, onAdd }: { disabled: boolean; onAdd: (shape: DiningTableShape) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-9" disabled={disabled}>
          {disabled ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
          Table
          <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-1">
        {SHAPES.map((shape) => (
          <button
            key={shape.value}
            type="button"
            onClick={() => {
              setOpen(false);
              onAdd(shape.value);
            }}
            className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-band focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-rule/55 bg-background">
              <ShapeGlyph shape={shape.value} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{shape.label}</span>
              <span className="block text-xs text-muted-foreground">{STARTING_CHAIRS[shape.value]} chairs to start</span>
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function TableInspector({
  table,
  dirty,
  areas,
  onChange,
  onClose,
  onSaved,
  onRemoved,
}: {
  /** The table as the map shows it — unsaved changes included. */
  table: FloorTable;
  dirty: boolean;
  areas: DiningArea[];
  onChange: (patch: Partial<FloorTable>) => void;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onRemoved: () => Promise<void>;
}) {
  const [areaId, setAreaId] = useState(table.areaId);
  const [confirmRemove, setConfirmRemove] = useState(false);
  // One row open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<'name' | 'chairs' | 'smallest' | 'shape' | 'size' | 'turn' | 'area' | null>(null);
  const toggle = (row: NonNullable<typeof open>) => setOpen((current) => (current === row ? null : row));
  const turn = (by: number) => onChange({ rotation: (((table.rotation + by) % 360) + 360) % 360 });

  const save = useMutation({
    mutationFn: () => {
      if (!table.label.trim()) throw new Error('Give the table a name or number');
      if (table.minCovers > table.maxCovers) throw new Error('The smallest party can’t be more than the chairs');
      // Its current place on the canvas goes with it, moved or not.
      return updateTable(table.id, {
        label: table.label.trim(),
        minCovers: table.minCovers,
        maxCovers: table.maxCovers,
        shape: table.shape,
        width: table.width,
        height: table.height,
        rotation: table.rotation,
        areaId,
        x: table.x,
        y: table.y,
      });
    },
    onSuccess: async () => {
      toast('success', `Table ${table.label.trim()} saved.`);
      await onSaved();
    },
    onError: (error) => toast('error', error.message),
  });
  const remove = useMutation({
    mutationFn: () => removeTable(table.id),
    onSuccess: async () => {
      toast('success', `Table ${table.label} removed.`);
      setConfirmRemove(false);
      await onRemoved();
    },
    onError: (error) => {
      setConfirmRemove(false);
      toast('error', error.message);
    },
  });

  return (
    <SettingsSection
      title={`Table ${table.label || '…'}`}
      actions={
        <>
          {(dirty || areaId !== table.areaId) && <Badge variant="warning">Unsaved</Badge>}
          <Button variant="ghost" size="icon-sm" aria-label="Close the table" onClick={onClose}>
            <X size={15} />
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!table.label.trim()) setOpen('name');
          save.mutate();
        }}
      >
        <PickerRow icon={Tag} title="Name" value={table.label.trim() || 'Needs a name'} muted={!table.label.trim()} open={open === 'name'} onToggle={() => toggle('name')}>
          <Input aria-label="Name" autoFocus value={table.label} maxLength={20} onChange={(event) => onChange({ label: event.target.value })} />
        </PickerRow>
        <PickerRow
          icon={Users}
          title="Chairs"
          value={`${table.maxCovers} ${table.maxCovers === 1 ? 'chair' : 'chairs'}`}
          open={open === 'chairs'}
          onToggle={() => toggle('chairs')}
        >
          <NumberStepper
            label="Chairs"
            value={table.maxCovers}
            min={1}
            max={50}
            unit={table.maxCovers === 1 ? 'chair' : 'chairs'}
            onChange={(value) => onChange({ maxCovers: value, ...(table.minCovers > value && { minCovers: value }) })}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">The most it seats — drawn round the table on the map.</p>
        </PickerRow>
        <PickerRow
          icon={UsersRound}
          title="Smallest party"
          value={`${table.minCovers} ${table.minCovers === 1 ? 'guest' : 'guests'}`}
          open={open === 'smallest'}
          onToggle={() => toggle('smallest')}
        >
          <NumberStepper
            label="Smallest party"
            value={table.minCovers}
            min={1}
            max={table.maxCovers}
            unit={table.minCovers === 1 ? 'guest' : 'guests'}
            onChange={(value) => onChange({ minCovers: value })}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">Online booking won’t give it to a smaller party.</p>
        </PickerRow>
        <PickerRow
          icon={Grid2X2}
          title="Shape"
          value={SHAPES.find((shape) => shape.value === table.shape)?.label ?? table.shape}
          open={open === 'shape'}
          onToggle={() => toggle('shape')}
        >
          <SegmentedControl<DiningTableShape>
            value={table.shape}
            onChange={(next) => onChange({ shape: next, ...SHAPE_SIZE[next] })}
            ariaLabel="Shape"
            options={SHAPES}
            className="w-full [&>button]:flex-1"
          />
        </PickerRow>
        <PickerRow icon={ArrowLeftRight} title="Size" value={`${table.width} × ${table.height}`} open={open === 'size'} onToggle={() => toggle('size')}>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Width</span>
              <NumberStepper label="Width" value={table.width} min={20} max={600} step={10} onChange={(value) => onChange({ width: value })} />
            </div>
            <div className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Depth</span>
              <NumberStepper label="Depth" value={table.height} min={20} max={600} step={10} onChange={(value) => onChange({ height: value })} />
            </div>
          </div>
        </PickerRow>
        <PickerRow icon={RotateCcw} title="Turn" value={`${table.rotation}°`} open={open === 'turn'} onToggle={() => toggle('turn')}>
          <div className="grid grid-cols-4 gap-1.5">
            <Button type="button" variant="outline" className="h-9" onClick={() => turn(-15)}>
              −15°
            </Button>
            <Button type="button" variant="outline" className="h-9" onClick={() => turn(15)}>
              +15°
            </Button>
            <Button type="button" variant="outline" className="h-9" onClick={() => turn(90)}>
              +90°
            </Button>
            <Button type="button" variant="ghost" className="h-9" disabled={table.rotation === 0} onClick={() => onChange({ rotation: 0 })}>
              Reset
            </Button>
          </div>
        </PickerRow>
        {areas.length > 1 && (
          <PickerRow
            icon={Layers}
            title="Area"
            value={areas.find((area) => area.id === areaId)?.name ?? '—'}
            open={open === 'area'}
            onToggle={() => toggle('area')}
          >
            <Select
              value={areaId}
              onValueChange={setAreaId}
              options={areas.map((area) => ({ value: area.id, label: area.name }))}
              ariaLabel="Area"
              className="w-full"
            />
          </PickerRow>
        )}
        <div className="!mt-4 flex items-center justify-between gap-2 border-t border-rule/40 pt-4">
          <Button type="button" variant="ghost" className="gap-1.5 text-exception hover:text-exception" onClick={() => setConfirmRemove(true)}>
            <Trash2 size={14} aria-hidden="true" />
            Remove
          </Button>
          <Button type="submit" className="min-w-32" disabled={save.isPending}>
            {save.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            Save table
          </Button>
        </div>
      </form>
      {confirmRemove && (
        <ConfirmModal
          title={`Remove table ${table.label}?`}
          message="It comes off the floor plan and can’t be booked. Past bookings keep it in their history. A table with bookings still to come can’t be removed until they’re moved."
          confirmLabel="Remove table"
          pendingLabel="Removing…"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate()}
          onClose={() => setConfirmRemove(false)}
        />
      )}
    </SettingsSection>
  );
}
