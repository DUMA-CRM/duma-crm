---
name: DUMA
description: A role-shaped café service board that makes the next useful action obvious.
colors:
  ground: '#f4f0e7'
  field: '#fffcf7'
  band: '#eae4d8'
  ink: '#20372d'
  ink-2: '#5c6c63'
  rule: '#aaa397'
  grid-minor: '#e8e1d5'
  grid-major: '#d7cfc1'
  brand: '#1f6146'
  brand-hover: '#174c38'
  apricot: '#b84e2d'
  periwinkle: '#505fb8'
  green: '#2b7355'
  saffron: '#8a5b02'
  exception: '#b33a45'
  forest: '#174c38'
  forest-2: '#28624d'
  forest-rule: '#3d6d59'
  sidebar-ink: '#f8f1e5'
  ground-dark: '#121110'
  field-dark: '#1c1b18'
  band-dark: '#272521'
  ink-dark: '#f6f0e6'
  ink-2-dark: '#c3bcae'
  rule-dark: '#787264'
  forest-dark: '#0e241b'
  forest-2-dark: '#204734'
  forest-rule-dark: '#2a4b3a'
  brand-dark: '#4fb187'
  brand-hover-dark: '#5cbf95'
  apricot-dark: '#ef936b'
  periwinkle-dark: '#a7b0ff'
  green-dark: '#75c7a2'
  saffron-dark: '#e8bd67'
  exception-dark: '#ff9298'
typography:
  micro:
    fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.625rem'
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: '0.14em'
  label:
    fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.6875rem'
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: '0.08em'
  body:
    fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif'
    fontSize: '0.875rem'
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1rem'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: '-0.01em'
  headline:
    fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif'
    fontSize: '1.5rem'
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: '-0.015em'
  display:
    fontFamily: 'Archivo, ui-sans-serif, system-ui, sans-serif'
    fontSize: '2.25rem'
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: '-0.03em'
  metric:
    fontFamily: 'Chivo Mono, ui-monospace, monospace'
    fontSize: '2rem'
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: '-0.02em'
    fontFeature: 'tabular-nums'
  figure:
    fontFamily: 'Chivo Mono, ui-monospace, monospace'
    fontSize: '0.875rem'
    fontWeight: 600
    letterSpacing: '-0.02em'
    fontFeature: 'tabular-nums'
rounded:
  sm: '5px'
  md: '7px'
  lg: '7px'
  xl: '8px'
  2xl: '10px'
  full: '9999px'
spacing:
  1: '0.25rem'
  2: '0.5rem'
  3: '0.75rem'
  4: '1rem'
  5: '1.25rem'
  6: '1.5rem'
  8: '2rem'
components:
  button-primary:
    backgroundColor: '{colors.brand}'
    textColor: '{colors.field}'
    rounded: '{rounded.md}'
    padding: '0 0.75rem'
    height: '2.25rem'
  button-primary-hover:
    backgroundColor: '{colors.brand-hover}'
    textColor: '{colors.field}'
    rounded: '{rounded.md}'
    padding: '0 0.75rem'
    height: '2.25rem'
  button-outline:
    backgroundColor: '{colors.field}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '0 0.75rem'
    height: '2.25rem'
  button-touch:
    backgroundColor: '{colors.brand}'
    textColor: '{colors.field}'
    rounded: '{rounded.md}'
    padding: '0 1rem'
    height: '2.75rem'
  panel:
    backgroundColor: '{colors.field}'
    textColor: '{colors.ink}'
    rounded: '{rounded.lg}'
    padding: '1.25rem'
  input:
    backgroundColor: '{colors.field}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '0 0.75rem'
    height: '2.5rem'
  segmented-control:
    backgroundColor: '{colors.band}'
    textColor: '{colors.ink-2}'
    typography: '{typography.body}'
    rounded: '{rounded.md}'
    padding: '0.125rem'
    height: '2.25rem'
  stat-tile:
    backgroundColor: '{colors.field}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '1.25rem'
  exception-row:
    backgroundColor: '{colors.field}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    rounded: '{rounded.xl}'
    padding: '0.75rem 1rem'
  ledger-row:
    backgroundColor: '{colors.field}'
    textColor: '{colors.ink}'
    typography: '{typography.body}'
    padding: '0.625rem 1rem'
---

# Design System: DUMA

## Overview

**Creative North Star: "The Service Board"**

DUMA is a friendly, practical café service board: a warm oat canvas held by a deep forest navigation shell, with compact magnetic controls and time-based lanes that show how work moves through a shift. The interface is role-shaped rather than permission-subtracted. Each operator opens a workspace organised around their job, reads the few dependencies that matter now, and acts without having to decode a generic admin dashboard.

The system feels calm but never passive. Brand green is the action colour, drawn from the forest shell so the key and the column read as one product. Apricot, periwinkle, saffron, and green belong to operational domains—orders, kitchen/reference, stock, and team/success—so colour helps a person scan work before they read it. White and lightly tinted fields sit on the oat ground with soft one-pixel edges and restrained lift. Corners stay compact at 6–8px, giving controls the feel of magnetic labels on a real board rather than floating pills.

The first viewport establishes the grammar: forest sidebar, warm header, “Today at [location]”, a compact exception strip, the day curve on its real trading-hours axis, a stable context workbench of live counts, and the day’s figures beneath. Specialist pages inherit the materials, typography, controls, and domain colours; they do not inherit the dashboard timeline when a form, table, till, or kitchen queue better fits the job. Confirmed anti-references are the graphite monitoring instrument, the floating KPI dashboard, glassmorphism, candy-tile POS UI, and coffee-shop nostalgia.

**Key Characteristics:**

- Role-shaped workspaces organised around the next useful action
- Warm oat canvas held by a deep forest navigation shell
- Brand green action, apricot orders, periwinkle kitchen/reference, saffron stock/warning, green team/success
- Compact 5–8px magnetic corners, soft one-pixel edges, and restrained lift
- Attached controls and edge labels instead of floating pills
- A time-based day curve as the dashboard signature, not a universal page template
- Marks placed only where real data puts them; missing history is stated, never drawn
- Stable right context workbench and activity ledger for operational continuity

## Colors

A warm, food-adjacent neutral field lets operational colour carry meaning without turning the application into a toy.

### Primary

- **Brand Green:** the primary action and the focus marker. It is one step up from the forest shell, so a solid key reads as the same material as the navigation column; pressing it settles onto the shell colour itself. It is legible both as text on all three surfaces and as a fill under warm white, because `text-primary` and `bg-primary` are one token.
- **Deep Forest:** the navigation shell, the logo tile, and the auth story panel. It creates a stable place-memory around the warmer work canvas; active navigation steps into the lighter forest tier rather than becoming a detached white pill.
- **Service Apricot:** the orders lane and the measured trace — order data, not action. It carried the primary key until green took over; leaving it on buttons made the action colour a stranger to the shell around it.

### Secondary

- **Kitchen Periwinkle:** kitchen work, reference data, comparison, and `info` states. It should feel cool and legible beside apricot, never electric.
- **Stock Saffron:** inventory risk, restocks, stocktakes, and **every warning**. Running low IS the warning, so `warning` and `stock` are deliberately one colour rather than warning borrowing the action or orders hue. True failure still belongs to exception red.

### Tertiary

- **Team Green:** staffing, healthy coverage, completion, and success. It is necessarily close to brand green — with forest ink on a warm ground, no green is at once a distinct link, a distinct success and WCAG-legible. The Two-Channel Rule is what separates them: success never appears without its wash or icon.
- **Exception Red:** late, failed, destructive, or genuinely out-of-range states. It is a state override, not a fifth decorative lane.

### Neutral

- **Warm Oat:** the page ground and warm top bar; the application should read as hospitable before any card appears.
- **Porcelain Field:** cards, inputs, selected attached tabs, and task work surfaces.
- **Board Band:** lane troughs, inactive segmented controls, table headers, quiet hover states, and the right context workbench.
- **Forest Ink:** primary text on warm surfaces. It is warmer and more ownable than graphite while remaining highly legible.
- **Sage Ink:** supporting copy and secondary metadata; there is no paler text tier for important information.
- **Soft Rule:** the shared one-pixel boundary for panels and controls. Use fractional opacity where hierarchy needs a quieter edge, not a second border colour.

### Named Rules

**The Domain Ownership Rule.** Brand green belongs to action and focus, apricot to orders and the measured trace, periwinkle to kitchen/reference and info, saffron to stock and every warning, team green to staffing/success, and red to exceptions. Do not shuffle these roles between screens, and never give a role a raw Tailwind colour — every hue in the product comes from the token layer.

**The Warm Ground Rule.** Oat is the page; porcelain is the work surface; band is the quiet trough. Keep this three-step material ladder intact so specialist pages still feel like the same café operation.

**The Two-Channel Rule.** Colour may accelerate recognition, but every state also needs text, position, an icon, shape, or bar length. No meaning is communicated by hue alone.

**The Lights-Off Rule.** Night mode is the same room after close, not an inverted page and not a green one. The material ladder keeps its three steps and its warmth in the ink, but the hue leaves the surfaces: ground, field and band become a warm near-black charcoal (`#121110` → `#1c1b18` → `#272521`) so the domain roles have something neutral to sit against. The navigation shell keeps its forest — that is the place-memory — dropped to the deepest tier (`#0e241b`, roughly four times darker than the daytime column) with the active step at `#204734`. Green anywhere else at night means team, success or a healthy state; no work surface is green.

## Typography

**UI / Body Font:** Archivo (with `ui-sans-serif`, `system-ui`, `sans-serif`).
**Figure Font:** Chivo Mono (with `ui-monospace`, `monospace`).

**Character:** Archivo is clear, compact, and human enough for a service environment without becoming editorial theatre. Chivo Mono is the sparingly used companion for timestamps, money, IDs, and other values that benefit from stable columns.

### Hierarchy

- **Display** (600, 2.25rem, 1.1): auth and marketing-scale statements only; never a dashboard KPI.
- **Headline** (600, 1.5rem, 1.15): the page title owned by `PageLayout`, such as “Today at Bridge Street”.
- **Title** (600, 1rem–1.125rem, 1.15): panel headings, lane-board headings, dialogs, and stable workbench titles.
- **Body** (400, 0.875rem, 1.5): default prose, task text, tables, and form content.
- **Label** (600, 0.6875rem, 0.08em): compact field labels, annotations, and count metadata. Sentence case is preferred; uppercase is reserved for true micro-labels.
- **Micro** (600, 0.625rem, 0.14em): time ticks, dense table headers, and terse eyebrows that are scanned rather than read.
- **Metric / Figure** (600, 2rem or contextual size, tabular): amounts, timestamps, counts, and identifiers. Use only when column stability or numeric comparison adds value.

### Named Rules

**The Practical Voice Rule.** Use sentence case, compact headings, and plain operator language. Avoid theatrical tracking, oversized dashboard headlines, exclamation marks, and feature-speak.

**The Spare Mono Rule.** Use Chivo Mono for figures that must align or compare, not for every numeral that happens to appear in a sentence.

## Layout

The desktop shell uses a 220px forest sidebar that collapses to 60px and becomes an off-canvas drawer below 1024px. The warm top bar is 56px tall and may be hidden on large screens; any full-height workspace therefore uses the shared shell variables rather than hard-coded offsets. Use dynamic viewport units (`dvh`) so tablet browser chrome never hides critical controls.

The dashboard first viewport is an operational composition, not a collection of equal cards: a one-line exception strip, one dominant service board, and a stable 320px context workbench. The board leads with the day’s headline figure and its pace, then the time axis. Supporting figures and analytics stay below the operational view. At smaller widths the workbench stacks after the board and touch-first controls preserve a 44px floor.

Spacing follows a 4px base with practical recurring steps: 8px for tight control gaps, 12px between related items, 16–20px inside ordinary regions, 24px around the primary board, and 32px desktop gutters. Density is compact enough for back-office scanning without weakening the touch target on shop-floor surfaces. Tables shed secondary columns responsively before resorting to horizontal scrolling.

### Named Rules

**The Board-Then-Workbench Rule.** Give the current shift the widest column and keep urgent context in a stable narrower panel. Never let summary metrics displace the operator’s next action above the fold.

**The Signature-Not-Template Rule.** The day curve belongs on time-based operational surfaces. Forms, settings, records, till screens, and dense tables inherit the system’s materials and controls without being forced into a timeline.

**The Real Marks Rule.** Nothing on a time axis may be placed by a hardcoded position, and no control may claim to scope data it does not scope. A component that cannot be driven by real data does not ship in a decorative form.

**The Thumb Rule.** POS, KDS, cash-up, and other touch-first surfaces use the named 44px touch sizes. Desktop defaults may remain 36–40px.

## Elevation & Depth

Depth is a hybrid of tonal layering, soft one-pixel edges, and restrained lift. Most regions rest directly on the oat ground as porcelain fields with a soft rule. `shadow-sm` gives magnetic tasks, controls, and attention rows a short low lift; `shadow-md` seats auth cards and more prominent raised strips. Deeper `lg`–`2xl` shadows are reserved for popovers, drawers, modals, and toasts that genuinely float above the workspace.

### Shadow Vocabulary

- **Magnetic low:** a short 2px/8px soft shadow for lane tasks, active segmented labels, buttons, and small attention rows.
- **Raised medium:** a 5px/16px restrained shadow for auth cards or an intentionally raised work surface.
- **Overlay large:** a two-stage 2px/12px drop for menus and popovers.
- **Float extra-large:** a two-stage 4px/24px drop for drawers, modals, and toasts.

### Named Rules

**The Restrained Lift Rule.** A shadow should make a magnetic label feel graspable or establish real overlay depth. It must not turn every panel into a floating dashboard tile.

## Shapes

The system uses compact, friendly corners: 5px on dense labels and lane tasks, 7px on controls and common panels, and 8px on larger board regions. Ten-pixel corners are the ceiling for unusually large containers. Full-round shapes are reserved for avatars, circular media, and the occasional compact status/count marker; tabs, filters, and status labels are attached or softly rectangular.

One-pixel borders do most of the structural work. Section tabs attach to their content edge by removing the active tab’s bottom border. Segmented controls are a band-coloured tray with a porcelain selected label. Sidebar parent and child navigation corners join into one continuous group when expanded.

### Named Rules

**The Magnetic Label Rule.** Controls and tasks should feel like small labels placed on a board: compact radii, decisive edges, a short lift, and no pill silhouette.

## Components

### Buttons

- **Shape:** friendly compact corners (7px), 36px default height; 28px, 32px, 40px, and 44px named size variants.
- **Primary:** solid brand green with warm-white text and a restrained low shadow. It marks the page’s clearest next action, and hovers down onto the forest shell colour.
- **Outline:** porcelain fill behind the soft rule; hover moves to Board Band.
- **Secondary / Ghost:** band fill or transparent at rest, both moving toward the band on hover.
- **Destructive:** porcelain field with exception border/text, never a solid red slab.
- **States:** 150ms colour/edge/lift transitions, a one-pixel press, and a hard two-pixel brand-green focus outline. Disabled controls retain their shape at reduced opacity.

### Segmented Controls & Section Tabs

Segmented controls sit in a Board Band tray with zero gaps; the selected label is porcelain, lightly lifted, and rectangular. Section tabs attach to the content edge with a shared rule and a porcelain active tab. Both stay horizontally scrollable and preserve their labels; they never become floating pills.

### Panels & Context Workbench

Common panels use a porcelain field, 7–8px corners, a soft one-pixel rule, and 16–24px padding. The right context workbench uses a Board Band tint to remain visibly attached to the main board. Attention rows are smaller porcelain magnetic labels; the healthy state is equally explicit and quiet.

### Fields

Inputs are 40px tall with a porcelain fill, soft rule, 7px corner, and low shadow. Small-screen text stays at 16px to prevent iOS zoom; desktop returns to the compact body size. Focus uses a hard brand-green border/outline; error switches both edge and message to exception red and connects the message through `aria-describedby`.

### Navigation

The sidebar is a deep forest column with warm-white text. Default items are softened; hover and active states step into Forest 2. The active item adds a narrow warm-white bar on its inner edge, and count markers use warm white with dark forest text — position is achromatic, so the shell carries no data hue. Collapsed items become 36px magnetic squares with tooltips; the mobile version is an off-canvas drawer over a translucent ink backdrop.

### The Day Curve — signature component

The Service Board is a time axis across the location’s real opening hours, carrying a labelled “Now” rule that advances as the shift does. Against it sit two traces: today’s cumulative takings in the measured apricot, and a typical same-weekday in periwinkle reference, dashed. A target, when one is set, is a horizontal brand-green rule.

This replaced a lane board whose task blocks were positioned by hardcoded percentages and whose Now / This shift / This week tabs changed only a heading. The time axis and the Now rule were the honest parts of that idea and they carry over; the fiction did not. The rule that follows from it: **a time-based component may only place a mark where real data puts it.** If the underlying figure isn’t known, the mark isn’t drawn — the board says how much history it has instead.

The curve always leads to the owning specialist workspace, and every trace states its own confidence: fewer than three sampled weekdays and the comparison is withheld rather than drawn faintly.

### Stat Tiles

One tile type carries every figure in the product: a porcelain field with a soft rule and 5px corners, a label row with an outlined accent chip, the value in the mono figure face at metric size, and an optional delta pill — a small trend glyph, the change, and the comparison it was measured against. Team green reads positive, exception red negative, and a neutral outline means there was nothing to compare. A tile may carry one quiet visual (sparkline, bar row, ring, meter) drawn in a chart ink, never a second colour system.

**The Named Comparison Rule.** A figure ships with the thing it is measured against, in words — "vs typical Thursday", "on a typical day by now". A bare delta with no stated basis is a number pretending to be a judgement.

### Exception Strip

Live problems collapse into one row at the top of an operational surface: a count in plain words, the first few items truncated to a single line, and a disclosure. Opened, it becomes a ruled ledger of rows that each carry a glyph, what happened, how long it has been happening, and a link to the workspace that fixes it. Domain colour marks the glyph only; the row itself stays porcelain. The healthy state is a full row of equal weight — a tick, "Nothing needs you", and what was checked — never an absence.

### Ruled Ledger

Lists of records — activity, attendance, requests, exception items — are ruled lists rather than card grids. Each row aligns an identifier or name, an action, and a timestamp on one baseline; hover uses a quiet band tint; the divider is the soft rule at fractional opacity. An empty ledger is a normal operational reading with calm copy, not a decorative illustration or an alarm state.

## Do's and Don'ts

### Do:

- **Do** make the next useful action obvious for the signed-in role.
- **Do** preserve the oat → porcelain → band material ladder across specialist pages.
- **Do** keep domain colour ownership stable: action brand green, orders apricot, kitchen/reference periwinkle, stock/warning saffron, team/success green, exception red.
- **Do** build attached tabs and segmented controls with compact 5–8px corners.
- **Do** use a dominant service board with a stable context workbench when the surface is genuinely time-based.
- **Do** keep touch-first actions at least 44px and use `dvh` for full-height shop-floor views.
- **Do** use Chivo Mono sparingly for aligned figures, timestamps, IDs, and money.
- **Do** ship every figure with the comparison it was judged against, named in words.
- **Do** state a missing comparison plainly ("not enough history yet") instead of drawing a faint or placeholder one.
- **Do** provide a textual or structural channel in addition to colour for every state.
- **Do** retain explicit loading, empty, error, offline, and healthy states in the same practical voice.

### Don't:

- **Don't** return to the graphite monitoring instrument, chart-paper lattice, or square 1–2px control world.
- **Don't** lead with floating KPI cards, decorative charts, or uncontextualised hero numbers.
- **Don't** use pills for tabs, filters, tasks, or statuses when an attached or compact magnetic label works.
- **Don't** apply the day-curve timeline to forms, settings, records, or tables that have a better native structure.
- **Don't** position a mark on a time axis by hand, or ship a control whose selection changes nothing but a heading.
- **Don't** use gradients, glassmorphism, candy-tile POS styling, chalkboard nostalgia, kraft texture, beans, or sepia café clichés.
- **Don't** invent a new domain colour, border family, icon system, or figure font.
- **Don't** communicate urgency by colour alone or allow exception red to become decorative.
- **Don't** add tokens to a Tailwind JavaScript config; `@theme` in `app/globals.css` is the wired styling layer.
