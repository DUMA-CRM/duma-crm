# DUMA CRM

DUMA is a multi-tenant café operations application built with Next.js 16 and
React 19. It includes POS, kitchen display, orders, customers, inventory,
purchasing, scheduling, HR, training, reporting, and customer communications.

## Requirements

- Node.js 22
- pnpm 9
- A running DUMA API
- Access to the private `@duma-crm/api` package registry

## Local setup

Create `.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:7777
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Required only for training image uploads.
BLOB_READ_WRITE_TOKEN=

# Optional provider-neutral JSON ingestion endpoints.
ERROR_REPORTING_URL=
NEXT_PUBLIC_ERROR_REPORTING_URL=
```

Install and start:

```bash
pnpm install
pnpm dev
```

The web app runs at `http://localhost:3000`. Browser API calls use the
same-origin `/be/*` rewrite; server components call `NEXT_PUBLIC_API_URL`
directly and forward the session cookie.

## Verification

```bash
pnpm check
```

This runs ESLint, TypeScript, unit tests, and a production build. GitHub Actions
runs the same gates for pull requests and pushes to `main`.

## Authentication and authorization

The edge proxy performs a fast session-cookie presence check. The CRM server
layout validates the session against the API on every protected navigation.
Transport or API outages do not delete valid sessions; only explicit `401` or
`403` responses are treated as invalid authentication.

Privileged route segments also enforce their role policy on the server. The API
remains authoritative for tenant, role, and location authorization.

## Workspace isolation

The active tenant and location are device-persisted UI preferences. They are:

- validated against the signed-in staff profile;
- cleared at sign-out;
- included in tenant-sensitive query keys; and
- used to filter super-admin menu and modifier responses.

Do not introduce a workspace-dependent query without including its tenant or
location in both the request scope and TanStack Query key.

## Offline POS safety

Offline orders are persisted locally and scoped to the originating user and
tenant. Each attempt carries a stable `Idempotency-Key`, including replays.
Rejected sales are retained for reconciliation instead of being silently
deleted.

The API must atomically enforce `Idempotency-Key` for `POST /v1/orders`, ideally
with a tenant-scoped unique record storing the original response. Without
server-side enforcement, no browser can completely eliminate the
“server committed but response was lost” duplicate-order case.

Legacy unscoped queue entries are preserved by the version-2 migration, assigned
to the first signed-in profile on that device, and held for explicit manager
review. They are never replayed automatically.

## PWA behavior

The service worker provides account-scoped offline access:

| Capability                         | Offline behavior                                                                              |
| ---------------------------------- | --------------------------------------------------------------------------------------------- |
| Previously visited CRM screens     | Loaded from the signed-in account's page/RSC cache                                            |
| Successful API reads               | Loaded from that account's API cache                                                          |
| Static application assets          | Loaded cache-first                                                                            |
| POS order creation                 | Stored in the durable order queue and replayed with the same idempotency key                  |
| Other create/update/delete actions | Network-only; the UI keeps the user informed and the action can be retried after reconnection |
| Screens/data never opened online   | Show an explicit “not available offline yet” response                                         |

Only a hash of the user ID is persisted as the active cache scope. Account
caches are deleted on logout and explicit session expiry. Authentication
endpoints and mutations are never stored by the service worker.

Because cached CRM records may contain customer or employee information, café
tablets should use full-disk encryption, managed user accounts, automatic screen
locking, and the normal DUMA sign-out flow before changing operators.

## Receipts

Completed online orders can open the API-generated receipt PDF for printing.
Queued orders expose the receipt after synchronization. The current API
specification has no endpoint for emailing a generated receipt, so the UI
marks that action unavailable instead of claiming an email was sent.

## Deployment checklist

- Configure the two public URLs and `BLOB_READ_WRITE_TOKEN`.
- Verify the API allows the application origin and uses secure HTTP-only session cookies.
- Ensure the API enforces order idempotency.
- Connect production error monitoring and redact customer, payroll, banking,
  session, and tenant-sensitive values.
- Run `pnpm check`.
