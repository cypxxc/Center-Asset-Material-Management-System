# Repository File Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove only repository files, exports, dependencies, and local generated artifacts proven unnecessary while preserving every runtime route, API contract, database contract, authorization boundary, and user-visible behavior.

**Architecture:** Cleanup proceeds in small independently verifiable groups: ignored local outputs, completed development evidence, unused leaf UI/utilities, one obsolete server action/query surface, obsolete tooling/dependencies, and documentation/ignore hygiene. Static imports, dynamic imports, string references, Next.js file conventions, package scripts, CI, tests, documentation, and database policies are checked before each deletion.

**Tech Stack:** Next.js 16.2.11 App Router, React 19.2.8, TypeScript strict, Supabase, Tailwind CSS 4, ESLint 9, Node test runner through `tsx`, Playwright, npm 11 on Node 24.

## Global Constraints

- Read the relevant installed Next.js guide under `node_modules/next/dist/docs/` before judging any convention-based file.
- Do not delete `.env*`, migrations, `db/seed.sql`, authentication/authorization files, routes, APIs, deployment files, CI, public framework assets, or external contracts without direct evidence.
- Preserve the tracked `prototype/` tree because it remains a documented design reference and is excluded from application compilation.
- Preserve `scripts/seed-50-items.ts`, `scripts/seed-100-items.ts`, and `scripts/lookup-refs.ts` pending operator confirmation.
- Never execute database seed or migration scripts during cleanup verification.
- Use `apply_patch` for tracked file edits and deletions; validate absolute paths before removing generated directories.
- Run focused verification after every tracked cleanup group and full verification before completion.

---

### Task 1: Remove local generated and temporary artifacts

**Files:**
- Remove locally: `.next/`, `node_modules/`, `prototype/node_modules/`, `prototype/dist/`, `test-results/`, `tsconfig.tsbuildinfo`, `next-env.d.ts`, empty stale `.worktrees/` children
- Preserve: `.env`, `.env.local`, tracked `prototype/**`, tracked `.superpowers/**` until Task 2

**Interfaces:**
- Consumes: root and prototype `.gitignore` rules
- Produces: a source-only local workspace; dependencies are restored by `npm ci` for verification

- [ ] **Step 1: Record baseline counts and sizes**

Run: `git ls-files | Measure-Object` and size the listed generated paths.

Expected: 319 tracked files before cleanup; generated directories are ignored by Git.

- [ ] **Step 2: Verify every removal target is ignored or untracked**

Run: `git check-ignore -v` for representative files and `git ls-files -- <target>` for each path.

Expected: no tracked file exists in the generated targets.

- [ ] **Step 3: Remove only validated local targets**

Resolve each absolute target and require it to be inside `D:\registry-s` before recursive removal. Do not remove `.env*`.

- [ ] **Step 4: Restore dependencies for later verification**

Run: `npm ci`

Expected: exit 0 using `package-lock.json`.

---

### Task 2: Remove completed AI and cleanup evidence

**Files:**
- Delete: `.superpowers/sdd/final-fix-report.md`
- Delete: `.superpowers/sdd/phased-cleanup-foundation-final-fix-report.md`
- Delete: `docs/superpowers/plans/2026-07-22-phased-cleanup-foundation.md`
- Delete: `docs/superpowers/plans/2026-07-22-phased-cleanup-foundation-report.md`
- Delete: `docs/superpowers/plans/2026-07-22-phased-cleanup-item-mutations.md`
- Delete: `docs/superpowers/plans/2026-07-22-phased-cleanup-item-mutations-report.md`

**Interfaces:**
- Consumes: completed merge history (`f77be83`, `0a5967b`) retained in Git
- Produces: no runtime or build interface; removes development-only evidence already represented by commits/tests

- [ ] **Step 1: Re-run reference search**

Run: `rg -n "phased-cleanup-(foundation|item-mutations)|final-fix-report" --hidden -g '!.git/**' -g '!node_modules/**' -g '!.next/**' .`

Expected: references are internal to the candidate plan/report set only.

- [ ] **Step 2: Delete the six tracked evidence files with `apply_patch`**

Expected: `git diff --name-status` shows exactly six deletions.

- [ ] **Step 3: Verify documentation links**

Run: `rg -n "2026-07-22-phased-cleanup|\.superpowers/sdd" --hidden -g '!.git/**' .`

Expected: no active README, AGENTS, CI, package script, or deployment reference is broken.

- [ ] **Step 4: Commit the evidence cleanup**

Run: `git add -- .superpowers/sdd docs/superpowers/plans && git commit -m "chore: remove completed cleanup evidence"`

---

### Task 3: Remove unused leaf UI components and exports

**Files:**
- Delete: `components/ui/filter-bar.tsx`
- Delete: `components/ui/skeleton-card.tsx`
- Delete: `components/ui/skeleton-table.tsx`
- Modify: `components/ui/page-container.tsx` (remove `PageSection`, `PageToolbar`, and their prop types only)
- Modify: `components/ui/form/index.tsx` (remove `FormHint`, `FormDivider`, and `FormHintProps` only)
- Modify: `tests/component/skeletons.test.tsx`
- Modify: `tests/component/page-wrappers.test.tsx`
- Modify: `tests/component/form.test.tsx`

**Interfaces:**
- Consumes: repository-wide symbol/reference audit
- Produces: narrower internal UI surface with all production consumers unchanged

- [ ] **Step 1: Re-run production reference searches**

Run `rg` for `FilterBar`, `SkeletonCard`, `SkeletonTable`, `PageSection`, `PageToolbar`, `FormHint`, and `FormDivider`, excluding their defining files and tests.

Expected: zero production, dynamic-import, config, or route references.

- [ ] **Step 2: Remove definitions and tests with `apply_patch`**

Keep `PageContainer`, active form controls, `LoadingSpinner`, and `LoadingOverlay` unchanged.

- [ ] **Step 3: Run focused component tests and typecheck**

Run: `node --import tsx --test tests/component/page-wrappers.test.tsx tests/component/form.test.tsx` then `npm run typecheck`.

Expected: all remaining tests pass and TypeScript reports no errors.

- [ ] **Step 4: Commit the UI cleanup**

Run: `git add -- components/ui tests/component && git commit -m "refactor: remove unused ui surfaces"`

---

### Task 4: Remove unused report and utility surfaces

**Files:**
- Delete: `features/reports/actions.ts`
- Modify: `features/reports/queries.ts` (remove `getRecentAuditLogs` and `RecentAuditLog` only)
- Modify: `tests/integration/reports.test.ts` (remove tests that exist only for the deleted action)
- Modify: `features/items/schema.ts` (remove `ItemFormInput` only)
- Delete: `lib/date/format-date.ts`
- Delete: `lib/date/relative-date.ts`
- Modify: `lib/date/format-date-time.ts` (remove `formatTime` only)
- Modify: `lib/date/index.ts` (remove deleted exports)
- Modify: `tests/unit/date.test.ts`
- Modify: `lib/unicode.ts` (remove `isUnicodeWhitespace` only)
- Delete: `lib/logging/trace.ts`
- Modify: relevant logging barrel export for `generateTraceId`

**Interfaces:**
- Consumes: production code uses `features/items/actions.ts#getItemsForExport`, `getReportStats`, `getReportItemsList`, and `formatDateTime`
- Produces: no public route or response change

- [ ] **Step 1: Confirm all symbols are declaration/test-only**

Search static imports, dynamic imports, string references, tests, configs, and docs for each symbol and file path.

Expected: no production caller for the deletion list; keep uncertain `traceAction` and `normalizeForCompare`.

- [ ] **Step 2: Remove leaf files/exports and dependent test-only cases**

Use `apply_patch`; do not change report page queries, export response shape, or date-time formatting.

- [ ] **Step 3: Run focused tests**

Run: `node --import tsx --test tests/integration/reports.test.ts tests/unit/date.test.ts lib/unicode.test.ts tests/unit/logging.test.ts tests/unit/tracing.test.ts`

Expected: all remaining tests pass.

- [ ] **Step 4: Run typecheck and commit**

Run: `npm run typecheck`, then commit as `refactor: remove unused report and utility surfaces`.

---

### Task 5: Remove obsolete seed runner and preserve required WebSocket dependencies

**Files:**
- Delete: `scripts/apply-seed.ts`
- Preserve: `package.json` entries `ws` and `@types/ws`
- Preserve: `package-lock.json`

**Interfaces:**
- Consumes: current `exec_admin_sql` service-role-only policy in migrations 00027/00028/00030
- Produces: unchanged supported migration, `db/seed.sql`, and Supabase Realtime transport contracts

- [ ] **Step 1: Confirm no supported caller exists**

Run: repository-wide searches for `apply-seed`, imports from `ws`, `require('ws')`, and WebSocket server types; run `npm explain ws` and `npm explain @types/ws`.

Expected: the script has no caller; `lib/supabase/server.ts` imports `ws` and configures it as the Supabase Realtime transport, so both `ws` and its type package must remain.

- [ ] **Step 2: Delete the obsolete script**

Use `apply_patch`; preserve `db/seed.sql`, `scripts/apply-migrations.ts`, `seed-50-items.ts`, `seed-100-items.ts`, `lookup-refs.ts`, `ws`, and `@types/ws`.

- [ ] **Step 3: Verify required WebSocket dependencies remain unchanged**

Run: `git diff -- package.json package-lock.json` and `npm explain ws` / `npm explain @types/ws`.

Expected: no manifest/lockfile diff; both direct packages remain because application source consumes them.

- [ ] **Step 4: Verify clean dependency installation**

Run: `npm ci`, `npm run typecheck`, `npm run build`, and `npm test`.

Expected: installation succeeds and all tests pass.

- [ ] **Step 5: Commit tooling cleanup**

Run: `git add -- scripts/apply-seed.ts docs/superpowers/plans/2026-07-22-repository-file-cleanup.md && git commit -m "chore: remove obsolete seed tooling"`

---

### Task 6: Correct operational docs and harden `.gitignore`

**Files:**
- Modify: `.gitignore`
- Modify: `AGENTS.md`
- Modify: `RUNBOOK.md`
- Modify: `INCIDENT_RESPONSE.md`

**Interfaces:**
- Consumes: Node 24/package scripts in `package.json`, CI workflow, explicit migration selection contract
- Produces: accurate operator commands and shared ignore hygiene

- [ ] **Step 1: Add narrowly scoped ignore patterns**

Add `/playwright-report/`, `/blob-report/`, `/.cache/`, `/.turbo/`, `Thumbs.db`, `*.tmp`, `*.swp`, and `*~`. Add narrow local SDD patterns only; do not ignore all `.superpowers/`.

- [ ] **Step 2: Correct stale documentation**

Update AGENTS to document the existing `typecheck` script and Node 24 CI. Replace migration rollback advice with forward-only recovery/backup restoration. Include mandatory `MIGRATION_FILES` in the incident migration command.

- [ ] **Step 3: Verify documentation commands and ignore behavior**

Run `npm run typecheck`, inspect `.github/workflows/ci.yml`, and use `git check-ignore -v` on representative temporary paths.

Expected: docs match executable contracts and important tracked files remain visible.

- [ ] **Step 4: Commit hygiene changes**

Run: `git add -- .gitignore AGENTS.md RUNBOOK.md INCIDENT_RESPONSE.md && git commit -m "docs: align cleanup and operational guidance"`

---

### Task 7: Full verification and final local artifact cleanup

**Files:**
- Delete after execution: `docs/superpowers/plans/2026-07-22-repository-file-cleanup.md`
- Remove locally after verification: regenerated `.next/`, `node_modules/`, test outputs, `tsconfig.tsbuildinfo`, and `next-env.d.ts`

**Interfaces:**
- Consumes: all prior cleanup tasks
- Produces: verified Git tree and source-only local workspace

- [ ] **Step 1: Verify references and Git integrity**

Run: `git diff --check`, `git status --short`, targeted `rg` searches, and confirm every deletion is expected.

- [ ] **Step 2: Run complete static and automated verification**

Run in order: `npm run verify-env`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm run test:smoke`.

Expected: all commands exit 0; test count may decrease only by tests dedicated to removed dead code.

- [ ] **Step 3: Perform application and contract spot checks**

Confirm build route output includes login, dashboard, items, locations, reports, settings, profile, admin DB panel, health endpoints, and revalidate endpoint. Do not run mutating database scripts.

- [ ] **Step 4: Remove the completed cleanup plan and regenerated ignored outputs**

Delete this plan with `apply_patch`, commit the plan removal, then remove only validated ignored/generated paths from disk. Preserve `.env` and `.env.local`.

- [ ] **Step 5: Record final metrics**

Report tracked file count/bytes before and after, deleted/moved/renamed counts, dependency changes, uncertain preserved files, verification results, and rollback commands (`git revert` per cleanup commit).

