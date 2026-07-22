# Phased Cleanup Foundation Report

Date: 2026-07-22 (Asia/Bangkok)

Baseline: `6e20ac9` (`chore: capture approved cleanup baseline`)

Verified implementation tip: `cd17c60` (`chore: remove unreferenced styles and assets`)

## Files Modified

- Documentation/configuration: `README.md`, `package.json`, `package-lock.json`, and the approved foundation plan.
- Runtime and server code: readiness route/checks, logging formatter, admin/auth/item/settings actions, item queries, MCP server/policy, and global CSS.
- Tests and UI cleanup: strict-typecheck fixtures, health/logging/admin/MCP/auth/item/location tests, and five UI components whose unused React bindings were removed.
- Net foundation diff from `6e20ac9` through `cd17c60`: 36 paths, 365 insertions, 183 deletions.

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
- Before/after: `service-role diagnostic` absence check -> recognized service-key-shaped fixture absence check.
- Impact: documentation/test intent only; no runtime change.
- Evidence: plan-only one-file diff; the eventual upload regression is included in the 210-test release pass.
- Rollback: `git revert ec7a2c1`

### `ef2cc05` — enforce strict project typecheck

- Original problem/reason: no dedicated strict unused-code gate existed and stricter compilation exposed stale React bindings plus test-fixture typing gaps.
- Before/after: no `typecheck` script -> `tsc --noEmit --noUnusedLocals --noUnusedParameters`; untyped fixtures/unused bindings -> typed fixtures/clean imports.
- Impact: release checks now reject unused locals/parameters without changing UI behavior.
- Evidence: current `npm run typecheck` PASS; full release suite 210/210 PASS.
- Rollback: `git revert ef2cc05`

### `d1c6434` — redact secrets from error logs

- Original problem/reason: structured payloads were sanitized but `error_message` and `error_stack` were serialized raw.
- Before/after: raw diagnostic assignment -> diagnostics passed through `sanitizeValue`.
- Impact: prevents recognized secrets in Error and non-Error diagnostics while keeping log keys/signature stable.
- Evidence: logging regressions and full 210-test release suite PASS.
- Rollback: `git revert d1c6434`

### `49c8570` — redact readiness diagnostics

- Original problem/reason: the public readiness endpoint could expose dependency error details.
- Before/after: serialize internal readiness object -> serialize `toPublicReadiness(result)` while status still uses `result.ready`.
- Impact: preserves operational status/latency with safe public errors.
- Evidence: readiness regression included in 210/210 PASS; live database readiness also PASS.
- Rollback: `git revert 49c8570`

### `a0595ff` — restrict admin database tables

- Original problem/reason: admin actions accepted arbitrary dynamic table names.
- Before/after: `.from(tableName)` -> allowlisted `safeTable` for read/write/delete.
- Impact: narrows privileged database access to registry tables without changing admin authorization order.
- Evidence: policy integration tests and 210/210 release suite PASS.
- Rollback: `git revert a0595ff`

### `def3f79` — make MCP writes explicit and validated

- Original problem/reason: MCP writes were discoverable by default and accepted loosely trusted arguments.
- Before/after: implicit write exposure/raw input -> explicit opt-in plus service-role capability and strict create/update parsing.
- Impact: default MCP surface is read-only and write inputs are bounded.
- Evidence: MCP policy tests and 210/210 release suite PASS.
- Rollback: `git revert def3f79`

### `755d579` — harden MCP write validation

- Original problem/reason: delete input, advertised JSON schemas, and audit-insert failure handling needed to match the strict runtime policy.
- Before/after: permissive delete/schema and unchecked audit result -> strict UUID delete parser, aligned schemas, checked audit result with fixed safe error.
- Impact: closes validation/schema gaps; does not make mutation plus audit atomic.
- Evidence: MCP parser/schema tests and 210/210 release suite PASS.
- Rollback: `git revert 755d579`

### `bdb0da0` — harden identity and upload diagnostics

- Original problem/reason: name login silently selected the first match and upload failures lacked structured safe diagnostics.
- Before/after: `limit(1)`/first email and swallowed upload exception -> `limit(2)`/exactly-one resolver and sanitized structured logging.
- Impact: deterministic non-enumerating name login and diagnosable upload failures with unchanged user copy.
- Evidence: auth/upload regressions and 210/210 release suite PASS.
- Rollback: `git revert bdb0da0`

### `1bb5702` — remove no-op reference cache API

- Original problem/reason: `clearReferencesCache` promised invalidation but did nothing, adding misleading calls/tests.
- Before/after: no-op export plus nine production/test references -> no export or references; real tag/path invalidation retained.
- Impact: removes misleading dead API without cache-behavior change.
- Evidence: zero-reference scan in task evidence; 210/210 release suite and smoke PASS.
- Rollback: `git revert 1bb5702`

### `37a6912` — remove unused form and table dependencies

- Original problem/reason: three direct runtime packages had no source/config/dynamic-import consumers; operational scripts used transitive `dotenv` undeclared.
- Before/after: unused form/table packages -> removed; implicit transitive dotenv -> direct dev dependency.
- Impact: five packages removed from the lockfile and script dependency ownership made explicit.
- Evidence: `npm ls --depth=0` PASS; typecheck/tests/lint/build/budget PASS.
- Rollback: `git revert 37a6912`

### `e4af54c` — pin dotenv to exact version

- Original problem/reason: the first dependency commit declared `^17.4.2`, contrary to the exact-version requirement.
- Before/after: `"dotenv": "^17.4.2"` -> `"dotenv": "17.4.2"` in manifest and lockfile root.
- Impact: deterministic direct version declaration without changing installed payload.
- Evidence: installed tree lists `dotenv@17.4.2`; complete release gate PASS.
- Rollback: `git revert e4af54c`

### `cd17c60` — remove unreferenced styles and assets

- Original problem/reason: three production CSS rules and five default SVGs had no application consumers.
- Before/after: unused selectors/assets present -> deleted after whole-repository reference scan.
- Impact: smaller maintenance/static-asset surface with no route behavior change.
- Evidence: lint/typecheck/build/budget PASS; fresh smoke PASS (1 passed, 1 skipped), resolving Task 9's prior environment-blocked verification.
- Rollback: `git revert cd17c60`

Rollback commits are listed individually because each change was designed for independent review. If reverting several dependent commits, revert newest-to-oldest and rerun the complete gate, smoke, and database readiness checks.
