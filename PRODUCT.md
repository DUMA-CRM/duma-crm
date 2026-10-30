# Product

<!-- impeccable:product-schema 1 -->

> Business positioning — audiences, pain, competitors, pricing, voice and the
> list of what may and may not be claimed — lives in the Obsidian vault note
> **`Permanent/Platform/DUMA Business Profile.md`** (owner interview,
> 2026-10-28). This file is the in-repo summary; when they disagree on a
> business question, the profile wins. On what the code does, the code wins.

## Platform

web

## Users

DUMA has two kinds of user: the **owner who buys it** and the **staff who
operate it**.

**Who buys it (first audiences, in order):**

1. **Small food and drink businesses** — cafés, coffee shops, bakeries, small
   restaurants, bars, food trucks — with one to a few locations, run by an
   owner-operator who signs up themselves.
2. **Small product sellers** — online stores and clothing shops, selling online,
   in a shop or both. DUMA is the back office, till and customer engine **behind
   their existing storefront**; it does not host the storefront yet.

Secondary audiences, served by single modules: services (salons, studios),
creators (authors, course sellers), anyone who needs just forms, notes or a
headless CMS, and developers/agencies using the API and MCP server.

**Markets:** United Kingdom first (`en-GB`, GBP, VAT), then other
English-speaking countries, then Ukraine.

**Who operates it:** staff hold a role, and each role gets a genuinely different
application rather than one admin panel with disabled buttons. Built-in roles:

| Role                | Situation and job                                                                                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `barista`           | On the floor mid-shift, standing, often on a shared tablet. Takes orders, works the kitchen queue, checks their own rota and HR.         |
| `store_manager`     | Runs one site day to day: menu, inventory, purchasing, stocktakes, orders, team rota, cash-up, reports.                                  |
| `hr_manager`        | People admin across sites: starters, leave, shift cover, helpdesk, payroll preparation.                                                  |
| `marketing_manager` | Owns the customer base: customer records, marketing preferences, email templates and automations.                                       |
| `auditor`           | Read and verify: reports, audit log, records — without operational write access.                                                        |
| `franchise_owner`   | Runs several sites: workspaces, cross-site reporting, money features, group configuration.                                              |
| `super_admin`       | Platform operator; sees every tenant and location.                                                                                      |

Workspaces can also create their own roles. **Access is decided by
capabilities, never by role rank** — `ROLE_RANK` was deleted on purpose (see
`lib/api/staff.service.ts`, `lib/auth/capabilities.ts`). `role` only answers
"what kind of account is this", such as whether it is pinned to locations.

## Product Purpose

**A business operating system: every tool a small business runs on, in one
place, on one bill.** DUMA replaces the usual stack — a till, a kitchen screen, a
stock spreadsheet, a rota app, a booking app, an email tool, a loyalty app, a
website CMS — with one application whose parts share one database, so a sale
updates stock, the customer's profile, margin and reports without anyone
re-typing it.

It is modular: a workspace switches on only the modules it needs (28 in
`lib/modules/manifest.ts`, 25 of them optional) and adds more later without
moving data. A business can use a single module on its own.

Success is a business that runs open to close — selling, stocking, staffing and
reporting — without leaving DUMA, and an owner who can see the whole business in
one place.

## Positioning

Lift pitch: *DUMA is the one system a small business runs on. Till, orders,
stock, rotas, customers, marketing and reports in one place, on one bill, on the
phone, tablet or laptop you already own, alongside the card terminal you already
have.* Working tagline: **"Run your whole business from one place, on one bill."**

The claims a neighbouring product (Square, SumUp, Lightspeed, Epos Now, Toast,
Shopify + apps, Deputy, Mailchimp) could not truthfully copy in full:

1. **One system, one bill, no add-ons.** POS, KDS, inventory, purchasing, rota,
   HR, payroll preparation, loyalty, promotions, email, forms, CMS and reporting
   ship in the same application. Competitors sell these as paid modules or
   third-party apps.
2. **Free to run on.** A free plan with no time limit covers the basics in full;
   a paid plan raises limits rather than locking the till.
3. **Works with what you already have.** Any device with a browser; keep your
   Square or SumUp card terminal; no hardware lock-in.
4. **Offline-first till.** The shop keeps taking money when the connection drops.
   Orders are queued durably and rejected sales are retained for reconciliation
   rather than silently discarded.
5. **Open, not a walled garden.** Public API, MCP server, API keys, webhooks and
   connectors let DUMA act as the business's data warehouse.
6. **Free hands-on setup help** on every plan, from the person who builds it.
7. **Role-shaped and group-ready.** Each role gets its own app; tenants,
   locations, workspaces, audit log and cross-site comparison are in the data
   model, so one shop grows into a group without changing product.

**For online stores the position is "keep your storefront, replace the apps
around it"** — never "replaces Shopify" until a hosted storefront ships.

## Operating Context

- **Shop floor, mid-rush.** POS and KDS run as an installed PWA in standalone
  full-screen mode on tablets (`app/manifest.ts`, `start_url: /dashboard`).
  Shared devices, wet hands, glare, one-handed use, operators changing between
  shifts. Tablets are expected to use full-disk encryption, managed accounts, auto
  screen lock, and the normal sign-out flow between operators.
- **Shop counter and pop-ups.** Product sellers open the same till on a phone or
  tablet to sell in person from the same stock and customer list as their online
  store.
- **Back office, desk.** Reports, purchasing, payroll, scheduling, communications,
  content and settings are the sit-down work — a desktop or laptop session, longer
  attention, denser data. For a small business this is usually the owner, in the
  evening.
- **Two-axis workspace.** Active tenant and location are device-persisted UI
  preferences, validated against the signed-in profile, cleared at sign-out, and
  part of every tenant-sensitive query key. Nothing may read workspace-dependent
  data without carrying its tenant/location in both the request and the cache key.
- **Real workflows the product is built around:** open-to-close shift, receiving a
  delivery against a purchase order, counting stock and reading variance, cash-up,
  onboarding a starter, arranging shift cover, sending customer email, reading
  reports without being misled (`lib/content/support-articles.ts`).
- **Public surfaces.** The marketing site (`app/(marketing)`), the guest QR
  ordering app (`app/order/[token]`) and sign-up are seen by people who have never
  used DUMA.
- **Locale:** `en-GB`, GBP. Dates, currency and number formatting are centralised
  in `lib/utils/format.ts`.

## Capabilities and Constraints

**Confirmed capabilities:** POS terminal (offline queue), KDS, orders and refunds,
QR ordering, payments and cash-up, reservations with floor plan and waitlist,
products and menu with variants (sizes, colours), recipes and VAT-aware margin,
inventory, restock requests, purchase orders and suppliers, stocktakes, rota,
clock-ins and shift cover, leave, HR records and documents, payroll preparation
and payslips, helpdesk and support articles, customers with loyalty, marketing
preferences and privacy requests, email templates and automations, promotions,
referrals, forms (with generated form UI), notes with Google Drive sync, CMS with
multi-language content and an SEO preview, reports and analytics, Ask DUMA
assistant, audit log, workspaces, devices, security and trading settings.

**Connectors live today:** card payments (**Square, SumUp**), web analytics
(**Umami, PostHog**), media storage (**Cloudflare R2 / S3-compatible, Vercel
Blob**), Google Drive, Telegram, email; developer access through API keys, the
MCP server and webhooks (`components/settings/connectors/registry.ts`).

**Not available — label it, never imply it:**

- **Stripe** — no connection exists.
- **Receipt and label printers, cash drawers** — coming soon; receipts print from
  the browser today.
- **Accounting and payroll export connectors** — coming soon.
- **Payroll submission** — DUMA prepares pay runs and payslips; submission to
  HMRC (PAYE/RTI) happens in an external payroll tool or with an accountant.
- **Hosted storefront / online checkout** — planned, not built.
- **Emailing a generated receipt** — the API has no endpoint, so the UI marks the
  action unavailable.
- Legacy unscoped offline queue entries are held for explicit manager review and
  never replayed automatically.

**Technical constraints:**

- Next.js 16 / React 19, Tailwind v4, shadcn-style `components/ui`, Radix
  primitives, TanStack Query, Zustand, Hugeicons via `components/icons`.
  **The Next.js version has breaking changes from common knowledge — read
  `node_modules/next/dist/docs/` before writing framework code** (`AGENTS.md`).
- The DUMA API is authoritative for tenant, capability and location
  authorization; there is no row-level security in the database. The edge proxy
  does a fast cookie-presence check; the CRM server layout revalidates on every
  protected navigation; route segments enforce capabilities server-side via
  `requireCapability`. Only explicit `401`/`403` invalidates a session —
  transport or API outages must not.
- Service worker offline scope is account-scoped: previously visited screens and
  successful reads are served from cache; POS order creation queues durably; every
  other mutation is network-only and must tell the user so; never-visited screens
  must show an explicit "not available offline yet" state rather than a broken one.
- Hosting: the API and database run on a VPS in **Manchester, United Kingdom**;
  this UI deploys to Vercel.
- Verification gate is `pnpm check` (ESLint, TypeScript, unit tests, production
  build), mirrored in GitHub Actions for PRs and pushes to `main`.

## Brand Commitments

- **Name:** DUMA — from the founder's name, **DU**dych **MA**rian, and the
  Ukrainian word *дума*, "a thought, a considered idea". Search name: "DUMA
  Business"; domain `duma-business.com`.
- **Voice:** **calm, honest, capable.** The company speaks as "we". Plain, second
  person, British English, operator's language, unafraid of the awkward truth —
  "Run a shift from open to close", "Read your reports without being misled". No
  hype ("revolutionary", "AI-powered", "bank-grade"), no exclamation marks, no
  feature-speak, no invented numbers.
- **Visual system:** DESIGN.md is the authority ("The Service Board"): warm oat
  ground, porcelain fields, deep forest navigation shell, brand-green action, and
  domain colours for orders, kitchen/reference, stock and team. Tokens are defined
  once in `app/globals.css`. Light and dark themes both ship (`next-themes`).
- **Pricing structure:** Free (forever, no card) · Business (one flat monthly
  price, not yet set) · Contact us (more support). Founding members who join
  before paid plans start keep 10% off Business for life. The sign-up call to
  action is "Start for free" (`lib/marketing/site.ts`).
- **Assets on hand:** `public/icon.svg`, `public/icon-maskable.svg`,
  `public/logo.svg`, `public/logo_white_green.svg`, `public/apple-icon.png`, the
  generated share image (`app/opengraph-image.tsx`), and product screenshots in
  `public/marketing/screenshots/` (`pos.png`, `dashboard.png`).

## Evidence on Hand

**Stage: early launch.** DUMA is built and supported by one person, Marian
Dudych, as a personal project; a company will be registered before paid plans
start. Data is hosted in the UK.

**First live user:** MTT Clothes (<https://mtt-clothes.com.ua/>), a Ukrainian
online clothing shop, started in late October 2026. There is **no quote,
testimonial or case study from them yet** — none may be written for them.

Therefore no other customer names, logos, testimonials, case studies, reviews,
site counts, transaction volumes, uptime figures, press mentions, awards or
certifications (including "GDPR compliant") exist, and none may be invented,
mocked up as if real, or implied anywhere in the product or its marketing
surfaces. Marketing surfaces carry the product's own demonstrable mechanics —
what it does, how it behaves offline, what it works with — and label example
data as examples.

Real material that does exist: the working application, 19 support articles
(`lib/content/support-articles.ts`), `openapi.json` as the API contract, the
connectors above, and the brand assets above.

**Product imagery is not fully owned.** The only remote image hosts allowed today
are a Costa Coffee MDM asset host and `duma-coffee.vercel.app`
(`next.config.ts`). Menu imagery drawn from a third party's asset host is
placeholder material, not a DUMA asset — future work must not treat it as
licensed brand photography or build a visual world that depends on it. The
current POS screenshot shows a Ukrainian demo menu; UK marketing needs an English
one.

## Product Principles

1. **The shift does not stop.** Anything staff do mid-rush must survive a dropped
   connection, a shared device and an operator change. Degrade honestly and
   explicitly; never silently lose money or fake a success.
2. **Each role gets its own product.** Design for the one job that role does, in
   the posture and scene they do it in. Never ship an everything-panel with
   permissions subtracted.
3. **One system, one truth.** Features join the existing workspace rather than
   becoming another surface; tokens, formatting and workspace scope have exactly
   one source each.
4. **Claim nothing that isn't there.** No invented proof, and an unavailable
   capability is labelled unavailable rather than dressed up.
5. **Free means free.** The free plan must run a real small business; paid plans
   raise limits, they never hold the basics hostage.
6. **Scales from one shop to a group without becoming a different product.** The
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
