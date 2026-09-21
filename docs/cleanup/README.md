# Codebase cleanup audit — 2026-09-11

## Unused-code follow-up — 2026-09-21

Repository-wide reference searches found six utility exports with no application or script callers: `validateEnvConfig`, `normalizeForCompare`, `ValidationError`, `NotFoundError`, `ConflictError`, and `RateLimitError`. Removed these exports, the private helper used only by `validateEnvConfig`, and three tests exclusive to the removed utilities. Error-handler tests now construct `ApplicationError` directly and continue to verify safe messages; error tests retain code/status checks and cover details on the base class. The active environment validation in `scripts/verify-env.ts` remains unchanged.

Added `.cache/**` to ESLint's generated-artifact ignores: a local generated CommonJS helper was causing lint failures. Application and test sources retain the existing lint rules and strict unused-local/parameter checks.

Retained metrics test seams, framework Server Actions, the alternative tool pipeline, and the PostgreSQL backend. Test-only usage alone does not establish that an integration or supported backend can be retired. No dependency, migration, database setting, or application behavior was changed.

Validation: strict `npm run typecheck`, `npm run lint`, the full `npm test` suite, `npm run build` (including bundle budgets), and `git diff --check` passed. Changes remain local for review.

## Follow-up cleanup requested by the user

The second pass addresses two additional P2 findings, presented before implementation:

1. **Repeated settings queries:** Categories, locations, and units each had a duplicated query definition for selected-section versus all-section loading. Each query is now defined once inside `getSettingsData`, using the existing request's RLS client. Queries remain lazy: selecting one section executes one query, while all-section loading still uses `Promise.all`. Selected fields, ordering, returned shapes, null handling, and error messages are unchanged.
2. **Shared types coupled to server query files:** Moved `ReportCountBucket`, `ReportStats`, `ReportItemRow`, and `ReportListResult` to `features/reports/types.ts`; `ProfileListItem` and `AuditLogListItem` to `features/admin/types.ts`; and `ItemAuditLog` to the existing `features/items/types.ts`. UI/export consumers now import these explicitly as types. Query-specific parameters and RPC response structures remain beside their queries. The three identical report bucket annotations now reuse `ReportCountBucket`.

No runtime export, permission check, validation, query behavior, dependency, migration, or existing test was removed in this follow-up. No compatibility re-export or generic data-access layer was introduced. The dashboard category list also drops a redundant type assertion because the shared report type already supplies the correct inference. TypeScript transpilation of the reports, admin, and items query modules matches the original runtime JavaScript after normalizing Git CRLF/LF endings; the initial literal comparison detected only those line-ending differences.

Ten characterization tests were added in `features/settings/queries.test.ts` and passed before and after refactoring. They cover section isolation, equivalent selected/all results and queries, use of the ordinary RLS client, private error messages, and null results. Settings regression tests passed (16 tests); targeted Excel/reports/users/audit/item tests passed (24 tests); strict typecheck passed.

Additional files changed: `features/settings/queries.ts`, `features/settings/queries.test.ts` (new), `features/reports/types.ts` (new), `features/reports/queries.ts`, `features/reports/actions.ts`, `features/reports/components/reports-list.tsx`, `features/admin/types.ts` (new), `features/admin/queries.ts`, `features/items/types.ts`, `features/items/queries.ts`, `components/dashboard/dashboard-category-list.tsx`, `app/(dashboard)/admin/users/users-client.tsx`, `app/(dashboard)/admin/audit-logs/audit-logs-client.tsx`, `app/(dashboard)/items/[id]/item-audit-timeline.tsx`, `app/(dashboard)/items/[id]/page.tsx`, both report generators, and `tests/unit/reports-excel.test.ts`. Consumer changes are type-import edits only.

Follow-up risk: **LOW**. The earlier dependency-update risk and authenticated staging limitations still apply to the combined branch. The first-pass results below remain historical evidence.

Follow-up validation:

| Command | Result |
| --- | --- |
| `node --import tsx --test features/settings/queries.test.ts` before refactoring | 10 passed |
| `node --import tsx --test features/settings/queries.test.ts tests/integration/settings.test.ts` after refactoring | 16 passed |
| `node --import tsx --test tests/unit/reports-excel.test.ts tests/integration/reports.test.ts tests/integration/user-management.test.ts tests/integration/audit-explorer.test.ts tests/integration/locations.test.ts` | 24 passed |
| `npm run typecheck` | Passed, including a final rerun after removing the redundant dashboard assertion |
| `npm run check` | Passed: environment verification, **418 tests in 102 files**, lint, production build and bundle budgets |
| `npm run test:coverage` | Passed: **418 tests in 102 files**, 0 failed/skipped; per-process coverage only |
| `npm run audit:security` | All 4 checks passed |
| `npm run verify-db-release` | Passed; read-only verification only |
| `npm run audit:release` | 0 vulnerabilities reported |
| `node --import tsx scripts/run-playwright.ts smoke` | 1 passed, 1 authenticated case skipped |
| `node --import tsx scripts/run-playwright.ts chromium` | 1 passed, 1 authenticated case skipped |
| `git diff --check` and original tracked-patch preservation check | Passed |
| Moved interface comparison | All seven declarations match their original definitions exactly |

Browser checks used the production build from `npm run check`, avoiding redundant builds in the npm browser aliases. The local development server was temporarily stopped for those checks and restored afterward. The separate authenticated release prerequisite failure from the first pass remains unresolved; no staging credentials were supplied in the follow-up.

## Scope and method

Conservative cleanup on `codex/codebase-cleanup`, preserving existing working-tree changes. No deployment, database mutation, migration application, backup/restore execution, or business-rule rewrite was performed.

The inventory covered application routes, components, features, hooks, utilities, scripts, tests, migrations, dependencies, CSS imports, configuration, and CI. TypeScript module resolution was used to trace imports from application and script entry points. Text searches covered exported symbols, dynamic imports, runtime names, SQL, configuration, and tests. This is a repository maintenance audit with targeted code review, not a claim that every possible production execution was verified.

At inventory time: 153 non-test JS/TS source files, **34 files with a client directive** (including the realtime hook and browser Supabase module), and **45 migration files**. The earlier progress estimate of 35 client files was corrected by the inventory. Detailed local evidence and command logs are under the ignored `.cache/cleanup/` directory.

## Findings and disposition

| Priority | Finding | Disposition |
| --- | --- | --- |
| P0 | Manifests pinned Next.js 16.2.11, affected by critical RCE advisories, while local installation was already 16.3.4 | Pin Next.js and its ESLint config to 16.3.4; regenerate lockfile and verify a clean install |
| P1 | Colocated image-crop tests were absent from the main runner | Include component test patterns and add a filesystem-backed discovery regression test |
| P1 | Ignored scratch previews polluted strict compilation and lint; old generated route files referenced removed routes | Exclude scratch artifacts, generate route types before checking, and regenerate build output |
| P1 | `ws` imported by the Supabase server was development-only | Move to production dependencies, retaining version range |
| P1 | Other dependencies had audit advisories | Apply compatible lockfile updates; no forced major upgrades |
| P1 | Admin query authorization depends on its caller; admin errors expose raw DB messages in several paths; some audit writes do not inspect returned errors | Retain behavior and document targeted follow-up |
| P2 | Chart aliases and alternate tracing wrapper have no consumers | Remove only these verified unused exports and their exclusive import/comments |
| P2 | Sticker modal combined geometry, preset configuration, rendering, browser printing, and interaction | Extract geometry/typography/presets; preserve printable markup and interaction |
| P2 | Alternative tool pipeline is reachable from tests but not current application/script entry points | Retain its seven production modules and tests; external integration expectations are not established |
| P2 | Security script overstated four local checks as a complete vulnerability/security audit | Make its summary and verification-event description match actual checks |
| P3 | README had stale features, engines, routes, and local-machine links | Correct documented behavior and link this report |

The dependency audit expanded the initial cleanup plan after identifying the P0 issue. The upstream [Windows RCE advisory](https://github.com/vercel/next.js/security/advisories/GHSA-p293-qw3h-jr36) and [AVIF image optimization advisory](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) list 16.3.3 as patched. The selected 16.3.4 version was already running locally before cleanup; the manifests now reproduce it. Next.js 16 upgrade guidance and the installed framework documentation were reviewed.

## Removed

- `RadarCategoryItem`, `CategoryComboItem`, and `CategoryRadarChart` in `features/reports/components/category-combo-chart.tsx`: compatibility aliases with no source, dynamic, test, script, config, or SQL consumers. They are ordinary exports, not route conventions or RPC names.
- `traceAction` in `lib/tracing/instrument-action.ts`: unused alternate wrapper. The tracing barrel re-exported it, but no importer or dynamic lookup consumed it. Its exclusive `isApplicationError` import was removed; the underlying error helper remains used elsewhere. Active tracing through `beginActionTrace` and `classifyActionResponse` is unchanged.
- One unused React import in the pre-existing, untracked mobile-navigation test; all assertions preserved.
- Stale compatibility comments, obsolete README claims, and machine-specific documentation links.

No tracked file, migration, component implementation, hook, meaningful test, or direct dependency was deleted. Old generated route output was regenerated by the normal production build, not treated as source code.

## Refactored

- `scripts/run-tests.ts`: discover colocated component tests alongside existing feature, unit, component, integration, library, and script tests. Discovery accepts a root directory for its regression test. Per-file isolation, failure reporting, and the 60-second timeout are unchanged.
- `tsconfig.json` and `eslint.config.mjs`: exclude the already ignored scratch workspace. Production code and actual tests remain checked; strictness and unused-local/parameter checks remain enabled.
- `package.json`: `typecheck` runs documented `next typegen` first. This refreshes route definitions on clean checkouts; a build was needed once to clear this checkout's stale per-route generated files.
- `scripts/verify-security.ts`: describe the actual local checks and direct maintainers to separate dependency/database gates. No check was weakened or removed.
- README: webpack scripts, print-to-PDF implementation, manual asset numbers, existing health endpoints, and portable documentation references.

## Duplicates consolidated

Removed the unused alternate tracing wrapper and chart naming aliases. No authorization, validation, date formatting, metadata mutations, or database fallbacks were merged: similar code in these areas can represent different permissions, response contracts, or deployment compatibility requirements.

## Client → Server conversions

None. All 34 client-marked files have a concrete reason to remain: hooks, events, browser APIs, context, realtime, or an explicit browser-only module. The two wrappers without their own state (`DashboardRealtimeBoundary` and `item-list-client`) use `next/dynamic` with `ssr: false`, which requires a client boundary. Static display components already avoid client directives. Existing memoization and effect behavior are preserved.

## Large modules split

`components/ui/asset-tag-modal.tsx` originally had 1,347 lines and owned label geometry, sizing presets, typography, printable rendering, preview pagination, UI state, and printing.

- `components/ui/asset-tag-layout.ts`: 151 lines of pure grid types, dimensions, typography, and preset configuration, with no React/browser dependencies.
- `components/ui/asset-tag-modal.tsx`: retains field visibility, sticker rendering, preview, interactions, and print behavior. Tests import layout calculations directly instead of through the modal. No compatibility barrel was added.

All preset values, rounding, dimensions, and printable markup were retained. The existing 16 tests cover geometry, presets, paging, copy multiplication, field visibility, QR/barcodes, custom margins, printing, and cut lines.

Other large modules were retained: the database panel (~1,299 lines), items explorer (~1,295), users panel (~907), item actions (~827), settings actions (~735), and audit explorer (~699). Safe extraction needs behavior-focused regression coverage for their individual workflows; size alone was not used as a reason to split them. Several also contained pre-existing edits.

## Dependencies

- `next`: 16.2.11 → 16.3.4; `eslint-config-next`: aligned and pinned to 16.3.4.
- `ws`: development → production dependency, still `^8.21.1`.
- Compatible security updates include sharp 0.35.4, baseline-browser-mapping 2.11.22, browserslist 4.28.9, fast-uri 3.1.7, hono 4.13.7, js-yaml 4.3.2, and qs 6.16.0, plus their required framework/platform/support packages.
- Retained shadcn because `app/globals.css` imports its CSS, `@testing-library/dom` because React Testing Library declares it as a peer, automatic `@types/*` packages, and all dynamically loaded export dependencies.
- A clean install initially failed because the existing local Next development server held a Windows native-module lock. That identified server was stopped; the subsequent clean install succeeded. No unrelated processes were stopped.

## Security verification

Authorization, RLS definitions, validation, audit writes, mutation rate limits, backup/restore, RPC execution rules, and service-role factories were not changed by this cleanup. The original working-tree patch still applies in reverse-check mode, verifying preservation of those pre-existing tracked edits.

The admin page still calls `requireAdmin` before loading profiles; privileged mutation actions retain their guards. This does not eliminate the follow-up need for self-contained query guards. No service-role credential was moved into client code. The database readiness script is read-only and checks its defined migration-ledger entries, six registry tables' RLS flags, and six RPC grant surfaces; its success does not prove every policy or later migration in the repository.

The security script checks headers, rate limiting, CSV/filename sanitization, and log formatting. Its output is no longer presented as a full penetration test or dependency scan.

## Performance impact

No latency improvement is claimed. The layout extraction improves responsibility boundaries and testability; no client-to-server conversion or query optimization was performed. Final build measurements matched the initial local 16.3.4 build: shared JS **436.30 KB raw / 128.17 KB gzip**, dashboard JS **125.61 KB raw / 41.57 KB gzip**. All configured budgets passed. This is a budget check, not a runtime performance benchmark.

## Tests and verification

| Command/check | Result |
| --- | --- |
| Baseline `npm test` | Passed: 405 tests, 100 files |
| Baseline `npm run typecheck` | Failed on scratch previews, stale generated routes, and an unused React import |
| Baseline `npm run lint` | Failed: 14 errors and 697 warnings from generated scratch code |
| `node --import tsx --test scripts/run-tests.test.ts` before the fix | Failed as intended; after exporting discovery, the assertion showed exactly the missing component files |
| `node --import tsx --test scripts/run-tests.test.ts components/ui/image-crop-dialog.test.tsx` | Passed: 7 tests |
| `node --import tsx --test tests/component/category-combo-chart.test.tsx tests/unit/tracing.test.ts tests/unit/metrics.test.ts tests/unit/error-handler.test.ts` | Passed: 15 tests |
| `node --import tsx --test tests/component/asset-tag-modal.test.tsx` | Passed: 16 tests |
| `npm run lint` after each source batch | Passed |
| `npm run typecheck` | Passed after the standard build regenerated old route output; includes strict unused-code checks |
| `npm run build` | Passed, including raw and gzip bundle budgets |
| `npm run check` | Passed: environment verification, **408 tests across 101 files**, lint, production build and bundle budgets |
| `npm run test:coverage` | Passed: **408 tests across 101 files**, no skips/failures. Runner produces per-process coverage; there is no valid combined repository coverage percentage |
| `npm run audit:security` | Passed: all 4 local security checks |
| `npm run verify-db-release` | Passed: read-only migration ledger, RLS flags, and RPC-grant checks implemented by the script |
| Migration verification | `scripts/migration-utils.test.ts`, `tests/integration/release-migrations.test.ts`, security migration/index/trigger tests all ran within the passing full suite |
| `npm install --package-lock-only --ignore-scripts` | Passed; initial dependency audit reported 8 vulnerabilities |
| `npm audit fix --package-lock-only --ignore-scripts` | Passed after pinning Next.js: 0 vulnerabilities |
| `npm ci` | First attempt failed with a native-module file lock; second attempt passed after stopping the identified local dev server: 824 packages installed, 0 audit vulnerabilities |
| `npm ls --depth=0` | Baseline failed on invalid Next.js and an extraneous package; final passed |
| `npm audit` and `npm run audit:release` | Passed: 0 vulnerabilities, including the production-only audit |
| `npm run test:smoke` | Passed its build and unauthenticated browser test; 1 credential-dependent test skipped |
| `npm run test:e2e` | Passed its build and unauthenticated Chromium test; 1 authenticated CRUD/accessibility journey skipped |
| `npm run test:e2e:release` | **Failed prerequisites as designed**: `CAMMS_E2E_REAL_AUTH`, `CAMMS_E2E_ADMIN_ID`, and `CAMMS_E2E_ADMIN_PASSWORD` absent |
| Browser bundle credential scan | 62 browser JS files scanned against the configured service-role key privately; **0 matches**. The credential was never printed |
| Geometry extraction comparison | Function and preset bodies byte-identical after accounting for the export/name change |
| `git apply --reverse --check .cache/cleanup/pre-existing.patch` | Passed; original tracked changes remain intact |
| `git diff --check` | Passed |
| Migration diff | No changes |

The aggregate `test:all` alias was not repeated because its `check` and `test:smoke` constituents ran directly. Backup, restore, migration application, and the historical `tests/sql/asset-number-renderer.sql` were not run against the configured database. The SQL fixture explicitly requires an isolated database loaded to migration 00037, and later migration 00039 removes that feature. Keep it as historical verification rather than running it against current production state.

The direct generated-types cleanup command was rejected by automatic approval policy; the ordinary successful Next.js production build handled regeneration. No failed check was bypassed by weakening its assertions or compiler/security rules.

## Remaining technical debt

- `bulkDeleteItems` and `updateProfile` have no current source callers, but are exported Server Actions. They were retained as framework entry points rather than deleted from a static-import result.
- The Excel positional compatibility signature remains; retiring it needs a deliberate contract decision and export regression tests.
- `lib/tool-pipeline/` is a tested alternative to the current MCP implementation. Confirm whether consumers outside repository entry points rely on it before removing it.
- `getProfilesList` relies on its protected server-page caller; admin and auth query modules do not uniformly declare `server-only`. Tighten module boundaries with explicit authorization tests in a dedicated change.
- Several admin actions return raw DB errors and ignore errors returned by audit-log inserts. A durable audit failure policy and safe response contract need to be specified before changing these flows.
- The depreciation report is unbounded; other queries use fallbacks for varying migration states. Preserve export totals/filter semantics and verify deployed RPC availability before optimizing them.
- Metadata action duplication, report row/type assertions, and mixed admin responsibilities warrant further targeted work. Semantic permission helpers remain separate even where role lists currently match.
- Migration readiness checks only a subset of the historical migration chain. Preserve all 45 migrations, including legacy duplicate numeric prefixes; existing verification tests handle their special cases.
- Unused CSS cannot be proved safely from literal class search because classes are constructed dynamically and used in print markup. No CSS selectors were deleted.
- Install still reports deprecated transitive packages such as inflight, glob 7, fstream, and lodash.isequal. No unsafe forced major dependency replacement was attempted.
- Authenticated browser journeys require explicit staging/seed credentials. The release gate must fail rather than silently pass when those prerequisites are absent.

## Files changed by this cleanup

`README.md`; `components/ui/asset-tag-layout.ts` (new); `components/ui/asset-tag-modal.tsx`; `eslint.config.mjs`; `features/reports/components/category-combo-chart.tsx`; `lib/tracing/instrument-action.ts`; `package.json`; `package-lock.json`; `scripts/run-tests.ts`; `scripts/run-tests.test.ts`; `scripts/verify-security.ts`; `tests/component/asset-tag-modal.test.tsx`; `tests/component/mobile-navigation.test.tsx` (pre-existing file, unused import only); `tsconfig.json`; this report. The local implementation plan is under `docs/superpowers/plans/2026-09-11-codebase-cleanup.md`, ignored by the repository's existing Markdown rule.

## Risk assessment

**MEDIUM overall** because dependency security updates broaden the change beyond mechanical source cleanup. Source cleanup is low risk and preserves intended business behavior. Authenticated release verification remains a separate prerequisite; passing mocked tests and unauthenticated browser tests is not equivalent to a fully verified deployment.
