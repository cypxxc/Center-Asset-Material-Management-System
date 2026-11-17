# Completed Disbursement Chart Implementation Plan

> Execute inline with executing-plans. Design approved by user in conversation.

**Goal:** Show monthly completed borrowing and issue counts on Dashboard.

**Architecture:** User-scoped server query aggregates document headers by Bangkok handover month and type; a client component handles calendar/fiscal filters, stacked bars, totals, and table.

**Tech Stack:** Next.js 16, React 19, Drizzle SQL, existing semantic CSS tokens.

**Spec:** ../specs/2026-11-17-completed-disbursement-chart-design.md

## Constraints and review focus

- Preserve RLS and existing inventory charts; no database writes or migrations.
- No line joins, no approval/creation fallback, no repeated count on return.
- Test fiscal October boundary, empty months, missing handover, excluded states, Bangkok timezone and multiple document types.
- Label counts as ครั้ง; include accessible chart text and a table. All-year view stays monthly.

## Tasks

- [x] Write failing series and SQL execution tests for completed document counting and time buckets.
- [x] Implement SQL aggregation, user-scoped query, and monthly series helper.
- [x] Add chart, independent filters, legend, totals, empty state, table, and Dashboard streaming boundary.
- [x] Verify focused tests, TypeScript, lint, production build, and review final diff. Use read-only fixture SQL for database checks.

## Verification record

- Six focused tests passed, including real PostgreSQL evaluation over read-only CTE fixtures, client filter/table interaction, empty states, and fiscal boundary handling.
- `npm run typecheck` passed. ESLint passed for touched application/test sources. Scoped `git diff --check` passed.
- `npm run build` passed, including Dashboard budget: 214.44 KB raw / 74.76 KB gzip. Reused the existing lazy chart selector to keep the dropdown dependency deferred.
- Independent reviewer reported no actionable correctness findings.
- `npm test` stopped in the pre-existing unrelated `components/ui/image-crop-dialog.test.tsx` with `React is not defined` (2 failures); full suite is not passing.
- Authenticated production-browser check attempted on local port 3002, but login with configured initial admin credentials did not reach Dashboard. Actual authenticated desktop/mobile rendering remains unverified. Component interaction tests passed; no business data was changed.
