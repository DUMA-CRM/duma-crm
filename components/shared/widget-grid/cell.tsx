'use client';

import { createContext, useContext } from 'react';

import type { GridSize } from '@/lib/utils/widget-grid';

/** A widget's cell: its family in cells and its drawn size in px. */
export interface WidgetCell extends GridSize {
  width: number;
  height: number;
}

/**
 * The cell a widget is drawn in, or null outside a grid. Widgets read it to
 * choose their layout for the family (small, medium, large, extra large) and
 * to size a chart to the space they actually have.
 */
export const WidgetCellContext = createContext<WidgetCell | null>(null);

export const useWidgetCell = () => useContext(WidgetCellContext);
