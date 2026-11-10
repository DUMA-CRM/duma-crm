# Declutter reference: the tells

Sources: `DESIGN.md`, vault UI-ADR-018/019/020, and Wikipedia's
[Signs of AI writing](https://en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing)
(adapted from encyclopedia prose to product UI). The Wikipedia guide's own
caveat applies here: **these are signs, not proof.** Plenty of human writing has
them. A tell means "look at this line", and the fix is judged on whether the
line helps the user, not on whether a model wrote it.

## 1. Copy

### The tests every string must pass

1. **Would the user miss it?** If deleting it loses nothing, delete it.
2. **Does it repeat a neighbour?** A description that restates its title, a
   hint that restates its label, a toast that restates the button, a subtitle that
   restates the page name, or a count already shown in a tile or badge. Keep one.
3. **Is it specific?** "Track stock by container and see cost per movement"
   passes. "Powerful inventory management" fails. If it can't be made specific,
   cut it.
4. **Is it the shortest true version?** Titles are 1–4 words, sentence case.
   Hints are one short sentence. Buttons are a verb + object ("Save rules", not
   "Click here to save your changes").
5. **Can the product back it?** On marketing pages, a number, testimonial,
   customer logo or "trusted by" with no real source is removed (see the
   business-profile claim guardrails).

### Words and phrases to flag

**AI vocabulary** (the strongest tell is several of these close together):
delve, tapestry, testament, beacon, landscape, realm, journey, elevate,
empower, unlock, unleash, supercharge, revolutionize, game-changer,
cutting-edge, state-of-the-art, next-level, world-class, seamless(ly), robust,
powerful, intuitive, effortless(ly), streamline, leverage, harness, synergy,
holistic, multifaceted, comprehensive, pivotal, crucial, vital, intricate,
meticulous(ly), vibrant, nestled, boasts, showcase, foster, underscore,
highlight(ing), enhance, ensure, align with, resonate, dependable, prioritize,
"in today's fast-paced world", "take … to the next level", "look no further",
"whether you're … or …", "say goodbye to", "all-in-one", "one-stop".

**Filler and hedges:** simply, just, easily, quickly, effortlessly, actually,
really, very, truly, "you can", "allows you to", "lets you easily", "helps
you", "in order to", "please note", "note that", "it's important to", "make sure
to", "feel free to", "don't worry". Usually you can delete the word, or the
whole sentence, and lose nothing.

**Inflated significance:** "plays a key role", "serves as", "stands as",
"acts as", "represents", "is a testament to", "at the heart of", "the
backbone of". Say "is", or say what it does.

**Chatbot voice in UI:** "Certainly!", "Great job!", "Let's get started!",
"Here's …", "I hope…", exclamation marks outside a genuine celebration,
"Oops!" in a real error (say what broke and how to fix it).

### Structure tells

- **Rule of three.** Three adjectives or three parallel clauses ("fast,
  simple and reliable"). Keep the one that is true and specific.
- **Negative parallelism.** "Not just X, but Y", "It's not X, it's Y", "No X,
  no Y, just Z". Say Y.
- **Trailing -ing analysis.** "…, helping you stay on top of your business."
  Cut the clause.
- **Elegant variation.** One thing with three names across a screen
  ("location", "site", "venue", "branch"). Pick the product's word and use it
  everywhere.
- **Title Case Headings.** This product uses sentence case.
- **Bold-label lists.** `**Fast:** it's fast`. Use a plain list, or a table if
  it is really key–value.
- **Emoji in headings, buttons or list items.** The product's icon set
  (`@/components/icons`) does that job.
- **Outline conclusions.** "In summary", "Ready to get started?",
  "Why choose us?" blocks that repeat the page above them.
- **Note:** Curly apostrophes (’) are *house style* here, not a tell (see the
  restyle skill). Don't "fix" them. Em dashes are fine in moderation. Flag a
  string that leans on several of them.

## 2. Components and layout

| Tell | Why it's clutter | Fix |
|---|---|---|
| Card inside a card inside a section | Three borders say one thing | Keep the outer surface. The inner rows are `ListRow` / `InfoRow` |
| Wrapper `div` with no classes, or only `flex` around one child | DOM noise | Remove it, and move any needed class onto the child |
| `flex flex-col gap-4` → `div` → `space-y-4` | Two rhythm systems for one stack | One owner of the gap |
| Section header + description + empty-state title all saying the same | ADR-019 rule 6: "a description never restates its title" | Keep the header and drop the rest, or keep only `EmptyState` |
| Generic 3/4-column feature grid ("Fast", "Secure", "Reliable") | Placeholder marketing | A specific list, a real screenshot, or nothing |
| Floating KPI tiles nobody acts on above the fold | DESIGN.md Board-Then-Workbench | Move below the action, make it a filter (`Fact onSelect`), or delete |
| Hand-rolled empty/loading/error block | Drifts from the contract | `EmptyState` / `Bone`·`ListSkeleton` / `ErrorState` |
| Hand-rolled row, tile, badge, pill or avatar | Drifts from the vocabulary | `ListRow`, `RowTile`, `Badge`, `StatusDot`/`Pill`, `Avatar` |
| Two near-identical components | Maintenance and drift | One component + an optional prop |
| A `Tooltip` repeating the visible label | Says it twice | Remove it, unless it is the accessible name of an icon |
| A tab badge counting things nobody is waiting on | ADR-019 rule 6 | Count only what needs someone |
| A totals row for a figure already in a KPI | ADR-019 rule 6 | Remove the row |
| Title repeating the location/workspace name | ADR-019 rule 6 | Remove it |
| Page heading duplicating the top bar masthead | `EditorShell` already portals it | Remove the inner heading |
| Divider (`Separator`, `border-t`) between items already spaced | Double separation | Spacing *or* a rule, not both |

## 3. Spacing and sizing

From `DESIGN.md` → Layout: a **4px base**. 8px (`gap-2`) for tight control gaps,
12px (`gap-3`/`space-y-3`) between related items, 16–20px (`p-4`/`p-5`) inside
regions, 24px (`gap-6`) around the primary board, 32px desktop gutters.

Flag:
- Arbitrary values (`p-[13px]`, `mt-[22px]`, `text-[15px]`, `w-[347px]`) that
  aren't on the scale. Snap them to the nearest step. Layout-critical widths (a
  rail at `22rem`) are fine if they are named and repeated.
- Odd half steps mixed in one stack (`gap-2.5` next to `gap-3`).
- Siblings with different gaps for no reason (`mb-3`, `mb-5`, `mt-2` in one
  list). Give the parent `space-y-*`/`gap-*` and remove the per-child margins.
- Controls off the 36px baseline (`h-8`, `h-11` in a desktop toolbar). Touch
  surfaces use the named 44px touch sizes, not ad hoc heights.
- Heading sizes outside the Typography hierarchy. Display size is
  auth/marketing only, never a dashboard KPI.
- `max-w-*` text measure missing on long prose (marketing/legal), or set on UI
  rows where it truncates for no reason.
- Padding stacked on padding (section `p-5` > card `p-5` > inner `p-4`).

## 4. Visuals

From DESIGN.md Don'ts:
- **Gradients** (`bg-gradient-*`, `bg-linear-*`, `from-*/via-*/to-*`,
  `linear-gradient(`): banned in product UI. On marketing, keep only the ones
  `BrandBackdrop` owns.
- **Glass/blur** (`backdrop-blur`, translucent `bg-white/10` panels) and **glow**
  (`shadow-[0_0_…]`, `drop-shadow-*`, `ring-*` as decoration).
- **Heavy shadows** (`shadow-lg`…`2xl`) on anything that doesn't float. Those
  are only for popovers, drawers, modals and toasts.
- **Raw palette colours** (`bg-purple-500`, `text-blue-600`, hex codes in
  className). Every hue comes from tokens, and colour marks status or domain,
  never decoration.
- **Rounded-full pills** for tabs, filters or statuses. Use attached/compact
  labels.
- **Decorative illustrations, abstract blobs, stock/AI imagery.** Replace them
  with a real product screenshot, the mascot where an ADR allows it, or nothing.
- **Unused or oversized assets** in `public/`. Check string references
  (`"/marketing/…"`) before deleting, and flag files over ~300 KB.
- **Animation added per component.** Motion is inherited from `SettingsShell`
  / `SECTION_RISE`. Other ad hoc `motion.*` with no purpose goes.

## 5. Code

- Component files nothing imports (the scanner lists candidates. Confirm with
  grep for the export name, dynamic `import()`, and the registry files in
  `lib/marketing/`).
- Exports used only by their own file.
- `TODO`, `FIXME`, `lorem`, `placeholder`, `John Doe`, `example.com`,
  `Acme`, hard-coded fake testimonials, ratings, user counts or "trusted by N
  businesses".
- Commented-out JSX blocks.
- Props threaded through but never read. Variants defined but never passed.
- Duplicate label/format helpers across a domain's `shared.ts` files (one tone
  map: `components/shared/tone.ts`; one relative time: `lib/utils/relative-time.ts`).
- Icons imported from a vendor package instead of `@/components/icons`.
