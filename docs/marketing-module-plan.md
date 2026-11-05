# DUMA marketing module

Design proposal — 3 November 2026. Implementation added locally on 4 November 2026; provider connections and deployment have not been performed. See the implementation status below.

## Product direction

Add a tenant-scoped `marketing` module at `/marketing`: a calendar for drafting, scheduling, and tracking social posts. One editorial post can have several destinations, each with its own format, caption, media, schedule, and publishing result.

Assumption: this is a feature DUMA customers can enable, including DUMA's own workspace. If it is exclusively an internal tool for DUMA's accounts, revisit TikTok Direct Post eligibility before implementing that connector.

Keep the existing public website's `app/(marketing)` route group separate from this product module. The new authenticated page belongs at `app/(crm)/marketing/page.tsx`; product components should live under `components/social-marketing` to avoid confusion with website marketing components.

## First release

- Month and week calendar, plus an agenda layout on small screens.
- Unscheduled drafts list; filter by account, platform, and status.
- Create, edit, duplicate, schedule, reschedule, and cancel unpublished posts.
- Upload/select media once; override caption, media, and time per destination.
- YouTube videos and Shorts; Facebook Page text/image/video posts and Reels; Instagram images, carousels, and Reels; TikTok videos, subject to provider approval.
- Connected accounts in existing Settings → Connectors; support multiple accounts per platform per workspace.
- Per-destination processing, published, blocked, and failed states, with provider links and actionable errors.
- Publishing history and explicit retry of eligible failed destinations.

Defer paid ads, engagement analytics, inbox/comments, AI generation, recurring posts, approval workflows, Stories, and a built-in video editor. A draft can be saved without connected accounts, but cannot be scheduled for automatic publishing until its destinations are ready.

## User experience

The header contains Marketing, the current date range, Today/previous/next controls, Month/Week/Agenda, and New post. The workspace timezone stays visible beside scheduling controls. Platform/account and status filters sit below it. A drafts panel holds unscheduled work.

Calendar cards show thumbnail, internal title, scheduled time, destination icons, and aggregate status. Selecting a day creates a draft with that date prefilled. Selecting a card opens the shared drawer. If destinations use different dates, show the relevant destination occurrences on each day, linked to the same editorial post.

The composer drawer has:

1. Internal title and selected destination accounts.
2. Shared media and base caption.
3. Destination tabs for format, overrides, preview, and provider-specific fields.
4. Schedule with workspace timezone and optional destination overrides.
5. Save draft and Schedule actions; scheduling shows exactly which accounts and times will be used.

YouTube needs title, description, visibility, audience declaration, and applicable disclosure fields. TikTok needs current creator settings, explicit privacy choice, interaction controls, commercial disclosures, preview, and consent. A generic caption box alone is insufficient.

Drafts remain editable. Scheduling creates an immutable revision of each destination payload. Editing scheduled content validates and replaces the queued revision atomically. Once publishing begins, edits cannot mutate the in-flight payload. Published content can be duplicated; remote editing/deleting is outside the first release.

Use native keyboard-accessible controls. Rescheduling through the drawer is sufficient for the first release; drag-and-drop is a later enhancement. Pending saves, loading, empty calendars, disconnected accounts, and provider processing must have distinct states.

## Reuse from the current repositories

| Existing implementation | Proposed use | Required adaptation |
| --- | --- | --- |
| `components/scheduling/WeekSchedule.tsx` | Seven-day desktop layout and stacked mobile agenda pattern | It is coupled to shifts, leave, and workforce data. Reuse the presentation approach; extract a shared shell only if it actually simplifies both consumers. |
| `components/ui/calendar.tsx`, date/time pickers | Date navigation and schedule inputs | These are controls, not a complete event calendar. Build the post grid separately. |
| `components/shared/Drawer.tsx`, `DrawerSection.tsx` | Composer and post detail | Follow existing form and unsaved-change conventions. |
| `components/cms/DateTimeField.tsx`, `lib/utils/workspace-time.ts` | Workspace-time scheduling | Extract the date/time field from CMS-specific styling/helpers if needed; test ambiguous and missing DST times explicitly. |
| `components/cms/MediaPicker.tsx`, `VideoThumb.tsx` | Asset selection, upload, thumbnails | The picker uses CMS scope, permissions, and query keys. Add a deliberate adapter rather than importing it into an unrelated context. |
| `components/settings/connectors/registry.ts`, connector grid/wizard/rows | YouTube, Facebook, Instagram, TikTok setup | Extend the registry and status fetching; use account lists within each platform card. |
| `lib/auth/connector-access.ts`, module manifests | Module and capability gating | Register marketing consistently across CRM, API, DB, navigation, and role configuration. |
| API `lib/google-drive.ts`, `routes/notes.ts` | OAuth flow reference | Social grants are workspace-owned, unlike personal Drive connections. Use separate scopes and credentials, single-use state, and provider-specific refresh handling. |
| API `lib/outbox.ts`, `lib/cms-publishing.ts`, `lib/worker-health.ts` | Durable claiming and worker-health patterns | Build a social publisher with provider reconciliation; generic retry alone cannot prevent duplicate remote posts. |

For the first release, make marketing depend explicitly on CMS for media storage, alongside identity and organization. Reuse CMS asset ownership and quota enforcement, with a narrowly scoped media-access contract. Enabling marketing must explain and enable the CMS dependency; marketing editors should not automatically gain website publishing rights. A shared media module can be extracted later if other modules need it.

## Connectors and provider constraints

Present four platform connectors. Facebook and Instagram may share Meta infrastructure internally, but each account and destination must be clear to users. Default proposal: Facebook Login for Pages; Instagram Login for professional Instagram accounts, avoiding an unnecessary Page-link requirement. Validate the precise login/scopes/review path in the provider spike.

YouTube Video and YouTube Short use one YouTube connector. The upload API creates a video; Shorts classification depends on YouTube's format rules. Treat Short as a validation preset, not a separate upload endpoint. YouTube exposes `status.publishAt`; native scheduling can be added after cancellation and reconciliation semantics are implemented. The currently retrieved upload reference explicitly says unverified API projects are not restricted to private viewing; do not build against older assumptions. [Upload reference](https://developers.google.com/youtube/data/reference/rest/v3/videos/insert), [Shorts eligibility](https://support.google.com/youtube/answer/15424877?hl=en-GB).

Instagram publishing targets professional accounts. Login choice changes account linkage and permissions. Validate supported media and app access before promising a connection is ready. Meta's primary documentation fetch returned HTTP 429 during this review; its official Postman collection was accessible. [Meta Instagram collection](https://www.postman.com/meta/instagram/documentation/6yqw8pt/instagram-api).

Facebook scope is Pages. Recheck exact permissions, review requirements, and the separate feed/video/Reels upload flows during implementation; they were not fully verified in this planning pass. [Pages publishing documentation](https://developers.facebook.com/docs/pages-api/posts/).

TikTok Direct Post requires an audit for public posting, prescribes creator-info-driven UI and explicit consent, and excludes private utilities limited to accounts managed by the developer/team. DUMA's customer-facing use case therefore needs an eligibility review early. URL-based delivery also requires an eligible verified URL domain/prefix. If approval is unavailable, offer a clearly labelled manual publishing task with downloadable content; never present it as automatic delivery. [TikTok guidelines](https://developers.tiktok.com/docs/en/content-sharing-guidelines).

Provider apps, OAuth redirects, scopes, token lifecycle, account discovery, and review submissions are deployment dependencies. Credentials stay server-side. Connector readiness must distinguish missing DUMA configuration, missing authorization, unsupported account type, revoked access, and usable connection.

## Data model in duma-db

All entities carry tenant ownership; use tenant-aware foreign keys/constraints so a post cannot reference another workspace's account or media.

| Proposed table | Responsibility |
| --- | --- |
| `marketing_connections` | Provider OAuth grant, encrypted tokens/key version, scopes, expiry, connection state, connecting user. |
| `marketing_accounts` | Publishable channel/Page/profile linked to a grant; provider account ID, display metadata, capabilities, health. Account-specific credentials stay encrypted. |
| `marketing_posts` | Editorial identity, internal title, base caption, creator, draft revision, timestamps. |
| `marketing_post_targets` | Destination account, format, caption/options overrides, UTC schedule plus IANA timezone, immutable queued payload, lifecycle/version, provider IDs/URL. |
| `marketing_post_assets` | Ordered asset references with optional destination override, pinned asset version and validated media metadata. |
| `marketing_publish_attempts` | Target revision, attempt ID, lease/fencing token, upload session/container ID, sanitized error, next retry, timestamps. |

Unique account identity should be tenant + platform + provider account ID. Explicitly constrain duplicate targets for the same account/format in a post. Index pending targets by next action time. Retain media while queued or in flight; block deletion or require cancellation of dependent targets first.

Store per-target states: draft, scheduled, uploading, processing, published, failed, blocked, cancelled, and needs-reconciliation. Derive aggregate calendar status, including partially published, from targets rather than maintaining a conflicting parent status.

## API and publishing

Proposed `/v1/marketing` endpoints cover posts, targets, schedule/cancel/retry commands, accounts, OAuth start/callback/disconnect, and publishing history. Date-range queries use explicit UTC bounds derived from the workspace timezone; paginate history and drafts. Use optimistic version checks for concurrent edits and idempotency keys for schedule/publish commands.

Introduce `marketing:read`, `marketing:write`, `marketing:publish`, `marketing.connections:read`, and `marketing.connections:write`. Draft editors cannot publish or acquire that power by directly changing a status field. Every route, media lookup, callback, and worker lookup enforces tenant boundaries. Audit scheduling, cancellation, connection changes, and publish outcomes.

The backend runs a dedicated publisher; the browser need not remain open. Claim due work transactionally with row locks and a lease, then make network calls outside the transaction. Use lease heartbeats/fencing for long video uploads and compare target revision before acting. Recheck module enablement and connection readiness before external side effects.

Provider adapters expose account discovery, credential refresh, validation, upload/start, status reconciliation, and publish operations. Persist resumable upload sessions/container IDs before advancing stages. Do not assume providers share upload, scheduling, or retry semantics.

Successful upload is not successful publication: reconcile provider processing and final status before showing Published. On timeouts after a request might have succeeded, reconcile the known remote operation; if its outcome cannot be determined, require review instead of uploading again. Retry only errors known to be safe, with backoff and provider rate limits. Successful destinations are never resent when another destination fails.

Initially DUMA owns the schedule and starts provider work when due. Show the time as a requested publish time because video processing can delay visibility. A later YouTube-specific optimization can upload privately ahead of time and set native publishAt, with matching remote cancellation/rescheduling support. Container creation for other providers must respect expiration rather than uploading weeks in advance.

Cancellation atomically prevents unclaimed work. If a provider operation is already in flight, show cancellation pending or too late; never claim it was stopped when remote publication is uncertain. Disconnecting blocks queued destinations and purges/revokes credentials according to provider support while preserving history. Disabling the module stops new claims; already submitted remote work still needs reconciliation.

Persist UTC instants and the scheduling timezone. Reject nonexistent local times and ask for an explicit offset for ambiguous times. Changing workspace timezone must not silently move previously scheduled instants. After an outage, a proposed 15-minute lateness window allows automatic catch-up; older posts become Blocked for review. Make this policy visible and configurable before release.

Media uploads need size/type/quota enforcement, resumable delivery for large videos, and backend-verified format metadata. Retain originals and validate each destination rendition. Use controlled storage URLs valid throughout provider ingestion; arbitrary URLs must not become a server-side fetch proxy. Never log tokens or signed media URLs.

## Delivery sequence

1. **Provider feasibility and contracts.** Confirm whether this is customer-facing, register provider apps, prove account discovery and permitted publishing modes, record format rules/scopes, and start reviews. Decide the approved TikTok path. This can run alongside calendar work.
2. **Database and module foundation.** Add schema/migrations, manifests, capabilities, tenant constraints, and API types. Build/version the DB package before integrating its exports in the API; avoid unrelated dependency upgrades.
3. **Persistent calendar and composer.** Implement authenticated route/navigation, drafts, month/week/agenda, media integration, overrides, timezone validation, and connector setup states. No fake successful publish states.
4. **YouTube vertical slice.** OAuth → account selection → video/Short validation → scheduled worker → processing/result reconciliation → cancellation/retry handling.
5. **Meta destinations.** Add Facebook Pages and Instagram adapters, media flows, account-specific fields, and partial-failure behavior through the same calendar.
6. **TikTok.** Add the required creator-aware composer and approved delivery path; make manual tasks explicit if direct posting remains unavailable.
7. **Release readiness.** Verify token refresh/revocation, leases and crash recovery, storage retention, module disable behavior, provider limits, worker alerts, and operator recovery instructions. Roll out behind tenant module enablement.

Do not give a fixed completion estimate until the provider spike establishes account access and review dependencies. Calendar implementation and provider approval have different timelines.

## Validation and acceptance

Follow repository test policies: deterministic `node:test` business-logic tests calling production functions, without network/database dependencies. Cover tenant/permission decisions, DST gaps/overlaps, lifecycle transitions, stale revisions, safe retry decisions, partial outcomes, and cancellation rules. Do not add UI/browser/source-text tests.

Run CRM `pnpm check`, API `pnpm check`, and DB build/migration-chain validation for the final implementation. Unit tests alone do not prove transactions, cross-process leases, OAuth, or remote delivery; those require a separate controlled provider/release verification with authorized test accounts.

Acceptance scenarios:

- Schedule the same original video as a YouTube Short, Instagram Reel, Facebook Reel, and TikTok video with different captions/times.
- Leave the browser closed; the worker continues and records actual destination outcomes.
- Fail one destination; retain successful results and retry only eligible failed work.
- Refresh/disconnect an account without losing editorial drafts or exposing tokens.
- Reject another tenant's account/media and deny publishing to a draft-only editor.
- Reschedule concurrently with a worker claim without publishing an obsolete revision.
- Recover from a timeout after remote acceptance without blindly creating duplicates.
- Explain processing delays, missed schedules, manual TikTok tasks, and ambiguous provider outcomes honestly in the calendar.

## Decisions to confirm before implementation

Recommended defaults: customer-facing tenant module; multiple accounts per platform; explicit CMS media dependency; automatic posting wherever approved; manual fallback clearly distinguished; no approval workflow in v1. The most consequential unresolved question is whether this is exclusively for DUMA's own marketing or a feature for all DUMA customers, because that affects TikTok eligibility and rollout.

## Implementation status — 4 November 2026

The database, authenticated calendar, composer, connector screens, OAuth flows and
provider publisher have been implemented across the three repositories. New module
enablement is explicit. Existing website marketing edits were preserved.

Implementation choices and current limits:

- One encrypted connection row represents a publishable account. OAuth discovery
  can create several rows; this combines the proposed connections/accounts split.
- Marketing has its own media API over CMS storage, with separate permissions.
  The existing 25 MB file limit remains; large browser uploads are not included.
- Shared media/caption/time are applied to destination copies in the composer.
  A draft with no destinations retains its title and caption.
- Calendar and draft results are paginated; the calendar labels when it is showing
  a page of posts. Media results and the most recent 100 history events are bounded.
- Provider processing is polled. Ambiguous writes require explicit reconciliation;
  safe failed targets can be retried independently. No remote deletion or editing.
- TikTok Direct Post is feature-gated pending provider approval; there is no automated
  manual-reminder workflow. The UI explains that TikTok scheduling is unavailable
  while approval is pending.
- The 15-minute missed-schedule grace period is fixed in this release.
- Live provider behavior remains unverified without configured apps/accounts.

Operational configuration and release order: `duma-api/docs/marketing-deployment.md`.
The DB package must be released and the API dependency lock refreshed before deployment.
