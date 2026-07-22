# Phased Cleanup Foundation Report

Date: 2026-07-22 (Asia/Bangkok)

Baseline: `6e20ac9` (`chore: capture approved cleanup baseline`)

Verified implementation tip: `cd17c60` (`chore: remove unreferenced styles and assets`)

## Files Modified

Exact non-deleted paths from `git diff --name-status 6e20ac9..cd17c60`:

- `M README.md` — documents MCP write opt-in and service-role requirements.
- `M app/api/health/readiness/route.ts` — emits the public readiness projection.
- `M app/globals.css` — removes unreferenced table-row rules.
- `M components/ui/loading-overlay.tsx` — removes an unused React import.
- `M components/ui/loading-spinner.tsx` — removes an unused React import.
- `M components/ui/skeleton-card.tsx` — removes an unused React import.
- `M components/ui/skeleton-table.tsx` — removes an unused React import.
- `M components/ui/zoomable-image.tsx` — removes an unused default React binding.
- `M docs/superpowers/plans/2026-07-22-phased-cleanup-foundation.md` — corrects the upload-redaction fixture specification.
- `M features/admin/actions.ts` — applies the table allowlist and removes no-op cache calls.
- `A features/admin/table-policy.ts` — defines the registry admin-table allowlist.
- `M features/auth/actions.ts` — requires a unique profile match for name login.
- `A features/auth/login-identifier.test.ts` — covers unique and ambiguous profile matches.
- `A features/auth/login-identifier.ts` — resolves exactly one profile email.
- `M features/items/actions.ts` — logs upload failures safely and removes a no-op cache call.
- `M features/items/queries.ts` — removes the no-op cache API.
- `M features/settings/actions.ts` — removes a no-op cache import/call.
- `M lib/health/checks.ts` — adds the public readiness projection.
- `M lib/logging/formatter.ts` — sanitizes error diagnostics.
- `M package-lock.json` — removes unused packages and records exact `dotenv` ownership.
- `M package.json` — adds strict typecheck, removes unused dependencies, and pins `dotenv`.
- `A scripts/mcp-policy.test.ts` — covers MCP capability and argument policy.
- `A scripts/mcp-policy.ts` — implements MCP capability and strict parsers.
- `M scripts/mcp-server.ts` — defaults writes off and applies validated inputs/safe audit errors.
- `M scripts/release-e2e.test.ts` — gives environment fixtures the correct process-environment type.
- `M tests/integration/admin-performance.test.ts` — stabilizes the backup result fixture type.
- `A tests/integration/admin-table-policy.test.ts` — covers permitted and rejected admin tables.
- `M tests/integration/create-item.test.ts` — covers safe upload-failure diagnostics.
- `M tests/integration/locations.test.ts` — removes the behaviorless cache test.
- `M tests/unit/health.test.ts` — verifies public readiness redaction.
- `M tests/unit/logging.test.ts` — verifies diagnostic sanitization.

Reconciliation: 31 modified/added paths above plus the 5 deleted assets below equals the 36-path implementation diff. `git diff --stat 6e20ac9..cd17c60` reports 365 insertions and 183 deletions. The Task 10 report itself is not counted because it was created after the verified implementation tip in report-only commit `b0bd496`.

## Files Deleted

- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`

All five were default assets with no production reference. No migration, generated database artifact, or application feature file was deleted.

## Dependencies Removed or Added

- Removed direct runtime dependencies: `@hookform/resolvers`, `@tanstack/react-table`, and `react-hook-form`.
- Lockfile cleanup also removed their now-unused transitive packages `@standard-schema/utils` and `@tanstack/table-core`.
- Added `dotenv` as an exact development dependency at `17.4.2`; it was already resolved transitively and is used by operational TypeScript scripts.
- `npm ls --depth=0` passed at release verification time; the installed direct tree is valid.

## Security Issues Fixed

- Error messages and stacks now use the existing recursive sanitizer, preventing supported token/key patterns from escaping through diagnostics.
- Public readiness responses retain status and latency but replace internal dependency failure details with `Dependency check failed`.
- Admin database actions now reject tables outside the registry allowlist after admin authorization and before dynamic Supabase access.
- MCP item writes are read-only by default, require explicit opt-in plus the service-role capability, use strict Zod validation, and advertise schemas aligned with runtime validation.
- Name-based login now accepts exactly one matching profile email, avoiding ambiguous first-match authentication behavior.
- Image-upload failures now use structured sanitized logging while preserving the existing Thai user-facing error.

The release audit still reports upstream advisories; they are recorded under Deferred Findings and Risks and are not claimed as fixed.

## Dead Code Removed

- Removed the behaviorless `clearReferencesCache` export, all imports/calls, and its no-op test. Effective `revalidateTag`, sidebar, and path invalidation remain.
- Removed five unused React imports/default bindings.
- Removed unused table/form packages, three unreferenced table-row CSS rules, and five unreferenced default SVG assets.

## Behavior Preserved

- Existing public action signatures, Thai UI/error copy, authorization ordering, RLS-respecting client usage, audit payloads, metadata/sidebar cache invalidation, and item image lifecycle remain unchanged.
- Readiness still returns HTTP 200/503 from the internal readiness result; only public diagnostic text is projected.
- MCP tool names and response envelopes remain stable when writes are enabled; read and revalidation tools remain available in default read-only mode.
- Name login retains the same generic invalid-credentials response for absent, email-less, or ambiguous profiles.
- Production reference scans found no consumers for the deleted CSS/assets or removed dependencies.

## Verification Results

### Complete local gate

Command (run through `cmd /c` because the installed Windows PowerShell parser rejects `&&` before execution):

```text
npm run verify-env && npm run typecheck && npm test && npm run lint && npm run build
```

Result: **PASS**, exit 0 in 68.9 seconds.

- Environment validation: PASS; required values were set and validated. No values were printed or staged.
- Strict TypeScript: PASS with `--noUnusedLocals --noUnusedParameters`.
- Tests: 54 files; 210 tests, 3 suites, 210 passed, 0 failed, 0 cancelled, 0 skipped, 0 todo; `duration_ms 32409.7769`.
- ESLint: PASS with no findings.
- Next.js 16.2.11 production build: PASS.
- Bundle budget values, verbatim:
  - `Shared runtime JS (raw): 446.22 KB / 450.00 KB`
  - `Shared runtime JS (gzip transfer): 129.89 KB / 150.00 KB`
  - `Dashboard route JS (raw): 131.38 KB / 160.00 KB`
  - `Dashboard route JS (gzip transfer): 37.78 KB / 50.00 KB`
  - `Polyfill JS: 109.96 KB (reported separately; loaded only when needed by the browser)`

### Browser verification

- `npm run test:smoke`: **PASS**, exit 0. Its nested build and budget gate passed; Playwright reported 1 passed and 1 skipped in 1.4 seconds. The skipped authenticated new-item-dialog case is expected without real-auth credentials. This fresh run resolves Task 9's earlier missing-Supabase-environment gap: the unauthenticated redirect scenario now executes successfully against the configured server.
- `npm run test:e2e:release`: **NOT RUN — credentials not configured**. `CAMMS_E2E_REAL_AUTH`, `CAMMS_E2E_ADMIN_ID`, and `CAMMS_E2E_ADMIN_PASSWORD` were checked without printing values and were absent.

### Database readiness

- `npm run verify-db-release`: **PASS**, exit 0. Output: `Database release readiness passed: migrations, RLS, and RPC grants are safe.` No migration was applied and no schema was changed.

### Dependency and security diagnostics

- `npm audit --omit=dev --audit-level=high`: **NONZERO**, exit 1. Actual result: 5 vulnerabilities (3 moderate, 2 high). See deferred advisories below. No audit fix or force operation was run.
- `npm ls --depth=0`: **PASS**, exit 0; dependency tree valid.

## Deferred Findings and Risks

- MCP item mutation and audit insertion are separate Supabase calls. A mutation may succeed before an audit insert fails; transactional/atomic RPC consolidation is deferred.
- The upload diagnostic regression proves the secret fixture is absent, but does not positively assert that the expected redaction marker is present. This is a minor test-strength gap, not observed leakage.
- Authenticated release E2E is unverified because real-auth variables are not configured. The smoke suite therefore skipped its authenticated new-item-dialog scenario.
- `npm audit` reports 5 production-tree advisories: 3 moderate through `shadcn` -> `@modelcontextprotocol/sdk` -> `@hono/node-server` (encoded-backslash Windows path traversal), and 2 high through `next` -> `sharp`/libvips. npm offers only `--force` remediations that would install breaking/downgraded major versions (`shadcn@3.8.3` or `next@14.2.35`); these upstream advisories remain for the separately approved operations plan.
- Next.js warns that the nested worktree and main checkout both contain lockfiles, so it infers `D:\registry-s` as the workspace root. It emitted both Turbopack-root and output-file-tracing-root warnings; builds and smoke still passed.
- Shared runtime raw JS has 3.78 KB of configured headroom (446.22 KB / 450.00 KB). Further bundle growth is an operational risk despite the current pass.
- Database readiness verified ledger/policies/grants/capabilities against the configured database without mutation, but did not execute migration application or destructive/write probes.

## Rollback Commits

Each entry records the original problem, reason, concise before/after, impact, evidence, and independent rollback command.

### `ec7a2c1` — align upload redaction fixture

- Original problem/reason: the plan used a generic phrase that did not exercise the sanitizer's real service-key pattern; the test specification needed an actual recognized pattern.
- Literal before/after (the fake key body is intentionally elided here): `line.includes('service-role')` -> `line.includes('sbp_[test fixture redacted]')`.
- Impact: documentation/test intent only; no runtime change.
- Evidence: plan-only one-file diff; the eventual upload regression is included in the 210-test release pass.
- Rollback: `git revert ec7a2c1`

### `ef2cc05` — enforce strict project typecheck

- Original problem/reason: no dedicated strict unused-code gate existed and stricter compilation exposed stale React bindings plus test-fixture typing gaps.
- Literal before/after: no `"typecheck"` manifest entry -> `"typecheck": "tsc --noEmit --noUnusedLocals --noUnusedParameters"`; `import React, { useState, useEffect } from 'react'` -> `import { useState, useEffect } from 'react'`.
- Impact: release checks now reject unused locals/parameters without changing UI behavior.
- Evidence: focused fixture command passed 8/8; current `npm run typecheck` and full release suite 210/210 PASS.
- Rollback: `git revert ef2cc05`

### `d1c6434` — redact secrets from error logs

- Original problem/reason: structured payloads were sanitized but `error_message` and `error_stack` were serialized raw.
- Literal before/after: `error_message: errorObj ? errorObj.message : err ? String(err) : undefined` -> `error_message: errorMessage`, where `const errorMessage = sanitizeValue(rawErrorMessage) as string | undefined`.
- Impact: prevents recognized secrets in Error and non-Error diagnostics while keeping log keys/signature stable.
- Evidence: `node --import tsx --test tests/unit/logging.test.ts` passed 6/6 after the fix; full release suite 210/210 PASS.
- Rollback: `git revert d1c6434`

### `49c8570` — redact readiness diagnostics

- Original problem/reason: the public readiness endpoint could expose dependency error details.
- Literal before/after: `NextResponse.json(result, { status: result.ready ? 200 : 503 })` -> `NextResponse.json(publicResult, { status: result.ready ? 200 : 503 })`, with `const publicResult = toPublicReadiness(result)`.
- Impact: preserves operational status/latency with safe public errors.
- Evidence: `node --import tsx --test tests/unit/health.test.ts` passed 8/8 after the fix; full suite and live database readiness PASS.
- Rollback: `git revert 49c8570`

### `a0595ff` — restrict admin database tables

- Original problem/reason: admin actions accepted arbitrary dynamic table names.
- Literal before/after: `.from(tableName)` -> `const safeTable = assertAdminTable(tableName, 'read')` followed by `.from(safeTable)` (equivalent policy calls use `'write'` and `'delete'`).
- Impact: narrows privileged database access to registry tables without changing admin authorization order.
- Evidence: focused admin policy/performance command passed 3/3; full release suite 210/210 PASS.
- Rollback: `git revert a0595ff`

### `def3f79` — make MCP writes explicit and validated

- Original problem/reason: MCP writes were discoverable by default and accepted loosely trusted arguments.
- Literal before/after: `const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''` -> `const writeEnabled = isMcpWriteEnabled(process.env)` and `const supabaseKey = writeEnabled ? process.env.SUPABASE_SERVICE_ROLE_KEY || '' : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''`; `const payload = pickItemFields(args)` -> `const parsed = parseMcpCreateItem(args)` followed by `const payload = pickItemFields(parsed)`.
- Impact: default MCP surface is read-only and write inputs are bounded.
- Evidence: focused MCP policy command passed its initial 3/3 cases; full release suite 210/210 PASS.
- Rollback: `git revert def3f79`

### `755d579` — harden MCP write validation

- Original problem/reason: delete input, advertised JSON schemas, and audit-insert failure handling needed to match the strict runtime policy.
- Literal before/after: `const id = z.uuid().parse(args?.id)` -> `const { id } = parseMcpDeleteItem(args)`; `await supabase.from('audit_logs').insert(...)` -> `const { error } = await supabase.from('audit_logs').insert(...)` followed by `throw new Error('Failed to write MCP audit log')` on error.
- Impact: closes validation/schema gaps; does not make mutation plus audit atomic.
- Evidence: `node --import tsx --test scripts/mcp-policy.test.ts` passed 5/5 after review fixes; full release suite 210/210 PASS.
- Rollback: `git revert 755d579`

### `bdb0da0` — harden identity and upload diagnostics

- Original problem/reason: name login silently selected the first match and upload failures lacked structured safe diagnostics.
- Literal before/after: `.limit(1)` and `email = profiles[0].email as string` -> `.limit(2)`, `const profileEmail = resolveUniqueProfileEmail(profiles ?? [])`, and `email = profileEmail`; `} catch {` -> `} catch (error) {` followed by `logger.error({ operation: 'uploadItemImage', feature: 'items', details: 'Failed to process or upload item image' }, error)`.
- Impact: deterministic non-enumerating name login and diagnosable upload failures with unchanged user copy.
- Evidence: focused auth/upload tests passed 8/8; full release suite 210/210 PASS.
- Rollback: `git revert bdb0da0`

### `1bb5702` — remove no-op reference cache API

- Original problem/reason: `clearReferencesCache` promised invalidation but did nothing, adding misleading calls/tests.
- Literal before/after: `export function clearReferencesCache() { // no-op, cache is managed via Next.js revalidateTag }` and `clearReferencesCache()` call sites -> those declarations/imports/calls absent, while adjacent `revalidateSidebarCache()` remains.
- Impact: removes misleading dead API without cache-behavior change.
- Evidence: focused integration command passed 24/24 and the post-change reference scan returned zero matches; release suite and smoke PASS.
- Rollback: `git revert 1bb5702`

### `37a6912` — remove unused form and table dependencies

- Original problem/reason: three direct runtime packages had no source/config/dynamic-import consumers; operational scripts used transitive `dotenv` undeclared.
- Literal before/after: `"@hookform/resolvers": "^5.4.0"`, `"@tanstack/react-table": "^8.21.3"`, and `"react-hook-form": "^7.82.0"` -> entries absent; no direct `dotenv` entry -> `"dotenv": "^17.4.2"` (made exact by the next commit).
- Impact: five packages removed from the lockfile and script dependency ownership made explicit.
- Evidence: task verification found 54 files and 210/210 tests; `npm ls`, typecheck, lint, build, and budget PASS.
- Rollback: `git revert 37a6912`

### `e4af54c` — pin dotenv to exact version

- Original problem/reason: the first dependency commit declared `^17.4.2`, contrary to the exact-version requirement.
- Literal before/after: `"dotenv": "^17.4.2"` -> `"dotenv": "17.4.2"` in both `package.json` and the lockfile root.
- Impact: deterministic direct version declaration without changing installed payload.
- Evidence: direct manifest/lockfile assertions and `npm ls dotenv --depth=0` passed; task suite 210/210 and complete release gate PASS.
- Rollback: `git revert e4af54c`

### `cd17c60` — remove unreferenced styles and assets

- Original problem/reason: three production CSS rules and five default SVGs had no application consumers.
- Literal before/after: `.table-row-hover { transition: all 0.2s ease; }` and `.table-row-selected { background-color: #eff6ff; border-color: #bfdbfe; }` -> rules absent; `public/file.svg` (and four peer default SVG files) -> paths absent.
- Impact: smaller maintenance/static-asset surface with no route behavior change.
- Evidence: lint/typecheck/build/budget PASS; fresh smoke PASS (1 passed, 1 skipped), resolving Task 9's prior environment-blocked verification.
- Rollback: `git revert cd17c60`

Rollback commits are listed individually because each change was designed for independent review. If reverting several dependent commits, revert newest-to-oldest and rerun the complete gate, smoke, and database readiness checks.
