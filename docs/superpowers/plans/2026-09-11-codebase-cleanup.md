# Codebase Cleanup Implementation Plan

**Goal:** Reduce demonstrated maintenance debt without changing intended business behavior.

**Architecture:** Preserve Next.js entry points, existing feature query/action boundaries, RLS, validation, and auditing. Make small mechanical changes on top of the user's existing working tree; retain uncertain candidates.

**Tech Stack:** Next.js 16.2.11, React 19, TypeScript, Supabase/PostgreSQL, Node 24.

**Spec:** User's attached full codebase cleanup request, 2026-09-11.

## Global constraints

- Preserve existing uncommitted changes (baseline patch recorded under ignored `.cache/cleanup`).
- No schema edits, database mutations, migration deletion, credential output, or speculative performance claims.
- Trace imports, dynamic references, tests, scripts, CSS, and framework conventions before removal.
- Keep distinct permission rules explicit; retain server validation and runtime entry points.

## Audit findings and batches (presented before production edits)

- P0: No confirmed critical defect in reviewed paths; static review is not proof of production security.
- P1: Test discovery misses `components/ui/image-crop-dialog.test.tsx`. ESLint and TypeScript include ignored scratch artifacts. Generated route types refer to deleted routes. `ws` is directly imported by the server but classified as development-only.
- P2: Chart compatibility aliases and `traceAction` wrapper have no consumers. Sticker configuration, geometry, rendering, and dialog state share one 1,347-line file.
- P2 retained: Server Action exports with no current callers; positional Excel compatibility API; duplicated metadata mutations; broad admin response shapes, raw database errors, unchecked audit insert errors; caller-dependent admin query authorization; unbounded depreciation report; fallbacks supporting deployed database versions.
- P3: README mentions Turbopack despite webpack scripts, pdfmake despite a custom PDF implementation, a nonexistent `/api/health` route, removed asset-number automation, and machine-specific documentation links.

### Batch 1: Verification tooling

- [x] Regression-test discovery across all supported source roots, including colocated components; ensure E2E remains separate.
- [x] Export `findTestFiles(projectRoot = root)` and include component `.test.ts` / `.test.tsx` patterns; preserve timeout and isolated test processes.
- [x] Exclude ignored `scratch` from lint/typecheck. Remove one unused React import from the pre-existing mobile-navigation test, preserving its assertions.
- [x] Generate route types using documented `next typegen`; preserve compiler strictness and checks of all production/test sources.
- [x] Validate runner tests, colocated image-crop tests, lint, and typecheck.

### Batch 2: Demonstrably dead code

- [x] Remove `RadarCategoryItem`, `CategoryComboItem`, and `CategoryRadarChart` aliases from the chart file; no callers in tracked source, configs, tests, scripts, routes, SQL, or dynamic imports.
- [x] Remove unused `traceAction` and its exclusive `isApplicationError` import; keep `beginActionTrace` and result classification used by active code/tests.
- [x] Validate chart, tracing, metrics, and error-handler tests plus lint/typecheck.

### Batch 3: Sticker responsibilities

- [x] Extract custom grid types, geometry, typography, and presets to `components/ui/asset-tag-layout.ts` without altering values or calculations.
- [x] Update modal and geometry test imports directly; keep modal data/interaction types and printable rendering in place.
- [x] Validate all existing sticker tests, including sheet layout, QR/barcodes, margins, and cut lines.

### Batch 4: Dependencies and documentation

- [x] Move `ws` to production dependencies at the identical version range; regenerate lockfile with npm and verify installation/dependency tree/audit.
- [x] Retain shadcn (CSS import), testing-library DOM peer dependency, automatic TypeScript types, and framework dependencies.
- [x] Correct README statements and publish audit decisions, changes, commands/results, limitations, and risk in `docs/cleanup/README.md`.
- [x] Run typecheck, lint, full tests/coverage, build/budget, environment, security, migration tests, read-only DB readiness, Playwright smoke/E2E, and release prerequisite verification. Do not run migration application, restore, or destructive authenticated journeys against an unidentified database.

## Execution notes

Dependency audit identified critical advisories in the original Next.js pin. Batch 4 expanded to pin Next.js/eslint-config-next 16.3.4 and apply compatible security lockfile updates; clean install and audit passed. See ../../cleanup/README.md for exact outcomes and authenticated release prerequisites.
