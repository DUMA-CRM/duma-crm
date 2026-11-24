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
pnpm check          # test + lint + typecheck + build — what CI runs
pnpm test           # node:test, ~440 tests in tests/unit, ~2s
pnpm typecheck      # tsc --noEmit
```

`pnpm check` does **not** test the UI/API contract at all. If you changed an API
call, confirm the endpoint exists in `~/Documents/GitHub/duma-api/src/routes/`.

## Repository-specific rules

### Gate on `capabilities[]`, never on `role`

`ROLE_RANK` / `roleAtLeast` were deleted deliberately — ranking
`marketing_manager` below `store_manager` hid the customer base from the role
that owns it. Use `hasCapability` / `hasAnyCapability` from
`lib/auth/capabilities.ts`; add the string to its module's list in
`CRM_MODULE_CAPABILITIES` (`lib/modules/manifest.ts`, which builds
`FRONTEND_CAPABILITIES`) first or it will not type-check. Gate a page on the
*read* capability its data needs and each edit control on its *write*
capability — Menu opens on `menu:read`, edits need `menu:write`. Route guards go in a `layout.tsx` via `requireCapability`.
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

Nothing type-checks an API path, so a wrong one compiles cleanly — and **no
test checks them either**. An earlier version of this file described
`tests/api-contract.test.mts` and `tests/agent-contract.test.mts`; neither exists
(audit 2026-11-24). `openapi.json` at the root is a snapshot that nothing reads.
Until a contract test is written, grep `duma-api/src/routes/` (and `src/app.ts`
for the mount prefix) for every path you add or change — `apiFetch(...)` and the
agent's `runtime.get(...)` alike.

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

`costing.ts` and the API (`src/lib/order-tax.ts`) now agree: neither extracts
VAT for a business that is not VAT-registered. The old "deliberate divergence"
is gone — keep the two in step if either changes.

### Offline sales are financial data

`POST /orders` honours the `Idempotency-Key` the offline queue sends (unique
constraint; a replay returns the first order, a clash is a 409). Even so,
**never delete a queued offline sale on failure** — classify it
(`lib/utils/offline-order-sync.ts`). Refunds take an `Idempotency-Key` too: one
per refund draft, reused on retry.

### Invalidate after every mutation

Build keys with `moduleQueryKeys.<module>.key(...)`; an invalidation matches by
prefix, so a key nobody writes any more silently invalidates nothing. There are
**no optimistic updates** anywhere — keep it that way for anything touching
money or stock.

A failed mutation with no `onError` of its own gets a toast from the global
`MutationCache` (`components/providers/QueryProvider.tsx`), as a failed query
does from the `QueryCache`. Give a mutation its own `onError` — or
`meta: { silentError: true }` — when it shows the failure itself; otherwise it
toasts twice. A 403 toast names the capability the API reported.

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

- **No test checks an API path** (see above) — a renamed route compiles and
  ships.
- `GET /orders` caps `limit` at **100**. Asking for 200 silently returns 100, so
  any total worked out from one page is wrong on a busy day. Use
  `/orders/summary` for totals and page through lists.
- The service worker (`public/sw.js`) caches API responses for offline use. A
  new sensitive path must be added to its skip list, or personal data stays in
  the cache on a shared till.
- `/hr/expense-claims/*` does not exist (dropped 2026-07). Payslips come from
  pay-run lines: `/hr/payslips/my` and `/hr/payslips?userId=`.
- `ApiError` carries `issues[]`, `capability` and `capabilities[]` (any-of
  routes); use them rather than parsing the message.
- `/orders` gates on `orders:read` on both sides.
- Server Components can authenticate; a bearer token in JS cannot — that is why
  the `/be` proxy exists.
- `motion` animations respect reduce-motion through one `<MotionConfig
  reducedMotion="user">` in `QueryProvider` — don't add another.
