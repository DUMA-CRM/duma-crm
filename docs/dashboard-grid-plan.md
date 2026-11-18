# Dashboard grid editor — plan of work

Status: in progress. Codex built the first pass; on 2026-11-18 it was reworked, then redesigned after Apple’s widgets (HIG “Widgets”).

Goal: the dashboard becomes a home-screen-style grid. In edit mode you drag a
widget to a place on the grid, resize it to one of its sizes, remove it, add it
back from a gallery, then press Done. Dashboard only for now; the grid engine is
generic so other pages can adopt it later.

## Decisions (from the grilling session)

| Topic | Decision |
|---|---|
| Where editing happens | In place on `/dashboard`. The entry is **"Edit dashboard" in the avatar menu** (`components/layout/AccountMenu.tsx`), with no button on the page and no long-press. |
| Empty space | **Pack upwards.** You choose column and order, and widgets float up so there are never holes. Others shove aside while you drag. |
| Grid unit | **4 columns (up to 320 px each); fixed 92 px rows** — one `Fact` stat tile tall, so a single figure fills a row and nothing is forced square. Sizes in rows: compact 1×1, bar 2×1, banner 4×1, small 1×2, medium 2×2, large 2×4, extra large 4×4. |
| Resizing | Each widget offers only the sizes whose **whole reading fits**; the corner drag snaps between them. Half height (compact, bar, banner) only where nothing is cut: stats, launch tiles, Live, Selling today, module cards, and banners for Taken today and Orders by hour — never Needs you or My workday. |
| Widget style | **DUMA materials, Apple sizes.** A card with DUMA’s 10 px corner (`--radius`), a flat 7% wash of its domain colour with a hairline in the same colour, StatCard’s solid accent chip in the header, StatCard’s `DeltaBadge` for every comparison, facts on a lighter inner tray (7 px). Shared `Button`, `SegmentedControl` and `Drawer` throughout. No press-down. |
| Stat collections | **Split, and drawn as the shared `Fact` tile** (the figures row's own card, not `StatCard`). Net sales, Orders, Average order, Labour, Refunds paid are separate widgets; compact is the plain tile; bar adds a sparkline / hour bars / ring at its right (`Fact` `aside`); small adds the day under the figure and medium the figures behind it too (`Fact` `children`). |
| Drag / resize | **Hand-rolled**, no new dependency. **Touch is a hard requirement.** |
| Touch drag | Hold about 200 ms to lift; a quick swipe still scrolls. Handles and buttons have 44 px hit areas. |
| Edit mode look | **No shaking.** Widgets wear a still dashed outline; the grey minus badge and the resize corner do the rest. |
| What is clickable | **Widgets are for reading.** A widget with a screen behind it has a small open link in its header; the five stat widgets have none. Rows inside (needs-you items, lanes, rota) and launch tiles are links. |
| Small screens | **4 columns from 600 px of grid width** (an 11-inch iPad in both orientations), editable. **Phones reflow into 2 columns**, read-only, like a phone home screen. |
| Saving | **Done / Cancel.** Edit mode holds a draft; Done saves it in one request. Reset to default is inside edit mode. |
| Scope | Personal, plus **"Save as team default"** for holders of `tenants:write`, written to the **editor's own audience** only. |
| Team layer meaning | **Starting arrangement, not a ceiling.** Hiding a widget in the team default does not remove it from anyone's gallery. |
| New module switched on | **Gallery only.** A saved personal board does not change by itself. |
| Gallery | **iOS’s two steps:** a grid of every widget live at its smallest size; choosing one shows its description and a live preview at each family (Small / Medium / Large / Extra large), then **Add widget**. |
| Reuse | **Generic engine + `<WidgetGrid>`**, wired only to the dashboard for now. |

## What already exists

- **DB:** `dashboard_widgets` already has `grid_column`, `grid_row`, `width` and
  `height`. **No migration is needed.**
- **API:** `src/routes/dashboard-layouts.ts` stores the system, workspace and
  personal layers on a 12-column grid. It validates `width × height` against
  each widget's `sizes[]` whitelist (`src/lib/dashboard-widgets.ts`). Workspace
  publish is `POST /dashboard-layouts/:tenantId/publish`, gated on
  `tenants:write`.
- **CRM:** the coordinates are **ignored**. `lib/utils/dashboard-flow.ts`
  (`boardLayout`) renders "full-width first, then a two-column bento" by
  estimated height. `/settings/configuration/dashboard`
  (`PersonalDashboardControls`) only shows, hides, reorders and applies presets.

## Phases

### Phase 0 — Size catalogue (done, Apple families)

From Apple's HIG “Widgets”: small is square, medium two smalls plus the gap
wide, large two by two, extra large four by two (iPad, Mac); standard content
margin 16 pt, tight 11 pt; text no smaller than 11 pt; tapping a widget opens
the right place; the gallery shows realistic previews with a one-line, verb-first
description. iOS 18 edit mode: a continuous jiggle, a grey “−” badge top-left,
a white resize arc on the bottom-right corner.

| Widget | Families | Default |
|---|---|---|
| Net sales, Orders, Average order, Labour, Refunds paid | S, M (M adds the hours as bars for sales and orders) | S |
| Needs you | M, L | M |
| Taken today (day curve) | M, L, XL | L |
| Live | S, M | M |
| Orders by hour | M, L, XL | L |
| Selling today | S (best seller), M, L | L |
| My workday | M, L, XL | XL |
| Launch widgets (filled, like Shortcuts) | S, M | S |
| Stock health, Team today, Purchasing, Tenders, Customers, Content | S, M, L | M |

Old saved layouts snap to the nearest family on read and repack.

### Phase 1 — Pure grid engine (`lib/utils/widget-grid.ts`, medium)

Page-agnostic and fully unit-tested (`tests/unit/widget-grid.test.mts`). This is
where correctness lives.

- Types: `Cell { key, x, y, w, h }` and `GridSpec { columns, sizes(key) }`.
- `collides` and `compact(layout)`: packs upwards, stable by (y, x).
- `move(layout, key, x, y)`: places the widget, pushes colliders down, then
  compacts. Used live during a drag, recomputed only when the target cell
  changes.
- `resize(layout, key, size)`: clamps to the columns, pushes, then compacts.
  `nearestSize(sizes, w, h)` snaps a free drag to a registered size.
- `firstFreeSlot(layout, size)`: where a widget from the gallery lands (the
  bottom-most free slot).
- `reflow(layout, columns)`: the 4-column layout in reading order (y, then x),
  each width reduced to the largest registered size that fits, otherwise full
  width.
- `normalize(saved, sizes)`: takes legacy or invalid placements (old sizes,
  overlaps, off-grid), snaps them to the nearest registered size, then compacts.
  Runs on every read.
- `pointToCell(px, py, metrics)`.
- Shared validator `isValidLayout(layout, columns)` checks bounds and overlap.
  It is mirrored in the API (Phase 2).

### Phase 2 — API (duma-api, small to medium)

1. Replace the `sizes[]` of every widget in `src/lib/dashboard-widgets.ts`
   with the Phase 0 catalogue. Re-place `DASHBOARD_TEMPLATES` so every template
   is already packed. Extend `dashboard-widgets.test.ts`: templates don't
   overlap, fit 4 columns, and use registered sizes.
2. **Make the team layer a starting arrangement, not a ceiling:**
   - `availableWidgets` returns the **system widgets** (`canUse`), not
     `workspaceWidgets`.
   - Personal publish validates against `systemWidgets`.
   - The resolved personal layer drops a key only when `canUse` fails, not when
     it is missing from the workspace layer.
3. Both publish routes reject overlapping or out-of-bounds layouts with
   `400 invalid_layout`.
4. At resolve time, run a normalise step (snap to a registered size, then
   compact) so layouts saved under the old sizes still render.
5. Refresh `openapi.json` in the CRM. `tests/api-contract.test.mts` must still
   pass.
6. Update the vault: API dashboard note, plus a Cross-Repo entry for the layer
   semantics change.

### Phase 3 — Generic grid UI (`components/shared/widget-grid/`, large)

- **`<WidgetGrid>`** measures its own width with `ResizeObserver` and picks 12, 6
  or 4 columns. Collapsing the sidebar or rotating an iPad re-measures. It
  renders CSS Grid with
  `grid-template-columns: repeat(N, 1fr)`, `grid-auto-rows: var(--grid-row)`,
  and each item at `grid-column: x / span w; grid-row: y / span h`. It uses
  `motion` `layout` so shoved widgets glide. Props:
  - a renderer map `key → (size) => ReactNode`
  - `layout`
  - `editing`
- **`useGridEditor`**: draft state, plus `move`, `resize`, `remove`, `add`,
  `reset`, `cancel` and `isDirty`, all delegating to the Phase 1 engine.
- **Pointer layer** (`useGridDrag`), with touch done properly:
  - `pointerdown` starts a 200 ms hold timer. Moving more than 8 px before it
    fires cancels the drag and lets the page scroll.
  - Once lifted:
    - the pointer is captured
    - a **non-passive `touchmove` listener calls `preventDefault`** so iOS and
      Android stop scrolling
    - the card scales to 1.03 with a shadow, and a placeholder shows the drop
      cell
  - The page auto-scrolls when the pointer nears the viewport's top or bottom
    edge.
  - In edit mode: `user-select: none`, `-webkit-touch-callout: none`, and
    `contextmenu` suppressed, so a long-press never opens the text or image
    menu.
  - `pointercancel` puts the widget back where it was.
- **Resize:**
  - A corner handle with a 44 px hit area. Dragging it shows a snapping outline
    at the nearest registered size.
  - **Size chips (S / M / L)** on the selected widget are the tap- and
    keyboard-friendly alternative, and the reliable path on phones.
- **No hover on tablets.** Every edit affordance is always visible in edit mode
  and never shown only on hover: the remove badge, the resize handle, and the
  size chips on the selected widget. Tapping a widget selects it; holding it
  lifts it.
- **Edit chrome:**
  - a gentle wobble (removed under `prefers-reduced-motion`, which shows a
    dashed outline instead)
  - a "−" remove badge
  - card content made `inert` so links don't fire
- **Keyboard and screen readers:** focus a widget, then:
  - Space lifts it
  - the arrow keys move it one cell
  - Space drops it
  - Esc cancels
  - every move is announced in an `aria-live` region ("Stock health, column 7,
    row 3")

### Phase 4 — Dashboard wiring (medium)

- `ResolvedDashboard` renders through `<WidgetGrid>` using the saved
  coordinates. Afterwards, delete `boardLayout`, `WIDGET_HEIGHT` and their
  tests.
- `TodayBanners` and the page header stay above the grid, outside it.
- Edit mode lives in the URL as `/dashboard?edit=1`, so the avatar-menu entry
  works from any page.
- **Desktop and tablet.** Editing is available whenever the grid has 12
  columns, which covers an 11-inch iPad in both orientations. The avatar-menu
  entry shows from a viewport of ≥768 px; the grid's measured column count is
  the real gate. If the grid drops below 4 columns mid-edit (a narrow window or
  split view), the board renders read-only and shows one line: "Widen the
  window to edit your dashboard". The draft is kept, so widening it resumes the
  edit. Phones never get the entry.
- **Rotating the iPad mid-edit** keeps the draft: both orientations are 12
  columns, so only the pixel size of a cell changes. A drag that is in progress
  when the device rotates is cancelled (`pointercancel`).
- Edit bar:
  - "+ Add widget"
  - "Reset to default"
  - Cancel
  - **Done**
  - for `hasCapability('tenants:write')` only, Done gets a menu item **"Save as
    team default"**. It publishes the workspace layout for the editor's own
    audience, then clears their personal layer so they see what the team sees.
- Leaving with unsaved changes asks for confirmation.
- **Gallery drawer:**
  - shows `availableWidgets` that aren't on the board
  - each is the **real widget, rendered live** at its real pixel size on this
    board (`cellPixels`), scaled down to the drawer width and made `inert`
  - size buttons (`1×1`, `2×1`, …) switch the preview; Add places it at
    `firstFreeSlot` and closes the drawer
  - in edit mode `TodayProvider` is mounted whenever any trading widget could
    be added, so the gallery has data and adding the first one doesn't remount
    the board
  - previews run their widgets' queries. If that proves heavy, render a preview
    only once it scrolls into view
- After Done or Reset, invalidate
  `moduleQueryKeys.organization.key('dashboard-layout', 'resolved', tenantId)`.
  No optimistic update.
- `empty:hidden` goes away: in a fixed grid a widget always holds its cell, so
  a widget with nothing to say renders its quiet empty state.

### Phase 5 — Widgets (done, Apple style)

- One frame, `components/dashboard/widget/Widget.tsx`: the card, tinted
  header, `WidgetFigure`, `WidgetCaption`, `WidgetRow`, `WidgetBar`,
  `WidgetButton`, and loading, error-with-retry and empty states drawn inside
  the frame. `useFamily()` and `useRows()` read the cell from
  `WidgetCellContext` (family and pixel size).
- Every dashboard component is rebuilt on it; the data and queries are
  unchanged. Taken today draws the day curve as its own SVG from real data
  only (today in apricot to now, typical dashed periwinkle, target green).
- The target control is a header capsule; Suggest a shift opens a modal from
  My workday.
- **Richer content (2026-11-18):** shared parts in
  `components/dashboard/widget/parts.tsx` — ring, donut, curve, facts grid,
  icon tile, today-vs-typical bars. Every small widget carries a picture (sales
  curve, hour bars, labour and refund rings, module gauges); every medium adds a
  facts grid; Needs you lists the checks that passed; Live shows the lanes as
  one bar and how long the oldest order has waited (`oldestActiveAt` in
  `useTodayDashboard`). Per-hour series live in `lib/utils/day-series.ts`
  (tested).
- **To check visually:** every widget at every family on an iPad upright and
  in landscape, light and dark.

### Phase 6 — Retire the settings page (small)

- `/settings/configuration/dashboard` uses `redirect('/dashboard?edit=1')`.
  Remove its settings nav entry and delete `PersonalDashboardControls`.
- The "Quick layout" presets (Service first, Essentials…) go away. They were
  about ordering; Reset to default covers getting back to the starting point.

### Phase 7 — Knowledge base

- Update `Screens/UI - Dashboard.md` (sources, how it is built, how to add a
  widget, which now requires sizes) and `Change Log/UI Change Log.md`.
- New ADRs:
  - *The dashboard is a fixed-cell grid edited in place*
  - *Drag and drop is hand-rolled* (why there's no dnd library, and the touch
    rules)
  - *The team layout is a starting arrangement, not a ceiling*
- API side: dashboard-layouts note and the change log.

## Release order

API first (sizes, layer semantics, normalise on read; backward compatible with
the current CRM, because the bento ignores coordinates), then CRM. No DB
release.

## Risks and open points

- ~~**R1 — Editing on tablet or phone.**~~ Decided 2026-11-18: editing works on
  desktop and tablet, including an 11-inch iPad in both orientations. Tablets
  get the same 4-column grid as desktop, just narrower, so edits always happen
  on the saved 4-column layout and nothing is translated back from a reflowed
  view. Phones are read-only.
- **R1b — One-tile-wide cards on an upright iPad.** A tile is about 185 px wide
  there. If a card doesn't read at 1 tile, raise that widget's minimum width
  to 2 rather than adding a tablet-specific size.
- **R2 — Fixed cells against live data.** Cards must truncate gracefully. Phase
  5 is the real cost of this project; don't underestimate it.
- **R3 — "Save as team default" for the editor's own audience only** means an
  owner can't shape the frontline board yet. Choosing an audience in edit mode
  is the natural follow-up.
- **R4 — Gallery only for new modules.** Someone with a saved board won't notice
  a newly enabled module's widget unless they open the gallery. A "New" badge
  needs the API to track which keys the personal layer has seen; it is a
  follow-up, not in scope.
- **R5 — Touch testing.** The acceptance device is a **real 11-inch iPad in
  Safari, in both orientations, with the sidebar open and collapsed**. Test:
  - hold-to-lift against scrolling
  - resizing
  - the remove badge
  - the gallery
  - rotating mid-edit
  - split view, which drops below 4 columns and must turn the board read-only

  Also test a touch laptop. Desktop devtools emulation does not reproduce
  scroll-vs-drag arbitration.
