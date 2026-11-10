---
name: declutter
description: Use when the user wants a duma-crm page, tab, component or directory simplified, decluttered or cleaned of "AI slop", or types /declutter <page|dir> (e.g. "/declutter settings page", "/declutter components/marketing", "/declutter app/(marketing)/features"). Runs a full audit of copy, duplicated facts, redundant components, wrappers, spacing, sizing and decoration against DESIGN.md and the vault's design decisions, writes a prioritised plan, and only changes code once the user approves it.
---

# Declutter a page or directory

The goal is a **quieter, shorter UI**: fewer words, each fact said once, no
component that doesn't earn its place, spacing and sizing from the scale. This is
a subtraction pass. If the plan adds more than it removes, it's the wrong plan.

The argument is the target: a page or tab name ("settings page", "orders tab"),
a route (`/settings/modules`), a component path, or a directory
(`components/marketing`, `app/(marketing)`). If it matches several screens, list
them and ask which one. Don't guess. A directory means every route and
component under it.

**Audit first, plan second, edit only after approval.** The output of this skill
is an audit and a plan. Code changes happen in a second step, once the user has
said which parts of the plan to apply.

## The standards you're auditing against

Read these before you judge anything. They are this product's taste, and they
override generic "clean UI" advice:

1. `DESIGN.md`: the Layout (4px spacing scale), Elevation, Shapes, Components and
   **Do's and Don'ts** sections. No gradients, no glassmorphism, no floating KPI
   cards, no pills for tabs/filters, shadows only for real lift.
2. Vault decisions in `~/Documents/Obsidian/Claude/Permanent/UI/Decisions/`:
   - **UI-ADR-019 Say a thing once…** — the duplication rules. Read in full.
   - UI-ADR-018 (empty states) and UI-ADR-020 (loading states).
   - UI-ADR-010 (a workspace opens on what needs you), UI-ADR-014 (settings shell).
   - UI-ADR-043 for anything under `app/(marketing)`.
3. `Components/UI Design System.md` in the vault: the shared vocabulary
   (`ListRow`, `StatCard`, `EmptyState`, `ErrorState`, `Bone`, `NeedsAttention`,
   `SettingsSection`, rows in `components/cms/rows`). A hand-rolled copy of one
   of these is a finding.
4. [reference.md](reference.md): the catalogue of tells (copy, layout, visual,
   code) with the patterns to search for.
5. For marketing copy, the DUMA business profile note in the vault
   (positioning and claim guardrails). A claim that can't be backed is removed, not
   reworded.

## Procedure

### 1. Resolve and read

Find the route(s) under `app/` and every component they render, down to
`components/shared` / `components/ui` (don't audit those primitives themselves
unless they are the target). Read every file in scope in full. Find the screen
note from `UI Index.md` in the vault and read it, because it often records why
something that looks redundant is there.

### 2. Mechanical scan

Run the scanner over the scope:

```bash
.claude/skills/declutter/scan.sh <path> [<path>…]
```

It greps for buzzwords, filler, decoration (gradients, blur, glow, heavy
shadows, raw palette colours), off-scale arbitrary values, emoji, `TODO` and
placeholder data, and component files nothing imports. **Every hit is a lead,
not a finding.** Open the line and judge it. Words like "robust" or "seamless"
can be fine in a code comment. The tells in reference.md are signals that a
human should look, not proof.

### 3. Read it as a user

Grep can't see most clutter, so walk the rendered screen. Use the `run` skill or
ask the user for a screenshot if the dev server is up. Don't `pnpm build` while
:3000 runs. Then, for **every state** (loading, empty, error, success,
read-only, narrow width), note:

- **Every piece of text on screen.** List each heading, description, hint,
  label, tooltip, button and badge. Then mark each one *keep*, *cut* or
  *shorten*, using the copy tests in reference.md.
- **Every fact and where it appears.** If a count, total, name or status
  shows up twice on one screen, keep the most useful one (ADR-019 rule 1).
  Prove it's a duplicate in *every* state before cutting (ADR-019's review
  lesson: several "duplicates" were only duplicates in one state).
- **Every component.** Does it do something the user needs on this screen? Is
  it a hand-rolled version of a shared primitive? Is it there only to fill
  space (a decorative illustration, a generic feature grid, a stat nobody acts
  on)?
- **Spacing and sizing.** Is the rhythm consistent (one gap between siblings,
  values on the 4px scale)? Are heading sizes in step with the Typography
  hierarchy? Do controls share the 36px baseline? Are there nested cards (a card
  inside a card inside a section)?

### 4. Write the audit and the plan

Present it to the user in this shape. Keep it tight: a table row per finding,
not a paragraph.

```
## Declutter audit: <target>

Scope: <routes + files read>   Scan hits: <n> (<m> real)

### Findings
| # | Kind | Where | What's wrong | Fix | Risk |
|---|------|-------|--------------|-----|------|
| 1 | Copy · duplicate | components/x/Y.tsx:42 | Description restates the title | Delete the description | none |
| 2 | Component · redundant | components/x/Z.tsx | Hand-rolled empty state | Use `EmptyState kind="start"` | low |
| … |

Kinds: Copy (filler / duplicate / buzzword / unbacked claim) · Component
(redundant / dead / hand-rolled primitive / decorative) · Layout (wrapper /
nested card / spacing / sizing) · Visual (gradient / shadow / colour / emoji /
image) · Code (orphan file / dead export / mock data / TODO).

### Before → after copy
<every text change as old → new, grouped by component, so the user can approve the words>

### Plan
1. <batch> — <files>, <what changes>, <what is deleted>
2. …
Removed: <n> components, ~<n> lines, <n> strings.   Added: <n> (justify each)

### Left alone, on purpose
<things that looked like clutter but stay, and why: till/KDS words, allergen
words, compliance text, a "duplicate" that isn't one in every state, etc.>
```

Order the plan from safest to riskiest: copy deletions → copy rewrites → spacing
and sizing → swapping in shared primitives → deleting components and files.
Then **stop and ask** which batches to apply (AskUserQuestion, multi-select by
batch). Never delete a file, a public asset or a whole section without a yes.

### 5. Apply the approved batches

- **Presentation only.** Keep queries, mutations, query keys, invalidation,
  capability gates and API calls exactly as they are. Removing a component
  never removes a gate, and it never removes the only route to an action.
- **The four states stay.** Every list keeps loading, empty, error-with-retry
  and success. Removing a wordy empty state means replacing it with a shorter
  `EmptyState`, not removing the state.
- **Words that stay no matter what:** till and KDS action words, allergen
  words, money/VAT/legal/consent text, destructive-confirm consequences, error
  messages that say how to fix something, and accessible names (`aria-label`,
  `IconTag` tooltip). An icon replaces a word only where something else frames it
  (ADR-019 rule 2).
- **Deleting a file:** confirm nothing imports it (`grep -rn` the import path
  and the export names across `app/ components/ lib/`), including dynamic
  imports and `public/` asset string paths. Then delete it in the same batch as
  its last caller's change.
- **Extend, don't fork.** If two components differ by one prop, merge them into
  the shared one with an optional prop.
- A string helper that you extract goes in `lib/utils/` with a test only if
  it has real logic.
- Run only the formatter on the files you touched (never a directory).

### 6. Verify and close the loop

1. `pnpm typecheck && pnpm test` (and `pnpm lint` on touched files). Don't
   `pnpm build` while the dev server on :3000 is running.
2. Look at the page again in every state from step 3. Check the narrow width
   too, because removing a wrapper often breaks the stacked layout.
3. Report: what changed, lines/components/strings removed, what was deferred.
4. Per CLAUDE.md: update the screen note and `Change Log/UI Change Log.md` in
   the vault. If a new general rule came out of it (a pattern to ban
   app-wide), propose adding it to ADR-019 or a new decision. Don't just do it.

## When not to declutter

- **The till, KDS and guest ordering app optimise for speed and certainty, not
  density.** Words there stay unless they are plainly duplicated. Say so in
  "Left alone".
- Don't restyle into a new layout here. If the screen needs the Booking rules
  layout, finish the audit and point to `/restyle` as the follow-up.
- Don't "simplify" by hiding a feature behind a menu or tooltip the user needs
  every day. Fewer elements, not harder-to-find ones.
