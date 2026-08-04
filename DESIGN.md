---
name: DUMA
description: Cool-paper operations software for coffee businesses — hairline rules, one blue accent, numbers that line up.
colors:
  bluerocratic: 'oklch(0.5767 0.2301 262.3)'
  bluerocratic-hover: 'oklch(0.515 0.222 262.3)'
  dark-eclipse: 'oklch(0.2347 0.0732 269.9)'
  cool-paper: 'oklch(0.957 0.003 248)'
  card-white: 'oklch(1 0 0)'
  surface-offset: 'oklch(0.935 0.008 265)'
  cool-step: 'oklch(0.915 0.011 265)'
  slate-ink: 'oklch(0.33 0.045 268)'
  slate-muted: 'oklch(0.5 0.03 265)'
  slate-faint: 'oklch(0.68 0.02 265)'
  divider: 'oklch(0.895 0.012 265)'
  hairline: 'oklch(0.865 0.014 265)'
  control-edge: 'oklch(0.845 0.016 265)'
  inspiration-peak: 'oklch(0.52 0.105 166)'
  inspiration-peak-highlight: 'oklch(0.945 0.03 166)'
  pumpkin-pie: 'oklch(0.55 0.13 64)'
  pumpkin-pie-highlight: 'oklch(0.955 0.035 64)'
  youthful-coral: 'oklch(0.55 0.18 29)'
  info-blue: 'oklch(0.55 0.2 262)'
  info-blue-highlight: 'oklch(0.95 0.03 262)'
typography:
  display:
    fontFamily: 'Questrial, system-ui, sans-serif'
    fontSize: 'clamp(2.25rem, 5vw, 3.75rem)'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: '-0.02em'
  headline:
    fontFamily: 'Questrial, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: 'normal'
  title:
    fontFamily: 'Questrial, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.4
  metric:
    fontFamily: 'Questrial, system-ui, sans-serif'
    fontSize: '2rem'
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: '-0.02em'
    fontFeature: 'tabular-nums'
  body:
    fontFamily: 'Questrial, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: 'Questrial, system-ui, sans-serif'
    fontSize: '0.75rem'
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: '0.1em'
  micro:
    fontFamily: 'Questrial, system-ui, sans-serif'
    fontSize: '0.625rem'
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: '0.1em'
  mono:
    fontFamily: 'Geist Mono, ui-monospace, monospace'
    fontSize: '0.875rem'
    fontWeight: 400
rounded:
  sm: '0.3rem'
  md: '0.4rem'
  lg: '0.5rem'
  xl: '0.7rem'
  2xl: '0.9rem'
  full: '9999px'
spacing:
  xs: '0.25rem'
  sm: '0.375rem'
  md: '0.5rem'
  lg: '0.75rem'
  xl: '1rem'
  2xl: '1.25rem'
  3xl: '1.5rem'
  gutter: '1rem'
  gutter-wide: '2rem'
components:
  button-primary:
    backgroundColor: '{colors.bluerocratic}'
    textColor: '{colors.card-white}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
    padding: '0 0.625rem'
    height: '2.25rem'
  button-primary-hover:
    backgroundColor: '{colors.bluerocratic-hover}'
  button-outline:
    backgroundColor: '{colors.card-white}'
    textColor: '{colors.dark-eclipse}'
    rounded: '{rounded.lg}'
    padding: '0 0.625rem'
    height: '2.25rem'
  button-outline-hover:
    backgroundColor: '{colors.cool-step}'
  button-ghost-hover:
    backgroundColor: '{colors.cool-step}'
    textColor: '{colors.dark-eclipse}'
  card:
    backgroundColor: '{colors.card-white}'
    textColor: '{colors.dark-eclipse}'
    rounded: '{rounded.2xl}'
    padding: '1.25rem'
  input:
    backgroundColor: '{colors.card-white}'
    textColor: '{colors.dark-eclipse}'
    typography: '{typography.body}'
    rounded: '{rounded.lg}'
    padding: '0 0.75rem'
    height: '2.25rem'
  badge-primary:
    textColor: '{colors.bluerocratic}'
    typography: '{typography.label}'
    rounded: '{rounded.md}'
    padding: '0.125rem 0.5rem'
    height: '1.25rem'
  nav-item-active:
    textColor: '{colors.bluerocratic}'
    rounded: '{rounded.lg}'
    padding: '0.5625rem 0.75rem'
  table-header:
    backgroundColor: '{colors.cool-step}'
    textColor: '{colors.slate-muted}'
    typography: '{typography.micro}'
    padding: '0.75rem 1.25rem'
---

# Design System: DUMA

## Overview

**Creative North Star: "The Daylight Ledger"**

DUMA looks like a well-kept book read in good light. The page is cool paper (`#eff1f3`), the records sit on it as pure white cards with hairline rules, and every figure lines up in its column. Nothing is dramatised: the interface is a surface for reading a business accurately at 6am and at 3pm, on a tablet by the grinder and on a laptop in the back office. Where a lesser system would reach for a gradient, this one reaches for alignment.

Because the same application serves a barista mid-rush and an owner comparing sites, the system carries hierarchy in **weight, case, tracking and space** rather than in colour. Uppercase tracked micro-labels name a region; a hairline separates it; the number itself is the loudest thing in the frame. Bluerocratic blue appears sparingly and always with meaning — where you are, what is live, what to do next. The result reads calm at rest and specific under pressure, which is exactly the reading order an operator needs.

The material behaviour is tonal, not theatrical. Depth comes from a ladder of surfaces (page → card → offset → muted), and the one small navy-tinted shadow exists for a single reason: so that white clears cool paper. Real elevation is reserved for things that genuinely float — modals, popovers, drawers. Components are calm and tactile: soft 14px corners, honest hover response, a 1px press-down under the thumb, and touch targets sized for a wet hand.

**Confirmed anti-references — all four rejected:** the consumer POS toy (candy tiles, emoji, gradients, playful illustration); the enterprise grey admin panel (dense unstyled tables, grey-on-grey 12px, no rhythm); the marketing-led dashboard (purple gradients, glassmorphism, decorative charts, hero numbers with nothing to compare against); and the coffee-shop cliché (kraft texture, chalkboard type, sepia beans, hand-drawn signage). This is operational software for a coffee business, not café signage about one.

**Key Characteristics:**

- Cool paper page, pure white records, hairline rules — the ledger, not the panel
- One blue accent, rationed to state, position and action
- Tonal depth first; shadow only to clear the page, elevation only for what floats
- Figures always tabular, aligned, and comparable
- Uppercase tracked micro-labels as the naming device
- Calm and tactile controls: 14px corners, 1px press, real hover, thumb-sized targets
- Light and dark are equal citizens, defined token-for-token in the same file

## Colors

A cool, near-neutral grey ladder carrying a single saturated blue, with three brand hues held back for status and charts.

### Primary

- **Bluerocratic** (`#236bfe`): the only accent. It marks the active nav item (as a 10% tint with a 3px right-edge bar), the primary action, the focused control's ring, the active tab underline, the eyebrow above a page title, and series one in every chart. Darkened to `#1358e4` on hover; lifted to `#5492ff` in dark mode, where it takes near-black text rather than white because the lighter blue no longer clears AA against white.

### Secondary

- **Dark Eclipse** (`#111a40`): the ink. Every line of body copy, every heading, every figure. It is also the shadow tint — shadows are mixed from this navy rather than neutral black, because a grey shadow on a cool grey page reads as dirt rather than lift. Dark Eclipse is an *accent* colour, not a surface: the dark theme deliberately runs on near-achromatic charcoal instead, because tinting the whole dark ladder navy made every panel read blue.

### Tertiary

- **Inspiration Peak** (`#0c7c5b` light / `#51a383` dark): success, positive deltas, in-stock, sent, paid.
- **Pumpkin Pie** (`#a55e00` light / `#e89f57` dark): warning, low stock, awaiting action, variance worth a look.
- **Youthful Coral** (`#c5372c` light / `#ee8273` dark): destructive and error — refunds, failures, rejected sales, delete.

Each is darkened in light mode to roughly 5:1 on white, because `text-success` / `text-warning` / `text-destructive` are all used as body text, not just as dots. The full-strength pastels live in the chart palette and in dark mode, where the charcoal ladder lets them run at their real chroma.

### Neutral

- **Cool Paper** (`#eff1f3`): the page. Never a card.
- **Card White** (`#ffffff`): records, panels, the sidebar, the table shell, the popover.
- **Surface Offset** (`#e7e9ef`): row hover, chips, inert wells, unfilled bar-chart tracks — the "one step in from the page" fill.
- **Cool Step** (`#dfe3ea`): secondary and muted fills, table headers, segmented-control troughs. Deep enough to read on white *and* on cool paper, which is the constraint that set its value.
- **Slate Ink** (`#2b354d`): text on secondary and accent fills.
- **Slate Muted** (`#5b6375`): secondary text and labels. AA on every surface above — that is why it sits this dark.
- **Slate Faint** (`#9298a5`): the quietest legible tier — placeholder-adjacent, disabled glyphs, KDS scrollbar thumb.
- **Divider** (`#d8dce5`) and **Hairline** (`#ced3dc`): the two rule weights. Divider separates inside a card; hairline outlines the card itself.
- **Control Edge** (`#c7ccd7`): one step darker than hairline and used only on form controls, because an input has to hold its own edge whether it sits on white or straight on the page.

### Named Rules

**The Call-Light Rule.** Bluerocratic means one of three things: *where you are* (active nav, active tab), *what is live* (focus ring, selected state, series one), or *what to do next* (the primary action). It is never decoration, never a section ornament, and never used to make a heading feel important. A screen with blue in four unrelated places has lost the rule.

**The Two-Theme Rule.** Every colour token is defined twice — once in `:root`, once in `.dark` — in `app/globals.css`, in the same edit. A token that exists in only one theme is a bug, not a shortcut. Dark mode is not a filter over light mode: its surfaces are deliberately near-achromatic charcoal and several tokens (primary foreground, field fill, shadow tint) invert their logic rather than their value.

**The Clear-Both-Surfaces Rule.** Any fill used on a control, chip or row must read against both `#ffffff` and `#eff1f3`, because the same component appears on a card and directly on the page. Test both before committing a value.

## Typography

**Display / Body Font:** Questrial (with `system-ui`, `sans-serif`) — a single geometric humanist face carrying the entire interface, loaded via `next/font/google` as `--font-questrial`.
**Mono Font:** Geist Mono (with `ui-monospace`, `monospace`) as `--font-geist-mono` — identifiers, keys, payloads, raw values.

**Character:** Questrial's wide round bowls and single-storey geometry keep dense operational screens from feeling clerical; set small, tracked and uppercase it makes an excellent label face, which is why the system leans on micro-labels so heavily. Paired with Geist Mono's technical neutrality, the voice is precise without being severe.

### Hierarchy

- **Display** (600, `clamp(2.25rem, 5vw, 3.75rem)`, 1.15, `-0.02em`): marketing surfaces only — the landing hero. Never inside the CRM.
- **Headline** (600, 1.5rem → 1.875rem at `md`, 1.15): the page title in `PageLayout`. One per screen, and suppressible: the "hide page titles" device setting removes it entirely, so a screen must still be legible without it.
- **Title** (600, 1rem / 0.9375rem, 1.4): card headings, dialog titles, section names.
- **Metric** (700, 2rem, 1.1, `-0.02em`, tabular): the figure on a StatCard. Drops to 1.5rem on the compact variant. This is the loudest element in the system and the only place that size appears.
- **Body** (400, 0.875rem, 1.5): everything read as prose or table content. The default.
- **Label** (700, 0.75rem, tracking `0.1em`, uppercase optional): field labels, `Label`, `SegmentedControl` options.
- **Micro** (700, 0.625rem, tracking `0.1em`, uppercase): table column headers, the primary-coloured eyebrow above a page title, sidebar group headings, brand sub-lockup. Structural naming only.

### Named Rules

**The Ledger Rule.** Every number that could be compared to another number is `tabular-nums`. Figures in a table are right-aligned; figures in a card are left-aligned under their label with the delta beside or below them. A metric with no comparison available says so ("No comparison") rather than showing a bare number — the absence of a baseline is information.

**The Ten-Pixel Rule.** The 0.625rem tier is for uppercase tracked labels and column headers only — text that is *scanned*, never *read*. No value, no body copy, no error message, and nothing a barista needs mid-shift may live at that size. The tier is used 232 times today; each new use must pass this test.

**The Weight-Is-Not-A-Colour Rule.** Emphasis comes from the weight ladder (400 → 500 → 600 → 700) and from case and tracking. It does not come from turning text blue. See the Call-Light Rule.

**Committed change — not yet implemented.** Questrial ships a single 400 weight, yet the interface uses `font-semibold` 408 times and `font-bold` 334 times: nearly every emphasised word in DUMA is browser-synthesised faux bold, which thickens strokes unevenly and blurs at small sizes — precisely where this system does its most important work (micro-labels, table headers, metrics). The committed direction is to **adopt a variable sans with genuine 400/500/600/700 for all UI and data text, keeping Questrial for the wordmark and display moments only.** The recommended face is **Geist Sans**: the project already loads Geist Mono, so the sans/mono pair is designed together, it is variable with real weights, and its tabular figures suit the Ledger Rule. Until that swap lands, the weight values recorded above describe intent that the browser is currently faking. Do not add further weight steps in the meantime.

## Layout

**The shell.** A fixed left sidebar and an optional top bar, both driven by CSS variables so any full-height view can subtract them: `--sidebar-width: 220px`, `--sidebar-collapsed-width: 60px`, `--header-height: 56px`. Below `lg` (1024px) the sidebar leaves the flow and becomes an off-canvas drawer over a `black/30` backdrop; at `lg` and up it is static and collapsible to an icon rail. The "hide top bar" device setting zeroes `--header-height` at `lg`+ and relocates the header's tools into the sidebar footer, so no layout may assume the header exists.

**The page.** `PageLayout` owns every CRM screen and has two modes. The default flow stacks a header block (primary-coloured eyebrow → headline → optional header slot) above content on a `1.5rem` vertical rhythm. The `sidebar`/`fullHeight` mode reverses the negative page margin, claims `100vh - var(--header-height)`, and splits into a sticky header, a scrollable body, and an optional fixed right panel — the shape used by the POS, the KDS, and the editor shells. Gutters are `1rem`, widening to `2rem` at `md`.

**Rhythm.** Spacing is tight and consistent rather than airy: `0.5rem` between adjacent inline elements, `0.75rem` between cards in a grid, `1rem` between form rows, `1.25rem` of card padding, `1.5rem` between page sections. `md` (768px) does most of the responsive work, `lg` (1024px) is the shell boundary; `xl` and `2xl` are used only to add table columns and stat columns.

**Density.** Two explicit dials, and they are the right way to change density: `DataTable`'s `compact | default | comfortable`, and the `sm | md` size on StatCard. Columns declare their own `visibility` breakpoint so a table sheds detail on a phone instead of scrolling horizontally.

**Grids.** `StatCardGrid` presets are the standard metric row: 2, 3, 4 or 6 columns, always `0.75rem` gap, and always **two-up on phones** — never one, because a single stat per screen forces scrolling to compare.

**Scrollbars.** Hidden application-wide by design. The one exception is `.kds-scrollbar`, a 6px faint thumb for operational boards where an off-screen ticket queue must be visibly discoverable. Re-enabling scrollbars globally is a regression, not a fix.

### Named Rules

**The Thumb Rule.** On touch-first surfaces — POS, KDS, cash-up — no interactive target goes below 44px, and the primary ones run 48–96px (`h-12` through `h-24`). Desktop controls stay at the 36px (`h-9`) standard. `SegmentedControl` exposes `size="lg"` (44px) for exactly this reason; use it rather than restyling.

**The Titleless Rule.** Both the page title and the top bar can be switched off per device. Every screen must remain navigable and self-explanatory with neither present, which means header slots carry their own context and never rely on the `h1` above them.

## Elevation & Depth

Depth is **tonal first**. The surface ladder does the work: in light mode `#eff1f3` page → `#ffffff` card → `#e7e9ef` offset → `#dfe3ea` muted; in dark mode `#17191f` background → `#1c1e24` sidebar → `#202329` card → `#25272e` popover → `#2a2c33` offset/field → `#2d3038` muted. Read that ladder as the only legitimate way to express "inside", "on top of", or "inert".

Shadow is a supporting act with one job at the low end and a different job at the high end. Tailwind's stock shadows are neutral black, which smudges on a cool grey page, so the whole scale is retuned in a utilities layer to mix from `--shadow-tint` — brand navy in light mode, near-black in dark, where a navy shadow would only muddy the charcoal. The low steps gained a second, wider layer specifically so a white card separates from `#eff1f3`. The override sets `--tw-shadow` rather than `box-shadow`, which keeps Tailwind's ring and inset-ring composition working and preserves `shadow-primary/20`-style colour overrides.

### Shadow Vocabulary

- **`shadow-2xs` / `shadow-xs`** (single 1px layer at 6–7% tint): hairline lift for chips and inline controls.
- **`shadow-sm`** (`0 1px 2px` at 7% + `0 3px 10px -3px` at 10%): the resting card. Present on essentially every card in the app, and present for one reason only — clearance from the page.
- **`shadow-md`** (2px/8px layers at 8%/14%): raised panels and hovering interactive tiles.
- **`shadow-lg`** (4px/16px at 9%/18%): popovers, select menus, dropdowns.
- **`shadow-xl`** (8px/28px at 11%/22%): modals and toasts — things that genuinely float above everything.
- **`shadow-2xl`** (12px/40px at 14%/28%): reserved; the ceiling of the scale.

### Named Rules

**The Clearance Rule.** `shadow-sm` on a resting card is clearance, not decoration. If a surface already sits on a distinct tonal step (a well inside a card, a table row, a chip on grey), it gets no shadow at all — the ladder has already said what the shadow would say.

**The Float-Or-Flat Rule.** Anything above `shadow-md` must actually float above the page: modal, drawer, popover, toast, dragged item. A card that merely wants attention gets a border shift (`hover:border-primary/35`) or a tonal change, never a bigger shadow.

## Shapes

Corners are soft but disciplined, from a single `0.5rem` base scaled into five steps: `0.3rem` (sm), `0.4rem` (md), `0.5rem` (lg), `0.7rem` (xl), `0.9rem` (2xl). Three of them carry nearly all the weight, and the mapping is consistent enough to be a rule: **records use 2xl (14.4px), controls use lg (8px), counts and pills use full.** Chips, avatars, badge dots, progress tracks and bar-chart bars are fully round; small and extra-small buttons clamp to `min(var(--radius-md), 10–12px)` so a 28px control never looks like a lozenge.

Every edge is a hairline. `border-border` is applied to `*` in the base layer, so a border is a one-word decision and its colour is never in question; a card is a 1px hairline plus a 2xl corner plus white, and that combination is the single most repeated shape in the system (`rounded-2xl border border-border bg-card shadow-sm p-5`). Dashed hairlines mark placeholder and empty regions. Tables are hairline-ruled horizontally by default, vertically only on request.

Interactive corners are stateful, which is the system's most distinctive geometric move: when a sidebar item opens its children, the parent squares off its bottom (`rounded-b-none`) and the child stack rounds its own bottom, so parent and children read as one continuous block rather than a stack of separate pills. Focus is a 2px ring at 2px offset globally, tightening to `ring-3` at 50% on buttons and `ring-2` at 15% on fields.

### Named Rules

**The One-Block Rule.** A parent and its open children form a single rounded block: the parent loses its bottom radius, the last child gains one, and the group shares a `muted/50` ground. Never render an open group as separate rounded items.

**The Hairline Rule.** Definition comes from a 1px hairline, not from a heavier fill or a drop shadow. Form controls step one shade darker (`control-edge`) because they must hold an edge on white; everything else uses `hairline` on the outside and `divider` on the inside.

## Components

The character across the set is **calm and tactile**: 14px corners on records, 8px on controls, honest hover response, a literal 1px press-down, and touch targets that survive a wet thumb. Nothing raises its voice; everything answers when touched.

### Buttons

- **Shape:** 8px corners (`rounded-lg`), 36px tall (`h-9`) at default; 28px (`xs`), 36px (`sm`), 40px (`lg`), and square `size-9` icon variants. Small sizes clamp their radius to 10–12px.
- **Primary:** solid Bluerocratic with white text, `0.625rem` horizontal padding, semibold. One per view under the Call-Light Rule.
- **Outline:** white field fill with a hairline border — the workhorse. Hovers to the muted step; in dark mode it uses a 30% input fill instead of white.
- **Secondary:** the cool step fill with slate ink, for actions that are neither primary nor destructive.
- **Ghost:** transparent until hovered, then the muted step. Used for icon actions and toolbar controls.
- **Destructive:** a 10% coral tint with coral text — never a solid red fill. Destruction announces itself by hue, not by mass.
- **Link:** primary text with an offset underline on hover.
- **States:** `transition-all`; `active:translate-y-px` gives every button a 1px press (suppressed on menu triggers, which stay put while their popover is open); `aria-expanded` holds the hover fill while a menu is open; focus-visible draws a 3px `ring-ring/50` plus a ring-coloured border; `aria-invalid` swaps in a destructive ring; disabled drops to 50% opacity with `cursor-not-allowed`.

### Chips

- **Badge:** 20px tall, 6px corners (`rounded-md`), micro-label type, and the system's status vocabulary — `primary`, `success`, `warning`, `destructive` all render as a **10% tint of the hue with the hue as text**, never as a saturated block. `default` and `secondary` are the two solid variants, reserved for counts and neutral tags.
- **Count pills:** fully round, `tabular-nums`, bold 10–11px. On an active tab they take the primary tint; on an inactive one the muted step; a count that needs attention takes the destructive tint. In the collapsed sidebar rail the count becomes a 16px dot pinned to the icon corner with a 2px card-coloured ring so it reads against the glyph.
- **Delta pill:** a 16–18px rounded-square trend glyph (6px radius, tinted border and fill) followed by the signed figure and an optional comparison label. Tone follows the trend unless `lowerIsBetter` flips it — a falling waste figure is good news and must read green.

### Cards / Containers

- **Corner style:** 14.4px (`rounded-2xl`).
- **Background:** `card-white` (`#ffffff`) light, `#202329` dark.
- **Border:** 1px hairline, always.
- **Shadow:** `shadow-sm` for clearance only — see the Clearance Rule.
- **Padding:** `1.25rem` standard, `1rem` compact; tables and lists inside a card use `overflow-hidden` and no padding so rows meet the edge.
- **Interactive cards** shift their border to `primary/35` and deepen the shadow on hover; a selected card takes a solid primary border with a `ring-2 ring-primary/15`. A card that is a link or button renders as `<a>`/`<button>` with `text-left`, never a div with a click handler.

### Inputs / Fields

- **Style:** 36px tall, 8px corners, white fill (`--field`) with a `control-edge` border. White is deliberate: the border defines the control, which frees the field to be the brightest thing in a form. Read-only parts of an input group (unit suffixes) keep the grey offset so they still read as non-editable. In dark mode the field is a mid-charcoal step, because a white field would glare.
- **Label:** micro-label above the field — bold, 0.75rem, tracked — with a coral asterisk when required. Auto-generated `id` from the label text keeps the association intact even when no `id` is passed.
- **Focus:** border to primary plus `ring-2 ring-primary/15`, transitioned over 150ms on border-colour and box-shadow only.
- **Error:** a 60% destructive border, destructive focus ring, `aria-invalid`, and a `role="alert"` message replacing the hint below the field. Icons inside the field turn destructive too, so the state reads even peripherally.
- **Hint:** 0.75rem muted text below, wired through `aria-describedby`.
- **Select:** matches the input exactly — same height, fill and border token — so a select and a text field side by side read as one control family. Its menu is a 11px-cornered white surface with `shadow-lg`, 36px minimum rows, and a primary check on the selected item.

### Navigation

- **Sidebar:** a white panel with a hairline right edge, 220px expanded and 60px collapsed, transitioning width and transform over 300ms `ease-out`. The brand lockup is an 8px-cornered primary square holding a coffee glyph, beside "DUMA" and a tracked micro caption. Groups are named by micro-labels when expanded and by a hairline divider when collapsed.
- **Items:** 13px medium type, 8px corners, muted by default, hovering to the offset fill with foreground text. **Active** is a `primary/10` fill with primary semibold text *and* a 3px full-height primary bar on the item's inner edge — the two together, never one alone. A parent whose child is active takes a neutral `muted/50` fill instead, so the blue stays on the actual destination.
- **Collapsed rail:** items become 36px squares with tooltips carrying the label and any count; open children stack directly beneath as a single squared block.
- **Section tabs:** an underline bar on a white ground — 44px tall, 2px bottom border, primary text and border when active, muted with a transparent border when not, with an optional count pill. Horizontally scrollable, so tabs never wrap or truncate.
- **Segmented control:** a muted trough with a hairline border and 8px inner buttons; the active segment lifts onto a white card with `shadow-sm` and primary text. Labels are uppercase tracked bold; `size="lg"` raises the trough to 44px for touch.

### Data Table

The signature component of the system, and the reason the type scale has a micro tier.

- **Shell:** a card — 2xl corners, hairline border, `overflow-hidden` — with the table flush to its edges and an optional footer strip on a `muted/20` ground.
- **Header:** a sticky `muted/90` band with micro-label columns (0.625rem, bold, uppercase, tracked, muted) and a hairline beneath. Sortable headers are buttons carrying an up/down/unsorted glyph and a real `aria-sort` value.
- **Rows:** hairline-separated, `text-sm` foreground, three density steps. Clickable rows take `role="button"`, `tabIndex`, Enter/Space handling, a `surface-offset/70` hover and an inset focus ring — and a click on a control *inside* the row is never swallowed by the row's own handler.
- **Columns:** declare alignment, width (including `fit`), wrap behaviour and a `visibility` breakpoint, so a table sheds columns responsively instead of scrolling.
- **States:** skeleton rows with pseudo-random widths while loading; a plain centred message for empty and error. Never an empty grid with no explanation.

### Stat Card

The single metric tile for the whole application — one component replacing every bespoke KPI tile — and worth documenting because it encodes the Ledger Rule.

- A tinted 40px icon chip (10% accent fill, accent glyph, 11px corners) leads the label; the figure below runs at 2rem bold tabular with a `-0.02em` grip; the delta pill sits beside or beneath it.
- Four optional visuals share the card's right 46%: a smoothed Catmull-Rom **sparkline** with a gradient fill, a hover crosshair and a card-stroked marker dot; **bars** where each bar is a real focusable button with its own accessible label; a **ring** donut; or a full-width **progress** bar with from/to captions. Hovering a data point swaps the headline value and label for that point's — the card is a reader, not a picture.
- Accents map to chart tokens rather than to semantic text colours, so a tile's ink stays in the chart palette; empty series drop their visual entirely rather than leaving a blank slot.

### Overlays

- **Modal:** portalled to `<body>`, centred, `max-w-md`, 2xl corners, hairline border, `shadow-xl`, over a `black/40` backdrop with a `backdrop-blur-sm`. Header is a title with a ghost close button above a hairline; body scrolls to `90vh`. Focus moves to the first field on open, Tab is trapped, Escape closes, and focus returns to the opener — that behaviour is part of the component's definition, not an enhancement.
- **Popovers, selects, tooltips:** white surfaces, 11px corners, `shadow-lg`, entering with a paired fade and 95% zoom from `tw-animate-css`.

### Empty State

A 64px round muted disc holding a 28px muted glyph, a semibold 0.875rem muted title, and an optional 0.75rem description at 60% opacity. Centred, `4rem` vertical padding. The pattern is deliberately quiet — an empty table is a normal state in a café at 6am, not an error.

## Do's and Don'ts

### Do:

- **Do** define every colour once in `app/globals.css`, in both `:root` and `.dark`, in the same edit — the Two-Theme Rule.
- **Do** build a card as `rounded-2xl border border-border bg-card shadow-sm p-5`. That exact recipe appears throughout the app; matching it is how a new screen looks like DUMA.
- **Do** put `tabular-nums` on every figure, and give it something to compare against or say explicitly that there is nothing to compare.
- **Do** express status as a 10% tint of the hue with the hue as text (`bg-success/10 text-success`), which is what every Badge variant does.
- **Do** reach for the existing dials before writing new CSS: `DataTable` density, `StatCard` size, `SegmentedControl` size, `PageLayout` `fullHeight`.
- **Do** use `StatCard` for any metric tile and `DataTable` for any tabular data — both exist specifically to have replaced a drawer full of bespoke variants.
- **Do** take icons only from `@/components/icons`, the single Hugeicons re-export, at 15–18px with `aria-hidden="true"`.
- **Do** keep interactive things interactive elements: a clickable card is an `<a>` or `<button>`, a clickable row carries `role="button"` and key handling.
- **Do** hold 44px minimum touch targets on POS, KDS and cash-up — the Thumb Rule.
- **Do** design every screen to survive both device toggles: no page title, no top bar.

### Don't:

- **Don't** add tokens to `tailwind.config.ts`. It is dead: `globals.css` has no `@config` directive, so Tailwind v4 never loads it, and it still references variables (`--color-text`, `--color-bg`, `--color-error`) that no longer exist. `@theme inline` in `app/globals.css` is the only wired layer.
- **Don't** write a raw hex, `rgb()` or arbitrary colour in a component. If a value is missing, add the token.
- **Don't** assume Tailwind's stock shadow values — the entire scale is re-tuned to `--shadow-tint` in a utilities layer, and any new `hover:`/`md:` shadow variant must be listed there or it silently falls back to neutral black.
- **Don't** put a shadow on a surface that already sits on its own tonal step, and don't push past `shadow-md` for anything that doesn't genuinely float.
- **Don't** use the 0.625rem tier for anything a person reads rather than scans — no values, no messages, no body copy.
- **Don't** add a fifth thing for blue to mean. State, position, action; that is the list.
- **Don't** introduce a new font weight step, a second icon set, a second charting palette, or a second card radius.
- **Don't** restore scrollbars globally; use `.kds-scrollbar` where an off-screen queue must be discoverable.
- **Don't** tint the dark-mode surface ladder navy. It was tried; every panel read blue. Dark Eclipse is an accent, and dark surfaces stay near-achromatic charcoal.
- **Don't** ship a solid red fill for destruction, a gradient, a glassmorphic panel, a decorative chart, or a coffee-shop texture. All four anti-references are confirmed.
