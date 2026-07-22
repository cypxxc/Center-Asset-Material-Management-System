# Registry-S Phased Cleanup Design

**Date:** 2026-07-22

**Status:** Approved approach; implementation pending
**Scope:** Whole-project cleanup, dead-code removal, maintainability, performance, and security hardening while preserving observable behavior

## Objective

Reduce unused and duplicated code, lower complexity, improve diagnostics and harden privileged paths without changing public routes, Server Action response shapes, database schema, RLS behavior, Thai UI copy, or critical user flows unless a separately reviewed change explicitly requires it.

The current working tree is the audit baseline. Existing modified and untracked files are user-owned and must not be reverted, overwritten, or accidentally included in cleanup commits.

## System Context

Registry-S is a Next.js 16 App Router application using React 19, strict TypeScript, Tailwind CSS v4, Supabase Auth/Postgres/Storage, and PostgreSQL RLS. Reads are primarily located in `features/*/queries.ts`; mutations are Server Actions in `features/*/actions.ts`. Authentication is refreshed by `proxy.ts`. Items use soft deletion and most normal queries exclude deleted, archived, or disposed records according to their current contract.

The project also contains operational scripts, ordered SQL migrations, a local MCP server, a custom Node test runner, Playwright E2E tests, and deployment/release checks. These are first-class consumers when determining whether code is unused.

## Design Principles

1. Preserve behavior before improving structure.
2. Establish characterization tests before medium-risk refactors.
3. Make small, independently verifiable batches.
4. Remove code only after static references, file-based routing, dynamic loading, scripts, tests, configuration, SQL, and external-contract risk have been checked.
5. Keep public exports when external use cannot be disproved; label them `possibly unused` instead of deleting them.
6. Do not delete or rewrite historical migrations.
7. Do not introduce abstractions unless they remove demonstrated duplication or isolate a security boundary.
8. Every implementation batch must document the original problem, before/after behavior, impact, tests, and rollback procedure.

## Explicit Non-Goals

- No redesign of the Thai UI or navigation.
- No route renaming or API response-format changes.
- No database schema redesign or migration squashing.
- No role-model changes (`admin > staff > viewer`).
- No replacement of Supabase, Next.js App Router, Tailwind, or the existing test stack.
- No major dependency upgrades as part of cleanup.
- No blanket application of memoization or generalized repository/service layers.
- No cleanup inside excluded `prototype/` or `.agent/` paths.

## Safety Gates

Before each batch:

- Record `git status --short` and preserve unrelated changes.
- Identify all direct and indirect references with `rg`, including tests, scripts, configuration, route conventions, SQL, and documentation where relevant.
- Read the applicable Next.js 16 guide under `node_modules/next/dist/docs/` before changing framework-sensitive code.
- For Supabase changes, confirm RLS, service-role use, and current platform guidance.
- Add characterization tests first when behavior is not already protected.

After each batch:

- Run the focused tests for changed behavior.
- Run `npm test` and `npm run lint`.
- Run a strict TypeScript check that covers tests and scripts.
- Run `npm run build` for framework/type/bundle verification.
- Run relevant Playwright critical journeys for UI, auth, routing, or action changes.
- Run database readiness checks for query, RPC, migration, or RLS-sensitive changes.
- Review the diff for API, copy, query-filter, and authorization drift.

## Phased Work

### Phase 1 — Characterization and Verification Baseline

Fix the current standalone TypeScript failures in release/admin-performance tests and remove unused React imports. Add or strengthen tests around:

- item creation through redirecting and inline Server Actions;
- metadata CRUD authorization and response behavior;
- health endpoint redaction;
- log sanitizer handling of error messages and stacks;
- MCP write-mode authorization and input validation;
- admin database table allowlisting;
- report export filters and output columns;
- cache invalidation behavior currently associated with `clearReferencesCache()`.

This phase must not intentionally change runtime behavior except to prevent sensitive diagnostic leakage where a failing test proves the issue.

### Phase 2 — Safe Cleanup and Dependency Hygiene

Remove only confirmed unreferenced items:

- unused local imports and variables;
- `.table-row-hover` and `.table-row-selected` CSS rules;
- default public SVG assets with no runtime, metadata, manifest, CSS, or documentation dependency;
- direct dependencies with no source, script, test, configuration, generated-code, or dynamic reference: `react-hook-form`, `@hookform/resolvers`, and `@tanstack/react-table`;
- the misleading no-op `clearReferencesCache()` and its call sites after cache tests confirm `revalidateTag`/`revalidatePath` are authoritative.

Declare `dotenv` directly as a development dependency unless the implementation plan selects and verifies one common existing environment loader for all scripts.

Files used only by tests or documentation, including skeleton components and report export actions, are not automatically removed. They require a separate contract decision.

### Phase 3 — Security and Error-Handling Hardening

Harden existing boundaries without changing successful response contracts:

- sanitize `Error.message`, non-Error text, and stack fields before log serialization;
- return generic readiness failure details publicly while logging diagnostic context server-side;
- add server-side table allowlists to privileged admin database operations;
- require an explicit MCP write capability before create/update/delete tools can run;
- validate MCP tool input using a shared schema and reject unknown/invalid write fields;
- preserve safe user-facing upload errors while logging the original storage error;
- make duplicate-name login deterministic and safe, preferably by rejecting ambiguity while preserving email and UUID login.

The in-memory rate limiter remains as the current fallback. Distributed rate limiting is isolated as a later operational change because it introduces infrastructure and deployment decisions.

### Phase 4 — Low-Risk Duplication Reduction

Extract pure functions before extracting stateful hooks or services:

- item filter and sort normalization shared by active/trash/report paths where semantics are identical;
- Excel column/value formatting shared by item and report exports;
- date and audit-label formatting when output is byte-for-byte equivalent;
- Supabase cookie adapter construction shared by anon/admin server clients if Next.js runtime behavior remains identical.

Each extraction must be guarded by unit tests that compare old and new outputs. Similar-looking logic with different archive/status, pagination, authorization, or response behavior must remain separate.

### Phase 5 — Server Mutation Consolidation

Create one private item-creation core responsible for validation, image lifecycle, insert, audit logging, metrics, and cache invalidation. Keep public wrappers unchanged:

- `createItem` continues returning field errors and redirecting on success;
- `createItemInline` continues returning its current `ActionResponse` and never redirects.

For category, location, and unit mutations, extract only the repeated authorization/error/audit/revalidation pipeline. Domain schemas, table allowlists, action names, messages, redirect behavior, and uniqueness handling remain explicit configuration rather than inferred dynamically.

### Phase 6 — Component Decomposition and Layer Alignment

Split oversized components along existing responsibilities without altering rendered structure:

- DB panel: controller/state, table viewer, SQL/import/export panels;
- item explorer: filter state, export operation, inspector, table/list presentation;
- item form: pure form sections and validation display;
- header/sidebar: navigation data and presentational sections.

Move direct page-level database reads such as the locations page into feature query modules. Pages remain Server Components and retain current parallel data-fetching behavior.

Visual changes are out of scope. DOM-sensitive changes require Playwright screenshots or assertions for the affected route.

### Phase 7 — Performance and Operational Follow-Ups

Handle higher-risk operational work separately:

- bounded or paginated backup/export generation;
- distributed rate limiting suitable for multiple serverless instances;
- query/index improvements supported by production-like query plans;
- bundle-budget headroom;
- dependency vulnerabilities lacking a compatible upstream fix.

These changes require individual designs because they can affect infrastructure, latency, file output, or deployment cost.

## Deletion Classification

### Confirmed Safe Candidates

- unused React imports reported by strict TypeScript;
- the two unreferenced table-row CSS classes;
- unused direct form/table dependencies after lockfile verification;
- no-op cache-clear function after characterization tests.

### Conditional Candidates

- `components/ui/filter-bar.tsx`;
- skeleton components used only by tests/docs;
- `features/reports/actions.ts` and its test-only export;
- `getRecentAuditLogs` and associated types;
- default SVG assets;
- deprecated tracing alias and unused public utility exports.

Conditional candidates are removed only when external/public-contract use is ruled out or explicitly accepted.

### Protected Artifacts

- all SQL migrations and seeds;
- route files and Next.js convention files;
- public Server Action names with uncertain external consumers;
- environment-variable names;
- RLS policies and service-role boundaries;
- test infrastructure discovered by the custom runner;
- dark/design tokens without visual-regression evidence.

## Commit and Rollback Strategy

Each phase is divided into small commits by concern. Unrelated baseline changes are never staged. A batch is rollback-safe when reverting its commit restores the previous implementation without requiring a database rollback or response-contract migration.

For each batch, the implementation report will include:

1. original problem and evidence;
2. reason for change;
3. focused before/after excerpts;
4. behavioral and operational impact;
5. executed verification and results;
6. exact rollback commit or files to restore.

If a batch fails verification, it is reverted or reduced before starting the next batch. Later phases do not depend on unverified refactors.

## Completion Criteria

The cleanup is complete when approved batches are implemented, no confirmed dead code remains in scope, strict TypeScript/lint/tests/build pass, critical auth/item/settings/trash/report/admin flows pass, database readiness remains healthy, and all conditional or deferred findings are documented with reasons rather than silently discarded.
