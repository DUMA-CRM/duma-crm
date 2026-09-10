@AGENTS.md

# CLAUDE.md — duma-crm

The UI: **one Next.js 16 deployment that is four products** — the CRM back
office, the POS till, the KDS and the public guest QR ordering app. There is no
`duma-ui`; this is it.

## Architecture Knowledge Base

**An Obsidian vault holds the persistent architectural knowledge for this
repository**, built from a full audit on 2026-09-02 (commit `b8990ba`):

```
~/Documents/Obsidian/Claude/Permanent/UI/     ← this repo    entry: UI Index.md
~/Documents/Obsidian/Claude/Permanent/API/    ← duma-api     entry: API Index.md
~/Documents/Obsidian/Claude/Permanent/DB/     ← duma-db      entry: DB Index.md
```

All three repositories are audited and all three are checked out locally at
`~/Documents/GitHub/`. The `ui-knowledge-base` skill runs the full loop.

### Before making a significant change

1. **Read the relevant Obsidian notes first.** Find the screen, workflow or
   platform note from `UI Index.md`.
2. **Always check `Cross-Repo/UI API Discrepancies.md`** before trusting that an
   endpoint works. Several confirmed cross-layer defects live there.
3. Read the related API note for the endpoint's real contract, and the DB note
   only when the question is about persistence or constraints.
4. Use each note's frontmatter `sources:` as the reading list, and **open only
   those files**. Do not rescan the repository.

### After making a significant change

1. Update the screen / workflow / integration note you worked from.
2. Add an entry to `Change Log/UI Change Log.md`.
3. Record a real architectural decision under `Decisions/`.
4. If API or DB behaviour changed, update the cross-references on that side too.

### If the notes disagree with the code

The repository is the source of truth for *what the code does*. Obsidian is the
persistent context layer. **Code wins** — fix the note and say so in the change
log. Never delete a debt-register entry; strike it through with the commit ref.

### Related repositories

```
duma-crm  → this repo, authoritative for UI behaviour
duma-api  → authoritative for API behaviour   (~/Documents/GitHub/duma-api)
duma-db   → authoritative for database behaviour (~/Documents/GitHub/duma-db)
```

When a question crosses a boundary, **verify against that repository's source**,
not its notes. That is how every cross-layer defect in the vault was found.

## Commands

```bash
pnpm dev            # next dev (Turbopack)
pnpm check          # lint + typecheck + test + build — what CI runs
pnpm test           # node:test, ~199 tests, <1s
pnpm typecheck      # tsc --noEmit
```

`pnpm check` does **not** test the UI/API contract beyond a static scan. If you
changed an API call, confirm the endpoint exists in
`~/Documents/GitHub/duma-api/src/routes/`.

## Repository-specific rules

### Gate on `capabilities[]`, never on `role`

`ROLE_RANK` / `roleAtLeast` were deleted deliberately — ranking
`marketing_manager` below `store_manager` hid the customer base from the role
that owns it. Use `hasCapability` / `hasAnyCapability` from
`lib/auth/capabilities.ts`; add the string to `FRONTEND_CAPABILITIES` first or it
will not type-check. Route guards go in a `layout.tsx` via `requireCapability`.
`role` is only for "what kind of account is this" (e.g. is it location-pinned).

### UI gating is not security

The API is the boundary. Hiding a button is a UX affordance — the same
capability must gate the data server-side. There is **no row-level security** in
the database either, so the API check is the only one.

### Browser calls go through `/be`, server calls go direct

`lib/api/client.ts` picks the base by execution context. Use `apiFetch`; never
hardcode `/be` — use the exported `API_PREFIX`.

**A root-relative `Location` header from the API breaks behind this proxy** — the
browser resolves it against our origin and loses the `/be` prefix. Never rely on
an API redirect; call the canonical path.

### The endpoint you call must exist

Nothing type-checks an API path, so a wrong one compiles cleanly.
`tests/api-contract.test.mts` catches renamed and removed paths against
`openapi.json` — keep that file fresh or the test passes against a fossil. It
scans `apiFetch(...)`; the agent's `runtime.get(...)` calls are covered
separately by `tests/agent-contract.test.mts`.

`@duma-crm/api` — the published Hono RPC types — was **removed on 2026-09-10**.
It had been declared and imported nowhere since the repository began
(UI-ADR-004), and being the only private dependency it meant every CI run had
to authenticate to GitHub Packages. That authentication had never once
succeeded: every run failed at `pnpm install`. Re-add it if the RPC types are
ever adopted, and grant `duma-crm` Actions access to the package at the same
time.

### Money is a string; margin has one home

Decimal amounts stay `string`, parsed only for arithmetic. Margin goes through
`lib/menu/costing.ts` — **the one place** it is calculated, and VAT-aware.

**Do not "fix" the VAT divergence.** `costing.ts` honours `vatRegistered` and the
API does not, on purpose and with a comment. The API is the wrong one.

### `POST /orders` is not idempotent

Despite the `Idempotency-Key` the offline queue sends. Do not assume replay is
safe. And **never delete a queued offline sale on failure** — classify it
(`lib/utils/offline-order-sync.ts`). It is financial data.

### Invalidate after every mutation

Query keys are hand-written literals with no factory, so a renamed key silently
stops invalidating. There are **no optimistic updates** anywhere — keep it that
way for anything touching money or stock.

### Put pure logic in `lib/utils/`

That is the only reason a test suite exists here — there are no component tests.
Keep hooks thin and the arithmetic importable.

### Every list screen needs four states

Loading, empty, error-with-retry, success. A query defaulting to `[]` makes a
failure look like "no data" — which is exactly how a dead feature went unnoticed
for two months.

### Don't add a dependency the repo has deliberately avoided

No form library, no state library beyond Zustand, no charting library, no
feature-flag service. Each absence is a decision — see `Decisions/` in the vault.

## Things that will bite you

- `POST /orders` ignores `Idempotency-Key` (API TD-069)
- `/hr/payslips/*` and `/hr/expense-claims/*` **do not exist** — tables dropped
  2026-07; the UI still calls them
- `apiFetch` discards the API's `issues[]` and `capability` error fields
- `/orders` gates on `orders:bulk`, locking `auditor` out of a read it holds
- Server Components can authenticate; a bearer token in JS cannot — that is why
  the `/be` proxy exists
