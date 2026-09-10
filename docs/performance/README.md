# CAMMS performance audit — 2026-09-10

## Baseline and request map (recorded before fixes)

Production webpack build passed on Node 24.15.0. Existing budget measurements:
shared runtime 436.25 KiB raw / 128.16 KiB gzip; dashboard entries 88.54 / 29.66 KiB.
These are manifest sizes, not measured browser transfer or hydration time.

| Flow | Critical path and work |
|---|---|
| Login | proxy SDK getClaims → login action rate limit → password Auth → profile; redirect dashboard |
| Every protected render | proxy getClaims → request-cached server getUser → active profile; layout → parallel cached sidebar RPC and three reference queries on cache miss |
| Dashboard | profile guard → parallel report stats RPC / low-stock query; shared references/sidebar; deferred realtime bridge |
| Items, search/filter/sort/page | parallel profile/references/list; list performs data SELECT and exact HEAD count concurrently → one private storage signing batch → RSC → explorer |
| Item detail/edit | profile guard, item lookup and private signing, references, admin-only history query; no shared private URL cache |
| Reports | profile → parallel references, stats RPC, paged report RPC, unbounded depreciation SELECT/calculation; all awaited before rendering |
| Settings/locations | profile/permission → reference queries → metadata client UI |
| Admin users/audit | profile/admin guard → bounded exact-count SELECT + OFFSET; same timestamp sort has no id tie-break |
| Create/update/delete/bulk | profile/permission → database rate limiter → validation/upload/lookup/write → transactional audit trigger → tags + root layout revalidation; several clients then refresh again |
| Import/export | import validates rows and uses transaction RPC; Excel uses streamed keyset batches, PDF capped at 5,000; bulk image deletion starts one storage operation per image |
| Realtime | one subscription per active boundary → hidden-tab deferral, trailing debounce/max-wait/in-flight coalescing → router.refresh → auth/layout/data/signing rerun |

Existing React cache deduplicates profile within an RSC render. It must not be interpreted as a cross-request permission cache. Shared reference/sidebar caches contain organization-wide data; authenticated page guards remain mandatory. `getUser` still checks current Auth state; replacing it with claims alone changes ban/deletion freshness. No such security relaxation is authorized.

## Database evidence

Connected project matches `.env.local`: CAMMS, PostgreSQL 17, Singapore. Read-only count found 1 item, 5 profiles, 50 audit rows. Statistics estimates were stale (items estimated zero). Thus production-scale DB latency and pagination scalability are **not measured**.

Actual six per-column trigram indexes match the Items six-column OR/ILIKE expression. The concatenated trigram index does **not** match that expression. Existing repository indexes from 00034 (including updated_at DESC,id ASC) were absent live. Do not blindly replay historical migrations: some are destructive.

Read-only owner-role EXPLAIN ANALYZE for `%printer%`, ordered first 10: sequential scan over one row, execution 1.524 ms, planning 37.242 ms (single sample). This does not establish a missing-index bottleneck and does not measure authenticated RLS. No new search index is justified by this sample.

Live `private.current_app_role()` is STABLE SQL SECURITY DEFINER, reads the active profile, and is invoked directly in row policies. Verify statement-scoped evaluation in local PostgreSQL before changing policies.

## Priorities and implementation design

- P1 work amplification: demonstrate closed dynamic form/print mounts and remove those mounts until needed. Keep existing open/edit/print behavior.
- P1 realtime: re-fetch only the Items page data through a cookie-authenticated, no-store endpoint using existing RLS queries; preserve filtered membership, count, ordering, private signing, debounce and race cancellation. Metadata events may still require a route refresh. Never patch unverified event payloads into authorized data.
- P1 action duplication: remove explicit Items success refreshes where server action revalidation already returns current RSC. Keep root invalidation until sidebar semantics can be preserved; avoid speculative cache changes.
- P2 shared RLS scalability: compare exact same policy semantics with statement-scoped subselects on synthetic local data; retain roles, grants, active checks and all business predicates. Generate a reviewable migration, do not deploy it as part of local fixes.
- P2 stable admin pagination: add unique tie-break order; retain numbered-page UX and exact totals.
- Instrumentation: keep existing metrics and add sanitized per-Supabase HTTP count/duration coverage for Auth, REST, RPC and Storage. No tokens, query strings, identities or signed URLs in metrics.

Rejected alternatives: shared permission/URL cache (security freshness), immediate keyset-only UI (removes page jumping), concatenated search rewrite (changes substring semantics), local raw realtime row patches (filtered list/count and permission correctness).

## Verification plan

Write reproductions before implementation; run targeted tests after each group. Run typecheck, full tests, lint, production build, smoke and supported E2E. Compare actual bundle and synthetic DB measurements. Authenticated navigation, render counts, RSC payload and end-to-end action latency remain **not measured** without an authenticated test session. All synthetic measurements must be labelled separately from live data.

## Root causes and changes

1. **Closed dynamic components still loaded.** Items rendered `AssetTagModal` and `NewItemSheet` unconditionally with an `open=false` prop. Their dynamic loaders mounted on the first render. They now mount only when needed. Inspector was already gated and remains so. The original three tool chunks totalled 75,488 bytes raw / 21,117 bytes gzip; this is a manifest sum, not a measured browser transfer saving.
2. **Duplicate action work.** Item action success explicitly refreshed the router after the action had already revalidated the root layout. Removed four explorer success refreshes and the creation-provider success refresh. Tags now expire immediately so the action response does not intentionally serve stale sidebar/reference data. Root layout invalidation remains for mutations because it updates visible layout counts and other views.
3. **Repeated auth/profile lookup in actions.** Rate limiting resolved the active profile again after guards. It now accepts only an internal server-supplied, already-verified profile at the Items, Settings, Admin, report export and export-audit call sites. Public Server Action signatures have not gained any identity argument. Settings guards also return the profile for logging/error handling, instead of reading it again. Fallback callers still perform the original lookup. Rate bucket identity, quotas, shared PostgreSQL storage and fail-closed behavior remain unchanged.
4. **Metadata audit duplication.** Settings used both the transaction audit trigger and application database inserts. Live metadata/profile audit triggers were confirmed enabled. Keep structured application logs but persist these cookie-authenticated mutations only through the database trigger, as Items already does. Privileged admin/service-role and export audit persistence remains intact.
5. **Realtime invalidated an entire route.** Ordinary Items events now use a bounded, cookie-authenticated `/api/items/live` GET with `private, no-store` and `Vary: Cookie`. It uses the same list query, exact count, ordering, RLS and batch image signing, plus existing cached sidebar stats. Only the list and sidebar state update. Metadata events still refresh the route; a 401 or a changed server-derived profile revision re-runs the protected route guard and refreshes role-dependent controls. Unchanged profiles keep the data-only path. Requests abort on navigation/unmount, stale completions are ignored, and failures retain the last successful data with an error notice. Existing hidden-tab/max-wait/in-flight event coalescing is reused.
6. **Per-row role checks at scale.** The new migration wraps existing role predicates in scalar SELECTs to obtain statement InitPlans. All 17 policy names, roles, commands, grants, filters and active-profile semantics remain. No RPC, new index, public asset access, or shared permission cache was added. This migration is local and **not applied to the connected database**.
7. **Unstable pagination ties.** Admin Users/Audit Logs now order equal timestamps by `id ASC`. Numbered pages, page-size limits, sort direction and exact totals remain unchanged.

## Auth

The project's public JWKS advertises ES256. Proxy already uses SDK `getClaims`, which verifies signatures and can use cached JWKS. Server guards retain request-cached `getUser` and the current active profile to avoid weakening current Auth-state checks. Therefore remote Auth requests per authenticated navigation are **not measured** and no navigation-level reduction is claimed. Verified claims alone do not establish current server-side session revocation; see [Supabase getClaims](https://supabase.com/docs/reference/javascript/auth-getclaims).

The rate-limit reuse removes one *helper invocation* at those action call sites even when React cache is unavailable in the action phase. This is tested with mocked dependencies, not presented as a live remote-request count.

## Before vs after

| Metric / environment | Before | After |
|---|---:|---:|
| Local PGlite, synthetic 20,000 live items, active viewer, exact count; median of 7 warm samples | 116.714 ms | 6.650 ms |
| Same local count plan, shared buffer hits (last sample) | 40,109 | 111 |
| Closed Items tool loaders mounted, component reproduction | 2 | 0 |
| Extra explicit router refresh after successful bulk status action, component mock | 1 | 0 |
| 100-event Items burst, controller/hook tests | 1 route refresh | 1 data fetch, 0 route refreshes |
| Extra profile helper lookup inside rate limiter with already-verified profile, unit test | 1 | 0 |
| Metadata create profile helper calls with rate limiter stubbed, integration reproduction | 2 | 1 |
| Shared runtime manifest JS raw / gzip | 436.25 / 128.16 KiB | 436.25 / 128.16 KiB |
| Dashboard entry manifest JS raw / gzip | 88.54 / 29.66 KiB | 88.95 / 29.79 KiB |

The small dashboard increase is the live sidebar provider, still within the unchanged bundle budgets. Initial JS has not decreased; closed tools now defer their existing chunks. Complete timings and plans for the synthetic SQL benchmark are in [rls-benchmark.json](./rls-benchmark.json); reproduce with `node --import tsx scripts/benchmark-rls.ts`. It creates only an in-memory database.

**Not measured:** authenticated login/navigation/action p50/p95, live DB queries per request, live remote Auth request counts, RSC response bytes, React commit/rerender duration, image transfer bytes, heap peak during import/export, deep-page latency, and production search with representative data. A one-item database and no supplied authenticated test session cannot establish those results. No claim is made that the original whole-system latency has been reproduced or resolved in production.

## Instrumentation

Server and proxy Supabase transports now emit `supabase.http.requests` and `supabase.http.latency` using existing metrics. Fixed service labels distinguish `auth.user`, `auth.token`, `auth.jwks`, `auth.other`, REST, RPC and Storage. Failures/aborts are counted. These measure HTTP response-header latency, not PostgreSQL execution time; existing `query.latency` includes SDK query completion.

For a controlled diagnostic session set `CAMMS_PERF_TRACE=true` on the server: structured `supabase.http` entries include the existing request ID for per-request counting/correlation. No URL, token, query filter, private path, signed URL, response body or user identity is added to these measurements. The existing exporter is process-local and bounded; use the existing exporter interface for durable multi-instance monitoring. Turn verbose tracing off after capture.

## Remaining bottlenecks and risk

- **Representative authenticated measurement is still required.** Measure the full requested journey on staging with realistic cardinality, browser sessions and cache conditions; include revoked/inactive users and simultaneous edits. Current browser suites intentionally skip authenticated journeys without staging credentials.
- **Exact counts and deep OFFSET remain (P2).** Items and Admin keep page jumping and exact totals. Report export already uses bounded keyset batches. No new pagination UX was introduced without workload evidence. Local RLS optimization reduces one contributor but does not remove full counts or deep skips.
- **Reports depreciation and admin backup materialize data (P2).** Depreciation rendering and backup table reads remain unpaged and can hit the Supabase response cap or memory limits with large datasets. Report stats also repeat on search navigations. These need realistic-volume correctness/performance work; they were not benchmarked here. Do not treat a capped backup as a complete database backup.
- **Bulk storage deletion fan-out and item audit history (P2).** Deletions still start one storage operation per image; item history is unpaged. Image signing is already deduplicated/batched per list request and remains private. No cross-user URL cache was introduced.
- **Other realtime surfaces retain whole-route refresh.** Dashboard and metadata events remain debounced route refreshes. Live list reads still pay the exact count and one image-signing batch; monitor their volume under sustained events. Sidebar stats keep the existing 300-second external-change cache semantics.
- **Index deployment drift.** Live lacks some repository indexes from 00034. Six matching search trigram indexes do exist. Advisor reports unused indexes on the very small dataset; that does not justify dropping them. Review representative authenticated plans before adding/dropping indexes or replaying migrations.
- **Migration rollout.** Apply only the new migration after review on a staging copy with the prerequisite policies. `ALTER POLICY` is atomic inside its transaction and changes neither data nor grants, but can wait for locks. Monitor RLS plans, active-account denial and write/audit parity after application. Rolling back its predicates to their original direct calls restores the previous execution strategy.
- **Metadata audits depend on existing database triggers.** Their enabled state was verified live and source migrations/tests retain them. Monitor audit coverage after deployment; the application no longer duplicates those records.
- **Auth freshness retained.** Server remote validation stays. Remaining personal-profile/password paths still use their existing independent Auth guard. No security settings were changed.

Live advisor checks were read-only. Performance findings include the audit auth initplan warning, multiple permissive policies and unindexed foreign keys; only the evidenced role-call work is addressed here. Security advisor warnings on existing definer functions, pg_trgm schema placement and password protection were not changed by this performance patch.

The scalar-select optimization follows [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). Immediate tag expiry and action-response behavior were checked against [Next.js revalidateTag](https://nextjs.org/docs/app/api-reference/functions/revalidateTag) and [revalidatePath](https://nextjs.org/docs/app/api-reference/functions/revalidatePath), and the installed 16.3.4 implementation/types.


## Frontend and realtime verification

The Items component reproductions cover deferred tool loading, optimistic action success/failure, event bursts, stale navigation responses, abort on unmount, failed reads/retry, revoked sessions, and active profile changes. Sidebar tests cover targeted data updates and replacement by a later server render. Dynamic chunks remain outside the initial tool render; no dependency or bundle-budget increase was introduced.

The code review identified a role-dependent UI freshness regression in the initial data-only realtime implementation. The final implementation compares a server-derived profile revision against the page's revision and refreshes the protected page when it changes. It does not use that marker to authorize any action.

## Tests

Final checks on the local production build:

| Command | Result |
|---|---|
| `npm test` | Passed: 500 tests across 125 files, 0 failures, 0 skipped; final source revision |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed, including raw/gzip bundle budgets |
| `node --import tsx --test tests/component/items-live-refresh.test.tsx tests/integration/items-live-route.test.ts` | 4 passed, including the final profile-change regression |
| `node --import tsx scripts/run-playwright.ts smoke` | 1 passed, 1 skipped |
| `node --import tsx scripts/run-playwright.ts chromium` | 1 passed, 1 skipped |
| `git diff --check` | Passed (line-ending normalization notices only) |

Browser checks used the final production build and verified unauthenticated redirects. Both authenticated browser journeys were skipped by the existing configuration because staging credentials were unavailable. These results do not establish authenticated create/edit/delete/import/export or accessibility coverage.

Earlier verification exposed an async dialog-loading timeout while the full suite and production build ran concurrently; the isolated dialog tests passed. Subsequent checks were run serially. Existing create-item mocks were updated to assert the internally verified profile argument and immediate tag expiry. No test was disabled or timeout relaxed. Reproducible synthetic benchmark tooling is retained under `scripts/` and test fixtures; it is not imported by the application or executed against the remote database.
