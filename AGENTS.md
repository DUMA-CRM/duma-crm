<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Testing policy

- Test business logic only with `node:test` and `node:assert/strict` in `tests/unit/*.test.mts`.
- Call real production functions. Cover money, data integrity, permissions, and consequential rules or regressions.
- No UI/component/render/click tests, browser tests, smoke tests, snapshots, or source-text assertions.
- No coverage target; do not add tests for trivial helpers or merely because a file changed.
- Keep inputs deterministic, pass fixed time and explicit time zones where relevant, and avoid network/database/server dependencies.
- Use explicit relative `.ts` value imports for Node's native TypeScript execution; type-only aliases are fine.
- Run `pnpm test`; `pnpm check` additionally runs lint, typecheck, and build. Keep the suite small and aim for under 10 seconds excluding install/build.
