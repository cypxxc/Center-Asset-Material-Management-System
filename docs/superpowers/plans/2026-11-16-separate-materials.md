# Separate Materials Implementation Plan

**Goal:** Separate material storage, imports and navigation while preserving inventory history.
**Architecture:** Physical materials and asset items, identity registry for FK continuity, invoker-security union for shared reads. Dated source ledger fields remain distinct from current stock.
**Spec:** ../specs/2026-11-16-separate-materials-design.md
**Execution:** Native inline; preserve unrelated workspace edits.

- [x] Add Drizzle material/registry models and transactional migration; prove old records and FK histories survive, RLS matches, and invalid cross-type writes fail in disposable PostgreSQL.
- [x] Route common reads through the union and writes/locks through the physical table. Cover issue/reversal, archive/purge and new imports.
- [x] Preserve workbook fields in material imports and validate numeric/date fields; add synthetic and actual-file parsing tests.
- [x] Add material registry/add/edit pages and separate desktop/mobile navigation; assets default to asset-only.
- [x] Run focused tests, typecheck, lint, build and browser checks where available; request independent review and resolve findings.

Review focus: concurrent stock updates, migration FK/audit continuity, zero versus missing amounts, summary snapshots versus live balance, and accidental material leakage into asset-only pages.

Verification: 23 import tests passed; isolated PostgreSQL migration/runtime issue/reversal/import/RLS/FK test passed; browser desktop/mobile and material creation passed with no page errors. Actual supplied workbook parses 53 records with ledger fields. TypeScript and ESLint passed. Production build and bundle budgets passed in `.cache/materials-check`; root `.next` was locked by a running DLL. Independent review found image-reference and MCP paths, both corrected.

Rollout completed on 2026-11-16 at the user's explicit request. Full database/storage backup completed under `.cache/pre-material-migration-backups/camms-postgres-2026-11-16T08-50-18-508Z-d4d52669-26db-454d-a56f-e1a5ccaf67f3`. Stopped the old project dev/standalone processes, applied migration 0005 using `npm run db:migrate`, rebuilt successfully and restarted with `npm run start` on port 3000. Readiness, liveness and login returned HTTP 200. Reconciliation confirmed 901 assets and 53 materials; checksums of every pre-existing inventory field, 8 disbursements, 15 lines and 18 custody entries remained unchanged. Registry and union contain all 954 records and RLS is enabled. Do not rerun historical one-off material-to-asset reclassification scripts against the split schema.
