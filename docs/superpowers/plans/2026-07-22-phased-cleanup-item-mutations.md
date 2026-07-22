# Item Creation Mutation Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove duplicated item-creation mutation logic while preserving both public Server Action contracts and all user-visible behavior.

**Architecture:** Add one private `createItemCore` inside `features/items/actions.ts` that owns shared authorization, validation, image lifecycle, insert, audit, and cache invalidation. Keep `createItem` and `createItemInline` as thin public adapters for their existing response, redirect, rate-limit, telemetry, logging, and error-message differences.

**Tech Stack:** Next.js 16.2.11 Server Actions, React 19.2.8, TypeScript strict, Supabase JS/SSR, Zod 4, Node test runner through `tsx`.

## Global Constraints

- Work from the current clean `main` baseline after Foundation merge `f77be83`.
- Use an isolated worktree and never modify `main` directly during implementation.
- Read relevant Next.js 16 Server Action, redirect, and cache documentation under `node_modules/next/dist/docs/` before implementation.
- Preserve exported names/signatures: `createItem(ItemActionState | null, FormData): Promise<ItemActionState>` and `createItemInline(ActionResponse | null, FormData): Promise<ActionResponse>`.
- Preserve `createItem` redirect to `/items`, rate-limit action/key/limits, metrics, tracing, success log, and `handleActionError` behavior.
- Preserve `createItemInline` non-redirect success response, unauthorized warning, generic catch message, and inline success log.
- Preserve exact Thai messages, `fieldErrors`, friendly unique-constraint messages, database payload, image validation, upload cleanup, audit payload, `/items` revalidation, sidebar tag, and root layout revalidation.
- Do not add inline rate limiting or change external behavior as part of this refactor.
- No route, schema, RLS, migration, query, UI, or dependency changes.
- Follow TDD, focused tests, full `npm test`, `npm run typecheck`, `npm run lint`, and `npm run build` before completion.

## File Map

- `features/items/actions.ts`: private core result types/function and two public adapters.
- `tests/integration/create-item.test.ts`: redirecting action characterization and shared-pipeline regressions.
- `tests/integration/create-item-inline.test.ts`: new inline contract characterization.
- `tests/mocks/supabase.ts`: modify only if a minimal observation hook is required; prefer existing registry logs.
- `docs/superpowers/plans/2026-07-22-phased-cleanup-item-mutations-report.md`: final evidence and rollback report.

---

### Task 1: Characterize Both Public Creation Contracts

**Files:**
- Modify: `tests/integration/create-item.test.ts`
- Create: `tests/integration/create-item-inline.test.ts`

**Interfaces:**
- Consumes existing `createItem` and `createItemInline` exports without production changes.
- Produces regression coverage for response shapes, redirect behavior, insert payload, audit, image cleanup, and cache calls observable through existing mocks.

- [ ] Add a shared local `validItemFormData()` test helper that supplies all required and optional fields without changing production exports.
- [ ] Add inline tests proving unauthenticated/viewer responses use `ActionResponse`, invalid input returns identical field errors, database uniqueness failures use the friendly message, and success returns `{ success: true, message: <existing Thai message> }` without throwing `NEXT_REDIRECT`.
- [ ] Add paired success assertions proving both actions insert `created_by`/`updated_by`, create the same item audit payload, and preserve their distinct terminal behavior.
- [ ] Add upload-then-insert-failure assertions for both actions proving the uploaded object is removed exactly once and no success response/redirect occurs.
- [ ] Add a regression proving only `createItem` invokes its existing `checkRateLimit('createItem', 30, 60000)` behavior; do not introduce inline throttling.
- [ ] Run `node --import tsx --test tests/integration/create-item.test.ts tests/integration/create-item-inline.test.ts`.

Expected: all characterization tests PASS against the pre-refactor implementation. If an expectation does not match current behavior, record actual behavior and adjust the plan before production edits rather than silently changing it.

- [ ] Commit only the two test files:

```powershell
git add -- tests/integration/create-item.test.ts tests/integration/create-item-inline.test.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "test: characterize item creation contracts"
```

### Task 2: Extract the Private Shared Creation Core

**Files:**
- Modify: `features/items/actions.ts`
- Modify: `tests/integration/create-item.test.ts`
- Modify: `tests/integration/create-item-inline.test.ts`

**Interfaces:**
- Produces private discriminated union:

```ts
type CreateItemCoreResult =
  | { ok: true; itemId: string }
  | { ok: false; kind: 'auth' | 'validation' | 'upload' | 'database' | 'unexpected'; message: string; fieldErrors?: ActionResponse['fieldErrors']; error?: unknown; userId?: string }
```

- Produces private options and core interfaces:

```ts
type CreateItemCoreOptions = {
  afterAuthorize?: (userId: string) => Promise<{ message: string } | null>
}

async function createItemCore(
  formData: FormData,
  options: CreateItemCoreOptions = {},
): Promise<CreateItemCoreResult>
```

  `createItem` supplies an `afterAuthorize` callback containing its existing
  rate-limit check; inline supplies none. This preserves the current order:
  authorize → rate limit → validation for the redirecting action.
- Core never redirects and never emits wrapper-specific success/error logs, metrics, traces, or rate-limit checks.

- [ ] Extend the characterization tests with a failing regression that observes
  ordering: an authorized, rate-limited `createItem` request with an invalid
  form must return the rate-limit message without uploading or inserting. This
  protects the callback boundary before extraction.
- [ ] Run the focused test and confirm RED if the required rate-limit mock hook
  is not yet available; add only the smallest mock observation needed, then
  confirm the pre-refactor behavior is GREEN before moving production code.
- [ ] Implement `createItemCore` by moving, not rewriting, the common flow in this exact order: `requireEditor` → optional `afterAuthorize` → initial validation before upload → upload → final validation → insert/select id → audit → item/cache revalidation.
- [ ] On every failure after a successful new upload, delete that uploaded object exactly once. Never delete a pre-existing object because creation starts with an empty image URL.
- [ ] Return typed failure data rather than formatting wrapper-specific `ActionResponse` inside the core. Preserve the original underlying exception on `unexpected` for wrapper logging/error handling.
- [ ] Keep `revalidatePath('/items')` and `revalidateSidebarCache()` in the successful core so both wrappers invalidate identically once.
- [ ] Rewrite both wrappers to call the core while retaining their existing terminal differences and exact messages.
- [ ] Run focused tests and verify the structural assertion and all behavior tests PASS.
- [ ] Run `npm run typecheck && npm run lint && npm test`.
- [ ] Commit:

```powershell
git add -- features/items/actions.ts tests/integration/create-item.test.ts tests/integration/create-item-inline.test.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "refactor: consolidate item creation pipeline"
```

### Task 3: Verify Wrapper-Specific Telemetry and Failure Semantics

**Files:**
- Modify: `tests/integration/create-item.test.ts`
- Modify: `tests/integration/create-item-inline.test.ts`
- Modify: `features/items/actions.ts` only if tests expose drift.

**Interfaces:**
- Preserves redirect action telemetry operation/action `createItem`, timer, `metrics.itemCreated()`, trace context, and `handleActionError` safe response.
- Preserves inline operations `createItemInline`, unauthorized warning, success log with item ID, generic catch response, and absence of redirect.

- [ ] Add focused log/metric assertions using existing logger/metrics test patterns; restore spies in `finally`.
- [ ] Add an unexpected insert/audit exception test for each wrapper, proving redirect action uses its established safe handler while inline returns its established generic message.
- [ ] Prove neither wrapper logs raw Supabase/storage secrets after Foundation sanitizer changes.
- [ ] Run focused tests, typecheck, lint, and full tests.
- [ ] Commit only changed action/test files with `git diff --cached --check` and exact staged-name review:

```powershell
git commit -m "test: protect item creation telemetry contracts"
```

### Task 4: Production and Database Verification

**Files:**
- No production edits unless verification reveals a defect.

- [ ] Run `npm run verify-env`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm test` and record exact test/file counts.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build` and record raw/gzip bundle values.
- [ ] Run `npm run test:smoke` with configured ignored environment.
- [ ] Run `npm run verify-db-release` without applying migrations.
- [ ] Confirm `git diff --check f77be83..HEAD` and a clean working tree.

Expected: every applicable gate passes; authenticated release E2E remains separately credential-gated and must not be reported as passed unless actually run.

### Task 5: Write the Item Mutation Consolidation Report

**Files:**
- Create: `docs/superpowers/plans/2026-07-22-phased-cleanup-item-mutations-report.md`

- [ ] Enumerate exact modified/added/deleted files and commits.
- [ ] For every commit include original problem, reason, concise literal before/after excerpt, impact, focused/full verification, and `git revert <sha>` rollback.
- [ ] Document that inline rate limiting was intentionally not added to preserve behavior.
- [ ] Document remaining risks or state `none found`; never hide failed/skipped gates.
- [ ] Scan the report for configured values/secrets and run `git diff --cached --check`.
- [ ] Commit only the report:

```powershell
git add -- docs/superpowers/plans/2026-07-22-phased-cleanup-item-mutations-report.md
git diff --cached --check
git diff --cached --name-only
git commit -m "docs: report item mutation consolidation"
```

## Completion Criteria

- One private item creation insert/audit pipeline remains.
- Both public Server Action signatures and observable contracts are unchanged.
- Image cleanup, authorization, validation, audit, cache, telemetry, and error behavior are protected by tests.
- Typecheck, lint, full tests, build, smoke, and non-mutating DB readiness pass.
- Task-scoped and final whole-branch reviews have no open Critical or Important findings.
