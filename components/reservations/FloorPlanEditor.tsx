'use client';

import { type UseQueryResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { InfoRow, InfoRows, PickerRow, RowMenu } from '@/components/cms/rows';
import {
  ArrowLeftRight,
  Beer,
  Box as BoxIcon,
  Check,
  ChefHat,
  ChevronDown,
  ChevronsUp,
  Columns2,
  Copy,
  Grid2X2,
  type IconComponent,
  Layers,
  LayoutGrid,
  Loader2,
  LogIn,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Sprout,
  Store,
  Tag,
  Trash2,
  Type,
  UserRound,
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
import { Modal } from '@/components/shared/Modal';
import { SegmentedControl } from '@/components/shared/SegmentedControl';
import { Bone } from '@/components/shared/Skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FieldLabel } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select } from '@/components/ui/select';

import { moduleQueryKeys } from '@/lib/modules/query-keys';
import {
  type DiningArea,
  type DiningTableShape,
  type FixtureKind,
  type FloorChairs,
  type FloorFixture,
  type FloorSeat,
  createArea,
  createFixture,
  createTable,
  deleteArea,
  removeFixture,
  removeTable,
  saveLayout,
  updateArea,
  updateFixture,
  updateTable,
} from '@/lib/modules/reservations/client';
import { toast } from '@/lib/toast';
import { type AutosaveStatus, type Autosaver, createAutosaver } from '@/lib/utils/autosave';
import { CHAIR_LIMITS, SIDES, addSeat, autoSides, chairTotal, chairsFitShape, seatsFrom, turnSeat } from '@/lib/utils/floor-chairs';
import {
  type Box,
  FIXTURE_KINDS,
  FIXTURE_NAMES,
  FIXTURE_SIZE,
  moveBox,
  pastedBox,
  turnBy,
  turnFixture,
  turnTable,
} from '@/lib/utils/floor-fixtures';
import {
  BAR_SEAT,
  type FloorTable,
  SHAPE_SIZE,
  copyLabel,
  freeSpot,
  movedTables,
  nextBarSeatLabel,
  nextTableLabel,
} from '@/lib/utils/reservations';
import { useUiSettingsStore } from '@/stores/uiSettingsStore';

import { type CanvasKeyAction, type CanvasTarget, type ChairEditing, FloorCanvas } from './FloorCanvas';

/** What the table panel changes that isn't where the table sits. */
type TableEdit = Partial<Pick<FloorTable, 'label' | 'minCovers' | 'maxCovers' | 'shape' | 'chairs' | 'areaId'>>;
type FixtureEdit = Partial<Pick<FloorFixture, 'label'>>;
const GEOMETRY = ['x', 'y', 'width', 'height', 'rotation'] as const;

const geometryOf = (box: Box): Box => ({ x: box.x, y: box.y, width: box.width, height: box.height, rotation: box.rotation });
const withoutKeys = <T,>(record: Record<string, T>, keys: readonly string[]) =>
  Object.fromEntries(Object.entries(record).filter(([id]) => !keys.includes(id)));
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** The fields of an edit that differ from what's saved. */
const changedFields = <T extends object>(saved: T, edit: Partial<T>): Partial<T> =>
  Object.fromEntries(Object.entries(edit).filter(([key, value]) => !same(saved[key as keyof T], value))) as Partial<T>;

/** What ⌘C holds: the table or fixture as the map showed it, unsaved changes included. */
type Copied = { type: 'table'; item: FloorTable } | { type: 'fixture'; item: FloorFixture };

const SHAPES: { value: DiningTableShape; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'round', label: 'Round' },
  { value: 'rectangle', label: 'Long' },
];

/** Chairs a new table starts with, by shape. */
const STARTING_CHAIRS: Record<DiningTableShape, number> = { square: 2, round: 4, rectangle: 6 };

const FIXTURE_ICONS: Record<FixtureKind, IconComponent> = {
  entrance: LogIn,
  door: ArrowLeftRight,
  window: Columns2,
  wall: Minus,
  bar: Beer,
  counter: Store,
  kitchen: ChefHat,
  toilets: UserRound,
  stairs: ChevronsUp,
  pillar: BoxIcon,
  plant: Sprout,
  label: Type,
};

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
 * Draw the floor: rooms (areas), their tables and fixtures (windows, the
 * entrance, the bar…). Drag anything to move it, pull a handle to resize, turn
 * it in 15° steps (or R), nudge with the arrow keys, Delete to remove. Every
 * move, resize, turn and panel change shows on the map at once and saves itself
 * a moment later: positions in a single `PUT /floor/layout`, the rest (names,
 * seats, shape, chairs, area, labels) table by table and fixture by fixture.
 * Adding, copying (⌘C/⌘V, ⌘D or Duplicate) and removing are immediate.
 * Removing a table keeps its history — past bookings still point at it.
 * A table's chairs may be placed by hand: drag them on the map, R turns the
 * chosen one, Delete removes it; they save with the table.
 */
export function FloorPlanEditor({ locationId, floor }: { locationId: string; floor: UseQueryResult<DiningArea[]> }) {
  const queryClient = useQueryClient();
  const [areaId, setAreaId] = useState<string | null>(null);
  const [selected, setSelected] = useState<CanvasTarget | null>(null);
  // Drafts, by id — they survive a refetch of the floor and a change of area.
  const [tableMoves, setTableMoves] = useState<Record<string, Box>>({});
  const [tableEdits, setTableEdits] = useState<Record<string, TableEdit>>({});
  const [fixtureMoves, setFixtureMoves] = useState<Record<string, Box>>({});
  const [fixtureEdits, setFixtureEdits] = useState<Record<string, FixtureEdit>>({});
  const showChairs = useUiSettingsStore((state) => state.showChairs);
  const setShowChairs = useUiSettingsStore((state) => state.setShowChairs);
  const [areaDialog, setAreaDialog] = useState<'new' | 'rename' | null>(null);
  const [confirmDeleteArea, setConfirmDeleteArea] = useState(false);
  const [confirmRemoveTable, setConfirmRemoveTable] = useState<FloorTable | null>(null);
  // The chair placed by hand that's chosen, on the selected table.
  const [chosenChair, setChosenChair] = useState<{ tableId: string; index: number } | null>(null);
  // An in-memory copy: the browser's clipboard is left alone.
  const clipboard = useRef<Copied | null>(null);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
  const fail = (error: Error) => toast('error', error.message);
  const forget = (target: CanvasTarget) => {
    if (target.type === 'table') {
      setTableMoves((all) => withoutKeys(all, [target.id]));
      setTableEdits((all) => withoutKeys(all, [target.id]));
    } else {
      setFixtureMoves((all) => withoutKeys(all, [target.id]));
      setFixtureEdits((all) => withoutKeys(all, [target.id]));
    }
  };

  const savedTables = floor.data?.flatMap((candidate) => candidate.tables) ?? [];
  const savedFixtures = floor.data?.flatMap((candidate) => candidate.fixtures ?? []) ?? [];
  const tables = savedTables.map((table) => ({ ...table, ...tableEdits[table.id], ...tableMoves[table.id] }));
  const fixtures = savedFixtures.map((fixture) => ({ ...fixture, ...fixtureEdits[fixture.id], ...fixtureMoves[fixture.id] }));
  const movedTableList = movedTables(savedTables, tables);
  const movedFixtureList = movedTables(savedFixtures, fixtures);
  const tableChanges = savedTables
    .map((table) => ({ table, patch: changedFields(table, tableEdits[table.id] ?? {}) }))
    .filter((change) => Object.keys(change.patch).length > 0);
  // A label cleared back to nothing is no change from none.
  const fixtureChanges = savedFixtures
    .filter((fixture) => fixtureEdits[fixture.id]?.label !== undefined)
    .map((fixture) => ({ fixture, label: fixtureEdits[fixture.id]!.label?.trim() || null }))
    .filter((change) => change.label !== (change.fixture.label?.trim() || null));

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
      setSelected(null);
      toast('success', 'Area deleted.');
      await invalidate();
    },
    onError: (error) => {
      setConfirmDeleteArea(false);
      fail(error);
    },
  });
  /** Somewhere clear in the area for something new. */
  const spotIn = (area: DiningArea, size: { width: number; height: number }) =>
    freeSpot([...tables.filter((table) => table.areaId === area.id), ...fixtures.filter((fixture) => fixture.areaId === area.id)], size);
  const addTable = useMutation({
    mutationFn: ({ area, shape }: { area: DiningArea; shape: DiningTableShape | 'bar_seat' }) => {
      if (shape === 'bar_seat') {
        const size = { width: BAR_SEAT.width, height: BAR_SEAT.height };
        return createTable({
          areaId: area.id,
          label: nextBarSeatLabel(savedTables.map((table) => table.label)),
          minCovers: BAR_SEAT.covers,
          maxCovers: BAR_SEAT.covers,
          shape: BAR_SEAT.shape,
          rotation: 0,
          chairs: BAR_SEAT.chairs,
          ...size,
          ...spotIn(area, size),
        });
      }
      const size = SHAPE_SIZE[shape];
      return createTable({
        areaId: area.id,
        label: nextTableLabel(savedTables.map((table) => table.label)),
        minCovers: 1,
        maxCovers: STARTING_CHAIRS[shape],
        shape,
        rotation: 0,
        chairs: null,
        ...size,
        ...spotIn(area, size),
      });
    },
    onSuccess: async (table) => {
      setSelected({ type: 'table', id: table.id });
      await invalidate();
    },
    onError: fail,
  });
  const addFixture = useMutation({
    mutationFn: ({ area, kind }: { area: DiningArea; kind: FixtureKind }) => {
      const size = FIXTURE_SIZE[kind];
      return createFixture({ areaId: area.id, kind, label: null, rotation: 0, ...size, ...spotIn(area, size) });
    },
    onSuccess: async (fixture) => {
      setSelected({ type: 'fixture', id: fixture.id });
      await invalidate();
    },
    onError: fail,
  });
  const dropTable = useMutation({
    mutationFn: (table: FloorTable) => removeTable(table.id),
    onSuccess: async (_, table) => {
      toast('success', `Table ${table.label} removed.`);
      setConfirmRemoveTable(null);
      setSelected(null);
      forget({ type: 'table', id: table.id });
      await invalidate();
    },
    onError: (error) => {
      setConfirmRemoveTable(null);
      fail(error);
    },
  });
  const dropFixture = useMutation({
    mutationFn: (fixture: FloorFixture) => removeFixture(fixture.id),
    onSuccess: async (_, fixture) => {
      toast('success', `${fixture.label?.trim() || FIXTURE_NAMES[fixture.kind]} removed.`);
      setSelected(null);
      forget({ type: 'fixture', id: fixture.id });
      await invalidate();
    },
    onError: fail,
  });
  /** A copy of a table or fixture, made at once: 20 along in its own area, on the same spot in another. */
  const duplicate = useMutation({
    mutationFn: async ({ copy, into }: { copy: Copied; into: DiningArea; fromClipboard: boolean }): Promise<Copied> => {
      const box = pastedBox(geometryOf(copy.item), copy.item.areaId === into.id);
      if (copy.type === 'fixture') {
        const { kind, label } = copy.item;
        const fixture = await createFixture({ areaId: into.id, kind, label: label?.trim() || null, ...box });
        return { type: 'fixture', item: fixture };
      }
      const { shape, minCovers, maxCovers, chairs, label } = copy.item;
      const taken = [...savedTables, ...tables].map((table) => table.label);
      const table = await createTable({
        areaId: into.id,
        label: copyLabel(label, taken),
        minCovers: Math.min(minCovers, maxCovers),
        maxCovers,
        shape,
        chairs: chairs && chairsFitShape(shape, chairs) ? chairs : null,
        ...box,
      });
      return { type: 'table', item: table };
    },
    onSuccess: async (created, { fromClipboard }) => {
      setSelected({ type: created.type, id: created.item.id });
      // The next paste lands 20 on from this one, not on top of it.
      if (fromClipboard) clipboard.current = created;
      await invalidate();
    },
    onError: fail,
  });

  // Every change saves itself a moment after the last one. A table edit that
  // isn't valid yet (no name, smallest party above its seats) waits as a draft.
  const validTableChanges = tableChanges.filter(({ table, patch }) => {
    const label = (patch.label ?? table.label).trim();
    return label.length > 0 && (patch.minCovers ?? table.minCovers) <= (patch.maxCovers ?? table.maxCovers);
  });
  const snapshot: FloorDraft = {
    tables: movedTableList.map(({ id, x, y, width, height, rotation }) => ({ id, x, y, width, height, rotation })),
    fixtures: movedFixtureList.map(({ id, x, y, width, height, rotation }) => ({ id, x, y, width, height, rotation })),
    tableChanges: validTableChanges.map(({ table, patch }) => ({
      id: table.id,
      patch: { ...patch, ...(patch.label !== undefined && { label: patch.label.trim() }) },
      edit: tableEdits[table.id] ?? {},
    })),
    fixtureChanges: fixtureChanges.map(({ fixture, label }) => ({ id: fixture.id, label, edit: fixtureEdits[fixture.id] ?? {} })),
  };
  const pendingKey = JSON.stringify(snapshot);
  const hasPending = snapshot.tables.length + snapshot.fixtures.length + snapshot.tableChanges.length + snapshot.fixtureChanges.length > 0;

  const [saveState, setSaveState] = useState<AutosaveStatus>('idle');
  const saverRef = useRef<Autosaver<FloorDraft> | null>(null);
  useEffect(() => {
    const saver = createAutosaver<FloorDraft>({
      delay: 900,
      save: async (draft) => {
        try {
          if (draft.tables.length > 0 || draft.fixtures.length > 0) await saveLayout(locationId, draft.tables, draft.fixtures);
          for (const { id, patch } of draft.tableChanges) await updateTable(id, patch);
          for (const { id, label } of draft.fixtureChanges) await updateFixture(id, { label });
        } finally {
          await queryClient.invalidateQueries({ queryKey: moduleQueryKeys.reservations.all });
        }
        // Clear only the drafts that are still what was sent — a change made while saving stays, and goes next.
        const sent = <T extends { id: string }>(list: T[]) => new Map(list.map((item) => [item.id, item]));
        const tablesSent = sent(draft.tables);
        const fixturesSent = sent(draft.fixtures);
        const tableEditsSent = sent(draft.tableChanges);
        const fixtureEditsSent = sent(draft.fixtureChanges);
        setTableMoves((all) => keepChanged(all, (id, box) => sameBox(box, tablesSent.get(id))));
        setFixtureMoves((all) => keepChanged(all, (id, box) => sameBox(box, fixturesSent.get(id))));
        setTableEdits((all) => keepChanged(all, (id, edit) => sameJson(edit, tableEditsSent.get(id)?.edit)));
        setFixtureEdits((all) => keepChanged(all, (id, edit) => sameJson(edit, fixtureEditsSent.get(id)?.edit)));
      },
      onStatus: (status, error) => {
        setSaveState(status);
        if (status === 'error' && error instanceof Error) toast('error', error.message);
      },
    });
    saverRef.current = saver;
    // Leaving the editor sends what's waiting.
    return () => void saver.flush();
  }, [locationId, queryClient]);

  useEffect(() => {
    if (hasPending) saverRef.current?.schedule(JSON.parse(pendingKey) as FloorDraft);
  }, [pendingKey, hasPending]);

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
  const shownTables = tables.filter((table) => table.areaId === area.id);
  const shownFixtures = fixtures.filter((fixture) => fixture.areaId === area.id);
  const selectedTable = selected?.type === 'table' ? (tables.find((table) => table.id === selected.id) ?? null) : null;
  const selectedFixture = selected?.type === 'fixture' ? (fixtures.find((fixture) => fixture.id === selected.id) ?? null) : null;

  const placeTable = (id: string, box: Box) => setTableMoves((all) => ({ ...all, [id]: geometryOf(box) }));
  const placeFixture = (id: string, box: Box) => setFixtureMoves((all) => ({ ...all, [id]: geometryOf(box) }));
  const moveTable = (id: string, x: number, y: number) => {
    const table = tables.find((candidate) => candidate.id === id);
    if (table) placeTable(id, moveBox(geometryOf(table), x, y));
  };
  const moveFixture = (id: string, x: number, y: number) => {
    const fixture = fixtures.find((candidate) => candidate.id === id);
    if (fixture) placeFixture(id, moveBox(geometryOf(fixture), x, y));
  };
  /** A table turned keeps its angle (its chairs are per side); a fixture at a right angle is squared up. */
  const placeChange = (box: Box, kind: 'table' | 'fixture', turned: boolean) =>
    turned ? (kind === 'table' ? turnTable(box, box.rotation) : turnFixture(box, box.rotation)) : moveBox(box, box.x, box.y);
  /** A panel change: where it sits goes with the layout, the rest with the table's own save. */
  const changeTable = (table: FloorTable, patch: Partial<FloorTable>) => {
    const geometry = Object.fromEntries(Object.entries(patch).filter(([key]) => (GEOMETRY as readonly string[]).includes(key)));
    const rest = Object.fromEntries(Object.entries(patch).filter(([key]) => !(GEOMETRY as readonly string[]).includes(key))) as TableEdit;
    if (Object.keys(geometry).length > 0) {
      const next = geometryOf({ ...table, ...geometry });
      // A wider, deeper or turned table near the edge is nudged back onto the floor.
      placeTable(table.id, placeChange(next, 'table', 'rotation' in geometry));
    }
    if (Object.keys(rest).length > 0) setTableEdits((all) => ({ ...all, [table.id]: { ...all[table.id], ...rest } }));
    if (rest.areaId && rest.areaId !== area.id) setAreaId(rest.areaId);
  };
  const changeFixture = (fixture: FloorFixture, patch: Partial<FloorFixture>) => {
    if (patch.label !== undefined) setFixtureEdits((all) => ({ ...all, [fixture.id]: { ...all[fixture.id], label: patch.label } }));
    const geometry = Object.fromEntries(Object.entries(patch).filter(([key]) => (GEOMETRY as readonly string[]).includes(key)));
    if (Object.keys(geometry).length > 0) {
      const next = geometryOf({ ...fixture, ...geometry });
      placeFixture(fixture.id, placeChange(next, 'fixture', 'rotation' in geometry));
    }
  };
  const keyAction = (target: CanvasTarget, action: CanvasKeyAction) => {
    const item =
      target.type === 'table' ? tables.find((table) => table.id === target.id) : fixtures.find((fixture) => fixture.id === target.id);
    if (!item) return;
    if (action === 'delete') {
      if (target.type === 'table') setConfirmRemoveTable(item as FloorTable);
      else dropFixture.mutate(item as FloorFixture);
      return;
    }
    const rotation = turnBy(item.rotation, action === 'turn-right' ? 15 : -15);
    if (target.type === 'table') placeTable(item.id, turnTable(geometryOf(item), rotation));
    else placeFixture(item.id, turnFixture(geometryOf(item), rotation));
  };

  // ─── Copy and paste ───
  const selectedItem: Copied | null = selectedTable
    ? { type: 'table', item: selectedTable }
    : selectedFixture
      ? { type: 'fixture', item: selectedFixture }
      : null;
  const copySelected = () => {
    if (!selectedItem) return false;
    clipboard.current = selectedItem;
    toast('info', 'Copied — paste with ⌘V or Ctrl+V.');
    return true;
  };
  const pasteCopy = () => {
    if (!clipboard.current || duplicate.isPending) return false;
    duplicate.mutate({ copy: clipboard.current, into: area, fromClipboard: true });
    return true;
  };
  const duplicateSelected = () => {
    if (!selectedItem || duplicate.isPending) return false;
    duplicate.mutate({ copy: selectedItem, into: area, fromClipboard: false });
    return true;
  };

  // ─── Chairs placed by hand round the selected table ───
  const seats = selectedTable?.chairs?.mode === 'custom' ? selectedTable.chairs.seats : null;
  const chairIndex =
    selectedTable && seats && chosenChair?.tableId === selectedTable.id && chosenChair.index < seats.length ? chosenChair.index : null;
  const setSeats = (table: FloorTable, next: FloorSeat[]) => changeTable(table, { chairs: { mode: 'custom', seats: next } });
  const chairAction = (index: number, action: CanvasKeyAction | 'add') => {
    if (!selectedTable || !seats) return;
    if (action === 'add') {
      const seat = addSeat(selectedTable, seats);
      if (!seat) return;
      setSeats(selectedTable, [...seats, seat]);
      setChosenChair({ tableId: selectedTable.id, index: seats.length });
    } else if (action === 'delete') {
      setSeats(
        selectedTable,
        seats.filter((_, i) => i !== index),
      );
      setChosenChair(null);
    } else {
      setSeats(
        selectedTable,
        seats.map((seat, i) => (i === index ? turnSeat(seat, action === 'turn-right' ? 15 : -15) : seat)),
      );
    }
  };
  const chairEditing: ChairEditing | null =
    selectedTable && seats
      ? {
          tableId: selectedTable.id,
          selected: chairIndex,
          onSelect: (index) => setChosenChair(index === null ? null : { tableId: selectedTable.id, index }),
          onMove: (index, at) =>
            setSeats(
              selectedTable,
              seats.map((seat, i) => (i === index ? { ...seat, ...at } : seat)),
            ),
          onKeyAction: chairAction,
        }
      : null;
  const showArea = (id: string) => {
    setAreaId(id);
    setSelected(null);
  };
  // Saving is automatic, so "Unsaved" marks only an edit that can't go yet (no name, too few seats).
  const isDirty = (id: string) =>
    tableChanges.some((change) => change.table.id === id) && !validTableChanges.some((change) => change.table.id === id);

  const aside = selectedTable ? (
    <TableInspector
      key={selectedTable.id}
      table={selectedTable}
      dirty={isDirty(selectedTable.id)}
      areas={floor.data}
      onChange={(patch) => changeTable(selectedTable, patch)}
      onClose={() => setSelected(null)}
      onRemove={() => setConfirmRemoveTable(selectedTable)}
      onDuplicate={duplicateSelected}
      duplicating={duplicate.isPending}
      chairIndex={chairIndex}
      onChair={chairAction}
    />
  ) : selectedFixture ? (
    <FixtureInspector
      key={selectedFixture.id}
      fixture={selectedFixture}
      dirty={isDirty(selectedFixture.id)}
      removing={dropFixture.isPending}
      onChange={(patch) => changeFixture(selectedFixture, patch)}
      onClose={() => setSelected(null)}
      onRemove={() => dropFixture.mutate(selectedFixture)}
      onDuplicate={duplicateSelected}
      duplicating={duplicate.isPending}
    />
  ) : (
    <SettingsSection
      title="Floor plan"
      footnote="Drag to move, pull a handle to resize. Arrow keys nudge, R turns, Delete removes, ⌘C and ⌘V copy, ⌘D duplicates."
    >
      <InfoRows>
        <InfoRow icon={Layers} title="Areas">
          <span className="text-sm font-semibold tabular-nums">{floor.data.length}</span>
        </InfoRow>
        <InfoRow icon={LayoutGrid} title={`Tables in ${area.name}`}>
          <span className="text-sm font-semibold tabular-nums">{shownTables.length}</span>
        </InfoRow>
        <InfoRow icon={Users} title="Seats">
          <span className="text-sm font-semibold tabular-nums">{shownTables.reduce((sum, table) => sum + table.maxCovers, 0)}</span>
        </InfoRow>
        <InfoRow icon={Columns2} title="Fixtures">
          <span className="text-sm font-semibold tabular-nums">{shownFixtures.length}</span>
        </InfoRow>
        <InfoRow icon={Users} title="Show chairs">
          <Switch checked={showChairs} onChange={setShowChairs} label="Show chairs" />
        </InfoRow>
      </InfoRows>
    </SettingsSection>
  );

  return (
    <SettingsTabBody narrowAside aside={aside}>
      <section aria-label={`${area.name} floor plan`} className="space-y-3">
        {/* One line: which area, then what you can add, then the area's own menu. */}
        <div className="flex flex-wrap items-center gap-2">
          {floor.data.length > 1 ? (
            floor.data.length <= 3 ? (
              <SegmentedControl<string>
                size="lg"
                value={area.id}
                onChange={showArea}
                ariaLabel="Area"
                options={floor.data.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              />
            ) : (
              <Select
                value={area.id}
                onValueChange={showArea}
                ariaLabel="Area"
                className="h-11 w-44"
                options={floor.data.map((candidate) => ({ value: candidate.id, label: candidate.name }))}
              />
            )
          ) : (
            <h2 className="px-1 text-base font-semibold tracking-title text-heading">{area.name}</h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            <SaveState state={saveState} onRetry={() => void saverRef.current?.retry()} />
            <AddTableMenu disabled={addTable.isPending} onAdd={(shape) => addTable.mutate({ area, shape })} />
            <AddFixtureMenu disabled={addFixture.isPending} onAdd={(kind) => addFixture.mutate({ area, kind })} />
            <RowMenu
              label={`${area.name}: more`}
              items={[
                { icon: Plus, label: 'New area', onClick: () => setAreaDialog('new') },
                { icon: Pencil, label: `Rename ${area.name}`, onClick: () => setAreaDialog('rename') },
                { icon: Trash2, label: `Delete ${area.name}`, onClick: () => setConfirmDeleteArea(true), danger: true },
              ]}
            />
          </div>
        </div>

        <FloorCanvas
          tables={shownTables}
          fixtures={shownFixtures}
          selectedId={selectedTable?.id ?? null}
          onSelect={(id) => {
            setSelected(id ? { type: 'table', id } : null);
            setChosenChair(null);
          }}
          onMove={moveTable}
          selectedFixtureId={selectedFixture?.id ?? null}
          onSelectFixture={(id) => setSelected(id ? { type: 'fixture', id } : null)}
          onMoveFixture={moveFixture}
          onResize={(target, box) => (target.type === 'table' ? placeTable(target.id, box) : placeFixture(target.id, box))}
          onKeyAction={keyAction}
          chairEditing={chairEditing}
          showChairs={showChairs}
          ariaLabel={`${area.name} floor plan editor`}
          // No card around it: the drawing area is marked by a dashed edge on the page itself.
          className="rounded-lg border border-dashed border-border bg-background"
        />
      </section>
      <ClipboardKeys onCopy={copySelected} onPaste={pasteCopy} onDuplicate={duplicateSelected} />

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
              : 'The area and anything drawn in it come off the floor plan.'
          }
          confirmLabel="Delete area"
          isPending={dropArea.isPending}
          onConfirm={() => dropArea.mutate(area.id)}
          onClose={() => setConfirmDeleteArea(false)}
        />
      )}
      {confirmRemoveTable && (
        <ConfirmModal
          title={`Remove table ${confirmRemoveTable.label}?`}
          message="It comes off the floor plan and can’t be booked. Past bookings keep it in their history. A table with bookings still to come can’t be removed until they’re moved."
          confirmLabel="Remove table"
          pendingLabel="Removing…"
          isPending={dropTable.isPending}
          onConfirm={() => dropTable.mutate(confirmRemoveTable)}
          onClose={() => setConfirmRemoveTable(null)}
        />
      )}
    </SettingsTabBody>
  );
}

/** Typing somewhere, or in a dialog: the shortcuts belong to that, not the map. */
function typingOrInDialog(target: EventTarget | null) {
  const element = (target instanceof HTMLElement ? target : null) ?? (document.activeElement as HTMLElement | null);
  if (!element) return false;
  return (
    element.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName) || Boolean(element.closest('[role="dialog"]'))
  );
}

/**
 * ⌘/Ctrl+C copies the selected table or fixture, ⌘/Ctrl+V pastes it, ⌘/Ctrl+D
 * duplicates it. Each handler says whether it acted. Left alone while typing,
 * in a dialog, or with text selected — the browser's copy and paste win there.
 */
function ClipboardKeys({ onCopy, onPaste, onDuplicate }: { onCopy: () => boolean; onPaste: () => boolean; onDuplicate: () => boolean }) {
  // Re-bound each render, so the handlers are always the current ones.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.repeat) return;
      if (typingOrInDialog(event.target)) return;
      const key = event.key.toLowerCase();
      if (key === 'c') {
        if (window.getSelection()?.toString()) return;
        onCopy();
      } else if (key === 'v') {
        onPaste();
      } else if (key === 'd' && onDuplicate()) {
        // Not the browser's bookmark.
        event.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });
  return null;
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
        <Input
          label="Name"
          value={name}
          maxLength={80}
          placeholder="Main room, Terrace, Bar…"
          autoFocus
          onChange={(event) => setName(event.target.value)}
        />
      </form>
    </Modal>
  );
}

/** Add a table: one button, the shapes in its menu with the outline each draws and the chairs it starts with. */
function AddTableMenu({ disabled, onAdd }: { disabled: boolean; onAdd: (shape: DiningTableShape | 'bar_seat') => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="touch" className="px-3 text-sm" disabled={disabled}>
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
            className="flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-band focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
          >
            <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
              <ShapeGlyph shape={shape.value} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-foreground">{shape.label}</span>
              <span className="block text-xs text-muted-foreground">{STARTING_CHAIRS[shape.value]} chairs to start</span>
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            onAdd('bar_seat');
          }}
          className="flex min-h-11 w-full items-center gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-band focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-background">
            <span className="size-3.5 rounded-full border-[1.5px] border-current text-muted-foreground" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-foreground">Bar seat</span>
            <span className="block text-xs text-muted-foreground">A stool for 1</span>
          </span>
        </button>
      </PopoverContent>
    </Popover>
  );
}

/** Add a fixture: each kind with its icon and its full name. */
function AddFixtureMenu({ disabled, onAdd }: { disabled: boolean; onAdd: (kind: FixtureKind) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="touch" className="px-3 text-sm" disabled={disabled}>
          {disabled ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus size={14} aria-hidden="true" />}
          Fixture
          <ChevronDown size={14} className="text-muted-foreground" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        <div className="grid grid-cols-2 gap-0.5">
          {FIXTURE_KINDS.map((kind) => {
            const Icon = FIXTURE_ICONS[kind];
            return (
              <button
                key={kind}
                type="button"
                onClick={() => {
                  setOpen(false);
                  onAdd(kind);
                }}
                className="flex min-h-11 items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left transition-colors hover:bg-band focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
              >
                <Icon size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="text-sm font-semibold text-foreground">{FIXTURE_NAMES[kind]}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** −15°, +15°, +90° and back to straight. */
function TurnButtons({ rotation, onTurn }: { rotation: number; onTurn: (rotation: number) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      <Button type="button" variant="outline" size="touch" className="px-0 text-sm" onClick={() => onTurn(turnBy(rotation, -15))}>
        −15°
      </Button>
      <Button type="button" variant="outline" size="touch" className="px-0 text-sm" onClick={() => onTurn(turnBy(rotation, 15))}>
        +15°
      </Button>
      <Button type="button" variant="outline" size="touch" className="px-0 text-sm" onClick={() => onTurn(turnBy(rotation, 90))}>
        +90°
      </Button>
      <Button type="button" variant="ghost" size="touch" className="px-0 text-sm" disabled={rotation === 0} onClick={() => onTurn(0)}>
        Reset
      </Button>
    </div>
  );
}

function SizeSteppers({
  width,
  height,
  min,
  max,
  onChange,
}: {
  width: number;
  height: number;
  min: number;
  /** Tables stop at 600 in the API; fixtures run the canvas. */
  max?: number;
  onChange: (patch: { width?: number; height?: number }) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <FieldLabel as="span">Width</FieldLabel>
        <NumberStepper
          label="Width"
          value={width}
          min={min}
          max={Math.min(max ?? 1200, 1200)}
          step={10}
          onChange={(value) => onChange({ width: value })}
        />
      </div>
      <div className="space-y-1.5">
        <FieldLabel as="span">Depth</FieldLabel>
        <NumberStepper
          label="Depth"
          value={height}
          min={min}
          max={Math.min(max ?? 800, 800)}
          step={10}
          onChange={(value) => onChange({ height: value })}
        />
      </div>
    </div>
  );
}

const SIDE_LABELS = { top: 'Top', right: 'Right', bottom: 'Bottom', left: 'Left' } as const;

/**
 * Auto (one per seat), chosen per side — or round a round table — or placed by
 * hand (Custom). The map shows them as they change; Custom starts from what's drawn.
 */
function ChairsControl({
  table,
  onChange,
  onAddChair,
}: {
  table: FloorTable;
  onChange: (chairs: FloorChairs | null) => void;
  onAddChair: () => void;
}) {
  const chairs = table.chairs && chairsFitShape(table.shape, table.chairs) ? table.chairs : null;
  const total = chairTotal({ ...table, chairs });
  const mode = chairs ? (chairs.mode === 'custom' ? 'custom' : 'chosen') : 'auto';
  return (
    <div className="space-y-3">
      <SegmentedControl<'auto' | 'chosen' | 'custom'>
        size="lg"
        value={mode}
        onChange={(next) =>
          onChange(
            next === 'auto'
              ? null
              : next === 'custom'
                ? { mode: 'custom', seats: seatsFrom({ ...table, chairs }) }
                : table.shape === 'round'
                  ? { mode: 'around', count: Math.min(CHAIR_LIMITS.around, table.maxCovers) }
                  : { mode: 'sides', ...autoSides(table) },
          )
        }
        ariaLabel="Chairs"
        options={[
          { value: 'auto', label: 'Auto' },
          { value: 'chosen', label: table.shape === 'round' ? 'Around' : 'Per side' },
          { value: 'custom', label: 'Custom' },
        ]}
        className="w-full [&>button]:flex-1"
      />
      {chairs?.mode === 'sides' && (
        <div className="grid grid-cols-2 gap-3">
          {SIDES.map((side) => (
            <div key={side} className="space-y-1.5">
              <FieldLabel as="span">{SIDE_LABELS[side]}</FieldLabel>
              <NumberStepper
                label={`${SIDE_LABELS[side]} chairs`}
                value={chairs[side]}
                min={0}
                max={CHAIR_LIMITS.side}
                onChange={(value) => onChange({ ...chairs, [side]: value })}
              />
            </div>
          ))}
        </div>
      )}
      {chairs?.mode === 'around' && (
        <NumberStepper
          label="Chairs round the table"
          value={chairs.count}
          min={0}
          max={CHAIR_LIMITS.around}
          unit={chairs.count === 1 ? 'chair' : 'chairs'}
          onChange={(count) => onChange({ mode: 'around', count })}
        />
      )}
      {chairs?.mode === 'custom' && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="touch"
            className="px-3 text-sm"
            disabled={chairs.seats.length >= CHAIR_LIMITS.custom}
            onClick={onAddChair}
          >
            <Plus size={14} aria-hidden="true" />
            Add chair
          </Button>
          <Button type="button" variant="ghost" size="touch" className="px-3 text-sm" onClick={() => onChange(null)}>
            Reset to auto
          </Button>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        {chairs
          ? total === table.maxCovers
            ? `${total} chairs, one per seat.`
            : `${total} ${total === 1 ? 'chair' : 'chairs'} drawn; it seats ${table.maxCovers}.`
          : `One chair per seat — ${table.maxCovers}.`}
        {chairs?.mode === 'custom' && ' Drag them on the plan; tap one to turn or remove it.'}
      </p>
    </div>
  );
}

/** The chair placed by hand that's chosen on the map: turn it in 15° steps, or remove it. */
function ChosenChair({ index, seat, onAction }: { index: number; seat: FloorSeat; onAction: (action: CanvasKeyAction) => void }) {
  return (
    <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/5 p-1.5">
      <span className="min-w-0 flex-1 px-1.5 text-sm font-semibold text-foreground">
        Chair {index + 1} <span className="font-normal text-muted-foreground tabular-nums">· {seat.rotation}°</span>
      </span>
      <Button
        type="button"
        variant="outline"
        size="touch"
        className="px-3 text-sm"
        aria-label="Turn the chair back 15°"
        onClick={() => onAction('turn-left')}
      >
        −15°
      </Button>
      <Button
        type="button"
        variant="outline"
        size="touch"
        className="px-3 text-sm"
        aria-label="Turn the chair 15°"
        onClick={() => onAction('turn-right')}
      >
        +15°
      </Button>
      <Button type="button" variant="ghost" size="icon-touch" aria-label="Remove the chair" onClick={() => onAction('delete')}>
        <Trash2 size={16} aria-hidden="true" />
      </Button>
    </div>
  );
}

function TableInspector({
  table,
  dirty,
  areas,
  onChange,
  onClose,
  onRemove,
  onDuplicate,
  duplicating,
  chairIndex,
  onChair,
}: {
  /** The table as the map shows it — unsaved changes included. */
  table: FloorTable;
  dirty: boolean;
  areas: DiningArea[];
  onChange: (patch: Partial<FloorTable>) => void;
  onClose: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
  /** The chair placed by hand chosen on the map, if any. */
  chairIndex: number | null;
  onChair: (index: number, action: CanvasKeyAction | 'add') => void;
}) {
  // One row open at a time; a tap on the open one closes it.
  const [open, setOpen] = useState<'name' | 'seats' | 'chairs' | 'smallest' | 'shape' | 'size' | 'turn' | 'area' | null>(null);
  const toggle = (row: NonNullable<typeof open>) => setOpen((current) => (current === row ? null : row));
  const chairs = table.chairs && chairsFitShape(table.shape, table.chairs) ? table.chairs : null;
  const chairCount = chairTotal({ ...table, chairs });
  const chosenSeat = chairIndex !== null && chairs?.mode === 'custom' ? chairs.seats[chairIndex] : undefined;

  return (
    <SettingsSection
      title={`Table ${table.label.trim() || '…'}`}
      actions={
        <>
          {dirty && <Badge variant="warning">Unsaved</Badge>}
          <RowMenu
            label={`Table ${table.label}: more`}
            pending={duplicating}
            items={[
              { icon: Copy, label: 'Duplicate', onClick: onDuplicate },
              { icon: Trash2, label: 'Remove table', onClick: onRemove, danger: true },
            ]}
          />
          <Button variant="ghost" size="icon-sm" aria-label="Close the table" onClick={onClose}>
            <X size={15} />
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {chosenSeat && chairIndex !== null && (
          <ChosenChair index={chairIndex} seat={chosenSeat} onAction={(action) => onChair(chairIndex, action)} />
        )}
        <PickerRow
          icon={Tag}
          title="Name"
          value={table.label.trim() || 'Needs a name'}
          muted={!table.label.trim()}
          tone={table.label.trim() ? undefined : 'warning'}
          open={open === 'name'}
          onToggle={() => toggle('name')}
        >
          <Input
            aria-label="Name"
            autoFocus
            value={table.label}
            maxLength={20}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </PickerRow>
        <PickerRow
          icon={Users}
          title="Seats"
          // Chairs placed by hand are counted beside the seats — a mismatch is worth seeing, never a block.
          value={`${table.maxCovers} ${table.maxCovers === 1 ? 'seat' : 'seats'}${chairs?.mode === 'custom' ? ` · ${chairCount} ${chairCount === 1 ? 'chair' : 'chairs'}` : ''}`}
          open={open === 'seats'}
          onToggle={() => toggle('seats')}
        >
          <NumberStepper
            label="Seats"
            value={table.maxCovers}
            min={1}
            max={50}
            unit={table.maxCovers === 1 ? 'seat' : 'seats'}
            onChange={(value) => onChange({ maxCovers: value, ...(table.minCovers > value && { minCovers: value }) })}
          />
          <p className="mt-1.5 text-xs text-muted-foreground">The most it seats.</p>
        </PickerRow>
        <PickerRow
          icon={Grid2X2}
          title="Chairs"
          value={chairs ? `${chairCount} ${chairs.mode === 'custom' ? 'placed by hand' : 'placed'}` : 'Auto'}
          open={open === 'chairs'}
          onToggle={() => toggle('chairs')}
        >
          <ChairsControl table={table} onChange={(next) => onChange({ chairs: next })} onAddChair={() => onChair(-1, 'add')} />
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
          icon={LayoutGrid}
          title="Shape"
          value={SHAPES.find((shape) => shape.value === table.shape)?.label ?? table.shape}
          open={open === 'shape'}
          onToggle={() => toggle('shape')}
        >
          <SegmentedControl<DiningTableShape>
            size="lg"
            value={table.shape}
            // Chairs chosen for the old shape go back to Auto, as the API does.
            onChange={(next) =>
              onChange({ shape: next, ...SHAPE_SIZE[next], ...(!chairsFitShape(next, table.chairs) && { chairs: null }) })
            }
            ariaLabel="Shape"
            options={SHAPES}
            className="w-full [&>button]:flex-1"
          />
        </PickerRow>
        <PickerRow
          icon={ArrowLeftRight}
          title="Size"
          value={`${table.width} × ${table.height}`}
          open={open === 'size'}
          onToggle={() => toggle('size')}
        >
          <SizeSteppers width={table.width} height={table.height} min={20} max={600} onChange={onChange} />
        </PickerRow>
        <PickerRow icon={RotateCcw} title="Turn" value={`${table.rotation}°`} open={open === 'turn'} onToggle={() => toggle('turn')}>
          <TurnButtons rotation={table.rotation} onTurn={(rotation) => onChange({ rotation })} />
        </PickerRow>
        {areas.length > 1 && (
          <PickerRow
            icon={Layers}
            title="Area"
            value={areas.find((area) => area.id === table.areaId)?.name ?? '—'}
            open={open === 'area'}
            onToggle={() => toggle('area')}
          >
            <Select
              value={table.areaId}
              onValueChange={(areaId) => onChange({ areaId })}
              options={areas.map((area) => ({ value: area.id, label: area.name }))}
              ariaLabel="Area"
              className="w-full"
            />
          </PickerRow>
        )}
      </div>
    </SettingsSection>
  );
}

function FixtureInspector({
  fixture,
  dirty,
  removing,
  onChange,
  onClose,
  onRemove,
  onDuplicate,
  duplicating,
}: {
  fixture: FloorFixture;
  dirty: boolean;
  removing: boolean;
  onChange: (patch: Partial<FloorFixture>) => void;
  onClose: () => void;
  onRemove: () => void;
  onDuplicate: () => void;
  duplicating: boolean;
}) {
  const [open, setOpen] = useState<'label' | 'size' | 'turn' | null>(null);
  const toggle = (row: NonNullable<typeof open>) => setOpen((current) => (current === row ? null : row));
  const name = FIXTURE_NAMES[fixture.kind];
  const Icon = FIXTURE_ICONS[fixture.kind];

  return (
    <SettingsSection
      title={fixture.label?.trim() || name}
      icon={Icon}
      actions={
        <>
          {dirty && <Badge variant="warning">Unsaved</Badge>}
          <RowMenu
            label={`${name}: more`}
            pending={removing || duplicating}
            items={[
              { icon: Copy, label: 'Duplicate', onClick: onDuplicate },
              { icon: Trash2, label: `Delete ${name.toLowerCase()}`, onClick: onRemove, danger: true },
            ]}
          />
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X size={15} />
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <PickerRow
          icon={Tag}
          title="Label"
          value={fixture.label?.trim() || name}
          muted={!fixture.label?.trim()}
          open={open === 'label'}
          onToggle={() => toggle('label')}
        >
          <Input
            aria-label="Label"
            autoFocus
            value={fixture.label ?? ''}
            maxLength={40}
            placeholder={name}
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </PickerRow>
        <PickerRow
          icon={ArrowLeftRight}
          title="Size"
          value={`${fixture.width} × ${fixture.height}`}
          open={open === 'size'}
          onToggle={() => toggle('size')}
        >
          <SizeSteppers width={fixture.width} height={fixture.height} min={10} onChange={onChange} />
        </PickerRow>
        <PickerRow icon={RotateCcw} title="Turn" value={`${fixture.rotation}°`} open={open === 'turn'} onToggle={() => toggle('turn')}>
          <TurnButtons rotation={fixture.rotation} onTurn={(rotation) => onChange({ rotation })} />
        </PickerRow>
      </div>
    </SettingsSection>
  );
}

/** What one autosave sends: moved boxes, and the table and fixture edits (with the draft each came from). */
type PlacedBox = Box & { id: string };

interface FloorDraft {
  tables: PlacedBox[];
  fixtures: PlacedBox[];
  tableChanges: { id: string; patch: TableEdit; edit: TableEdit }[];
  fixtureChanges: { id: string; label: string | null; edit: FixtureEdit }[];
}

const sameBox = (a: Pick<Box, 'x' | 'y' | 'width' | 'height' | 'rotation'>, b: PlacedBox | undefined) =>
  !!b && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height && a.rotation === b.rotation;

const sameJson = (a: unknown, b: unknown) => b !== undefined && JSON.stringify(a) === JSON.stringify(b);

/** The drafts with the saved ones taken out — `saved(id, value)` says which were sent unchanged. */
function keepChanged<T>(all: Record<string, T>, saved: (id: string, value: T) => boolean): Record<string, T> {
  const next = Object.fromEntries(Object.entries(all).filter(([id, value]) => !saved(id, value)));
  return Object.keys(next).length === Object.keys(all).length ? all : next;
}

/** "Saving…", "Saved", or "Couldn’t save · Retry" — quiet, in the toolbar. */
function SaveState({ state, onRetry }: { state: AutosaveStatus; onRetry: () => void }) {
  if (state === 'idle') return null;
  if (state === 'error' || state === 'conflict') {
    return (
      <span role="status" className="flex items-center gap-1 text-xs text-exception">
        <span className="hidden sm:inline">Couldn’t save</span>
        <Button variant="ghost" size="sm" className="h-9 px-2 text-exception" onClick={onRetry}>
          Retry
        </Button>
      </span>
    );
  }
  const saving = state === 'pending' || state === 'saving';
  return (
    <span role="status" className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
      {saving ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Check size={12} aria-hidden="true" />}
      <span className="hidden sm:inline">{saving ? 'Saving…' : 'Saved'}</span>
    </span>
  );
}
