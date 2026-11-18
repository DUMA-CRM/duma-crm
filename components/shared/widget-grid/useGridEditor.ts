'use client';

import { useState } from 'react';

import { type Cell, type GridSize, compact, firstFreeSlot } from '@/lib/utils/widget-grid';

type Draft = { cells: Cell[]; reset: boolean };

function sameLayout(a: Cell[], b: Cell[]) {
  return (
    a.length === b.length &&
    a.every(({ key, x, y, w, h }, index) => {
      const cell = b[index]!;
      return cell.key === key && cell.x === x && cell.y === y && cell.w === w && cell.h === h;
    })
  );
}

export function useGridEditor(saved: Cell[], defaults: Cell[], hasPersonal: boolean, columns: number) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const cells = draft?.cells ?? saved;
  const isDirty = !!draft && ((draft.reset && hasPersonal) || !sameLayout(draft.cells, saved));

  function change(next: Cell[]) {
    if (!sameLayout(next, cells)) setDraft({ cells: next, reset: false });
  }

  return {
    cells,
    isDirty,
    resetRequested: draft?.reset === true,
    change,
    remove: (key: string) => change(compact(cells.filter((cell) => cell.key !== key))),
    add: (key: string, size: GridSize) => {
      if (cells.some((cell) => cell.key === key)) return;
      change(compact([...cells, { key, ...size, ...firstFreeSlot(cells, size, columns) }]));
    },
    reset: () => setDraft({ cells: defaults, reset: true }),
    cancel: () => setDraft(null),
  };
}
