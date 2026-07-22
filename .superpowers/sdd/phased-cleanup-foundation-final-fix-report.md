# Final Whole-Branch Review Fixes

Date: 2026-07-22 (Asia/Bangkok)

## Findings and TDD evidence

### Important: readiness diagnostics

RED command:

`node --import tsx --test tests/unit/health.test.ts scripts/mcp-policy.test.ts scripts/mcp-server.test.ts tests/integration/create-item.test.ts`

Result: exit 1. The readiness regression failed because no structured diagnostic log was emitted. After adding route logging, the same assertion still failed because Supabase-style diagnostic objects were normalized to `[object Object]`, proving the original message could not reach the sanitizer.

GREEN: `timedCheck` now preserves an object diagnostic's `message`; the readiness route emits one structured error per failed dependency through the existing logger before creating the public response. The focused suite then passed 20/20. The test proves the operation and failed dependency are present, the formatter's redaction marker is emitted, the raw placeholder key is absent, and the public error remains `Dependency check failed` with HTTP 503.

### Minor: whitespace-only MCP credential

RED: the focused suite failed because whitespace-only `SUPABASE_SERVICE_ROLE_KEY` returned `true` when write opt-in was enabled.

GREEN: `isMcpWriteEnabled` trims the credential before checking it. The focused suite passed.

### Minor: assembled MCP stdio characterization

The new subprocess test passed against the existing assembled server surface, establishing characterization coverage rather than requiring a server refactor. It starts the TypeScript entrypoint with placeholder environment configuration, sends newline-delimited JSON-RPC over stdio, and verifies:

- read-only `tools/list` includes read tools and excludes write tools;
- enabled `tools/list` includes `create_item`, `update_item`, and `delete_item`;
- a disabled `create_item` call returns the existing JSON-RPC error envelope and message.

No tool performs a Supabase request in this test.

### Minor: upload diagnostic regression

The strengthened assertions passed against the existing structured logger behavior. In addition to excluding the raw placeholder key, the test now requires the sanitizer's `[KEY_REDACTED]` marker, `uploadItemImage` operation, and upload failure context. The Thai public upload message remains unchanged.

## Commands and results

- Focused RED: exit 1; 18 passed, 2 failed for readiness logging and whitespace-only MCP credentials. The newly added stdio and strengthened upload tests passed.
- Focused intermediate GREEN: exit 1; 19 passed, 1 failed because the Supabase diagnostic object message was not preserved.
- Focused final GREEN: `node --import tsx --test tests/unit/health.test.ts scripts/mcp-policy.test.ts scripts/mcp-server.test.ts tests/integration/create-item.test.ts` — exit 0; 20 passed, 0 failed.
- `npm run typecheck` — exit 0.
- `npm run lint` — exit 0.
- `npm test` — exit 0; 55 test files, 211 passed, 0 failed.
- `npm run build` — exit 0; Next.js 16.2.11 compiled, TypeScript and static generation passed, and all raw/gzip bundle budgets passed. It emitted the existing warning about multiple lockfiles and inferred workspace root.
- `git diff --check` — exit 0; no whitespace errors (line-ending conversion notices only).

## Files

- `app/api/health/readiness/route.ts`
- `lib/health/checks.ts`
- `scripts/mcp-policy.ts`
- `scripts/mcp-policy.test.ts`
- `scripts/mcp-server.test.ts`
- `tests/unit/health.test.ts`
- `tests/integration/create-item.test.ts`
- `.superpowers/sdd/final-fix-report.md`

## Scope checks and concerns

- Public readiness status, shape, and generic dependency error are unchanged.
- MCP tool names, JSON-RPC envelope, routes, actions, RLS, and database schema are unchanged.
- No transactional MCP RPC or broad MCP server extraction/refactor was introduced.
- The subprocess harness uses only placeholder environment configuration and does not connect to live Supabase.
- No environment values are recorded in this report or asserted into diagnostic output.
- Concern: the build continues to warn about multiple lockfiles/workspace-root inference; this predates and is outside the review findings.
