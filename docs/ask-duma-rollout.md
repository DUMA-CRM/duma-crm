# Ask DUMA rollout

## Release order

1. Build and publish a new `@duma-crm/db` package from the updated duma-db source. It exports `agentConversations` and `agentConversationTurns` and registers their module ownership.
2. Update duma-api's database package and lockfile to that published version. Local validation used a copy of the new DB build in the API's `node_modules`; the currently committed registry lockfile does not contain these new exports.
3. Apply duma-db migration `0082_agent_conversations` through the normal migration workflow. It creates two new tables and indexes; existing tables/data are unchanged.
4. Deploy duma-api, then duma-crm. The CRM's checked-in OpenAPI document includes the new endpoints.

No production migration, package publication, deployment or model request was performed during this change.

## Model configuration

Existing `GEMINI_API_KEY` and `OPENROUTER_API_KEY` remain server-only. Default order is Gemini, the configured OpenRouter primary, then NVIDIA Nemotron. Choosing OpenRouter promotes only that primary; NVIDIA remains last. The final fallback uses the same OpenRouter key and defaults to `nvidia/nemotron-3-super-120b-a12b:free`; override with `OPENROUTER_NVIDIA_MODEL`. `OPENROUTER_BACKUP_MODEL` is superseded by this explicit final fallback. Free models can be unavailable or rate-limited; this is a best-effort fallback, not guaranteed capacity.

Each model request has a 45-second deadline and an agent turn has a 150-second deadline. Stop/disconnection aborts model and tool requests. Partial text is cleared before a different provider starts. Raw upstream errors and private reasoning are not sent to the browser.

## Stored history and caching

History is private to a signed-in staff user, tenant, location context and current permission fingerprint. A changed role, scope, location grant or capability set hides old answers. Account, tenant or location deletion cascades into associated history. Users can delete individual conversations. The list shows the latest 50 conversations; opening a conversation reads its latest 100 complete turns.

A stored turn contains question, answer, model, evidence and a bounded presentation payload. Approval tokens and executable action cards are excluded. Reopening a proposed action requires a new draft and approval; completed action acknowledgements are recorded separately. Saves are idempotent within a conversation using request IDs. A history outage is visible, and new unsaved chats can still run in the current window.

Caching in this release is limited to duplicate reads and exact repeated read-tool calls within one turn. Shared response caching is intentionally not enabled for live operational data. Conversation IDs, owner scope, grant fingerprints and request IDs provide a foundation for later caching. Any future cross-turn cache must include authorization, location, answer detail, model/prompt version and source-data freshness; never replay writes or approval tokens from it.

## Suggested next improvements

- Add an agreed history retention period and an automated purge, including backups.
- Add answer feedback and an evaluation set for accuracy, useful next actions and repetition.
- Add per-model latency/failure monitoring and periodically verify free-model tool support.
- Add permission-scoped search over older conversations if 50 recent chats becomes limiting.

## Verification

DB migration/ownership tests, API build and tests, CRM lint/types/tests/build, and targeted provider/context tests were run locally. An isolated UI preview exercised desktop/mobile layout and answer-length controls without business data. Authenticated persistence, real provider fallbacks and write approvals still need a staging smoke test after the package and migration rollout.
