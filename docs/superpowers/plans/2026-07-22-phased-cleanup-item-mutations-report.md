# Item Mutation Consolidation Evidence Report

Date: 2026-07-22 (Asia/Bangkok)

Baseline: `aefdc5b`

Implementation/fix head: `637a49c`

Range: `aefdc5b..637a49c`

## Outcome

Item creation now has one private insert/audit pipeline, `createItemCore`, used by both public Server Actions. The public `createItem(prevState, formData)` and `createItemInline(prevState, formData)` signatures and their observable redirect/response contracts remain unchanged. Authorization, validation, upload cleanup, database error mapping, audit writes, cache invalidation, telemetry, safe logging, and wrapper-specific error behavior are covered by focused integration tests.

Inline rate limiting was intentionally **not** added. Before this work only classic `createItem` called `checkRateLimit('createItem', 30, 60000)`; retaining that difference preserves observable behavior.

## Exact range inventory

Eight commits are in the published range, in order:

1. `8c50c8e93c60cd6eee2bdeaa25a80e2671cad9e7` — `test: characterize item creation contracts`
2. `3c9c2e68467f9895a51c0d7f1e2ec18d76a4135b` — `test: strengthen item creation characterization`
3. `3d2b87d59b442baa164a8fadde50da251d65a5d5` — `refactor: consolidate item creation pipeline`
4. `8769a5e100f31b80fb2134a705562aefec7605c5` — `fix: preserve inline creation log context`
5. `945e56d6a163fc1821ef110bf570a55f3c8c7e2c` — `test: protect item creation telemetry contracts`
6. `354a853bdd9a82f6447376cbc7a8e3920bd6ae21` — `docs: report item mutation consolidation`
7. `6c92a9989711b5010a48cdd4b533b80452aadc33` — `docs: correct item mutation report evidence`
8. `637a49cb88f274c783b6deb864bc1f0ecc329716` — `fix: restore item creation exception boundaries`

Net file inventory from `git diff --numstat aefdc5b..637a49c`:

| Status | File | Added | Deleted |
| --- | --- | ---: | ---: |
| Added | `docs/superpowers/plans/2026-07-22-phased-cleanup-item-mutations-report.md` | 132 | 0 |
| Modified | `features/items/actions.ts` | 114 | 109 |
| Added | `tests/integration/create-item-inline.test.ts` | 122 | 0 |
| Modified | `tests/integration/create-item.test.ts` | 463 | 126 |

Total: 4 files changed, 831 insertions, 235 deletions. No files were deleted.

## Commit evidence

### `8c50c8e` — characterize item creation contracts

- Original problem: the two creation entry points had no sufficiently precise shared characterization, so consolidation could silently change response shapes, audit attribution, cleanup, cache invalidation, redirect, or rate-limit behavior.
- Reason: establish behavior-first protection before production refactoring.
- Files/stat: added `tests/integration/create-item-inline.test.ts` (+45); modified `tests/integration/create-item.test.ts` (+180/-136). Commit total: 225 insertions, 136 deletions.
- Literal before/after: before, separate shallow checks included `assert.equal(res.message, 'กรุณาเข้าสู่ระบบก่อนทำรายการ')`; after, the contract is exact: `assert.deepEqual(await createItem(null, validItemFormData()), { message: 'กรุณาเข้าสู่ระบบก่อนทำรายการ' })`, alongside paired inline response, insert/audit, cleanup, cache/redirect, and classic-only rate-limit assertions.
- Impact: production code was unchanged; the legacy and inline contracts became executable regression evidence.
- Focused verification: the task initially recorded 9 passing focused tests; after review strengthening, `node --import tsx --test tests/integration/create-item.test.ts tests/integration/create-item-inline.test.ts` recorded 11 passed, 0 failed.
- Full verification: `npm test` recorded 216 passed, 0 failed after review fixes.
- Rollback: `git revert 8c50c8e93c60cd6eee2bdeaa25a80e2671cad9e7`.

### `3c9c2e6` — strengthen characterization

- Original problem: the first characterization compared some actions to each other and under-specified cleanup ordering, audit contents, upload validation, secret redaction, and test teardown; two implementations could regress identically and still pass.
- Reason: assert each public contract independently and completely before changing production code.
- Files/stat: modified `tests/integration/create-item-inline.test.ts` (+20/-6) and `tests/integration/create-item.test.ts` (+104/-15). Commit total: 124 insertions, 21 deletions.
- Literal before/after: before, cleanup asserted only `filter((entry) => entry.operation === 'remove').length === 1`; after, it asserts `storageLog[0].operation === 'upload'`, `storageLog[1].operation === 'remove'`, and `storageLog[1].path === storageLog[0].path`. The audit changed from cross-action equality to exact `user_id`, action, table, target, old data, parsed values, and typed trace metadata.
- Impact: exactly-once same-object cleanup, complete audit payloads, validation-before-upload, redacted logging, and isolated test restoration are protected.
- Focused verification: the reviewed characterization run recorded 11 passed, 0 failed.
- Full verification: `npm test` recorded 216 passed, 0 failed.
- Rollback: `git revert 3c9c2e68467f9895a51c0d7f1e2ec18d76a4135b`.

### `3d2b87d` — consolidate item creation pipeline

- Original problem: `createItem` and `createItemInline` duplicated the private authorization/validation/upload/insert/audit pipeline, creating drift risk.
- Reason: retain wrapper-specific terminals while making the mutation pipeline single-source.
- Files/stat: modified `features/items/actions.ts` (+111/-111), `tests/integration/create-item-inline.test.ts` (+9), and `tests/integration/create-item.test.ts` (+18/-1). Commit total: 138 insertions, 112 deletions.
- Literal before/after: before, each exported action contained its own `.from('items').insert(...)`; after, production defines private `async function createItemCore(...)`, both wrappers call `await createItemCore(formData, ...)`, and the structural regression asserts exactly one item insert pipeline. Classic rate limiting remains an injected callback and still runs before validation: `assert.deepEqual(rateLimitCalls, [['createItem', 30, 60000]])`.
- Impact: one private item creation insert/audit pipeline remains. The classic wrapper retains metric/timer/tracing, safe error handling, cache behavior, and `redirect('/items')` outside `try/catch`; inline retains `ActionResponse` formatting and no redirect. Uploaded-object cleanup is idempotent for post-upload failures.
- Focused verification: after the follow-up correction, the two integration files recorded 13 passed, 0 failed.
- Full verification: `npm run typecheck`, `npm run lint`, and `npm test` passed; the recorded full suite was 218 passed, 0 failed.
- Rollback: `git revert 3d2b87d59b442baa164a8fadde50da251d65a5d5`.

### `8769a5e` — preserve inline log context

- Original problem: consolidation temporarily omitted the authorized `userId` from the inline success log.
- Reason: preserve the complete pre-refactor observable logging context without adding a second authorization path.
- Files/stat: modified `features/items/actions.ts` (+6/-8) and `tests/integration/create-item-inline.test.ts` (+13/-2). Commit total: 19 insertions, 10 deletions.
- Literal before/after: before, success returned `{ ok: true, itemId: data.id }` and logged no user; after, it returns `{ ok: true, itemId: data.id, userId }` and logs `userId: result.userId` with `details: { id: result.itemId }`.
- Impact: inline success telemetry again carries the authorized actor while still using the single core authorization result.
- Focused verification: `node --import tsx --test tests/integration/create-item.test.ts tests/integration/create-item-inline.test.ts` recorded 13 passed, 0 failed.
- Full verification: `npm run typecheck`, `npm run lint`, and `npm test` passed; 218 tests passed, 0 failed.
- Rollback: `git revert 8769a5e100f31b80fb2134a705562aefec7605c5`.

### `945e56d` — protect telemetry contracts

- Original problem: wrapper telemetry and unexpected-error behavior remained less directly protected than the data pipeline.
- Reason: prove the refactor preserved classic metrics/timed traced logs/redirect and inline auth/success/error logs, response formatting, and secret redaction.
- Files/stat: modified `tests/integration/create-item-inline.test.ts` (+52/-9) and `tests/integration/create-item.test.ts` (+61). Commit total: 113 insertions, 9 deletions.
- Literal before/after: before, inline success primarily asserted `{ success: true, ok: true, message: 'สร้างพัสดุสำเร็จ', data: undefined }`; after, tests also assert `log.operation === 'createItemInline'`, actor and item details. Classic additions assert the single `items.created` counter, timer latency, trace IDs, redirect, safe Thai error response, `[KEY_REDACTED]`, and absence of the injected secret.
- Impact: the wrapper-observable telemetry and safe-error contracts are regression protected without production drift.
- Focused verification: the initial focused run had 14 passed and 2 failed because expectations included unrelated query-latency metrics and assumed a different safe message. Only expectations were corrected to the established contract; the clean rerun recorded 16 passed, 0 failed.
- Full verification: `npx tsc --noEmit`, `npm run lint`, and `npm test` passed; the full suite recorded 221 passed, 0 failed. `git diff --check` exited 0 with only line-ending notices.
- Rollback: `git revert 945e56d6a163fc1821ef110bf570a55f3c8c7e2c`.

### `354a853` and `6c92a99` — publish and correct the evidence report

- Original problem: the completed implementation needed a durable evidence report; its first version then misstated Node alignment and described integrity checks prospectively.
- Reason: publish the requested audit trail and correct its evidence language.
- Files/stat: the first commit added this report (+127); the correction modified it (+5/-5).
- Impact: documentation only. The report accurately records Node 24 alignment and completed integrity checks, but its initial final-review conclusion was later invalidated by the Important findings below.
- Rollback: `git revert 6c92a9989711b5010a48cdd4b533b80452aadc33`, then `git revert 354a853bdd9a82f6447376cbc7a8e3920bd6ae21`.

### `637a49c` — restore item creation exception boundaries

- Original problem: final review found that consolidation had moved `createClient()` inside the database catch, cache invalidation inside that catch, and classic committed telemetry outside it. Those changes altered cleanup, rejection, and safe-error behavior relative to the baseline.
- Reason: retain one shared core while preserving the exact legacy exception boundaries.
- Files/stat: modified `features/items/actions.ts` (+19/-18) and `tests/integration/create-item.test.ts` (+132). Commit total: 151 insertions, 18 deletions.
- Literal before/after: before, `const supabase = await createClient()` and cache invalidation were both inside the core `try`, while classic telemetry ran after the core returned. After, client construction precedes the inner `try`; insert, audit, and optional `onCommitted` telemetry are inside it; cache invalidation follows the catch; inline success logging remains in its wrapper.
- Impact: post-upload client-construction failures reject raw without cleanup/cache; insert, audit, and classic telemetry failures remove the upload exactly once and map through the established wrapper error behavior; post-commit cache failures reject raw without cleanup. Classic timer/context/metric/traced-log fields and inline success logging are retained.
- TDD evidence: the new focused cases first failed for all three missing boundaries; after the production correction, `node --import tsx --test tests/integration/create-item.test.ts tests/integration/create-item-inline.test.ts` passed 19/19.
- Full verification: `npm run typecheck`, `npm run lint`, `npm test` (224/224), and `npm run build` all passed.
- Rollback: `git revert 637a49cb88f274c783b6deb864bc1f0ecc329716`.

## Final verification and review

The final production/database pass recorded:

| Gate | Result |
| --- | --- |
| `npm run verify-env` | PASS; required variables were present and validated. |
| `npm run typecheck` | PASS. |
| `npm test` | PASS; 56 test files, 224 tests passed, 0 failed/cancelled/skipped/todo. |
| `npm run lint` | PASS; no diagnostics. |
| `npm run build` | PASS; Next.js 16.2.11 compiled, TypeScript completed, and 13/13 static pages completed within bundle budgets. |
| `npm run test:smoke` | PASS only on the accepted clean rerun; 2 discovered, 1 passed, 1 credential-dependent test skipped. |
| `npm run verify-db-release` | PASS; migration/RLS/RPC readiness only, with no migrations or other database mutations applied. |
| `git diff --check` | PASS. |

The first smoke attempt failed because worktree-local dependencies were absent. A later exit-0 attempt was explicitly rejected because port 3000 was occupied by an unknown existing server and could not prove which application was exercised. After stopping the confirmed stale process and confirming the port was free, the exact smoke command started its own server without `EADDRINUSE` and produced the accepted result above. These failed/rejected gates are not counted as passes.

Earlier task-scoped findings were resolved in the listed commits. Final whole-branch review then identified Important exception-boundary regressions involving client construction, cache invalidation, and classic telemetry. Commit `637a49c` addresses those findings with public-action regression coverage. The fixes are pending re-review; this report does not claim the final review is clean. No production or database changes were made during Task 4.

## Remaining risks and environment notes

- Authenticated release E2E was not run. The smoke suite skipped its credential-dependent draft-persistence test, so only the unauthenticated redirect path has accepted smoke evidence.
- The verification runtime was Node.js v24.15.0, aligned with `package.json` (`>=24.0.0 <25`) and CI (`24.x`).
- Next.js warned about multiple lockfiles and inferred `D:\registry-s\package-lock.json` as the workspace root while listing the worktree lockfile as additional. This may relate to the initial worktree-local dependency issue; it was not diagnosed or changed.
- The configured ignored `.env.local` was used by build/readiness commands. No configured value is reproduced in this report.
- Database readiness verification was non-mutating: no migrations were applied.

- The boundary fixes have not yet received the requested independent re-review, so review closure remains pending.

## Report integrity and rollback scope

The initial documentation commit completed these integrity checks:

- The configured-secret scan checked 4 configured non-empty values without printing them and found 0 matches in the report.
- `git diff --cached --check` passed after three Markdown trailing-space findings were removed and the exact check was rerun.
- `git diff --cached --name-only` listed only `docs/superpowers/plans/2026-07-22-phased-cleanup-item-mutations-report.md`.
- The post-commit `git diff HEAD^ HEAD --check` passed, and the committed file list contained only the report.

Each implementation commit has an explicit independent `git revert <sha>` command above. Because later commits build on earlier tests/refactoring, reverting multiple commits should normally be done newest-to-oldest to minimize conflicts.
