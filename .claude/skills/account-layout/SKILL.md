---
name: account-layout
description: Use when the user asks to redesign or restyle a duma-crm page "like Settings → Account", "in the account layout", "clean like the account page", or types /account-layout <page> (e.g. "/account-layout staff record", "/account-layout /settings/trading"). Rebuilds the target in the Settings → Account style — equal-width stacks of porcelain sections, an identity block over fact tiles, icon-tile rows whose value is the content and whose Change opens the form in place, almost no descriptive copy — reusing the shared primitives. Pages already planned are in pages.md next to this file.
---

# Redesign a page in the Settings → Account layout

The reference is **Settings → Account** (`/settings/account`):
`components/settings/AccountHome.tsx` lays `components/settings/tabs/ProfileTab.tsx`
and `components/settings/tabs/SecurityTab.tsx` side by side. Read all three in
full before every redesign.

Pages redesigned since, and approved by the user — read the one closest to your
target; where they differ from the Account files, **they win**:

- **Settings → Trading** (`components/settings/TradingAndPaymentsSettings.tsx`) —
  the reference for a settings page: `ChangeRow`s with no separators, a draft
  kept with its SaveBar, Cancel restoring the row's value, a live preview in
  the aside, hints cut to the rules the preview can't show.
- **My HR** (`components/people/my-hr/Overview.tsx`, `TimeOffPanel.tsx`,
  `DocumentsPanel.tsx`) — a person's own profile; titled lists as `RecordGroup`.
- **Staff record** (`components/people/record/OverviewPanels.tsx`) — a record
  someone else edits.

If this document and those files disagree, the files win — fix this document.
`pages.md` records which pages are done.

The argument is the target: a route (`/staff/[userId]`), a page name ("staff
record", "trading settings") or a component path. If it matches several screens,
list them and ask. `pages.md` (next to this file) is the planned list, in order,
with each page's status — update it when a page is done.

## What makes the layout

1. **Columns of stacks, not a form.** The page is one or two columns of
   titled sections (`RecordGroup card`, see 4). Account uses two *equal* columns
   (`grid items-start gap-5 lg:grid-cols-2`, each column `min-w-0` holding a
   `SettingsTabBody` stack). Use equal columns when the page has two separate
   concerns of similar weight (who you are | how you sign in). Use a single
   column (`SettingsTabBody` with no aside) when it has one. Use
   `SettingsTabBody aside` (main + rail) only when one side is context for the
   other — a record's facts beside its activity. Never invent a column to fill
   space. **Short sections sit side by side**, even inside a main column
   beside a rail (Trading's Receipts | Money and VAT) — never two stacked
   half-empty cards. **With more than two, lay them out as a bento with no
   gaps:** two stacked columns, not paired rows — `grid items-start gap-5
   xl:grid-cols-2` holding two `flex min-w-0 flex-col gap-5` columns, each a
   stack of sections (QR ordering: Ordering · Guest page | Pickup times ·
   Welcome page). Paired rows leave a hole beside every short card; the user
   rejected that.
   **The rail holds only what the settings produce** — a live preview
   (Trading's receipt, QR ordering's phone). Status, links and settings go in
   the main column. A preview reflects the unsaved draft as you type where
   that's possible (QR ordering sends its draft to the framed guest page).
2. **Identity first, when the page is about a thing.** A record or profile
   opens with an untitled `SettingsSection`: avatar or icon tile (`Avatar
   size="xl"` for a person), the name at `text-2xl font-semibold
   tracking-headline`, one muted line under it (`text-sm text-muted-foreground`,
   an icon, the key contact, an `IconTag` for a verified/unverified state).
   Under it a `dl` of `Fact` tiles in `grid gap-3 sm:grid-cols-2` — four at most,
   the facts someone checks first (role, where, since when, the one number that
   matters).
3. **Sections are short nouns or nothing.** Titles like "Sign-in", "Active
   sessions", "Pay", "Contract". A section whose content is self-explanatory
   (a theme choice, an install row) has **no title at all**. No `description`
   unless it states a rule the reader can't see (a consequence, a constraint) —
   never what the section "lets you do".
4. **Rows carry the content.** Inside a section:
   - **A value that can change** → `ChangeRow` (from
     `components/settings/controls`): 40px tinted icon tile, small uppercase
     label, the current value in bold (plus an `IconTag` for its state), a
     "Change" button that opens the form underneath; "Cancel" closes it. One row
     open at a time per section (`const [open, setOpen] = useState<Row | null>(null)`).
     **No separator lines between rows** — no `divide-y`, no hairlines; the
     rows' own padding spaces them (`ChangeRow` is `py-2.5`, 20px between
     rows). Don't add spacing utilities around them (the user's call,
     2026-11-13: rows were too far apart). Where the page
     already saves through a draft and `SaveBar`, keep it: the row edits the
     draft and Cancel puts that field back to its value when the row opened
     (as Trading does). Where it doesn't, the form inside saves itself (its
     own mutation + toast).
   - **A switch or a one-tap action** → `SettingRows` + `SettingRow` (icon,
     title, control on the right) — the Install row — or a read-only
     `ChangeRow` (no `onToggle`) with the control as its `trailing`, when it
     sits among Change rows (Trading's VAT switch).
   - **An empty value** → `ValueMissing`; a value filled in from elsewhere →
     `ValueAside` ("· from your workspace").
   - **A pick-one setting with icons** → `SettingsChoice` (the colour theme).
   - **A fact that never changes here** → a `Fact` tile, or an `InfoRow`
     (`components/shared/rows`) when it belongs in a list of rows.
   - **A list of things** (sessions, devices, members) → rows with a tile, a
     bold line, a muted line, and an action at the right edge; a destructive
     action is `ghost` until hovered and goes through `ConfirmModal`.
   - **Titles sit above the card, never inside it** (the user's call,
     2026-11-16; reference: Settings → Developers). Every titled section is a
     `RecordGroup` (`components/shared/RecordGroup`): the title on the page,
     the card beneath it, the footnote under the card — as the Audit log draws
     a day.
     - **Settings, facts and editable rows** → `<RecordGroup card id="…"
       title="…" actions={…} footnote="…">`. `card` wraps the rows in the one
       card (`rounded-lg border-border bg-card px-5 py-4 shadow-sm`).
     - **A list that is already a bordered card** (`ListRowGroup`,
       `RecordList`) → `RecordGroup` *without* `card`, or it's a card inside a
       card.
     - **Title-row buttons are small:** `<Button variant="outline"
       size="sm"><Plus aria-hidden="true" /> Add language</Button>` — never
       the 36px header size (`h-9`), never primary. Header buttons stay 36px;
       buttons beside a section title are `size="sm"`.
     - **Explanations stay visible as the footnote,** under the card, by
       default. The user rejected an ⓘ on full-width page sections (Privacy &
       export, 2026-11-16) but asked for one on a narrow sidebar card (Model
       editor → Who can edit): there, the note goes behind `SectionInfo`
       (`components/shared/rows`) in the title row's `actions`. Use the ⓘ only
       for a sidebar card, and ask if unsure.
     - `id` is unique on the page (`"<page>-<title-slug>"`), so a link can land
       on it.
     - Only an untitled identity block keeps a bare `SettingsSection` card.
   - **Long help** (how to install, steps) → a `Modal`, opened from the row; not
     paragraphs on the page.
5. **Four states, inside the section that owns the query.** `TilesSkeleton` or
   `Bone` shaped like the content, `ErrorState` with `onRetry`, `EmptyState`
   that says what will appear, then the content — as `ActiveSessionsSection`
   does. A failed section never blanks the page.
6. **Motion and surfaces are inherited.** `RecordGroup` and `SettingsSection`
   carry `SECTION_RISE`; `RecordGroup card` gives the card surface
   (`border-border bg-card shadow-sm`).
   Outside `SettingsShell`, wrap the body in the stagger `motion.div` from
   `SettingsShell.tsx`. No new animation, no gradients, no hand-rolled cards.

## Copy

- Say a thing once (vault UI-ADR-019). If the header, a tile or a badge already
  states it, delete the sentence that repeats it.
- Labels are nouns ("Email", "Password", "Member since"); values are data; buttons
  are verbs ("Change", "Install", "Sign out").
- No intro paragraphs, no "Here you can…", no restating the page title, no
  placeholder or marketing tone. Hints are one short sentence and only where a
  rule isn't visible.
- Keep, whatever the page: money/VAT/legal/consent wording, destructive-confirm
  consequences, allergen words, error messages that say how to fix something,
  and every accessible name.
- Sentence case, curly apostrophes (’).

## Primitives

| Need | Use | From |
|---|---|---|
| Equal columns | `grid items-start gap-5 lg:grid-cols-2` | as `AccountHome` |
| Stack / main + rail | `SettingsTabBody` (`aside`, `narrowAside`, `stickyAside`) | `components/settings/SettingsShell` |
| Titled section: title above, rows in one card | `RecordGroup card` (`id`, `title`, `actions?` as `size="sm"` outline buttons, `footnote?`) | `components/shared/RecordGroup` |
| Titled list (already a card) | `RecordGroup` without `card` | `components/shared/RecordGroup` |
| Untitled identity card only | `SettingsSection` (no `title`) | `components/settings/SettingsSection` |
| The list's rows | `RecordList` + `RecordListRow`, or `ListRowGroup` + `ListRow` | `components/people/record/shared`, `components/shared/ListRow` |
| Editable value row | `ChangeRow` | `components/settings/controls` |
| Switch / action row | `SettingRows`, `SettingRow` | `components/settings/controls` |
| Fact tile | `Fact` | `components/settings/controls` |
| Icon choice | `SettingsChoice` | `components/settings/SettingsChoice` |
| Read-only row | `InfoRow`, `RowTile` | `components/shared/rows` |
| State tag | `IconTag`, `Badge` | `components/shared/IconTag`, `components/ui/badge` |
| States | `TilesSkeleton`, `Bone`, `ErrorState`, `EmptyState` | `components/shared/*` |
| Help / confirm | `Modal`, `ConfirmModal` | `components/shared/*` |
| Icons | named exports only | `components/icons` |

If something you need is missing, extend the shared primitive with an optional
prop. Never fork a copy into the page, and never import one module's private
component into another — move it to `components/settings` or `components/shared`
first, as `ChangeRow` was moved out of `SecurityTab`.

## Procedure

1. **Resolve** the route under `app/(crm)` and every component it renders. Read
   them fully, and the three reference files.
2. **Read the vault first** (CLAUDE.md): the screen note from `UI Index.md`,
   `Cross-Repo/UI API Discrepancies.md` for the endpoints it calls; use the
   note's `sources:` as the reading list.
3. **Check the fit.** This layout suits profiles, records, settings and
   detail pages. It does **not** suit dense operational screens — the till, KDS,
   an order queue, a bookings day, a calendar, a report table. For those, say so
   and propose the part that fits (the screen's settings panel, a record's
   drawer). Don't force it.
4. **Map before editing.** Write a short table: every existing field, control
   and block → section → row kind (ChangeRow / SettingRow / Fact / list / Modal
   / removed) → label and value wording. Mark what is **removed** and why (a
   duplicate, filler, a wrapper). Then the column split and why.
5. **Ask when it is the user's call.** Stop and ask (AskUserQuestion) before:
   removing a feature or the only route to an action; moving something to
   another page; changing what a capability gate shows; a layout choice the
   reference doesn't settle. Don't ask about wording, spacing or primitive
   choice — follow the reference. **As a subagent you cannot ask:** finish
   everything that isn't in question, leave the questioned part as it was, and
   list the questions at the top of your report.
6. **Rebuild the presentation, keep the behaviour.** Queries, mutations, query
   keys, invalidation, capability checks and API calls stay exactly as they
   are. Gate on `capabilities[]` (`hasCapability`), never `role`. Money stays a
   string. No optimistic updates. Pure value-to-words helpers go in
   `lib/utils/` with a test under `tests/unit/` only when they hold real logic.
7. **Verify.** `pnpm typecheck`, `pnpm test`, and eslint on the files you
   touched. Prettier only the files you touched — never a directory (much of the
   repo is committed unformatted). Don't run `pnpm build` while the dev server
   on :3000 is up. The checkout is shared with other sessions: never stash,
   never revert files you didn't change, and filter unrelated errors rather
   than fixing them.
8. **Close the loop.** Update the screen note and `Change Log/UI Change Log.md`
   in the vault, mark the page done in `pages.md`, and report: what changed,
   what was removed, what you left alone and why, open questions.
