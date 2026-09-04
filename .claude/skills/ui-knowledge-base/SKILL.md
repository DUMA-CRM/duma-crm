---
name: ui-knowledge-base
description: Use when making a non-trivial change to duma-crm - a screen, route, workflow, API call, capability gate, form, store, offline behaviour or the Ask DUMA agent - and when asked to check, refresh or extend the Obsidian UI architecture notes. Runs the read-Obsidian-first, update-Obsidian-after loop so the knowledge base stays in step with the code instead of the repository being rescanned every session.
---

# UI Architecture Knowledge Base

The persistent architectural knowledge for `duma-crm` lives in an Obsidian vault:

```
~/Documents/Obsidian/Claude/Permanent/UI/
```

It was built from a full audit on 2026-09-02 (commit `b8990ba`). Its purpose is
that the expensive investigation is not repeated. **Read it first; keep it
true.**

This repository is **one Next.js 16 deployment that is four products** — the CRM
back office, the POS till, the KDS and the public guest QR app. There is no
`duma-ui`; this is it.

```
Read Obsidian context
        ↓
Identify the affected screen / workflow / contract
        ↓
Inspect only the relevant code
        ↓
Make the change
        ↓
Validate — pnpm check
        ↓
Update Obsidian
        ↓
Update the Change Log
```

---

## Step 1 — Read Obsidian context

1. Read `UI Index.md`. It is the map.
2. Read the `Screens/UI - <Area>.md` note for the screen you are touching, and
   the `Workflows/` note if the change spans several screens.
3. **Always read `Cross-Repo/UI API Discrepancies.md`** before trusting that an
   endpoint works. Several confirmed cross-layer defects live there, and three
   of them are invisible from inside any single repository.
4. Read as the change requires:
   - `Authorization/UI Capability Gating.md` — for anything gated
   - `API Integration/UI API Integration.md` — for anything that calls the API
   - `State Management/UI State Management.md` — for a store or cache question
   - `Error Handling/UI Error Handling.md` — for a failure path
   - `Offline/UI Offline and PWA.md` — for the POS, the queue or the worker
5. Check `Technical Debt/UI Technical Debt Register.md` — you may be about to
   trip over a known finding, or fix one.
6. Check `Decisions/` for a decision that constrains what you are about to do.

Each note's frontmatter `sources:` is **your reading list.**

## Step 2 — Identify the affected area

Answer these before opening code:

- Which route(s)? `Navigation/UI Navigation.md` has all 54 pages with their
  guards.
- Does it **call the API**? Then the endpoint must exist — verify against
  `~/Documents/GitHub/duma-api/src/routes/`, not against memory. Types here are
  hand-written, so a wrong path compiles.
- Does it touch a **capability**? Gate on `capabilities[]`, never `role`. Check
  `Permanent/API/Authorization/Capability Matrix.md` for who actually holds it.
- Does it depend on **persistence or a constraint**? `duma-db` was audited —
  read `Permanent/DB/DB Index.md` and the relevant `Entities/DB - <Domain>.md`
  rather than assuming.
- Does it change a **cross-repo contract**? (`modifiers.name`,
  `menu_items.category`, template categories, the auth catch-all,
  `Idempotency-Key`.) See `Cross-Repo/`.

## Step 3 — Inspect only the relevant code

Open the files the `sources:` lists name, plus whatever they lead you to.

**Do not rescan the repository.** A broad scan is justified only when:

- the notes do not cover the area at all;
- the change crosses three or more screens **and** the API contract;
- the notes contradict the code in **more than one** place (real drift);
- a major dependency bump (`next`, `react`, `@tanstack/react-query`, `zustand`);
- a new architectural pattern appears (a form library, a state library, an E2E
  harness — none exists today);
- the user explicitly asks for another audit.

If a note is wrong, **the code wins.** Note it and fix the note in step 6.

## Step 4 — Make the change

Follow `AGENTS.md` — **this is not the Next.js you know; read
`node_modules/next/dist/docs/` before writing App Router code.** Beyond that, the
rules most often missed:

- **Gate on `capabilities[]`, never on `role`.** `ROLE_RANK` was deleted
  deliberately. Use `hasCapability` / `hasAnyCapability` from
  `lib/auth/capabilities.ts`; add the string to `FRONTEND_CAPABILITIES` first or
  it will not type-check. Route guards go in a `layout.tsx` via
  `requireCapability`. `role` is only for "what kind of account is this".
- **UI gating is not security.** The API is the boundary. Hiding a button is a
  UX affordance; the same capability must gate the data server-side.
- **Browser calls go through `/be`, server calls go direct.** Use `apiFetch`.
  Never hardcode `/be` — use the exported `API_PREFIX`.
- **A root-relative `Location` from the API breaks behind the proxy.** The
  browser resolves it against *our* origin and loses `/be`. Never rely on an API
  redirect; call the canonical path.
- **The endpoint you call must exist.** `@duma-crm/api` is a declared dependency
  imported nowhere, so drift compiles cleanly. `tests/api-contract.test.mts`
  catches renamed and removed paths against `openapi.json` — keep that file
  fresh (`pnpm openapi:export` from `duma-api`) or the test passes against a
  fossil.
- **Money stays a `string`.** Parse only for arithmetic. Margin goes through
  `lib/menu/costing.ts` — **the one place** it is calculated.
- **Do not "fix" the VAT divergence.** `costing.ts` honours `vatRegistered` and
  the API does not, on purpose and with a comment. The API is the wrong one.
- **`POST /orders` is not idempotent** despite the `Idempotency-Key` the offline
  queue sends. Do not assume replay is safe.
- **Never delete a queued offline sale on failure.** Classify it — see
  `lib/utils/offline-order-sync.ts`. It is financial data.
- **Invalidate after every mutation.** Query keys are hand-written literals with
  no factory, so a renamed key silently stops invalidating. There are **no
  optimistic updates** anywhere; keep it that way for money.
- **Put pure logic in `lib/utils/`** so it can be tested — that is the only
  reason a test suite exists here. Keep hooks thin.
- **Every list screen needs four states**: loading, empty, error-with-retry,
  success. A query defaulting to `[]` makes a failure look like "no data".
- **Server Components for guards and first paint**; `'use client'` below.

## Step 5 — Validate

```bash
pnpm check    # lint + typecheck + test + build
```

All four must pass; CI runs exactly these. Note what they do **not** cover:
there are no component tests, no E2E, and nothing that talks to a running API.
`tests/api-contract.test.mts` is a static scan and is the only thing standing
between you and a cross-layer break — if you changed an API call and it did not
run, you have not validated the change.

## Step 6 — Update Obsidian

| If you changed | Update |
|---|---|
| a screen's behaviour, data or states | its `Screens/UI - <Area>.md` note |
| a multi-step user flow | the `Workflows/` note, including its Mermaid diagram |
| a route, guard or redirect | `Navigation/UI Navigation.md` |
| a capability gate | `Authorization/UI Capability Gating.md` |
| an API call, or a request/response shape | `API Integration/UI API Integration.md` |
| a store, cache key or persistence | `State Management/UI State Management.md` |
| a failure path or error message | `Error Handling/UI Error Handling.md` |
| a form or a validation rule | `Forms/UI Forms and Validation.md` |
| the service worker or the offline queue | `Offline/UI Offline and PWA.md` |
| an env var, header or build setting | `Configuration/UI Configuration.md` |
| an agent tool, action or its gating | `AI Agent/UI Ask DUMA Agent.md` |
| a shared component or token | `Components/UI Design System.md` |
| a cross-repo contract | `Cross-Repo/UI API Discrepancies.md` **and** the note on the other side |
| something in the debt register | strike it through with the commit ref — **do not delete** |
| an architectural direction | add `Decisions/UI-ADR-00N <title>.md` and link it from `UI Architecture Decisions.md` |

Rules for writing notes:

- Keep them **focused**; link liberally with `[[Wiki Links]]`.
- Standard YAML frontmatter: `title`, `type`, `repo`, `domain`, `status`,
  `confidence`, `sources`, `tags`, `created`, `updated`. Bump `updated`.
- Mark every non-obvious claim **Confirmed**, **Inferred** or **Unknown**.
- **Never claim a performance problem without evidence.** Say *"Potential —
  requires production evidence."*
- Cite files, not line-by-line code. Do not paste large source blocks.
- Do not restate the API or DB notes — **link to them**. This vault explains how
  the UI *uses* the API and how that lands in the data model.

## Step 7 — Update the Change Log

Add an entry to `Change Log/UI Change Log.md`, newest first:

```markdown
## YYYY-MM-DD — Short description

### Changed
### Why
### User Impact
### API Impact     what duma-api must change, if anything
### DB Impact      usually none
### Affected
- [[UI - Screen]] / [[API Endpoint]] / [[DB - Entity]]
### Source
- `path/to/file.tsx`
```

Only for **meaningful behavioural, architectural or contract** changes. Git holds
the commit log; this holds the story.

---

## When asked to audit rather than change

1. `git log --oneline b8990ba..HEAD` to see what moved.
2. Re-extract the called endpoints and diff them against the API's routes — this
   catches contract drift mechanically:
   ```bash
   grep -rhoE "apiFetch(<[^>]*>)?\(\s*[\`'][^\`']+" lib/api \
     | sed -E "s/apiFetch(<[^>]*>)?\(\s*[\`']//" \
     | sed -E 's/\$\{[^}]*\}/:p/g; s/[?].*$//' | sort -u
   ```
3. Diff `FRONTEND_CAPABILITIES` against
   `~/Documents/GitHub/duma-api/src/lib/capabilities.ts` — a removed capability
   is a silent break.
4. Read only the files the changed commits touched.
5. Update the affected notes and add a change-log entry.

A full re-audit is warranted only if the diff spans most screens, or the user
asks for one.

## Guardrails

- **`duma-api` and `duma-db` are audited.** Link to `Permanent/API/` and
  `Permanent/DB/` rather than restating them. When a question crosses a
  boundary, verify against that repository's **source**, not its notes — that is
  how every cross-layer defect in this vault was found.
- **Never copy secret values** into the vault. `.env` holds real API keys and
  `.npmrc` holds a registry token — names and purposes only.
- **Never delete a debt-register entry** to make the list look shorter.
- **Never let a note claim something the code does not do.** A wrong note is
  worse than a missing one, because it will be trusted.
- **Never present a UI check as a security control.** Say what enforces it.
- **Do not add a dependency to solve a problem the repo has deliberately avoided**
  — there is no form library, no state library beyond Zustand, no charting
  library and no feature-flag service. Each absence is a decision; see
  `Decisions/`.
