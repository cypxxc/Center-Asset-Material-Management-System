# Disbursement remediation implementation

Approved spec: `docs/superpowers/specs/2026-11-16-disbursement-standard-remediation.md`.

Work stays in the existing feature branch and preserves prior uncommitted work. No commit, publish, application server start, or direct correction of existing stock records.

1. Materials: exclude quantity from metadata edits, optimistic metadata version; receipts/count adjustment documents with reasons, references, deduplication and immutable stock movements; opening baseline reconciliation; partial usable-material returns with cumulative limits.
2. Cart: request batch identity, canonical payload hash, per-user idempotency, atomic child creation, batch display linking all child documents. Legacy callers without a key receive a new key; the current cart always supplies a retry-stable key.
3. Borrow: permit early return; validate new/edited due dates in Bangkok; require explicit corrected due date for overdue approval.
4. Tracking: explicit submission/approval/actual receipt timestamps, configurable approval SLA indicator without automatic cancellation or external messages.
5. Integrate forward migration and Drizzle schema, run focused unit/component and PostgreSQL regression checks, lint, typecheck and production build, then independent review of touched behavior.

Parallel ownership: material modules and stock SQL draft; tracking modules and detail integration; borrow date/return edits; root owns batches, migration assembly and final verification. Agents coordinate overlapping edits before writing. This uses subagent-driven-development for the independent scopes.

Progress and decisions are recorded here as work completes. Opening baseline records explain the starting position; they never replace current quantity. SLA has no arbitrary default.

## Execution ledger

- Migration 0011 generated with matching snapshot and applied successfully. Existing quantities were not rewritten; baseline documents record current quantity minus historical movements.
- Batch retry RED reproduced two distinct documents and double stock debit. GREEN live tests now verify sequential/concurrent duplicate retries, payload mismatch rejection, cancellation replay and owner-only recovery.
- Date/return: focused tests and live rollback verify early asset return and explicit replacement of stale due dates. Approval audit preserves old/new dates.
- Stock live rollback verifies metadata CAS, no quantity overwrite, receipt/count documents, deduplication, cumulative partial returns, usable quantity only, reverse guard and reconciliation.
- Tracking live rollback verifies one recipient receipt event/audit across retries and no stock changes. Unit tests verify optional SLA and no automatic expiration.
- First build exceeded dashboard JS budget because client date validation imported Zod. Replaced that helper dependency with strict ISO calendar validation; rebuild passed at 204.08 KB raw / 71.58 KB gzip (limits 220 / 80).
- Full test runner remains blocked by existing `components/ui/image-crop-dialog.test.tsx` (`React is not defined`); focused remediation suites run separately.
- Independent task review found retry form resets and key reset on stock reload; correction and regression tests in progress. Fresh whole-change review requested after integration.
- Review corrections complete: stock form values and immutable pending commands survive failures/reload; ambiguous transport failure permits retry of that exact command. Three form regressions passed. Cart recovery works with an empty catalog, canonical selection order and validated saved keys.
- Fresh whole-change reviewer found no Critical/Important issues. Final focused sequential suite: 27/27. Final PostgreSQL suites: 4/4. Parallel final checks hit host memory allocation failures; rerun checks sequentially to avoid resource contention.
- Sheet integration now forwards metadata/stock versions to the material form; generic item detail lookup fetches both versions from materials.
- Final verification: whole-project lint and strict typecheck passed; production build and all bundle budgets passed (dashboard 204.49 KB raw / 71.72 KB gzip). Sheet tests 2/2 passed with version forwarding assertion. The sheet-test OOM was an assertion formatting an unexpected DOM element from the stock form; scoping the assertion to the metadata form resolved it. No running application process was stopped.
- All implementation tasks complete. Full `npm test` is still blocked by the pre-existing image-crop test; no claim of a green entire repository suite. No commits or deployment performed.
- Ruling: record unusable material returns in immutable return documents without adding them to available stock. Costs: separate repair/disposal processing remains an operational responsibility.
- Ruling: historical unknown submitted/recipient-receipt timestamps stay unknown; no invented evidence. Costs: old documents may show missing timestamps.
- Ruling: retain legacy submit callers without a request key by generating one server-side; the current cart always supplies a retry-stable key. Costs: legacy integrations must adopt keys for transport retry protection.
