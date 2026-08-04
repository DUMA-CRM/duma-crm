# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

DUMA is used by everyone who works in or over a coffee shop, and each role gets a
genuinely different application rather than one admin panel with disabled
buttons. The API's role ranks (`lib/api/staff.service.ts`) are the authority:

| Role                | Rank | Situation and job                                                                                                                               |
| ------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `barista`           | 20   | On the floor mid-shift, standing, often on a shared tablet. Takes orders, works the kitchen queue, checks their own rota and HR, requests stock. |
| `hr_manager`        | 40   | People admin across sites: starters, leave, shift cover, helpdesk, payroll.                                                                      |
| `marketing_manager` | 40   | Customer records, marketing preferences, email templates and automations.                                                                        |
| `auditor`           | 40   | Read and verify: reports, audit log, records — without operational write access.                                                                 |
| `store_manager`     | 60   | Runs one site day to day: menu, inventory, purchasing, stocktakes, orders, team rota, cash-up, reports.                                          |
| `franchise_owner`   | 80   | Runs several sites: workspaces, cross-site reporting, money features, group configuration.                                                       |
| `super_admin`       | 100  | Platform operator; sees every tenant and location.                                                                                              |

Rank alone does not decide access: money features use explicit role allow-lists, so
`hr_manager` and `franchise_owner` can see things a higher-ranked `store_manager`
must not (`lib/constants/nav.ts`).

Two buying audiences, both first-class: **independent single-site cafés** and
**multi-site groups / franchise networks**. The product must be worth adopting on
day one for one shop and must scale into a group without a migration or a
different product.

## Product Purpose

Run an entire coffee business from one system. DUMA replaces the usual stack of a
till, a separate kitchen screen, a stock spreadsheet, a rota app, a payroll
export and a marketing tool with one multi-tenant application covering POS, KDS,
orders, customers, menu, inventory, purchasing, stocktakes, scheduling, HR,
payroll, helpdesk, reporting, audit and customer communications.

Success is a shift that runs open to close without leaving the app and without a
member of staff needing to know how the system works.

## Positioning

Four claims a neighbouring product (Square, Toast, Lightspeed) could not
truthfully copy in full. All four were confirmed as the product's actual
difference, so all four are load-bearing:

1. **One system, no add-ons.** POS, KDS, inventory, purchasing, rota, payroll,
   HR, customer comms and reporting ship in the same application. Competitors
   sell these as separate paid modules or third-party integrations.
2. **Offline-first shop reliability.** The shop keeps taking money when the
   connection drops. Orders are queued durably, replayed with a stable
   `Idempotency-Key`, and rejected sales are retained for reconciliation rather
   than silently discarded.
3. **Role-shaped workspace.** Seven roles, each with a different app surface,
   enforced on the server per route segment — not one admin panel with greyed-out
   controls.
4. **Group-level control.** Tenant and location scoping, workspaces, audit log
   and cross-site comparison are built into the data model, not bolted on.

## Operating Context

- **Shop floor, mid-rush.** POS and KDS run as an installed PWA in standalone
  full-screen mode on café tablets (`app/manifest.ts`, `start_url: /dashboard`).
  Shared devices, wet hands, glare, one-handed use, operators changing between
  shifts. Tablets are expected to use full-disk encryption, managed accounts, auto
  screen lock, and the normal sign-out flow between operators.
- **Back office, desk.** Reports, purchasing, payroll, scheduling, communications
  and settings are the sit-down work — a desktop or laptop session, longer
  attention, denser data.
- **Two-axis workspace.** Active tenant and location are device-persisted UI
  preferences, validated against the signed-in profile, cleared at sign-out, and
  part of every tenant-sensitive query key. Nothing may read workspace-dependent
  data without carrying its tenant/location in both the request and the cache key.
- **Real workflows the product is built around:** open-to-close shift, receiving a
  delivery against a purchase order, counting stock and reading variance, cash-up,
  onboarding a starter, arranging shift cover, sending customer email, reading
  reports without being misled (`lib/content/support-articles.ts`).
- **Locale:** `en-GB`, GBP. Dates, currency and number formatting are centralised
  in `lib/utils/format.ts`.

## Capabilities and Constraints

**Confirmed capabilities:** POS terminal, KDS terminal, orders and refunds,
customer records with loyalty/marketing preferences/privacy requests, menu
management, inventory with items and units, restock requests, purchase orders and
suppliers, stocktakes, cash-up, my-HR and team HR, rota and shift cover, leave
requests, helpdesk, payroll, reports (metrics, comparison, refunds, top items,
saved library), audit log, workspaces, connectors, devices, security and trading
settings, customer email templates and automations, support articles.

**Technical constraints:**

- Next.js 16 / React 19, Tailwind v4, shadcn-style `components/ui`, Radix
  primitives, TanStack Query, Zustand, Hugeicons via `components/icons`.
  **The Next.js version has breaking changes from common knowledge — read
  `node_modules/next/dist/docs/` before writing framework code** (`AGENTS.md`).
- The DUMA API is authoritative for tenant, role and location authorization. The
  edge proxy does a fast cookie-presence check; the CRM server layout revalidates
  on every protected navigation; privileged segments enforce their own role policy
  server-side. Only explicit `401`/`403` invalidates a session — transport or API
  outages must not.
- Service worker offline scope is account-scoped: previously visited screens and
  successful reads are served from cache; POS order creation queues durably; every
  other mutation is network-only and must tell the user so; never-visited screens
  must show an explicit "not available offline yet" state rather than a broken one.
- Verification gate is `pnpm check` (ESLint, TypeScript, unit tests, production
  build), mirrored in GitHub Actions for PRs and pushes to `main`.

**Known product gaps that must not be papered over:** the API has no endpoint for
emailing a generated receipt, so the UI marks that action unavailable instead of
implying an email was sent. Legacy unscoped offline queue entries are held for
explicit manager review and never replayed automatically.

## Brand Commitments

- **Name:** DUMA. Landing positioning line in use: "Coffee Business OS" /
  "All in one business app".
- **Palette is named and binding**, defined once in `app/globals.css` as the single
  source of truth: Bluerocratic `#236bfe` (primary), Dark Eclipse `#111a40`
  (foreground), Inspiration Peak (success), Pumpkin Pie (warning), Youthful Coral
  (destructive), on a cool grey `#eff1f3` page with white cards. Light and dark
  themes both ship (`next-themes`).
- **Voice, as already written in product copy:** plain, second person, operator's
  language, unafraid of the awkward truth — "Run a shift from open to close",
  "Set up customer email that actually sends", "Read your reports without being
  misled". No vendor gloss, no exclamation marks, no feature-speak.
- **Assets on hand:** `public/icon.svg`, `public/icon-maskable.svg`, `public/og.png`.

## Evidence on Hand

**Stage: pre-launch build. There are no live cafés, no paying customers, and no
public users yet.**

Therefore no customer names, logos, testimonials, case studies, reviews, site
counts, transaction volumes, uptime figures, press mentions, awards, pricing or
availability claims exist — and none may be invented, mocked up as if real, or
implied anywhere in the product or its marketing surfaces. Marketing surfaces must
carry the product's own demonstrable mechanics (what it does, how it behaves
offline, what each role sees) instead of borrowed social proof.

Real material that does exist: the working application, the six support articles,
`openapi.json` as the API contract, and the brand palette and icons above.

**Product imagery is not owned.** The only remote image hosts allowed today are a
Costa Coffee MDM asset host and `duma-coffee.vercel.app` (`next.config.ts`). Menu
and marketing imagery drawn from a third party's asset host is placeholder
material, not a DUMA asset — future work must not treat it as licensed brand
photography or build a visual world that depends on it.

## Product Principles

1. **The shift does not stop.** Anything a barista does mid-rush must survive a
   dropped connection, a shared device and an operator change. Degrade honestly
   and explicitly; never silently lose money or fake a success.
2. **Each role gets its own product.** Design for the one job that role does, in
   the posture and scene they do it in. Never ship an everything-panel with
   permissions subtracted.
3. **One system, one truth.** Features join the existing workspace rather than
   becoming another surface; tokens, formatting and workspace scope have exactly
   one source each.
4. **Claim nothing that isn't there.** Pre-launch means no invented proof, and an
   unavailable capability is labelled unavailable rather than dressed up.
5. **Scales from one shop to a group without becoming a different product.** The
   single-site owner should never pay in complexity for the franchise features.

## Accessibility & Inclusion

- WCAG AA contrast is an established practice in the codebase, not an aspiration:
  the semantic colours in `app/globals.css` are documented as darkened
  specifically so that body text using them clears AA on every surface they sit on.
- Existing patterns to preserve: `aria-live` regions for asynchronous operational
  updates (KDS, orders, audit log, toasts), `sr-only` labelling, and
  `prefers-reduced-motion` handling in global CSS.
- Real-world needs implied by the scene: glare and one-handed tablet use on the
  floor, generous touch targets for POS/KDS, and legibility for staff who were
  trained in five minutes on a busy morning.
