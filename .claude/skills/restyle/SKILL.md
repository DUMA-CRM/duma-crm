---
name: restyle
description: Use when the user asks to redesign, restyle or build a duma-crm page, tab or panel "like the booking rules tab" / "in the booking rules style", or types /restyle <page> (e.g. "/restyle settings page", "/restyle orders tab", "/restyle new supplier settings page"). Rebuilds the target with the Reservations → Booking rules layout - porcelain sections in a main column with a narrow aside rail, icon-tile rows that open their control inline, one draft saved through a SaveBar - reusing the existing primitives rather than copying class strings.
---

# Restyle a page in the Booking rules layout

The reference screen is **Reservations → Booking rules**
(`components/reservations/BookingRules.tsx`, mounted from
`components/reservations/ReservationsWorkspace.tsx` at `/reservations?tab=rules`).
Read that file in full before every restyle. It is the source of truth for this
skill. If this document and the file disagree, the file wins, so fix this
document.

The argument is the target: a page, tab or panel name ("settings page",
"orders tab", "loyalty programme"), a route (`/settings/modules`), a component
path, or "new <thing> page". If it's ambiguous (several screens match), list the
candidates and ask which one. Don't guess.

## What makes the layout

1. **Two columns: rules and a rail.** `SettingsTabBody narrowAside aside={…}`.
   The main column is `minmax(0,1fr)`. The aside is a fixed 22rem (24rem at xl)
   on `lg+` and stacks below the main column on narrower screens. The aside holds
   *the result or the artefact* of what the main column configures (the booking
   page's QR and link, a preview, a summary, status). It doesn't hold more
   settings.
2. **Porcelain sections.** Every group is a `SettingsSection`
   (`rounded-lg border border-rule/60 bg-field`, `px-5`, title
   `text-base font-semibold tracking-title`). Section titles are short noun
   phrases ("Online booking", "Between bookings", "Guest emails"). Status goes in
   `actions` as a `Badge` (`success` = Live, `muted` = Off/Draft,
   `warning` = needs attention). A primary action like "Set up" also goes in
   `actions`, as `Button className="h-9"`.
3. **Rows, not form fields.** Inside a section the content is a vertical rhythm
   of rows at `space-y-3`, with no hairlines. Each row leads with a `RowTile`
   (the outlined 32px icon tile), then a `text-sm font-semibold` title, then the
   value or control on the right:
   - **Boolean** → `InfoRow` + `Switch` (from `components/settings/controls`).
   - **Number / choice / short text** → `PickerRow`. The row shows the
     *current value in words* ("4 guests", "1 h 30 min", "None" muted). A tap
     opens the control underneath (`NumberStepper`, `ChoiceCards`, an input or a
     textarea), followed by a one-line `text-xs text-muted-foreground` hint saying
     why it matters. **Only one row is open at a time**:
     `const [open, setOpen] = useState<Row | null>(null)`, and a tap on the open
     row closes it.
   - **Fact (read-only)** → `InfoRow` with the value as text or a `Badge`.
   - **Link to elsewhere / list of things** → a bleed list
     (`-mx-2 flex flex-col gap-0.5`) of rows that are `Link`s:
     `group flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-band/50`,
     with a `RowTile`, a title over a `text-xs` subtitle, an optional `Badge`, and
     a `ChevronRight` that nudges on hover. See `GuestEmails.tsx`. For buttons,
     use `ActionRows` / `ActionRow` from `components/cms/rows`.
   - **Control that must stay visible** (wide input, select) → `FieldRow`.
4. **One draft, one SaveBar.** Editable values live in a single draft object.
   The draft is keyed to the record or location it came from, so switching
   locations drops it. `dirty` is computed by comparing the draft against the
   saved state. Saving is one mutation, and the `SaveBar` rises only while the
   draft is dirty. Read-only users get a
   `<fieldset disabled={!canEdit} className="min-w-0 space-y-3">` around the rows (`min-w-0`: a fieldset
   otherwise grows to its content, so a long value runs past the row instead of truncating), no
   SaveBar, and no destructive buttons.
5. **Problems are inline.** When something stops a setting from working, show a
   `Warning` paragraph at the foot of its section
   (`mt-4 flex items-start gap-2 rounded-md bg-measured/10 px-3 py-2 text-xs font-medium text-measured`
   with `AlertTriangle`). It says what breaks and **links to where to fix it**
   ("Set them in Settings → Workspace"). Quieter caveats use
   `rounded-md bg-band/60 px-3 py-2 text-xs text-muted-foreground`. Destructive or
   irreversible actions go through `ConfirmModal`, and its message explains the
   consequence.
6. **Four states.** Loading → `Bone` shaped like the content
   (`h-96 w-full rounded-lg` for a whole tab). Error → `ErrorState` with
   `onRetry`. Empty → explain what will appear and how to make it appear (the
   aside's "Save these rules once and the link appears here…"). Success → the
   layout. A section with its own query handles its own four states inside the
   section, as `GuestEmails` does.
7. **Motion is inherited.** `SettingsSection` carries the `SECTION_RISE` variant.
   Sections stagger in only when they're direct children of a parent that has
   `initial="hidden" animate="shown"` and `staggerChildren`, which `SettingsShell`
   provides. Outside settings, wrap the body in that `motion.div` (copy it from
   `SettingsShell.tsx`, including `useReducedMotion`). Don't add new animation.
8. **Voice.** Titles describe the outcome in plain words ("Soonest booking",
   "Table held for", "Largest party online"), not field names
   (`minNoticeMinutes`). Hints are one short sentence. Use curly apostrophes (’)
   in copy, as the reference does.

## Primitives, and where they live

| Need | Use | From |
|---|---|---|
| Two-column body | `SettingsTabBody` (`narrowAside`, `stickyAside`, `asideLeft`) | `components/settings/SettingsShell` |
| Section card | `SettingsSection` (`title`, `description`, `actions`, `footnote`) | `components/settings/SettingsSection` |
| Icon tile | `RowTile` (`tone`: default/warning/success/danger) | `components/cms/rows` |
| Fact / switch row | `InfoRow`, `InfoRows` | `components/cms/rows` |
| Row that opens a control | `PickerRow` | `components/cms/rows` |
| Row with control beneath | `FieldRow` | `components/cms/rows` |
| Action list | `ActionRows`, `ActionRow` | `components/cms/rows` |
| Switch, SaveBar | `Switch`, `SaveBar` | `components/settings/controls` |
| Stepper, choice cards | `NumberStepper`, `ChoiceCards` | `components/shared/FormParts` |
| States | `Bone`, `ErrorState`, `EmptyState` | `components/shared/*` |
| Status | `Badge` | `components/ui/badge` |
| Confirm | `ConfirmModal` | `components/shared/ConfirmModal` |
| Icons | named exports only | `components/icons` (never `lucide-react` directly) |

`PickerRow` now lives in `components/cms/rows.tsx`, next to `InfoRow`. It was
moved there from `components/reservations/` when Settings → Orders first used
it. If another primitive you need is still inside a module folder, move it the
same way. Don't import one module's component into another module, and don't
fork a copy.

Don't hand-roll a card, row or tile with raw Tailwind when one of these fits. If
something is missing, extend the primitive (new optional prop) so every screen
using it keeps reading as one product.

## Procedure

1. **Resolve the target.** Find its route under `app/` and the component that
   renders it. Read it fully, along with the reference `BookingRules.tsx`.
2. **Read the vault first** (CLAUDE.md requires it for significant changes).
   Find the screen note from `UI Index.md`, check
   `Cross-Repo/UI API Discrepancies.md` for the endpoints the screen calls, and
   use the note's `sources:` as the reading list. For a brand-new page, also
   confirm that every endpoint you'll call exists in
   `~/Documents/GitHub/duma-api/src/routes/`.
3. **Check the fit before touching code.** The layout suits *configuration and
   record-detail* screens: settings tabs, a location's rules, an item's options,
   a profile. It does **not** suit dense operational lists like an order queue,
   a bookings day or a KDS board. If the target is one of those, say so and
   propose a scope where the layout does apply (the list's filters or settings
   panel, a record's detail drawer or page). Ask before going ahead.
4. **Map the content.** Before you edit, write a short mapping table for the
   user: each existing field or control → section → row kind (switch /
   picker / fact / link / field) → title and value wording, plus what goes in
   the aside. If the page has no natural aside, use the plain single column
   (`SettingsTabBody` without `aside`). Don't invent rail content.
5. **Rebuild the presentation, keep the behaviour.** Keep the existing queries,
   mutations, query keys, invalidation, capability checks and API calls exactly
   as they are. This is a redesign, not a rewrite. The specific rules:
   - Switch to the single-draft + `SaveBar` model only where the page already
     saves a form. Don't turn immediate-action controls (a refund, a stock
     adjustment) into drafts.
   - Gate on `capabilities[]` via `hasCapability`, never on `role`.
   - Keep money as `string`.
   - No optimistic updates.
   - Invalidate after every mutation.
   - Pure formatting helpers (value-to-words like `minutesLabel`) go in
     `lib/utils/` with a test, not inline in the component.
6. **Verify.** Run `pnpm typecheck` and `pnpm test`. Don't run `pnpm build`
   while the user's dev server on :3000 is running. If a dev server is up, ask
   the user to look at the page, or drive it with the `run` skill. Check `lg`
   (two columns) and narrow (stacked, aside below) widths, read-only mode, and
   the loading and error states.
7. **Close the loop.** Update the screen note and
   `Change Log/UI Change Log.md` in the vault, per CLAUDE.md.

## Skeleton

`reference.md` (next to this file) is the reference component reduced to its
structure: draft handling, one-open-row, row helpers, aside, warning, SaveBar.
Start new pages from it. For a redesign, use it as the target shape.
